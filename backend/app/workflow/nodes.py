from typing import List, Dict, Any, Optional
from app.workflow.state import AuditState
from app.models.audit import CodeViolation, ViolationSeverity, AuditResult
from app.mcp.client import mcp_client
from app.core.config import settings
import logging
import json
import httpx
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# --- Helper Functions for GitHub API Fallback ---
async def fetch_github_file_content(repo_url: str, file_path: str) -> Optional[str]:
    """Fallback using public GitHub API (limited rate)"""
    try:
        parts = repo_url.rstrip("/").split("/")
        owner, repo = parts[-2], parts[-1]
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
        headers = {"Accept": "application/vnd.github.v3.raw"}
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"
            
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.text
            else:
                logger.warning(f"Failed to fetch {file_path} from GitHub API: {resp.status_code}")
                return None
    except Exception as e:
        logger.error(f"Error fetching file content from GitHub: {e}")
        return None

async def fetch_repo_state(state: AuditState) -> Dict[str, Any]:
    """
    Fetches the repository state using MCP or direct GitHub API.
    """
    repo_url = state['repo_url']
    logger.info(f"Fetching repo state for: {repo_url}")
    
    files_to_audit = []
    
    try:
        # 1. Parse repo owner/name
        parts = repo_url.rstrip("/").split("/")
        if len(parts) < 2:
            raise ValueError("Invalid repository URL")
        owner, repo = parts[-2], parts[-1]
        
        pr_number = state.get('pr_number')
        
        # Obter automaticamente o numero do ultimo PR se nao fornecido
        if not pr_number:
            try:
                pr_url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=1"
                headers_pr = {"Accept": "application/vnd.github.v3+json"}
                if settings.GITHUB_TOKEN:
                    headers_pr["Authorization"] = f"token {settings.GITHUB_TOKEN}"
                async with httpx.AsyncClient() as client:
                    pr_resp = await client.get(pr_url, headers=headers_pr)
                    if pr_resp.status_code == 200:
                        prs = pr_resp.json()
                        if prs and len(prs) > 0:
                            pr_number = prs[0]['number']
            except Exception as e:
                logger.warning(f"Could not fetch latest PR: {e}")
                
        # 2. Extract PR files via GitHub API
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files"
        headers = {"Accept": "application/vnd.github.v3+json"}
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"
            
        existing_files = []
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(api_url, headers=headers)
            
            if resp.status_code == 200:
                # Successfully listed PR files
                items = resp.json()
                
                # Only care about added/modified
                candidates = [
                    item for item in items 
                    if item.get('status') in ('added', 'modified', 'changed', 'renamed')
                ]
                
                # Filter for interesting extensions. Source code is needed to analyze implementation.
                interesting_extensions = ('.py', '.js', '.ts', '.tsx', '.md', '.txt', '.toml', '.json', '.yml', '.yaml')
                candidates = [c for c in candidates if c['filename'].endswith(interesting_extensions)]
                
                # Prioritize agentic MDs, then other MDs, then other files
                def sort_key(c):
                    fn = c['filename']
                    agentic_dirs = (".github/", ".claude/", ".gemini/", ".agent/", ".agents/", "docs/", "specs/", "docs/specs/")
                    agentic_keywords = ("skill", "agent", "plan", "spec", "tasks", "task", "instructions")
                    fn_lower = fn.lower()
                    is_agentic = any(fn.startswith(d) for d in agentic_dirs) or any(kw in fn_lower for kw in agentic_keywords)
                    is_md = fn.endswith('.md')
                    
                    if is_agentic and is_md:
                        return 0
                    if is_md:
                        return 1
                    return 2
                
                candidates.sort(key=sort_key)
                
                # Take up to 10 files to stay within context windows for this demo
                for item in candidates[:10]:
                    file_path = item['filename']
                    # We can use the original fetch_github_file_content or the patch directly
                    # The patch contains the diff, which is sometimes better for PR code review,
                    # but we also might want the full file for docs. We'll use the fallback fetcher for raw content.
                    content = await fetch_github_file_content(repo_url, file_path)
                    if content:
                        existing_files.append({"path": file_path, "content": content})
            else:
                logger.warning(f"Failed to list PR files from GitHub API: {resp.status_code}. Fallback to common files.")
                # Fallback to common files if listing fails (e.g. auth issues or private repo without token)
                common_files = ["README.md", "pyproject.toml", "requirements.txt", "main.py", "app.py"]
                for file_path in common_files:
                     content = await fetch_github_file_content(repo_url, file_path)
                     if content:
                         existing_files.append({"path": file_path, "content": content})
        
        if not existing_files:
             logger.warning("No files found via GitHub API.")
             return {"files_to_audit": [], "errors": ["No accessible files found."], "pr_number": pr_number}

        return {"files_to_audit": existing_files, "pr_number": pr_number}

    except Exception as e:
        logger.error(f"Error in fetch_repo_state: {e}")
        return {"files_to_audit": [], "errors": [str(e)]}

# --- LLM Analysis ---

class AnalysisResult(BaseModel):
    status: str = Field(description="Must be one of: FAIL, PARCIAL, PASS, NA. Determines final pass criteria based on found documentation.")
    violations: List[CodeViolation]
    summary: str

async def analyze_files(state: AuditState) -> Dict[str, Any]:
    """
    Analyzes the files using an LLM.
    """
    files = state.get("files_to_audit", [])
    logger.info(f"Analyzing {len(files)} files...")
    
    if not files:
        return {
            "audit_results": {
                "violations": [],
                "status": "NA",
                "summary": "No accessible files found to audit."
            }
        }

    # Prepare LLM
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0) # Use a capable model
    
    parser = JsonOutputParser(pydantic_object=AnalysisResult)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert AI code auditor. You are evaluating PR changes against AI development best practices.\n\n"
                  "RULES:\n"
                  "1. Detect agentic documentation inside directories like .github, .claude, .gemini, .agent, .agents, docs, specs, docs/specs, or files with keywords: SKILL, agent, plan, spec, tasks, task, instructions.\n"
                  "2. If ANY agentic documentation matching rule 1 is detected, you MUST set the status to 'PASS' (verde).\n"
                  "3. If NO agentic docs (no new or altered documentation matching rule 1) are detected in the PR, but at least one README file with relevant content is detected, set the status to 'PARCIAL' (amarelo).\n"
                  "4. If NO agentic docs and NO relevant README are detected in the PR, set status to 'FAIL' (vermelho).\n"
                  "5. Even if the status is 'PASS' or 'PARCIAL', you can still list violations if the documentation is incoherent with the source code implementation or missing critical contexts.\n"
                  "6. You can also use 'FAIL' if there's a catastrophic error in the analysis or if you explicitly determine the PR is entirely destructive.\n"
                  "7. Use 'NA' if the files cannot be analyzed properly.\n\n"
                  "8. Use 'FAIL'if the PR not contains any documentation."
                  "Return the result exactly matching the requested JSON format, with a status field of 'FAIL', 'PARCIAL', 'PASS', or 'NA'."),
        ("user", "Analyze the following files:\n\n{files_context}\n\n{format_instructions}")
    ])

    # Construct context
    files_context = ""
    for f in files:
        files_context += f"--- {f['path']} ---\n{f['content']}\n\n"
        
    chain = prompt | llm | parser
    
    try:
        result = await chain.ainvoke({
            "files_context": files_context,
            "format_instructions": parser.get_format_instructions()
        })
        
        violations = result.get("violations", [])
        status = result.get("status", "FAIL")
        summary = result.get("summary", "Analysis completed.")
        
        return {
            "audit_results": {
                "violations": violations,
                "status": status,
                "summary": summary
            }
        }
        
    except Exception as e:
        logger.error(f"LLM Analysis failed: {e}")
        return {
            "audit_results": {
                "violations": [],
                "status": "FAIL",
                "summary": f"Analysis failed: {str(e)}"
            }
        }

async def generate_report(state: AuditState) -> Dict[str, Any]:
    """
    Generates a final report based on the analysis.
    """
    logger.info("Generating report...")
    audit_results = state.get("audit_results")
    if not audit_results:
        return {"final_report": "Erro: Nenhum resultado de análise encontrado."}

    violations = audit_results.get("violations", [])
    status = audit_results.get("status", "DESCONHECIDO")
    summary = audit_results.get("summary", "Nenhum resumo fornecido.")
    
    report = f"# Relatório de Auditoria\n\n**Status**: {status}\n\n**Resumo**: {summary}\n\n## Violações:\n"
    if not violations:
        report += "- Nenhuma violação encontrada."
    else:
        for v in violations:
            # Handle dictionary or Pydantic object
            if isinstance(v, dict):
                severity = v.get('severity', 'info').upper()
                file_path = v.get('file_path', 'desconhecido')
                message = v.get('message', '')
                suggestion = v.get('suggestion', '')
            else:
                severity = v.severity.upper()
                file_path = v.file_path
                message = v.message
                suggestion = v.suggestion

            report += f"- **{severity}** em `{file_path}`: {message}\n  - *Sugestão*: {suggestion}\n"
    
    return {"final_report": report}

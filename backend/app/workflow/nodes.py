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
        
        # 2. Try to list files via GitHub API
        api_url = f"https://api.github.com/repos/{owner}/{repo}/contents"
        headers = {"Accept": "application/vnd.github.v3+json"}
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"
            
        existing_files = []
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(api_url, headers=headers)
            
            if resp.status_code == 200:
                # Successfully listed files
                items = resp.json()
                # Filter for interesting text files (code, config, docs)
                # Limit to avoid too many requests in this demo
                interesting_extensions = ('.py', '.js', '.ts', '.tsx', '.md', '.txt', '.toml', '.json', '.yml', '.yaml')
                candidates = [item for item in items if item['type'] == 'file' and item['name'].endswith(interesting_extensions)]
                
                # Take up to 5 files to stay within rate limits/context window for demo
                for item in candidates[:5]:
                    content = await fetch_github_file_content(repo_url, item['path'])
                    if content:
                        existing_files.append({"path": item['path'], "content": content})
            else:
                logger.warning(f"Failed to list files from GitHub API: {resp.status_code}. Fallback to common files.")
                # Fallback to common files if listing fails (e.g. auth issues or private repo without token)
                common_files = ["README.md", "pyproject.toml", "requirements.txt", "main.py", "app.py"]
                for file_path in common_files:
                     content = await fetch_github_file_content(repo_url, file_path)
                     if content:
                         existing_files.append({"path": file_path, "content": content})
        
        if not existing_files:
             logger.warning("No files found via GitHub API.")
             return {"files_to_audit": [], "errors": ["No accessible files found."]}

        return {"files_to_audit": existing_files}

    except Exception as e:
        logger.error(f"Error in fetch_repo_state: {e}")
        return {"files_to_audit": [], "errors": [str(e)]}

# --- LLM Analysis ---

class AnalysisResult(BaseModel):
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
                "status": "SKIPPED",
                "summary": "No accessible files found to audit."
            }
        }

    # Prepare LLM
    llm = ChatOpenAI(model="gpt-4-turbo-preview", temperature=0) # Use a capable model
    
    parser = JsonOutputParser(pydantic_object=AnalysisResult)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert code auditor specializing in security, best practices, and architecture. Analyze the provided code files and report any violations. Return the result in JSON format."),
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
        status = "NOK" if violations else "OK"
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
                "status": "ERROR",
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
        return {"final_report": "Error: No analysis results found."}

    violations = audit_results.get("violations", [])
    status = audit_results.get("status", "UNKNOWN")
    summary = audit_results.get("summary", "No summary provided.")
    
    report = f"# Audit Report\n\n**Status**: {status}\n\n**Summary**: {summary}\n\n## Violations:\n"
    if not violations:
        report += "- No violations found."
    else:
        for v in violations:
            # Handle dictionary or Pydantic object
            if isinstance(v, dict):
                severity = v.get('severity', 'info').upper()
                file_path = v.get('file_path', 'unknown')
                message = v.get('message', '')
                suggestion = v.get('suggestion', '')
            else:
                severity = v.severity.upper()
                file_path = v.file_path
                message = v.message
                suggestion = v.suggestion

            report += f"- **{severity}** in `{file_path}`: {message}\n  - *Suggestion*: {suggestion}\n"
    
    return {"final_report": report}

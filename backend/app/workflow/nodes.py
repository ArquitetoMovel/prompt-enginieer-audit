import logging
from typing import Dict, Any
from app.workflow.state import AuditState
from app.services.github_service import GitHubService
from app.services.ai_service import AIService
from app.domain.models import PullRequest, FileContent

logger = logging.getLogger(__name__)

async def fetch_repo_state(state: AuditState) -> Dict[str, Any]:
    repo_url = state.get('repo_url')
    pr_number = state.get('pr_number')
    
    github_service = GitHubService()
    
    if not pr_number:
        prs = await github_service.fetch_recent_pull_requests(repo_url, limit=1)
        if prs:
            pr_number = prs[0].number
            
    if not pr_number:
        return {"files_to_audit": [], "errors": ["No PR found or specified."], "pr_number": None}

    pr = await github_service.fetch_pull_request_files(repo_url, pr_number)
    
    files_to_audit = [{"path": f.path, "content": f.content} for f in pr.files]
    
    if not files_to_audit:
        return {"files_to_audit": [], "errors": ["No accessible files found."], "pr_number": pr_number}

    return {"files_to_audit": files_to_audit, "pr_number": pr_number}

async def analyze_files(state: AuditState) -> Dict[str, Any]:
    files = state.get("files_to_audit", [])
    
    if not files:
        return {
            "audit_results": {
                "violations": [],
                "status": "NA",
                "summary": "No accessible files found to audit."
            }
        }
        
    ai_service = AIService()
    pr = PullRequest(number=state.get("pr_number") or 0)
    pr.files = [FileContent(**f) for f in files]
    
    result = await ai_service.analyze_pull_request(pr)
    
    violations = [v.model_dump() for v in result.violations]
    
    return {
        "audit_results": {
            "violations": violations,
            "status": result.status.value,
            "summary": result.summary
        }
    }

async def generate_report(state: AuditState) -> Dict[str, Any]:
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
            if isinstance(v, dict):
                severity = v.get('severity', 'info').upper()
                file_path = v.get('file_path', 'desconhecido')
                message = v.get('message', '')
                suggestion = v.get('suggestion', '')
            else:
                severity = getattr(v, 'severity', 'info').upper()
                file_path = getattr(v, 'file_path', 'desconhecido')
                message = getattr(v, 'message', '')
                suggestion = getattr(v, 'suggestion', '')

            report += f"- **{severity}** em `{file_path}`: {message}\n  - *Sugestão*: {suggestion}\n"
    
    return {"final_report": report}

from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.audit import AuditRequest, AuditResult, CodeViolation, ViolationSeverity
from app.workflow.graph import app as audit_workflow
from app.workflow.state import AuditState
import uuid
import datetime
from typing import Dict, Any

router = APIRouter()

# In-memory store for demonstration purposes (replace with Redis/DB in production)
audit_store: Dict[str, Dict[str, Any]] = {}

from app.routers.repository import repositories_store
from app.websockets import manager
from app.services.github_service import GitHubService

async def run_audit_task(audit_id: str, request: AuditRequest):
    # Update status to running
    audit_store[audit_id]["status"] = "running"
    
    # Run the graph
    inputs = {"repo_url": request.repo_url, "pr_number": request.pr_number}
    try:
        config = {"configurable": {"thread_id": audit_id}}
        final_state = await audit_workflow.ainvoke(inputs, config=config)
        
        # Extract results
        audit_results = final_state.get("audit_results", {})
        violations = audit_results.get("violations", [])
        summary = audit_results.get("summary", "Analysis completed.")
        status = audit_results.get("status", "NA")
        pr_number = final_state.get("pr_number") or request.pr_number
        
        # Extract markdown files
        evaluated_md_files = []
        for file_data in final_state.get("files_to_audit", []):
            if file_data.get("path", "").endswith(".md"):
                evaluated_md_files.append({"path": file_data["path"], "content": file_data["content"]})
        
        # Update store with results
        audit_store[audit_id]["result"] = AuditResult(
            RepositoryName=request.repo_url.split('/')[-1] if not hasattr(request, "RepositoryName") else getattr(request, "RepositoryName"), # fallback to extract name from URL
            RepositoryURL=request.repo_url,
            ScanStatus=status,
            LastScan=datetime.datetime.now().isoformat(),
            pr_number=pr_number,
            violations=[CodeViolation(**v) if isinstance(v, dict) else v for v in violations],
            summary=summary,
            markdown_files=evaluated_md_files,
        )
        audit_store[audit_id]["status"] = "completed"
        
        if audit_id in repositories_store:
            repositories_store[audit_id]["ScanStatus"] = status
            repositories_store[audit_id]["LastScan"] = datetime.datetime.now().isoformat()
            if pr_number is not None:
                repositories_store[audit_id]["PullRequest"] = pr_number
            await manager.broadcast({"type": "repo_update", "data": repositories_store[audit_id], "event": "audit_completed"})
            
        print(f"Audit {audit_id} completed: {status}")
        
    except Exception as e:
        print(f"Error running audit {audit_id}: {e}")
        audit_store[audit_id]["status"] = "failed"
        audit_store[audit_id]["error"] = str(e)
        if audit_id in repositories_store:
            repositories_store[audit_id]["ScanStatus"] = "FAIL"
            await manager.broadcast({"type": "repo_update", "data": repositories_store[audit_id], "event": "audit_failed"})

@router.get("/prs", response_model=list[dict])
async def list_pull_requests(repo_url: str, limit: int = 5):
    try:
        github_service = GitHubService()
        prs = await github_service.fetch_recent_pull_requests(repo_url, limit=limit)
        return [{"number": pr.number, "title": pr.title, "created_at": pr.created_at.isoformat() if pr.created_at else None} for pr in prs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/audit", response_model=dict)
async def trigger_audit(request: AuditRequest, background_tasks: BackgroundTasks):
    audit_id = request.repo_id
    
    # Update repository status to pending
    if audit_id in repositories_store:
        repositories_store[audit_id]["ScanStatus"] = "PARCIAL" 
        await manager.broadcast({"type": "repo_update", "data": repositories_store[audit_id], "event": "audit_started"})

    # Initialize in store
    audit_store[audit_id] = {
        "status": "pending",
        "request": request,
        "created_at": datetime.datetime.now().isoformat()
    }
    
    background_tasks.add_task(run_audit_task, audit_id, request)
    return {"message": "Audit started", "audit_id": audit_id, "repo_url": request.repo_url}

@router.get("/audit/{audit_id}", response_model=AuditResult)
async def get_audit_status(audit_id: str):
    if audit_id not in audit_store:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    audit_data = audit_store[audit_id]
    
    if audit_data["status"] == "failed":
        raise HTTPException(status_code=500, detail=f"Audit failed: {audit_data.get('error')}")
        
    if audit_data["status"] in ["pending", "running"]:
        # Return a partial result indicating it's still running
        return AuditResult(
            RepositoryName=audit_data["request"].repo_url.split('/')[-1] if not hasattr(audit_data["request"], "RepositoryName") else getattr(audit_data["request"], "RepositoryName"),
            RepositoryURL=audit_data["request"].repo_url,
            ScanStatus="NA",
            LastScan=audit_data["created_at"],
            pr_number=audit_data["request"].pr_number,
            violations=[],
            summary="Audit is in progress...",
        )
        
    return audit_data["result"]

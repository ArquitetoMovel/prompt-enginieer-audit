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

async def run_audit_task(audit_id: str, request: AuditRequest):
    # Update status to running
    audit_store[audit_id]["status"] = "running"
    
    # Run the graph
    inputs = {"repo_url": request.repo_url}
    try:
        config = {"configurable": {"thread_id": audit_id}}
        final_state = await audit_workflow.ainvoke(inputs, config=config)
        
        # Extract results
        audit_results = final_state.get("audit_results", {})
        violations = audit_results.get("violations", [])
        summary = audit_results.get("summary", "Analysis completed.")
        status = audit_results.get("status", "UNKNOWN")
        
        # Update store with results
        audit_store[audit_id]["result"] = AuditResult(
            repo_name=request.repo_url,
            pr_number=request.pr_number,
            overall_status=status,
            violations=[CodeViolation(**v) if isinstance(v, dict) else v for v in violations],
            summary=summary,
            timestamp=datetime.datetime.now().isoformat()
        )
        audit_store[audit_id]["status"] = "completed"
        
        print(f"Audit {audit_id} completed: {status}")
        
    except Exception as e:
        print(f"Error running audit {audit_id}: {e}")
        audit_store[audit_id]["status"] = "failed"
        audit_store[audit_id]["error"] = str(e)

@router.post("/audit", response_model=dict)
async def trigger_audit(request: AuditRequest, background_tasks: BackgroundTasks):
    audit_id = str(uuid.uuid4())
    
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
            repo_name=audit_data["request"].repo_url,
            pr_number=audit_data["request"].pr_number,
            overall_status="PENDING",
            violations=[],
            summary="Audit is in progress...",
            timestamp=audit_data["created_at"]
        )
        
    return audit_data["result"]

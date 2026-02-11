from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict

class AuditState(TypedDict):
    repo_url: str
    pr_number: Optional[int]
    files_to_audit: List[str]
    audit_results: Dict[str, Any]
    final_report: str
    status: str
    errors: List[str]

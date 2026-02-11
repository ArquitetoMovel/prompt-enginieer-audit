from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

class ViolationSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class CodeViolation(BaseModel):
    file_path: str
    line_number: Optional[int]
    severity: ViolationSeverity
    message: str
    suggestion: str
    code_snippet: Optional[str] = None

class AuditResult(BaseModel):
    repo_name: str
    pr_number: Optional[int] = None
    overall_status: str  # "OK" | "NOK"
    violations: List[CodeViolation]
    summary: str
    timestamp: str

class AuditRequest(BaseModel):
    repo_url: str
    pr_number: Optional[int] = None
    branch: Optional[str] = "main"


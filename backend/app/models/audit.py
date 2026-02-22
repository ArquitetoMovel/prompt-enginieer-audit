from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

class ViolationSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class MarkdownFile(BaseModel):
    path: str
    content: str


class ScanStatusEnum(str, Enum):
    NA = "NA"
    FAIL = "FAIL"
    PARCIAL = "PARCIAL"
    PASS = "PASS"

class CodeViolation(BaseModel):
    file_path: str
    line_number: Optional[int] = None
    severity: ViolationSeverity
    message: str
    suggestion: str
    code_snippet: Optional[str] = None

class AuditResult(BaseModel):
    RepositoryName: str
    RepositoryURL: str
    ScanStatus: ScanStatusEnum
    LastScan: str
    
    # Keeping old fields just so that they exist if needed
    pr_number: Optional[int] = None
    violations: List[CodeViolation] = Field(default_factory=list)
    summary: str = ""
    markdown_files: List[MarkdownFile] = Field(default_factory=list)

class AuditRequest(BaseModel):
    repo_id: str
    repo_url: str
    pr_number: Optional[int] = None
    branch: Optional[str] = "main"

class RepositoryBase(BaseModel):
    RepositoryName: str
    RepositoryURL: str
    ScanStatus: ScanStatusEnum = ScanStatusEnum.NA
    LastScan: Optional[str] = None
    PullRequest: Optional[int] = None
    Tags: Optional[List[str]] = Field(default_factory=list)

class RepositoryCreate(BaseModel):
    RepositoryName: str
    RepositoryURL: str
    PullRequest: Optional[int] = None
    Tags: Optional[List[str]] = Field(default_factory=list)

class RepositoryUpdate(BaseModel):
    RepositoryName: Optional[str] = None
    RepositoryURL: Optional[str] = None
    PullRequest: Optional[int] = None
    Tags: Optional[List[str]] = None

class RepositoryResponse(RepositoryBase):
    id: str


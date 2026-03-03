from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.models.audit import CodeViolation, ScanStatusEnum

class FileContent(BaseModel):
    path: str
    content: str

class PullRequest(BaseModel):
    number: int
    title: Optional[str] = None
    created_at: Optional[datetime] = None
    files: List[FileContent] = Field(default_factory=list)

class AnalysisResultDomain(BaseModel):
    status: ScanStatusEnum
    violations: List[CodeViolation] = Field(default_factory=list)
    summary: str = ""

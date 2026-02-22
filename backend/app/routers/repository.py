from fastapi import APIRouter, HTTPException
from typing import Dict, List, Optional
from app.models.audit import RepositoryCreate, RepositoryResponse, RepositoryUpdate, ScanStatusEnum
import uuid

router = APIRouter()

# In-memory store for repositories
repositories_store: Dict[str, dict] = {}

@router.post("/", response_model=RepositoryResponse)
async def create_repository(repository: RepositoryCreate):
    repo_id = str(uuid.uuid4())
    repo_data = {
        "id": repo_id,
        "RepositoryName": repository.RepositoryName,
        "RepositoryURL": repository.RepositoryURL,
        "ScanStatus": ScanStatusEnum.NA,
        "PullRequest": repository.PullRequest,
        "Tags": repository.Tags,
    }
    repositories_store[repo_id] = repo_data
    return RepositoryResponse(**repo_data)

@router.put("/{repo_id}", response_model=RepositoryResponse)
async def update_repository(repo_id: str, repository: RepositoryUpdate):
    if repo_id not in repositories_store:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    repo_data = repositories_store[repo_id]
    
    if repository.RepositoryName is not None:
        repo_data["RepositoryName"] = repository.RepositoryName
    if repository.RepositoryURL is not None:
        repo_data["RepositoryURL"] = repository.RepositoryURL
    if repository.PullRequest is not None:
        repo_data["PullRequest"] = repository.PullRequest
    if repository.Tags is not None:
        repo_data["Tags"] = repository.Tags
        
    return RepositoryResponse(**repo_data)

@router.delete("/{repo_id}", status_code=204)
async def delete_repository(repo_id: str):
    if repo_id not in repositories_store:
        raise HTTPException(status_code=404, detail="Repository not found")
    del repositories_store[repo_id]

@router.get("/", response_model=List[RepositoryResponse])
async def list_repositories():
    return [RepositoryResponse(**repo) for repo in repositories_store.values()]

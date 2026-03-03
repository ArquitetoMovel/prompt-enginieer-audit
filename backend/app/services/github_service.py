import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.config import settings
from app.domain.models import PullRequest, FileContent

logger = logging.getLogger(__name__)

class GitHubService:
    def __init__(self):
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if settings.GITHUB_TOKEN:
            self.headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"

    def _parse_repo_url(self, repo_url: str) -> tuple[str, str]:
        parts = repo_url.rstrip("/").split("/")
        if len(parts) < 2:
            raise ValueError("Invalid repository URL")
        return parts[-2], parts[-1]

    async def fetch_recent_pull_requests(self, repo_url: str, since_date: Optional[datetime] = None, limit: int = 5) -> List[PullRequest]:
        """
        Fetches recent PR metadata.
        """
        owner, repo = self._parse_repo_url(repo_url)
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page={limit}"
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 200:
                    prs = resp.json()
                    results = []
                    for pr_data in prs:
                        pr_date = datetime.fromisoformat(pr_data.get("created_at", "").replace("Z", "+00:00"))
                        if since_date and pr_date < since_date:
                            continue
                        results.append(PullRequest(
                            number=pr_data['number'],
                            title=pr_data.get('title'),
                            created_at=pr_date
                        ))
                    return results
                else:
                    logger.warning(f"Failed to fetch PRs: {resp.status_code}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching PRs from GitHub API: {e}")
            return []

    async def fetch_pull_request_files(self, repo_url: str, pr_number: int) -> PullRequest:
        """
        Fetches the files modified in a specific PR.
        """
        owner, repo = self._parse_repo_url(repo_url)
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files"
        
        pr = PullRequest(number=pr_number)
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(api_url, headers=self.headers)
                if resp.status_code == 200:
                    items = resp.json()
                    
                    # Only care about added/modified/changed/renamed
                    candidates = [item for item in items if item.get('status') in ('added', 'modified', 'changed', 'renamed')]
                    
                    # Filter for interesting extensions
                    interesting_extensions = ('.py', '.js', '.ts', '.tsx', '.md', '.txt', '.toml', '.json', '.yml', '.yaml')
                    candidates = [c for c in candidates if c['filename'].endswith(interesting_extensions)]
                    
                    # Prioritize formatting
                    def sort_key(c):
                        fn = c['filename']
                        agentic_dirs = (".github/", ".claude/", ".gemini/", ".agent/", ".agents/", "docs/", "specs/", "docs/specs/")
                        agentic_keywords = ("skill", "agent", "plan", "spec", "tasks", "task", "instructions")
                        fn_lower = fn.lower()
                        is_agentic = any(fn.startswith(d) for d in agentic_dirs) or any(kw in fn_lower for kw in agentic_keywords)
                        is_md = fn.endswith('.md')
                        
                        if is_agentic and is_md: return 0
                        if is_md: return 1
                        return 2
                        
                    candidates.sort(key=sort_key)
                    
                    for item in candidates[:10]:
                        file_path = item['filename']
                        content = await self.fetch_file_content(repo_url, file_path)
                        if content:
                            pr.files.append(FileContent(path=file_path, content=content))
                else:
                    logger.warning(f"Failed to list PR files: {resp.status_code}. Fallback to common files.")
                    await self._fallback_fetch(repo_url, pr)
        except Exception as e:
            logger.error(f"Error fetching PR files: {e}")
            await self._fallback_fetch(repo_url, pr)

        return pr

    async def _fallback_fetch(self, repo_url: str, pr: PullRequest):
         common_files = ["README.md", "pyproject.toml", "requirements.txt", "main.py", "app.py"]
         for file_path in common_files:
             content = await self.fetch_file_content(repo_url, file_path)
             if content:
                 pr.files.append(FileContent(path=file_path, content=content))

    async def fetch_file_content(self, repo_url: str, file_path: str) -> Optional[str]:
        owner, repo = self._parse_repo_url(repo_url)
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
        
        headers = dict(self.headers)
        headers["Accept"] = "application/vnd.github.v3.raw"
        
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    return resp.text
                return None
        except Exception as e:
            logger.error(f"Error fetching file content from GitHub: {e}")
            return None

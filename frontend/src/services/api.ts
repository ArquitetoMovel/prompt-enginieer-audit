import { Repository } from '@/types';

// Temporarily store in localStorage if API is not yet ready
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const getLocalRepos = (): Repository[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('audit_repos');
  if (stored) return JSON.parse(stored);
  return [];
};

const saveLocalRepos = (repos: Repository[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('audit_repos', JSON.stringify(repos));
  }
};

export async function fetchRepositories(): Promise<Repository[]> {
  try {
    const res = await fetch('http://localhost:8000/api/v1/repositories');
    if (res.ok) {
      const data = await res.json();
      return data.map((item: any) => ({
        id: item.id || Math.random().toString(36).substring(7),
        name: item.RepositoryName,
        url: item.RepositoryURL,
        prNumber: item.PullRequest || null,
        status: item.ScanStatus || 'NA',
        lastScan: item.LastScan || null,
        tags: item.Tags || []
      }));
    }
  } catch {
    console.warn('Backend not available yet, using local storage fallback for GET');
  }
  
  await delay(500);
  return getLocalRepos();
}

export async function fetchPullRequests(repoUrl: string, limit: number = 5): Promise<any[]> {
  try {
    const res = await fetch(`http://localhost:8000/api/v1/prs?repo_url=${encodeURIComponent(repoUrl)}&limit=${limit}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend not available for fetchPullRequests', e);
  }
  return [];
}

export async function createRepository(name: string, url: string, prNumber?: number, tags: string[] = []): Promise<Repository> {
  const payload = {
    RepositoryName: name,
    RepositoryURL: url,
    PullRequest: prNumber || null,
    Tags: tags
  };

  try {
    const res = await fetch('http://localhost:8000/api/v1/repositories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const item = await res.json();
      return {
        id: item.id || Math.random().toString(36).substring(7),
        name: item.RepositoryName,
        url: item.RepositoryURL,
        prNumber: item.PullRequest || null,
        status: item.ScanStatus || 'NA',
        lastScan: item.LastScan || null,
        tags: item.Tags || []
      };
    }
  } catch {
    console.warn('Backend not available yet, using local storage fallback for POST');
  }

  await delay(500);
  const newRepo: Repository = {
    id: Math.random().toString(36).substring(7),
    name,
    url,
    prNumber: prNumber || null,
    status: 'NA',
    lastScan: null,
    tags
  };
  
  const repos = getLocalRepos();
  repos.push(newRepo);
  saveLocalRepos(repos);
  return newRepo;
}

export async function updateRepository(id: string, name: string, url: string, prNumber?: number | null, tags: string[] = []): Promise<Repository> {
  const payload = {
    RepositoryName: name,
    RepositoryURL: url,
    PullRequest: prNumber || null,
    Tags: tags
  };

  try {
    const res = await fetch(`http://localhost:8000/api/v1/repositories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const item = await res.json();
      return {
        id: item.id,
        name: item.RepositoryName,
        url: item.RepositoryURL,
        prNumber: item.PullRequest || null,
        status: item.ScanStatus || 'NA',
        lastScan: item.LastScan || null,
        tags: item.Tags || []
      };
    }
  } catch {
    console.warn('Backend not available yet, using local storage fallback for PUT');
  }

  await delay(500);
  const repos = getLocalRepos();
  const repoIdx = repos.findIndex(r => r.id === id);
  if (repoIdx >= 0) {
    repos[repoIdx] = { ...repos[repoIdx], name, url, prNumber: prNumber || null, tags };
    saveLocalRepos(repos);
    return repos[repoIdx];
  }
  throw new Error('Repository not found locally either.');
}

export async function deleteRepository(id: string): Promise<void> {
  try {
    await fetch(`http://localhost:8000/api/v1/repositories/${id}`, {
      method: 'DELETE'
    });
  } catch {
    console.warn('Backend not available yet, using local storage fallback for DELETE');
  }
  
  await delay(500);
  const repos = getLocalRepos();
  const newRepos = repos.filter(r => r.id !== id);
  saveLocalRepos(newRepos);
}

export async function runScan(repoId: string, url: string, prNumber: number | null): Promise<string> {
  // Call the audit endpoint
  try {
    const res = await fetch('http://localhost:8000/api/v1/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_id: repoId, repo_url: url, pr_number: prNumber })
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.audit_id; // assuming this returns { audit_id: "..." }
    }
  } catch {
    console.warn('Backend not available yet, handling scan locally');
  }

  // Simulate local fallback
  await delay(1500);
  
  // Update local repo status to PASS or FAIL randomly
  const repos = getLocalRepos();
  const repoIdx = repos.findIndex(r => r.id === repoId);
  if (repoIdx >= 0) {
    repos[repoIdx].status = Math.random() > 0.5 ? 'PASS' : 'FAIL';
    repos[repoIdx].lastScan = new Date().toISOString();
    saveLocalRepos(repos);
  }

  return 'mock-audit-id-' + Math.random().toString(36).substring(7);
}

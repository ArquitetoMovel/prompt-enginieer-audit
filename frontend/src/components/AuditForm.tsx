'use client';

import { useState } from 'react';

interface AuditFormProps {
  onAuditStart: (auditId: string) => void;
}

export default function AuditForm({ onAuditStart }: AuditFormProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:8000/api/v1/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repo_url: repoUrl, 
          pr_number: prNumber ? parseInt(prNumber) : null 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start audit');
      }

      const data = await response.json();
      setMessage(`Audit started for ${data.repo_url}!`);
      onAuditStart(data.audit_id);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Repository URL
        </label>
        <input
          type="url"
          id="repoUrl"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 p-2"
          placeholder="https://github.com/owner/repo"
        />
      </div>

      <div>
        <label htmlFor="prNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          PR Number (Optional)
        </label>
        <input
          type="number"
          id="prNumber"
          value={prNumber}
          onChange={(e) => setPrNumber(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 p-2"
          placeholder="e.g. 123"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Starting Audit...' : 'Start Audit'}
      </button>

      {message && (
        <p className={`mt-2 text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
}

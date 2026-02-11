'use client';

import { useState, useEffect } from 'react';
import { CodeViolation } from '@/types';

interface AuditResultsProps {
  auditId: string;
}

export default function AuditResults({ auditId }: AuditResultsProps) {
  const [violations, setViolations] = useState<CodeViolation[]>([]);
  const [status, setStatus] = useState<string>('PENDING');
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchResults = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:8000/api/v1/audit/${auditId}`);
        
        if (!response.ok) {
           const errData = await response.json().catch(() => ({ detail: 'Unknown error' }));
           throw new Error(errData.detail || 'Failed to fetch results');
        }

        const data = await response.json();
        
        // If the status is not pending, we are done
        if (data.overall_status !== 'PENDING') {
            setStatus(data.overall_status);
            setViolations(data.violations || []);
            setSummary(data.summary || '');
            setLoading(false);
            clearInterval(intervalId); // Stop polling when done
        } else {
            // Still pending
            setStatus('PENDING');
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
        clearInterval(intervalId);
      }
    };

    // Initial fetch
    fetchResults();

    // Poll every 2 seconds
    intervalId = setInterval(fetchResults, 2000);

    return () => clearInterval(intervalId);
  }, [auditId]);

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (loading && status === 'PENDING') {
    return (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Analysis in progress... This may take a few moments.</p>
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Status: <span className={status === 'OK' ? 'text-green-600' : status === 'PENDING' ? 'text-yellow-600' : 'text-red-600'}>{status}</span>
        </h3>
        {summary && <p className="mt-2 text-gray-700 dark:text-gray-300 italic">{summary}</p>}
      </div>

      {violations.length === 0 && status !== 'PENDING' ? (
        <p className="text-gray-500 text-center">No violations found.</p>
      ) : (
        <div className="space-y-4">
          {violations.map((violation, index) => (
            <div key={index} className={`p-4 rounded-md border-l-4 ${
              violation.severity === 'critical' ? 'border-red-600 bg-red-50 dark:bg-red-900/10' :
              violation.severity === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' :
              violation.severity === 'medium' ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' :
              'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
            }`}>
              <div className="flex justify-between items-start">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                  {violation.file_path}
                  {violation.line_number && <span className="text-gray-500 font-normal ml-2">Line {violation.line_number}</span>}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                  violation.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  violation.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                  violation.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {violation.severity}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{violation.message}</p>
              
              {violation.code_snippet && (
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-auto text-gray-800 dark:text-gray-200">
                  <code>{violation.code_snippet}</code>
                </pre>
              )}
              
              <div className="mt-3 text-sm text-green-700 dark:text-green-400 font-medium">
                Suggestion: <span className="font-normal">{violation.suggestion}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

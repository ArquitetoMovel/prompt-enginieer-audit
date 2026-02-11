'use client';

import { useState } from 'react';
import AuditForm from '@/components/AuditForm';
import AuditResults from '@/components/AuditResults';

export default function Home() {
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gray-50 dark:bg-gray-900">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-8 text-center w-full bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">
          Prompt Engineer Audit
        </h1>
      </div>

      <div className="w-full max-w-4xl grid gap-8">
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Start New Audit</h2>
          <AuditForm onAuditStart={(id: string) => setCurrentAuditId(id)} />
        </section>

        {currentAuditId && (
          <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Audit Results</h2>
            <AuditResults auditId={currentAuditId} />
          </section>
        )}
      </div>
    </main>
  );
}

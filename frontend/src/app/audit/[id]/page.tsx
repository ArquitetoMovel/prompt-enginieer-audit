"use client";

import { use } from "react";
import AuditResults from "@/components/AuditResults";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuditDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 tracking-tight">
            Audit Details
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            View the detailed analysis for audit process {unwrappedParams.id}.
          </p>
        </div>

        <section className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
          <AuditResults auditId={unwrappedParams.id} />
        </section>
      </div>
    </main>
  );
}

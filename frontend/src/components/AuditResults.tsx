"use client";

import { useState, useEffect } from "react";
import { CodeViolation, MarkdownFile } from "@/types";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";

interface AuditResultsProps {
  auditId: string;
}

export default function AuditResults({ auditId }: AuditResultsProps) {
  const [violations, setViolations] = useState<CodeViolation[]>([]);
  const [status, setStatus] = useState<string>("PENDING");
  const [summary, setSummary] = useState<string>("");
  const [markdownFiles, setMarkdownFiles] = useState<MarkdownFile[]>([]);
  const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const fetchResults = async () => {
      if (isCancelled) return;
      try {
        setLoading(true);
        const response = await fetch(
          `http://localhost:8000/api/v1/audit/${auditId}`,
        );

        if (!response.ok) {
          const errData = await response
            .json()
            .catch(() => ({ detail: "Unknown error" }));
          throw new Error(errData.detail || "Failed to fetch results");
        }

        const data = await response.json();
        if (isCancelled) return;

        // If the status is not pending, we are done
        if (data.overall_status !== "PENDING") {
          setStatus(data.overall_status);
          setViolations(data.violations || []);
          setMarkdownFiles(data.markdown_files || []);
          setSummary(data.summary || "");
          setLoading(false);
          // Auto-stops because we do not schedule another timeout
        } else {
          // Still pending
          setStatus("PENDING");
          timeoutId = setTimeout(fetchResults, 2000);
        }
      } catch (err) {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    fetchResults();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [auditId]);

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (loading && status === "PENDING") {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          Análise em andamento... Isso pode levar alguns momentos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Status:{" "}
          <span
            className={
              status === "OK"
                ? "text-green-600"
                : status === "PENDING"
                  ? "text-yellow-600"
                  : "text-red-600"
            }
          >
            {status}
          </span>
        </h3>
        {summary && (
          <p className="mt-2 text-gray-700 dark:text-gray-300 italic">
            {summary}
          </p>
        )}
      </div>

      {violations.length === 0 && status !== "PENDING" ? (
        <p className="text-gray-500 text-center">
          Nenhuma violação encontrada.
        </p>
      ) : (
        <div className="space-y-4">
          {violations.map((violation, index) => (
            <div
              key={index}
              className={`p-4 rounded-md border-l-4 ${
                violation.severity === "critical"
                  ? "border-red-600 bg-red-50 dark:bg-red-900/10"
                  : violation.severity === "high"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                    : violation.severity === "medium"
                      ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10"
                      : "border-blue-400 bg-blue-50 dark:bg-blue-900/10"
              }`}
            >
              <div className="flex justify-between items-start">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                  {violation.file_path}
                  {violation.line_number && (
                    <span className="text-gray-500 font-normal ml-2">
                      Linha {violation.line_number}
                    </span>
                  )}
                </h3>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                    violation.severity === "critical"
                      ? "bg-red-100 text-red-800"
                      : violation.severity === "high"
                        ? "bg-orange-100 text-orange-800"
                        : violation.severity === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {violation.severity}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {violation.message}
              </p>

              {violation.code_snippet && (
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-auto text-gray-800 dark:text-gray-200">
                  <code>{violation.code_snippet}</code>
                </pre>
              )}

              <div className="mt-3 text-sm text-green-700 dark:text-green-400 font-medium">
                Sugestão:{" "}
                <span className="font-normal">{violation.suggestion}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {markdownFiles.length > 0 && status !== "PENDING" && (
        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center mb-6">
            <FileText className="w-6 h-6 mr-2 text-indigo-500" />
            Documentação do PR
          </h3>
          <div className="space-y-6">
            {markdownFiles.map((file, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
              >
                <div
                  className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() =>
                    setExpandedFileIndex(
                      expandedFileIndex === index ? null : index,
                    )
                  }
                >
                  <div className="flex items-center">
                    {expandedFileIndex === index ? (
                      <ChevronDown className="w-4 h-4 mr-2 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 mr-2 text-gray-500" />
                    )}
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 font-mono">
                      {file.path}
                    </h4>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
                    Markdown
                  </span>
                </div>
                {expandedFileIndex === index && (
                  <div className="p-4 max-h-[400px] overflow-y-auto">
                    <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans">
                      {file.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

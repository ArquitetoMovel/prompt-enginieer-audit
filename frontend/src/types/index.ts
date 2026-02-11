export type ViolationSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface CodeViolation {
  file_path: string;
  line_number: number | null;
  severity: ViolationSeverity;
  message: string;
  suggestion: string;
  code_snippet: string | null;
}

export interface AuditResult {
  repo_name: string;
  pr_number: number | null;
  overall_status: "OK" | "NOK";
  violations: CodeViolation[];
  summary: string;
  timestamp: string;
}

import { z } from "zod";

export type CodeDiagnosticSeverity = "error" | "warning";

export const CodeDiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  line: z.number(),
  column: z.number(),
  length: z.number().optional(),
  code: z.string().optional(),
});

export interface CodeDiagnostic {
  severity: CodeDiagnosticSeverity;
  message: string;
  line: number;
  column: number;
  length?: number;
  code?: string;
}

export type CodeDraftStatus = "clean" | "modified" | "validating" | "valid" | "invalid";

export interface CodeDraftState {
  value: string;
  status: CodeDraftStatus;
  diagnostics: CodeDiagnostic[];
  basedOnRevision: number;
}

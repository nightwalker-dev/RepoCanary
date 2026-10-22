import { FileContextType } from './context';

/**
 * Pure TypeScript types for the RepoCanary deterministic detection engine.
 * No DOM, no network, no runtime side effects.
 */

export type RuleFamily =
  | 'UNI'
  | 'HID'
  | 'INJ'
  | 'EXF'
  | 'MCP'
  | 'EXEC'
  | 'OBF'
  | 'SEC';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type VerdictLabel =
  | 'No known tricks found'
  | 'Look closer'
  | 'Open with care'
  | 'Do not point an AI agent at this';

export interface ScannedFileInput {
  /** Normalized display path (never used for filesystem access) */
  path: string;
  /** Raw UTF-8 text content of the file (capped at 1 MB) */
  content: string;
  /** Original byte size before truncation */
  byteLength?: number;
  /** True if the file was truncated to fit the per-file size limit */
  truncated?: boolean;
}

export interface Finding {
  /** Unique deterministic ID for this finding instance within a scan */
  id: string;
  /** Rule ID, e.g. "UNI-002" */
  ruleId: string;
  /** Rule family, e.g. "UNI" */
  family: RuleFamily;
  /** Human-readable rule title */
  title: string;
  /** Deterministic severity (adjusted by file context) */
  severity: Severity;
  /** File path where the finding occurred */
  filePath: string;
  /** Classified context of the file */
  context?: FileContextType;
  /** 1-based line number where the finding starts */
  line: number;
  /** 1-based column number where the finding starts */
  column: number;
  /** Plain-language explanation of why this was flagged ("why this matters") */
  description: string;
  /** Explicit "why this matters" explanation */
  whyItMatters: string;
  /** Actionable remediation guidance */
  remediation: string;
  /** Explicit "how to fix" guidance */
  howToFix: string;
  /** Safe, redacted excerpt of the surrounding line/text */
  snippet: string;
  /** Decoded payload (e.g., ASCII-smuggled Unicode Tags or decoded Base64/Hex) if applicable */
  decodedText?: string;
}

export interface RuleDefinition {
  id: string;
  family: RuleFamily;
  title: string;
  severity: Severity;
  description: string;
  remediation: string;
  evaluate: (file: ScannedFileInput) => Finding[];
}

export interface FileScanSummary {
  path: string;
  context?: FileContextType;
  byteLength: number;
  truncated: boolean;
  timedOut: boolean;
  highestSeverity: Severity | 'none';
  findingCount: number;
  suppressedCount?: number;
}

export interface ScanReport {
  rulesetVersion: string;
  scannedAt: string;
  sourceLabel: string;
  score: number;
  verdict: VerdictLabel;
  files: FileScanSummary[];
  findings: Finding[];
  suppressedCount?: number;
  suppressedFindings?: Finding[];
  skippedCount: number;
  warnings: string[];
  durationMs: number;
}

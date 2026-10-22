import { RULESET_VERSION, SCAN_LIMITS } from '../config';
import { classifyFileContext } from './context';
import {
  IgnoreRule,
  isFindingSuppressed,
  parseRepoCanaryIgnore,
} from './ignore';
import { ALL_RULES } from './rules';
import { redactSecretsInText } from './rules/helpers';
import {
  calculateScore,
  getHighestSeverity,
  getVerdict,
  SEVERITY_RANK,
} from './scoring';
import {
  FileScanSummary,
  Finding,
  RuleDefinition,
  ScannedFileInput,
  ScanReport,
} from './types';

export interface ScanOptions {
  sourceLabel?: string;
  skippedCount?: number;
  warnings?: string[];
  perFileTimeoutMs?: number;
  rules?: ReadonlyArray<RuleDefinition>;
  ignoreContent?: string;
  onProgress?: (
    phase: 'read' | 'decode' | 'detect' | 'score',
    progress: number,
    detail?: string
  ) => void;
}

/**
 * Scans a single file in memory against all deterministic rules, enforcing a per-file time budget.
 */
export function scanSingleFile(
  file: ScannedFileInput,
  options?: {
    perFileTimeoutMs?: number;
    rules?: ReadonlyArray<RuleDefinition>;
    ignoreRules?: ReadonlyArray<IgnoreRule>;
  }
): {
  findings: Finding[];
  suppressedFindings: Finding[];
  summary: FileScanSummary;
} {
  const budgetMs = options?.perFileTimeoutMs ?? SCAN_LIMITS.PER_FILE_TIMEOUT_MS;
  const rules = options?.rules ?? ALL_RULES;
  const ignoreRules = options?.ignoreRules ?? [];
  const start = performance.now();

  let content = file.content;
  let truncated = Boolean(file.truncated);
  if (content.length > SCAN_LIMITS.MAX_FILE_BYTES) {
    content = content.slice(0, SCAN_LIMITS.MAX_FILE_BYTES);
    truncated = true;
  }

  const normalizedFile: ScannedFileInput = {
    path: file.path,
    content,
    byteLength: file.byteLength ?? content.length,
    truncated,
  };

  const context = classifyFileContext(normalizedFile.path, normalizedFile.content);
  const findings: Finding[] = [];
  const suppressedFindings: Finding[] = [];
  let timedOut = false;

  for (const rule of rules) {
    if (performance.now() - start > budgetMs) {
      timedOut = true;
      break;
    }
    const ruleFindings = rule.evaluate(normalizedFile);
    for (const f of ruleFindings) {
      const sanitizedFinding: Finding = {
        ...f,
        context: f.context ?? context,
        snippet: redactSecretsInText(f.snippet),
        ...(f.decodedText ? { decodedText: redactSecretsInText(f.decodedText) } : {}),
      };

      if (
        ignoreRules.length > 0 &&
        isFindingSuppressed(normalizedFile.path, sanitizedFinding.ruleId, ignoreRules)
      ) {
        suppressedFindings.push(sanitizedFinding);
      } else {
        findings.push(sanitizedFinding);
      }
    }
  }

  findings.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rankDiff !== 0) return rankDiff;
    return a.line - b.line;
  });

  const summary: FileScanSummary = {
    path: normalizedFile.path,
    context,
    byteLength: normalizedFile.byteLength ?? normalizedFile.content.length,
    truncated,
    timedOut,
    highestSeverity: getHighestSeverity(findings),
    findingCount: findings.length,
    suppressedCount: suppressedFindings.length,
  };

  return { findings, suppressedFindings, summary };
}

/**
 * Scans a collection of repository files and produces a complete deterministic ScanReport.
 * Automatically discovers `.repocanaryignore` if present in `files` or passed via `options.ignoreContent`.
 */
export function scanRepository(
  files: ReadonlyArray<ScannedFileInput>,
  options?: ScanOptions
): ScanReport {
  const start = performance.now();
  const warnings = [...(options?.warnings ?? [])];
  const allFindings: Finding[] = [];
  const allSuppressed: Finding[] = [];
  const fileSummaries: FileScanSummary[] = [];

  const boundedFiles = files.slice(0, SCAN_LIMITS.MAX_FILES);
  if (files.length > SCAN_LIMITS.MAX_FILES) {
    warnings.push(
      `Repository exceeded ${SCAN_LIMITS.MAX_FILES} files limit; scanned first ${SCAN_LIMITS.MAX_FILES} files.`
    );
  }

  // Discover .repocanaryignore from repository root or explicit option
  const repoIgnoreFile = boundedFiles.find(
    (f) =>
      f.path === '.repocanaryignore' ||
      f.path.endsWith('/.repocanaryignore')
  );
  const combinedIgnoreText = [
    repoIgnoreFile?.content ?? '',
    options?.ignoreContent ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  const ignoreRules = combinedIgnoreText
    ? parseRepoCanaryIgnore(combinedIgnoreText)
    : [];

  options?.onProgress?.('decode', 15, 'Preparing text buffers and Unicode normalization');

  const total = Math.max(1, boundedFiles.length);
  for (let i = 0; i < boundedFiles.length; i++) {
    const file = boundedFiles[i];
    const pct = Math.round(20 + ((i + 1) / total) * 65);
    options?.onProgress?.('detect', pct, file.path);

    const { findings, suppressedFindings, summary } = scanSingleFile(file, {
      perFileTimeoutMs: options?.perFileTimeoutMs,
      rules: options?.rules,
      ignoreRules,
    });

    if (summary.timedOut) {
      warnings.push(
        `File "${file.path}" exceeded the ${options?.perFileTimeoutMs ?? SCAN_LIMITS.PER_FILE_TIMEOUT_MS}ms time budget; partial rules evaluated.`
      );
    }
    if (summary.truncated) {
      warnings.push(`File "${file.path}" was truncated to 1 MB for scanning.`);
    }

    allFindings.push(...findings);
    allSuppressed.push(...suppressedFindings);
    fileSummaries.push(summary);
  }

  options?.onProgress?.('score', 95, 'Computing deterministic severity score and verdict');

  allFindings.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rankDiff !== 0) return rankDiff;
    if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
    return a.line - b.line;
  });

  const score = calculateScore(allFindings);
  const verdict = getVerdict(score);
  const durationMs = Math.max(1, Math.round(performance.now() - start));

  options?.onProgress?.('score', 100, 'Scan complete');

  return {
    rulesetVersion: RULESET_VERSION,
    scannedAt: new Date().toISOString(),
    sourceLabel: options?.sourceLabel ?? 'Local Workspace',
    score,
    verdict,
    files: fileSummaries,
    findings: allFindings,
    suppressedCount: allSuppressed.length,
    suppressedFindings: allSuppressed,
    skippedCount: options?.skippedCount ?? 0,
    warnings,
    durationMs,
  };
}

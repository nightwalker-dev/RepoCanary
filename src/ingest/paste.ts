import { SCAN_LIMITS } from '../config';
import { ScannedFileInput } from '../core/types';

export interface IngestResult {
  sourceLabel: string;
  files: ScannedFileInput[];
  skippedCount: number;
  warnings: string[];
}

/**
 * Ingests pasted text as a virtual agent-facing file for scanning and X-Ray inspection.
 */
export function ingestPastedText(
  rawText: string,
  virtualFileName = 'README.md'
): IngestResult {
  const warnings: string[] = [];
  let content = rawText;
  let truncated = false;

  if (content.length > SCAN_LIMITS.MAX_FILE_BYTES) {
    content = content.slice(0, SCAN_LIMITS.MAX_FILE_BYTES);
    truncated = true;
    warnings.push('Pasted text exceeded 1 MB limit and was truncated to 1 MB.');
  }

  const safePath = sanitizeDisplayPath(virtualFileName)?.safePath || 'README.md';

  return {
    sourceLabel: `Pasted Text (${safePath})`,
    files: [
      {
        path: safePath,
        content,
        byteLength: rawText.length,
        truncated,
      },
    ],
    skippedCount: 0,
    warnings,
  };
}

/**
 * Normalizes and sanitizes any file path into a safe, relative display label.
 * Defends against zip-slip (../, ..\, leading slashes, null bytes, Windows drive prefixes).
 * Returns null if the path is empty or points to a directory/hidden git pack.
 */
export function sanitizeDisplayPath(
  rawPath: string
): { safePath: string; hadTraversal: boolean } | null {
  if (!rawPath || typeof rawPath !== 'string') {
    return null;
  }

  // Strip null bytes
  const withoutNull = rawPath.replace(/\0/g, '');
  // Normalize backslashes to forward slashes
  const normalizedSlashes = withoutNull.replace(/\\/g, '/').trim();

  // Detect any traversal segments or absolute/drive roots
  const segments = normalizedSlashes.split('/');
  let hadTraversal =
    normalizedSlashes.startsWith('/') || /^[A-Za-z]:/.test(normalizedSlashes);

  const safeSegments: string[] = [];
  for (const seg of segments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      hadTraversal = true;
      continue;
    }
    // Strip Windows drive prefix if first segment
    const cleanedSeg = seg.replace(/^[A-Za-z]:/, '');
    if (cleanedSeg) {
      safeSegments.push(cleanedSeg);
    }
  }

  if (safeSegments.length === 0) {
    return null;
  }

  return {
    safePath: safeSegments.join('/'),
    hadTraversal,
  };
}

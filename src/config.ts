/**
 * Single source of truth for application configuration constants.
 */

export const GEMINI_MODEL_ID = 'models/gemini-4-argon' as const;

export const RULESET_VERSION = '1.0.0' as const;

export const SCAN_LIMITS = {
  MAX_ZIP_BYTES: 25 * 1024 * 1024, // 25 MB
  MAX_FILES: 5_000,
  MAX_FILE_BYTES: 1 * 1024 * 1024, // 1 MB per file scanned
  MAX_DECOMPRESSED_BYTES: 100 * 1024 * 1024, // 100 MB total decompressed
  MAX_COMPRESSION_RATIO: 100, // Zip-bomb threshold (100:1 compression ratio on significant payloads)
  PER_FILE_TIMEOUT_MS: 750, // Worker per-file time budget
  TOTAL_SCAN_TIMEOUT_MS: 25_000, // Overall worker timeout
  MAX_AI_SNIPPETS: 20,
  MAX_AI_SNIPPET_BYTES: 2 * 1024, // 2 KB per snippet
} as const;

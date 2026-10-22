import { unzipSync } from 'fflate';
import { SCAN_LIMITS } from '../config';
import { ScannedFileInput } from '../core/types';
import { IngestResult, sanitizeDisplayPath } from './paste';

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.tgz',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.wasm',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp3',
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
  '.ogg',
  '.wav',
  '.pyc',
  '.class',
  '.o',
  '.a',
  '.jar',
  '.sqlite',
  '.db',
]);

export function hasBinaryExtension(path: string): boolean {
  const lower = path.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) return false;
  return BINARY_EXTENSIONS.has(lower.slice(dotIdx));
}

/**
 * Checks whether a byte buffer appears to be binary by scanning the first 8 KB for null bytes.
 */
export function isBinaryBuffer(bytes: Uint8Array): boolean {
  const checkLen = Math.min(bytes.length, 8192);
  for (let i = 0; i < checkLen; i++) {
    if (bytes[i] === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Safely parses and ingests a .zip archive buffer in memory with strict limits:
 * - Max 25 MB compressed size
 * - Max 5,000 files
 * - Max 100 MB decompressed size
 * - Compression ratio (zip-bomb) protection
 * - Zip-slip traversal neutralization
 * - Binary file skipping
 * - 1 MB max scanned per file
 */
export function ingestZipBytes(
  zipBytes: Uint8Array,
  archiveName = 'archive.zip'
): IngestResult {
  if (zipBytes.byteLength > SCAN_LIMITS.MAX_ZIP_BYTES) {
    throw new Error(
      `Archive "${archiveName}" is ${(zipBytes.byteLength / (1024 * 1024)).toFixed(1)} MB, exceeding the 25 MB maximum zip size limit.`
    );
  }

  let totalDecompressedBytes = 0;
  let entryCount = 0;
  const warnings: string[] = [];
  let traversalDetected = false;

  const archiveEntries = unzipSync(zipBytes, {
    filter(file) {
      entryCount++;
      if (entryCount > SCAN_LIMITS.MAX_FILES) {
        throw new Error(
          `Archive exceeds the maximum limit of ${SCAN_LIMITS.MAX_FILES} files.`
        );
      }

      const uncompressedSize = file.originalSize ?? 0;
      totalDecompressedBytes += uncompressedSize;

      if (totalDecompressedBytes > SCAN_LIMITS.MAX_DECOMPRESSED_BYTES) {
        throw new Error(
          `Archive decompressed size exceeds the 100 MB safety limit (potential zip bomb).`
        );
      }

      const compressedSize = Math.max(1, file.size ?? 1);
      const ratio = uncompressedSize / compressedSize;
      if (
        uncompressedSize > 1024 * 1024 &&
        ratio > SCAN_LIMITS.MAX_COMPRESSION_RATIO
      ) {
        throw new Error(
          `Suspicious compression ratio (${Math.round(ratio)}:1) detected in "${file.name}" (zip-bomb protection triggered).`
        );
      }

      return true;
    },
  });

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const files: ScannedFileInput[] = [];
  let skippedCount = 0;
  let actualDecompressedTotal = 0;

  for (const [rawName, rawBytes] of Object.entries(archiveEntries)) {
    // Skip directory entries
    if (rawName.endsWith('/')) {
      continue;
    }

    actualDecompressedTotal += rawBytes.byteLength;
    if (actualDecompressedTotal > SCAN_LIMITS.MAX_DECOMPRESSED_BYTES) {
      throw new Error(
        `Archive decompressed payload exceeds the 100 MB safety limit (potential zip bomb).`
      );
    }

    if (
      actualDecompressedTotal > 1024 * 1024 &&
      actualDecompressedTotal / Math.max(1, zipBytes.byteLength) >
        SCAN_LIMITS.MAX_COMPRESSION_RATIO
    ) {
      throw new Error(
        `Archive overall compression ratio exceeds ${SCAN_LIMITS.MAX_COMPRESSION_RATIO}:1 (zip-bomb protection triggered).`
      );
    }

    const sanitized = sanitizeDisplayPath(rawName);
    if (!sanitized) {
      skippedCount++;
      continue;
    }

    if (sanitized.hadTraversal) {
      traversalDetected = true;
    }

    const safePath = sanitized.safePath;

    // Skip node_modules or .git/objects binary blobs
    if (
      safePath.includes('node_modules/') ||
      safePath.includes('.git/objects/') ||
      hasBinaryExtension(safePath) ||
      isBinaryBuffer(rawBytes)
    ) {
      skippedCount++;
      continue;
    }

    const originalByteLength = rawBytes.byteLength;
    const truncated = originalByteLength > SCAN_LIMITS.MAX_FILE_BYTES;
    const sliceToDecode = truncated
      ? rawBytes.subarray(0, SCAN_LIMITS.MAX_FILE_BYTES)
      : rawBytes;

    const content = decoder.decode(sliceToDecode);

    files.push({
      path: safePath,
      content,
      byteLength: originalByteLength,
      truncated,
    });
  }

  if (traversalDetected) {
    warnings.push(
      'Zip-slip path traversal sequences (e.g., "../") were detected in archive entry names and neutralized to safe display labels.'
    );
  }

  return {
    sourceLabel: archiveName,
    files,
    skippedCount,
    warnings,
  };
}

/**
 * Ingests a list of browser File objects (from folder drag-and-drop or file input).
 */
export async function ingestFileList(
  fileList: ReadonlyArray<File>,
  label = 'Dropped Folder'
): Promise<IngestResult> {
  if (fileList.length === 1 && fileList[0].name.toLowerCase().endsWith('.zip')) {
    const file = fileList[0];
    if (file.size > SCAN_LIMITS.MAX_ZIP_BYTES) {
      throw new Error(
        `Zip file "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB, exceeding the 25 MB limit.`
      );
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    return ingestZipBytes(buf, file.name);
  }

  if (fileList.length > SCAN_LIMITS.MAX_FILES) {
    throw new Error(
      `Selected folder contains ${fileList.length} files, exceeding the ${SCAN_LIMITS.MAX_FILES} file limit.`
    );
  }

  const files: ScannedFileInput[] = [];
  const warnings: string[] = [];
  let skippedCount = 0;
  let totalBytes = 0;
  const decoder = new TextDecoder('utf-8', { fatal: false });

  for (const file of fileList) {
    const rawRelPath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const sanitized = sanitizeDisplayPath(rawRelPath);
    if (!sanitized) {
      skippedCount++;
      continue;
    }

    const safePath = sanitized.safePath;
    if (
      safePath.includes('node_modules/') ||
      safePath.includes('.git/objects/') ||
      hasBinaryExtension(safePath)
    ) {
      skippedCount++;
      continue;
    }

    totalBytes += Math.min(file.size, SCAN_LIMITS.MAX_FILE_BYTES);
    if (totalBytes > SCAN_LIMITS.MAX_DECOMPRESSED_BYTES) {
      warnings.push('Reached 100 MB cumulative scan limit; remaining files skipped.');
      break;
    }

    const truncated = file.size > SCAN_LIMITS.MAX_FILE_BYTES;
    const blobSlice = truncated
      ? file.slice(0, SCAN_LIMITS.MAX_FILE_BYTES)
      : file;
    const bytes = new Uint8Array(await blobSlice.arrayBuffer());

    if (isBinaryBuffer(bytes)) {
      skippedCount++;
      continue;
    }

    files.push({
      path: safePath,
      content: decoder.decode(bytes),
      byteLength: file.size,
      truncated,
    });
  }

  return {
    sourceLabel: label,
    files,
    skippedCount,
    warnings,
  };
}

import { SCAN_LIMITS } from '../config';
import { scanRepository } from '../core/scanner';
import { ScanReport } from '../core/types';
import { IngestResult } from '../ingest/paste';
import { WorkerScanRequest, WorkerScanResponse } from './scan.worker';

export interface RunWorkerScanOptions {
  perFileTimeoutMs?: number;
  totalTimeoutMs?: number;
  ignoreContent?: string;
  onProgress?: (
    phase: 'read' | 'decode' | 'detect' | 'score',
    progress: number,
    detail?: string
  ) => void;
}

/**
 * Executes a repository scan inside a dedicated Web Worker.
 * Enforces both per-file time budgets and hard worker termination on overall timeout.
 */
export async function runScanInWorker(
  ingest: IngestResult,
  options?: RunWorkerScanOptions
): Promise<ScanReport> {
  const totalTimeoutMs =
    options?.totalTimeoutMs ?? SCAN_LIMITS.TOTAL_SCAN_TIMEOUT_MS;

  options?.onProgress?.('read', 8, `Loaded ${ingest.files.length} file(s)`);

  if (typeof Worker === 'undefined') {
    return scanRepository(ingest.files, {
      sourceLabel: ingest.sourceLabel,
      skippedCount: ingest.skippedCount,
      warnings: ingest.warnings,
      perFileTimeoutMs: options?.perFileTimeoutMs,
      ignoreContent: options?.ignoreContent,
      onProgress: options?.onProgress,
    });
  }

  return new Promise<ScanReport>((resolve, reject) => {
    let worker: Worker | null = null;
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      if (worker) {
        worker.terminate();
      }
      reject(
        new Error(
          `Scan timed out after ${Math.round(totalTimeoutMs / 1000)}s and the Web Worker was terminated to protect browser responsiveness.`
        )
      );
    }, totalTimeoutMs);

    try {
      worker = new Worker(new URL('./scan.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event: MessageEvent<WorkerScanResponse>) => {
        const msg = event.data;
        if (!msg) return;

        if (msg.type === 'SCAN_PROGRESS') {
          options?.onProgress?.(msg.phase, msg.progress, msg.detail);
          return;
        }

        if (msg.type === 'SCAN_COMPLETE') {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          worker?.terminate();
          resolve(msg.report);
          return;
        }

        if (msg.type === 'SCAN_ERROR') {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          worker?.terminate();
          reject(new Error(msg.message));
        }
      };

      worker.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        worker?.terminate();
        try {
          const fallbackReport = scanRepository(ingest.files, {
            sourceLabel: ingest.sourceLabel,
            skippedCount: ingest.skippedCount,
            warnings: ingest.warnings,
            perFileTimeoutMs: options?.perFileTimeoutMs,
            ignoreContent: options?.ignoreContent,
            onProgress: options?.onProgress,
          });
          resolve(fallbackReport);
        } catch (fallbackErr) {
          reject(
            fallbackErr instanceof Error
              ? fallbackErr
              : new Error('Scan execution failed.')
          );
        }
      };

      const req: WorkerScanRequest = {
        type: 'START_SCAN',
        files: ingest.files,
        sourceLabel: ingest.sourceLabel,
        skippedCount: ingest.skippedCount,
        warnings: ingest.warnings,
        perFileTimeoutMs: options?.perFileTimeoutMs,
        ignoreContent: options?.ignoreContent,
      };

      worker.postMessage(req);
    } catch {
      window.clearTimeout(timer);
      const report = scanRepository(ingest.files, {
        sourceLabel: ingest.sourceLabel,
        skippedCount: ingest.skippedCount,
        warnings: ingest.warnings,
        perFileTimeoutMs: options?.perFileTimeoutMs,
        ignoreContent: options?.ignoreContent,
        onProgress: options?.onProgress,
      });
      resolve(report);
    }
  });
}

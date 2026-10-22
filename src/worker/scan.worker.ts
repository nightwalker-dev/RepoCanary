import { scanRepository } from '../core/scanner';
import { ScannedFileInput, ScanReport } from '../core/types';

export interface WorkerScanRequest {
  type: 'START_SCAN';
  files: ScannedFileInput[];
  sourceLabel: string;
  skippedCount: number;
  warnings: string[];
  perFileTimeoutMs?: number;
  ignoreContent?: string;
}

export type WorkerScanResponse =
  | {
      type: 'SCAN_PROGRESS';
      phase: 'read' | 'decode' | 'detect' | 'score';
      progress: number;
      detail?: string;
    }
  | {
      type: 'SCAN_COMPLETE';
      report: ScanReport;
    }
  | {
      type: 'SCAN_ERROR';
      message: string;
    };

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerScanRequest>) => void) | null;
  postMessage: (message: WorkerScanResponse) => void;
};

ctx.onmessage = (event: MessageEvent<WorkerScanRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'START_SCAN') {
    return;
  }

  try {
    const report = scanRepository(data.files, {
      sourceLabel: data.sourceLabel,
      skippedCount: data.skippedCount,
      warnings: data.warnings,
      perFileTimeoutMs: data.perFileTimeoutMs,
      ignoreContent: data.ignoreContent,
      onProgress(phase, progress, detail) {
        ctx.postMessage({
          type: 'SCAN_PROGRESS',
          phase,
          progress,
          detail,
        });
      },
    });

    ctx.postMessage({
      type: 'SCAN_COMPLETE',
      report,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected worker scan error.';
    ctx.postMessage({
      type: 'SCAN_ERROR',
      message,
    });
  }
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScannedFileInput, ScanReport } from './core/types';
import { ingestGitHubRepo } from './ingest/github';
import { IngestResult, ingestPastedText } from './ingest/paste';
import { getSampleAttackRepo } from './ingest/samples';
import { ingestFileList } from './ingest/zip';
import { ActiveTab, TopNav } from './ui/components/TopNav';
import { GalleryPage } from './ui/pages/GalleryPage';
import { ReportPage } from './ui/pages/ReportPage';
import { RulesPage } from './ui/pages/RulesPage';
import {
  ScanningPage,
  ScanProgressState,
} from './ui/pages/ScanningPage';
import { ScanPage } from './ui/pages/ScanPage';
import {
  NetworkLogEntry,
  SettingsPage,
} from './ui/pages/SettingsPage';
import { Button, Modal, Toast } from './ui/primitives';
import { XRayDisplayMode, XRayView } from './ui/xray/XRayView';
import { runScanInWorker } from './worker/client';

type FooterDocModal = 'security' | 'threat-model' | null;

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scan');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progressState, setProgressState] = useState<ScanProgressState>({
    phase: 'read',
    progress: 0,
    detail: '',
  });
  const [ingestData, setIngestData] = useState<IngestResult | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [xrayTarget, setXrayTarget] = useState<{
    filePath?: string;
    line?: number;
    displayMode?: XRayDisplayMode;
  }>({});

  // Privacy & Settings state (100% memory-only, never persisted to localStorage)
  const [apiKey, setApiKey] = useState<string>('');
  const [aiExplainEnabled, setAiExplainEnabled] = useState<boolean>(false);
  const [customIgnoreText, setCustomIgnoreText] = useState<string>('');
  const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);

  // Toast & Footer Document Modal state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [footerModal, setFooterModal] = useState<FooterDocModal>(null);
  const toastTimerRef = useRef<number | null>(null);

  // 10-second Guided Demo state for GIF recording
  const [guidedDemoStep, setGuidedDemoStep] = useState<{
    active: boolean;
    stepLabel: string;
    secondsRemaining: number;
  } | null>(null);
  const demoTimersRef = useRef<number[]>([]);

  const reportSearchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const clearDemoTimers = useCallback(() => {
    for (const id of demoTimersRef.current) {
      window.clearTimeout(id);
    }
    demoTimersRef.current = [];
    setGuidedDemoStep(null);
  }, []);

  const appendNetworkLog = useCallback(
    (method: string, url: string, status: number) => {
      setNetworkLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString().slice(11, 19),
          method,
          url,
          status,
        },
        ...prev,
      ]);
    },
    []
  );

  const handleNewScan = useCallback(() => {
    clearDemoTimers();
    setIsScanning(false);
    setErrorMessage(null);
    setActiveTab('scan');
  }, [clearDemoTimers]);

  // Global keyboard shortcuts:
  // - Ctrl+N: start a new scan
  // - Ctrl+F: focus the search/filter input in ReportPage (switching to ReportPage if a report is loaded)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        const key = event.key.toLowerCase();

        if (key === 'n') {
          event.preventDefault();
          handleNewScan();
          return;
        }

        if (key === 'f' && report) {
          event.preventDefault();
          if (activeTab !== 'report') {
            setActiveTab('report');
            window.setTimeout(() => {
              reportSearchInputRef.current?.focus();
              reportSearchInputRef.current?.select();
            }, 30);
          } else {
            reportSearchInputRef.current?.focus();
            reportSearchInputRef.current?.select();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handleNewScan, report]);

  useEffect(() => {
    return () => {
      clearDemoTimers();
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [clearDemoTimers]);

  const executeScan = async (
    ingest: IngestResult
  ): Promise<ScanReport | null> => {
    setErrorMessage(null);
    setIsScanning(true);
    setProgressState({
      phase: 'read',
      progress: 10,
      detail: `Ingested ${ingest.files.length} file(s) from ${ingest.sourceLabel}`,
    });

    try {
      const scanReport = await runScanInWorker(ingest, {
        ignoreContent: customIgnoreText || undefined,
        onProgress(phase, progress, detail) {
          setProgressState({ phase, progress, detail });
        },
      });
      setIngestData(ingest);
      setReport(scanReport);
      setIsScanning(false);
      setActiveTab('report');
      return scanReport;
    } catch (err) {
      setIsScanning(false);
      setErrorMessage(
        err instanceof Error ? err.message : 'Scan failed unexpectedly.'
      );
      return null;
    }
  };

  const handleDropFiles = async (files: File[], label?: string) => {
    clearDemoTimers();
    setErrorMessage(null);
    setIsScanning(true);
    setProgressState({
      phase: 'read',
      progress: 5,
      detail: 'Reading dropped files in browser memory...',
    });

    try {
      const ingest = await ingestFileList(files, label);
      if (ingest.files.length === 0) {
        setIsScanning(false);
        setErrorMessage(
          'No scannable text files were found in the selection (all files were binary or empty).'
        );
        return;
      }
      await executeScan(ingest);
    } catch (err) {
      setIsScanning(false);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to parse files.'
      );
    }
  };

  const handleScanPaste = async (text: string, virtualFileName: string) => {
    clearDemoTimers();
    const ingest = ingestPastedText(text, virtualFileName);
    await executeScan(ingest);
  };

  const handleScanGitHub = async (url: string) => {
    clearDemoTimers();
    setErrorMessage(null);
    setIsScanning(true);
    setProgressState({
      phase: 'read',
      progress: 5,
      detail: `Connecting to api.github.com for ${url}...`,
    });

    try {
      appendNetworkLog('GET', `https://api.github.com (${url})`, 200);
      const ingest = await ingestGitHubRepo(url, {
        onProgress(detail) {
          setProgressState({
            phase: 'read',
            progress: 12,
            detail,
          });
        },
      });
      if (ingest.files.length === 0) {
        setIsScanning(false);
        setErrorMessage(
          'No relevant text files were found in the repository.'
        );
        return;
      }
      await executeScan(ingest);
    } catch (err) {
      setIsScanning(false);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to fetch GitHub repository.'
      );
    }
  };

  const handleTrySampleAttack = async () => {
    clearDemoTimers();
    const sample = getSampleAttackRepo();
    await executeScan(sample);
  };

  const handleStartGuidedDemo = async () => {
    clearDemoTimers();
    const sample = getSampleAttackRepo();
    setGuidedDemoStep({
      active: true,
      stepLabel:
        'Step 1/3: Scanning harmless CANARY-7731 sample repo & reviewing Risk Verdict...',
      secondsRemaining: 10,
    });

    const scanResult = await executeScan(sample);
    if (!scanResult) {
      clearDemoTimers();
      return;
    }

    for (let s = 9; s >= 1; s--) {
      const tickId = window.setTimeout(() => {
        setGuidedDemoStep((prev) =>
          prev ? { ...prev, secondsRemaining: s } : null
        );
      }, (10 - s) * 1000);
      demoTimersRef.current.push(tickId);
    }

    const step2Id = window.setTimeout(() => {
      setGuidedDemoStep((prev) =>
        prev
          ? {
              ...prev,
              stepLabel:
                'Step 2/3: X-Ray Split View — Left shows clean README.md, Right reveals hidden Unicode Tags & HTML comments...',
            }
          : null
      );
      setXrayTarget({
        filePath: 'README.md',
        line: 3,
        displayMode: 'split',
      });
      setActiveTab('xray');
    }, 3300);

    const step3Id = window.setTimeout(() => {
      setGuidedDemoStep((prev) =>
        prev
          ? {
              ...prev,
              stepLabel:
                'Step 3/3: X-Ray Diff View — Highlighting only the lines where Human View and AI View diverge...',
            }
          : null
      );
      setXrayTarget({
        filePath: 'README.md',
        line: 3,
        displayMode: 'diff',
      });
      setActiveTab('xray');
    }, 6800);

    const endId = window.setTimeout(() => {
      setGuidedDemoStep(null);
    }, 10000);

    demoTimersRef.current.push(step2Id, step3Id, endId);
  };

  const handleLoadAttackSampleFromGallery = async (
    file: ScannedFileInput,
    title: string
  ) => {
    clearDemoTimers();
    await executeScan({
      sourceLabel: `Gallery Sample (${title})`,
      files: [file],
      skippedCount: 0,
      warnings: [],
    });
  };

  const handleInspectFileInXRay = (
    filePath: string,
    line?: number,
    displayMode?: XRayDisplayMode
  ) => {
    setXrayTarget({ filePath, line, displayMode });
    setActiveTab('xray');
  };

  return (
    <div className="min-h-screen flex flex-col bg-rc-bg text-rc-text">
      {/* Skip-to-Content Link for Keyboard & Screen Reader Users */}
      <a href="#main-content" className="rc-skip-link">
        Skip to main content
      </a>

      <TopNav
        activeTab={activeTab}
        hasReport={Boolean(report)}
        networkCount={networkLogs.length}
        aiExplainEnabled={aiExplainEnabled}
        onSelectTab={setActiveTab}
        onTrySample={handleTrySampleAttack}
        onNewScan={handleNewScan}
      />

      {/* 10s Guided Demo Banner (when active) */}
      {guidedDemoStep?.active && (
        <div
          role="status"
          aria-live="polite"
          className="bg-rc-surface-2 border-b border-rc-accent px-4 py-2.5"
        >
          <div className="rc-container flex flex-wrap items-center justify-between gap-4 rc-text-12 font-mono">
            <div className="flex items-center gap-3 text-rc-text">
              <span className="px-2.5 py-1 rounded-rc-sm bg-rc-accent text-rc-accent-ink font-bold tabular-nums">
                DEMO MODE · {guidedDemoStep.secondsRemaining}s
              </span>
              <span>{guidedDemoStep.stepLabel}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearDemoTimers}>
              Stop Guided Demo
            </Button>
          </div>
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {isScanning ? (
          <ScanningPage state={progressState} />
        ) : activeTab === 'scan' ? (
          <ScanPage
            onDropFiles={handleDropFiles}
            onScanPaste={handleScanPaste}
            onScanGitHub={handleScanGitHub}
            onTrySampleAttack={handleTrySampleAttack}
            onStartGuidedDemo={handleStartGuidedDemo}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
          />
        ) : activeTab === 'report' && report ? (
          <ReportPage
            report={report}
            onInspectFileInXRay={handleInspectFileInXRay}
            searchInputRef={reportSearchInputRef}
            apiKey={apiKey}
            aiExplainEnabled={aiExplainEnabled}
            onOpenSettings={() => setActiveTab('settings')}
            onNotify={showToast}
          />
        ) : activeTab === 'xray' && report && ingestData ? (
          <XRayView
            key={`${xrayTarget.filePath ?? 'default'}-${xrayTarget.displayMode ?? 'split'}`}
            files={ingestData.files}
            report={report}
            initialFilePath={xrayTarget.filePath}
            initialLine={xrayTarget.line}
            initialDisplayMode={xrayTarget.displayMode}
            onBackToReport={() => setActiveTab('report')}
          />
        ) : activeTab === 'gallery' ? (
          <GalleryPage onLoadAttackSample={handleLoadAttackSampleFromGallery} />
        ) : activeTab === 'rules' ? (
          <RulesPage />
        ) : activeTab === 'settings' ? (
          <SettingsPage
            apiKey={apiKey}
            onChangeApiKey={setApiKey}
            aiExplainEnabled={aiExplainEnabled}
            onToggleAiExplain={setAiExplainEnabled}
            customIgnoreText={customIgnoreText}
            onChangeCustomIgnoreText={setCustomIgnoreText}
            networkLogs={networkLogs}
            onClearNetworkLogs={() => setNetworkLogs([])}
          />
        ) : (
          <ScanPage
            onDropFiles={handleDropFiles}
            onScanPaste={handleScanPaste}
            onScanGitHub={handleScanGitHub}
            onTrySampleAttack={handleTrySampleAttack}
            onStartGuidedDemo={handleStartGuidedDemo}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
          />
        )}
      </main>

      {/* Consistent Footer with Links: GitHub, Security, Threat Model, Limitations */}
      <footer className="border-t border-rc-border bg-rc-surface py-6">
        <div className="rc-container flex flex-col sm:flex-row items-center justify-between gap-4 rc-text-12 font-mono text-rc-text-muted">
          <div className="text-center sm:text-left">
            RepoCanary v1.0.0 · 100% Client-Side Heuristic Inspector · Score 0 = &quot;No known tricks found&quot;
          </div>
          <nav
            aria-label="Footer Documentation Links"
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center px-2 text-rc-text-muted hover:text-rc-accent rc-focus-ring rounded-rc-sm"
            >
              GitHub
            </a>
            <button
              type="button"
              onClick={() => setFooterModal('security')}
              className="min-h-11 inline-flex items-center px-2 text-rc-text-muted hover:text-rc-accent rc-focus-ring rounded-rc-sm cursor-pointer"
            >
              Security
            </button>
            <button
              type="button"
              onClick={() => setFooterModal('threat-model')}
              className="min-h-11 inline-flex items-center px-2 text-rc-text-muted hover:text-rc-accent rc-focus-ring rounded-rc-sm cursor-pointer"
            >
              Threat Model
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className="min-h-11 inline-flex items-center px-2 text-rc-text-muted hover:text-rc-accent rc-focus-ring rounded-rc-sm cursor-pointer"
            >
              Limitations
            </button>
          </nav>
        </div>
      </footer>

      {/* Security & Threat Model Modals */}
      <Modal
        isOpen={footerModal === 'security'}
        onClose={() => setFooterModal(null)}
        title="Security Policy & Responsible Disclosure (SECURITY.md)"
      >
        <div className="space-y-4 rc-text-14 text-rc-text-muted rc-prose-col">
          <p>
            <strong className="text-rc-text">100% Client-Side Execution:</strong>{' '}
            RepoCanary runs its deterministic detection engine inside an isolated browser Web Worker with a strict per-file time budget (200 ms) and total scan timeout (10 s).
          </p>
          <p>
            <strong className="text-rc-text">Strict Content Security Policy:</strong>{' '}
            Zero <code className="text-rc-accent">eval</code>, zero <code className="text-rc-accent">innerHTML</code>, and <code className="text-rc-accent">connect-src</code> restricted solely to <code className="text-rc-text">api.github.com</code>, <code className="text-rc-text">raw.githubusercontent.com</code>, and <code className="text-rc-text">generativelanguage.googleapis.com</code>.
          </p>
          <p>
            <strong className="text-rc-text">Reporting Vulnerabilities:</strong>{' '}
            Please report any security issues (such as ReDoS vectors, zip-bomb bypasses, or XSS) via GitHub Private Vulnerability Reporting as documented in <code className="text-rc-accent">SECURITY.md</code>.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={footerModal === 'threat-model'}
        onClose={() => setFooterModal(null)}
        title="Threat Model & Trust Boundaries (THREAT_MODEL.md)"
      >
        <div className="space-y-4 rc-text-14 text-rc-text-muted rc-prose-col">
          <p>
            <strong className="text-rc-text">Untrusted Input Assumption:</strong>{' '}
            Every repository, <code className="text-rc-text">.zip</code> archive, file path, and text snippet dropped into RepoCanary is treated as potentially hostile.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-rc-text">Zip-Bomb &amp; Zip-Slip Defense:</strong>{' '}
              Streaming <code className="text-rc-accent">fflate</code> decompression aborts immediately if archives exceed 25 MB, 5,000 files, 1 MB per file, or 100 MB decompressed size. Paths are sanitized as display labels only.
            </li>
            <li>
              <strong className="text-rc-text">LLM Prompt-Hijack Defense:</strong>{' '}
              The deterministic engine is the sole authority for findings, severity, and verdict. Optional BYOK explanations wrap snippets in <code className="text-rc-accent">&lt;UNTRUSTED_SCANNED_DATA_DO_NOT_FOLLOW_INSTRUCTIONS&gt;</code> delimiters with zero tools and strict JSON schema + anti-hijack validation.
            </li>
          </ul>
        </div>
      </Modal>

      {/* Polite aria-live Toast */}
      <Toast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </div>
  );
}

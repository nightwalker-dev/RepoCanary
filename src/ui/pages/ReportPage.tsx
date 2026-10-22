import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Code,
  Copy,
  Download,
  Eye,
  FileCode,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { explainFindingsWithGemini } from '../../ai/explain';
import { AiExplainResponse } from '../../ai/schema';
import { RULE_FAMILIES } from '../../core/rules';
import { buildSarifReport } from '../../core/sarif';
import {
  Finding,
  RuleFamily,
  ScanReport,
  Severity,
} from '../../core/types';
import {
  generateBadgeMarkdownSnippet,
  generateRepoCanaryBadgeSvg,
} from '../../share/badge';
import { renderShareCardPngDataUrl } from '../../share/card';
import { VerdictRing } from '../components/VerdictRing';
import {
  Accordion,
  Badge,
  Button,
  Card,
  CodeBlock,
  EmptyState,
  IconButton,
  Input,
  MiddleTruncatePath,
  Modal,
  SegmentedControl,
  SeverityTag,
  Skeleton,
  TabOption,
} from '../primitives';
import { MOTION_TOKENS, SEVERITY_TOKENS } from '../tokens';

interface ReportPageProps {
  report: ScanReport;
  onInspectFileInXRay: (filePath: string, line?: number) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  apiKey?: string;
  aiExplainEnabled?: boolean;
  onOpenSettings?: () => void;
  onNotify?: (message: string) => void;
}

type MobileReportSubTab = 'findings' | 'files' | 'xray';

const SEVERITIES: ReadonlyArray<Severity> = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
];

export const ReportPage: React.FC<ReportPageProps> = ({
  report,
  onInspectFileInXRay,
  searchInputRef,
  apiKey = '',
  aiExplainEnabled = false,
  onOpenSettings,
  onNotify,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [selectedFamily, setSelectedFamily] = useState<RuleFamily | 'ALL'>('ALL');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileSubTab, setMobileSubTab] =
    useState<MobileReportSubTab>('findings');
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareCardDataUrl, setShareCardDataUrl] = useState<string | null>(null);

  const [explainState, setExplainState] = useState<{
    loading: boolean;
    response: {
      result: AiExplainResponse;
      usedFallback: boolean;
      fallbackReason?: string;
    } | null;
  }>({ loading: false, response: null });

  const [openSeverities, setOpenSeverities] = useState<Record<Severity, boolean>>({
    critical: true,
    high: true,
    medium: true,
    low: true,
    info: false,
  });

  const fileRowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const formattedJson = useMemo(
    () => JSON.stringify(report, null, 2),
    [report]
  );
  const sarifJson = useMemo(
    () => JSON.stringify(buildSarifReport(report), null, 2),
    [report]
  );
  const badgeSvg = useMemo(
    () => generateRepoCanaryBadgeSvg(report.rulesetVersion),
    [report.rulesetVersion]
  );
  const badgeMarkdown = useMemo(
    () => generateBadgeMarkdownSnippet(report.rulesetVersion),
    [report.rulesetVersion]
  );

  const severityTotals = useMemo(() => {
    const totals: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const f of report.findings) {
      totals[f.severity] = (totals[f.severity] ?? 0) + 1;
    }
    return totals;
  }, [report.findings]);

  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: report.findings.length };
    for (const fam of RULE_FAMILIES) {
      counts[fam.family] = 0;
    }
    for (const f of report.findings) {
      counts[f.family] = (counts[f.family] ?? 0) + 1;
    }
    return counts;
  }, [report.findings]);

  const familyTabOptions: ReadonlyArray<TabOption<RuleFamily | 'ALL'>> =
    useMemo(
      () => [
        { id: 'ALL', label: 'ALL', count: familyCounts.ALL },
        ...RULE_FAMILIES.map((fam) => ({
          id: fam.family,
          label: fam.family,
          count: familyCounts[fam.family] ?? 0,
        })),
      ],
      [familyCounts]
    );

  const filteredFindings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return report.findings.filter((f) => {
      if (selectedFamily !== 'ALL' && f.family !== selectedFamily) return false;
      if (selectedFile && f.filePath !== selectedFile) return false;
      if (q) {
        const hay = [
          f.ruleId,
          f.family,
          f.title,
          f.filePath,
          f.description,
          f.snippet,
          f.decodedText ?? '',
          f.context ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [report.findings, selectedFamily, selectedFile, searchQuery]);

  const findingsBySeverity = useMemo(() => {
    const grouped: Record<Severity, Finding[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };
    for (const f of filteredFindings) {
      grouped[f.severity].push(f);
    }
    return grouped;
  }, [filteredFindings]);

  const safeSourceSlug = useMemo(
    () =>
      report.sourceLabel
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'scan',
    [report.sourceLabel]
  );

  const firstFlaggedFile =
    report.files.find((f) => f.findingCount > 0)?.path ||
    report.files[0]?.path ||
    'README.md';

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
    } catch {
      // Fallback ignored
    }
    onNotify?.('Copied deterministic report JSON to clipboard');
  };

  const handleDownloadJson = () => {
    const blob = new Blob([formattedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repocanary-${safeSourceSlug}-report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify?.(`Exported repocanary-${safeSourceSlug}-report.json`);
  };

  const handleDownloadSarif = () => {
    const blob = new Blob([sarifJson], { type: 'application/sarif+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repocanary-${safeSourceSlug}.sarif.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify?.(`Exported SARIF 2.1.0 report`);
  };

  const handleOpenShareModal = () => {
    if (!shareCardDataUrl) {
      setShareCardDataUrl(renderShareCardPngDataUrl(report));
    }
    setShowShareModal(true);
  };

  const handleDownloadShareCardPng = () => {
    const pngUrl = shareCardDataUrl || renderShareCardPngDataUrl(report);
    if (!pngUrl) return;
    setShareCardDataUrl(pngUrl);
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `repocanary-${safeSourceSlug}-card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onNotify?.('Downloaded 1200×630 PNG Share Card');
  };

  const handleDownloadBadgeSvg = () => {
    const blob = new Blob([badgeSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repocanary-badge.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify?.('Downloaded RepoCanary SVG badge');
  };

  const handleRunExplain = async () => {
    setExplainState({ loading: true, response: null });
    const res = await explainFindingsWithGemini(report.findings, {
      apiKey: aiExplainEnabled ? apiKey : '',
    });
    setExplainState({ loading: false, response: res });
  };

  const handleFileTreeKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % report.files.length;
      fileRowRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + report.files.length) % report.files.length;
      fileRowRefs.current[prev]?.focus();
    }
  };

  const mobileSubTabs: ReadonlyArray<TabOption<MobileReportSubTab>> = [
    { id: 'findings', label: 'Findings', count: filteredFindings.length },
    { id: 'files', label: 'Files', count: report.files.length },
    { id: 'xray', label: 'X-Ray' },
  ];

  const handleSelectMobileSubTab = (next: MobileReportSubTab) => {
    if (next === 'xray') {
      onInspectFileInXRay(selectedFile || firstFlaggedFile);
      return;
    }
    setMobileSubTab(next);
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : MOTION_TOKENS.baseMs / 1000,
        ease: MOTION_TOKENS.easing,
      }}
      className="rc-container py-8 space-y-6"
    >
      {/* Top Summary Card: Verdict Ring, Score, Counts per Severity, Export/Share Actions */}
      <Card
        as="section"
        ariaLabel="Scan Verdict Summary"
        elevation={2}
        className="p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <VerdictRing score={report.score} verdict={report.verdict} />

          {/* Counts per Severity */}
          <div
            aria-label="Finding counts by severity"
            className="flex flex-wrap items-center gap-2 lg:justify-end"
          >
            {SEVERITIES.map((sev) => (
              <SeverityTag
                key={sev}
                severity={sev}
                count={severityTotals[sev]}
              />
            ))}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="pt-4 border-t border-rc-border flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            icon={<Eye className="w-4 h-4" aria-hidden="true" />}
            onClick={() => onInspectFileInXRay(firstFlaggedFile)}
          >
            Open X-Ray View
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<Download className="w-4 h-4 text-rc-accent" aria-hidden="true" />}
            onClick={handleDownloadJson}
          >
            Export JSON
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<Download className="w-4 h-4 text-rc-low" aria-hidden="true" />}
            onClick={handleDownloadSarif}
          >
            Export SARIF
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<Copy className="w-4 h-4" aria-hidden="true" />}
            onClick={handleCopyJson}
          >
            Copy JSON
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<Share2 className="w-4 h-4 text-rc-accent" aria-hidden="true" />}
            onClick={handleOpenShareModal}
          >
            Share Card &amp; Badge
          </Button>

          <Button
            variant="secondary"
            size="md"
            loading={explainState.loading}
            icon={<Sparkles className="w-4 h-4 text-rc-accent" aria-hidden="true" />}
            onClick={handleRunExplain}
          >
            Plain-Language Summary
          </Button>

          <Button
            variant="ghost"
            size="md"
            icon={<Code className="w-4 h-4" aria-hidden="true" />}
            onClick={() => setShowJsonModal(true)}
          >
            View JSON
          </Button>
        </div>

        {/* Plain-Language Summary Loading Skeleton or Result */}
        {explainState.loading && (
          <div className="pt-4 border-t border-rc-border space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {explainState.response && !explainState.loading && (
          <div className="pt-4 border-t border-rc-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="rc-text-12 font-mono text-rc-accent font-semibold">
                Plain-Language Summary ·{' '}
                {!explainState.response.usedFallback
                  ? 'Generated via Opt-In Gemini BYOK (Advisory Only — Does Not Change Score or Verdict)'
                  : '100% Offline Deterministic Summary'}
              </div>
              {onOpenSettings && (
                <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                  Configure BYOK in Settings
                </Button>
              )}
            </div>
            {explainState.response.fallbackReason && (
              <div className="rc-text-12 font-mono text-rc-text-muted">
                Mode: {explainState.response.fallbackReason}
              </div>
            )}
            <div className="p-4 rounded-rc-sm bg-rc-bg border border-rc-border space-y-3 max-h-64 overflow-y-auto">
              {explainState.response.result.explanations.length === 0 ? (
                <p className="rc-text-14 text-rc-text-muted">
                  No known tricks were triggered across the scanned files.
                </p>
              ) : (
                explainState.response.result.explanations.map((item) => (
                  <div
                    key={item.findingId}
                    className="pb-3 border-b border-rc-border last:border-b-0 last:pb-0 space-y-1"
                  >
                    <div className="font-mono rc-text-12 font-bold text-rc-accent">
                      {item.ruleId} ({item.findingId})
                    </div>
                    <p className="rc-text-14 text-rc-text rc-prose-col">
                      {item.plainEnglishSummary}
                    </p>
                    <p className="rc-text-12 text-rc-text-muted rc-prose-col">
                      <strong className="text-rc-text">How to fix:</strong>{' '}
                      {item.remediationStep}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Metadata Bar */}
        <div className="pt-4 border-t border-rc-border flex flex-wrap items-center gap-x-3 gap-y-1 rc-text-12 font-mono text-rc-text-muted tabular-nums">
          <span className="text-rc-text font-semibold">{report.sourceLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{report.files.length} file(s) scanned</span>
          <span aria-hidden="true">·</span>
          <span>{report.findings.length} finding(s)</span>
          {(report.suppressedCount ?? 0) > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-rc-accent">
                {report.suppressedCount} suppressed via .repocanaryignore
              </span>
            </>
          )}
          {report.skippedCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{report.skippedCount} binary/ignored skipped</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{report.durationMs} ms</span>
          <span aria-hidden="true">·</span>
          <span>Ruleset v{report.rulesetVersion}</span>
        </div>

        {/* Scan Warnings */}
        {report.warnings.length > 0 && (
          <div className="p-4 rounded-rc-sm rc-sev-high space-y-1 rc-text-12 font-mono">
            {report.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Search & Rule Family Filter Bar */}
      <section aria-label="Search and filter findings" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="w-full sm:max-w-xl">
            <Input
              ref={searchInputRef}
              id="report-search-input"
              type="search"
              label="Search findings"
              hideLabel
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter findings by rule ID, file path, title, or payload... (Ctrl+F)"
              leftIcon={<Search className="w-4 h-4" />}
              rightSlot={
                searchQuery ? (
                  <IconButton
                    label="Clear search query"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </IconButton>
                ) : (
                  <kbd className="hidden sm:inline-block px-2 py-0.5 rc-text-12 font-mono text-rc-text-muted bg-rc-surface-2 border border-rc-border rounded-rc-sm">
                    Ctrl+F
                  </kbd>
                )
              }
            />
          </div>

          <div className="flex items-center gap-3 rc-text-12 font-mono text-rc-text-muted tabular-nums">
            <span>
              Showing {filteredFindings.length} of {report.findings.length}{' '}
              finding(s)
            </span>
            {(selectedFile || searchQuery || selectedFamily !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}
                onClick={() => {
                  setSelectedFamily('ALL');
                  setSelectedFile(null);
                  setSearchQuery('');
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>

        <SegmentedControl
          ariaLabel="Filter findings by rule family"
          options={familyTabOptions}
          value={selectedFamily}
          onChange={setSelectedFamily}
        />
      </section>

      {/* Mobile Tabs: Findings | Files | X-Ray (Never side-by-side on mobile) */}
      <div className="lg:hidden">
        <SegmentedControl
          ariaLabel="Mobile report view switcher"
          options={mobileSubTabs}
          value={mobileSubTab}
          onChange={handleSelectMobileSubTab}
        />
      </div>

      {/* Desktop 2-Column Layout: Sticky 320px File Tree (left) + Findings List (right) */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Left Sticky File Tree (Desktop always visible; Mobile visible when mobileSubTab === 'files') */}
        <aside
          aria-label="Scanned Files"
          className={`w-full lg:w-[320px] shrink-0 lg:sticky lg:top-20 ${
            mobileSubTab === 'files' ? 'block' : 'hidden lg:block'
          }`}
        >
          <Card className="overflow-hidden">
            <div className="px-4 py-3 bg-rc-surface-2 border-b border-rc-border flex items-center justify-between gap-2">
              <h2 className="rc-text-14 font-mono font-semibold text-rc-text tabular-nums">
                Files ({report.files.length})
              </h2>
              {selectedFile ? (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="rc-text-12 font-mono text-rc-accent hover:underline rc-focus-ring rounded-rc-sm cursor-pointer"
                >
                  Clear file filter
                </button>
              ) : (
                <span className="rc-text-12 font-mono text-rc-text-muted">
                  Arrow keys · Eye for X-Ray
                </span>
              )}
            </div>

            <div
              role="listbox"
              aria-label="Filter findings by file"
              className="max-h-[520px] overflow-y-auto divide-y divide-rc-border"
            >
              {report.files.map((file, idx) => {
                const isSelected = selectedFile === file.path;
                return (
                  <div
                    key={file.path}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rc-transition-fast ${
                      isSelected ? 'bg-rc-surface-2' : 'hover:bg-rc-surface-2/60'
                    }`}
                  >
                    <button
                      ref={(el) => {
                        fileRowRefs.current[idx] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onKeyDown={(e) => handleFileTreeKeyDown(e, idx)}
                      onClick={() => {
                        setSelectedFile(isSelected ? null : file.path);
                        setMobileSubTab('findings');
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 min-h-11 text-left rc-focus-ring rounded-rc-sm px-1 cursor-pointer"
                    >
                      <SeverityTag
                        severity={file.highestSeverity}
                        compact
                      />
                      <FileCode
                        className="w-4 h-4 text-rc-text-muted shrink-0"
                        aria-hidden="true"
                      />
                      <MiddleTruncatePath
                        path={file.path}
                        maxLength={24}
                        className={`rc-text-12 ${
                          isSelected
                            ? 'text-rc-accent font-semibold'
                            : 'text-rc-text'
                        }`}
                      />
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono rc-text-12 text-rc-text-muted tabular-nums">
                        {file.findingCount}
                      </span>
                      <IconButton
                        label={`Open ${file.path} in X-Ray View`}
                        onClick={() => onInspectFileInXRay(file.path)}
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </aside>

        {/* Right Column: Findings Grouped by Severity */}
        <div
          className={`flex-1 min-w-0 w-full space-y-4 ${
            mobileSubTab === 'findings' ? 'block' : 'hidden lg:block'
          }`}
        >
          {filteredFindings.length === 0 ? (
            <EmptyState
              icon={<Search className="w-5 h-5" aria-hidden="true" />}
              title={
                report.findings.length === 0
                  ? 'No known tricks found in scanned files'
                  : 'No findings match your active filters'
              }
              description={
                report.findings.length === 0
                  ? 'No hidden Unicode tags, prompt injection phrases, or risky MCP hooks were triggered by the current ruleset. Note: RepoCanary is a heuristic detector and does not guarantee safety.'
                  : 'Clear the search box, switch the rule family back to ALL, or deselect the active file filter.'
              }
              action={
                (selectedFamily !== 'ALL' ||
                  selectedFile !== null ||
                  searchQuery !== '') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedFamily('ALL');
                      setSelectedFile(null);
                      setSearchQuery('');
                    }}
                  >
                    Reset all filters
                  </Button>
                )
              }
            />
          ) : (
            SEVERITIES.map((sev) => {
              const items = findingsBySeverity[sev];
              if (items.length === 0) return null;
              const meta = SEVERITY_TOKENS[sev];
              const isOpen = openSeverities[sev];

              return (
                <Accordion
                  key={sev}
                  borderClass={meta.borderClass}
                  isOpen={isOpen}
                  onToggle={() =>
                    setOpenSeverities((prev) => ({
                      ...prev,
                      [sev]: !prev[sev],
                    }))
                  }
                  title={
                    <>
                      <SeverityTag severity={sev} />
                      <span className="rc-text-16 font-semibold text-rc-text">
                        {meta.label} Severity
                      </span>
                      <span className="rc-text-12 font-mono text-rc-text-muted tabular-nums">
                        · {items.length} finding(s)
                      </span>
                    </>
                  }
                  rightMeta={meta.weightLabel}
                >
                  {items.map((finding) => (
                    <article key={finding.id} className="p-5 sm:p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityTag severity={finding.severity} compact />
                            <Badge tone="accent">{finding.ruleId}</Badge>
                            <Badge>Family {finding.family}</Badge>
                            {finding.context && (
                              <Badge>Context: {finding.context}</Badge>
                            )}
                            <span className="font-mono rc-text-12 text-rc-text tabular-nums">
                              <MiddleTruncatePath
                                path={finding.filePath}
                                maxLength={42}
                              />
                              :{finding.line}:{finding.column}
                            </span>
                          </div>
                          <h3 className="rc-text-18 font-semibold text-rc-text">
                            {finding.title}
                          </h3>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye className="w-4 h-4 text-rc-accent" aria-hidden="true" />}
                          onClick={() =>
                            onInspectFileInXRay(finding.filePath, finding.line)
                          }
                        >
                          Inspect in X-Ray
                        </Button>
                      </div>

                      {/* Decoded Hidden Payload Banner */}
                      {finding.decodedText && (
                        <div className="p-4 rounded-rc-sm rc-sev-medium space-y-1.5">
                          <div className="rc-text-12 font-mono font-bold text-rc-accent">
                            DECODED HIDDEN PAYLOAD (WHAT THE AI READS):
                          </div>
                          <pre className="rc-text-12 font-mono text-rc-text whitespace-pre-wrap break-words">
                            {finding.decodedText}
                          </pre>
                        </div>
                      )}

                      {/* Flagged Line Excerpt */}
                      <CodeBlock
                        label={`Flagged Line Excerpt (${finding.filePath}:${finding.line})`}
                        code={finding.snippet}
                        maxHeightClass="max-h-40"
                        onCopied={() =>
                          onNotify?.('Copied flagged snippet to clipboard')
                        }
                      />

                      {/* Why this matters & How to fix */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div className="p-4 rounded-rc-sm bg-rc-bg border border-rc-border space-y-1">
                          <div className="rc-text-12 font-mono font-semibold text-rc-text">
                            Why this matters
                          </div>
                          <p className="rc-text-14 text-rc-text-muted rc-prose-col">
                            {finding.whyItMatters || finding.description}
                          </p>
                        </div>

                        <div className="p-4 rounded-rc-sm bg-rc-bg border border-rc-border space-y-1">
                          <div className="rc-text-12 font-mono font-semibold text-rc-clean">
                            How to fix
                          </div>
                          <p className="rc-text-14 text-rc-text-muted rc-prose-col">
                            {finding.howToFix || finding.remediation}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </Accordion>
              );
            })
          )}
        </div>
      </div>

      {/* Share Card & Badge Modal (Live 1200x630 aspect-ratio preview + grouped buttons + Markdown CodeBlock) */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Report Card & Repository Badge"
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="rc-text-14 font-mono font-semibold text-rc-accent">
                1200×630 Report Card Preview (Zero Code Snippets)
              </h3>
              <span className="rc-text-12 font-mono text-rc-text-muted">
                Aspect Ratio 1200:630
              </span>
            </div>
            <p className="rc-text-14 text-rc-text-muted rc-prose-col">
              Contains only the verdict, score, severity counts, triggered rule IDs, and ruleset version. Never includes repository source code snippets.
            </p>
            <div className="w-full aspect-[1200/630] rounded-rc-md overflow-hidden border border-rc-border bg-rc-bg flex items-center justify-center">
              {shareCardDataUrl ? (
                <img
                  src={shareCardDataUrl}
                  alt="RepoCanary 1200x630 Share Card preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <Skeleton className="w-full h-full" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="primary"
                size="md"
                icon={<Download className="w-4 h-4" aria-hidden="true" />}
                onClick={handleDownloadShareCardPng}
              >
                Download 1200×630 PNG
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<Download className="w-4 h-4 text-rc-accent" aria-hidden="true" />}
                onClick={handleDownloadBadgeSvg}
              >
                Download Badge SVG
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-rc-border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="rc-text-14 font-mono font-semibold text-rc-text">
                README Badge Markdown Snippet
              </h3>
              <span className="inline-flex items-center rounded-rc-sm overflow-hidden border border-rc-border rc-text-12 font-mono">
                <span className="px-2.5 py-1 bg-rc-surface-2 text-rc-text">
                  Scanned with RepoCanary
                </span>
                <span className="px-2.5 py-1 bg-rc-accent text-rc-accent-ink font-bold">
                  v{report.rulesetVersion}
                </span>
              </span>
            </div>
            <p className="rc-text-12 text-rc-text-muted">
              States <code className="text-rc-text">Scanned with RepoCanary · v{report.rulesetVersion}</code> — never claims &quot;safe&quot; or &quot;verified&quot;.
            </p>
            <CodeBlock
              label="Markdown Snippet"
              code={badgeMarkdown}
              onCopied={() => onNotify?.('Copied README badge Markdown')}
            />
          </div>
        </div>
      </Modal>

      {/* Raw JSON Inspector Modal */}
      <Modal
        isOpen={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        title="Deterministic ScanReport JSON (Secrets Redacted)"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rc-text-12 font-mono text-rc-text-muted">
              Schema: RepoCanary ScanReport v{report.rulesetVersion}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleDownloadJson}>
                Download .json
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDownloadSarif}>
                Download .sarif.json
              </Button>
            </div>
          </div>
          <CodeBlock
            label="repocanary-report.json"
            code={formattedJson}
            maxHeightClass="max-h-[55vh]"
            onCopied={() => onNotify?.('Copied report JSON to clipboard')}
          />
        </div>
      </Modal>
    </motion.div>
  );
};

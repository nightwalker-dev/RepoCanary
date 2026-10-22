import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  GitCompare,
  Link2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { ScannedFileInput, ScanReport } from '../../core/types';
import { buildXRayLines, XRayLine, XRaySegment } from '../../core/xray';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  Input,
  MiddleTruncatePath,
  SegmentedControl,
  TabOption,
} from '../primitives';
import { MOTION_TOKENS, truncateMiddlePath } from '../tokens';

export type XRayDisplayMode = 'split' | 'human' | 'ai' | 'diff';

interface XRayViewProps {
  files: ReadonlyArray<ScannedFileInput>;
  report: ScanReport;
  initialFilePath?: string;
  initialLine?: number;
  initialDisplayMode?: XRayDisplayMode;
  onBackToReport: () => void;
}

const VIRTUAL_ROW_HEIGHT = 48;
const VIRTUAL_OVERSCAN = 14;
const VIRTUALIZATION_THRESHOLD = 200;

function renderAiSegment(seg: XRaySegment, idx: number) {
  switch (seg.type) {
    case 'chip-tag':
      return (
        <Chip
          key={idx}
          kind="tag"
          label={seg.text}
          tooltip={seg.chipLabel || 'Unicode Tag ASCII Smuggling'}
        />
      );
    case 'chip-bidi':
      return (
        <Chip
          key={idx}
          kind="bidi"
          label={seg.text}
          tooltip={seg.chipLabel || 'Bidirectional Text Control'}
        />
      );
    case 'chip-zero-width':
      return (
        <Chip
          key={idx}
          kind="zero-width"
          label={seg.text}
          tooltip={seg.chipLabel || 'Zero-Width Formatting Character'}
        />
      );
    case 'homoglyph':
      return (
        <Chip
          key={idx}
          kind="homoglyph"
          label={seg.text}
          tooltip={seg.chipLabel || 'Mixed-Script Homoglyph'}
        />
      );
    case 'comment-revealed':
    case 'hidden-markup':
      return (
        <Chip
          key={idx}
          kind="comment"
          label={seg.text}
          tooltip={seg.chipLabel || 'Hidden HTML Comment or Markup'}
        />
      );
    default:
      return <span key={idx}>{seg.text}</span>;
  }
}

const DESKTOP_MODE_OPTIONS: ReadonlyArray<TabOption<XRayDisplayMode>> = [
  { id: 'split', label: 'Split View' },
  { id: 'human', label: 'Human View' },
  { id: 'ai', label: 'AI View' },
  { id: 'diff', label: 'Diff View' },
];

const MOBILE_MODE_OPTIONS: ReadonlyArray<TabOption<XRayDisplayMode>> = [
  { id: 'diff', label: 'Diff View' },
  { id: 'ai', label: 'AI View' },
  { id: 'human', label: 'Human View' },
];

export const XRayView: React.FC<XRayViewProps> = ({
  files,
  report,
  initialFilePath,
  initialLine,
  initialDisplayMode = 'split',
  onBackToReport,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const defaultFile = useMemo(() => {
    if (initialFilePath && files.some((f) => f.path === initialFilePath)) {
      return initialFilePath;
    }
    const firstFlagged = report.files.find((f) => f.findingCount > 0);
    if (firstFlagged && files.some((f) => f.path === firstFlagged.path)) {
      return firstFlagged.path;
    }
    return files[0]?.path ?? '';
  }, [files, initialFilePath, report.files]);

  const [selectedFilePath, setSelectedFilePath] = useState<string>(defaultFile);
  const [displayMode, setDisplayMode] =
    useState<XRayDisplayMode>(initialDisplayMode);
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [activeAnomalyIdx, setActiveAnomalyIdx] = useState<number>(0);

  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const singlePaneRef = useRef<HTMLDivElement | null>(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  const activeFile = useMemo(
    () => files.find((f) => f.path === selectedFilePath) ?? files[0],
    [files, selectedFilePath]
  );

  const xrayLines = useMemo<XRayLine[]>(() => {
    if (!activeFile) return [];
    return buildXRayLines(activeFile.content);
  }, [activeFile]);

  const anomalousLineNumbers = useMemo(
    () =>
      xrayLines
        .filter((l) => l.hasHiddenContent || Boolean(l.decodedBanner))
        .map((l) => l.lineNumber),
    [xrayLines]
  );

  const visibleLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return xrayLines.filter((line) => {
      if (onlyAnomalies && !line.hasHiddenContent && !line.decodedBanner) {
        return false;
      }
      if (q) {
        const aiText = line.aiSegments.map((s) => s.text).join(' ');
        const decoded = line.decodedBanner?.decodedText ?? '';
        const combined =
          `${line.humanVisibleText} ${aiText} ${decoded}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }
      return true;
    });
  }, [xrayLines, onlyAnomalies, searchQuery]);

  const isVirtualized =
    visibleLines.length > VIRTUALIZATION_THRESHOLD && !onlyAnomalies && !searchQuery;

  const { startIdx, endIdx, topSpacerHeight, bottomSpacerHeight } =
    useMemo(() => {
      if (!isVirtualized) {
        return {
          startIdx: 0,
          endIdx: visibleLines.length,
          topSpacerHeight: 0,
          bottomSpacerHeight: 0,
        };
      }
      const viewportHeight = 600;
      const rawStart = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT);
      const start = Math.max(0, rawStart - VIRTUAL_OVERSCAN);
      const visibleCount =
        Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
      const end = Math.min(visibleLines.length, start + visibleCount);

      return {
        startIdx: start,
        endIdx: end,
        topSpacerHeight: start * VIRTUAL_ROW_HEIGHT,
        bottomSpacerHeight: Math.max(
          0,
          (visibleLines.length - end) * VIRTUAL_ROW_HEIGHT
        ),
      };
    }, [isVirtualized, scrollTop, visibleLines.length]);

  const windowedLines = useMemo(
    () => visibleLines.slice(startIdx, endIdx),
    [visibleLines, startIdx, endIdx]
  );

  const scrollToLineNumber = (lineNum: number) => {
    const indexInVisible = visibleLines.findIndex(
      (l) => l.lineNumber === lineNum
    );
    if (indexInVisible === -1) return;
    const targetTop = Math.max(0, (indexInVisible - 2) * VIRTUAL_ROW_HEIGHT);
    setScrollTop(targetTop);
    if (leftPaneRef.current) leftPaneRef.current.scrollTop = targetTop;
    if (rightPaneRef.current) rightPaneRef.current.scrollTop = targetTop;
    if (singlePaneRef.current) singlePaneRef.current.scrollTop = targetTop;
  };

  useEffect(() => {
    if (!initialLine) return;
    scrollToLineNumber(initialLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLine, selectedFilePath]);

  // Keyboard shortcuts j / k to jump between anomalous lines when not typing in an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (anomalousLineNumbers.length === 0) return;

      if (e.key === 'j' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        const nextIdx = (activeAnomalyIdx + 1) % anomalousLineNumbers.length;
        setActiveAnomalyIdx(nextIdx);
        scrollToLineNumber(anomalousLineNumbers[nextIdx]);
      } else if (e.key === 'k' || (e.altKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        const prevIdx =
          (activeAnomalyIdx - 1 + anomalousLineNumbers.length) %
          anomalousLineNumbers.length;
        setActiveAnomalyIdx(prevIdx);
        scrollToLineNumber(anomalousLineNumbers[prevIdx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnomalyIdx, anomalousLineNumbers, visibleLines]);

  const handleLeftScroll = () => {
    if (!leftPaneRef.current) return;
    const currentTop = leftPaneRef.current.scrollTop;
    setScrollTop(currentTop);

    if (!syncScroll || !rightPaneRef.current) return;
    if (isSyncingLeft.current) {
      isSyncingLeft.current = false;
      return;
    }
    isSyncingRight.current = true;
    rightPaneRef.current.scrollTop = currentTop;
  };

  const handleRightScroll = () => {
    if (!rightPaneRef.current) return;
    const currentTop = rightPaneRef.current.scrollTop;
    setScrollTop(currentTop);

    if (!syncScroll || !leftPaneRef.current) return;
    if (isSyncingRight.current) {
      isSyncingRight.current = false;
      return;
    }
    isSyncingLeft.current = true;
    leftPaneRef.current.scrollTop = currentTop;
  };

  const handleSinglePaneScroll = () => {
    if (!singlePaneRef.current) return;
    setScrollTop(singlePaneRef.current.scrollTop);
  };

  const handleJumpAnomaly = (direction: 1 | -1) => {
    if (anomalousLineNumbers.length === 0) return;
    const nextIdx =
      (activeAnomalyIdx + direction + anomalousLineNumbers.length) %
      anomalousLineNumbers.length;
    setActiveAnomalyIdx(nextIdx);
    scrollToLineNumber(anomalousLineNumbers[nextIdx]);
  };

  const mobileActiveMode: XRayDisplayMode =
    displayMode === 'split' ? 'diff' : displayMode;

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : MOTION_TOKENS.baseMs / 1000,
        ease: MOTION_TOKENS.easing,
      }}
      className="rc-container py-6 space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
              onClick={onBackToReport}
            >
              Back to Report
            </Button>
            <span className="rc-text-12 font-mono text-rc-accent">
              Signature X-Ray Differential Inspector
            </span>
          </div>
          <h1 className="rc-text-32 font-bold text-rc-text">
            X-Ray View: Human vs. AI Tokenizer Differential
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            label="Previous hidden payload line (k)"
            variant="secondary"
            disabled={anomalousLineNumbers.length === 0}
            onClick={() => handleJumpAnomaly(-1)}
          >
            <ArrowUp className="w-4 h-4" aria-hidden="true" />
          </IconButton>
          <span className="rc-text-12 font-mono text-rc-text-muted tabular-nums px-1">
            {anomalousLineNumbers.length > 0
              ? `${activeAnomalyIdx + 1}/${anomalousLineNumbers.length} tricks`
              : '0 tricks'}
          </span>
          <IconButton
            label="Next hidden payload line (j)"
            variant="secondary"
            disabled={anomalousLineNumbers.length === 0}
            onClick={() => handleJumpAnomaly(1)}
          >
            <ArrowDown className="w-4 h-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {/* Sticky X-Ray Controls Toolbar */}
      <Card
        as="section"
        ariaLabel="X-Ray Controls Toolbar"
        elevation={2}
        className="sticky top-16 z-20 p-4 bg-rc-surface/95 backdrop-blur-xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Desktop 4-mode toggle (Split | Human | AI | Diff) */}
          <div className="hidden lg:block">
            <SegmentedControl
              ariaLabel="X-Ray display mode"
              options={DESKTOP_MODE_OPTIONS}
              value={displayMode}
              onChange={setDisplayMode}
            />
          </div>

          {/* Mobile 3-mode single-pane toggle (Diff | AI | Human — never side-by-side on mobile) */}
          <div className="lg:hidden w-full">
            <SegmentedControl
              ariaLabel="Mobile X-Ray display mode"
              options={MOBILE_MODE_OPTIONS}
              value={mobileActiveMode}
              onChange={setDisplayMode}
            />
          </div>

          {/* File Selector + Filter Hidden + Sync Scroll */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2 min-w-0">
              <label
                htmlFor="xray-file-select"
                className="rc-text-12 font-mono text-rc-text-muted shrink-0"
              >
                File:
              </label>
              <select
                id="xray-file-select"
                value={selectedFilePath}
                onChange={(e) => {
                  setSelectedFilePath(e.target.value);
                  setScrollTop(0);
                  setActiveAnomalyIdx(0);
                }}
                className="min-h-11 px-3 py-2 rc-text-12 font-mono bg-rc-bg border border-rc-border rounded-rc-sm text-rc-text rc-focus-ring cursor-pointer max-w-[260px]"
              >
                {files.map((f) => {
                  const fileSummary = report.files.find(
                    (rf) => rf.path === f.path
                  );
                  const count = fileSummary?.findingCount ?? 0;
                  return (
                    <option key={f.path} value={f.path} title={f.path}>
                      {truncateMiddlePath(f.path, 30)} ({count} hits)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={onlyAnomalies ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setOnlyAnomalies((prev) => !prev)}
              >
                Filter Hidden ({anomalousLineNumbers.length})
              </Button>

              {displayMode === 'split' && (
                <span className="hidden lg:inline-flex">
                  <Button
                    variant={syncScroll ? 'secondary' : 'ghost'}
                    size="sm"
                    icon={<Link2 className="w-4 h-4 text-rc-accent" aria-hidden="true" />}
                    onClick={() => setSyncScroll((prev) => !prev)}
                  >
                    Sync Scroll: {syncScroll ? 'ON' : 'OFF'}
                  </Button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search Input + Token Legend */}
        <div className="pt-3 border-t border-rc-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="w-full md:max-w-sm">
            <Input
              type="search"
              label="Search X-Ray lines"
              hideLabel
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lines or hidden payloads..."
              leftIcon={<Search className="w-4 h-4" />}
              rightSlot={
                searchQuery ? (
                  <IconButton
                    label="Clear line search"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </IconButton>
                ) : undefined
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 rc-text-12 font-mono text-rc-text-muted tabular-nums">
            <span>
              <MiddleTruncatePath
                path={activeFile?.path ?? ''}
                maxLength={32}
                className="text-rc-text font-semibold"
              />
            </span>
            <span aria-hidden="true">·</span>
            <span>{xrayLines.length.toLocaleString()} lines</span>
            <span aria-hidden="true">·</span>
            <span className="text-rc-accent">
              {anomalousLineNumbers.length} anomalous
            </span>
          </div>
        </div>
      </Card>

      {/* Empty State if filter matches 0 lines */}
      {visibleLines.length === 0 ? (
        <EmptyState
          icon={<Eye className="w-5 h-5" aria-hidden="true" />}
          title="No lines match the current X-Ray filter"
          description="Disable 'Filter Hidden' or clear the line search input to inspect all lines in this file."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setOnlyAnomalies(false);
                setSearchQuery('');
              }}
            >
              Show all {xrayLines.length} lines
            </Button>
          }
        />
      ) : (
        <>
          {/* DESKTOP SPLIT VIEW: Two Equal Panes with Synced Scroll & Center Divider */}
          {displayMode === 'split' && (
            <Card className="hidden lg:grid lg:grid-cols-2 lg:divide-x lg:divide-rc-border overflow-hidden">
              {/* Left Pane: What Humans See */}
              <section
                aria-label="What Humans See (Rendered View)"
                className="flex flex-col min-w-0"
              >
                <div className="px-4 py-3 border-b border-rc-border bg-rc-surface-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-rc-text-muted" aria-hidden="true" />
                    <h2 className="rc-text-14 font-semibold text-rc-text">
                      What Humans See
                    </h2>
                  </div>
                  <span className="rc-text-12 font-mono text-rc-text-muted">
                    Comments &amp; Invisible Chars Hidden
                  </span>
                </div>

                <div
                  ref={leftPaneRef}
                  onScroll={handleLeftScroll}
                  tabIndex={0}
                  aria-label="Human View scrollable code lines"
                  className="h-[600px] overflow-y-auto font-mono rc-text-12 divide-y divide-rc-border rc-focus-ring"
                >
                  {topSpacerHeight > 0 && (
                    <div style={{ height: topSpacerHeight }} aria-hidden="true" />
                  )}
                  {windowedLines.map((line) => (
                    <div
                      key={`human-${line.lineNumber}`}
                      className={`flex items-start px-3 py-2.5 min-h-12 ${
                        line.hasHiddenContent ? 'bg-rc-critical-bg/40' : ''
                      }`}
                    >
                      <span className="w-12 shrink-0 select-none text-right pr-3 text-rc-text-muted tabular-nums">
                        {line.lineNumber}
                      </span>
                      <div className="flex-1 min-w-0 whitespace-pre-wrap break-words text-rc-text leading-relaxed">
                        {line.humanVisibleText || (
                          <span className="italic text-rc-text-muted">
                            {line.hasHiddenContent
                              ? '[Line appears blank to human reader]'
                              : ' '}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {bottomSpacerHeight > 0 && (
                    <div
                      style={{ height: bottomSpacerHeight }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </section>

              {/* Right Pane: What Your AI Agent Reads */}
              <section
                aria-label="What Your AI Agent Reads (Raw Tokenizer View)"
                className="flex flex-col min-w-0"
              >
                <div className="px-4 py-3 border-b border-rc-border bg-rc-surface-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rc-accent" aria-hidden="true" />
                    <h2 className="rc-text-14 font-semibold text-rc-accent">
                      What Your AI Agent Reads
                    </h2>
                  </div>
                  <span className="rc-text-12 font-mono text-rc-text-muted">
                    Raw Context + Decoded Hidden Payloads
                  </span>
                </div>

                <div
                  ref={rightPaneRef}
                  onScroll={handleRightScroll}
                  tabIndex={0}
                  aria-label="AI View scrollable code lines"
                  className="h-[600px] overflow-y-auto font-mono rc-text-12 divide-y divide-rc-border rc-focus-ring"
                >
                  {topSpacerHeight > 0 && (
                    <div style={{ height: topSpacerHeight }} aria-hidden="true" />
                  )}
                  {windowedLines.map((line) => (
                    <div
                      key={`ai-${line.lineNumber}`}
                      className={`px-3 py-2.5 min-h-12 space-y-2 ${
                        line.hasHiddenContent ? 'bg-rc-medium-bg/40' : ''
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="w-12 shrink-0 select-none text-right pr-3 text-rc-text-muted tabular-nums">
                          {line.lineNumber}
                        </span>
                        <div className="flex-1 min-w-0 whitespace-pre-wrap break-words text-rc-text leading-relaxed">
                          {line.aiSegments.length > 0 ? (
                            line.aiSegments.map((seg, idx) =>
                              renderAiSegment(seg, idx)
                            )
                          ) : (
                            <span> </span>
                          )}
                        </div>
                      </div>

                      {line.decodedBanner && (
                        <div className="ml-12 p-3 rounded-rc-sm rc-sev-medium space-y-1">
                          <div className="rc-text-12 font-bold text-rc-accent">
                            {line.decodedBanner.label}:
                          </div>
                          <div className="text-rc-text font-semibold break-words">
                            {line.decodedBanner.decodedText}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {bottomSpacerHeight > 0 && (
                    <div
                      style={{ height: bottomSpacerHeight }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </section>
            </Card>
          )}

          {/* SINGLE PANE VIEW: Used on Mobile always, and on Desktop when mode is 'human' | 'ai' | 'diff' */}
          <div className={displayMode === 'split' ? 'lg:hidden' : 'block'}>
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-rc-border bg-rc-surface-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {mobileActiveMode === 'human' ? (
                    <>
                      <Eye className="w-4 h-4 text-rc-text-muted" aria-hidden="true" />
                      <h2 className="rc-text-14 font-semibold text-rc-text">
                        What Humans See (Rendered View)
                      </h2>
                    </>
                  ) : mobileActiveMode === 'ai' ? (
                    <>
                      <Sparkles className="w-4 h-4 text-rc-accent" aria-hidden="true" />
                      <h2 className="rc-text-14 font-semibold text-rc-accent">
                        What Your AI Agent Reads (Tokenizer View)
                      </h2>
                    </>
                  ) : (
                    <>
                      <GitCompare className="w-4 h-4 text-rc-accent" aria-hidden="true" />
                      <h2 className="rc-text-14 font-semibold text-rc-text">
                        Unified Differential View (Human vs. AI Tokenizer)
                      </h2>
                    </>
                  )}
                </div>
                <span className="rc-text-12 font-mono text-rc-text-muted">
                  {mobileActiveMode === 'diff'
                    ? '(-) Human Visible vs (+) AI Reads'
                    : mobileActiveMode === 'ai'
                      ? 'Decoded Invisible Tokens'
                      : 'Hidden Tokens Stripped'}
                </span>
              </div>

              <div
                ref={singlePaneRef}
                onScroll={handleSinglePaneScroll}
                tabIndex={0}
                aria-label="X-Ray code lines"
                className="h-[600px] overflow-y-auto font-mono rc-text-12 divide-y divide-rc-border rc-focus-ring"
              >
                {topSpacerHeight > 0 && (
                  <div style={{ height: topSpacerHeight }} aria-hidden="true" />
                )}
                {windowedLines.map((line) => {
                  if (mobileActiveMode === 'human') {
                    return (
                      <div
                        key={`single-human-${line.lineNumber}`}
                        className={`flex items-start px-3 py-2.5 min-h-12 ${
                          line.hasHiddenContent ? 'bg-rc-critical-bg/40' : ''
                        }`}
                      >
                        <span className="w-12 shrink-0 select-none text-right pr-3 text-rc-text-muted tabular-nums">
                          {line.lineNumber}
                        </span>
                        <div className="flex-1 min-w-0 whitespace-pre-wrap break-words text-rc-text leading-relaxed">
                          {line.humanVisibleText || (
                            <span className="italic text-rc-text-muted">
                              {line.hasHiddenContent
                                ? '[Line appears blank to human reader]'
                                : ' '}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (mobileActiveMode === 'ai') {
                    return (
                      <div
                        key={`single-ai-${line.lineNumber}`}
                        className={`px-3 py-2.5 min-h-12 space-y-2 ${
                          line.hasHiddenContent ? 'bg-rc-medium-bg/40' : ''
                        }`}
                      >
                        <div className="flex items-start">
                          <span className="w-12 shrink-0 select-none text-right pr-3 text-rc-text-muted tabular-nums">
                            {line.lineNumber}
                          </span>
                          <div className="flex-1 min-w-0 whitespace-pre-wrap break-words text-rc-text leading-relaxed">
                            {line.aiSegments.length > 0 ? (
                              line.aiSegments.map((seg, idx) =>
                                renderAiSegment(seg, idx)
                              )
                            ) : (
                              <span> </span>
                            )}
                          </div>
                        </div>

                        {line.decodedBanner && (
                          <div className="ml-12 p-3 rounded-rc-sm rc-sev-medium space-y-1">
                            <div className="rc-text-12 font-bold text-rc-accent">
                              {line.decodedBanner.label}:
                            </div>
                            <div className="text-rc-text font-semibold break-words">
                              {line.decodedBanner.decodedText}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Unified Diff View
                  const isDiff =
                    line.hasHiddenContent || Boolean(line.decodedBanner);
                  return (
                    <div
                      key={`single-diff-${line.lineNumber}`}
                      className={`px-3 py-2.5 space-y-1.5 ${
                        isDiff ? 'bg-rc-surface-2' : ''
                      }`}
                    >
                      {isDiff ? (
                        <>
                          <div className="flex items-start text-rc-text-muted">
                            <span className="w-12 shrink-0 select-none text-right pr-3 tabular-nums">
                              {line.lineNumber} -
                            </span>
                            <div className="flex-1 min-w-0 whitespace-pre-wrap break-words">
                              <span className="text-rc-text-muted mr-2">
                                [HUMAN]:
                              </span>
                              {line.humanVisibleText || (
                                <span className="italic">
                                  [Appears blank to human reader]
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-start text-rc-text bg-rc-critical-bg/40 py-1.5 rounded-rc-sm">
                            <span className="w-12 shrink-0 select-none text-right pr-3 text-rc-accent font-bold tabular-nums">
                              {line.lineNumber} +
                            </span>
                            <div className="flex-1 min-w-0 whitespace-pre-wrap break-words leading-relaxed">
                              <span className="text-rc-accent font-bold mr-2">
                                [AI READS]:
                              </span>
                              {line.aiSegments.map((seg, idx) =>
                                renderAiSegment(seg, idx)
                              )}
                            </div>
                          </div>
                          {line.decodedBanner && (
                            <div className="ml-12 p-3 rounded-rc-sm rc-sev-medium space-y-1">
                              <div className="rc-text-12 font-bold text-rc-accent">
                                {line.decodedBanner.label}:
                              </div>
                              <div className="text-rc-text font-semibold break-words">
                                {line.decodedBanner.decodedText}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-start min-h-8">
                          <span className="w-12 shrink-0 select-none text-right pr-3 text-rc-text-muted tabular-nums">
                            {line.lineNumber}
                          </span>
                          <div className="flex-1 min-w-0 whitespace-pre-wrap break-words text-rc-text">
                            {line.humanVisibleText || ' '}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {bottomSpacerHeight > 0 && (
                  <div
                    style={{ height: bottomSpacerHeight }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </motion.div>
  );
};

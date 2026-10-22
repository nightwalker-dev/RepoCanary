import React from 'react';
import { Lock, RotateCcw, Settings, Sparkles } from 'lucide-react';
import { Button, IconButton } from '../primitives';

export type ActiveTab =
  | 'scan'
  | 'report'
  | 'xray'
  | 'gallery'
  | 'rules'
  | 'settings';

interface TopNavProps {
  activeTab: ActiveTab;
  hasReport: boolean;
  networkCount: number;
  aiExplainEnabled: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onTrySample: () => void;
  onNewScan: () => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: ActiveTab;
  label: string;
  requiresReport?: boolean;
}> = [
  { id: 'scan', label: 'Scanner' },
  { id: 'report', label: 'Report', requiresReport: true },
  { id: 'xray', label: 'X-Ray', requiresReport: true },
  { id: 'gallery', label: 'Gallery' },
  { id: 'rules', label: 'Rules & About' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  hasReport,
  networkCount,
  aiExplainEnabled,
  onSelectTab,
  onTrySample,
  onNewScan,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-rc-bg/95 backdrop-blur-xs border-b border-rc-border">
      <div className="rc-container min-h-16 py-2 flex items-center justify-between gap-3">
        {/* Left: Wordmark */}
        <a
          href="#scan"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('scan');
          }}
          className="rc-text-18 font-bold tracking-tight text-rc-accent whitespace-nowrap shrink-0 rc-focus-ring rounded-rc-sm py-2 px-1"
        >
          RepoCanary
        </a>

        {/* Center: Primary Navigation */}
        <nav
          aria-label="Primary Navigation"
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isDisabled = Boolean(item.requiresReport && !hasReport);
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isDisabled}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => !isDisabled && onSelectTab(item.id)}
                className={`min-h-11 px-3 py-2 rc-text-14 font-medium whitespace-nowrap shrink-0 border-b-2 rc-transition-fast rc-focus-ring ${
                  isActive
                    ? 'text-rc-accent border-rc-accent font-semibold'
                    : isDisabled
                      ? 'text-rc-text-muted/40 border-transparent cursor-not-allowed'
                      : 'text-rc-text-muted border-transparent hover:text-rc-text cursor-pointer'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Privacy Indicator + Settings + Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            title="View live network audit and privacy controls"
            className="hidden lg:inline-flex items-center gap-1.5 min-h-11 px-3 py-1.5 rounded-rc-sm bg-rc-surface border border-rc-border hover:border-rc-border-strong rc-text-12 font-mono text-rc-text-muted rc-transition-fast rc-focus-ring cursor-pointer tabular-nums"
          >
            <Lock
              className={`w-4 h-4 shrink-0 ${
                aiExplainEnabled ? 'text-rc-accent' : 'text-rc-clean'
              }`}
              aria-hidden="true"
            />
            <span>
              {aiExplainEnabled ? 'BYOK Opt-In' : 'Local-Only'} · {networkCount} net
            </span>
          </button>

          <IconButton
            label="Settings and privacy controls"
            active={activeTab === 'settings'}
            variant="secondary"
            onClick={() => onSelectTab('settings')}
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
          </IconButton>

          <div className="hidden sm:block">
            {hasReport ? (
              <Button
                variant="primary"
                size="sm"
                icon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}
                onClick={onNewScan}
              >
                New Scan
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
                onClick={onTrySample}
              >
                Try sample attack
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

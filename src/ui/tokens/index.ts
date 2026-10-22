/**
 * RepoCanary Design Tokens — Single Source of Truth
 * Theme: Dark "Terminal Noir" with Canary-Yellow Accent
 *
 * All UI primitives and screens reference these semantic token classes and CSS variables
 * defined in `src/index.css`. No hard-coded hex colors, ad-hoc shadows, or arbitrary pixel
 * values are used in components.
 */

import { Severity, VerdictLabel } from '../../core/types';

export const COLOR_TOKENS = {
  bg: 'var(--rc-bg)',
  surface: 'var(--rc-surface)',
  surface2: 'var(--rc-surface-2)',
  border: 'var(--rc-border)',
  text: 'var(--rc-text)',
  textMuted: 'var(--rc-text-muted)',
  accent: 'var(--rc-accent)',
  accentInk: 'var(--rc-accent-ink)',
} as const;

export const SPACING_SCALE_PX = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
  24: 96,
} as const;

export const MOTION_TOKENS = {
  fastMs: 120,
  baseMs: 200,
  slowMs: 360,
  easing: [0.22, 1, 0.36, 1] as [number, number, number, number],
} as const;

export interface SeverityTokenMeta {
  severity: Severity | 'none';
  label: string;
  shortLabel: string;
  weightLabel: string;
  badgeClass: string;
  borderClass: string;
  textClass: string;
  dotClass: string;
  surfaceClass: string;
}

export const SEVERITY_TOKENS: Record<Severity | 'none', SeverityTokenMeta> = {
  critical: {
    severity: 'critical',
    label: 'Critical',
    shortLabel: 'CRITICAL',
    weightLabel: '+40 pts',
    badgeClass: 'rc-sev-critical',
    borderClass: 'border-rc-critical-border',
    textClass: 'text-rc-critical',
    dotClass: 'bg-rc-critical',
    surfaceClass: 'bg-rc-critical-bg',
  },
  high: {
    severity: 'high',
    label: 'High',
    shortLabel: 'HIGH',
    weightLabel: '+20 pts',
    badgeClass: 'rc-sev-high',
    borderClass: 'border-rc-high-border',
    textClass: 'text-rc-high',
    dotClass: 'bg-rc-high',
    surfaceClass: 'bg-rc-high-bg',
  },
  medium: {
    severity: 'medium',
    label: 'Medium',
    shortLabel: 'MEDIUM',
    weightLabel: '+8 pts',
    badgeClass: 'rc-sev-medium',
    borderClass: 'border-rc-medium-border',
    textClass: 'text-rc-medium',
    dotClass: 'bg-rc-medium',
    surfaceClass: 'bg-rc-medium-bg',
  },
  low: {
    severity: 'low',
    label: 'Low',
    shortLabel: 'LOW',
    weightLabel: '+3 pts',
    badgeClass: 'rc-sev-low',
    borderClass: 'border-rc-low-border',
    textClass: 'text-rc-low',
    dotClass: 'bg-rc-low',
    surfaceClass: 'bg-rc-low-bg',
  },
  info: {
    severity: 'info',
    label: 'Info',
    shortLabel: 'INFO',
    weightLabel: '0 pts',
    badgeClass: 'rc-sev-info',
    borderClass: 'border-rc-info-border',
    textClass: 'text-rc-info',
    dotClass: 'bg-rc-info',
    surfaceClass: 'bg-rc-info-bg',
  },
  none: {
    severity: 'none',
    label: 'No tricks found',
    shortLabel: '0 HITS',
    weightLabel: '0 pts',
    badgeClass: 'rc-sev-clean',
    borderClass: 'border-rc-clean-border',
    textClass: 'text-rc-clean',
    dotClass: 'bg-rc-clean',
    surfaceClass: 'bg-rc-clean-bg',
  },
};

export function getVerdictTokenMeta(
  score: number,
  verdict: VerdictLabel
): {
  strokeVar: string;
  textClass: string;
  severityKey: Severity | 'none';
  summaryCopy: string;
} {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped >= 50) {
    return {
      strokeVar: 'var(--rc-sev-critical)',
      textClass: 'text-rc-critical',
      severityKey: 'critical',
      summaryCopy:
        'Critical prompt injection, invisible Unicode smuggling, exfiltration directives, or auto-execution hooks were detected.',
    };
  }
  if (clamped >= 20) {
    return {
      strokeVar: 'var(--rc-sev-high)',
      textClass: 'text-rc-high',
      severityKey: 'high',
      summaryCopy:
        'Multiple suspicious patterns or high-risk agent configurations were detected. Inspect every flagged line in X-Ray View.',
    };
  }
  if (clamped >= 1) {
    return {
      strokeVar: 'var(--rc-sev-medium)',
      textClass: 'text-rc-medium',
      severityKey: 'medium',
      summaryCopy:
        'Low-to-moderate heuristic indicators were found. Inspect the flagged lines in X-Ray View before pointing an AI coding agent at this repo.',
    };
  }
  return {
    strokeVar: 'var(--rc-sev-clean)',
    textClass: 'text-rc-clean',
    severityKey: 'none',
    summaryCopy: `${verdict}. Heuristic detector only — not a malware scanner or a guarantee of safety.`,
  };
}

/**
 * Truncates long file paths in the middle (never at the end) so both the top-level
 * directory context and exact filename remain visible.
 */
export function truncateMiddlePath(filePath: string, maxLength = 38): string {
  if (!filePath || filePath.length <= maxLength) {
    return filePath;
  }
  const slashIndex = filePath.indexOf('/');
  const lastSlashIndex = filePath.lastIndexOf('/');

  if (slashIndex !== -1 && lastSlashIndex > slashIndex) {
    const firstSeg = filePath.slice(0, slashIndex + 1);
    const fileName = filePath.slice(lastSlashIndex);
    if (firstSeg.length + fileName.length + 1 <= maxLength) {
      const remaining = maxLength - firstSeg.length - fileName.length - 1;
      const middle = filePath.slice(slashIndex + 1, slashIndex + 1 + Math.max(0, remaining));
      return `${firstSeg}${middle}…${fileName}`;
    }
  }

  const headLen = Math.ceil((maxLength - 1) * 0.45);
  const tailLen = Math.floor((maxLength - 1) * 0.55);
  return `${filePath.slice(0, headLen)}…${filePath.slice(filePath.length - tailLen)}`;
}

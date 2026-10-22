import { Finding, Severity, VerdictLabel } from './types';

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 3,
  info: 0,
};

export const SEVERITY_RANK: Record<Severity | 'none', number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
  none: 0,
};

/**
 * Computes the deterministic scan score (0-100) from findings.
 * Critical = 40, High = 20, Medium = 8, Low = 3, Info = 0, capped at 100.
 */
export function calculateScore(findings: ReadonlyArray<Pick<Finding, 'severity'>>): number {
  let total = 0;
  for (const finding of findings) {
    total += SEVERITY_WEIGHTS[finding.severity] ?? 0;
    if (total >= 100) {
      return 100;
    }
  }
  return Math.min(100, Math.max(0, total));
}

/**
 * Maps a numeric score (0-100) to the exact required verdict label.
 * Never returns "safe".
 */
export function getVerdict(score: number): VerdictLabel {
  if (score <= 0) {
    return 'No known tricks found';
  }
  if (score <= 19) {
    return 'Look closer';
  }
  if (score <= 49) {
    return 'Open with care';
  }
  return 'Do not point an AI agent at this';
}

/**
 * Returns the highest severity present in a list of findings, or 'none'.
 */
export function getHighestSeverity(
  findings: ReadonlyArray<Pick<Finding, 'severity'>>
): Severity | 'none' {
  let best: Severity | 'none' = 'none';
  for (const finding of findings) {
    if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[best]) {
      best = finding.severity;
    }
  }
  return best;
}

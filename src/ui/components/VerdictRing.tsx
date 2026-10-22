import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { VerdictLabel } from '../../core/types';
import { SeverityTag } from '../primitives';
import { getVerdictTokenMeta, MOTION_TOKENS } from '../tokens';

interface VerdictRingProps {
  score: number;
  verdict: VerdictLabel;
}

export const VerdictRing: React.FC<VerdictRingProps> = ({ score, verdict }) => {
  const shouldReduceMotion = useReducedMotion();
  const size = 132;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;

  const meta = getVerdictTokenMeta(clamped, verdict);

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`Risk score ${clamped} out of 100. Verdict: ${verdict}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--rc-surface-2)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={meta.strokeVar}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={
              shouldReduceMotion
                ? { strokeDashoffset: offset }
                : { strokeDashoffset: circumference }
            }
            animate={{ strokeDashoffset: offset }}
            transition={{
              duration: shouldReduceMotion ? 0 : MOTION_TOKENS.slowMs / 1000,
              ease: MOTION_TOKENS.easing,
            }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono rc-text-32 font-bold text-rc-text tabular-nums">
            {clamped}
          </span>
          <span className="font-mono rc-text-12 text-rc-text-muted tabular-nums">
            / 100
          </span>
        </div>
      </div>

      <div className="space-y-2 text-center sm:text-left min-w-0">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <SeverityTag severity={meta.severityKey} />
          <span className="rc-text-12 font-mono text-rc-text-muted">
            Deterministic Heuristic Verdict
          </span>
        </div>
        <h1 className={`rc-text-32 font-bold ${meta.textClass}`}>
          {verdict}
        </h1>
        <p className="rc-text-14 text-rc-text-muted rc-prose-col">
          {meta.summaryCopy}
        </p>
      </div>
    </div>
  );
};

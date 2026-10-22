import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Card, ProgressBar } from '../primitives';
import { MOTION_TOKENS } from '../tokens';

export interface ScanProgressState {
  phase: 'read' | 'decode' | 'detect' | 'score';
  progress: number;
  detail?: string;
}

const PHASES: ReadonlyArray<{
  key: ScanProgressState['phase'];
  label: string;
  threshold: number;
}> = [
  { key: 'read', label: '01. Read Buffers', threshold: 10 },
  { key: 'decode', label: '02. Decode Unicode', threshold: 25 },
  { key: 'detect', label: '03. Evaluate Rules', threshold: 85 },
  { key: 'score', label: '04. Compute Score', threshold: 100 },
];

export const ScanningPage: React.FC<{ state: ScanProgressState }> = ({
  state,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="rc-container py-16 flex justify-center"
      aria-live="polite"
      aria-busy="true"
    >
      <Card elevation={2} className="w-full max-w-2xl p-8 text-center space-y-8">
        <div className="mx-auto w-16 h-16 rounded-rc-full bg-rc-surface-2 border border-rc-border flex items-center justify-center">
          <motion.svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--rc-accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={
              shouldReduceMotion
                ? {}
                : {
                    scale: [1, 1.06, 1],
                  }
            }
            transition={{
              duration: MOTION_TOKENS.slowMs / 1000,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            aria-hidden="true"
          >
            <path d="M16 7h.01" />
            <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
            <path d="m20 7 2 .5-2 .5" />
            <path d="M10 18v3" />
            <path d="M14 17.75V21" />
            <path d="M7 18a6 6 0 0 0 3.84-10.61" />
          </motion.svg>
        </div>

        <div className="space-y-2">
          <h1 className="rc-text-24 font-bold text-rc-text">
            Inspecting Agent-Facing Files in Web Worker
          </h1>
          <p className="rc-text-14 font-mono text-rc-accent tabular-nums">
            {state.detail || 'Initializing deterministic ruleset...'}
          </p>
        </div>

        <ProgressBar
          value={state.progress}
          label={`Phase: ${state.phase.toUpperCase()}`}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          {PHASES.map((p) => {
            const isActive = state.phase === p.key;
            const isComplete = state.progress >= p.threshold && !isActive;
            return (
              <div
                key={p.key}
                className={`p-3 rounded-rc-sm border rc-text-12 font-mono ${
                  isActive
                    ? 'bg-rc-medium-bg border-rc-accent text-rc-accent font-semibold'
                    : isComplete
                      ? 'bg-rc-clean-bg border-rc-clean-border text-rc-clean'
                      : 'bg-rc-bg border-rc-border text-rc-text-muted'
                }`}
              >
                <div>{p.label}</div>
                <div className="mt-1 opacity-85">
                  {isActive ? 'ACTIVE' : isComplete ? 'DONE' : 'WAITING'}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

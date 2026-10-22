import React from 'react';
import { Activity, Key, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { GEMINI_MODEL_ID } from '../../config';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Textarea,
  Toggle,
} from '../primitives';
import { MOTION_TOKENS } from '../tokens';

export interface NetworkLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
}

interface SettingsPageProps {
  apiKey: string;
  onChangeApiKey: (key: string) => void;
  aiExplainEnabled: boolean;
  onToggleAiExplain: (enabled: boolean) => void;
  customIgnoreText: string;
  onChangeCustomIgnoreText: (text: string) => void;
  networkLogs: ReadonlyArray<NetworkLogEntry>;
  onClearNetworkLogs: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  apiKey,
  onChangeApiKey,
  aiExplainEnabled,
  onToggleAiExplain,
  customIgnoreText,
  onChangeCustomIgnoreText,
  networkLogs,
  onClearNetworkLogs,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : MOTION_TOKENS.baseMs / 1000,
        ease: MOTION_TOKENS.easing,
      }}
      className="rc-container py-8 sm:py-10 space-y-8"
    >
      <section className="space-y-3 rc-prose-col">
        <div className="rc-text-12 font-mono text-rc-accent">
          Privacy, BYOK Configuration &amp; Live Network Activity Audit
        </div>
        <h1 className="rc-text-32 font-bold text-rc-text">
          Settings &amp; Privacy Controls
        </h1>
        <p className="rc-text-16 text-rc-text-muted">
          By default, RepoCanary runs 100% offline in your browser with zero external network calls. Verify this at any time in your browser&apos;s DevTools Network tab or in the live request log below.
        </p>
      </section>

      {/* Prominent Privacy Guarantee Banner */}
      <div className="p-4 rounded-rc-md rc-sev-clean flex items-start gap-3">
        <Lock className="w-5 h-5 text-rc-clean shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <div className="rc-text-14 font-semibold text-rc-clean">
            Nothing leaves your browser unless you explicitly enable an external feature below.
          </div>
          <p className="rc-text-12 text-rc-text rc-prose-col">
            Local folder drops, .zip archives, and pasted text are scanned strictly inside a client-side Web Worker. Only scanning a remote GitHub URL contacts <code className="text-rc-accent">api.github.com</code>, and only enabling Optional AI Explain contacts <code className="text-rc-accent">generativelanguage.googleapis.com</code>.
          </p>
        </div>
      </div>

      <div className="rc-grid items-start">
        {/* Section 1: Optional AI Explain & Memory-Only BYOK */}
        <Card
          as="section"
          ariaLabel="Optional AI Explain and Gemini API Key"
          className="col-span-4 lg:col-span-6 p-6 space-y-6 h-full flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-rc-accent" aria-hidden="true" />
                <h2 className="rc-text-18 font-semibold text-rc-text">
                  Optional AI Explain (BYOK)
                </h2>
              </div>
              <Badge tone={aiExplainEnabled ? 'accent' : 'neutral'}>
                {aiExplainEnabled ? 'OPT-IN ENABLED' : 'DEFAULT OFF'}
              </Badge>
            </div>

            <Toggle
              label="Enable Opt-In Gemini Plain-Language Explanations"
              description={`The deterministic engine is always the single source of truth for findings, severity, and verdict. When enabled, RepoCanary can send flagged snippets only (max 2 KB each, max 20 snippets, secrets redacted first) wrapped in strict untrusted-data delimiters to ${GEMINI_MODEL_ID}.`}
              checked={aiExplainEnabled}
              onChange={onToggleAiExplain}
            />

            <div className="pt-4 border-t border-rc-border space-y-3">
              <Input
                id="gemini-byok-input"
                type="password"
                autoComplete="off"
                label="Bring Your Own Gemini API Key (Memory-Only — Never Saved to Disk or LocalStorage)"
                value={apiKey}
                onChange={(e) => onChangeApiKey(e.target.value)}
                placeholder="Paste optional Gemini API key (cleared when tab closes)..."
                helperText="Sent exclusively via the x-goog-api-key HTTP header. Never placed in URLs, localStorage, sessionStorage, or console logs."
                rightSlot={
                  apiKey ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChangeApiKey('')}
                    >
                      Clear
                    </Button>
                  ) : undefined
                }
              />
            </div>
          </div>

          <div className="pt-4 border-t border-rc-border flex items-center gap-2 rc-text-12 font-mono text-rc-text-muted">
            <ShieldCheck className="w-4 h-4 text-rc-clean shrink-0" aria-hidden="true" />
            <span>
              Deterministic fallback is always used if no API key is provided.
            </span>
          </div>
        </Card>

        {/* Section 2: Custom .repocanaryignore Suppression Rules */}
        <Card
          as="section"
          ariaLabel="Custom .repocanaryignore Rules"
          className="col-span-4 lg:col-span-6 p-6 space-y-4 h-full flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="rc-text-18 font-semibold text-rc-text">
                Custom <code className="text-rc-accent">.repocanaryignore</code> Rules
              </h2>
              <Badge>GLOB + :RULE-ID</Badge>
            </div>
            <p className="rc-text-14 text-rc-text-muted rc-prose-col">
              If a scanned repository includes a <code className="text-rc-text">.repocanaryignore</code> file, RepoCanary applies it automatically. You can also define session-level ignore globs (optionally scoped to a rule ID like <code className="text-rc-accent">docs/**.md:INJ-001</code>) below. Suppressed findings are always counted in the Report header.
            </p>
            <Textarea
              id="custom-repocanaryignore"
              label="Session Ignore Patterns (1 per line)"
              rows={6}
              value={customIgnoreText}
              onChange={(e) => onChangeCustomIgnoreText(e.target.value)}
              placeholder={'# Example:\ntests/fixtures/**\ndocs/security-notes.md:INJ-001'}
            />
          </div>

          <div className="pt-4 border-t border-rc-border rc-text-12 font-mono text-rc-text-muted">
            Linear-time glob matcher · Never hides suppressed finding count
          </div>
        </Card>
      </div>

      {/* Section 3: Live External Network Activity Log */}
      <Card
        as="section"
        ariaLabel="Live External Network Activity Log"
        className="p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-rc-clean" aria-hidden="true" />
              <h2 className="rc-text-18 font-semibold text-rc-text">
                Live External Network Activity Log
              </h2>
              <Badge tone={networkLogs.length === 0 ? 'clean' : 'accent'}>
                {networkLogs.length} outbound call(s)
              </Badge>
            </div>
            <p className="rc-text-14 text-rc-text-muted">
              Lists every outbound request made during this browser session. Local folder drops, .zip uploads, and paste scans make 0 network requests.
            </p>
          </div>

          {networkLogs.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
              onClick={onClearNetworkLogs}
            >
              Clear Log
            </Button>
          )}
        </div>

        {networkLogs.length === 0 ? (
          <EmptyState
            icon={<Lock className="w-5 h-5 text-rc-clean" aria-hidden="true" />}
            title="0 external network requests made in this session"
            description="Your code has not left your browser. Open your browser's DevTools Network tab (F12) to verify independently."
          />
        ) : (
          <div className="overflow-x-auto rounded-rc-sm border border-rc-border">
            <table className="w-full text-left border-collapse rc-text-12 font-mono tabular-nums">
              <thead>
                <tr className="border-b border-rc-border bg-rc-surface-2 text-rc-text-muted">
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Endpoint</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rc-border bg-rc-bg">
                {networkLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 px-4 text-rc-text-muted">
                      {entry.timestamp}
                    </td>
                    <td className="py-2.5 px-4 text-rc-accent font-semibold">
                      {entry.method}
                    </td>
                    <td className="py-2.5 px-4 text-rc-text break-all">
                      {entry.url}
                    </td>
                    <td className="py-2.5 px-4 text-rc-clean">
                      HTTP {entry.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

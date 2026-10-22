import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ALL_RULES, RULE_FAMILIES } from '../../core/rules';
import { Badge, Card, SeverityTag } from '../primitives';
import { MOTION_TOKENS } from '../tokens';

export const RulesPage: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : MOTION_TOKENS.baseMs / 1000,
        ease: MOTION_TOKENS.easing,
      }}
      className="rc-container py-8 sm:py-10 space-y-12"
    >
      {/* About & Honest Limitations (Readable 70ch prose column) */}
      <section aria-label="About RepoCanary and Honest Limitations" className="space-y-6 rc-prose-col">
        <div className="space-y-2">
          <div className="rc-text-12 font-mono text-rc-accent">
            Deterministic Heuristic Engine · Architecture &amp; Honest Limitations
          </div>
          <h1 className="rc-text-32 font-bold text-rc-text">
            About RepoCanary, Scoring &amp; Rule Catalog
          </h1>
        </div>

        <p className="rc-text-16 text-rc-text-muted">
          AI coding agents read repository files like <code className="text-rc-text">README.md</code>, <code className="text-rc-text">AGENTS.md</code>, <code className="text-rc-text">CLAUDE.md</code>, <code className="text-rc-text">.cursorrules</code>, <code className="text-rc-text">.mcp.json</code>, and code comments as trusted instructions. Attackers can hide prompt overrides inside those files using invisible Unicode Tag blocks (<code className="text-rc-accent">U+E0000–U+E007F</code>), Bidirectional control characters, HTML comments, or poisoned MCP tool descriptions.
        </p>

        <div className="p-5 rounded-rc-md bg-rc-surface border border-rc-border space-y-3">
          <h2 className="rc-text-18 font-semibold text-rc-text">
            Honest Non-Goals &amp; Limitations
          </h2>
          <ul className="list-disc pl-5 space-y-2 rc-text-14 text-rc-text-muted">
            <li>
              <strong className="text-rc-text">Not a malware scanner or guarantee of safety:</strong> RepoCanary is a static heuristic detector for AI agent-facing text and configuration files. It does not sandbox binaries or analyze compiled executables.
            </li>
            <li>
              <strong className="text-rc-text">False positives and false negatives exist:</strong> Heuristic rules can flag benign security documentation (mitigated via context classification and <code className="text-rc-accent">.repocanaryignore</code>) and cannot catch every novel natural-language prompt injection.
            </li>
            <li>
              <strong className="text-rc-text">Never claims &quot;safe&quot; or &quot;verified&quot;:</strong> A score of <code className="text-rc-clean">0</code> produces the verdict <code className="text-rc-clean">&quot;No known tricks found&quot;</code>.
            </li>
          </ul>
        </div>
      </section>

      {/* Scoring & Verdict Thresholds Grid */}
      <section aria-label="Scoring and Verdict Thresholds" className="rc-grid items-stretch">
        <Card className="col-span-4 lg:col-span-6 p-6 space-y-4 h-full flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="rc-text-18 font-semibold text-rc-text">
              Severity Weights (Capped at 100)
            </h2>
            <p className="rc-text-14 text-rc-text-muted">
              Every finding carries an icon, an explicit text label, and a deterministic point weight:
            </p>
            <div className="space-y-2.5 pt-2 font-mono rc-text-14 tabular-nums">
              <div className="flex items-center justify-between py-2 border-b border-rc-border">
                <SeverityTag severity="critical" />
                <span className="text-rc-text">+40 points</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-rc-border">
                <SeverityTag severity="high" />
                <span className="text-rc-text">+20 points</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-rc-border">
                <SeverityTag severity="medium" />
                <span className="text-rc-text">+8 points</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-rc-border">
                <SeverityTag severity="low" />
                <span className="text-rc-text">+3 points</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <SeverityTag severity="info" />
                <span className="text-rc-text-muted">0 points</span>
              </div>
            </div>
          </div>
          <div className="pt-2 rc-text-12 font-mono text-rc-text-muted">
            Context-adjusted across mcp-config, agent-instructions, agent-skill, docs, and generic files
          </div>
        </Card>

        <Card className="col-span-4 lg:col-span-6 p-6 space-y-4 h-full flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="rc-text-18 font-semibold text-rc-text">
              Exact Verdict Thresholds
            </h2>
            <p className="rc-text-14 text-rc-text-muted">
              The deterministic engine maps the capped 0–100 score to one of four plain-language verdicts:
            </p>
            <div className="space-y-3 pt-2 font-mono rc-text-14 tabular-nums">
              <div className="flex items-center justify-between py-2 border-b border-rc-border gap-2">
                <Badge tone="clean">Score 0</Badge>
                <span className="text-rc-clean font-semibold text-right">
                  &quot;No known tricks found&quot;
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-rc-border gap-2">
                <Badge tone="accent">Score 1–19</Badge>
                <span className="text-rc-medium font-semibold text-right">
                  &quot;Look closer&quot;
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-rc-border gap-2">
                <Badge tone="accent">Score 20–49</Badge>
                <span className="text-rc-high font-semibold text-right">
                  &quot;Open with care&quot;
                </span>
              </div>
              <div className="flex items-center justify-between py-2 gap-2">
                <Badge tone="accent">Score 50+</Badge>
                <span className="text-rc-critical font-semibold text-right">
                  &quot;Do not point an AI agent at this&quot;
                </span>
              </div>
            </div>
          </div>
          <div className="pt-2 rc-text-12 font-mono text-rc-text-muted">
            The optional LLM explainer can never modify findings, scores, or verdicts.
          </div>
        </Card>
      </section>

      {/* Active Rule Registry Table */}
      <section aria-label="Rule Catalog" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="rc-text-24 font-bold text-rc-text">
            Rule Catalog ({ALL_RULES.length} Active Rules Across {RULE_FAMILIES.length} Families)
          </h2>
          <Badge tone="accent">Ruleset v1.0.0</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse rc-text-14">
              <thead>
                <tr className="border-b border-rc-border bg-rc-surface-2 font-mono rc-text-12 text-rc-text-muted">
                  <th className="py-3.5 px-4">Rule ID</th>
                  <th className="py-3.5 px-4">Family</th>
                  <th className="py-3.5 px-4">Base Severity</th>
                  <th className="py-3.5 px-4">Title, Detection Logic &amp; Remediation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rc-border">
                {ALL_RULES.map((rule) => (
                  <tr
                    key={rule.id}
                    className="hover:bg-rc-surface-2/60 rc-transition-fast"
                  >
                    <td className="py-4 px-4 font-mono font-bold text-rc-accent whitespace-nowrap align-top">
                      {rule.id}
                    </td>
                    <td className="py-4 px-4 font-mono text-rc-text whitespace-nowrap align-top">
                      {rule.family}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap align-top">
                      <SeverityTag severity={rule.severity} compact />
                    </td>
                    <td className="py-4 px-4 space-y-1.5 align-top">
                      <div className="font-semibold text-rc-text">
                        {rule.title}
                      </div>
                      <p className="rc-text-14 text-rc-text-muted rc-prose-col">
                        {rule.description}
                      </p>
                      <p className="rc-text-12 text-rc-clean font-mono rc-prose-col">
                        Fix: {rule.remediation}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </motion.div>
  );
};

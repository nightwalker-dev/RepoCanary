import { describe, expect, it } from 'vitest';
import { ALL_RULES } from '../src/core/rules';
import { scanRepository, scanSingleFile } from '../src/core/scanner';
import { calculateScore, getVerdict } from '../src/core/scoring';
import { buildXRayLines } from '../src/core/xray';
import { getSampleAttackRepo } from '../src/ingest/samples';
import { ORDINARY_CLEAN_READMES, RULE_FIXTURES } from './fixtures/canaryFixtures';

describe('RepoCanary Core Detection Engine — Rule Coverage', () => {
  it('has fixture sets with >=2 positives and >=2 negatives for every registered rule', () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(20);
    for (const rule of ALL_RULES) {
      const fixtureSet = RULE_FIXTURES[rule.id];
      expect(fixtureSet, `Missing fixture set for rule ${rule.id}`).toBeDefined();
      expect(fixtureSet.positives.length).toBeGreaterThanOrEqual(2);
      expect(fixtureSet.negatives.length).toBeGreaterThanOrEqual(2);
    }
  });

  for (const rule of ALL_RULES) {
    describe(`Rule ${rule.id}: ${rule.title}`, () => {
      const fixtureSet = RULE_FIXTURES[rule.id];

      it('flags all positive canary fixtures', () => {
        for (const pos of fixtureSet.positives) {
          const findings = rule.evaluate(pos);
          expect(
            findings.length,
            `Expected rule ${rule.id} to trigger on positive fixture (${pos.path}): ${pos.content}`
          ).toBeGreaterThanOrEqual(1);
          expect(findings[0].ruleId).toBe(rule.id);
          expect(findings[0].family).toBe(rule.family);
          expect(findings[0].severity).toBe(rule.severity);
        }
      });

      it('does not flag any negative fixtures', () => {
        for (const neg of fixtureSet.negatives) {
          const findings = rule.evaluate(neg);
          expect(
            findings,
            `Expected rule ${rule.id} NOT to trigger on negative fixture (${neg.path}): ${neg.content}`
          ).toHaveLength(0);
        }
      });
    });
  }
});

describe('Ordinary README False-Positive Check', () => {
  it('produces score 0 and "No known tricks found" on ordinary clean README and CONTRIBUTING files', () => {
    const report = scanRepository(ORDINARY_CLEAN_READMES, {
      sourceLabel: 'Clean Repo',
    });
    expect(report.findings).toHaveLength(0);
    expect(report.score).toBe(0);
    expect(report.verdict).toBe('No known tricks found');
  });
});

describe('Scoring & Verdict Determinism', () => {
  it('computes exact weights and caps at 100, never saying "safe"', () => {
    expect(calculateScore([])).toBe(0);
    expect(getVerdict(0)).toBe('No known tricks found');
    expect(getVerdict(0).toLowerCase()).not.toContain('safe');

    expect(calculateScore([{ severity: 'low' }])).toBe(3);
    expect(getVerdict(3)).toBe('Look closer');

    expect(calculateScore([{ severity: 'medium' }, { severity: 'high' }])).toBe(28);
    expect(getVerdict(28)).toBe('Open with care');

    expect(
      calculateScore([
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'critical' },
      ])
    ).toBe(100);
    expect(getVerdict(100)).toBe('Do not point an AI agent at this');
  });
});

describe('Secret Redaction & X-Ray View Tokenization', () => {
  it('redacts raw secret values in findings and snippets', () => {
    const rawSecret = 'ghp_1234567890abcdefghijklmnopqrstuvwx99';
    const { findings } = scanSingleFile({
      path: '.env',
      content: `GITHUB_TOKEN=${rawSecret}`,
    });
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].snippet).not.toContain(rawSecret);
    expect(findings[0].snippet).toContain('ghp_••••••••••••99');
  });

  it('reveals Unicode Tag ASCII smuggling and HTML comments in X-Ray lines', () => {
    const sample = getSampleAttackRepo();
    const readme = sample.files.find((f) => f.path === 'README.md')!;
    const xrayLines = buildXRayLines(readme.content);

    const tagLine = xrayLines.find((l) => l.decodedBanner?.kind === 'unicode-tags');
    expect(tagLine).toBeDefined();
    expect(tagLine?.decodedBanner?.decodedText).toContain('CANARY-7731');

    const commentLine = xrayLines.find((l) =>
      l.aiSegments.some((s) => s.type === 'comment-revealed')
    );
    expect(commentLine).toBeDefined();
    expect(commentLine?.humanVisibleText).toBe('');
  });
});

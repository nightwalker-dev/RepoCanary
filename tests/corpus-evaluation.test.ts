import { describe, expect, it } from 'vitest';
import { scanSingleFile } from '../src/core/scanner';
import { BENIGN_CORPUS } from './benign-corpus';
import { CANARY_CORPUS } from './canary-corpus';

describe('Part B: Benign Corpus (30 samples) & Canary Corpus (8 families) Evaluation', () => {
  it('contains 30 realistic benign samples; 0 produce High/Critical findings and all 27 non-security-doc samples produce 0 findings total', () => {
    expect(BENIGN_CORPUS).toHaveLength(30);

    let highOrCriticalOnBenign = 0;
    let nonDocFindings = 0;
    let downgradedDocFindings = 0;

    for (const sample of BENIGN_CORPUS) {
      const { findings, summary } = scanSingleFile(sample);
      const severe = findings.filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
      );
      highOrCriticalOnBenign += severe.length;

      expect(
        severe,
        `Benign sample ${sample.id} (${sample.path}) unexpectedly produced High/Critical finding(s): ${JSON.stringify(severe)}`
      ).toHaveLength(0);

      if (sample.category === 'docs-about-prompt-injection') {
        expect(summary.context).toBe('docs');
        downgradedDocFindings += findings.length;
        for (const f of findings) {
          expect(f.severity).toBe('low');
        }
      } else {
        nonDocFindings += findings.length;
        expect(
          findings,
          `Standard benign sample ${sample.id} (${sample.path}) produced unexpected finding(s)`
        ).toHaveLength(0);
      }
    }

    expect(highOrCriticalOnBenign).toBe(0);
    expect(nonDocFindings).toBe(0);
    expect(downgradedDocFindings).toBe(6);
  });

  it('contains 8 harmless canary samples (one per rule family) and each triggers its intended rule and family', () => {
    expect(CANARY_CORPUS).toHaveLength(8);

    const coveredFamilies = new Set<string>();

    for (const sample of CANARY_CORPUS) {
      coveredFamilies.add(sample.expectedFamily);
      const { findings } = scanSingleFile(sample.file);

      expect(
        findings.length,
        `Canary sample ${sample.id} did not trigger any findings`
      ).toBeGreaterThanOrEqual(1);

      const matchedRule = findings.find(
        (f) =>
          f.ruleId === sample.expectedRuleId &&
          f.family === sample.expectedFamily
      );
      expect(
        matchedRule,
        `Canary sample ${sample.id} expected ${sample.expectedRuleId} (${sample.expectedFamily}), got ${JSON.stringify(findings.map((f) => f.ruleId))}`
      ).toBeDefined();
    }

    expect(coveredFamilies.size).toBe(8);
  });
});

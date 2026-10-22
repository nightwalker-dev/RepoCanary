import { ALL_RULES } from './rules';
import { ScanReport, Severity } from './types';

export interface SarifLog {
  $schema: 'https://json.schemastore.org/sarif-2.1.0.json';
  version: '2.1.0';
  runs: Array<{
    tool: {
      driver: {
        name: string;
        informationUri: string;
        version: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          fullDescription: { text: string };
          help: { text: string };
          defaultConfiguration: {
            level: 'error' | 'warning' | 'note';
          };
          properties: {
            family: string;
            severity: Severity;
          };
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      ruleIndex: number;
      level: 'error' | 'warning' | 'note';
      message: {
        text: string;
      };
      locations: Array<{
        physicalLocation: {
          artifactLocation: {
            uri: string;
          };
          region: {
            startLine: number;
            startColumn: number;
            snippet: {
              text: string;
            };
          };
        };
      }>;
      properties: {
        severity: Severity;
        family: string;
        context?: string;
        whyItMatters: string;
        howToFix: string;
        decodedText?: string;
      };
    }>;
  }>;
}

function mapSeverityToSarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  if (severity === 'critical' || severity === 'high') {
    return 'error';
  }
  if (severity === 'medium') {
    return 'warning';
  }
  return 'note';
}

/**
 * Converts a deterministic ScanReport into a valid OASIS SARIF 2.1.0 JSON document.
 * Secrets are already redacted in Finding snippets.
 */
export function buildSarifReport(report: ScanReport): SarifLog {
  const ruleIndexMap = new Map<string, number>();
  const driverRules = ALL_RULES.map((rule, idx) => {
    ruleIndexMap.set(rule.id, idx);
    return {
      id: rule.id,
      name: rule.title.replace(/[^A-Za-z0-9]/g, ''),
      shortDescription: { text: rule.title },
      fullDescription: { text: rule.description },
      help: { text: `Why this matters: ${rule.description} How to fix: ${rule.remediation}` },
      defaultConfiguration: {
        level: mapSeverityToSarifLevel(rule.severity),
      },
      properties: {
        family: rule.family,
        severity: rule.severity,
      },
    };
  });

  const results = report.findings.map((finding) => {
    const ruleIndex = ruleIndexMap.get(finding.ruleId) ?? 0;
    return {
      ruleId: finding.ruleId,
      ruleIndex,
      level: mapSeverityToSarifLevel(finding.severity),
      message: {
        text: `${finding.title}: ${finding.whyItMatters} Fix: ${finding.howToFix}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: finding.filePath,
            },
            region: {
              startLine: Math.max(1, finding.line),
              startColumn: Math.max(1, finding.column),
              snippet: {
                text: finding.snippet,
              },
            },
          },
        },
      ],
      properties: {
        severity: finding.severity,
        family: finding.family,
        ...(finding.context ? { context: finding.context } : {}),
        whyItMatters: finding.whyItMatters,
        howToFix: finding.howToFix,
        ...(finding.decodedText ? { decodedText: finding.decodedText } : {}),
      },
    };
  });

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'RepoCanary',
            informationUri: 'https://github.com/repocanary/repocanary',
            version: report.rulesetVersion,
            rules: driverRules,
          },
        },
        results,
      },
    ],
  };
}

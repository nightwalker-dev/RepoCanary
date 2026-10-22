import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding, redactSecretValue } from './helpers';

const API_TOKEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'OpenAI / Secret API Key', regex: /\b(sk-(?:proj-)?[a-zA-Z0-9_-]{20,64})\b/ },
  { name: 'GitHub Personal Access Token', regex: /\b(gh[pousr]_[A-Za-z0-9_]{24,64})\b/ },
  { name: 'GitHub Fine-Grained Token', regex: /\b(github_pat_[A-Za-z0-9_]{24,82})\b/ },
  { name: 'AWS Access Key ID', regex: /\b(AKIA[0-9A-Z]{16})\b/ },
  { name: 'Google Cloud / Gemini API Key', regex: /\b(AIza[0-9A-Za-z_-]{35})\b/ },
  { name: 'Slack Token', regex: /\b(xox[baprs]-[0-9A-Za-z-]{16,64})\b/ },
];

export const SEC_001_API_TOKEN: RuleDefinition = {
  id: 'SEC-001',
  family: 'SEC',
  title: 'Leaked API Key or Access Token (Redacted)',
  severity: 'medium',
  description:
    'A string matching a known API token or cloud credential format was found. All secret values are automatically redacted in RepoCanary.',
  remediation:
    'Revoke and rotate the exposed credential immediately, remove it from git history, and load secrets from environment variables.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      // Ignore obvious example placeholders
      if (/YOUR_API_KEY|MY_GEMINI_API_KEY|EXAMPLE|PLACEHOLDER|xxxx/i.test(line)) {
        continue;
      }

      for (const { name, regex } of API_TOKEN_PATTERNS) {
        const m = regex.exec(line);
        if (m) {
          const masked = redactSecretValue(m[1]);
          const redactedLine = line.replace(m[1], masked);
          findings.push(
            createFinding(SEC_001_API_TOKEN, file, i + 1, m.index + 1, redactedLine, {
              customDescription: `Detected ${name} pattern (${masked}). Value is redacted for safety.`,
            })
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const SEC_002_PRIVATE_KEY: RuleDefinition = {
  id: 'SEC-002',
  family: 'SEC',
  title: 'Committed Private Key Block (Redacted)',
  severity: 'high',
  description:
    'A PEM/OpenSSH private key header was detected in the file.',
  remediation:
    'Remove the private key file from the repository, rotate the key pair, and add key patterns to .gitignore.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');
    const pkRegex = /-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      const m = pkRegex.exec(line);
      if (m) {
        findings.push(
          createFinding(
            SEC_002_PRIVATE_KEY,
            file,
            i + 1,
            m.index + 1,
            `${m[0]} [REDACTED KEY MATERIAL]`
          )
        );
      }
    }

    return findings;
  },
};

export const SEC_RULES: RuleDefinition[] = [SEC_001_API_TOKEN, SEC_002_PRIVATE_KEY];

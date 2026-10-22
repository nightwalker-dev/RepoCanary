import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding } from './helpers';

const CREDENTIAL_READ_PATTERNS = [
  /(?:read|cat|print|output|include|upload|send|summarize|encode)\s+(?:the\s+)?(?:contents?\s+of\s+)?(?:~\/\.ssh\/id_[a-z0-9_]+|~\/\.aws\/credentials|~\/\.config\/gcloud|~\/\.npmrc|~\/\.netrc)/i,
  /(?:read|cat|print|output|exfiltrate| dump|send|encode)\s+(?:all\s+|the\s+)?(?:contents?\s+of\s+)?(?:\.env(?:\.local|\.production)?)\b(?!\.example|\.sample|\.template)/i,
  /(?:~\/\.ssh\/id_rsa|~\/\.ssh\/id_ed25519|~\/\.aws\/credentials|\/etc\/shadow)/i,
];

const EXFIL_SINK_PATTERNS = [
  /\b(?:curl|wget)\b[^\n]{0,160}(?:-d\s|--data|--post-data|\$\(|\$\{?[A-Za-z_][A-Za-z0-9_]{2,})/i,
  /https?:\/\/[^\s"'<>]{4,120}[?&](?:key|token|secret|env|data|payload)=\s*(?:\$\{?[A-Za-z0-9_]+|<)/i,
  /(?:send|post|upload|transmit|append)\s+(?:the\s+)?(?:env|secret|token|key|credentials|file\s+contents)\s+to\s+https?:\/\//i,
];

export const EXF_001_SECRET_READ: RuleDefinition = {
  id: 'EXF-001',
  family: 'EXF',
  title: 'Directive to Read Sensitive Credential Files',
  severity: 'critical',
  description:
    'Text instructs an agent or shell to read local secrets (.env, ~/.ssh private keys, ~/.aws/credentials, or cloud auth stores).',
  remediation:
    'Remove instructions or commands referencing private SSH keys, cloud credential paths, or reading raw .env secrets.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      // Ignore standard setup docs like "cp .env.example .env"
      if (/\bcp\s+\.env\.(?:example|sample|template)\s+\.env\b/i.test(line)) {
        continue;
      }
      for (const regex of CREDENTIAL_READ_PATTERNS) {
        const m = regex.exec(line);
        if (m) {
          findings.push(
            createFinding(EXF_001_SECRET_READ, file, i + 1, m.index + 1, line)
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const EXF_002_EXTERNAL_TRANSMISSION: RuleDefinition = {
  id: 'EXF-002',
  family: 'EXF',
  title: 'Outbound Data Exfiltration Pattern',
  severity: 'critical',
  description:
    'Text or command instructs the agent to transmit local variables, environment data, or command output to an external URL.',
  remediation:
    'Remove outbound curl/wget POST payloads, query-string variable interpolation, and instructions that send local state to external hosts.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      for (const regex of EXFIL_SINK_PATTERNS) {
        const m = regex.exec(line);
        if (m) {
          findings.push(
            createFinding(EXF_002_EXTERNAL_TRANSMISSION, file, i + 1, m.index + 1, line)
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const EXF_RULES: RuleDefinition[] = [
  EXF_001_SECRET_READ,
  EXF_002_EXTERNAL_TRANSMISSION,
];

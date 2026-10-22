import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding } from './helpers';

const OVERRIDE_PHRASES = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules|directions)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules)/i,
  /forget\s+(?:all\s+)?(?:previous|prior|earlier)\s+(?:instructions|context)/i,
  /override\s+(?:all\s+)?(?:system|safety|previous)\s+(?:instructions|rules|guidelines)/i,
];

const STEALTH_PHRASES = [
  /do\s+not\s+(?:tell|inform|mention\s+to|alert)\s+the\s+(?:user|developer|human)/i,
  /never\s+(?:tell|mention\s+to|inform)\s+the\s+(?:user|developer|human)/i,
  /without\s+(?:telling|informing|asking)\s+the\s+(?:user|developer|human)/i,
  /hide\s+this\s+(?:action|command|step|instruction)\s+from\s+the\s+user/i,
  /keep\s+this\s+(?:secret|hidden)\s+from\s+the\s+user/i,
];

const IMPERSONATION_PHRASES = [
  /\byou\s+are\s+now\s+(?:in\s+)?(?:developer\s+mode|unrestricted|an?\s+autonomous|bound\s+by\s+new)/i,
  /<\s*(?:system_prompt|system_instruction|claude_instruction|cursor_override)\s*>/i,
  /\[\s*(?:SYSTEM\s+INSTRUCTION|SYSTEM\s+OVERRIDE|ADMIN\s+DIRECTIVE)\s*\]/i,
  /IMPORTANT\s+AI\s+INSTRUCTION\s*:/i,
];

export const INJ_001_OVERRIDE: RuleDefinition = {
  id: 'INJ-001',
  family: 'INJ',
  title: 'Direct Prompt Instruction Override',
  severity: 'critical',
  description:
    'Text explicitly instructs an AI coding agent to ignore, disregard, or override previous instructions or safety rules.',
  remediation:
    'Remove prompt-override phrasing from documentation, comments, rules files, and templates.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      for (const regex of OVERRIDE_PHRASES) {
        const m = regex.exec(line);
        if (m) {
          findings.push(
            createFinding(INJ_001_OVERRIDE, file, i + 1, m.index + 1, line)
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const INJ_002_STEALTH: RuleDefinition = {
  id: 'INJ-002',
  family: 'INJ',
  title: 'Deceptive "Do Not Tell the User" Directive',
  severity: 'critical',
  description:
    'Content instructs the AI agent to conceal its actions, output, or side effects from the human user.',
  remediation:
    'Remove any directive that tells an AI assistant to withhold information from the user.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      for (const regex of STEALTH_PHRASES) {
        const m = regex.exec(line);
        if (m) {
          findings.push(
            createFinding(INJ_002_STEALTH, file, i + 1, m.index + 1, line)
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const INJ_003_IMPERSONATION: RuleDefinition = {
  id: 'INJ-003',
  family: 'INJ',
  title: 'System Prompt or Role Impersonation',
  severity: 'high',
  description:
    'Fake system tags (<system_instruction>, [SYSTEM OVERRIDE]) or role-reassignment commands attempt to spoof privileged authority inside untrusted repository text.',
  remediation:
    'Remove pseudo-system tags and role-hijacking blocks from repository files.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      for (const regex of IMPERSONATION_PHRASES) {
        const m = regex.exec(line);
        if (m) {
          findings.push(
            createFinding(INJ_003_IMPERSONATION, file, i + 1, m.index + 1, line)
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const INJ_RULES: RuleDefinition[] = [
  INJ_001_OVERRIDE,
  INJ_002_STEALTH,
  INJ_003_IMPERSONATION,
];

import {
  adjustSeverityByContext,
  classifyFileContext,
} from '../context';
import { Finding, RuleDefinition, ScannedFileInput } from '../types';

/**
 * Truncates a line or excerpt safely for display without executing or interpreting anything.
 */
export function formatSnippet(rawLine: string, maxLen = 180): string {
  const trimmed = rawLine.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen)}…`;
}

/**
 * Redacts a secret string so only a short prefix and suffix remain visible.
 */
export function redactSecretValue(secret: string): string {
  if (secret.length <= 8) {
    return '••••••••';
  }
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-2);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Replaces any obvious token/key patterns in an arbitrary snippet with redacted masks.
 */
export function redactSecretsInText(text: string): string {
  return text
    .replace(/\b(sk-[a-zA-Z0-9_-]{16,})\b/g, (m) => redactSecretValue(m))
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{20,})\b/g, (m) => redactSecretValue(m))
    .replace(/\b(github_pat_[A-Za-z0-9_]{20,})\b/g, (m) => redactSecretValue(m))
    .replace(/\b(AKIA[0-9A-Z]{16})\b/g, (m) => redactSecretValue(m))
    .replace(/\b(AIza[0-9A-Za-z_-]{35})\b/g, (m) => redactSecretValue(m))
    .replace(/\b(xox[baprs]-[0-9A-Za-z-]{16,})\b/g, (m) => redactSecretValue(m));
}

/**
 * Builds a Finding object from a RuleDefinition, classifying file context
 * and adjusting severity deterministically by context.
 */
export function createFinding(
  rule: Omit<RuleDefinition, 'evaluate'>,
  file: ScannedFileInput,
  line: number,
  column: number,
  snippet: string,
  options?: {
    customDescription?: string;
    decodedText?: string;
  }
): Finding {
  const safeSnippet = formatSnippet(redactSecretsInText(snippet));
  const context = classifyFileContext(file.path, file.content);
  const adjustedSeverity = adjustSeverityByContext(
    rule.severity,
    rule.family,
    rule.id,
    context,
    snippet,
    file.content
  );
  const whyItMatters = options?.customDescription ?? rule.description;
  const howToFix = rule.remediation;

  return {
    id: `${rule.id}:${file.path}:${line}:${column}`,
    ruleId: rule.id,
    family: rule.family,
    title: rule.title,
    severity: adjustedSeverity,
    filePath: file.path,
    context,
    line,
    column,
    description: whyItMatters,
    whyItMatters,
    remediation: howToFix,
    howToFix,
    snippet: safeSnippet,
    ...(options?.decodedText ? { decodedText: options.decodedText } : {}),
  };
}

/**
 * Returns true if the file is an agent instruction file, documentation file,
 * issue template, or config file that coding agents read directly as instructions.
 */
export function isAgentFacingFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.mdc') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.rst') ||
    lower.includes('agents') ||
    lower.includes('claude') ||
    lower.includes('gemini') ||
    lower.includes('.cursorrules') ||
    lower.includes('.cursor/rules') ||
    lower.includes('copilot-instructions') ||
    lower.includes('.windsurfrules') ||
    lower.includes('.clinerules') ||
    lower.includes('.github/issue_template') ||
    lower.includes('pull_request_template') ||
    lower === 'pasted-input.txt'
  );
}

/**
 * Returns true if the text contains imperative agent-targeted instruction vocabulary.
 */
export function hasInstructionKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'ignore previous',
    'ignore all previous',
    'disregard previous',
    'system prompt',
    'you are an ai',
    'you are now',
    'ai assistant',
    'coding agent',
    'do not tell the user',
    'do not mention',
    'without telling the user',
    'run the command',
    'execute the following',
    'print the word',
    'output the word',
    'canary-',
    'curl ',
    'wget ',
    '.env',
    '~/.ssh',
    'important instruction',
    'override',
  ];
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      return true;
    }
  }
  return false;
}

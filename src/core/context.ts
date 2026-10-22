import { RuleFamily, Severity } from './types';

export type FileContextType =
  | 'mcp-config'
  | 'agent-instructions'
  | 'agent-skill'
  | 'docs'
  | 'generic';

/**
 * Classifies a file path and content into one of the 5 security contexts:
 * - mcp-config: MCP server definitions (.mcp.json, .cursor/mcp.json, claude_desktop_config.json)
 * - agent-instructions: Files read directly as system/project instructions by coding agents
 *   (AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, .cursor/rules/*, .windsurfrules, copilot-instructions.md)
 * - agent-skill: Skill definitions and prompt templates (SKILL.md, .claude/commands/*, .github/prompts/*)
 * - docs: General human documentation, security docs, and README files (README.md, docs/*, SECURITY.md)
 * - generic: Source code, package manifests, tasks, and other repository files
 */
export function classifyFileContext(
  filePath: string,
  content = ''
): FileContextType {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const baseName = normalized.split('/').pop() ?? normalized;

  // 1. MCP config files
  if (
    baseName === 'mcp.json' ||
    baseName === '.mcp.json' ||
    baseName === 'claude_desktop_config.json' ||
    normalized.endsWith('/mcp.json') ||
    normalized.includes('.cursor/mcp') ||
    (normalized.endsWith('.json') && content.includes('"mcpServers"'))
  ) {
    return 'mcp-config';
  }

  // 2. Agent Skill files
  if (
    baseName === 'skill.md' ||
    normalized.includes('/skills/') ||
    normalized.includes('.claude/commands/') ||
    normalized.includes('.github/prompts/') ||
    normalized.includes('.cursor/skills/')
  ) {
    return 'agent-skill';
  }

  // 3. Dedicated Agent Instructions files
  if (
    baseName === 'agents.md' ||
    baseName === 'claude.md' ||
    baseName === 'gemini.md' ||
    baseName === '.cursorrules' ||
    baseName === '.windsurfrules' ||
    baseName === '.clinerules' ||
    baseName === 'copilot-instructions.md' ||
    normalized.includes('.cursor/rules/') ||
    normalized.includes('.github/copilot-instructions')
  ) {
    return 'agent-instructions';
  }

  // 4. Documentation files (README, docs/, SECURITY.md, THREAT_MODEL.md, etc.)
  if (
    normalized.endsWith('.md') ||
    normalized.endsWith('.mdx') ||
    normalized.endsWith('.rst') ||
    normalized.endsWith('.txt') ||
    normalized.startsWith('docs/') ||
    normalized.includes('/docs/')
  ) {
    return 'docs';
  }

  return 'generic';
}

/**
 * Returns true if a line in a documentation file appears to be an educational/defensive
 * discussion about prompt injection (e.g., inside a markdown table row, quoting examples,
 * or prefixed with defensive explanation terms) rather than an active concealed attack.
 */
export function isEducationalDocLine(line: string, fullContent: string): boolean {
  const trimmed = line.trim();
  // Markdown table row describing rules or attacks
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    return true;
  }
  const lowerLine = trimmed.toLowerCase();
  if (
    lowerLine.includes('for example') ||
    lowerLine.includes('e.g.') ||
    lowerLine.includes('such as') ||
    lowerLine.includes('attackers may') ||
    lowerLine.includes('attackers can') ||
    lowerLine.includes('detects phrases like') ||
    lowerLine.includes('rule family') ||
    lowerLine.includes('threat model') ||
    lowerLine.includes('false positive')
  ) {
    return true;
  }
  // Check if the document itself is explicitly an educational guide about prompt injection
  const lowerDoc = fullContent.slice(0, 1500).toLowerCase();
  const isSecurityDoc =
    lowerDoc.includes('threat model') ||
    lowerDoc.includes('security policy') ||
    lowerDoc.includes('understanding prompt injection') ||
    lowerDoc.includes('defending against prompt injection') ||
    lowerDoc.includes('how repocanary works');

  return isSecurityDoc;
}

/**
 * Adjusts finding severity based on file context.
 * - In `agent-instructions`, `agent-skill`, and `mcp-config`: severity is kept at maximum
 *   (or elevated from medium to high for INJ/HID/EXF).
 * - In `docs`: plain-text phrasing matches (INJ, EXF) that occur in educational/defensive
 *   documentation context are downgraded to `low` or `medium` so security docs about
 *   prompt injection never produce false-positive High/Critical alerts.
 *   Note: Active steganography (UNI-002 Unicode Tag smuggling, UNI-003 Bidi overrides,
 *   HID-001 hidden HTML comment injections, HID-002 display:none) remains High/Critical
 *   unless explicitly educational.
 */
export function adjustSeverityByContext(
  baseSeverity: Severity,
  family: RuleFamily,
  ruleId: string,
  context: FileContextType,
  line: string,
  fullContent: string
): Severity {
  if (
    context === 'agent-instructions' ||
    context === 'agent-skill' ||
    context === 'mcp-config'
  ) {
    if (baseSeverity === 'medium' && (family === 'INJ' || family === 'EXF')) {
      return 'high';
    }
    return baseSeverity;
  }

  if (context === 'docs') {
    const educational = isEducationalDocLine(line, fullContent);
    if (educational && (family === 'INJ' || family === 'EXF' || ruleId === 'HID-003')) {
      return 'low';
    }
    // Plain visible prose in general docs (not hidden in HTML comments or Unicode tags)
    if (
      (family === 'INJ' || ruleId === 'EXF-001') &&
      !line.includes('<!--') &&
      !line.includes('display:none') &&
      educational
    ) {
      return 'low';
    }
  }

  return baseSeverity;
}

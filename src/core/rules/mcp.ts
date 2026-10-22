import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding, hasInstructionKeywords } from './helpers';

function isMcpOrAgentConfigFile(path: string, content: string): boolean {
  const lower = path.toLowerCase();
  if (
    lower.includes('mcp') ||
    lower.endsWith('claude_desktop_config.json') ||
    lower.endsWith('.cursor/mcp.json') ||
    lower.endsWith('.vscode/mcp.json') ||
    lower.endsWith('settings.json')
  ) {
    return true;
  }
  return lower.endsWith('.json') && content.includes('"mcpServers"');
}

/**
 * Linear-time check for unpinned npx/uvx package arguments on a single line.
 * Avoids overlapping quantifiers to guarantee O(N) execution.
 */
function hasUnpinnedMcpPackageOnLine(line: string): boolean {
  if (line.includes('"-y"') || line.includes("'--yes'") || line.includes('"--yes"')) {
    return true;
  }
  const lower = line.toLowerCase();
  if (!lower.includes('npx') && !lower.includes('uvx')) {
    return false;
  }
  // Extract quoted or whitespace-separated tokens and check if a scoped package lacks @version after the slash
  const tokens = line.split(/[\s,"'\][]+/);
  for (const tok of tokens) {
    if (!tok || tok === 'npx' || tok === 'uvx' || tok === '-y') continue;
    const slashIdx = tok.indexOf('/');
    if (slashIdx > 0 && slashIdx < tok.length - 1) {
      const afterSlash = tok.slice(slashIdx + 1);
      // If it looks like @scope/pkg or owner/pkg and has no '@' version pin in the package name
      if (/^[a-zA-Z0-9._-]+$/.test(afterSlash) && !afterSlash.includes('@')) {
        return true;
      }
    }
  }
  return false;
}

export const MCP_001_UNPINNED_PKG: RuleDefinition = {
  id: 'MCP-001',
  family: 'MCP',
  title: 'Unpinned npx/uvx Package in MCP Configuration',
  severity: 'high',
  description:
    'An MCP server config runs npx (especially with -y) or uvx without pinning an exact version, allowing upstream registry changes or typosquats to execute arbitrary code.',
  remediation:
    'Pin MCP server packages to an explicit version (e.g., package@1.2.3) or run a locally audited entry point.',
  evaluate(file: ScannedFileInput): Finding[] {
    if (!isMcpOrAgentConfigFile(file.path, file.content)) {
      return [];
    }
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      if (hasUnpinnedMcpPackageOnLine(line)) {
        findings.push(createFinding(MCP_001_UNPINNED_PKG, file, i + 1, 1, line));
      }
    }

    return findings;
  },
};

export const MCP_002_PLAIN_HTTP: RuleDefinition = {
  id: 'MCP-002',
  family: 'MCP',
  title: 'Insecure Plain-HTTP Remote MCP Server',
  severity: 'high',
  description:
    'An MCP configuration connects to a non-localhost remote endpoint over unencrypted HTTP, exposing tool calls and prompts to network interception and tampering.',
  remediation:
    'Use HTTPS (https://) for all remote MCP servers, or restrict plain HTTP strictly to 127.0.0.1 / localhost.',
  evaluate(file: ScannedFileInput): Finding[] {
    if (!isMcpOrAgentConfigFile(file.path, file.content)) {
      return [];
    }
    const findings: Finding[] = [];
    const lines = file.content.split('\n');
    const httpRegex = /http:\/\/(?!(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b)[a-zA-Z0-9.-]+/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      const m = httpRegex.exec(line);
      if (m) {
        findings.push(
          createFinding(MCP_002_PLAIN_HTTP, file, i + 1, m.index + 1, line)
        );
      }
    }

    return findings;
  },
};

export const MCP_003_BROAD_SHELL_OR_ROOT: RuleDefinition = {
  id: 'MCP-003',
  family: 'MCP',
  title: 'MCP Shell Wrapper or Overly Broad Filesystem Root',
  severity: 'critical',
  description:
    'An MCP server invokes a raw shell wrapper (sh -c, bash -c, cmd /c) or mounts the entire filesystem or home directory ("/", "~", "/Users", "/home").',
  remediation:
    'Restrict filesystem MCP servers to the project workspace directory and avoid passing arbitrary shell command wrappers.',
  evaluate(file: ScannedFileInput): Finding[] {
    if (!isMcpOrAgentConfigFile(file.path, file.content)) {
      return [];
    }
    const findings: Finding[] = [];
    const lines = file.content.split('\n');
    const riskyPattern =
      /(?:"(?:sh|bash|zsh|cmd(?:\.exe)?|powershell)"\s*,\s*[^\n]{0,40}"(?:-c|\/c)"|"(?:\/|~|\/Users|\/home|C:\\\\)"\s*(?:,|\]))/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      const m = riskyPattern.exec(line);
      if (m) {
        findings.push(
          createFinding(MCP_003_BROAD_SHELL_OR_ROOT, file, i + 1, m.index + 1, line)
        );
      }
    }

    return findings;
  },
};

export const MCP_004_TOOL_POISONING: RuleDefinition = {
  id: 'MCP-004',
  family: 'MCP',
  title: 'Poisoned MCP Tool Description',
  severity: 'critical',
  description:
    'An MCP tool description contains hidden agent instructions, prompt overrides, or covert side-effect directives ("tool poisoning").',
  remediation:
    'Audit tool descriptions so they contain only declarative parameter/behavior summaries, never imperative instructions.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');
    const descRegex = /"(?:description|toolDescription|systemPrompt)"\s*:\s*"([^"\n]{10,800})"/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      const m = descRegex.exec(line);
      if (m && hasInstructionKeywords(m[1])) {
        findings.push(
          createFinding(MCP_004_TOOL_POISONING, file, i + 1, m.index + 1, line, {
            decodedText: m[1],
          })
        );
      }
    }

    return findings;
  },
};

export const MCP_RULES: RuleDefinition[] = [
  MCP_001_UNPINNED_PKG,
  MCP_002_PLAIN_HTTP,
  MCP_003_BROAD_SHELL_OR_ROOT,
  MCP_004_TOOL_POISONING,
];

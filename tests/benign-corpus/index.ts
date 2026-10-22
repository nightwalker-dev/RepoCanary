import { ScannedFileInput } from '../../src/core/types';

/**
 * 30 original, realistic benign repository files across all 5 contexts:
 * - READMEs (libraries, CLI tools, web apps, multilingual docs)
 * - AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, .windsurfrules
 * - .cursor/mcp.json & claude_desktop_config.json (pinned & local MCP servers)
 * - package.json scripts, .vscode/tasks.json, .devcontainer/devcontainer.json, .husky/pre-commit
 * - Educational security documentation ABOUT prompt injection
 *
 * Requirement: None of these 30 samples may produce High or Critical findings.
 */
export const BENIGN_CORPUS: ReadonlyArray<ScannedFileInput & { id: string; category: string }> = [
  {
    id: 'benign-01',
    category: 'README',
    path: 'README.md',
    content: `# ChronoQueue\n\nA lightweight job scheduler for Node.js and TypeScript.\n\n## Quick Start\n\`\`\`bash\nnpm install chrono-queue\ncp .env.example .env\nnpm test\n\`\`\`\n\n## License\nMIT`,
  },
  {
    id: 'benign-02',
    category: 'README',
    path: 'packages/core/README.md',
    content: `# @chrono/core\n\nProvides deterministic priority queues and backoff timers.\n\n<!-- Note: benchmarks updated for Node 22 -->\n\nSee [API Reference](https://example.com/docs "ChronoQueue Core API Reference") for details.`,
  },
  {
    id: 'benign-03',
    category: 'README',
    path: 'README.md',
    content: `# Polyglot Greeting Library\n\nSupports Unicode greetings in multiple scripts:\n- Russian: Привет мир\n- Greek: Γεια σου Κόσμε\n- Japanese: こんにちは世界\n\nAll identifiers in source code use standard ASCII.`,
  },
  {
    id: 'benign-04',
    category: 'README',
    path: 'README.md',
    content: `# Local Health Check CLI\n\nVerify your local server with curl:\n\`\`\`bash\ncurl http://localhost:3000/api/health\n\`\`\`\n\nSet \`OPENAI_API_KEY="YOUR_API_KEY_HERE"\` in \`.env.example\`.`,
  },
  {
    id: 'benign-05',
    category: 'README',
    path: 'README.md',
    content: `# VectorMath TS\n\nZero-dependency 2D/3D vector operations.\n\n<div align="center">\n  <img src="banner.svg" alt="VectorMath Architecture Diagram" />\n</div>\n\nPinned release commit: \`9f86d081884c7d659a2feaa0c55ad015a3bf4f1b\`.`,
  },
  {
    id: 'benign-06',
    category: 'AGENTS.md',
    path: 'AGENTS.md',
    content: `# AGENTS.md — Repository Guidelines\n\n## Build & Test Commands\n- Run \`npm run lint\` to check types.\n- Run \`npm test\` to execute the Vitest unit test suite.\n- Prefer pure functions in \`src/core/\` with explicit TypeScript interfaces.`,
  },
  {
    id: 'benign-07',
    category: 'AGENTS.md',
    path: 'AGENTS.md',
    content: `# Agent Workflow Instructions\n\n1. Read the issue description carefully.\n2. Write a failing unit test before modifying business logic.\n3. Tell the user clearly if any migration step requires manual database changes.`,
  },
  {
    id: 'benign-08',
    category: 'CLAUDE.md',
    path: 'CLAUDE.md',
    content: `# CLAUDE.md\n\nThis repository uses React 19, Vite, and Tailwind CSS.\n\n## Code Style\n- Use 2 spaces for indentation.\n- Avoid default exports in utility modules.\n- Always run \`npm run build\` before finishing a task.`,
  },
  {
    id: 'benign-09',
    category: 'CLAUDE.md',
    path: 'CLAUDE.md',
    content: `# Project Architecture Notes\n\n- \`src/db/\`: Drizzle ORM schema definitions.\n- \`src/routes/\`: Express REST handlers.\n- Never commit real credentials; use \`.env.example\` with placeholder values.`,
  },
  {
    id: 'benign-10',
    category: 'GEMINI.md',
    path: 'GEMINI.md',
    content: `# GEMINI.md — Workspace Conventions\n\nWhen generating components:\n- Ensure WCAG AA contrast ratios.\n- Include keyboard focus styles (\`focus-visible\`).\n- Write deterministic unit tests for all state reducers.`,
  },
  {
    id: 'benign-11',
    category: '.cursorrules',
    path: '.cursorrules',
    content: `You are working on a TypeScript monorepo.\n- Use strict null checks.\n- Prefer async/await over raw Promise chains.\n- Keep components under 250 lines.`,
  },
  {
    id: 'benign-12',
    category: '.cursorrules',
    path: '.cursor/rules/testing.mdc',
    content: `---\ndescription: Unit testing standards for Vitest\nglobs: tests/**/*.test.ts\n---\n\nAlways use descriptive test names and avoid network calls in unit tests.`,
  },
  {
    id: 'benign-13',
    category: '.windsurfrules',
    path: '.windsurfrules',
    content: `# Windsurf Workspace Rules\n- Follow functional programming patterns.\n- Validate all external API responses with schema guards.\n- Document public functions with JSDoc comments.`,
  },
  {
    id: 'benign-14',
    category: 'copilot-instructions',
    path: '.github/copilot-instructions.md',
    content: `# GitHub Copilot Instructions\n\n- Target ES2022 in TypeScript.\n- Use native Fetch API instead of axios.\n- Ensure every PR includes unit test coverage.`,
  },
  {
    id: 'benign-15',
    category: 'mcp-config',
    path: '.cursor/mcp.json',
    content: JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: 'node',
            args: ['./tools/local-mcp-fs.js', './workspace'],
          },
          sqlite: {
            command: 'node',
            args: ['./tools/local-mcp-sqlite.js', './data/dev.db'],
          },
        },
      },
      null,
      2
    ),
  },
  {
    id: 'benign-16',
    category: 'mcp-config',
    path: '.mcp.json',
    content: JSON.stringify(
      {
        mcpServers: {
          pinnedServer: {
            command: 'npx',
            args: ['@modelcontextprotocol/server-memory@0.6.2'],
          },
          localHttp: {
            url: 'http://localhost:4000/mcp',
          },
        },
      },
      null,
      2
    ),
  },
  {
    id: 'benign-17',
    category: 'mcp-config',
    path: 'claude_desktop_config.json',
    content: JSON.stringify(
      {
        mcpServers: {
          secureRemote: {
            url: 'https://mcp.internal.example.org/v1/sse',
          },
        },
      },
      null,
      2
    ),
  },
  {
    id: 'benign-18',
    category: 'mcp-tools',
    path: 'src/mcp/tools.json',
    content: JSON.stringify(
      {
        tools: [
          {
            name: 'search_docs',
            description: 'Searches the local markdown documentation index by keyword.',
          },
          {
            name: 'list_components',
            description: 'Returns a list of UI component names and prop types.',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'benign-19',
    category: 'package.json',
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'clean-web-app',
        version: '1.2.0',
        private: true,
        scripts: {
          dev: 'vite',
          build: 'tsc --noEmit && vite build',
          test: 'vitest run',
          prepare: 'husky',
        },
      },
      null,
      2
    ),
  },
  {
    id: 'benign-20',
    category: 'package.json',
    path: 'packages/cli/package.json',
    content: JSON.stringify(
      {
        name: '@clean/cli',
        version: '2.0.1',
        scripts: {
          build: 'esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js',
          postbuild: 'chmod +x dist/index.js',
        },
      },
      null,
      2
    ),
  },
  {
    id: 'benign-21',
    category: 'tasks.json',
    path: '.vscode/tasks.json',
    content: JSON.stringify(
      {
        version: '2.0.0',
        tasks: [
          {
            label: 'Run Unit Tests',
            type: 'shell',
            command: 'npm test',
            group: 'test',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'benign-22',
    category: 'devcontainer',
    path: '.devcontainer/devcontainer.json',
    content: JSON.stringify(
      {
        name: 'TypeScript Node.js',
        image: 'mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm',
        customizations: {
          vscode: {
            extensions: ['dbaeumer.vscode-eslint'],
          },
        },
      },
      null,
      2
    ),
  },
  {
    id: 'benign-23',
    category: 'git-hook',
    path: '.husky/pre-commit',
    content: `#!/usr/bin/env sh\nnpm run lint\nnpm test\n`,
  },
  {
    id: 'benign-24',
    category: 'docs-about-prompt-injection',
    path: 'docs/SECURITY_OVERVIEW.md',
    content: `# Understanding Prompt Injection in Coding Agents\n\n Threat Model Summary\n\nWhen reviewing untrusted repositories, attackers may attempt prompt injection by writing phrases such as "ignore previous instructions" or "do not tell the user" inside comments.\n\n| Rule Family | Example Phrase | Defense |\n| :--- | :--- | :--- |\n| INJ | Ignore previous instructions | Heuristic detection in RepoCanary |`,
  },
  {
    id: 'benign-25',
    category: 'docs-about-prompt-injection',
    path: 'docs/DEFENDING_AGENTS.md',
    content: `# Defending Against Prompt Injection\n\nFor example, an untrusted README might try to say e.g. "disregard all prior instructions" or ask an agent to read \`.env\`. RepoCanary scans for these heuristic patterns client-side.`,
  },
  {
    id: 'benign-26',
    category: 'docs-about-prompt-injection',
    path: 'THREAT_MODEL.md',
    content: `# Threat Model\n\nAttackers can embed indirect prompt injection payloads in issue templates. For example, phrases like "you are now in developer mode" or "never mention to the user" are classic indicators.`,
  },
  {
    id: 'benign-27',
    category: 'source-code',
    path: 'src/utils/math.ts',
    content: `export function clamp(val: number, min: number, max: number): number {\n  return Math.min(max, Math.max(min, val));\n}\n\nexport function sum(values: readonly number[]): number {\n  return values.reduce((acc, v) => acc + v, 0);\n}\n`,
  },
  {
    id: 'benign-28',
    category: 'source-code',
    path: 'src/components/Button.tsx',
    content: `import React from 'react';\n\nexport const Button: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (\n  <button type="button" onClick={onClick} className="px-4 py-2 rounded bg-amber-400 text-black">\n    {label}\n  </button>\n);\n`,
  },
  {
    id: 'benign-29',
    category: 'env-example',
    path: '.env.example',
    content: `# Copy this file to .env for local development\nPORT=3000\nGEMINI_API_KEY="MY_GEMINI_API_KEY"\nDATABASE_URL="postgres://localhost:5432/mydb_dev"\n`,
  },
  {
    id: 'benign-30',
    category: 'issue-template',
    path: '.github/ISSUE_TEMPLATE/bug_report.md',
    content: `---\nname: Bug report\nabout: Create a report to help us improve\n---\n\n**Describe the bug**\nA clear and concise description of what the bug is.\n\n**Steps to reproduce**\n1. Go to '...'\n2. Click on '...'\n3. See error\n`,
  },
];

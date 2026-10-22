import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding } from './helpers';

export const EXEC_001_NPM_INSTALL_HOOK: RuleDefinition = {
  id: 'EXEC-001',
  family: 'EXEC',
  title: 'Risky package.json Install Hook',
  severity: 'critical',
  description:
    'A package.json lifecycle hook (preinstall, install, postinstall, prepare) runs network requests, pipes output to a shell, or executes inline encoded scripts.',
  remediation:
    'Inspect or remove preinstall/postinstall scripts before running npm/yarn/pnpm/bun install.',
  evaluate(file: ScannedFileInput): Finding[] {
    const lower = file.path.toLowerCase();
    if (!lower.endsWith('package.json')) {
      return [];
    }
    const findings: Finding[] = [];
    const lines = file.content.split('\n');
    const hookRegex =
      /"(?:preinstall|install|postinstall|preuninstall|prepare)"\s*:\s*"([^"\n]{3,600})"/i;
    const dangerAction =
      /\b(?:curl|wget|nc|netcat|bash|sh\s+-c|node\s+-e|python[23]?\s+-c|powershell|eval|base64)\b|\|\s*(?:sh|bash|zsh)\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      const m = hookRegex.exec(line);
      if (m && dangerAction.test(m[1])) {
        findings.push(
          createFinding(EXEC_001_NPM_INSTALL_HOOK, file, i + 1, m.index + 1, line)
        );
      }
    }

    return findings;
  },
};

export const EXEC_002_VSCODE_AUTO_TASK: RuleDefinition = {
  id: 'EXEC-002',
  family: 'EXEC',
  title: 'VS Code Task Auto-Execution on Folder Open',
  severity: 'critical',
  description:
    'A .vscode/tasks.json file defines "runOn": "folderOpen", which automatically executes commands as soon as the workspace is opened in VS Code or Cursor.',
  remediation:
    'Remove "runOn": "folderOpen" from .vscode/tasks.json and audit the associated task command.',
  evaluate(file: ScannedFileInput): Finding[] {
    const lower = file.path.toLowerCase();
    if (!lower.endsWith('tasks.json')) {
      return [];
    }
    const findings: Finding[] = [];
    const lines = file.content.split('\n');
    const autoRunRegex = /"runOn"\s*:\s*"folderOpen"/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      const m = autoRunRegex.exec(line);
      if (m) {
        findings.push(
          createFinding(EXEC_002_VSCODE_AUTO_TASK, file, i + 1, m.index + 1, line)
        );
      }
    }

    return findings;
  },
};

export const EXEC_003_DEVCONTAINER_OR_GIT_HOOK: RuleDefinition = {
  id: 'EXEC-003',
  family: 'EXEC',
  title: 'Auto-Run Devcontainer Command or Git Hook',
  severity: 'high',
  description:
    'A devcontainer configuration (postCreateCommand, initializeCommand) or Git/Husky hook automatically runs shell or network commands.',
  remediation:
    'Verify all commands in devcontainer.json and .husky / .git/hooks before opening or committing in the repository.',
  evaluate(file: ScannedFileInput): Finding[] {
    const lower = file.path.toLowerCase();
    const isDevcontainer = lower.endsWith('devcontainer.json');
    const isGitHook =
      lower.includes('.husky/') || lower.includes('.git/hooks/') || lower.includes('githooks/');

    if (!isDevcontainer && !isGitHook) {
      return [];
    }

    const findings: Finding[] = [];
    const lines = file.content.split('\n');
    const devcontainerRegex =
      /"(?:postCreateCommand|postStartCommand|initializeCommand|onCreateCommand)"\s*:\s*"([^"\n]{3,600})"/i;
    const hookCommandRegex = /\b(?:curl|wget|bash\s+-c|sh\s+-c|nc|python[23]?\s+-c|node\s+-e)\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;

      if (isDevcontainer) {
        const m = devcontainerRegex.exec(line);
        if (m) {
          findings.push(
            createFinding(EXEC_003_DEVCONTAINER_OR_GIT_HOOK, file, i + 1, m.index + 1, line)
          );
        }
      } else if (isGitHook) {
        const m = hookCommandRegex.exec(line);
        if (m) {
          findings.push(
            createFinding(EXEC_003_DEVCONTAINER_OR_GIT_HOOK, file, i + 1, m.index + 1, line)
          );
        }
      }
    }

    return findings;
  },
};

export const EXEC_RULES: RuleDefinition[] = [
  EXEC_001_NPM_INSTALL_HOOK,
  EXEC_002_VSCODE_AUTO_TASK,
  EXEC_003_DEVCONTAINER_OR_GIT_HOOK,
];

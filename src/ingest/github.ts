import { SCAN_LIMITS } from '../config';
import { ScannedFileInput } from '../core/types';
import { IngestResult, sanitizeDisplayPath } from './paste';
import { hasBinaryExtension } from './zip';

/**
 * Strict allowlist regex for public GitHub repository URLs:
 * https://github.com/{owner}/{repo} (with optional trailing slash)
 */
export const GITHUB_REPO_ALLOWLIST_RE =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})\/?$/;

export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
}

/**
 * Validates and parses a public GitHub URL against the strict allowlist.
 * Rejects non-HTTPS, other hosts, subpaths, query strings, or credentials.
 */
export function parseGitHubRepoUrl(url: string): ParsedGitHubRepo | null {
  const trimmed = url.trim();
  const match = GITHUB_REPO_ALLOWLIST_RE.exec(trimmed);
  if (!match) {
    return null;
  }
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, '');
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..' || !repo) {
    return null;
  }
  return { owner, repo };
}

/**
 * Prioritizes agent-facing files, configs, and source files from a Git tree.
 */
export function isRelevantRepoTextFile(path: string): boolean {
  if (hasBinaryExtension(path)) return false;
  const lower = path.toLowerCase();
  if (
    lower.includes('node_modules/') ||
    lower.includes('vendor/') ||
    lower.includes('dist/') ||
    lower.includes('build/') ||
    lower.endsWith('.min.js') ||
    lower.endsWith('.min.css') ||
    lower.endsWith('package-lock.json') ||
    lower.endsWith('yarn.lock') ||
    lower.endsWith('pnpm-lock.yaml')
  ) {
    return false;
  }

  const relevantNames = [
    'readme',
    'agents.md',
    'claude.md',
    'gemini.md',
    '.cursorrules',
    '.windsurfrules',
    '.clinerules',
    'copilot-instructions.md',
    'mcp.json',
    'package.json',
    'tasks.json',
    'devcontainer.json',
    'security.md',
    'contributing.md',
  ];
  for (const name of relevantNames) {
    if (lower.includes(name)) return true;
  }

  const textExts = [
    '.md',
    '.mdc',
    '.txt',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.sh',
    '.bash',
    '.zsh',
    '.rb',
    '.go',
    '.rs',
    '.html',
    '.env',
    '.example',
  ];
  return textExts.some((ext) => lower.endsWith(ext));
}

function scoreFilePriority(path: string): number {
  const lower = path.toLowerCase();
  if (
    lower.includes('agents.md') ||
    lower.includes('claude.md') ||
    lower.includes('gemini.md') ||
    lower.includes('.cursorrules') ||
    lower.includes('.cursor/rules') ||
    lower.includes('.windsurfrules') ||
    lower.includes('copilot-instructions') ||
    lower.includes('mcp')
  ) {
    return 100;
  }
  if (
    lower === 'readme.md' ||
    lower.endsWith('/readme.md') ||
    lower.endsWith('package.json') ||
    lower.endsWith('tasks.json') ||
    lower.endsWith('devcontainer.json') ||
    lower.includes('.husky/') ||
    lower.includes('.github/')
  ) {
    return 80;
  }
  if (lower.endsWith('.md') || lower.endsWith('.json')) {
    return 50;
  }
  return 10;
}

interface GitTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
}

/**
 * Fetches text files from a public GitHub repository using only the allowlisted
 * api.github.com and raw.githubusercontent.com endpoints.
 * Enforces host verification so redirects to external hosts are rejected.
 */
export async function ingestGitHubRepo(
  repoUrl: string,
  options?: {
    maxFilesToFetch?: number;
    onProgress?: (detail: string) => void;
    onNetworkRequest?: (method: string, url: string, status: number) => void;
  }
): Promise<IngestResult> {
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error(
      'Invalid GitHub URL. Only public repository URLs matching https://github.com/{owner}/{repo} are allowed.'
    );
  }

  const { owner, repo } = parsed;
  const maxFetch = options?.maxFilesToFetch ?? 60;
  const warnings: string[] = [];

  const metaUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  options?.onProgress?.(`Fetching repository metadata for ${owner}/${repo}`);

  const metaResp = await fetch(metaUrl, {
    headers: { Accept: 'application/vnd.github+json' },
    redirect: 'error',
  }).catch(() => {
    throw new Error(
      'Network error or disallowed redirect while reaching api.github.com.'
    );
  });

  options?.onNetworkRequest?.('GET', metaUrl, metaResp.status);

  if (metaResp.status === 403 || metaResp.status === 429) {
    throw new Error(
      'GitHub API rate limit reached (unauthenticated limit is 60 requests/hour). Download the repo as a .zip and drop it into RepoCanary to scan offline.'
    );
  }
  if (metaResp.status === 404) {
    throw new Error(
      `Repository "${owner}/${repo}" was not found or is private.`
    );
  }
  if (!metaResp.ok) {
    throw new Error(`GitHub API returned HTTP ${metaResp.status}.`);
  }

  const metaJson = (await metaResp.json()) as { default_branch?: string };
  const branch = metaJson.default_branch || 'main';

  const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  options?.onProgress?.(`Reading git tree (${branch})`);

  const treeResp = await fetch(treeUrl, {
    headers: { Accept: 'application/vnd.github+json' },
    redirect: 'error',
  }).catch(() => {
    throw new Error('Failed to fetch repository file tree from api.github.com.');
  });

  options?.onNetworkRequest?.('GET', treeUrl, treeResp.status);

  if (treeResp.status === 403 || treeResp.status === 429) {
    throw new Error(
      'GitHub API rate limit reached while reading file tree. Please drop a .zip archive instead.'
    );
  }
  if (!treeResp.ok) {
    throw new Error(`Failed to load git tree (HTTP ${treeResp.status}).`);
  }

  const treeData = (await treeResp.json()) as {
    tree?: GitTreeItem[];
    truncated?: boolean;
  };
  const rawTree = Array.isArray(treeData.tree) ? treeData.tree : [];

  if (rawTree.length > SCAN_LIMITS.MAX_FILES) {
    warnings.push(
      `Repository has ${rawTree.length} entries; capped inspection to ${SCAN_LIMITS.MAX_FILES} entries.`
    );
  }

  const blobs = rawTree
    .slice(0, SCAN_LIMITS.MAX_FILES)
    .filter((item) => item.type === 'blob' && isRelevantRepoTextFile(item.path));

  blobs.sort((a, b) => scoreFilePriority(b.path) - scoreFilePriority(a.path));

  const selectedBlobs = blobs.slice(0, maxFetch);
  let skippedCount = rawTree.length - selectedBlobs.length;

  if (blobs.length > maxFetch) {
    warnings.push(
      `Scanned top ${maxFetch} highest-priority agent/config/doc files out of ${blobs.length} text files to respect unauthenticated GitHub rate limits. Drop a .zip to scan all files locally.`
    );
  }

  const files: ScannedFileInput[] = [];

  for (let i = 0; i < selectedBlobs.length; i++) {
    const blob = selectedBlobs[i];
    const sanitized = sanitizeDisplayPath(blob.path);
    if (!sanitized) {
      skippedCount++;
      continue;
    }

    const encodedPath = sanitized.safePath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;

    options?.onProgress?.(
      `Fetching (${i + 1}/${selectedBlobs.length}): ${sanitized.safePath}`
    );

    try {
      const rawResp = await fetch(rawUrl, { redirect: 'error' });
      options?.onNetworkRequest?.('GET', rawUrl, rawResp.status);

      if (!rawResp.ok) {
        skippedCount++;
        continue;
      }

      // Ensure response URL stays on raw.githubusercontent.com
      if (
        rawResp.url &&
        !rawResp.url.startsWith('https://raw.githubusercontent.com/')
      ) {
        throw new Error('Blocked unexpected redirect outside raw.githubusercontent.com');
      }

      const text = await rawResp.text();
      const truncated = text.length > SCAN_LIMITS.MAX_FILE_BYTES;
      files.push({
        path: sanitized.safePath,
        content: truncated ? text.slice(0, SCAN_LIMITS.MAX_FILE_BYTES) : text,
        byteLength: blob.size ?? text.length,
        truncated,
      });
    } catch {
      skippedCount++;
    }
  }

  return {
    sourceLabel: `github.com/${owner}/${repo}`,
    files,
    skippedCount,
    warnings,
  };
}

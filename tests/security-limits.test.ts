import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { SCAN_LIMITS } from '../src/config';
import { scanRepository, scanSingleFile } from '../src/core/scanner';
import { parseGitHubRepoUrl } from '../src/ingest/github';
import { ingestZipBytes } from '../src/ingest/zip';

describe('Security & Resource Limits Verification', () => {
  it('ReDoS test: evaluates pathological long repetitive inputs in linear time (< 150ms)', () => {
    const adversarialLine =
      'a'.repeat(3500) +
      ' <!-- ' +
      'ignore '.repeat(400) +
      '--> ' +
      'A'.repeat(3500);
    const start = performance.now();
    const { summary } = scanSingleFile({
      path: 'adversarial.md',
      content: adversarialLine,
    });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
    expect(summary.timedOut).toBe(false);
  });

  it('Zip-slip test: neutralizes "../" and absolute path traversal in zip archives', () => {
    const zipped = zipSync({
      '../../../etc/passwd': strToU8('normal text content'),
      '..\\..\\Windows\\win.ini': strToU8('normal config'),
      'README.md': strToU8('# Clean Readme'),
    });

    const result = ingestZipBytes(zipped, 'traversal.zip');
    const paths = result.files.map((f) => f.path);
    for (const p of paths) {
      expect(p).not.toContain('..');
      expect(p.startsWith('/')).toBe(false);
    }
    expect(paths).toContain('etc/passwd');
    expect(result.warnings.some((w) => w.toLowerCase().includes('zip-slip'))).toBe(
      true
    );
  });

  it('Zip-bomb test: rejects archives with excessive compression ratio (> 100:1 on >1MB payload)', () => {
    // 2.5 MB of zeroes compresses to ~2.5 KB (~1000:1 compression ratio)
    const highlyCompressible = new Uint8Array(2.5 * 1024 * 1024);
    highlyCompressible.fill(65); // 'A' repeated 2.6M times
    const bombZip = zipSync({
      'bomb.txt': highlyCompressible,
    });

    expect(() => ingestZipBytes(bombZip, 'bomb.zip')).toThrow(
      /compression ratio|zip-bomb/i
    );
  });

  it('Large-file test: truncates files larger than 1 MB and records truncation warning', () => {
    const hugeContent =
      '# Large File\n' +
      'Normal documentation line without any tricks.\n'.repeat(30_000);
    expect(hugeContent.length).toBeGreaterThan(SCAN_LIMITS.MAX_FILE_BYTES);

    const report = scanRepository([
      {
        path: 'docs/huge.md',
        content: hugeContent,
      },
    ]);

    expect(report.files[0].truncated).toBe(true);
    expect(report.warnings.some((w) => w.includes('truncated to 1 MB'))).toBe(true);
  });

  it('50-file repo performance test: scans a 50-file repository in well under 2 seconds', () => {
    const files = Array.from({ length: 50 }, (_, idx) => ({
      path: `src/module-${idx}/index.ts`,
      content: `export const id = ${idx};\nexport function run() { return "clean-${idx}"; }\n`,
    }));

    const start = performance.now();
    const report = scanRepository(files, { sourceLabel: '50-File Benchmark' });
    const elapsed = performance.now() - start;

    expect(report.files).toHaveLength(50);
    expect(elapsed).toBeLessThan(2000);
  });

  it('GitHub URL allowlist test: accepts only https://github.com/{owner}/{repo}', () => {
    expect(parseGitHubRepoUrl('https://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
    expect(parseGitHubRepoUrl('http://github.com/facebook/react')).toBeNull();
    expect(parseGitHubRepoUrl('https://evil.com/facebook/react')).toBeNull();
    expect(
      parseGitHubRepoUrl('https://github.com/facebook/react/blob/main/README.md')
    ).toBeNull();
    expect(parseGitHubRepoUrl('https://github.com/../secret')).toBeNull();
  });
});

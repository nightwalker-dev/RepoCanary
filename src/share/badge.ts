import { RULESET_VERSION } from '../config';

/**
 * Generates a static SVG badge reading "Scanned with RepoCanary" + ruleset version.
 * Security rule: NEVER contains the words "safe" or "verified", and NEVER contains code snippets.
 */
export function generateRepoCanaryBadgeSvg(
  rulesetVersion: string = RULESET_VERSION
): string {
  const safeVersion = rulesetVersion.replace(/[^0-9A-Za-z._-]/g, '');
  const leftText = 'Scanned with RepoCanary';
  const rightText = `v${safeVersion}`;

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="234" height="20" role="img" aria-label="Scanned with RepoCanary">',
    '  <title>Scanned with RepoCanary</title>',
    '  <linearGradient id="rc-s" x2="0" y2="100%">',
    '    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>',
    '    <stop offset="1" stop-opacity=".1"/>',
    '  </linearGradient>',
    '  <clipPath id="rc-r">',
    '    <rect width="234" height="20" rx="3" fill="#fff"/>',
    '  </clipPath>',
    '  <g clip-path="url(#rc-r)">',
    '    <rect width="168" height="20" fill="#12151B"/>',
    '    <rect x="168" width="66" height="20" fill="#FFD43B"/>',
    '    <rect width="234" height="20" fill="url(#rc-s)"/>',
    '  </g>',
    '  <g fill="#F3F4F6" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">',
    `    <text x="84" y="14">${leftText}</text>`,
    `    <text x="201" y="14" fill="#0B0D10" font-weight="bold">${rightText}</text>`,
    '  </g>',
    '</svg>',
  ].join('\n');
}

/**
 * Generates a Markdown snippet for embedding the RepoCanary badge in a repository README.
 */
export function generateBadgeMarkdownSnippet(
  rulesetVersion: string = RULESET_VERSION
): string {
  return `![Scanned with RepoCanary v${rulesetVersion}](https://img.shields.io/badge/Scanned_with-RepoCanary_v${rulesetVersion}-FFD43B?style=flat-square&labelColor=12151B)`;
}

import { ScanReport, Severity } from '../core/types';

export interface ShareCardPayload {
  verdict: string;
  score: number;
  rulesetVersion: string;
  filesScanned: number;
  suppressedCount: number;
  severityCounts: Record<Severity, number>;
  triggeredRuleIds: string[];
}

/**
 * Extracts strictly the non-sensitive metadata allowed on a Share Card:
 * ONLY verdict, score, counts, rule IDs, and ruleset version.
 * NEVER includes file paths, snippets, decoded text, or repository code.
 */
export function buildShareCardPayload(report: ScanReport): ShareCardPayload {
  const severityCounts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const ruleIdSet = new Set<string>();
  for (const f of report.findings) {
    severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
    ruleIdSet.add(f.ruleId);
  }

  return {
    verdict: report.verdict,
    score: report.score,
    rulesetVersion: report.rulesetVersion,
    filesScanned: report.files.length,
    suppressedCount: report.suppressedCount ?? 0,
    severityCounts,
    triggeredRuleIds: Array.from(ruleIdSet).sort(),
  };
}

/**
 * Renders a 1200x630 PNG report card on an HTML5 Canvas containing ONLY
 * verdict, counts, rule IDs, and ruleset version (zero code snippets).
 * Returns a PNG data URL.
 */
export function renderShareCardPngDataUrl(report: ScanReport): string {
  const payload = buildShareCardPayload(report);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available.');
  }

  // Background
  ctx.fillStyle = '#0B0D10';
  ctx.fillRect(0, 0, 1200, 630);

  // Outer card frame
  ctx.strokeStyle = '#262C3A';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, 1120, 550);

  // Header brand & ruleset version
  ctx.fillStyle = '#FFD43B';
  ctx.font = 'bold 34px Inter, sans-serif';
  ctx.fillText('RepoCanary', 84, 108);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.fillText(`Deterministic Heuristic Report · Ruleset v${payload.rulesetVersion}`, 310, 106);

  // Divider line
  ctx.strokeStyle = '#1E232D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(84, 138);
  ctx.lineTo(1116, 138);
  ctx.stroke();

  // Score & Verdict Color
  let accent = '#10B981';
  if (payload.score >= 50) accent = '#EF4444';
  else if (payload.score >= 20) accent = '#F59E0B';
  else if (payload.score >= 1) accent = '#FFD43B';

  // Score Box
  ctx.fillStyle = '#12151B';
  ctx.fillRect(84, 175, 220, 160);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(84, 175, 220, 160);

  ctx.fillStyle = '#F3F4F6';
  ctx.font = 'bold 64px "JetBrains Mono", monospace';
  ctx.fillText(`${payload.score}`, 120, 265);
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '22px "JetBrains Mono", monospace';
  ctx.fillText('/ 100', 215, 265);
  ctx.fillText('RISK SCORE', 120, 308);

  // Verdict Title
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.fillText('VERDICT', 340, 210);

  ctx.fillStyle = accent;
  ctx.font = 'bold 46px Inter, sans-serif';
  ctx.fillText(payload.verdict, 340, 268);

  ctx.fillStyle = '#D1D5DB';
  ctx.font = '22px "JetBrains Mono", monospace';
  ctx.fillText(
    `Files Scanned: ${payload.filesScanned}   ·   Suppressed: ${payload.suppressedCount}`,
    340,
    315
  );

  // Severity Counts Strip
  const sevBoxes: Array<{ label: string; count: number; color: string }> = [
    { label: 'CRITICAL', count: payload.severityCounts.critical, color: '#EF4444' },
    { label: 'HIGH', count: payload.severityCounts.high, color: '#F59E0B' },
    { label: 'MEDIUM', count: payload.severityCounts.medium, color: '#FFD43B' },
    { label: 'LOW', count: payload.severityCounts.low, color: '#60A5FA' },
    { label: 'INFO', count: payload.severityCounts.info, color: '#9CA3AF' },
  ];

  sevBoxes.forEach((box, idx) => {
    const x = 84 + idx * 208;
    const y = 370;
    ctx.fillStyle = '#12151B';
    ctx.fillRect(x, y, 192, 92);
    ctx.strokeStyle = '#1E232D';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 192, 92);

    ctx.fillStyle = box.color;
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(box.label, x + 20, y + 34);

    ctx.fillStyle = '#F3F4F6';
    ctx.font = 'bold 30px "JetBrains Mono", monospace';
    ctx.fillText(`${box.count}`, x + 20, y + 74);
  });

  // Triggered Rule IDs Only (No code snippets!)
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '18px "JetBrains Mono", monospace';
  const rulesLine =
    payload.triggeredRuleIds.length > 0
      ? `Triggered Rule IDs: ${payload.triggeredRuleIds.slice(0, 14).join(', ')}${
          payload.triggeredRuleIds.length > 14 ? ' …' : ''
        }`
      : 'Triggered Rule IDs: None (0 known tricks matched)';
  ctx.fillText(rulesLine, 84, 512);

  // Footer Disclaimer
  ctx.fillStyle = '#6B7280';
  ctx.font = '16px "JetBrains Mono", monospace';
  ctx.fillText(
    'Heuristic detector for AI coding agents · Contains no source code · Not a guarantee of safety',
    84,
    558
  );

  return canvas.toDataURL('image/png');
}

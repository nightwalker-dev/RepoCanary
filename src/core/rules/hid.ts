import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding, hasInstructionKeywords } from './helpers';

export const HID_001_HTML_COMMENTS: RuleDefinition = {
  id: 'HID-001',
  family: 'HID',
  title: 'Instruction-Like Content in HTML Comment',
  severity: 'high',
  description:
    'An HTML/Markdown comment (<!-- ... -->) contains imperative language or instructions aimed at an AI agent. Markdown renderers hide comments from human readers, but AI agents ingest the raw file.',
  remediation:
    'Remove hidden instructions from HTML comments or move legitimate notes into visible documentation.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const content = file.content;
    let searchIndex = 0;

    while (searchIndex < content.length) {
      const start = content.indexOf('<!--', searchIndex);
      if (start === -1) break;
      const end = content.indexOf('-->', start + 4);
      const closeIndex = end === -1 ? Math.min(content.length, start + 2000) : end;
      const body = content.slice(start + 4, closeIndex).trim();

      if (body.length > 0 && hasInstructionKeywords(body)) {
        const prefix = content.slice(0, start);
        const line = prefix.split('\n').length;
        const lastNewline = prefix.lastIndexOf('\n');
        const col = start - (lastNewline === -1 ? 0 : lastNewline + 1) + 1;

        findings.push(
          createFinding(HID_001_HTML_COMMENTS, file, line, col, `<!-- ${body} -->`, {
            decodedText: body,
          })
        );
      }

      searchIndex = end === -1 ? content.length : end + 3;
    }

    return findings;
  },
};

const HIDDEN_STYLE_PATTERNS = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0(?:\.0+)?(?:\s*[;"'>]|$)/i,
  /font-size\s*:\s*(?:0|0px|1px)/i,
  /color\s*:\s*(?:transparent|#fff(?:fff)?\s*;\s*background(?:-color)?\s*:\s*#fff(?:fff)?)/i,
  /<div[^>]+hidden\b/i,
  /<span[^>]+hidden\b/i,
];

export const HID_002_CSS_HIDDEN: RuleDefinition = {
  id: 'HID-002',
  family: 'HID',
  title: 'Hidden or Microscopic HTML/CSS Markup',
  severity: 'high',
  description:
    'Markup styled with display:none, visibility:hidden, opacity:0, 0px/1px font-size, or transparent text hides content from human reviewers while exposing it to LLM context windows.',
  remediation:
    'Remove hidden HTML elements and inline styles designed to conceal text.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      for (const pattern of HIDDEN_STYLE_PATTERNS) {
        const m = pattern.exec(line);
        if (m) {
          findings.push(
            createFinding(HID_002_CSS_HIDDEN, file, i + 1, m.index + 1, line)
          );
          break;
        }
      }
    }

    return findings;
  },
};

// Bounded linear-time checks for Markdown link titles and HTML title/alt attributes
const MD_LINK_TITLE_RE = /\]\([^)\n]{1,300}\s+"([^"\n]{10,400})"\)/g;
const HTML_ATTR_RE = /\b(?:alt|title)\s*=\s*"([^"\n]{10,400})"/gi;

export const HID_003_ATTR_INSTRUCTIONS: RuleDefinition = {
  id: 'HID-003',
  family: 'HID',
  title: 'Instructions Hidden in Image Alt or Link Title Attributes',
  severity: 'medium',
  description:
    'Markdown link titles or HTML alt/title attributes contain instruction-like directives aimed at AI agents.',
  remediation:
    'Ensure alt and title attributes contain only concise descriptive labels, not imperative instructions.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;

      MD_LINK_TITLE_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = MD_LINK_TITLE_RE.exec(line)) !== null) {
        const attrText = match[1];
        if (hasInstructionKeywords(attrText)) {
          findings.push(
            createFinding(HID_003_ATTR_INSTRUCTIONS, file, i + 1, match.index + 1, line, {
              decodedText: attrText,
            })
          );
        }
      }

      HTML_ATTR_RE.lastIndex = 0;
      while ((match = HTML_ATTR_RE.exec(line)) !== null) {
        const attrText = match[1];
        if (hasInstructionKeywords(attrText)) {
          findings.push(
            createFinding(HID_003_ATTR_INSTRUCTIONS, file, i + 1, match.index + 1, line, {
              decodedText: attrText,
            })
          );
        }
      }
    }

    return findings;
  },
};

export const HID_RULES: RuleDefinition[] = [
  HID_001_HTML_COMMENTS,
  HID_002_CSS_HIDDEN,
  HID_003_ATTR_INSTRUCTIONS,
];

import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding } from './helpers';

const ZERO_WIDTH_CODEPOINTS: Record<number, string> = {
  0x200b: 'U+200B ZERO WIDTH SPACE',
  0x200c: 'U+200C ZERO WIDTH NON-JOINER',
  0x200d: 'U+200D ZERO WIDTH JOINER',
  0x2060: 'U+2060 WORD JOINER',
  0x180e: 'U+180E MONGOLIAN VOWEL SEPARATOR',
  0xfeff: 'U+FEFF ZERO WIDTH NO-BREAK SPACE',
};

const BIDI_CODEPOINTS: Record<number, string> = {
  0x202a: 'U+202A LEFT-TO-RIGHT EMBEDDING',
  0x202b: 'U+202B RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'U+202C POP DIRECTIONAL FORMATTING',
  0x202d: 'U+202D LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'U+202E RIGHT-TO-LEFT OVERRIDE',
  0x2066: 'U+2066 LEFT-TO-RIGHT ISOLATE',
  0x2067: 'U+2067 RIGHT-TO-LEFT ISOLATE',
  0x2068: 'U+2068 FIRST STRONG ISOLATE',
  0x2069: 'U+2069 POP DIRECTIONAL ISOLATE',
};

/**
 * Decodes Unicode Tag block characters (U+E0000 - U+E007F) back into readable ASCII.
 * Attackers use this block ("ASCII smuggling") to hide invisible prompts inside normal text.
 */
export function decodeUnicodeTags(line: string): {
  decoded: string;
  firstColumn: number;
  tagCount: number;
} {
  let decoded = '';
  let firstColumn = -1;
  let tagCount = 0;
  let col = 1;

  for (const ch of line) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0xe0000 && cp <= 0xe007f) {
      if (firstColumn === -1) {
        firstColumn = col;
      }
      tagCount++;
      const asciiCode = cp - 0xe0000;
      if (asciiCode >= 0x20 && asciiCode <= 0x7e) {
        decoded += String.fromCharCode(asciiCode);
      }
    }
    col++;
  }

  return { decoded: decoded.trim(), firstColumn, tagCount };
}

export const UNI_001_ZERO_WIDTH: RuleDefinition = {
  id: 'UNI-001',
  family: 'UNI',
  title: 'Hidden Zero-Width Characters',
  severity: 'medium',
  description:
    'Zero-width Unicode characters were detected. These invisible codepoints can split keywords to bypass filters or hide steganographic payloads.',
  remediation:
    'Strip zero-width characters (U+200B, U+200C, U+200D, U+2060, U+FEFF) and inspect the surrounding text in X-Ray View.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let count = 0;
      let firstCol = -1;
      const names = new Set<string>();

      for (let j = 0; j < line.length; j++) {
        const code = line.charCodeAt(j);
        // Ignore a single BOM at the very start of the file (line 0, col 0)
        if (i === 0 && j === 0 && code === 0xfeff) {
          continue;
        }
        const label = ZERO_WIDTH_CODEPOINTS[code];
        if (label) {
          count++;
          names.add(label);
          if (firstCol === -1) {
            firstCol = j + 1;
          }
        }
      }

      if (count > 0) {
        findings.push(
          createFinding(UNI_001_ZERO_WIDTH, file, i + 1, firstCol, line, {
            customDescription: `Found ${count} invisible zero-width character(s) on this line (${Array.from(names).join(', ')}).`,
          })
        );
      }
    }

    return findings;
  },
};

export const UNI_002_TAG_SMUGGLING: RuleDefinition = {
  id: 'UNI-002',
  family: 'UNI',
  title: 'Unicode Tag Block ASCII Smuggling',
  severity: 'critical',
  description:
    'Characters from the Unicode Tags block (U+E0000–U+E007F) were found. These are completely invisible to humans in editors and browsers, but AI tokenizers read them as hidden instructions.',
  remediation:
    'Delete all U+E0000–U+E007F tag characters immediately and review the decoded hidden message shown below.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const { decoded, firstColumn, tagCount } = decodeUnicodeTags(line);
      if (tagCount > 0) {
        findings.push(
          createFinding(UNI_002_TAG_SMUGGLING, file, i + 1, firstColumn, line, {
            customDescription: `Found ${tagCount} invisible Unicode Tag characters smuggling hidden ASCII text.`,
            decodedText: decoded || '[Non-printable Unicode Tag sequence]',
          })
        );
      }
    }

    return findings;
  },
};

export const UNI_003_BIDI_CONTROLS: RuleDefinition = {
  id: 'UNI-003',
  family: 'UNI',
  title: 'Bidirectional Text Override (Trojan Source)',
  severity: 'critical',
  description:
    'Bidirectional (Bidi) Unicode control characters (U+202A–U+202E, U+2066–U+2069) reorder how source code or instructions appear visually vs. how compilers and AI agents parse them.',
  remediation:
    'Remove all Bidi override and isolate control characters and verify logical character order.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let firstCol = -1;
      const foundLabels = new Set<string>();

      for (let j = 0; j < line.length; j++) {
        const code = line.charCodeAt(j);
        const label = BIDI_CODEPOINTS[code];
        if (label) {
          foundLabels.add(label);
          if (firstCol === -1) {
            firstCol = j + 1;
          }
        }
      }

      if (foundLabels.size > 0) {
        findings.push(
          createFinding(UNI_003_BIDI_CONTROLS, file, i + 1, firstCol, line, {
            customDescription: `Detected bidirectional control character(s): ${Array.from(foundLabels).join(', ')}.`,
          })
        );
      }
    }

    return findings;
  },
};

// Word token regex bounded for linear execution
const WORD_TOKEN_RE = /[A-Za-z\u0370-\u03FF\u0400-\u04FF_][A-Za-z0-9\u0370-\u03FF\u0400-\u04FF_]{2,63}/g;

function hasMixedScriptHomoglyphs(token: string): boolean {
  let hasLatin = false;
  let hasConfusableScript = false;

  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i);
    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      hasLatin = true;
    } else if (
      // Cyrillic or Greek range
      (code >= 0x0400 && code <= 0x04ff) ||
      (code >= 0x0370 && code <= 0x03ff)
    ) {
      hasConfusableScript = true;
    }
    if (hasLatin && hasConfusableScript) {
      return true;
    }
  }
  return false;
}

export const UNI_004_HOMOGLYPHS: RuleDefinition = {
  id: 'UNI-004',
  family: 'UNI',
  title: 'Mixed-Script Homoglyph Identifier',
  severity: 'high',
  description:
    'An identifier or word mixes Latin characters with visually identical Cyrillic or Greek characters (homoglyphs), which can spoof package names, variables, or security checks.',
  remediation:
    'Replace mixed-script characters with standard ASCII Latin characters.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      WORD_TOKEN_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = WORD_TOKEN_RE.exec(line)) !== null) {
        const token = match[0];
        if (hasMixedScriptHomoglyphs(token)) {
          findings.push(
            createFinding(UNI_004_HOMOGLYPHS, file, i + 1, match.index + 1, line, {
              customDescription: `Token "${token}" mixes Latin and Cyrillic/Greek scripts in the same identifier.`,
            })
          );
          break; // Report once per line
        }
      }
    }

    return findings;
  },
};

export const UNI_RULES: RuleDefinition[] = [
  UNI_001_ZERO_WIDTH,
  UNI_002_TAG_SMUGGLING,
  UNI_003_BIDI_CONTROLS,
  UNI_004_HOMOGLYPHS,
];

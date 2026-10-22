import { redactSecretsInText } from './rules/helpers';
import { pureDecodeBase64, pureDecodeHex } from './rules/obf';
import { decodeUnicodeTags } from './rules/uni';

export interface XRaySegment {
  type:
    | 'text'
    | 'chip-zero-width'
    | 'chip-bidi'
    | 'chip-tag'
    | 'comment-revealed'
    | 'hidden-markup'
    | 'homoglyph';
  text: string;
  chipLabel?: string;
  codePointHex?: string;
}

export interface XRayLine {
  lineNumber: number;
  /** What a human typically sees in a rendered view (comments hidden, invisible chars hidden) */
  humanVisibleText: string;
  /** True if the entire line or part of it was concealed from human readers */
  hasHiddenContent: boolean;
  /** Structured tokens showing what the AI tokenizer actually ingests */
  aiSegments: XRaySegment[];
  /** Decoded hidden payload banner (e.g. Unicode Tag ASCII smuggling or encoded Base64/Hex) */
  decodedBanner?: {
    kind: 'unicode-tags' | 'encoded-blob' | 'html-comment';
    label: string;
    decodedText: string;
  };
}

const ZERO_WIDTH_NAMES: Record<number, string> = {
  0x200b: 'ZWSP U+200B',
  0x200c: 'ZWNJ U+200C',
  0x200d: 'ZWJ U+200D',
  0x2060: 'WJ U+2060',
  0x180e: 'MVS U+180E',
  0xfeff: 'BOM U+FEFF',
};

const BIDI_NAMES: Record<number, string> = {
  0x202a: 'LRE U+202A',
  0x202b: 'RLE U+202B',
  0x202c: 'PDF U+202C',
  0x202d: 'LRO U+202D',
  0x202e: 'RLO U+202E',
  0x2066: 'LRI U+2066',
  0x2067: 'RLI U+2067',
  0x2068: 'FSI U+2068',
  0x2069: 'PDI U+2069',
};

/**
 * Strips invisible characters, HTML comments, and display:none blocks to simulate
 * what a human sees when looking at rendered Markdown/text.
 */
function buildHumanVisibleLine(rawLine: string, inMultilineComment: boolean): {
  visible: string;
  nextInComment: boolean;
} {
  let line = rawLine;
  let currentlyInComment = inMultilineComment;

  if (currentlyInComment) {
    const closeIdx = line.indexOf('-->');
    if (closeIdx === -1) {
      return { visible: '', nextInComment: true };
    }
    line = line.slice(closeIdx + 3);
    currentlyInComment = false;
  }

  // Strip inline <!-- ... --> comments
  line = line.replace(/<!--[\s\S]*?-->/g, '');

  // Check if an unclosed <!-- remains
  const openIdx = line.indexOf('<!--');
  if (openIdx !== -1) {
    line = line.slice(0, openIdx);
    currentlyInComment = true;
  }

  // Strip inline hidden HTML tags in linear time without regex backreferences
  if (
    /<(?:div|span|p|a|section)[^>]{0,240}(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*(?:0|0px|1px)|\bhidden\b)/i.test(
      line
    )
  ) {
    line = line.replace(/<(?:div|span|p|a|section)[^>]{0,300}>[^<]{0,2000}<\/(?:div|span|p|a|section)>/gi, '');
  }

  // Strip zero-width, Bidi, and Unicode Tag characters
  let cleaned = '';
  for (const ch of line) {
    const cp = ch.codePointAt(0) ?? 0;
    if (
      ZERO_WIDTH_NAMES[cp] ||
      BIDI_NAMES[cp] ||
      (cp >= 0xe0000 && cp <= 0xe007f)
    ) {
      continue;
    }
    cleaned += ch;
  }

  return { visible: redactSecretsInText(cleaned), nextInComment: currentlyInComment };
}

/**
 * Tokenizes a single line into safe React-renderable XRaySegment objects for the "What the AI sees" pane.
 */
function tokenizeAiLine(rawLine: string, inComment: boolean): {
  segments: XRaySegment[];
  hasAnomaly: boolean;
} {
  const safeLine = redactSecretsInText(rawLine);
  const segments: XRaySegment[] = [];
  let hasAnomaly = false;
  let buffer = '';

  const flushBuffer = (type: XRaySegment['type'] = 'text') => {
    if (buffer.length > 0) {
      segments.push({ type, text: buffer });
      buffer = '';
    }
  };

  const isCommentLine = inComment || safeLine.includes('<!--') || safeLine.includes('-->');
  const isHiddenMarkupLine =
    /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*(?:0|0px|1px)/i.test(
      safeLine
    );

  let tagRunCount = 0;
  let tagRunAscii = '';

  const flushTagRun = () => {
    if (tagRunCount > 0) {
      hasAnomaly = true;
      segments.push({
        type: 'chip-tag',
        text: tagRunAscii ? `TAG[${tagRunAscii}]` : `TAG×${tagRunCount}`,
        chipLabel: `Unicode Tag Block (${tagRunCount} invisible chars${tagRunAscii ? `: "${tagRunAscii}"` : ''})`,
        codePointHex: 'U+E0000..E007F',
      });
      tagRunCount = 0;
      tagRunAscii = '';
    }
  };

  for (const ch of safeLine) {
    const cp = ch.codePointAt(0) ?? 0;

    if (cp >= 0xe0000 && cp <= 0xe007f) {
      flushBuffer(
        isCommentLine ? 'comment-revealed' : isHiddenMarkupLine ? 'hidden-markup' : 'text'
      );
      tagRunCount++;
      const ascii = cp - 0xe0000;
      if (ascii >= 0x20 && ascii <= 0x7e) {
        tagRunAscii += String.fromCharCode(ascii);
      }
      continue;
    }

    flushTagRun();

    if (ZERO_WIDTH_NAMES[cp]) {
      flushBuffer(
        isCommentLine ? 'comment-revealed' : isHiddenMarkupLine ? 'hidden-markup' : 'text'
      );
      hasAnomaly = true;
      segments.push({
        type: 'chip-zero-width',
        text: ZERO_WIDTH_NAMES[cp],
        chipLabel: `Invisible Zero-Width Character (${ZERO_WIDTH_NAMES[cp]})`,
        codePointHex: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      });
      continue;
    }

    if (BIDI_NAMES[cp]) {
      flushBuffer(
        isCommentLine ? 'comment-revealed' : isHiddenMarkupLine ? 'hidden-markup' : 'text'
      );
      hasAnomaly = true;
      segments.push({
        type: 'chip-bidi',
        text: BIDI_NAMES[cp],
        chipLabel: `Bidirectional Override Control (${BIDI_NAMES[cp]})`,
        codePointHex: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      });
      continue;
    }

    // Confusable Cyrillic/Greek character inside ASCII context
    if ((cp >= 0x0400 && cp <= 0x04ff) || (cp >= 0x0370 && cp <= 0x03ff)) {
      flushBuffer(
        isCommentLine ? 'comment-revealed' : isHiddenMarkupLine ? 'hidden-markup' : 'text'
      );
      hasAnomaly = true;
      segments.push({
        type: 'homoglyph',
        text: `${ch} [U+${cp.toString(16).toUpperCase().padStart(4, '0')}]`,
        chipLabel: `Non-Latin Homoglyph Character U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      });
      continue;
    }

    buffer += ch;
  }

  flushTagRun();
  flushBuffer(
    isCommentLine ? 'comment-revealed' : isHiddenMarkupLine ? 'hidden-markup' : 'text'
  );

  if (isCommentLine || isHiddenMarkupLine) {
    hasAnomaly = true;
  }

  return { segments, hasAnomaly };
}

/**
 * Generates a complete line-by-line X-Ray inspection model for a file.
 * Pure function: no HTML strings, no innerHTML.
 */
export function buildXRayLines(content: string): XRayLine[] {
  const rawLines = content.split('\n');
  const result: XRayLine[] = [];
  let inMultilineComment = false;

  const b64Regex = /(?:^|[\s"'`:=])([A-Za-z0-9+/]{24,512}={0,2})(?=$|[\s"'`,;)\]])/;
  const hexRegex = /\b(?:0x)?[0-9a-fA-F]{28,512}\b/;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const wasInComment = inMultilineComment;
    const { visible, nextInComment } = buildHumanVisibleLine(rawLine, inMultilineComment);
    inMultilineComment = nextInComment;

    const { segments, hasAnomaly } = tokenizeAiLine(rawLine, wasInComment);

    let decodedBanner: XRayLine['decodedBanner'] | undefined;

    // 1. Check for Unicode Tag ASCII smuggling on this line
    const tagDecoded = decodeUnicodeTags(rawLine);
    if (tagDecoded.tagCount > 0) {
      decodedBanner = {
        kind: 'unicode-tags',
        label: `DECODED UNICODE TAG SMUGGLING (${tagDecoded.tagCount} INVISIBLE CHARS)`,
        decodedText: redactSecretsInText(
          tagDecoded.decoded || '[Non-printable Unicode Tag codepoints]'
        ),
      };
    } else if (!rawLine.includes('data:image/')) {
      // 2. Check for Base64 or Hex encoded instructions on this line
      const b64Match = b64Regex.exec(rawLine);
      if (b64Match) {
        const decoded = pureDecodeBase64(b64Match[1]);
        if (decoded) {
          decodedBanner = {
            kind: 'encoded-blob',
            label: 'DECODED BASE64 PAYLOAD',
            decodedText: redactSecretsInText(decoded),
          };
        }
      } else {
        const hexMatch = hexRegex.exec(rawLine);
        if (hexMatch) {
          const decoded = pureDecodeHex(hexMatch[0]);
          if (decoded) {
            decodedBanner = {
              kind: 'encoded-blob',
              label: 'DECODED HEX PAYLOAD',
              decodedText: redactSecretsInText(decoded),
            };
          }
        }
      }
    }

    result.push({
      lineNumber: i + 1,
      humanVisibleText: visible,
      hasHiddenContent: hasAnomaly || Boolean(decodedBanner),
      aiSegments: segments,
      ...(decodedBanner ? { decodedBanner } : {}),
    });
  }

  return result;
}

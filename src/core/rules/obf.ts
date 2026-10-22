import { Finding, RuleDefinition, ScannedFileInput } from '../types';
import { createFinding, hasInstructionKeywords } from './helpers';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Pure, dependency-free, deterministic Base64 to UTF-8 decoder.
 * Never executes anything; returns null if invalid or non-printable binary.
 */
export function pureDecodeBase64(input: string): string | null {
  const cleaned = input.replace(/[\r\n\s]/g, '');
  if (cleaned.length < 24 || cleaned.length > 4096 || cleaned.length % 4 !== 0) {
    return null;
  }

  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const c1 = BASE64_ALPHABET.indexOf(cleaned[i]);
    const c2 = BASE64_ALPHABET.indexOf(cleaned[i + 1]);
    const c3 = cleaned[i + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(cleaned[i + 2]);
    const c4 = cleaned[i + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(cleaned[i + 3]);

    if (c1 === -1 || c2 === -1 || c3 === -1 || c4 === -1) {
      return null;
    }

    const triplet = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    bytes.push((triplet >> 16) & 0xff);
    if (cleaned[i + 2] !== '=') {
      bytes.push((triplet >> 8) & 0xff);
    }
    if (cleaned[i + 3] !== '=') {
      bytes.push(triplet & 0xff);
    }
  }

  // Verify that decoded bytes are printable ASCII / UTF-8 text
  let printable = 0;
  let result = '';
  for (const b of bytes) {
    if (b === 0) return null; // binary null byte
    if ((b >= 0x20 && b <= 0x7e) || b === 0x0a || b === 0x0d || b === 0x09) {
      printable++;
      result += String.fromCharCode(b);
    }
  }

  if (bytes.length === 0 || printable / bytes.length < 0.85) {
    return null;
  }
  return result.trim();
}

/**
 * Pure hex string to ASCII decoder.
 */
export function pureDecodeHex(input: string): string | null {
  const cleaned = input.replace(/(?:0x|\\x|\s)/gi, '');
  if (cleaned.length < 24 || cleaned.length > 4096 || cleaned.length % 2 !== 0) {
    return null;
  }
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
    return null;
  }

  let result = '';
  let printable = 0;
  const totalBytes = cleaned.length / 2;

  for (let i = 0; i < cleaned.length; i += 2) {
    const byte = parseInt(cleaned.slice(i, i + 2), 16);
    if (byte === 0) return null;
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x0a || byte === 0x0d || byte === 0x09) {
      printable++;
      result += String.fromCharCode(byte);
    }
  }

  if (totalBytes === 0 || printable / totalBytes < 0.9) {
    return null;
  }
  return result.trim();
}

const B64_TOKEN_RE = /(?:^|[\s"'`:=])([A-Za-z0-9+/]{24,512}={0,2})(?=$|[\s"'`,;)\]])/g;
const HEX_TOKEN_RE = /(?:\b(?:0x)?[0-9a-fA-F]{28,512}\b|(?:\\x[0-9a-fA-F]{2}){12,256})/g;

export const OBF_001_BASE64_PAYLOAD: RuleDefinition = {
  id: 'OBF-001',
  family: 'OBF',
  title: 'Base64-Encoded Instruction Payload',
  severity: 'high',
  description:
    'A Base64 blob decodes into readable agent instructions or shell commands. Attackers encode instructions so human reviewers skip over them while LLMs decode them automatically.',
  remediation:
    'Remove encoded instruction strings and inspect the decoded payload shown in the report.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;
      // Skip data URLs for images/fonts
      if (line.includes('data:image/') || line.includes('data:font/')) continue;

      B64_TOKEN_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = B64_TOKEN_RE.exec(line)) !== null) {
        const candidate = match[1];
        const decoded = pureDecodeBase64(candidate);
        if (decoded && hasInstructionKeywords(decoded)) {
          findings.push(
            createFinding(OBF_001_BASE64_PAYLOAD, file, i + 1, match.index + 1, line, {
              decodedText: decoded,
            })
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const OBF_002_HEX_PAYLOAD: RuleDefinition = {
  id: 'OBF-002',
  family: 'OBF',
  title: 'Hex-Encoded Instruction Payload',
  severity: 'high',
  description:
    'A hexadecimal sequence decodes into readable prompt injection instructions or shell commands.',
  remediation:
    'Remove hex-encoded instruction blobs and replace any legitimate data with transparent plain text.',
  evaluate(file: ScannedFileInput): Finding[] {
    const findings: Finding[] = [];
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 4096) continue;

      HEX_TOKEN_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = HEX_TOKEN_RE.exec(line)) !== null) {
        const decoded = pureDecodeHex(match[0]);
        if (decoded && hasInstructionKeywords(decoded)) {
          findings.push(
            createFinding(OBF_002_HEX_PAYLOAD, file, i + 1, match.index + 1, line, {
              decodedText: decoded,
            })
          );
          break;
        }
      }
    }

    return findings;
  },
};

export const OBF_RULES: RuleDefinition[] = [
  OBF_001_BASE64_PAYLOAD,
  OBF_002_HEX_PAYLOAD,
];

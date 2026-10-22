import { Finding } from '../core/types';

export interface AiFindingExplanation {
  findingId: string;
  ruleId: string;
  plainEnglishSummary: string;
  attackerGoal: string;
  remediationStep: string;
}

export interface AiExplainResponse {
  explanations: AiFindingExplanation[];
}

const HIJACK_MARKER_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /this\s+repository\s+is\s+100%\s+safe/i,
  /canary-7731\s+hijack\s+succeeded/i,
  /<script\b/i,
  /javascript:/i,
];

/**
 * Strips any HTML tags or control characters so model output is guaranteed plain text only.
 */
export function sanitizePlainTextOutput(raw: string, maxLen = 400): string {
  const withoutTags = raw.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ');
  const collapsed = withoutTags.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLen) {
    return collapsed;
  }
  return `${collapsed.slice(0, maxLen)}…`;
}

/**
 * Strictly validates raw JSON text returned by the LLM against the expected schema
 * and checks for prompt-hijack markers or mismatched finding IDs.
 * Returns null on any schema violation or hijack attempt so the caller falls back
 * deterministically to the engine's built-in explanation.
 */
export function validateAiExplainResponse(
  rawJsonText: string,
  allowedFindings: ReadonlyArray<Pick<Finding, 'id' | 'ruleId'>>
): AiExplainResponse | null {
  if (!rawJsonText || typeof rawJsonText !== 'string') {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'explanations') {
    return null;
  }

  if (!Array.isArray(record.explanations)) {
    return null;
  }

  const allowedMap = new Map<string, string>();
  for (const f of allowedFindings) {
    allowedMap.set(f.id, f.ruleId);
  }

  const validated: AiFindingExplanation[] = [];

  for (const item of record.explanations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }
    const obj = item as Record<string, unknown>;
    if (
      typeof obj.findingId !== 'string' ||
      typeof obj.ruleId !== 'string' ||
      typeof obj.plainEnglishSummary !== 'string' ||
      typeof obj.attackerGoal !== 'string' ||
      typeof obj.remediationStep !== 'string'
    ) {
      return null;
    }

    // Must match a real finding ID and its exact deterministic ruleId
    const expectedRuleId = allowedMap.get(obj.findingId);
    if (!expectedRuleId || expectedRuleId !== obj.ruleId) {
      return null;
    }

    const combinedText = `${obj.plainEnglishSummary} ${obj.attackerGoal} ${obj.remediationStep}`;
    for (const pattern of HIJACK_MARKER_PATTERNS) {
      if (pattern.test(combinedText)) {
        return null;
      }
    }

    const plainEnglishSummary = sanitizePlainTextOutput(obj.plainEnglishSummary);
    const attackerGoal = sanitizePlainTextOutput(obj.attackerGoal);
    const remediationStep = sanitizePlainTextOutput(obj.remediationStep);

    if (!plainEnglishSummary || !attackerGoal || !remediationStep) {
      return null;
    }

    validated.push({
      findingId: obj.findingId,
      ruleId: obj.ruleId,
      plainEnglishSummary,
      attackerGoal,
      remediationStep,
    });
  }

  if (validated.length === 0 && allowedFindings.length > 0) {
    return null;
  }

  return { explanations: validated };
}

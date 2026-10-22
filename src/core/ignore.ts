/**
 * Parser and matcher for `.repocanaryignore` files.
 * Supports gitignore-style glob patterns (`tests/fixtures/**`, `docs/*.md`)
 * and optional rule-scoped suppressions (`docs/THREAT_MODEL.md:INJ-001` or `docs/**:INJ-*`).
 * All matching is linear-time without recursive regex backtracking.
 */

export interface IgnoreRule {
  raw: string;
  pathPattern: string;
  rulePattern?: string;
}

/**
 * Parses the contents of a `.repocanaryignore` file into structured rules.
 */
export function parseRepoCanaryIgnore(content: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const colonIdx = trimmed.lastIndexOf(':');
    if (colonIdx > 0 && !trimmed.slice(colonIdx + 1).includes('/')) {
      const pathPattern = trimmed.slice(0, colonIdx).trim();
      const rulePattern = trimmed.slice(colonIdx + 1).trim().toUpperCase();
      if (pathPattern) {
        rules.push({ raw: trimmed, pathPattern, rulePattern });
      }
    } else {
      rules.push({ raw: trimmed, pathPattern: trimmed });
    }
  }

  return rules;
}

/**
 * Linear-time glob matcher supporting `*`, `**`, and `?` over normalized forward-slash paths.
 */
export function matchGlobLinear(pattern: string, target: string): boolean {
  const normPattern = pattern.replace(/\\/g, '/').replace(/^\/+/, '');
  const normTarget = target.replace(/\\/g, '/').replace(/^\/+/, '');

  if (normPattern === '**' || normPattern === '*') {
    return true;
  }

  // Directory prefix shorthand: "tests/fixtures/**" or "tests/fixtures/"
  if (normPattern.endsWith('/**')) {
    const prefix = normPattern.slice(0, -3);
    if (normTarget === prefix || normTarget.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  if (normPattern.endsWith('/')) {
    const prefix = normPattern.slice(0, -1);
    if (normTarget === prefix || normTarget.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  // Iterative two-pointer wildcard matching (guaranteed O(P * T) worst-case, zero recursion)
  let p = 0;
  let t = 0;
  let starIdx = -1;
  let matchIdx = 0;

  while (t < normTarget.length) {
    if (
      p < normPattern.length &&
      (normPattern[p] === '?' || normPattern[p] === normTarget[t])
    ) {
      p++;
      t++;
    } else if (p < normPattern.length && normPattern[p] === '*') {
      // Collapse consecutive '*'
      while (p < normPattern.length && normPattern[p] === '*') {
        p++;
      }
      starIdx = p - 1;
      matchIdx = t;
    } else if (starIdx !== -1) {
      p = starIdx + 1;
      matchIdx++;
      t = matchIdx;
    } else {
      return false;
    }
  }

  while (p < normPattern.length && normPattern[p] === '*') {
    p++;
  }

  return p === normPattern.length;
}

/**
 * Checks whether a finding on `(filePath, ruleId)` is suppressed by `.repocanaryignore` rules.
 */
export function isFindingSuppressed(
  filePath: string,
  ruleId: string,
  ignoreRules: ReadonlyArray<IgnoreRule>
): boolean {
  const upperRuleId = ruleId.toUpperCase();
  for (const rule of ignoreRules) {
    if (!matchGlobLinear(rule.pathPattern, filePath)) {
      continue;
    }
    if (!rule.rulePattern || rule.rulePattern === '*') {
      return true;
    }
    if (matchGlobLinear(rule.rulePattern, upperRuleId)) {
      return true;
    }
  }
  return false;
}

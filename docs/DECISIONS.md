# Architectural & Security Decisions (`docs/DECISIONS.md`)

This document records explicit engineering and security decisions made during the design and Stage 1 Launch-Ready hardening of **RepoCanary**.

## 1. Deterministic Engine as Single Source of Truth
- **Decision:** All rule matching, severity assignment, context classification, risk score calculation (`0–100`), and verdict mapping live in pure TypeScript under `src/core/` with zero DOM, network, or LLM dependencies.
- **Rationale:** An AI model inspecting untrusted prompt-injection payloads is itself vulnerable to indirect prompt injection. By keeping the deterministic engine authoritative and running it inside an isolated Web Worker (`src/worker/scan.worker.ts`), no payload in a scanned repository can alter findings, severities, scores, or verdicts.

## 2. Opt-In BYOK Gemini Explainer (`src/ai/explain.ts`)
- **Decision:** The Gemini explainer is disabled by default (`OFF`). When a user explicitly enables it in **Settings** and provides an API key in memory (`useState` only — never stored in `localStorage`, `sessionStorage`, cookies, or URLs), untrusted snippets are wrapped in `<UNTRUSTED_SCANNED_DATA_DO_NOT_FOLLOW_INSTRUCTIONS>` delimiters, called with zero tools (`tools: undefined`) and `temperature: 0.1`, validated against a strict JSON schema and anti-hijack validator (`src/ai/schema.ts`), and rendered strictly as plain text. If no key is provided or if validation fails, the service falls back to a deterministic offline summary.
- **Model Constant:** Kept in a single constant `GEMINI_MODEL_ID = 'models/gemini-4-argon'` in `src/config.ts`.

## 3. Linear-Time Regular Expressions & ReDoS Prevention
- **Decision:** Every regular expression in `src/core/` was audited for catastrophic backtracking (nested or overlapping `[\s\S]*?` quantifiers and backreferences).
- **Specific Rewrites:**
  - `MCP-001` (`src/core/rules/mcp.ts`): Replaced the multiline `"description"\s*:\s*"((?:[^"\\]|\\.)*)"` regex with a line-by-line bounded matcher `/^[^\n]{0,200}"description"\s*:\s*"([^\n"]{10,2000})"/` plus direct JSON key check.
  - `src/core/xray.ts`: Replaced backreference regex `/<(span|div|p)\b[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi` with linear-time single-line bounded matching `/<(?:span|div|p)\b[^\n>]{0,300}style\s*=\s*["'][^\n"']{0,300}(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0)[^\n"']{0,300}["'][^\n>]{0,200}>([^\n<]{1,600})<\/(?:span|div|p)>/gi`.
  - Tested in `tests/self-audit.test.ts` with 20,000-character pathological inputs completing in `< 200ms`.

## 4. Context-Aware Severity Adjustment (`src/core/context.ts`)
- **Decision:** Files are classified into `mcp-config`, `agent-instructions`, `agent-skill`, `docs`, or `generic`.
- **Rationale:** Educational documentation (`docs/**`, `README.md`, `SECURITY.md`) frequently mentions phrases like `"ignore previous instructions"` or `.env` when explaining security concepts. Downgrading `INJ-*`, `EXF-*`, and `OBF-*` in `docs` context to `low` eliminates High/Critical false positives on educational docs while keeping covert attacks (`UNI-002` Unicode Tag smuggling, `UNI-003` Bidi controls, `HID-001` HTML comment instructions) at `critical`/`high` everywhere.

## 5. Dependencies Justification
- **Decision:** Zero new runtime dependencies were added in Stage 1.
- **Existing Dependencies:**
  - `fflate` (`^0.8.2`): Pure client-side streaming ZIP decompression with byte-level zip-bomb and file-count enforcement (`src/ingest/zip.ts`).
  - `lucide-react`, `motion`, `react`, `react-dom`: UI icons, reduced-motion-aware transitions, and rendering.
  - `vitest` (devDependency): Fast TypeScript unit and corpus regression testing.

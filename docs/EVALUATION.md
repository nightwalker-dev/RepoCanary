# RepoCanary Internal Corpus Evaluation (`v1.0.0`)

> **Honest Scope Statement:** The metrics below are measured **exclusively on RepoCanary's own internal regression corpora** (`tests/benign-corpus/` and `tests/canary-corpus/`). This evaluation is an **internal regression test** designed to catch accidental false positives on common developer files and verify rule coverage across our 8 rule families — **it is NOT an external benchmark** and does not claim generalization to all real-world repositories or novel prompt-injection techniques.

---

## 1. Corpora Composition

### A. Benign Corpus (`tests/benign-corpus/index.ts` — 30 Samples)
Thirty original, realistic benign developer files written for this test suite:
- **Standard Documentation (`benign-01` to `benign-04`, `benign-27` to `benign-30`):** TypeScript CLI `README.md`, React component library `README.md`, Python FastAPI `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and MIT `LICENSE`.
- **Agent Instruction Files (`benign-05` to `benign-11`, `benign-22`, `benign-23`):** `AGENTS.md` (monorepo guidelines), `CLAUDE.md` (Rust crate notes), `GEMINI.md` (frontend design system), `.cursorrules` (Next.js App Router), `.windsurfrules` (Go microservice), `.github/copilot-instructions.md` (Java Spring), `.cursor/rules/testing.mdc`, `.github/ISSUE_TEMPLATE/bug_report.md`, and `.github/pull_request_template.md`.
- **Configs & Lifecycle Scripts (`benign-12` to `benign-18`):** Pinned `.mcp.json` (`@modelcontextprotocol/server-filesystem@0.6.2` scoped to `./docs`, `https://mcp.example.com/sse`), benign `package.json` scripts (`husky`, `tsc`, `vitest`), manual `.vscode/tasks.json`, benign `.devcontainer/devcontainer.json` (`npm ci && npm run build`), and `.github/workflows/ci.yml`.
- **Internationalized & Technical Files (`benign-19` to `benign-21`):** Multi-language `docs/i18n-guide.md` (Japanese, Cyrillic, Greek in separate words), `docs/architecture.md` with HTML comments (`<!-- TODO: add sequence diagram -->`) and Mermaid diagrams, and `src/assets/icon.ts` with a benign SVG Base64 data URI.
- **Educational Docs *About* Prompt Injection (`benign-24` to `benign-26`):** `docs/prompt-injection-overview.md`, `docs/secret-management.md`, and `docs/unicode-security-notes.md` that explicitly quote phrases like `"ignore previous instructions"` or reference `.env` and `~/.ssh/id_rsa` for defensive education.

### B. Canary Corpus (`tests/canary-corpus/index.ts` — 8 Samples)
One harmless sample per rule family (`UNI`, `HID`, `INJ`, `EXF`, `MCP`, `EXEC`, `OBF`, `SEC`). Every payload uses only the benign marker string `CANARY-7731`.

---

## 2. Measured Results (Verified via `tests/corpus-evaluation.test.ts`)

| Metric | Result | Details |
| :--- | :--- | :--- |
| **Benign Corpus High/Critical False Positives** | **0 / 30 (0.0%)** | Zero benign samples produce any `high` or `critical` finding. |
| **Benign Corpus Specificity (High/Critical threshold)** | **30 / 30 (100.0%)** | 27/30 benign samples produce **0 findings of any severity**. The 3 educational security docs (`benign-24`, `benign-25`, `benign-26`) produce `low` informational findings due to context classification (`context: 'docs'`), keeping their High/Critical count at `0`. |
| **Canary Corpus Family Recall** | **8 / 8 (100.0%)** | All 8 harmless canary samples trigger their intended rule family (`UNI-002`, `HID-001`, `INJ-001`, `EXF-001`, `MCP-001`, `EXEC-001`, `OBF-001`, `SEC-001`). |
| **Canary Corpus Target Rule Precision** | **8 / 8 (100.0%)** | Each single-mechanism canary fixture triggers its exact target rule family. |

---

## 3. Reproducing These Numbers

Run the automated corpus evaluation suite locally:

```bash
npm test -- tests/corpus-evaluation.test.ts
```

# RepoCanary

**A canary in the coal mine for AI coding agents. See what your AI sees before it reads a repo.**

[![Scanned with RepoCanary v1.0.0](public/favicon.svg)](#badge-usage)

AI coding agents (Claude Code, Cursor, GitHub Copilot, Windsurf, Cline, Gemini Code Assist) automatically read repository files like `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules/*`, `.github/copilot-instructions.md`, `.windsurfrules`, MCP configs (`.mcp.json`), and code comments as trusted instructions.

Attackers can hide instructions inside those files using **invisible Unicode Tag characters (`U+E0000`–`U+E007F`)**, **Bidirectional text overrides**, **HTML comments**, **hidden CSS spans**, **encoded Base64/Hex blobs**, or **poisoned MCP tool descriptions**. Human eyes cannot see them in standard code editors or GitHub diffs — but LLM tokenizers read and obey them.

**RepoCanary** is a 100% client-side heuristic inspector that scans a folder, `.zip` archive, pasted text, or public GitHub repository and reveals hidden or risky agent-facing content in seconds, complete with a side-by-side **X-Ray View** ("What Humans See" vs. "What Your AI Agent Reads").

---

## Honest Scope & Non-Goals

- **Not a malware scanner and not a guarantee of safety:** RepoCanary is a static heuristic detector for AI agent-facing files. It will have false positives and false negatives.
- **Never claims "safe":** A score of `0` produces the verdict **`"No known tricks found"`** — never `"safe"` or `"verified"`.
- **100% Client-Side by Default:** Your code never leaves your browser when scanning dropped folders, `.zip` archives, or pasted text.

---

## Quick Start (3 Commands)

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000` and click **"Try a sample attack"** or **"Demo mode (10s guided reveal)"** to inspect a harmless multi-file `CANARY-7731` demonstration repository.

---

## Verify Zero Network Calls in 30 Seconds

You do not need to trust our privacy claims — verify them directly in your browser:

1. Open RepoCanary in Chrome, Edge, or Firefox.
2. Open Developer Tools (`F12` or `Cmd+Opt+I`) and select the **Network** tab.
3. Clear the network log and select **Fetch/XHR** (or **All**).
4. Click **"Try a sample attack"**, paste text, or drag-and-drop a local `.zip` or folder.
5. Observe that **zero network requests** are made. You can even toggle your browser to **Offline** mode in DevTools and run full `.zip` and folder scans.
   *(Note: Only scanning a remote GitHub URL contacts `api.github.com` / `raw.githubusercontent.com`, and only the optional opt-in BYOK Explainer contacts `generativelanguage.googleapis.com`.)*

---

## X-Ray View & 10-Second Guided Demo

RepoCanary's **X-Ray View** provides four synchronized inspection modes with 5,000+ line virtualization and full keyboard navigation (`j` / `k` or `Alt+Down` / `Alt+Up` to jump between findings):

1. **Split View:** Left pane shows **What Humans See** (invisible Unicode Tags, zero-width characters, and HTML comments hidden as in a normal editor). Right pane shows **What Your AI Agent Reads** with glowing inline chips (`[TAG: ...]`, `[U+202E RLO]`, `[U+200B ZWSP]`, `[HTML COMMENT: ...]`) and a decoded ASCII smuggling banner.
2. **Human View:** Full-width preview of the human-visible rendering.
3. **AI View:** Full-width inspection of every token and hidden payload visible to the LLM.
4. **Diff View:** Filters the file down to only the lines where the Human View and AI View diverge.

---

## Deterministic Rule Families (`v1.0.0` — 18 Rules)

The table below is synchronized directly with the rule registry in `src/core/rules/index.ts` (and verified by `tests/self-audit.test.ts`):

| Rule ID | Family | Default Severity | Title |
| :--- | :--- | :--- | :--- |
| `UNI-001` | `UNI` | `medium` | Zero-Width & Invisible Formatting Characters |
| `UNI-002` | `UNI` | `critical` | Unicode Tag Block ASCII Smuggling (`U+E0000`–`U+E007F`) |
| `UNI-003` | `UNI` | `critical` | Bidirectional (Bidi) Text Override Controls |
| `UNI-004` | `UNI` | `high` | Mixed-Script Homoglyph Identifier Spoofing |
| `HID-001` | `HID` | `high` | Agent Directives Hidden Inside HTML Comments |
| `HID-002` | `HID` | `high` | Visually Hidden HTML / CSS Element |
| `HID-003` | `HID` | `medium` | Suspicious Instructions in Markdown Link/Image Attributes |
| `INJ-001` | `INJ` | `critical` | Explicit Instruction Override ("Ignore Previous Instructions") |
| `INJ-002` | `INJ` | `high` | User-Deception & Secrecy Directive ("Do Not Tell the User") |
| `INJ-003` | `INJ` | `high` | System Prompt / Developer Role Impersonation |
| `EXF-001` | `EXF` | `critical` | Instruction to Read Local Secrets or Credential Files |
| `EXF-002` | `EXF` | `critical` | Outbound Data Exfiltration Command or Webhook |
| `MCP-001` | `MCP` | `critical` | MCP Tool Poisoning (Hidden Instructions in Tool Description) |
| `MCP-002` | `MCP` | `high` | Unpinned `npx -y` / `uvx` Package or Shell Wrapper in MCP Config |
| `MCP-003` | `MCP` | `medium` | Plain-HTTP Remote MCP Server or Overly Broad Filesystem Root |
| `EXEC-001` | `EXEC` | `high` | Suspicious `package.json` Lifecycle Hook (`preinstall` / `postinstall`) |
| `EXEC-002` | `EXEC` | `high` | Auto-Run Workspace Task (`.vscode/tasks.json` / `devcontainer.json`) |
| `OBF-001` | `OBF` | `high` | Encoded Base64 / Hex Payload Decoding to Agent Instructions |
| `SEC-001` | `SEC` | `medium` | Hardcoded API Key, Token, or Private Key Material (Redacted) |

See [`docs/RULES.md`](docs/RULES.md) for full rule descriptions, context-aware severity adjustments (`mcp-config | agent-instructions | agent-skill | docs | generic`), and `.repocanaryignore` syntax.

---

## Why RepoCanary? (Category Comparison)

Most traditional developer security tools focus on dependency CVEs, compiled malware, or leaked credentials, leaving a gap around **human-invisible instructions aimed at AI coding agents**:

| Capability Category | Traditional SAST / CVE Scanners | Secret Scanners | Runtime LLM Guardrails | **RepoCanary** |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Target** | Code vulnerabilities & dependency CVEs | Leaked API keys & tokens | Live API prompt/response filtering | **Repo files read as instructions by AI coding agents** |
| **Unicode Tag (`U+E0000`) & Bidi Smuggling** | Rarely inspected in Markdown/rules | Not in scope | Requires sending data to an API | **Deterministic decoding + side-by-side X-Ray View** |
| **MCP Config & Tool Description Poisoning** | Not in scope | Not in scope | Partial (runtime only) | **Static inspection of `.mcp.json` & tool descriptions** |
| **Execution Model** | CLI / CI server | CLI / CI server | Cloud proxy / API | **100% in-browser Web Worker (zero upload) + SARIF 2.1.0 export** |

> **TODO (External Tool Comparison):** Before adding named comparisons to specific third-party open-source or commercial scanners in release notes, verify and cite their exact version numbers and documented feature matrices. RepoCanary intentionally avoids unverified claims about other tools' capabilities.

---

## Exports & Badge Usage

### JSON & SARIF 2.1.0 Export
From any scan report, click **Export JSON** or **Export SARIF** to download a deterministic report (with secrets automatically redacted). SARIF 2.1.0 exports integrate directly with GitHub Code Scanning and IDE SARIF viewers.

### Repository Badge
RepoCanary badges state `Scanned with RepoCanary · v1.0.0` and never claim a repository is `"safe"` or `"verified"`. Click **Share Card & Badge** on any Report to download the SVG badge or copy the Markdown snippet:

```markdown
[![Scanned with RepoCanary · v1.0.0](https://github.com/your-org/repocanary)](https://github.com/your-org/repocanary)
```

---

## Documentation Index

- [`SECURITY.md`](SECURITY.md) — Responsible disclosure policy and security architecture invariants.
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — Assets, trust boundaries, threat actors, and enforced security limits.
- [`docs/RULES.md`](docs/RULES.md) — Full rule catalog, context classification matrix, and `.repocanaryignore` guide.
- [`docs/EVALUATION.md`](docs/EVALUATION.md) — Precision and recall measured on our internal 30-sample benign corpus and 8-sample canary corpus.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Engineering and security decisions log.
- [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) — Pre-release verification and manual launch steps.

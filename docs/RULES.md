# RepoCanary Deterministic Rule Catalog (`v1.0.0`)

RepoCanary's detection engine (`src/core/`) is 100% deterministic TypeScript with zero network calls, zero DOM dependencies, and linear-time regular expressions.

---

## 1. Context Classification & Severity Adjustment

Before emitting any finding, RepoCanary classifies the target file into one of five contexts (`src/core/context.ts`):

| Context Category | File Patterns Matched | Severity Adjustment Rule |
| :--- | :--- | :--- |
| `mcp-config` | `.mcp.json`, `mcp.json`, `claude_desktop_config.json`, `.cursor/mcp.json`, `.vscode/mcp.json` | Elevated risk surface. Medium `INJ`, `EXF`, or `OBF` findings are promoted to `high`. |
| `agent-instructions` | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`, `.cursor/rules/*`, `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md` | Primary agent prompt surface. Retains full base severity; medium `INJ-002` secrecy directives are promoted to `high`. |
| `agent-skill` | `SKILL.md`, `skills/**`, `.claude/commands/**`, `.cursor/skills/**` | Agent skill/command definition surface. Retains full base severity. |
| `docs` | `README*`, `SECURITY.md`, `THREAT_MODEL.md`, `docs/**`, `*.md`, `*.mdx`, `*.rst`, `*.txt` | Human-facing documentation. Because security docs and educational articles frequently discuss prompt injection or reference `.env` / `~/.ssh`, `INJ-*`, `EXF-*`, and `OBF-*` rules are downgraded to `low` so documentation about prompt injection never triggers High or Critical alerts. Truly covert attacks (`UNI-002` Unicode Tag smuggling, `UNI-003` Bidi controls, `HID-001` HTML comment instructions) remain `critical`/`high`. |
| `generic` | All other source code and configuration files | Standard base severity. |

---

## 2. Rule Families & Rule Registry (18 Rules Across 8 Families)

| Rule ID | Family | Base Severity | Title | Description & Remediation |
| :--- | :--- | :--- | :--- | :--- |
| `UNI-001` | `UNI` | `medium` (`high` if >5 chars) | Zero-Width & Invisible Formatting Characters | Detects `U+200B`–`U+200F`, `U+2060`, and mid-line `U+FEFF` that split keywords to evade text search. **Fix:** Strip zero-width characters. |
| `UNI-002` | `UNI` | `critical` | Unicode Tag Block ASCII Smuggling (`U+E0000`–`U+E007F`) | Detects invisible Unicode Tag characters and decodes the smuggled ASCII text. **Fix:** Delete all `U+E0000`–`U+E007F` codepoints. |
| `UNI-003` | `UNI` | `critical` | Bidirectional (Bidi) Text Override Controls | Detects Trojan Source Bidi controls (`U+202A`–`U+202E`, `U+2066`–`U+2069`). **Fix:** Remove all Bidi control characters. |
| `UNI-004` | `UNI` | `high` | Mixed-Script Homoglyph Identifier Spoofing | Detects single tokens mixing Latin and Cyrillic/Greek confusable characters. **Fix:** Replace non-Latin lookalikes with standard ASCII. |
| `HID-001` | `HID` | `high` | Agent Directives Hidden Inside HTML Comments | Detects HTML comments (`<!-- ... -->`) containing imperative AI agent instructions. **Fix:** Remove directive language from comments. |
| `HID-002` | `HID` | `high` | Visually Hidden HTML / CSS Element | Detects `display:none`, `visibility:hidden`, `opacity:0`, `font-size:0`, or `hidden` attributes in Markdown/HTML. **Fix:** Remove hidden styling. |
| `HID-003` | `HID` | `medium` | Suspicious Instructions in Markdown Link/Image Attributes | Detects prompt-override directives stuffed inside Markdown image alt text or link titles. **Fix:** Keep alt/title attributes descriptive only. |
| `INJ-001` | `INJ` | `critical` (`low` in `docs`) | Explicit Instruction Override ("Ignore Previous Instructions") | Detects classic prompt override commands aimed at AI coding agents. **Fix:** Remove override phrases or add `.repocanaryignore` for test fixtures. |
| `INJ-002` | `INJ` | `high` (`low` in `docs`) | User-Deception & Secrecy Directive ("Do Not Tell the User") | Detects instructions telling the AI assistant to hide actions or suppress warnings from the human user. **Fix:** Remove secrecy directives. |
| `INJ-003` | `INJ` | `high` (`low` in `docs`) | System Prompt / Developer Role Impersonation | Detects fake `<system>`, `[SYSTEM PROMPT]`, or `END OF SYSTEM INSTRUCTIONS` delimiters. **Fix:** Remove fake system-prompt markers. |
| `EXF-001` | `EXF` | `critical` (`low` in `docs`) | Instruction to Read Local Secrets or Credential Files | Detects instructions directing an agent to read `.env`, `~/.ssh/id_rsa`, `~/.aws/credentials`, or cloud keys. **Fix:** Never instruct agents to read secret paths. |
| `EXF-002` | `EXF` | `critical` (`low` in `docs`) | Outbound Data Exfiltration Command or Webhook | Detects `curl`/`wget`/`fetch` commands or Markdown image beacons sending environment variables to external hosts. **Fix:** Remove outbound telemetry commands. |
| `MCP-001` | `MCP` | `critical` | MCP Tool Poisoning (Hidden Instructions in Tool Description) | Detects MCP tool `description` fields containing covert prompt injection or file-read directives. **Fix:** Audit MCP tool descriptions. |
| `MCP-002` | `MCP` | `high` | Unpinned `npx -y` / `uvx` Package or Shell Wrapper in MCP Config | Detects MCP servers executing unpinned remote packages (`npx -y pkg`) or raw shell wrappers (`bash -c`). **Fix:** Pin exact package versions and hashes. |
| `MCP-003` | `MCP` | `medium` (`high` for `/` root) | Plain-HTTP Remote MCP Server or Overly Broad Filesystem Root | Detects unencrypted `http://` MCP endpoints or filesystem servers mounted at `/` or `~`. **Fix:** Use `https://` and scope filesystem access to `./`. |
| `EXEC-001` | `EXEC` | `high` (`critical` if pipe-to-shell) | Suspicious `package.json` Lifecycle Hook (`preinstall` / `postinstall`) | Detects lifecycle scripts invoking `curl`, `wget`, `eval`, or `base64 -d`. **Fix:** Use `npm ci --ignore-scripts` and remove network hooks. |
| `EXEC-002` | `EXEC` | `high` | Auto-Run Workspace Task (`.vscode/tasks.json` / `devcontainer.json`) | Detects `"runOn": "folderOpen"` tasks or risky `postCreateCommand` hooks. **Fix:** Require manual task execution. |
| `OBF-001` | `OBF` | `high` (`low` in `docs`) | Encoded Base64 / Hex Payload Decoding to Agent Instructions | Purely decodes Base64 and Hex blobs without executing them and flags decoded text containing agent instructions or shell commands. **Fix:** Replace opaque blobs with readable source. |
| `SEC-001` | `SEC` | `medium` | Hardcoded API Key, Token, or Private Key Material (Redacted) | Detects `ghp_`, `sk-proj-`, `AKIA`, `AIza`, and PEM private keys, redacting the middle characters immediately. **Fix:** Revoke and rotate leaked credentials. |

---

## 3. `.repocanaryignore` Suppression Format

Place a `.repocanaryignore` file in the root of your repository (or configure custom patterns in **Settings**) to suppress expected findings in test fixtures or security documentation:

```gitignore
# Ignore an entire directory or file for all rules:
tests/canary-corpus/**
SECURITY.md

# Or scope a glob pattern to a specific Rule ID using :RULE-ID
docs/security-guide.md:INJ-001
```

Suppressed findings are excluded from the risk score and verdict, and the Report UI displays the exact count of suppressed findings (`N suppressed via .repocanaryignore`).

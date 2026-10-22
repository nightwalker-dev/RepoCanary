# Security Policy (`SECURITY.md`)

## Supported Versions

Only the latest `main` branch and current production release of **RepoCanary** receive security updates.

| Version | Supported |
| :--- | :--- |
| `1.0.x` (current) | Yes |
| `< 1.0.0` | No |

## Reporting a Vulnerability (Responsible Disclosure)

We take the security of RepoCanary seriously—especially because RepoCanary is designed to ingest untrusted, potentially adversarial repositories and text inputs.

1. **Do NOT open a public GitHub issue** for suspected security vulnerabilities.
2. **Use GitHub Private Vulnerability Reporting**: Navigate to the **Security** tab of this repository and click **"Report a vulnerability"** to open a private security advisory.
3. **What to include**:
   - A minimal proof-of-concept input (e.g., crafted text, `.zip` structure, or regex string) that reproduces the issue.
   - Expected vs. actual behavior and the affected module (`src/core`, `src/ingest`, `src/worker`, `src/ai`, or `src/ui`).
   - Potential impact (e.g., XSS, CSP bypass, ReDoS worker hang, zip-bomb bypass, or AI explainer prompt hijack).

### Response Targets
- **Initial Acknowledgment**: Within 48 hours.
- **Triage & Severity Assessment**: Within 5 business days.
- **Remediation & Coordinated Disclosure**: Within 14 days for High/Critical issues.

## Security Invariants Enforced in RepoCanary

- **Zero Dynamic Code Execution or Raw HTML Sinks**: `eval`, `new Function`, `innerHTML`, and `dangerouslySetInnerHTML` are strictly prohibited across the codebase and checked by automated CI tests (`tests/self-audit.test.ts`).
- **Content Security Policy (CSP)**: Enforced via `<meta http-equiv="Content-Security-Policy">` with `default-src 'self'` and `connect-src` limited strictly to `https://api.github.com`, `https://raw.githubusercontent.com`, and `https://generativelanguage.googleapis.com`.
- **Isolated Web Worker & Linear-Time Regexes**: All scanning runs in a dedicated Web Worker with a per-file time budget (`750ms`) and hard worker termination on timeout (`25s`).
- **Memory-Only BYOK API Keys**: Optional Gemini API keys are held in React component memory only by default, never written to `localStorage`, never logged, and sent exclusively via the `x-goog-api-key` HTTP header.

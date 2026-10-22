# RepoCanary Launch Checklist

Use this checklist before tagging a public release or publishing a repository announcement.

## 1. Automated Verification (Run Locally & in CI)
- [x] `npm run lint` passes (`tsc --noEmit` with zero errors).
- [x] `npm test` passes all unit, security-limits, self-audit, ReDoS, SARIF 2.1.0, and corpus evaluation suites.
- [x] `npm run build` produces a clean static bundle in `dist/` with no embedded secrets or API keys.
- [x] `npm audit --omit=dev` reports `0` known vulnerabilities in production dependencies.

## 2. Manual Pre-Launch Tasks (Required Before Public Release)
- [ ] **Pin GitHub Actions by full commit SHA:** In `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, and `.github/workflows/gitleaks.yml`, replace version tags (`actions/checkout@v4`, `actions/setup-node@v4`, `github/codeql-action/*@v3`, `gitleaks/gitleaks-action@v2`) with their verified full 40-character commit SHAs from GitHub.
- [ ] **Record the 10-second X-Ray Demo GIF:** Open RepoCanary, click **"Demo mode (10s guided reveal)"** on the Scanner landing page, record a 10-second screen capture showing the automatic transition from Scan -> Report -> X-Ray Split View -> X-Ray Diff View, and save it as `docs/demo-xray.gif` (if embedding in external release posts).
- [ ] **Verify Open Graph Social Preview:** After deploying to your static host, update `<meta property="og:image" content="https://<your-domain>/og-preview.svg" />` (or a rasterized `1200x630` PNG generated via the in-app **Share Card & Badge** exporter) and verify the card preview on social card validators.
- [ ] **Verify Zero-Network Offline Behavior in DevTools:**
  1. Open RepoCanary in Chrome/Firefox.
  2. Open DevTools (`F12`) -> **Network** tab -> Clear log.
  3. Click **"Try a sample attack"** or drop a local `.zip` archive.
  4. Confirm that **0 network requests** are transmitted during the entire scan and X-Ray inspection.
- [ ] **Configure Repository Settings on GitHub:**
  1. Enable **Private Vulnerability Reporting** under *Settings -> Code security and analysis* (referenced in `SECURITY.md`).
  2. Enable branch protection on `main` requiring the `ci`, `codeql`, and `gitleaks` workflows to pass.

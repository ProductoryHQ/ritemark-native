# Security Audit Report — Supply Chain & Dependency Analysis

**Date:** 2026-03-31
**Scope:** ritemark-native (all 3 package trees: root, extension, webview)
**Trigger:** Increasing frequency of npm supply chain attacks (ref: axios@1.14.1 compromise)

---

## Summary

| Area | Status |
|------|--------|
| Hardcoded secrets | CLEAN — all keys use OS keychain via VS Code SecretStorage |
| Registry sources | CLEAN — all 282 resolved packages from registry.npmjs.org |
| Install scripts | CLEAN — only esbuild + fsevents (legitimate) |
| Lock files committed | YES — all 3 package-lock.json tracked in git |
| .env gitignored | YES |
| Known vulnerabilities | 7 findings (see below) |
| Webview CSP | STRONG — nonce-based script-src, default-src 'none' |
| XSS protection | HARDENED — DOMPurify added to RenderedMarkdown |

---

## Vulnerability Findings

### HIGH severity

| Package | Issue | Fix |
|---------|-------|-----|
| `xlsx` ^0.18.5 | Prototype Pollution (GHSA-4r6h-8v6p-xvw6) + ReDoS (GHSA-5pgg-2g8v-p4x9) | **No fix available.** Consider migrating to `SheetJS Pro` or `exceljs`. Used in: excelDocument.ts, excelEditorProvider.ts |
| `rollup` 4.x | Arbitrary File Write via Path Traversal (GHSA-mw96-cpmx-2vgc) | `npm audit fix` in webview/ |
| `picomatch` <=2.3.1 | Method Injection + ReDoS (GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj) | `npm audit fix` in webview/ |

### MEDIUM severity

| Package | Issue | Fix |
|---------|-------|-----|
| `markdown-it` 13-14.1 | ReDoS (GHSA-38c4-r59v-3vqw) | `npm audit fix` in webview/ |
| `esbuild` <=0.24.2 | Dev server can be hijacked by any website (GHSA-67mh-4wv8-2f99) | Dev-only. Update vite to v8+ or esbuild to 0.25+ |

---

## Hardening Applied (this PR)

### 1. `.npmrc` — ignore-scripts + save-exact (all 3 package dirs)

```ini
ignore-scripts=true   # Blocks postinstall/preinstall supply chain vectors
save-exact=true        # New deps pinned to exact version (no ^ or ~)
audit=true             # npm audit runs on every install
```

**Why:** The #1 supply chain attack vector is malicious `postinstall` scripts that exfiltrate env vars or install backdoors. `ignore-scripts=true` blocks this entirely. When a legitimate package needs scripts (e.g., esbuild native binary), run: `npm install --ignore-scripts=false <package>`

### 2. DOMPurify on RenderedMarkdown

Added `dompurify` to sanitize all HTML from `marked.parse()` before rendering via `dangerouslySetInnerHTML`. Configured with explicit allowlists for tags and attributes, blocking `<script>`, `<iframe>`, `<style>`, event handlers, and `javascript:` URIs.

### 3. Audit scripts

```bash
npm run security:audit      # Check all 3 trees
npm run security:audit:fix  # Auto-fix where possible
```

---

## Recommended Follow-ups

### Priority 1: Replace xlsx

The `xlsx` package (SheetJS community edition) has unfixed vulnerabilities and the maintainer has moved fixes to a paid version. Options:
- **exceljs** — MIT, actively maintained, no known vulns
- **SheetJS Pro** — paid, but maintained
- Scope: `extensions/ritemark/src/excelDocument.ts`, `excelEditorProvider.ts`, webview

### Priority 2: Pin existing dependencies to exact versions

All 89 dependencies currently use caret ranges (`^`). While lock files prevent phantom updates during `npm ci`, a fresh `npm install` (without lock file) could pull compromised minor/patch versions. Running `save-exact=true` in `.npmrc` ensures all *future* deps are pinned. For existing deps, a bulk pin can be done:

```bash
# Convert all ^ to exact in package.json (manual review recommended)
npx npm-check-updates --target minor --upgrade
npm install
```

### Priority 3: Subresource Integrity (SRI)

If any webview resources are loaded from CDN in the future, implement SRI hashes.

### Priority 4: Dependency review automation

Consider adding to CI:
- `npm audit --audit-level=high` as a blocking check
- Socket.dev or Snyk for deeper supply chain analysis
- Renovate/Dependabot for automated security updates

---

## What We're Already Doing Right

1. **VS Code SecretStorage** for all API keys (OS keychain)
2. **Nonce-based CSP** on every webview (7 providers)
3. **No eval()** anywhere in the codebase
4. **API keys never sent to webview** — only boolean flags
5. **Agent context excludes** .env, credentials, .pem, .key files
6. **PostHog analytics** uses anonymous UUID, no PII
7. **Mermaid** runs in `securityLevel: 'strict'`
8. **External URLs** delegated to VS Code's `env.openExternal()` with URI validation
9. **Lock files committed** and at lockfileVersion 3

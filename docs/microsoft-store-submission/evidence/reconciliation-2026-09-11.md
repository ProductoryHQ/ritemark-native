# Hosting and Store documentation reconciliation — 2026-09-11

PR #275 supplied the v1.10.1 candidate 3 Windows audit and four screenshots. PR #277 supplies the later 2026-09-10 publication evidence; its anonymous download matched SHA-256 `93f9adce13529c727cbb4b407822897f0043d65c62ff5dab0eab95fc54d77250` and 436614200 bytes. Earlier “upload pending” statements are superseded.

Read-only HTTPS HEAD requests on 2026-09-11 returned HTTP 200 for both versioned objects. v1.10.1 returned 436614200 bytes, executable content type, attachment disposition and `public, max-age=31536000, immutable`; Last-Modified was 2026-09-10T17:27:54Z. v1.10.0 retained its 430929984-byte size and 2026-09-07T11:19:26Z Last-Modified. No redirects or cookies were returned. This recheck did not repeat the full download/hash or inspect the dashboard lock configuration; those checks retain their original evidence dates.

Validation of the reconciled repository changes:

- `npm run test:store-hosting`: 5 passed, 0 failed.
- `bash -n scripts/publish-store-installer-interactive.sh`: passed.
- `git diff --check`: passed.
- `./scripts/validate-qa.sh` with installed Node 22.22.1: passed, including the VS Code TypeScript check. No dependency installation was performed. The interrupted 2026-09-07 QA attempt was not a pass; this successful run supersedes it.

This is release-independent distribution tooling and documentation, not a new product release or sprint implementation. No product release note is needed. Clean Windows 11 testing, final screenshot/Store approval and Partner Center work remain open. No installer bytes or external hosting settings changed during reconciliation.

# Ritemark v1.10.0 pre-release audit

**Audit date:** 2026-09-03<br>
**Audit source:** invalidated candidates through clean `main` at `117e29608501665b8a0cc2042b3b6da6e6eb5ad4` plus focused correction branch `codex/fix-runtime-availability-fallback`<br>
**Gate 1 source:** not fixed yet; merge the provider-isolation/runtime correction, synchronize clean `main`, and record that exact commit before rebuilding<br>
**Latest public release:** v1.9.0  
**Next valid version:** v1.10.0  
**Verdict:** **RELEASE BLOCKED; no existing DMG contains both provider-isolated fallback and a service-compatible bundled Codex runtime, so Gate 1 must restart after the correction merges**

## Passed evidence

- Sprints 109–115 are merged into `main`; Sprint 114 repository work is merged and its external gates remain tracked in #212.
- `./scripts/validate-qa.sh` passes on the consolidated release scope.
- Full `./scripts/release-preflight.sh` passes with zero errors and zero warnings on clean synchronized merged `main` (2026-08-29); the Developer ID certificate is present.
- Branding, extension, lockfile, and Windows installer defaults agree on `1.10.0`.
- The corrected manifest pins official Codex `0.153.0` app-server and code-mode-host components across all three targets with published SHA-256 values. Manifest and mutation gates pass; the fetched arm64 pair matches its checksums/architecture, the app-server reports `0.153.0`, and the adjacent code-mode host starts with its supported `--help` probe.
- Fresh-profile RUNDEV Settings reports `Codex · Ready · Bundled with app · v0.153.0`. A real GPT-5.6-Sol no-write turn returned the requested exact answer without the `0.149.0` newer-client or `max` effort-decoding failures. Injected Claude `needs-auth` then preserved the transcript and Composer, displayed `Sign in` plus rightmost `Use Codex`, and switched explicitly back to the ready provider.
- The invalidated arm64 production build passed the old bundled-extension and post-build checks with only three agent binaries. That historical pass is evidence of the validator gap, not release evidence: the old manifest did not model Codex's required code-mode host.
- The invalidated `Ritemark.app` is Developer ID signed with Team ID `JKBSC3ZDT5`, hardened runtime, and a secure timestamp, but signature validity does not make an incomplete runtime package releasable.
- No closed `agent-pr-open` issues were found after the v1.9.0 publication date.
- The extension-host and webview production trees both pass `npm audit --omit=dev` with zero findings after the reviewed dependency hardening below.
- SheetJS is pinned to the official `xlsx@0.20.3` CDN tarball in both consumers. CJS and ESM workbook write/read round-trips pass.
- Extension compile, webview typecheck/build, Mermaid export, and ProseMirror Markdown parse/serialize through the `markdown-it@15.0.0` override pass on Node 22.22.1.

Every existing v1.10.0 DMG through `main` commit `117e2960` is invalidated. Do not notarize, publish, or reuse its Gate 1 evidence. Production packaging must start again from the merged correction on a clean synchronized `main` tree.

## Resolved findings and decisions

### R4 — Provider availability is isolated; Codex must match the live service

Authentication and readiness are provider-scoped. A signed-out Claude account
no longer replaces a usable Agent Chat when ChatGPT/Codex is connected. One
normalized availability state drives setup gating, Composer Send, recovery,
and explicit fallback; existing conversations never switch silently, later
status refreshes cannot rebind them, and logout releases only that provider's
sessions.

The earlier bundled Codex `0.149.0` is separately invalidated: a real GPT-5.6
turn produced the service's newer-runtime requirement and the old runtime could
not decode the current `max` effort value. Official `0.153.0` preserves the
Ritemark-consumed protocol subset and passes the authenticated arm64 RUNDEV
canary. This correction is not a credential workaround; it updates the exact
release runtime contract.

### R3 — Codex file tools require a separately packaged sibling component

The bundled `codex-app-server 0.149.0` starts normally, but Code Mode launches
`codex-code-mode-host` from the same directory when a turn uses file tools. The
candidate omitted that executable, and installed-app logs record an `os error
2` at the exact expected path. OpenAI publishes signed, version-matched host
archives for every Ritemark release target.

Manifest schema 2 now models components rather than assuming one executable per
agent/platform. Codex requires both `app-server` and `code-mode-host`; a missing
component, duplicate or noncanonical target install name, checksum mismatch, wrong archive
layout, wrong architecture, or unsupported smoke argument blocks fetch/build.
The Windows installer preflight also reads the manifest rather than checking a
stale hand-written binary list.

### R1 — Finder-layout timeout has an approved deterministic packaging route

`./scripts/create-dmg.sh` mounted the image and reached its canonical Finder-layout step, but Finder stopped answering AppleEvents and returned `-1712` (`AppleEvent timed out`). Restarting Finder did not restore AppleEvent responsiveness. The failed 2.8 GB `rw.*.dmg` temporary image was removed; the signed app bundle remains intact.

This is a packaging-session limitation, not an app-integrity failure. v1.8.2 and v1.8.6 already shipped through the repository's recorded Finder-free `ditto` + `hdiutil create` + compressed-convert path. Jarmo authorized the technically strongest release route on 2026-08-25. For v1.10.0, retrying the decorative Finder layout is optional; a deterministic Finder-free image is accepted for Gate 1 only when it is Developer ID signed and passes the same signature, version, architecture, bundled-runtime, mount/content, zero-byte, timestamp, and checksum checks. Jarmo tests that signed/unnotarized DMG. Notarization/stapling and Gatekeeper verification happen only after his approval and the full 60-minute no-new-bug window; a rebuild resets both the clock and Gate 1.

### R2 — Production dependency advisories are closed

The reviewed fixes are:

| Surface | Resolution |
|---|---|
| Extension host | `fast-uri@3.1.6`, `@xmldom/xmldom@0.8.15`, `js-yaml@3.15.1`, and `nanoid@5.1.16` exact transitive overrides |
| Spreadsheet parsing | `xlsx@0.20.3` exact tarball URL from SheetJS's authoritative CDN in both package manifests |
| Webview rendering | `mermaid@11.17.1`, `dompurify@3.4.14`, `markdown-it@15.0.0`, and `linkify-it@6.1.0` exact pins/overrides |

SheetJS documents `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` as the official Node/bundler install target; the abandoned npm-registry package is not used. The lockfiles record the fetched integrity. No blind `npm audit fix` was used.

The full webview audit still reports development-only toolchain advisories under Vite 5/Babel/PostCSS. They are absent from `npm audit --omit=dev` and the packaged dependency inventory. A Vite major migration is intentionally deferred until after v1.10.0 rather than changing the release compiler at RC without product benefit.

## Release-time gates still open

- Merge the provider-isolation and Codex 0.153 correction, synchronize clean `main`, and build/sign/package a fresh unnotarized arm64 candidate from the exact resulting merge commit.
- Prove a real Codex file create/edit/read turn in the exact packaged candidate and confirm no missing-host error appears in its logs.
- Residual v1.10.0 manual feature/regression rows in `TEST-CHECKLIST.md`.
- Jarmo's test of the exact signed/unnotarized and technically verified arm64 DMG plus the 60-minute no-new-bug hardening period from its build timestamp, followed by notarization/stapling and final Gatekeeper verification.
- Signed x64 macOS and Windows CI candidates, Windows SAC-On test, and Gate 2.
- Immutable Windows hosting, Microsoft Store certification, exact-hash approval, and canonical update-feed publication.

## Smallest safe next actions

1. Complete review and native-platform CI for the provider-isolation/runtime correction; merge it and synchronize clean `main`.
2. Confirm repository QA and release preflight remain clean, then build and sign arm64 from that exact `main` commit.
3. Verify both Codex components are signed in the app, package the DMG, mount it, and run the signature/content/version/architecture checks plus a real packaged Codex file-tool canary.
4. Ask Jarmo to test only that replacement signed/unnotarized DMG. Record its hash and build timestamp; notarize/staple only after approval and the full 60-minute window, then complete the final Gatekeeper/mount/published-hash checks.

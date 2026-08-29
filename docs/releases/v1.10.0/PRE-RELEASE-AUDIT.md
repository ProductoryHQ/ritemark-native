# Ritemark v1.10.0 pre-release audit

**Audit date:** 2026-08-29<br>
**Source:** clean merged `main` after focused RC fixes and release-gate reconciliation; record the exact commit when the Gate 1 build starts<br>
**Latest public release:** v1.9.0  
**Next valid version:** v1.10.0  
**Verdict:** **RELEASE HARDENING PASSED; fresh `main` build and Gate 1 candidate still required**

## Passed evidence

- Sprints 109–115 are merged into `main`; Sprint 114 repository work is merged and its external gates remain tracked in #212.
- `./scripts/validate-qa.sh` passes on the consolidated release scope.
- Full `./scripts/release-preflight.sh` passes with zero errors and zero warnings on clean synchronized merged `main` (2026-08-29); the Developer ID certificate is present.
- Branding, extension, lockfile, and Windows installer defaults agree on `1.10.0`.
- The arm64 runtime matrix passes without skips: Claude Code 2.1.239, OpenCode 1.18.21, and Codex app-server 0.149.0 report the manifest versions; OpenCode write pause/deny/allow and cancel all pass.
- The arm64 production build passes the bundled-extension and post-build checks. The app contains `ritemarkVersion: 1.10.0`, an 8,304,024-byte webview bundle, a 5,743,238-byte extension bundle, 233 packaged dependency manifests, and the three correct-architecture agent binaries. No zero-byte JavaScript output exists.
- `Ritemark.app` is Developer ID signed with Team ID `JKBSC3ZDT5`, hardened runtime, a secure timestamp, and 46 signed components with zero signing failures.
- No closed `agent-pr-open` issues were found after the v1.9.0 publication date.
- The extension-host and webview production trees both pass `npm audit --omit=dev` with zero findings after the reviewed dependency hardening below.
- SheetJS is pinned to the official `xlsx@0.20.3` CDN tarball in both consumers. CJS and ESM workbook write/read round-trips pass.
- Extension compile, webview typecheck/build, Mermaid export, and ProseMirror Markdown parse/serialize through the `markdown-it@15.0.0` override pass on Node 22.22.1.

The signed app above was built before dependency hardening and from the RC branch. It is preview evidence only and is not a Gate 1 candidate. Production packaging must start again from the merged, clean, synchronized `main` tree.

## Resolved findings and decisions

### R1 — Finder-layout timeout has an approved deterministic packaging route

`./scripts/create-dmg.sh` mounted the image and reached its canonical Finder-layout step, but Finder stopped answering AppleEvents and returned `-1712` (`AppleEvent timed out`). Restarting Finder did not restore AppleEvent responsiveness. The failed 2.8 GB `rw.*.dmg` temporary image was removed; the signed app bundle remains intact.

This is a packaging-session limitation, not an app-integrity failure. v1.8.2 and v1.8.6 already shipped through the repository's recorded Finder-free `ditto` + `hdiutil create` + compressed-convert path. Jarmo authorized the technically strongest release route on 2026-08-25. For v1.10.0, retrying the decorative Finder layout is optional; a deterministic Finder-free image is accepted only when it is DMG-signed, notarized, stapled, and passes the same signature, version, architecture, bundled-runtime, mount/content, zero-byte, Gatekeeper, and checksum checks. Jarmo's Gate 1 test uses those exact final verified bytes; no notarization or other artifact mutation occurs after approval.

### R2 — Production dependency advisories are closed

The reviewed fixes are:

| Surface | Resolution |
|---|---|
| Extension host | `fast-uri@3.1.5`, `js-yaml@3.15.1`, and `nanoid@5.1.16` exact transitive overrides |
| Spreadsheet parsing | `xlsx@0.20.3` exact tarball URL from SheetJS's authoritative CDN in both package manifests |
| Webview rendering | `mermaid@11.17.1`, `dompurify@3.4.14`, `markdown-it@15.0.0`, and `linkify-it@6.1.0` exact pins/overrides |

SheetJS documents `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` as the official Node/bundler install target; the abandoned npm-registry package is not used. The lockfiles record the fetched integrity. No blind `npm audit fix` was used.

The full webview audit still reports development-only toolchain advisories under Vite 5/Babel/PostCSS. They are absent from `npm audit --omit=dev` and the packaged dependency inventory. A Vite major migration is intentionally deferred until after v1.10.0 rather than changing the release compiler at RC without product benefit.

## Release-time gates still open

- Merge the release-gate reconciliation PR, synchronize clean `main`, and build/sign/package/notarize/staple a fresh arm64 candidate from the exact resulting merge commit.
- Residual v1.10.0 manual feature/regression rows in `TEST-CHECKLIST.md`.
- Jarmo's test of the exact signed/notarized/stapled and technically verified arm64 DMG plus the 60-minute no-new-bug hardening period from its final bytes.
- Signed x64 macOS and Windows CI candidates, Windows SAC-On test, and Gate 2.
- Immutable Windows hosting, Microsoft Store certification, exact-hash approval, and canonical update-feed publication.

## Smallest safe next actions

1. Merge the reviewed release-gate reconciliation, synchronize clean `main`, and confirm release preflight remains clean.
2. Build and sign arm64 from `main`; package with the Finder layout if responsive, otherwise use the explicitly approved deterministic `ditto`/`hdiutil` route.
3. Sign, notarize, staple, mount, and run every hard check against the exact final DMG before asking Jarmo to test it.
4. Record the final candidate hash and timestamp. Any rebuild or post-test mutation resets the candidate timestamp and Gate 1 evidence.

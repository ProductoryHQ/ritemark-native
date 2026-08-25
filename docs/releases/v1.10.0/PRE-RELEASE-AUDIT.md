# Ritemark v1.10.0 pre-release audit

**Audit date:** 2026-08-25  
**Source:** `codex/v1.10.0-rc-prep@3640aa3`  
**Latest public release:** v1.9.0  
**Next valid version:** v1.10.0  
**Verdict:** **RELEASE BLOCKED before Gate 1**

## Passed evidence

- Sprints 109–115 are merged into `main`; Sprint 114 repository work is merged and its external gates remain tracked in #212.
- `./scripts/validate-qa.sh` passes on the consolidated release scope.
- Full `./scripts/release-preflight.sh` passes with only the expected release-branch/uncommitted-state warnings before the version commits were pushed.
- Branding, extension, lockfile, and Windows installer defaults agree on `1.10.0`.
- The arm64 runtime matrix passes without skips: Claude Code 2.1.239, OpenCode 1.18.21, and Codex app-server 0.149.0 report the manifest versions; OpenCode write pause/deny/allow and cancel all pass.
- The arm64 production build passes the bundled-extension and post-build checks. The app contains `ritemarkVersion: 1.10.0`, an 8,304,024-byte webview bundle, a 5,743,238-byte extension bundle, 233 packaged dependency manifests, and the three correct-architecture agent binaries. No zero-byte JavaScript output exists.
- `Ritemark.app` is Developer ID signed with Team ID `JKBSC3ZDT5`, hardened runtime, a secure timestamp, and 46 signed components with zero signing failures.
- No closed `agent-pr-open` issues were found after the v1.9.0 publication date.

## Blocking findings

### B1 — Standard arm64 DMG was not produced

`./scripts/create-dmg.sh` mounted the image and reached its canonical Finder-layout step, but Finder stopped answering AppleEvents and returned `-1712` (`AppleEvent timed out`). Restarting Finder did not restore AppleEvent responsiveness. The failed 2.8 GB `rw.*.dmg` temporary image was removed; the signed app bundle remains intact.

Do not use `--sandbox-safe`, a plain `hdiutil` image, or another simplified layout as a release candidate. Gate 1 requires the standard signed, un-notarized DMG and mounted-image hard checks.

### B2 — Production dependency advisories need explicit security disposition

The 2026-08-25 production-only npm audits are not clean:

| Surface | High findings | Directly relevant use |
|---|---|---|
| Extension host | `fast-uri`, `js-yaml`, `nanoid`, `xlsx` | `xlsx@0.18.5` parses local spreadsheet/CSV content; the other three have registry fixes available |
| Webview | `linkify-it`, `xlsx` | Markdown/link scanning and spreadsheet parsing operate on user-controlled document content |
| Webview moderate | `dompurify`, `markdown-it`, `mermaid` | Markdown and Mermaid are rendered inside the document webview |

`fast-uri`, `js-yaml`, `nanoid`, `dompurify`, `linkify-it`, `markdown-it`, and `mermaid` report an available registry fix. `xlsx@0.18.5` reports prototype-pollution and ReDoS advisories with no npm-registry fix. Do not run an unreviewed `npm audit fix`; decide the replacement/containment and regression matrix explicitly before shipping.

## Release-time gates still open

- Residual v1.10.0 manual feature/regression rows in `TEST-CHECKLIST.md`.
- Jarmo's test of the exact signed, un-notarized arm64 DMG and the 60-minute no-new-bug hardening period.
- Signed x64 macOS and Windows CI candidates, Windows SAC-On test, and Gate 2.
- Immutable Windows hosting, Microsoft Store certification, exact-hash approval, and canonical update-feed publication.

## Smallest safe next actions

1. Resolve the dependency-security disposition in a dedicated release-hardening scope; rebuild if shipping dependencies change.
2. Retry the unchanged canonical DMG script in a responsive Finder GUI session.
3. Mount the resulting DMG and run all hard checks before asking Jarmo to test it.
4. Any rebuild resets the candidate timestamp and Gate 1 evidence.


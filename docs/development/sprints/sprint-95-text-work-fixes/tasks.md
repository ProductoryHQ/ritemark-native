# Sprint 95 Tasks

## #103 — chat composer attachment feedback — DONE
- [x] Non-image attachment chip is now a `w-14 h-14` card (same size as an image thumbnail) with a `file-text` icon + the file extension label — `ChatInput.tsx`. Fixes the invisible `h-7` chip and the wrong `file-image` icon for text/markdown.
- [ ] Visual confirmation in the app (host-driven: paperclip → pick a `.md`/`.txt` → the chip is obvious) — Jarmo QA.

## #135 — chat history sessions collapsing — DONE
Root cause: the "+ new chat" path (`ritemark.newChat` → `clear-chat` message) reset the chat content but NOT `currentConversationId`, and did not save the current session — so the next session reused the same id and OVERWROTE the previous entry.
- [x] `case 'clear-chat'` now routes to `startNewConversation()` (saves the current session + resets the id) — `store.ts`.
- [x] `startNewConversation` saves even when `currentConversationId` is still null (persist runs on agent results; without this an un-persisted session was lost).
- [x] `clearChat` (`/clear`) also resets `currentConversationId` so a new message doesn't overwrite the cleared conversation.
- [x] 2 regression tests in `conversationReset.test.ts` (new-chat + /clear both reset the id); 5 existing tests still pass.
- [ ] Multi-session confirmation in the app (start chat → +new → chat → History shows 2 entries) — Jarmo QA.

## #142 — seamless `-ext.N` update never loads — DONE (code); end-to-end is post-release
Root cause: `X.Y.Z-ext.N` is a semver PRE-RELEASE that ranks BELOW bundled `X.Y.Z` in VS Code's scanner, so the built-in always won. Fix: ship the *bundled* extension as `X.Y.Z-0` — a numeric pre-release identifier (`0`) sorts below alphanumeric `ext`, so `X.Y.Z-0` < `X.Y.Z-ext.N` in BOTH VS Code's semver and Ritemark's resolver.

**Implementation: adopted PR #144's build-time-floor architecture** (Jarmo call 2026-07-15) over an earlier in-source `-0` variant. The SOURCE `package.json` stays a clean `X.Y.Z` (`1.8.3`); a build step floors only the bundled copy to `X.Y.Z-0`. This keeps the repo free of a `-0` suffix and means the release process never has to remember it. PR #144 and #148 closed as superseded by this sprint.
- [x] `scripts/floor-bundled-extension.sh` — stamps a bundled extension copy's `package.json` to `X.Y.Z-0` (strips any existing suffix first, verifies the result). New shell-tier script.
- [x] Wired into every bundle-assembling path: `scripts/build-prod.sh`, `scripts/build-prod-windows.sh`, `.github/workflows/build-macos-x64.yml`, `.github/workflows/build-windows.yml` (additive-only — no existing v1.8.1 VS2026 / graceful-fs / signing logic disturbed).
- [x] `versionComparison.ts`: full standard-semver pre-release precedence (`preRelease: string[]`, numeric < alphanumeric, plain release outranks any pre-release) so the runtime resolver AGREES with VS Code's scanner. 10 asserts in `versionComparison.test.ts` (wired into `npm test` — a gap #144 itself left).
- [x] Source `package.json` version = clean **`1.8.3`** (floored to `1.8.3-0` only in the bundle at build time — verified with a floor-script dry-run).
- [x] Bug A (infinite "Restart required"): `reconcilePendingRestartVersion` clears the pending when the staged version is no longer installed (via existing `listInstalledVersions`) so the banner can't loop — `updateService.ts`.
- [x] Bug B (staged update deleted): `cleanupOldVersions` preserves any version NEWER than everything in the keep list (a staged update awaiting restart), solved at source in `userExtensionInstaller.ts` — no `activationIntegrity.ts`/`extension.ts` plumbing needed.
- [x] All existing update tests (`updateResolver`/`updateService`/`activationIntegrity`) still pass with #144's resolver.
- [ ] **End-to-end validation is POST-RELEASE and cannot be done in dev mode:** after v1.8.3 ships as a DMG, publish a `v1.8.3-ext.1` to the canonical feed and confirm it (a) loads over the bundled `1.8.3-0`, (b) clears the restart banner, (c) does not delete the staged dir. Intentionally-deferred QA — flag for `release-manager`.

## Release note
- **Release-tier: this sprint is now SHELL-TIER** (touches `scripts/build-prod.sh` + CI). v1.8.3 ships as a **full DMG** regardless (it CONTAINS the #142 fix, so it can't ride the still-broken fast lane).
- Scheme the build now maintains automatically: source `X.Y.Z` → bundled `X.Y.Z-0` (floor script) → extension-tier updates `X.Y.Z-ext.N`. Document in `RELEASING.md` / the release skill.
- **Superseded PRs:** close [#144](https://github.com/ProductoryHQ/ritemark-native/pull/144) (its #142 code is adopted here) and [#148](https://github.com/ProductoryHQ/ritemark-native/pull/148) (its #103 fix duplicates Sprint 95's) once this branch merges.

## Closeout
- [ ] `qa-validator` before merge.
- [ ] Merge → `main`.
- [ ] Update `releases/v1.8.3/release-plan.md` tracker + CHANGELOG; comment #103/#135/#142.

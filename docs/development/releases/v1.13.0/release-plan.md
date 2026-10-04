# Release Plan — v1.13.0 Minor Improvements

**Status:** Open (2026-10-04). Collecting small fixes; nothing merged yet.<br>
**Target:** v1.13.0<br>
**GitHub milestone:** [v1.13.0](https://github.com/ProductoryHQ/ritemark-native/milestone/12)<br>
**Release type:** Provisionally **extension-tier**. Every PR listed below changes only extension source, built bundles, tests, docs or the Claude harness; none touches a shell-tier path. The tier is set at release time from everything merged. Any shell-tier merge (for example a bundled agent binary bump) makes it a full app release.<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-04<br>
**Source:** Paper cuts found in everyday use of v1.12.0 (issues #369, #375, #378) and AI side bar layout fixes at the default 300 px width.

## Release Thesis

No new features. v1.13.0 fixes things v1.12.0 users run into in normal work: a Codex conversation that fails on its first prompt, a word count that goes stale after an agent edit, conversation titles cut to ten characters, menus hidden under the conversation rail, and Word tables without padding.

## Candidate PRs

| PR | What it fixes | Decision | Before merge |
|---|---|---|---|
| [#379](https://github.com/ProductoryHQ/ritemark-native/pull/379) | Codex model list ignores `models_cache.json` written by another Codex version; a new conversation starts on the catalog default (#375) | **Merge** | Nothing. The changelog note from the Codex review goes into the release notes |
| [#380](https://github.com/ProductoryHQ/ritemark-native/pull/380) | Word count, Contents and comment markers follow agent and disk edits; count no longer drops a word per block; status bar follows the active tab (#378) | **Merge** | Register `docChange.test.ts` in `npm test` (Codex review P2) |
| [#381](https://github.com/ProductoryHQ/ritemark-native/pull/381) | Conversation list titles use the whole row and wrap to two lines | **Merge** | Check the Codex P2 claim that hover buttons overlap a title's last line by ~3.5 px; fix if visible |
| [#382](https://github.com/ProductoryHQ/ritemark-native/pull/382) | Composer menus and `/` `@` popups fit beside the conversation rail | **Merge** | Codex skill mirror is left to the harness equalizer (CLAUDE → CODEX) |
| [#370](https://github.com/ProductoryHQ/ritemark-native/pull/370) | Word preview pads unstyled table cells like Word (#369) | **Merge after fix** | Rebuild `media/office-preview.js` (the PR changes source only, so users would get nothing); match `w:default`/`w:type` in any order; apply to headers, footers and notes |
| [#374](https://github.com/ProductoryHQ/ritemark-native/pull/374) | `CLAUDE.md` / `architecture.md` describe the current model config split | **Merge** (docs only, not in the release notes) | Nothing |

### Merge order

All five code PRs rebuild `media/webview.js` and three rebuild `media/office-preview.js`, so built bundles conflict between them. Merge one at a time; after each merge, rebase the next PR on `main`, rebuild the bundles and let the pre-commit validator pass:

1. #374 (docs, no conflict)
2. #379
3. #380
4. #381
5. #382
6. #370 (after its fix; rebuilds `office-preview.js` last)

Every merge to `main` needs Jarmo's admin-merge approval per PR number.

## Work in progress that may join

- **Composer footer in a narrow AI side bar** — running session, no PR yet. Overlaps #382 (footer breakpoint); rebase on #382 once it is merged.
- **Model button shows the previous Claude model** — running session, no PR yet.
- **#376 Codex errors shown as raw JSON** — issue with a proposed card design, no PR. Pairs well with #379.

## Out of scope

- Ritemark web PRs (`ritemark-web` repo) — separate repo, separate deploys.
- #377 (ask Ritemark's own Codex for its model list) — larger change, later release.

## Gates

- **Extension-tier:** `./scripts/release-extension-preflight.sh`, then `./scripts/release-extension.sh 1.13.0`; Jarmo tests through "Relaunch to update" or a dev path and gives the approval phrase.
- **If it becomes shell-tier:** clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window (see `release-manager`).
- `main` is frozen from the first release-candidate build until publish.

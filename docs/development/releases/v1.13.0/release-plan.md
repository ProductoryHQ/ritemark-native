# Release Plan — v1.13.0 Minor Improvements

**Status:** Open. **All six candidate PRs merged 2026-10-04** (`main` at `bc8904c5`); `npm test` and both typechecks pass on `main`. Issues #369, #375 and #378 are closed. Two fixes still in progress may join (below); Jarmo decides when to cut the release candidate<br>
**Target:** v1.13.0<br>
**GitHub milestone:** [v1.13.0](https://github.com/ProductoryHQ/ritemark-native/milestone/12)<br>
**Release type:** Provisionally **extension-tier**. Every PR listed below changes only extension source, built bundles, tests, docs or the Claude harness; none touches a shell-tier path. The tier is set at release time from everything merged. Any shell-tier merge (for example a bundled agent binary bump) makes it a full app release.<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-04<br>
**Source:** Paper cuts found in everyday use of v1.12.0 (issues #369, #375, #378) and AI side bar layout fixes at the default 300 px width.

## Release Thesis

No new features. v1.13.0 fixes things v1.12.0 users run into in normal work: a Codex conversation that fails on its first prompt, a word count that goes stale after an agent edit, conversation titles cut to ten characters, menus hidden under the conversation rail, and Word tables without padding.

## Merged

| PR | Commit | What it fixes | Done at merge |
|---|---|---|---|
| [#374](https://github.com/ProductoryHQ/ritemark-native/pull/374) | `2f167d57` | `CLAUDE.md` / `architecture.md` describe the current model config split (docs only, not in the release notes) | — |
| [#379](https://github.com/ProductoryHQ/ritemark-native/pull/379) | `bded4aa5` | Codex model list ignores `models_cache.json` written by another Codex version; a new conversation starts on the catalog default (#375) | Changelog note goes into the release notes |
| [#380](https://github.com/ProductoryHQ/ritemark-native/pull/380) | `15c2558c` | Word count, Contents and comment markers follow agent and disk edits; count no longer drops a word per block; status bar follows the active tab (#378) | `docChange.test.ts` registered in `npm test` |
| [#381](https://github.com/ProductoryHQ/ritemark-native/pull/381) | `f712b91b` | Conversation list titles use the whole row and wrap to two lines | Hover buttons made 24 px tall and moved 2 px lower so they no longer cover the title's last line (was 3.5 px). Checked by measurement only — **check with the mouse in the release test** |
| [#382](https://github.com/ProductoryHQ/ritemark-native/pull/382) | `aab8731e` | Composer menus and `/` `@` popups fit beside the conversation rail | `composerMenus.test.ts` kept in `npm test` after the merge conflict. Codex skill mirror left to the harness equalizer |
| [#370](https://github.com/ProductoryHQ/ritemark-native/pull/370) | `bc8904c5` | Word preview pads unstyled table cells like Word (#369) | `office-preview.js` rebuilt (the PR had source only); default table style found in any attribute order; margins applied in headers, footers and notes, with tests |

Each PR was rebased on `main`, its bundles rebuilt and the pre-commit validator passed before it was merged.

## Work in progress that may join

- **Composer footer in a narrow AI side bar** — running session, no PR yet. Overlaps #382 (footer breakpoint). Told on 2026-10-04 that #382 is merged and to rebase before opening a PR.
- **Model button shows the previous Claude model** — running session, no PR yet.
- **#376 Codex errors shown as raw JSON** — issue with a proposed card design, no PR. Pairs well with #379.

## Out of scope

- Ritemark web PRs (`ritemark-web` repo) — separate repo, separate deploys.
- #377 (ask Ritemark's own Codex for its model list) — larger change, later release.

## Gates

- **Extension-tier:** `./scripts/release-extension-preflight.sh`, then `./scripts/release-extension.sh 1.13.0`; Jarmo tests through "Relaunch to update" or a dev path and gives the approval phrase.
- **If it becomes shell-tier:** clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window (see `release-manager`).
- `main` is frozen from the first release-candidate build until publish.

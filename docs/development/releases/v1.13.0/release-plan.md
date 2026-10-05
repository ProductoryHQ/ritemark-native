# Release Plan — v1.13.0 Minor Improvements

**Status:** Open (2026-10-05). Fix PRs, the runtime update and Sonnet 5.5 are merged (`main` at `9975c828`). **Sprint 128** (background agent turns) is planned and waits for Jarmo's plan approval; the release candidate follows it<br>
**Target:** v1.13.0<br>
**GitHub milestone:** [v1.13.0](https://github.com/ProductoryHQ/ritemark-native/milestone/12)<br>
**Release type:** **Shell-tier** (set 2026-10-04). Jarmo approved updating every bundled agent runtime in this release ([#386](https://github.com/ProductoryHQ/ritemark-native/pull/386) changes `extensions/ritemark/binaries/agents/`), so v1.13.0 is a full app release: clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, Windows CI. The six merged PRs are extension-tier on their own<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-04<br>
**Source:** Paper cuts found in everyday use of v1.12.0 (issues #369, #375, #378), AI side bar layout fixes at the default 300 px width, and the per-release runtime review.

## Release Thesis

Small release. v1.13.0 brings Sonnet 5.5 and current agent runtimes, and fixes things v1.12.0 users run into in normal work: a Codex conversation that fails on its first prompt, a word count that goes stale after an agent edit, conversation titles cut to ten characters, menus hidden under the conversation rail, and Word tables without padding.

## Merged

| PR | Commit | What it fixes | Done at merge |
|---|---|---|---|
| [#374](https://github.com/ProductoryHQ/ritemark-native/pull/374) | `2f167d57` | `CLAUDE.md` / `architecture.md` describe the current model config split (docs only, not in the release notes) | — |
| [#379](https://github.com/ProductoryHQ/ritemark-native/pull/379) | `bded4aa5` | Codex model list ignores `models_cache.json` written by another Codex version; a new conversation starts on the catalog default (#375) | Changelog note goes into the release notes |
| [#380](https://github.com/ProductoryHQ/ritemark-native/pull/380) | `15c2558c` | Word count, Contents and comment markers follow agent and disk edits; count no longer drops a word per block; status bar follows the active tab (#378) | `docChange.test.ts` registered in `npm test` |
| [#381](https://github.com/ProductoryHQ/ritemark-native/pull/381) | `f712b91b` | Conversation list titles use the whole row and wrap to two lines | Hover buttons made 24 px tall and moved 2 px lower so they no longer cover the title's last line (was 3.5 px). Checked by measurement only — **check with the mouse in the release test** |
| [#382](https://github.com/ProductoryHQ/ritemark-native/pull/382) | `aab8731e` | Composer menus and `/` `@` popups fit beside the conversation rail | `composerMenus.test.ts` kept in `npm test` after the merge conflict. Codex skill mirror left to the harness equalizer |
| [#370](https://github.com/ProductoryHQ/ritemark-native/pull/370) | `bc8904c5` | Word preview pads unstyled table cells like Word (#369) | `office-preview.js` rebuilt (the PR had source only); default table style found in any attribute order; margins applied in headers, footers and notes, with tests |
| [#386](https://github.com/ProductoryHQ/ritemark-native/pull/386) | `5ce57983` | Claude Code 2.1.289, Codex 0.160.0, OpenCode 1.18.34; Sonnet 5.5 as the recommended Claude model (shell-tier) | Every hash measured from the published artifacts; OpenCode gate 4/4 with two free models; darwin-x64 and win32-x64 native runtime CI passed |
| [#387](https://github.com/ProductoryHQ/ritemark-native/pull/387) | `5c681cb9` | Narrow AI side bar: info and attach fold into a … menu, controls take a second row below 240 px; chip ×, popup height, empty-box fixes | Rebased on #382; composer-menus-check at 300/250/223/200/170 px |
| [#385](https://github.com/ProductoryHQ/ritemark-native/pull/385) | `ad2b9535` | The model button and Send keep the picked Claude model after a switch from Codex (Send used the old model) | Rebased after #387, bundle rebuilt, validator passed |
| [#389](https://github.com/ProductoryHQ/ritemark-native/pull/389) | `9975c828` | Transcribe library rows (title, date · length, problem line), rename recordings on disk, one More actions (…) menu convention also in the conversation list and header (#371) | Dev-instance checked with real audio and two real Claude conversations; follow-ups #390, #391 |

Each PR was rebased on `main`, its bundles rebuilt and the pre-commit validator passed before it was merged.

## Runtime versions

Reviewed 2026-10-04 against npm `latest` and the latest Codex GitHub release. Every release repeats this review.

| Runtime | v1.12.0 | v1.13.0 | Why |
|---|---|---|---|
| Claude Code / Agent SDK | 2.1.281 / 0.3.281 | **2.1.289 / 0.3.289** | Current release; resolves `sonnet` to Sonnet 5.5 |
| Codex | 0.154.0 | **0.160.0** | Runs GPT-6 Sol, GPT-6 Luna and GPT-6.1 Sol; 0.154.0 was the root cause of #375 |
| OpenCode | 1.18.30 | **1.18.34** | Current release |

`check:anthropic-models` flagged Sonnet 5.5 as missing from the Claude lineup. #386 adds it as the recommended default; Sonnet 5 stays as the previous one. Evidence: `docs/development/agent-runtime-compatibility.md`, v1.13.0 entry.

**Open choice:** Codex 0.160.0's own default is GPT-6.1 Sol; Ritemark's Codex default stays GPT-5.6 Sol unless Jarmo decides otherwise.

**After publish:** refresh `feeds/model-catalog.json` in `ritemark-public` from the bundled lineup (`release` skill, step 3); the feed still names Sonnet 5 as the Claude default.

## Sprints

| Sprint | Scope | Status |
|---|---|---|
| [128 — Background agent turns](sprint-128-background-agent-turns/sprint-plan.md) | Honest status for Claude's background subagents, visible automatic follow-up turns, per-task stop (extension-tier by path, ships in this shell release) | Plan written 2026-10-05, awaiting Jarmo's approval; not started |

## Not in this release

- **#376 Codex errors shown as raw JSON**: an issue with a proposed card design and no PR yet. It goes to a later release unless Jarmo pulls it in.
- **Codex default model**: Ritemark's Codex default stays GPT-5.6 Sol. Codex 0.160.0's own default is GPT-6.1 Sol, and Jarmo has not decided whether to switch.

## Out of scope

- Ritemark web PRs (`ritemark-web` repo) — separate repo, separate deploys.
- #377 (ask Ritemark's own Codex for its model list) — larger change, later release.

## Gates

- **Shell-tier:** clean-room release worktree from exact `origin/main`, Gate 1 + Gate 2, notarization after the 60-minute hardening window, Windows CI (see `release-manager`).
- **Release test must cover:** an authenticated Claude turn on Sonnet 5.5; a Codex turn on GPT-6.1 Sol; the OpenCode permission gate on x64 and Windows; the #381 row buttons with the mouse.
- `main` is frozen from the first release-candidate build until publish.

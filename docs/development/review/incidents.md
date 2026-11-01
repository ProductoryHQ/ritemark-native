# Incidents: our regressions, and the reviewer's score on them

Every regression Ritemark shipped, or nearly shipped, gets a row here: what people saw, the commit that caused
it, the fix, and the layer that should have caught it. The rows are also the AI reviewer's test: each causing
diff is reviewed again with the current `REVIEW.md`, and the score below says how many it catches.

- **Why:** step 6 of the review process (ritemark-dev `releases/v2.2.0/analysis/2026-10-27-review-process-plan.md`).
- **New rows:** the release skill's post-release issue sweep adds one for each regression a release shipped
  (`.claude/skills/release/SKILL.md`, Step 9).
- **A row counts** only once its causing commit is found in `main`'s history and checked. Where it isn't, the row
  says "not found" and what was searched.
- **Layers** are the plan's: Before the PR (run it, show it, judge what the checks flag), AI review, Security review,
  Blocking checks (validator, tests, builds), Human approval (Gate 1, Gate 2, merge), Feedback (issues, the sweep).

Commits are `main`'s. `main`'s early history was rewritten in a scrub, so the GitHub pages of PRs #8 and older
show other SHAs for the same commits.

## The incidents

| # | Date and version | What people saw | Caused by | Fix | Should have been caught by | Check added since |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | February 2026, v1.3.0 | Settings said "Settings will be available in a future update". No one could enter an API key, so Flows and the AI chat didn't work | PR #8: `e8ab0d96` added a 10-line placeholder `RitemarkSettings.tsx` (the real file was `RiteMarkSettings.tsx`, a letter-case mismatch), and `cefc9bf7` deleted the real 410-line page as a "ghost" | `8c9ba02c`, v1.3.1 (8 February) restored the page | AI review: the diff deletes 410 lines of Settings and adds a placeholder | `CLAUDE.md` hard rules 1 and 2; pre-commit Check 9 (Settings is the full page, not a stub) |
| 2 | 25 May 2026, v1.7.1 candidate (not published) | The rebuilt app installed, but the editor was blank: the extension failed with "Invalid or unexpected token" | **Not found.** Looked at: VS Code's extension packaging writes through the `vscode/extensions/ritemark` link into our source (#471, reproduced 19 October). The link dates from the first layout (`6b451fcf`, December 2025), before `apply-patches.sh` made it (`bb03813a`, March 2026), and the same 0-byte pattern hit v1.0.1 in January, so no single commit introduced it; #471 links to v1.7.1 as likely, not proven. The blank editor itself came from `tsc`'s incremental build keeping 0-byte `out/*.js` after the restore | v1.7.1's third build (`rm -rf out` and a full compile); for #471, PR #490 (`8052a182`): `build-prod.sh` takes the link out for gulp and checks the whole tree's digest | Blocking checks: the build checked the size of two files, not the tree | The release skill's v1.7.1 rule; `build-prod.sh`'s tree digest after gulp |
| 3 | 17–20 July 2026, 1.8.3-ext.1 | After the extension update, Ritemark's extension died at load (`Cannot find module 'pdfkit'`), taking the editor, the AI and the updater with it, until a manual delete or v1.8.4 | PR #141 (Sprint 93), `80d4809b`: the update package lists only `out/**/*.js`, `media/webview.js` and `package.json`, and the installer (Sprint 20, `929473e4`) builds a new extension folder from the package alone. Hidden until v1.8.3's version floor (#142) let updates load | v1.8.4 (a full release) replaced it; PR #157 (Sprint 98): copy-then-overlay installer (`517afeff`), the shell watchdog patch 012 (`a6d2dc18`) | AI review (High: `src/update/`); Blocking checks: no install-and-activate test of the package | The overlay installer; patch 012; `release-extension-preflight.sh` stops on changes an extension release can't deliver; `CLAUDE.md`'s "Extension-tier by path does not mean an extension release delivers it" |
| 4 | v1.8.0–v1.8.5, found 5 August 2026 | The model picker showed one Claude model; the sessions ran the person's own Claude Code default (a model Ritemark doesn't offer), and subagents inherited it | PR #113 (Sprint 79), `da997d4c`: the unified `agent-execute` takes the model only from the message, the webview's Claude messages carry none, and the host no longer reads `ritemark.ai.selectedModel`. With `settingSources` including `'user'` (`1a7dfce2`), the CLI used the person's settings | PR #183 (`83d46aa5`), v1.8.6: the model pinned on every Claude path | AI review (High: `UnifiedApprovalGate.ts`, `modelConfig.ts`) | `promptQueueStore.test.ts` asserts the model on the payload; a visible "Model mismatch" line when the CLI runs another model |
| 5 | v1.6.1–v1.8.5, found 4 August 2026 | A Markdown file opened from Finder came up as plain text, and every launch showed Restricted Mode and the terminal's trust question | `9cc928ed` (Sprint 57, trust off) and `f8acfb17` (Sprint 58, `*.md` to Ritemark's editor), both straight to `main` with no PR, put the settings in `branding/product.json`'s `configurationDefaults`, which desktop VS Code doesn't read | Patch 013, PR #185 (`49c5805d`), v1.8.6 | Before the PR: a run on a fresh profile; AI review (High: `branding/product.json`) | Patch 013; the frame scripts run on a fresh profile |
| 6 | April–27 October 2026, every Windows release build | The GitHub repository lost its stars and watchers at each build (3 to 0 by 21 October), which held back star-gated listings | PR #27 (`46380193`): `.claude/agents/release-manager.md` told the agent to make the repository private for each Windows build and public again, with `--accept-visibility-change-consequences` | PR #572 (`9a9ea48a`): Windows builds on the free `windows-latest` runner, no visibility command; PR #575 (`e265e20b`) | AI review: the diff names the flag | The release skill: never change the repository's visibility; no such command in the release path |
| 7 | v1.10.0, found 10 September 2026 | One Cmd+Z undid twice: the first seemed to do nothing, the second took back an older edit, and redo doubled text | **Not found.** Looked at: VS Code forwards the webview's keydown, and its built-in `undo` runs the document's own undo beside the editor's. Sprint 115's sync coordinator (PR #222, `c0343a92`) added the `undo-redo` push that brings that second undo into the editor, which fits the fix plan's "likely present in v1.10.0", but nothing was reproduced on the commit before it | PR #271 (`23493cef`), v1.10.1: Cmd+Z and redo bound to no-op commands while Ritemark's editor is in front | Before the PR: the trace probe on a dev build found it | `editorUndoKeybindings.test.ts` |
| 8 | 9 September 2026, the v1.10.1 build | Nothing for users: the Mac's clean-room build of v1.10.1 stopped ("clean dependency build changed committed webview.js"), which held the release | PR #266 (head `e4321178`, merge `640e2aac`): `media/webview.js` built on Windows with `core.autocrlf=true`, carrying 11 `\r` escapes; nothing pinned LF line endings | PR #268 (`daf90f5a`): the build allows CR residue and ships the tracked bundle; PR #271: `.gitattributes` `eol=lf` and an LF-built bundle | Blocking checks: nothing rebuilt the bundle from an LF checkout before the release build | `.gitattributes` `eol=lf` for source text; `build-prod.sh`'s CR-residue rule |
| 9 | 27 October 2026, 2.1.0 RC1 (not published) | A 1 px line under the chosen tab: the tab and the desk no longer read as one sheet | PR #565 (Sprint 142, #503), `beac93b2`: patch 018 drew the desk's hairline inside the desk (`::after`, `z-index: 10`), above the tab that used to cover it | PR #583 (`2ce6410f`, RC2), then #584's join pass (RC3) | Before the PR: the frame comparison flagged about 2.1% per scene, and the change was explained as the planned edge | The frame script's joins pass and `REVIEW.md`'s join rule (PR #599); the desk-edge row of `layout-invariants.md` |
| 10 | 27 October 2026, 2.1.0 RC3, at Gate 1; 2.1.0 shipped with it | After picking another AI from a split button's ⌄ with the mouse, the caret kept the keyboard's focus ring and showed its tooltip | PR #543 (Sprint 140), `53a0456a`: Home's "Ask with" caret, a menu trigger with a focus ring, on Radix's default close, which focuses the trigger again. PR #560 (`72f509e8`) carried it into the shared `ui/split-button.tsx`. The shared `ui/dropdown-menu.tsx` (PR #339, `f622c646`) never had the rule. **Near miss:** PR #467 (`3c8a7c30`) fixed the same ring in `ExportMenu.tsx` only | Draft PR #585 for 2.2: one close-focus rule in `dropdown-menu.tsx` and `select.tsx` | Before the PR: a state test of each shared control (plan step 8); AI review on #467's local fix | `REVIEW.md`'s two rules on shared controls (PR #599); the control catalogue and `scripts/qa/control-states.mjs` against `docs/development/control-baseline/`, on PRs that touch a control and at Gate 1, with one input-mode rule for every ring (Sprint 146, PR 2) |
| 11 | 10 September 2026, v1.10.1 candidates (not published); front-matter documents since v1.10.0 | While typing, the editor was overwritten by the host's copy: Enters lost, task items turning into bullets, the first Cmd+Z doing nothing | PR #255 (`409395c7`, merge `4eddf7d6`): saving a document without front matter now adds a final newline, which the editor's own text never has, so every echo of an accepted edit looked like a change from outside | PR #271 (`23493cef`): one canonical projection for the host and the editor | AI review; Blocking checks: no test of an edit's echo round trip | Shared projection test vectors in both packages; `test:editor-sync` |

Causing commits were found and checked for 9 of the 11 incidents (the plan asks for at least eight). Rows 2 and 7
stay without one.

## The baseline score

### Method

- **Who reviewed.** An AI review applying `REVIEW.md` and `CLAUDE.md` as they are on 31 October 2026 (after #599),
  run that day by a subagent of the Development manager. It gave each diff to one of five fresh-context reviewer
  agents (Claude Opus 5.5, one pass each, no vote) and then scored their findings. Their brief and the script that
  cut the diffs are in [`reviewer-brief.md`](reviewer-brief.md).
- **Which diffs.** Each causing PR's whole change (first parent to merge, or the squash commit), or the commit
  itself where there was no PR: ten diffs for the nine incidents with a commit, plus five known-clean PRs. The
  tier is `REVIEW.md`'s, from the paths: Light reviewed at low, Standard at medium, High at high. Generated files
  were left out as `REVIEW.md` says (`media/webview.js`, `media/office-preview.js`, `media/*.mjs`, source maps,
  images, lockfiles); the header named them and the commit messages.
- **Blind, as far as it goes.** The reviewers weren't told which diffs were incidents and which were clean. They
  could read the tree only at each diff's base and head, not later history, GitHub, memory or this file.
  `/code-review` itself wasn't used: it reviews the working tree or a live PR page, and both show what came later.
- **Scoring.** Caught: an Important finding names the defect that shipped. Partly: a finding points at it, as a Nit
  or vaguely. Missed: no finding does. Only the scorer knew the outcomes.
- **The known bias.** The rules were written after these incidents, so the score says whether today's rules would
  catch a repeat, not whether a reviewer would have caught it then. `CLAUDE.md`'s hard rule 1 names v1.3.0's
  Settings; its release-tier section names what an extension release can't deliver; `REVIEW.md`'s join and
  shared-control rules come from rows 9 and 10.
- **Re-score** the whole set the same way, with [`reviewer-brief.md`](reviewer-brief.md)'s brief and diffs,
  whenever `REVIEW.md`, `.claude/agents/pr-reviewer.md`, a review skill or the model changes, and score each new row
  when it's added.

### The incident diffs

| # | Diff reviewed | Tier | The finding that matters | Score |
| --- | --- | --- | --- | --- |
| 1 | PR #8 (`3adc327c..473e3da4`) | Standard | `RitemarkSettings.tsx:1`, Important: the 410-line Settings page deleted and replaced by a stub, so no one can enter API keys | Caught |
| 3 | PR #141 (`bdd80e8d..f0b9d34a`) | High | `scripts/release-extension.sh:161`, Important: the manifest carries only JS, `webview.js` and `package.json`, and the installer writes only those into a new folder, so `pdfkit` and the themes are missing and the extension fails at load | Caught |
| 4 | PR #113 (`ce2fae37..f04dc202`) | High | `store.ts:475`, Important: the Claude `agent-execute` message has no model and the host no longer reads `selectedModel`, so the SDK runs the person's own Claude Code default | Caught |
| 5 | `9cc928ed` | High | None on the dead key. Its trust finding (`branding/product.json:54`) assumes the key takes effect | Missed: not visible in the diff (desktop VS Code's configuration code) |
| 5 | `f8acfb17` | High | `branding/product.json:56`, Important: the association goes into `configurationDefaults`, whose trust setting evidently isn't taking effect, so on a fresh profile it's likely never read | Caught |
| 6 | PR #27 (`46380193`) | Standard | `release-manager.md:207`, Important: making the public repository private erases its stars and watchers at every release | Caught |
| 8 | PR #266 (`411a5e01..640e2aac`) | Standard | None: the defect is in the bundle's bytes, which `REVIEW.md` leaves out | Missed: not visible in the diff |
| 9 | PR #565 (`beac93b2`) | High | `018-ritemark-surfaces.patch:1025`, Important: the desk's inset top hairline is drawn above the tab row, under the chosen tab, so the tab and desk no longer join | Caught |
| 10 | PR #543 (`53a0456a`) | High | None on focus. A related Important (`home.css:490`: screens restyle `ui/` controls, the split button's caret included) doesn't touch the ring | Missed: not visible in the diff (Radix's close focus and Chromium's ring at run time) |
| 11 | PR #255 (`5ed0d1f7..4eddf7d6`) | Standard | `ritemarkEditor.ts:944`, Nit: the host's echo now ends in a newline and the editor's text doesn't, so every accepted edit's update reads as an outside change | Partly: the mechanism is named, the overwrite of typing isn't, and it's a Nit |

**Score:** 6 caught, 1 partly, 3 missed of 10 diffs. By incident: 5 caught, 2 partly, 2 missed of 9. Row 5 counts
as partly: the dead key first shipped from `9cc928ed`, which the review missed, and the catch on `f8acfb17` came
after it. The misses need something a diff doesn't show: generated bytes, a library's behaviour at run time, or
VS Code's own code.

- PR #141's review also found a second real defect: `X.Y.Z-ext.N` ranks below the app's own `X.Y.Z`, so the update
  never loads (#142, fixed in v1.8.3).
- Besides #142, the incident diffs drew 31 other Important findings, listed unverified in
  [`unchecked-findings.md`](unchecked-findings.md); the code 17 of them name is still on `main`. They aren't counted
  as false alarms, because these diffs aren't known clean. Some may be real; `9cc928ed`'s trust finding, for one,
  describes a key that had no effect when it shipped.

### Known-clean PRs (false alarms)

Each is merged, never reverted, and no later commit, PR or issue names it as a cause (searched with `git log --grep`
and the PR list).

| PR | Tier | Why it's clean | Findings | False alarms |
| --- | --- | --- | --- | --- |
| #519 (`ad9bcc61`), KEY-FEATURES.md | Light | Docs only, merged 23 October; nothing since points at it | 2 Nit, 1 Pre-existing | 0 |
| #587 (`7852c9f3`), `.claude/worktrees` hidden | Standard | One `files.exclude` default and its test, in 2.1.0; no follow-up | No issues found | 0 |
| #523 (`e91c3d9a`), OpenCode's socket path | Standard | Fixed 2.0.0's OpenCode turns on the Mac; shipped in 2.0.1, nothing reopened | 2 Nit | 0 |
| #528 (`7810385d`), the ElevenLabs Test | High (`modelConfig.ts`, key handling in `src/settings/`) | Shipped in 2.0.1 for the Store's 10.1.2.10 check; no later fix names it | 3 Nit, 1 Pre-existing | 0 |
| #575 (`e265e20b`), the signing action's dependencies | High (`.github/workflows/`) | Five lines that closed #506 after a proof build signed and packaged with the repository public; no later fix names it | No issues found | 0 |

**False alarms:** 0 Important findings on the five clean PRs. They drew 7 Nits and 2 Pre-existing findings, which
weren't checked.

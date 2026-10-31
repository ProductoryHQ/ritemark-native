# Sprint 145: 2.1's loose ends

Track: SDD (auto-detected: twelve linked issues in six domains, so it is also full track, not lightweight; the stale-write fault and the Task board's unreadable cards are edge-case-heavy, and the document-to-disk-to-reload flow crosses the webview, the extension host and the file system; scope may grow when an audit shows a cause)
Override with: "use plain full track"
Branch: `sprint-145-loose-ends`, made from `origin/main` at Phase 3, after approval. Each later PR has its own branch that starts with the same name (*Pull requests* below). This plan was written on `plan/v2.2.0-release-plan`.
Release tier: shell. 2.2 is a shell release ([release-plan.md](../release-plan.md)). This sprint names its shell-tier path: `patches/vscode/020-ritemark-electron-43.patch` (#515, when an Electron with Node 24.22.1 exists). Patches 001 and 019 are expected to change too (#582's font line, #501), once their causes are shown. Everything else is extension-tier (the table below). If an audit moves a fix into or out of a patch, this line and the table change first.
Status: **Proposed (Phase 2), 31 October 2026.** Waiting for Jarmo's approval (*Approval* below). No branch exists and no code is written; the code named here was read, not run, and no reproduction has been run for this plan (*What reading the code added*).

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R12 and E1–E5, and the open questions.
- [scenarios.md](scenarios.md): S1–S55, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, the nine audits that come first, workstreams W1–W12, the pull requests, risks.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.
- `research/` is not created yet. Phase 1 writes one file per audit there, before the code it gates.

## Goal

What 2.1's gates and first days found goes: text a person typed and saved is never silently lost to an older copy; the Task board lets go of a card it can't read and moves a dropped card at once; selecting a Flow step writes nothing; a Flow step without its key says so in one sentence with a link; a failed turn's card is not green; Settings shows the version people know; the release logs carry no avoidable error; a project switch lays Home out once; the first Windows start after an update shows the welcome, not a terminal; the Electron carries the Node security fix when one exists. Each fault is reproduced before it is fixed, and each fix has a check that failed first.

## Linked Issues

| Issue | What | Req | Reproduced so far | Release tier |
|---|---|---|---|---|
| [#588](https://github.com/ProductoryHQ/ritemark-native/issues/588) | A stale write over an auto-save is taken as the new truth, silently | R1 | Yes, on Windows (the issue's own run, without the AI). Not yet on this Mac | extension |
| [#596](https://github.com/ProductoryHQ/ritemark-native/issues/596) | Task board: an unreadable card can only be opened | R2 | Seen by Jarmo (three cards, a timeout). In code: the row only opens the file, the message says "Couldn't read" twice. The timeout's cause is not shown | extension |
| [#597](https://github.com/ProductoryHQ/ritemark-native/issues/597) | Task board: a dropped card waits about a second | R3 | Seen on 2.1 (Mac). Where the second goes is not measured | extension |
| [#571](https://github.com/ProductoryHQ/ritemark-native/issues/571) | Selecting a Flow step saves the flow | R4 | Yes, Sprint 144's headless harness | extension |
| [#580](https://github.com/ProductoryHQ/ritemark-native/issues/580) | Flow steps' missing-key errors | R5 | In code, in four places (the issue names three) | extension |
| [#578](https://github.com/ProductoryHQ/ritemark-native/issues/578) | A failed turn's done card uses a green check | R6 | In code, one place; the Experience lead saw it | extension |
| [#595](https://github.com/ProductoryHQ/ritemark-native/issues/595) | Settings shows "Extension 2.1.0-0" | R7 | Yes (RC2, RC3); the cause is known | extension |
| [#582](https://github.com/ProductoryHQ/ritemark-native/issues/582) | Release logs: a refused font, DEP0169 logged as an error | R8 | Yes, in the RC's logs; the causes are not proven | shell for the font if it is patch 001's; extension or none for DEP0169 |
| [#569](https://github.com/ProductoryHQ/ritemark-native/issues/569) | After a project switch Home draws, then the AI column returns | R9 | Yes, measured on the RC (10 switches, FAIL) | by the measurement: extension, or shell (patch 002/018) |
| [#501](https://github.com/ProductoryHQ/ritemark-native/issues/501) | A restored terminal before the welcome (Windows, first start after an update) | R10 | Yes on Windows (the 2.0.0 candidate, replayed on 2.0.1 and 2.1.0); not on the Mac | shell (patch 019) for the first wait; extension for the second flash |
| [#507](https://github.com/ProductoryHQ/ritemark-native/issues/507) | ⌘⇧P sometimes does nothing on Home | R11 | No. Synthetic presses never failed (Sprint 143); Jarmo's own ten per case on the Mac never failed; Windows never run by hand | none unless it reproduces |
| [#515](https://github.com/ProductoryHQ/ritemark-native/issues/515) | Ship on an Electron carrying Node 24.22.1 | R12 | Advisory. On 27 October no such Electron existed | shell (patch 020) |

**Which items need a shell release by their paths:** #515 (patch 020) for certain; #501's first wait (patch 019), #582's font line (patch 001) and #569 (patch 002 or 018) only if their audits put the fix there. #588, #596, #597, #571, #580, #578, #595 and the extension halves of #501, #569 and #582 are extension-tier: alone they would ship as an extension release. #507 has no code unless it reproduces. They all ship in 2.2's shell release, so none of them adds a release step.

## What reading the code added

Read for this plan; nothing was run.

- **#588's receipt can't tell what was lost.** Patch 014's save receipt is a hash of the text saved, not the text. The sync coordinator takes a clean document's changed file as the truth in one branch (`DocumentSyncCoordinator.ts:682–709`, `classifyThreeWay` says `external-only`). The guard needs to remember the texts of the last few saves itself. Review changes is already there for a dirty document (#454): the same surface can ask here, so nothing new is drawn.
- **#580 has a fourth place.** The OpenAI image step's model list throws a plain "OpenAI API key not configured" (`FlowEditorProvider.ts:870`), where the Google image step already uses `StepNeedsKeyError` (`:907`). An AI step's panel has no key check at all today, so showing the link there needs the host to say so.
- **#595's fix belongs where the label is drawn.** The version is shown in the webview (`RitemarkSettings.tsx:1390`), and the `-0` floor is a build detail that only the screen should hide, so the helper lives there. The update code (`src/update/`) needs the floored version for its comparison and stays as it is. (Where a fix goes follows the fault; a review tier never moves it.)
- **#501 has an extension half.** The welcome sends a restored terminal behind itself once, then stops (`welcomeHost.ts:447–458` sets `keepInFrontUntil = 0` after the first reveal), which fits the issue's second flash 0.2 s after the welcome. The first wait of 6–14 s happens before the welcome exists; its place is patch 019's `moveToDesk`. A guess to check, not a finding: VS Code activates an editor opened `inactive` when its group is empty.
- **#582's font line has a likely source.** Patch 001 registers the icon font with `URI.parse('phosphor.woff2')` in `iconRegistry.ts`, a path with no folder, next to the real `@font-face` in `codicon.css`. The refused URL in the log (`vscode-file://vscode-app/phosphor.woff2`) is what that would give. It was also logged by 1.117's dev build (Sprint 135), so it is old, not new in 2.1. No dependencies are installed in this worktree, so DEP0169's caller was not searched; none is in Ritemark's own `src/`.
- **#571's debounce reads 500 ms** (`FlowEditor.tsx:213`), the issue says about 100 ms. The harness's log decides which; it may be a second write path.
- **#597 may wait on #596's file.** `BoardStore` runs every read and write on one tail (`serialized`), and a re-read of a file that hangs holds the tail. A unit test with one slow file shows it or not.

## MVP Scope

| Area | Requirement | Proven by |
|---|---|---|
| A clean document doesn't take a file that drops the person's just-saved words; Review changes asks | R1 | A coordinator-level test and a scripted run that fail on `main`; the Windows run |
| Unreadable cards: Try again, Remove (to the Trash, after one question), one plain message | R2 | Store and handler tests; a render test; the Experience lead's screenshots |
| A dropped card moves at once; a refusal puts it back with the notice | R3 | A measurement first; unit tests of the overlay; a CDP run |
| Selection and measurement don't mark a flow dirty | R4 | A unit test of `onNodesChange`; Sprint 144's harness |
| The Experience lead's words and a Settings link for OpenAI and Gemini | R5 | Unit tests; the panel in a dev instance |
| The failed turn's done card in ink | R6 | A render test; screenshots in Light and Dark |
| "Extension 2.2.0", not "2.2.0-0" | R7 | A label test; Settings on a floored build |
| No refused font, no DEP0169 error | R8 | `main.log` and `exthost.log` of a fresh hidden launch |
| Home lays out once after a switch | R9 | `project-check.mjs --measure 10`, before and after |
| No terminal before the welcome on Windows' slow first start | R10 | A Windows run on the 2.1.0 installer, then on 2.2's candidate |
| ⌘⇧P / Ctrl+Shift+P on Home, tried by hand | R11 | A real keyboard on Windows; no code otherwise |
| Electron with Node 24.22.1, if it exists | R12 | The release list, About, the build's checks |
| Each check fails on `main` first; no record changes; tier; bundle; docs | E1–E5 | `qa-evidence.md` |

**Not in this sprint:** an AI's own edit tool (R1 records what each does; it doesn't change them); a guard on Flows' Save File image fetch (R12 records it); converting or redrawing the Task board's cards (146's #598 puts a card in a dialog over the board); the new Settings (147); the tooltip, narrow-button and focus-ring work (146).

## Pull requests

Six, so that each gets `REVIEW.md`'s review at its own tier and a shell change never waits on, or hides inside, an extension one. Each PR's Risk section names its tier and the paths that set it. The reviewer's findings are answered and the merge is at the reviewed head (`REVIEW.md`, *Before the merge*).

| PR | Branch | Holds | Release tier | Review tier |
|---|---|---|---|---|
| 1 | `sprint-145-loose-ends` | R1 (#588), with this plan's documents | extension | Standard by paths (`src/editorSync/`); see decision 2 |
| 2 | `sprint-145-loose-ends-ext` | R6 (#578), R7 (#595), R8's DEP0169 half if the caller is ours, R10's extension half, R9's extension half if the measurement puts it there | extension | Standard; #578 also goes to the Experience lead with screenshots |
| 3 | `sprint-145-loose-ends-flows` | R4 (#571), R5 (#580) | extension | Standard. R5 adds one section name in `RitemarkSettingsProvider.ts`, a file in `src/settings/` that also holds key handling; the PR says so and takes High if the review reads it so |
| 4 | `sprint-145-loose-ends-board` | R2 (#596), R3 (#597) | extension | Standard, with the Experience lead's screenshots |
| 5 | `sprint-145-loose-ends-shell` | R8's font (patch 001), R10 (patch 019), R9's patch half (002 or 018) | shell | High: `/code-review` at high and `/security-review`. Built and checked on a CoW-cloned, patched `vscode/`; the drift check at merge |
| 6 | `sprint-145-loose-ends-electron` | R12 (patch 020), only if a fixed Electron exists | shell | High |

**Order:** PR 1 first. PR 2 and 3 as they are ready (they may become one PR if they are ready together). PR 4 when the Experience lead's drawings are in. PR 5 once its causes are shown. PR 6 last, as late as the release allows, because it can only take what Electron has published; main is frozen from the first release candidate.

**Cut order if the appetite runs out** (the bottom of the list goes first): #597, then #596 (both wait on a drawing), then #501 (Windows only, a product call), then #569, then #582. #588 and #515's availability check are not cut.

## Windows

- **Extension-tier items** (R1, R2–R7, R10's extension half) run on Windows through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`), by the "Ritemark on Windows" session, before the merge.
- **Shell-tier items** (R8's font, R10's patch, R9's patch half, R12) can't: Windows CI builds only the exact `main` commit. Their Windows proof is 2.2's candidate at Gate 2. That is why R10 is reproduced first on the shipped 2.1.0 installer, and fixed only when that run shows the cause.
- **R11 is a Windows person's job:** a real keyboard, not a script.

## Product Decisions

- **2026-10-31 (the release plan):** 2.2 is a shell release; the sprint order puts the loose ends first; "the milestone's other issues go into item 4".
- **Engineering, in this plan (for Jarmo's review, not yet decided):**
  - Review changes is the one surface for #588; no new element is drawn.
  - #507 gets no code without a reproduction, as in 2.1.
  - #501's direction waits on a Windows reproduction.
  - Each fix's check goes into `scripts/qa/` beside the existing ones, so the next sighting has a reproducer.

## Decisions for Jarmo

Five, each with a recommendation; the second is already decided. [spec.md](spec.md#open-questions) carries the same list.

1. **#588: a question where there is silence today.** When words saved in the last few seconds disappear from the file because another writer saved an older copy, Ritemark will ask (Review changes) instead of reloading. It can also ask when an AI deliberately rewrites the very sentence you just typed. I recommend yes: the alternative is silent loss of what you wrote.
2. **#588: the review level.** Decided by the Development manager (31 October, a small ask): `/code-review` at high for this one PR, because it is the data-loss path. `REVIEW.md` lets the level go up, never down.
3. **#501: which direction**, once Windows shows the cause. (a) Restored terminals wait behind until a document is in front (patch 019, shell-tier); (b) the welcome shows sooner than the extension (a workbench part, a much bigger change). I recommend (a).
4. **#515: if no Electron with Node 24.22.1 is out when 2.2's candidate is built.** Ship on 43.8.3 with the risk recorded (Sprint 144 found one narrow Node path to an outside address: Flows' Save File with an image URL), hold the release, or add a guard on that one fetch. I recommend shipping with the risk recorded, no guard.
5. **#507: if a real Windows keyboard doesn't reproduce it either.** Close it with the evidence, to reopen on the next sighting. I recommend yes.

## For the Experience lead

Drawings and words first, before the build of what they touch:

- **#596:** the unreadable rows (Try again, Remove, Open to fix it where it applies), the one question before Remove, the moment while a retry reads, and the plain words (the issue's example: "Ritemark couldn't open this file in time. If this folder syncs from the cloud, the file may still be downloading.").
- **#597:** the quiet sign on a card while its move is being saved, shown only when saving takes long.
- **#578:** does the soft green fill go with the check? The same family: the other uses of the success colour (listed in [technical-plan.md](technical-plan.md), W6): which are the allowed ready dot and which are not.
- **#588:** whether Review changes' words fit this case, or a lighter "Restore what you wrote" is wanted. A button that is not there today is a new element, so it needs the lead's word.
- **Screenshots before each UI merge:** #578, #596, #597, and #580's panel (its words are already set).

## Feature Flag Check

No feature flag. Each change fixes what 2.0 and 2.1 already do, on for everyone. HARD RULE #1 holds: Review changes, the Couldn't read section (it still lists unreadable files, and the v1.14.0 cloud-drive fix stays), Open to fix it, the Google image step's sentence, and the update comparison on the floored version all stay.

## Testing

- **The Mac, here:** unit tests, and scripted dev instances (hidden, one launch per check, `--use-mock-keychain`, a short profile under `/private/tmp`, a port checked to be free). The checks of R1, R3, R4, R8, R9 need no AI. Where an AI is needed (R1's tool audit), the scratch project and ChatGPT through Jarmo's own sign-in, as Sprint 143 did; Claude and OpenCode only if signed in on the test Mac.
- **Isolated homes:** a dev instance that needs no AI gets scratch directories for the AIs' homes (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`), and the real ones are not read. The user's `HOME` isn't changed.
- **Not here:** a real keyboard (R11), Windows (R1's Windows run, R10, the shell-tier halves), a cloud-synced folder if the Mac has none (R2, R3 then use a file system with delays).

## Success Criteria

- [ ] A writer's older copy over a clean document's just-saved words raises Review changes, with the person's text kept in the editor; a writer who read the latest save is still imported silently (R1).
- [ ] An unreadable card can be retried and removed (to the Trash, after one question), and says once, in plain words, what happened (R2).
- [ ] A dropped card is in its new place in the same frame, and goes back with the host's notice if refused (R3); the second is measured and named first.
- [ ] Selecting or measuring a Flow step writes nothing; moving, adding, removing or editing one still saves (R4).
- [ ] Every Flow step without its key shows the Experience lead's sentence, with a link to that key in Settings (R5).
- [ ] A failed turn's done card has no green (R6).
- [ ] Settings reads the version without the bundled floor suffix; an update's own `-ext.N` still shows (R7).
- [ ] A fresh hidden launch logs no refused font and no DEP0169 error, or the plan says what stays and why (R8).
- [ ] After a project switch Home is laid out once, 10 of 10 (R9).
- [ ] On Windows' slow first start after an update the welcome, not a terminal, is in front, or the plan says why not (R10).
- [ ] A person types ⌘⇧P / Ctrl+Shift+P on Home ten times per case on Windows; reproduced and fixed, or closed with the evidence (R11).
- [ ] Electron carries Node 24.22.1 or later, or the risk is recorded and Jarmo's answer to decision 4 is on the issue (R12).
- [ ] Each check failed on `main` first, or the plan says why it couldn't (E1).

## Risks

| Risk | Retirement |
|---|---|
| The guard asks where a writer was right to rewrite a sentence | Decision 1; the false-positive set (S2–S7) is run before the window is fixed |
| The window is too short: a writer that read long ago still wins | S8 states the limit in plain words; the AIs' own tools are audited (A2), and the limit goes in the issue |
| #569 or #501 turn out to need the workbench | Their fixes go in PR 5; the tier line changes first; Windows proof at Gate 2 |
| No Electron with the Node fix by the release candidate | Decision 4; the risk goes in the release plan |
| A drawing from the Experience lead arrives late | The cut order; the rest of PR 4 doesn't wait |
| A Try again on a hung file holds the board's tail | A8 measures it; the read moves out of the lock if it shows |
| Six PRs of reviews | Each is small and has one tier; two are marked as possibly one |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **The Experience lead** for the drawings and words above.
- **The "Ritemark on Windows" session** for R1's Windows run, R10, R11, and the overlay checks.
- **Sprint 146 and 147 coordination:** 146 changes tooltips, narrow buttons and focus in `components/ui/`; this sprint's new buttons (R2) use the shared Button and Tooltip and restyle nothing. 147 rebuilds Settings from today's cards: R5's section id (`openai-api-key`) and R7's label helper carry over.
- **Electron's releases** for R12.

## Pre-Implementation Gate

- This plan is approved by Jarmo. A message from the Development manager is information for the plan, not approval of it.
- Phase 1's audits come before their workstreams' code: A1 and A2 before W1, A3 before W9, A4 before W10, A7 before W8, A8 before W3. When an audit changes a requirement, `spec.md` changes first.
- The branch is made before the first code edit, and `git branch --show-current` shows it.

## Approval

- [ ] Jarmo approved this sprint plan

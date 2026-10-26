# Sprint 142 Tasks

Nothing here starts before the plan is approved. Tick a box only when the change is on the sprint branch.

How the numbers map:
- W numbers are workstreams in [technical-plan.md](technical-plan.md);
- R and E numbers are requirements in [spec.md](spec.md);
- S numbers are scenarios in [scenarios.md](scenarios.md);
- A numbers are the audits;
- Q numbers are the spec's *Open Questions*.

## Phase 0: Branch and starting tree

- [ ] `git checkout -b sprint-142-polish` from `origin/main`; `git branch --show-current` shows it
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E2)
- [ ] Q1–Q9 answered (the Development manager; Q3 and Q6 by the Experience lead), and `spec.md` updated where an answer changes a requirement
- [ ] A CoW-cloned `vscode/` in the worktree, at the pin, for merge 2 (memory: CoW-clone vscode for worktree dev; vscode HEAD at the pin)

## Phase 1: Audits first

- [x] `research/chat-debug-release-build.md` (A1; R6): done while planning. No code; a Gate 1 check
- [ ] `research/restored-card-tab-audit.md` (A2; R12):
  - the reproducer on main;
  - the serialized editor;
  - the decision: extension, patch 019, or not reproducible
- [ ] `research/left-column-scrollbars-audit.md` (A3; R8):
  - the white strip's source;
  - every left-column list that scrolls;
  - Documents' tree's look;
  - the rule
- [ ] `research/tooltip-after-click-audit.md` (A4; R9):
  - the reproducer;
  - every button that replaces itself;
  - the fix's reach
- [ ] `research/transcribe-tab-audit.md` (A5; R13):
  - what Record does on screen;
  - the workbench before a session exists;
  - `background` with `preserveFocus`
- [ ] `research/sheet-edges-audit.md` (A6; R7, R10):
  - each sheet's box, painter and shadow room;
  - the desk's fallback;
  - the three surfaces to bring onto the kit;
  - the desk's width at 1440 on the Mac and Windows
- [ ] Where an audit changes a requirement, `spec.md` changes first

## Phase 2: The AI's lists, Home's note and path (W1, W3, W4)

- [ ] `RenderedMarkdown.tsx` `markdownStyles`:
  - markers by level, muted, tabular numbers, hanging in the 20 px indent;
  - task lists without a bullet (R1)
- [ ] `homeWords.ts`: `noteEnds()`; `placeParts()` in three parts; `middleCut()` (R3, R4)
- [ ] `HomePage.tsx`:
  - the note's timer, with hover and focus pause and the 6 s restart;
  - its at-once ends (press, key, drag, blur);
  - `useMiddleCut` on the head's path and the missing row (R3, R4)
- [ ] `HomePanel.ts`: clear `switchedFrom` on a tab change, a document edit or an accepted turn; dispose the listeners when it clears (R3)
- [ ] `home.css`:
  - `.rh-toast` one line, `calc(100% - 48px)`;
  - the path line as one text node;
  - the folder's wrap (R3, R4)
- [ ] Tests:
  - `home.test.ts` for `noteEnds`, the timer, `placeParts` and `middleCut`;
  - `homeState.test.ts` for the host's clear (E1)

## Phase 3: One button, one tone (W5)

- [ ] `webview/components/ui/split-button.tsx` (new) and `.rm-split` in `index.css`:
  - tones;
  - the wrapper's hover, pressed, disabled and busy;
  - no open state;
  - per-part focus (R5a)
- [ ] `GuidanceCards.tsx`:
  - the ready request on `SplitButton`;
  - `pressing` only for the sample;
  - the open-state rule out of `home.css` (R5b)
- [ ] `GuidanceHost.pressReadyRequest()`:
  - the empty project's second press (its chat, `fill: 'if-empty'`);
  - the folder-with-files second press if Q1 is yes (R5b)
- [ ] `UnifiedViewProvider.ts` `ChatStartRequest`: `conversationId`, `fill`; `store.ts` `startChatFromHost` reopens, focuses, and fills only an empty box (R5b)
- [ ] `AgentSplitButton.tsx`:
  - on `SplitButton`;
  - the whole button disabled;
  - the not-ready main part opens the menu (Q2);
  - `.tb-split` rules out of `tasks.css` (R5c)
- [ ] `ViewerToolbar.tsx`: `ViewerSplitButton` on the shared one; `DOCXViewer.tsx`, `PPTXViewer.tsx` callers (R5d)
- [ ] `SpreadsheetToolbar.tsx`: shadcn `Button`s and `Tooltip`s in a `.rm-split` wrapper; no native `title`; per-part hover rules out (R5a, R5d)
- [ ] `VoiceDictationButton.tsx`:
  - the `.rm-split` wrapper;
  - the language part not disabled while dictating, with its menu's unavailable rows and line (Q3);
  - `finishing` busy (R5d)
- [ ] Tests:
  - `splitButtonState.test.ts` (new, added to `npm test`);
  - `guidance.test.ts`;
  - the sheet's fill test;
  - `boardClicks.test.ts` (E1)
- [ ] `.claude/skills/ritemark-design/references/components.md`: the split button pattern (E5)

## Phase 4: The other visible fixes (W7 webview, W8, W9, W10, W11, W13; W12 if in the extension)

- [ ] `index.css` `.rm-ai-sheet`: the inset hairline, shadow-xs, its room (R7)
- [ ] `package.json` `ritemark.sheetShadow`: ink in Light, transparent in Dark (R7)
- [ ] Onto the kit: the Agents place's cards (`AgentLibraryViewProvider.ts`), Home's `.rh-toast`, Mermaid's expand toolbar (`Editor.tsx`) (R7)
- [ ] `.rm-ground-scroll` in `index.css`, on every list A3 names (R8)
- [ ] `ui/tooltip.tsx`: no open on focus that isn't `:focus-visible`; A4's other finding if any; `tooltipFocus.test.ts` (new, added to `npm test`) (R9)
- [ ] `tasks.css` `.tb-cols`: `minmax(160px, 1fr)`, `min-width: 724px`; each card's contents at 168 (R10)
- [ ] `home.css` at `max-width: 200px`:
  - the name wraps at spaces, then steps down;
  - Change image inside the cover;
  - times under names;
  - nothing with a fixed least width left (R11)
- [ ] `TranscribeViewProvider._start()`: open the workbench with `preserveFocus` and `background` while typing; `transcribeOpen.test.ts` (new, added to `npm test`); Record on the same path (R13)
- [ ] W12 in the extension, if A2 says so: `ritemarkEditor.ts` `applyCardTab` keeps a restored title until `cardPages` is ready; the AI's chip repaints; `cardFile.test.ts` (R12)

## Phase 5: QA and merge 1

- [ ] Manual QA on the Mac, Light and Dark, by CDP and by hand:
  - S1–S7;
  - S12–S44;
  - S50 (webview parts);
  - S52–S61;
  - S65–S69;
  - S62–S64 if W12 is in the extension.

  Evidence in `qa-evidence.md`, saying plainly what couldn't be run.
- [ ] Windows overlay round: S71 (E4)
- [ ] `media/webview.js` measured after; `notes/bundle.md` (E2)
- [ ] `npm test`, `./scripts/validate-qa.sh`; the pre-commit validator by hand in the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] Screenshots of every changed look to the Experience lead (E3)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; admin merge under the delegation

## Phase 6: The shell-tier parts and merge 2 (W2, W7's desk, W12 if patched)

- [ ] Patch 018, `scm.contribution.ts`: the container's title "File changes"; More's `workbench.view.scm` entry removed (R2)
- [ ] Patch 002: View ▸ Advanced ▸ File changes, if Q4 is yes (R2)
- [ ] Patch 018, `.editor-container`:
  - the inset hairline;
  - shadow-md;
  - the 8 of ground inside the painter, or the hairline alone (A6) (R7)
- [ ] Patch 019, if A2 says so: the card's restored title (R12)
- [ ] Each through `./scripts/create-patch.sh` onto its existing patch; `./scripts/apply-patches.sh --dry-run` clean (E6)
- [ ] `frame-geometry.mjs` as on main; `frame-screenshots.mjs --compare` against main (S51)
- [ ] Manual QA:
  - S8–S11;
  - S46–S49;
  - S62–S64 if patched.

  Screenshots to the Experience lead.
- [ ] `CLAUDE.md`'s patch rows (018, and 002 and 019 if changed) (E5)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; admin merge under the delegation

## Phase 7: Closeout

- [ ] `docs/development/architecture.md`: the split button contract and the tooltip rule (E5)
- [ ] `docs/CHANGELOG.md` and the release notes draft in `notes/release-notes.md` (E5)
- [ ] The release plan:
  - the tracker updated;
  - S45 in the Gate 2 checklist;
  - the "Also in the milestone" rows closed
- [ ] Linked issues closed with evidence, or updated: #557, #503, #504, #505, #508, #516, #517, #535
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning only as the delegation allows; BLOCKED is never overridden)

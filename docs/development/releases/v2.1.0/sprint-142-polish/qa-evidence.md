# Sprint 142 QA evidence

## Merge 1 (extension tier), 26–27 October 2026

**The environment.**
- The dev build of `sprint-142-polish`, on a CoW clone of Sprint 140's `vscode/`, reset to the pin `d956e8a6` with all 18 patches applied (`apply-patches.sh`: 18 applied, 0 failed) and `npm run transpile-client`.
- `node_modules` cloned from Sprint 138's worktree, whose lockfiles match `main`. A build of unmodified `main` reproduced the committed `media/webview.js` and `office-preview.js` byte for byte.
- One hidden instance (`open -n -g -j`):
  - CDP 9242;
  - a throwaway `--user-data-dir`, `--extensions-dir` and `--shared-data-dir` under `/private/tmp/claude-501/s142/`;
  - `--use-mock-keychain`, `RITEMARK_BUILD_CHANNEL=test`, usage data off (`ritemark.features.analytics: false`);
  - the three backgrounding flags.

  Rebuilt webviews were loaded with ⌘R (Reload Window), and the instance was quit at the end. No SecurityAgent prompt appeared.
- **Workspaces:**
  - a copy of the sample project at a long path, `/private/tmp/claude-501/s142/T/rm-smoke-20261026/proj/Leadership programme`, with a Word file and an Excel file added;
  - an empty project, `Team offsite 2027`.

**Automated:**
- `npm test` in `extensions/ritemark`: the whole chain passes, including the new `splitButton.test.ts`, and `home.test.ts`, `homeState.test.ts`, `guidance.test.ts` and `workbenchProtocol.test.ts` with the new cases;
- `npm run typecheck` (webview) and `npm run compile` (extension, with `tsc --noEmit`): clean.

### What ran, by scenario

| Scenario | Result | Evidence |
|---|---|---|
| S1–S5 lists | Pass. Computed `list-style-type`: disc, circle, square; decimal; a task list `none`. The first item's text at x 48 on a list at x 28 (the 20 px indent, as on main). Rendered by injecting the AI's Markdown into the sheet: no AI turn was sent | `qa/light-q6-ai-lists.png` |
| S7 Dark lists | Not captured; markers use `--r-ink-muted`, which Dark defines | — |
| S12 the note | Pass: one line, 569 px wide on a 784 px desk | `qa/light-q22-switch-note.png` |
| S13 6 s | Pass: gone 6.2 s after it showed, twice | `notewatch` logs |
| S14 hover | Pass: held under the pointer for 20 s; gone about 6 s after the pointer left | `qa/light-q23-switch-note-hovered.png` |
| S16 a press on Home | Pass: gone 0.3 s after a press 1.5 s into the note. A press 0.1 s after it first painted did not end it: the effect wasn't listening yet | — |
| S17 typing | Pass (synthetic `keydown` in Home): Tab kept it, "a" ended it | — |
| S18 files dragged over | Pass (synthetic `dragenter` with `Files`) | — |
| S19 another tab | Pass: the Task board chosen 2 s into the note, back to Home 1.4 s later: gone | — |
| S15, S20, S21, S22 | Not run: focus within the note, the narrow-desk wrap of the note, Go back, reduced motion. Go back's code is unchanged | — |
| S23, S24 path | Pass at a 544 px desk: `/private/tmp/claude-501/s142/T/rm-smoke-2…/proj/Leadership programme`. The gap between the ellipsis and "/" is −0.01 px, measured from the glyphs. On main the same width left a visible gap: `qa/audit-r4-path-gap-main.png` | `qa/light-q24-path-560.png` |
| S25 a folder name wider than the line | Pass at a 224 px desk: "Leadership / programme ›". At a 152 px desk the words themselves are wider than the line and break, as the rule's last resort | `qa/light-q27-path-wrap-224.png`, `qa/light-q26-home-152-desk.png` |
| S28–S30 Home's split button | Pass: one fill; hovering the caret darkens the whole button; with the menu open and the pointer away, the rest tone; the keyboard ring on one part at a time | `qa/light-q1…q5-*.png` |
| S31–S33 the empty project's second press | Unit-tested only (`readyPressAction`, `refillOnReopen`). Live, the ready requests here are the sample's: ChatGPT was ready through the Mac's own Codex, and a press would have sent work | — |
| S34 the sample's 15 s | Unit-tested (`splitButtonState`: busy turns off both parts). Not pressed live: it gives the task to ChatGPT | — |
| S35 the folder's second press | Unit-tested only | — |
| S36–S40 board buttons | Give to (filled) and Review with (outline) at rest and with the caret hovered: pass. Disabled, not-ready (Q2) and Send to: unit-tested (`agentSplitState`) | `qa/light-q8…q9`, `q12…q13` |
| S41 dictation | Hover on the whole button and the idle menu: pass. Dictating wasn't run: it asks for the microphone, a system prompt on Jarmo's screen | `qa/light-q10…q11` |
| S42 Word's Open in Word | Pass | `qa/light-q14…q15` |
| S43 Open in Excel | Pass; the caret's tooltip is Ritemark's ("Open in another app") | `qa/light-q16…q17` |
| S44 Dark | Home's split button: one lavender tone with the 28% line (re-taken in true Ritemark Dark in merge 2; the look is the same, see merge 2's correction) | `qa/dark-q29-ready-request.png` |
| S52, S53 scrollbars | The track: computed `scrollbar-color` was `rgba(148,163,184,.25) rgb(255,255,255)` on main (audit A3) and is `… rgba(0,0,0,0)` now; the slider shows while the pointer is in the page and for a second after a scroll (`data-scrolling`, checked). **This Mac shows overlay scrollbars**, so the track itself can't be seen here. The Windows round is where it shows | — |
| S54–S56 tooltip | Pass: the probe that does what `useKeepFocus` does (a mouse click, then a script focus on "Change image") now opens no tooltip; Shift+Tab, Tab to the same button opens it. On main the same probe kept it open with the pointer away (`qa/audit-a4-tooltip-stays.png`) | — |
| S57 the board at 1440 | Pass: four columns of 175 on a 784 px desk; the board's scroller 784/784 | `qa/light-q7-board-1440.png` |
| S60 Home at the 402 minimum, sheet forced | Pass: a 224 px desk, `scrollWidth` 224/224 (Change image inside, the times under the names). The first try found the times 8 px over; fixed | `qa/light-q25-home-402-sheet-open.png` |
| S60 at #535's 152 px desk (emulated 330 px window, sheet forced) | Pass: 152/152, the name on two lines at 20 px, Change image's icon inside the cover | `qa/light-q26-home-152-desk.png` |
| S62–S64 restored card tab | Merge 2 (patch 019). On this build, a card tab restored by Reload Window still reads `v3n6t1-video-before-each-module.md`, as A2 predicts | — |
| S65 Transcribe a file | Pass: the import plus Transcribe opened `interview.wav` as a tab ("Transcribing…"), and the transcript filled in there with the on-device engine. The keyboard stayed in the panel | `qa/light-q21-transcribe-tab-opened.png` |
| S66 behind a document | Unit-tested only. A hidden test window is never the OS's focused window, so `window.state.focused` is false and the tab opens in front by the rule | — |
| S67 ElevenLabs | Not run: no key | — |
| S68 Record | Not run: microphone. It goes through the same `_start()` | — |
| S71 Windows overlay | Not run in this session | — |

### The bundle

`media/webview.js`: 8,712,915 → 8,720,135 bytes (+7,220); 8,720,526 after the QA follow-up below.

### Open for the Experience lead

- The switch note, the path's wrap, Home at 152 px, and each split button's states, from the light captures above.
- The desk's edge is merge 2.
- A6 found Home's switch note already uses the kit's toast shadow (ink 18%/12%), so it is unchanged.

## Merge 1, QA follow-up (27 October 2026)

The Development manager's QA of #560 at 971ea67f passed every technical gate and asked for one more commit on `sprint-142-polish`.

| Item | What changed | Evidence |
|---|---|---|
| B1 | `release-plan.md`: 142's Sprints row is Approved, with #560; the tracker has merge 1's row (#560, Open, Passed (technical) 27 Oct, notes drafted) and merge 2's; the stale "Plan: 142" row is gone | — |
| N1 | At a 152 px desk the card's × sat on its heading. The narrow rule's `padding-right` lost to the card's own rule further down, and a wider padding alone can't help: the heading's longest word ("ChatGPT") is wider than the line leaves it, so it ran on under the ×. Now, at 200 and below, the icon keeps the ×'s line, the words go under it at the card's whole width, and the body and button take that width (`.rh-desk` first, so the rules win). Measured: the × at 104–128 on the icon's line; the heading's words from the line below; `scrollWidth` 152/152 | `qa/light-q26-home-152-desk.png` (re-taken) |
| N2 | The board's not-ready tooltip keeps the runtime's own reason after the generic sentence: "ChatGPT is not ready. Choose another agent. ChatGPT is signed out. Sign in and try again." | `splitButton.test.ts` |
| N3 | `ritemark.sheetShadow`: Dark `#00000066` (black at 40%), Light ink `#1E1B4B12` unchanged, high contrast none (the Experience lead, framework §4 and the kit, `ritemark-dev` 30f0adb). The workbench's menus, dialogs and quick input, the Mermaid toolbar and the Agents place's cards take it from the token. Live in Dark (the window was in fact in Dark 2026: see merge 2's correction; the values hold in Ritemark Dark too): a tab's menu over the desk computes `0 0 0 1px` hairline, `0 10px 24px -6px rgba(0,0,0,.4)`, `0 4px 8px -4px rgba(0,0,0,.4)`. The desk and the AI's sheet stop using the token in merge 2 (patch 018) | `qa/dark-q30-menu-over-desk.png` |
| N5 | The folder's "Ask … what is here" pressed again within 10 s, before the AI took the request, was a silent no-op. Busy would disable the button, which R5b and §3's "never disabled" rule out, so the press now brings the AI's sheet forward on the chat the first press sent (`readyPressAction` → `reveal`, by the sheet's own id from its origin note), sending nothing again; before the sheet has named that chat, it shows the AI's sheet | `guidance.test.ts` (two new cases) |

**Ran:** the webview's `tsc --noEmit` and both bundles, the extension's `npm run compile`, and `npm test` (the whole chain) — all pass; the validator by hand. Live on the hidden instance (CDP 9242, the same throwaway profile), with this branch's bundles: N1 at the emulated 330 px window with the AI's sheet forced open, and N3 in Ritemark Dark. The instance's `vscode/` tree carried merge 2's uncommitted workbench changes, which don't touch the menus' shadow.

**Not run live:** N5's second press (pressing it would send the sample folder's request to a real AI) and N2's tooltip (no runtime here was signed out). Both are unit-tested.

## Merge 2 (patches 002, 018, 019, and the review's Home and Excel items), 27 October 2026

On `sprint-142-polish-shell`, based on main: first on #560's squash commit 72f509e8, then rebased onto 5019e42b (#564, Sprint 143) for the follow-up below.

**Automated (each time, the last on the rebased tree):** the webview's `tsc --noEmit` and both bundles, the extension's `npm run compile`, `npm test` (the whole chain, with `cardFile.test.ts`'s new `cardTabWrite` cases), the pre-commit validator by hand (`CLAUDE_PROJECT_DIR` set to the worktree) and `scripts/validate-qa.sh`: all pass.

**The patches.**
- The workbench edits went through `scripts/create-patch.sh`, one temporary patch per file, folded into the patch that owns the file: `ritemarkSurfaces.css` and `compositeBarActions.ts` replaced in 018; `scm.contribution.ts` added to 018, in path order; `layoutActions.ts` replaced in 002; `customEditorInputFactory.ts` added to 019. Each patch's header has a Sprint 142 paragraph.
- From the pin (`git reset --hard`, `clean -fd`): `apply-patches.sh --dry-run` 18 can apply, 0 conflicts; then applied, the five files are byte-identical to the edited ones (`cmp`). `check-patch-stacking.mjs`: OK. `npm run typecheck-client`: clean.
- Not run: `./scripts/test.sh --grep Ritemark` (it opens an Electron test window, and merge 2 adds no workbench tests).

**The environment.** As merge 1's: the hidden instance on CDP 9242 with the throwaway profile, `vscode/` transpiled with the patched sources, each check one launch, quit at the end.

| Scenario | Result | Evidence |
|---|---|---|
| S8 More's File changes | Pass: More lists File changes with the SCM icon (and Chat Debug, which shows in dev builds only; Gate 1 and Gate 2 check it is gone on a release build); the panel's head reads File changes | `qa/merge2-light-more-file-changes.png`, `qa/merge2-light-file-changes-panel.png` |
| S9 its tooltip, S11 inside | Not run. Known, for #567's follow-up: the panel's Repositories and Graph views and the Settings group still say Source Control; the palette was not checked | — |
| S10 View ▸ Advanced | Pass: read from the menus the workbench sends to the Mac's menu bar (`lastKnownMenubarData` in the profile's `storage.json`): "File changes" | — |
| S46 the desk's corners, Light | Pass: the hairline whole round the 10 radius at both ends, over Home's webview; no shadow | `qa/merge2-light-desk-corner.png`, `qa/merge2-light-desk-top-left.png` |
| S48 Dark | Pass, in true Ritemark Dark (see the note below): the desk's `box-shadow` is `none` and its `::after` draws `inset 0 0 0 1px` white 8%, whole round the corner; a tab's menu over the desk is in the theme's `menu.background` (#1E1B4B), lifted by its hairline and black at 40% | `qa/merge2-dark-desk-corner.png`, `qa/dark-q30-menu-over-desk.png` (re-taken) |
| S47, S49 | Not run: the AI's sheet's edge is merge 1's (`.rm-ai-sheet`); two desks, an empty desk and the welcome alone were not set up | — |
| S51 frame geometry | Pass: 22 of 22, as main (`research/a6-frame-geometry-main.json`). `frame-screenshots.mjs --compare` not run: no main baseline set | — |
| S62 the restored background card tab | Pass: after a relaunch, the tab read "Draft Module 4 from the brief" at its first sample (2.9 s after the watcher started with the launch) and never the file's name; after Reload Window, the same at 2.7 s. On main the same tab read `v3n6t1-video-before-each-module.md` (A2) | `qa/merge2-light-restored-card-tab.png`, `research/m2-tabwatch-restore.txt`, `research/m2-tabwatch-reload.txt` |
| S63 the active restored card and the AI's chip | Pass: the card tab active at quit; after a relaunch it read "Draft Module 4 from the brief" (active) at its first sample, 3.0 s, never the file's name, and the AI's chip above the message box named the card by its title. (The capture's AI column was first 170 wide: the profile kept the width from the 330 px emulation; dragged back to 400 for the capture) | `qa/merge2-light-s63-restored-active-card.png`, `research/m2-tabwatch-s63-active.txt` |
| S64 | Not run | — |
| A card opened from the board | Pass: the title at the first sample (68 ms) | `research/m2-tabwatch-open.txt` |
| A restored card tab whose file no longer reads as a card (the QA of #565; `ritemarkEditor.ts`) | Pass, after the fix: the card file's `ritemark: task/1` changed to `note/1` while Ritemark was closed; after a relaunch the tab showed the saved card title at its first sample (2.9 s, the workbench's restore), then its file's name, `m4d7r2-draft-module-4.md`, at 3.4 s, with the Markdown file icon, not the task mark. Before the fix, by the code (not run live): nothing was written in this case (no card title then, none now), so the card title stayed. With the title fixed but not yet the icon (run live): the name came back with the task mark still on it, because the panel clears an icon it never set without telling the workbench. The file was put back afterwards | `qa/merge2-light-restored-not-a-card.png`, `research/m2-tabwatch-not-a-card.txt`; `cardFile.test.ts` (`cardTabWrite`) |
| The path at a 152 px desk | Pass: the folder's name is the title above it, so the line is the folder icon and › only; the label keeps the whole path ("…/proj/Leadership programme. Show its files in Documents") | `qa/merge2-light-home-152-path-tooltip.png` |
| The cut button's tooltip at 152 | Pass: "Ask ChatGPT to draft Module 4" first, then what it does; the tooltip 136 wide inside the 152 page (it ran 222 wide past the edge before `ui/tooltip.tsx` capped it at the page less 16) | same |
| Open in Excel | Pass: an outline button with the arrow-out-of-a-box icon, as Open in Word (`qa/light-q14-word-open-rest.png`) | `qa/merge2-light-open-in-excel.png` |

**A correction to the Dark captures (27 October).** The Dark menus' #202122, reported after the QA follow-up, came from this test profile, not from main. The profile chose the theme as `"workbench.colorTheme": "Ritemark Dark"`, its label. VS Code matches that setting against a theme's `id` when it has one (`ritemark-dark`, as `product.json` and the theme picker write it), so the window fell back to VS Code's Dark 2026 (the workbench's class `vscode-theme-defaults-themes-2026-dark-json`; its `menu.background` is #202122). With `ritemark-dark` the class is `ritemark-ritemark-themes-ritemark-dark-json`, and the menu is #1E1B4B, the selection #312E81, the focus ring #818CF8, as `themes/ritemark-dark.json` says. Merge 1's `dark-q29` and the follow-up's `dark-q30` were taken under Dark 2026; both are re-taken here in Ritemark Dark. `dark-q29`'s card looks the same (its colours come from Ritemark's own tokens); `dark-q30`'s menu is now the theme's ink. The shadow values were the same in both themes, since no theme sets `ritemark.sheetShadow`.

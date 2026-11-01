# PR 2: what was checked for R6–R10

1 November 2026, on branch `sprint-145-loose-ends-ext` (from `origin/main` at `37d765aa`). One hidden dev instance on the Mac: a copy-on-write VS Code 1.142 tree, a fresh short profile under `/private/tmp`, scratch homes for the AIs (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_*`), `--use-mock-keychain`, the three backgrounding flags, CDP on 9261 (checked free). Nothing was signed in. The instance was quit at the end.

## R6 (#578): green is only the ready dot

**Scope.** The Experience lead's answer (31 October) and the Development manager's decision on #578: the done card's soft green goes with the check, and "all of this is #578's rule", so the lead's nine uses of the success colour, the ready dot in Settings and the ten other done marks she found ship in this PR. The sprint plan's documents are the manager's to update; this note is the record of the scope change.

**What changed** (each to ink, as the lead set it):

| Where | Was | Now |
|---|---|---|
| `RuntimeNotice.tsx`, the success tone (a failed turn's done card; Claude's "You're signed in" note) | `check-circle`, `--r-success` on `--r-success-soft` | a plain `check` in `--r-ink-strong` on `--r-surface-muted`, the chip's shape kept |
| `CommentsMenuButton.tsx` (a send's result line) | `--r-success` | `--r-ink-strong` |
| `ExportMenu.tsx` (Copied) | the item and its check in `--r-success` | the item's own ink; the check in `ink-strong` |
| `Editor.tsx` (a code block's and a diagram's copy button, copied) | a `--r-success` rule, which the icon never showed (below) | the colour rule goes: Copied keeps the button's own ink at full opacity, the check is the sign |
| `tasks/LogView.tsx` (Marked done's rail dot) | `--r-success` | `--r-ink-strong` |
| `PlanReviewCard.tsx` (the enforcement line's check) | `--r-success` | `--r-ink-muted`, as its words |
| `index.css` (a comment task's done dot and line) | `--r-success` | the fixed light ink `--ritemark-ink-strong`: the marker and the bubble are white in both themes, so the theme's ink would vanish there in Dark (review round 1) |
| `RitemarkSettings.tsx` (the runtime's ready dot) | Tailwind `bg-emerald-500` | `bg-ritemark-success`: the one green, in the token |
| `SubagentCard`, `ActivePlanBanner`, `CodexSetupView`, `ActivityCard`, `FlowSettingsPanel`, `ExecutionPanel` (201, 212), `DictationSettingsModal`, `ui/pill` and `ui/badge` (success variants) | VS Code's or Tailwind's green | ink: `--r-ink-strong`, or the ink of the words a mark sits beside (framework §4) |

`ui/pill` and `ui/badge` change only a colour variant that nothing uses today; Sprint 146's plan changes the controls' states, not these variants, so they stay here.

**Found beyond the lead's list** (the same rule, by a search for the success token's Tailwind name `ritemark-success`, which her search for greens didn't cover), changed to ink here and to be confirmed by the lead:
- Settings: "Connected" (Claude, ChatGPT, Google account), "Configured" (five keys) and the key test's "API key is valid" row: 13 places in `RitemarkSettings.tsx` and 1 in `GoogleDocsSettingsCard.tsx`;
- `ExecutionPanel.tsx:351`, a Claude step's live "done" line (the same file and mark as 201);
- `index.css`, Mark as done's hover on a comment bubble (`#15803d`), now the bubble's fixed light ink.

**Greens that stay**, each with its reason in `theme/greenIsTheReadyDot.test.ts`:
- the token itself;
- Settings' runtime ready dot, and a Transcribe engine's ready dot (`TranscribePanel.tsx`);
- ChatGPT's provenance badge, the conversation colours and Transcribe's speakers (they say who);
- a Flow step's kind chip (experience 31: each kind keeps one colour, in both themes);
- the window's traffic lights in Settings' theme pictures;
- `properties/StatusSelect.tsx`'s Published (a chosen front-matter status with an amber Draft beside it: a "chosen" control, not a done mark, left for the lead).

The scan covers, in any letter case, the success token, Tailwind's green and emerald classes with any prefix, VS Code's green colours, and Tailwind's green and emerald hex values; not rgb()/rgba() values.

**A defect found on the way: an icon's colour class doesn't colour it.** `Icon` passes its tone to Phosphor as `fill` (`ui/Icon.tsx:317`; the default tone is muted), and a CSS `color` from a class doesn't change an SVG's `fill` attribute. Proved in the live sheet: an `svg` with `fill="var(--r-ink-muted)"` and `class="text-[var(--r-error)]"` computes `color` red and `fill` `rgb(97, 113, 135)`, the muted ink. So most of the "green" done checks above were already drawn muted, and so was "You're all set!"'s check, which Sprint 144 meant in `--r-ink-strong` and whose look the done card copies. Fixed where this PR touches a mark: `tone="inherit"` wherever a mark is meant in a non-muted ink (the done card, You're all set!, Installed, the subagent and Flow step checks, Settings' checks), with fill assertions in `OnboardingWizard.test.ts`. In the live sheet the Installed checks now compute `#475569` (`--r-ink-body`), where `main` draws `#617187`.
**Not fixed here (Pre-existing):** about 70 other `<Icon>`s with a colour class and no `inherit` tone draw muted, among them error icons meant red, accent spinners and Onboarding's failed-install cross (`--vscode-testing-iconFailed`). Making them follow their class changes how many screens look, and some classes name VS Code colours the framework doesn't use, so each needs the lead's word. It belongs with Sprint 146's controls work or its own issue (the shared `Icon` is one of 146's controls).

**Checks.** `RuntimeNotice.test.ts` renders the success tone, a failed turn's done card through the store, and the warning card before the switch. `greenIsTheReadyDot.test.ts` scans the webview's source. Both fail on `main` (the chip is `--r-success-soft`/`--r-success`; 36 uses of green outside the ready dot) and pass here.

**Screenshots** (`qa/`, Light and Dark): `r6-done-card-*.png` and `r6-done-card-*-before.png` (`main`'s), and `r6-onboarding-checks-*.png`. The cards are the components' own markup, rendered from this branch's and `main`'s source and drawn in the live AI sheet's webview, with its real stylesheet and theme: a failed turn can't be made without a signed-in AI. The other changed marks (Copied, the copy buttons, the Log's dot, comment-task dots, the Flow run's Finished, Settings' Connected) weren't shot: each needs a signed-in AI, a key, a flow run or a clipboard write. The guard test covers their colours.

## R7 (#595): "Extension 2.2.0"

`settings/versionLabel.ts` drops a bare `-0` at the end and nothing else; the versions line uses it for the installed extension only. A pending update's and an offered update's versions are `-ext.N` and show as they are; `src/update/` is unchanged and keeps comparing the floored value (its tests pass unchanged, S38).

**Live (S37):** the dev instance's `package.json` version was set to `2.1.0-0` for one window load and put back (byte for byte). Settings' own state held `currentExtensionVersion: "2.1.0-0"` from the host, and the line read "App 2.1.0 · Extension 2.1.0" (`qa/r7-settings-version-*.png`). On `main`, `versionLabel.test.ts` fails (no helper; the line prints the raw value).

**Found, left as it is:** the feedback e-mail's subject and first line name `Ritemark <extension version>` (`src/reporting/composeReport.ts`). There the floor tells the team a bundled copy from an update, so it stays.

## R8: DEP0169

No change. A7 (`research/log-lines.md`, on PR 1's branch) found no caller in Ritemark's bundle: `out/extension.js` imports no Node `url` module, so it can't call `url.parse()`. The caller is VS Code's or a built-in extension's; finding it needs PR 5's tree with its built-in extensions built, or 2.2's candidate.

## R9 (#569): who shows the AI column (A3)

Two scratch projects, `alpha-notes` and `beta-notes`, both in the profile's Open Recent before the launch. `project-check.mjs --switch-to <folder> --measure 10`, twice in the same instance. The script now also prints the workbench's own timing marks and each page's start time, so `exthost.log`'s activation times can be read on the same clock. The shipped 2.1.0 half was not run: the installed app is not touched in this PR. Sprint 144 measured the RC (#569's comment).

Times in ms from the new page's start (the dev build is slower than a release; the order matches the RC's record).

**Run B, a document in front in both projects** (as the RC was measured):

| # | To | First tab | Home in front | Document first | AI column | AI − Home | Ritemark activates | activation ends |
|---|---|---|---|---|---|---|---|---|
| 1 | alpha (left on Home) | Home 2734 | 2734 | — | 3481 | +747 | 3298 | 3504 |
| 2 | beta | Brief.md 2433 | 3380 | 956 | 3025 | −355 | 2811 | 2975 |
| 3 | alpha | Plan.md 2731 | 3720 | 995 | 3288 | −432 | 3127 | 3288 |
| 4 | beta | Brief.md 2532 | 3937 | 1394 | 3233 | −704 | 3036 | 3238 |
| 5 | alpha | Plan.md 2479 | 3477 | 962 | 3075 | −402 | 2889 | 3052 |
| 6 | beta | Brief.md 2438 | 3425 | 996 | 3017 | −408 | 2840 | 3004 |
| 7 | alpha | Plan.md 2419 | 3393 | 963 | 2988 | −405 | 2822 | 2983 |
| 8 | beta | Brief.md 2503 | 3503 | 964 | 3093 | −410 | 2917 | 3079 |
| 9 | alpha | Plan.md 2415 | 3385 | 971 | 2992 | −393 | 2829 | 2990 |
| 10 | beta | Brief.md 2499 | 3528 | 1030 | 3089 | −439 | 2923 | 3085 |

FAIL on both rules: a document in front first in 9 of 10 (956–1394 ms), the AI column up to 747 ms after Home.

**Run A, `beta` left on Home** (alternating): into `beta`, Home first at 2435–2759 and the AI column 564–792 ms after it; into `alpha`, Plan.md first, in front 926–1320 ms, the AI column 393–638 ms before Home. FAIL on both rules.

**What the marks show:**
- The workbench never restores the AI column: `code/willRestoreAuxiliaryBar` is absent from every switch, so the layout's own restore doesn't open it.
- The AI column appears within 50 ms of the end of Ritemark's activation (`exthost.log`'s "Eager extensions activated"; the probe samples about every 50 ms), every switch: it is the activation-time `ritemark.unifiedView.focus` that Sprint 144 added (`extension.ts`, the block after the hand-off command).
- The document in front comes from the workbench's editor restore, 380–500 ms **before** Ritemark starts activating. A project left on Home gets Home from the same restore, 564 ms before activation in run B's switch 1.
- Home after a document comes from the permanent tabs' landing check, 395–699 ms after activation ends.

**So the cause is in the shell (PR 5):** the extension can't act before it activates, and both failures start before that: the workbench restores the document as the active editor, and it restores the layout without the AI column. The extension's part (the gap from the AI column to Home in the document case) can't make a switch pass while the document is in front first. PR 5's patch half (002 or 018) would land a switch on Home in the workbench itself and restore the AI column with the layout; `project-check.mjs` with these marks is the check, before and after. No extension change in this PR.

## R10 (#501): the second flash

No change; waiting on Windows. Read, not run:
- `welcomeHost.ts` sends a restored terminal behind the welcome when one takes the front, once (`keepInFrontUntil = 0` after the first reveal). A 0.2 s flash that ends with the welcome in front is that one reveal's own reaction time: the terminal came forward, the extension heard of it and brought the welcome back. Keeping the guard for a whole minute wouldn't shorten that flash. It would only matter for a later takeover, which the Windows record doesn't show, and it would pull the welcome back over a person who clicks the restored terminal's tab in that minute.
- Why the terminal comes forward at all is in the shell: patch 019's `RitemarkTerminalTabs` opens revived terminals `inactive`, but VS Code makes an editor opened `inactive` into an empty group active anyway (`editorGroupView.ts`, `active: this.count === 0 || !options?.inactive`), and the contribution's later sweep (`moveToDesk(false)`, on any instance change after the restore) opens a terminal still in the panel in front. Which one fires on Windows' slow first start needs a trace of the tab events there (A4). Decision 3 puts the fix in patch 019, PR 5.

## Windows

Not run here; the "Ritemark on Windows" session was offline:
- R6 and R7 through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`): the done card and Settings' line in Light and Dark.
- R10's reproduction (A4) with a trace of the tab events, before PR 5 touches patch 019.

## Bundle (E4)

`media/webview.js` 8,727,898 → 8,727,344 bytes; `media/office-preview.js` 2,614,295 → 2,613,806 bytes (it carries `index.css`'s task and bubble colours). The dev-instance warnings in the screenshots' session: activation failures of `vscode.git-base`, `vscode.emmet` and `vscode.github-authentication` (this tree's built-in extensions have no `out/`, as A7 found), the GitHub authentication time-outs that follow from them, and the known refused `phosphor.woff2` (A7, PR 5). None comes from this PR.

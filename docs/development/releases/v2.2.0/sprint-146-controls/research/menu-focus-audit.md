# A1: where the focus goes when a menu closes (R1, S1–S8)

#585's audit, run live on 1 November 2026. Its fix (`ui/close-focus.ts`) is carried onto `sprint-146-controls` as `2f691d92`, unchanged except that its `npm test` line was merged into today's list and its bundles were rebuilt on today's `main`. Nothing here changed the fix: no fault was found in the shared rule.

## How it was run

- **The build:** a dev instance of `sprint-146-controls` at `2f691d92` (`media/webview.js` SHA-256 `079c179b…`), against `main`'s committed bundles for the "on `main`" column (`d070059d`, whose `media/webview.js` is the same as `5d0f8517`'s, SHA-256 `d26d4b75…`). The bundles were swapped in place and the window reloaded; nothing else differed between the two runs.
- **The window:** launched hidden (`open -n -g -j`, the three backgrounding flags), its own short profile under `/private/tmp`, `--use-mock-keychain`, scratch homes for the AIs (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_*`), CDP on a port checked to be free. A scratch folder held a document, a PDF, a Word file, two task cards, a flow and an agent file. No AI was signed in, and none was signed in or out.
- **The input:** CDP only, on the workbench page (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`), so Chromium's own focus rules ran. Focus emulation was on, so the hidden window drew its focus as a front one. The page was only read: `document.activeElement`, `:focus-visible` on it, what the trigger draws round itself (its outline, shadow and border against its look at rest), and any open `[role="tooltip"]`.
- **Both themes:** Ritemark Light and Ritemark Dark, by the profile's `workbench.colorTheme`.
- **The driver:** [`repro/menu-focus-audit.mjs`](repro/menu-focus-audit.mjs). Its rule: after a mouse close, nothing drawn round the trigger and no tooltip; after a keyboard close (Escape included, S3), the trigger has the focus and `:focus-visible`. It exits 1 when a step breaks the rule, and 2 when none does but a row's preparation, its webview or a step threw, so the run is incomplete (Codex on #618); a step that says why it can't run here is listed as not run and counts as neither.

The steps, each from a fresh start (two Escapes, a click on a blank spot beside the trigger, the pointer moved off):

| Step | Input | Scenario |
|---|---|---|
| Mouse pick | Click the trigger, click an item | S1, S5 |
| Click outside | Click the trigger, click the blank spot | S4 |
| Escape after a mouse open | Click the trigger, move off, Escape | S3 |
| Keyboard pick | Tab to the trigger, Enter, ↓, Enter | S2, S5 |
| Keyboard Escape | Tab to the trigger, Enter, Escape | S2 |
| Tab out (Share only) | Click Share, Tab | S6 |

## Results

"ok" means the step met the rule in both Light and Dark; every row below was run in both, and the two themes agreed on every step. "Not run" says why. On `main`: the same steps on `main`'s bundles, for the rows whose mouse pick could run.

| Trigger (component) | Path | Mouse pick | Click outside | Escape after a mouse open | Keyboard pick | Keyboard Escape | On `main` |
|---|---|---|---|---|---|---|---|
| Home first-day card, "Ask with" caret (`GuidanceCards` → `SplitButton`) | DropdownMenu | not run: every AI row starts a sign-in, or opens the key sheet, in a scratch home | ok | ok: ring, tooltip "Choose which AI asks" | not run (as the mouse pick) | ok | the same as the branch for the three steps run; RC3's mouse pick (#585's crops) is the failing case |
| Projects list, "Add a project…" (`ProjectsList`) | DropdownMenu, modal | not run: both items open a folder picker or a new window | ok | ok | not run | ok | not run |
| Task board, "Doing limit" (`BoardColumns`) | DropdownMenu, with a tooltip | ok | ok | ok | ok | ok | mouse pick: the focus stays on the trigger, nothing drawn |
| Task board, a card's "More actions" (`CardMenu`) | DropdownMenu | not run: its items open a conversation, the card's page or a sub-menu | ok | ok | not run | ok | not run |
| PDF viewer, zoom menu (`ViewerToolbar.ZoomControls`) | DropdownMenu, with a tooltip | ok | ok | ok | ok | ok | **mouse pick: ring and tooltip "Fit the page to the window, or choose a size"** (RC3's fault) |
| PDF viewer, Share (`ViewerToolbar.ShareMenu`) | DropdownMenu | not run: Show in Finder opens Finder, Open in Preview opens another app | ok | ok | not run | ok | not run |
| Word, "More ways to use this document" caret (`DOCXViewer` → `ViewerToolbar.SplitButton`) | DropdownMenu | not run: its items open another app | ok | ok | not run | ok | not run |
| Document Share (`ExportMenu`) | DropdownMenu, its own handler | not run: its items copy to the system clipboard or open a save dialog | ok: Share left alone | ok: Share has the focus, with its ring | not run | ok | not run |
| Document Share, Tab out (S6) | | | | | | ok: Tab closes the menu, Share has the focus with its ring | |
| Dictation language caret (`VoiceDictationButton`) | its own menu | ok | ok | ok | not run: its menu has no arrow keys; Enter on the caret only opens and closes it | ok (ring; its tooltip doesn't open) | the same as the branch |
| Flow step, model Select (`NodeConfigPanel`) | Select, `.rm-flow-props` rule | ok | ok | ok | ok | ok | mouse pick and click outside: the focus stays on the trigger, nothing drawn (its own rule draws only on `:focus-visible`) |
| Agent configurator, model Select (`AgentConfiguratorPanel`) | Select, the base `focus:` frame | ok | ok | ok | ok | ok | **mouse pick and click outside: a 1 px frame round the trigger** (S5) |

Crops (device pixels, 2×) in [`../qa/`](../qa/):
- RC3, from #585: `r1-rc3-home-mouse-pick-light.png`, `r1-rc3-home-mouse-pick-trigger-focus-suppressed-light.png`.
- The zoom menu's mouse pick, `main` and the branch: `r1-pdf-zoom-mouse-pick-main-{light,dark}.png`, `r1-pdf-zoom-mouse-pick-{light,dark}.png`.
- The agent Select's mouse pick, `main` and the branch: `r1-select-mouse-pick-main-{light,dark}.png`, `r1-select-mouse-pick-{light,dark}.png`.
- Home's caret after a click outside (S4) and after Escape (S3): `r1-home-askwith-click-outside-{light,dark}.png`, `r1-home-askwith-escape-{light,dark}.png`.
- Share after Tab (S6): `r1-share-tab-closes-light.png`.

## What it found

1. **RC3's fault is reproduced on `main` on a second trigger, and gone on the branch.** The PDF viewer's zoom menu, picked with the mouse, left its ring and opened its tooltip, in both themes, as Home's caret did at RC3. On the branch the focus goes to the page: no ring, no tooltip.
2. **A Select with the base frame kept it after the mouse, on `main`.** The agent configurator's Model Select drew its 1 px `focus:` frame after a mouse pick and after a click outside (Radix Select gives its trigger the focus after every close, outside included). #585's table had this from reading the code only; it is now seen live, and gone on the branch.
3. **Two triggers kept the focus on `main` with nothing drawn:** the board's Doing limit and the Flow step's model Select. On the branch the focus goes to the page after a mouse close. Where the keyboard carries on after a mouse pick is decision 1; PR 2 makes it return to the trigger, with the tracker deciding the ring.
4. **Share's menu behaves as on `main` (S6):** a click outside leaves Share alone, Escape and Tab return to Share with its ring.
5. **The keyboard always gets its ring back:** every keyboard close in every row ended on its trigger with `:focus-visible`, in both themes.

The audit found nothing in the shared rule to fix. PR 1's first review round (#618) did, and the rule changed after the audit above:
- **Keys that act on a menu count whatever is held.** Radix picks on Enter or Space and closes on Escape with ⌘, Ctrl or Alt held, so a close by ⌘-Enter was read as a pointer close. Enter, Space, Escape, Tab, the arrows, Home, End, Page Up and Page Down now count as the keyboard with any modifier; other keys with ⌘, Ctrl or Alt held are still shortcuts. AltGr's characters count as typing (Windows reports AltGr as Ctrl and Alt).
- **A click no press made counts as the keyboard.** A trusted click with no click count is a keyboard's activation, or assistive technology's when it sends no press of its own. Round 1 left out a click a press made within a second (a label passing its click on to its field); round 2 replaced that window (below). A script's own `click()` says nothing. Round 2 also found that Chromium sends a press before its own accessibility click (VoiceOver's VO-Space), so that click reads as the pointer: see the note after round 2's list.
- **The AI sheet's link menu takes the rule** (`ChatLinkMenu.tsx`): it focused its link by script after every close, a mouse pick too, which is RC3's mechanism. It now focuses the link only after the keyboard. Not run live: the link menu needs a ready AI.

After those changes, four rows ran again in Light on the rebuilt bundle (the zoom menu, Doing limit, Share and the agent Select): every step met the rule.

The second round changed four more things, and the same four rows ran again in Light and Dark on its bundle, every step meeting the rule:
- **A script's own events say nothing.** An untrusted `keydown` or `pointerdown` (`dispatchEvent`) no longer moves the rule, as an untrusted click didn't.
- **The Mac's Option characters are typing.** Option-2 types @ on many layouts; Option with a character and no ⌘ or Ctrl now counts as the keyboard on a Mac. On Windows, Alt with a letter is still a menu's shortcut.
- **A press's own clicks are left out until its task ends,** from the release, however long the press was held (a label held down for a second used to slip through the time window).
- **A consumer's own `onCloseAutoFocus` runs first, and the rule follows** unless that handler prevented the focus itself (`closeFocusHandler`). A handler that only watches the close can no longer bring back Radix's focus after every close.

**Not fixed, and said plainly:** by the round's reading of Chromium's source, an assistive technology's click (VoiceOver's VO-Space) comes with a press of its own, so it reads as the pointer: after such a pick the trigger doesn't get the focus back, where `main` gave it back. Not run live. Decision 1's change in PR 2 returns the focus to the trigger after every close, with the tracker deciding the ring, which ends it; PR 1 shouldn't reach a release without PR 2.

**In PR 2** (`sprint-146-controls-catalogue`), decision 1's change landed: `close-focus.ts` grew into the input-mode tracker (`ui/input-mode.ts`), the menus and Select give the focus back to their trigger after every close, and the mode decides the ring and the tooltip. That ends the assistive-technology regression, and PR 2 also takes PR 1's round-3 items (its Review record lists each). The two PRs merge together.

## Again on PR 2's tracker

On PR 2's head (`sprint-146-controls-catalogue`: the input-mode tracker and decision 1), the rows that could run in that window ran again in Light and Dark: Home's caret, the board's Doing limit, the PDF zoom menu, Share and dictation. Every step met the rule. After a mouse pick from the zoom menu the trigger now has the focus again, Chromium even matches `:focus-visible` on it, and nothing is drawn and no tooltip opens: the page is in pointer mode (`r2-pdf-zoom-mouse-pick-{light,dark}.png`). Every keyboard close still ends on the trigger with its ring. The agent configurator's Select didn't run (its file wasn't open in that window); the catalogue's Select row covers the same trigger (`research/control-states-runs.md`). From this run on, the driver judges a ring by what the trigger draws, not by `:focus-visible`, which the tracker no longer follows.

## Not run, and why

- **Rows behind a ready AI:** the composer's model, permission, runtime and More menus, its thinking effort popover, the conversation header's and rows' More actions, the link menu (`ChatLinkMenu`, S7), and the board's Give to, Send to, Retry with and Review with carets (`AgentSplitButton`, disabled with no usable agent). The scratch homes have no AI signed in, and this run signs in nothing.
- **Mouse and keyboard picks that do something outside the page:** listed per row above (a sign-in, a folder picker, a new window, another app, the clipboard, a save dialog).
- **Transcribe's More actions and insights language:** they need a recording.
- **The spreadsheet's "Open in another app" caret:** shown only when a second spreadsheet app is installed.
- **PowerPoint's caret and zoom menu:** the same `ViewerToolbar` components as Word's and the PDF's, which ran.
- **The projects list's row menu (ContextMenu) and the welcome's dialog (S7):** unchanged by #585 on purpose (its body says why); not driven.
- **Windows:** not here. The overlay session runs S1–S4 with a real mouse and keyboard (S21).

## Seen on the way

- **Three error toasts at the first launch,** "Activating extension 'vscode.git-base' failed: Cannot find module '…/extensions/git-base/out/extension.js'", and the same for `vscode.emmet` and `vscode.github-authentication`. The reused VS Code tree's built-in extensions had never been compiled (`extensions/git/out` is missing too). A test tree's state, not a product fault; nothing in the webviews depends on them.
- **Ritemark's tooltip is the reverse of the theme** (dark in Light, white in Dark), as #576 says; it shows in the Escape crops. R5 is its fix.
- **No sign-in toast appeared by itself** at any point.

# Sprint 146 Spec: Every control's states, and the frame's polish

## Purpose

2.1's RC3 showed a keyboard focus ring after a mouse pick, and nothing caught it, because every check saw the controls at rest. This sprint does the review process's Step 8: one fix for that ring (#585), a catalogue page of every shared webview control in every state, one rule that decides when the ring shows, and a script that tests every state against images the Experience lead approved. Then it takes the polish that belongs to those controls and to the frame: one tooltip look (#576), narrow buttons as icons (#566), File changes with no Git (#567), a tab's menu (#568), the left column's hovered row (#594), and a task card in a dialog over the board (#598).

## Principles

- **The control, not the screen.** A defect in a shared control is fixed in the control, and every other place that has it is found (`REVIEW.md`, its two rules on shared controls). No screen keeps its own focus logic.
- **One place decides the ring.** Whether a ring shows depends on how the person is working (keyboard or pointer), decided once per webview, not on each control's guess or Chromium's.
- **Real input in the tests.** States are reached the way a person reaches them, with CDP mouse and key events, never `element.click()` or `element.focus()`, so Chromium's own focus rules run.
- **The catalogue approves today's looks.** It shows how each control looks in each state. A look the Experience lead wants changed becomes its own issue, unless it is one of this sprint's items.
- **Fails first.** Each requirement's check fails on `main` at the commit the branch starts from, then passes (E1).
- **Words and drawings from the Experience lead** before the build of what they touch.
- **Nothing leaves without Jarmo's word.** A way to do something that leaves a Ritemark surface stays reachable elsewhere, and goes only with his answer (decision 4; `CLAUDE.md`, hard rule 1).

## Requirements

### R1: No focus ring after a mouse pick from a menu (#585)

As someone who picks from a menu with the mouse, I want no ring left round its button, and no tooltip opening by itself.

What is known: draft PR #585 proved the cause on RC3's source (d10cade2) with real CDP mouse input. Radix's `DropdownMenuContent` gives the focus back to its trigger by script after every close, and Chromium then matches `:focus-visible` on it, so the caret got its ring and its tooltip opened. With that one call skipped, the same pick left no ring and no tooltip. #585 adds one shared rule (`ui/close-focus.ts`) as the default `onCloseAutoFocus` of `DropdownMenuContent` and `SelectContent`, and moves Share's own copy (`ExportMenu.tsx`) onto it. Its live audit of the fixed build was never run.

Acceptance criteria:
- **#585's commit is carried over** onto the sprint's first branch, rebased onto `main`, its authorship and message kept, and #585 closes with a link to the new PR (technical plan, W1).
- **The live audit is run** on a hidden dev instance: every trigger in #585's table, with the mouse and with the keyboard, in Ritemark Light and Ritemark Dark. A row that needs a ready AI is run with one, or marked not run.
- After a mouse pick, a click outside or a press-drag-release, no ring and no tooltip show on the trigger.
- After Enter, Space or Escape, the trigger has the focus again, with its ring.
- A consumer that passes its own `onCloseAutoFocus` keeps it (Share's menu, the chat's link menu, the welcome's dialog): it runs first, and the shared rule follows unless it prevented the focus itself. The two that focus something else read the same rule: Share's menu for the Share button, the link menu for its link (PR 1's review, #618).
- `closeFocus.test.ts` fails on `main`'s `components/ui` and passes on the branch.

### R2: A catalogue of every shared control in every state

As the Experience lead, I want one page that shows each control in `webview/src/components/ui/` in every state it has, so I approve each look once.

Acceptance criteria:
- **One hidden webview page.** It opens only when Ritemark is started with the catalogue's launch setting (an environment variable only test scripts set), in a dev instance and in a release build alike. No command, menu or palette entry shows it otherwise (decision 5).
- **Every control in `components/ui/` has a row.** A unit test lists every component each file exports (a file such as `dropdown-menu.tsx` exports several) and fails when an exported control has no row, or is named on a list of parts that need none (Codex on #603).
- **Each row is one control (and its variants), each column one state:** at rest; hovered; pressed; with the keyboard's focus; after a mouse click (focus with no ring); menu open; after a mouse pick (menu closed); after Escape; after a keyboard pick; disabled; busy; on (where the control has it); with a long label (cut or wrapped, and at a narrow width for #566). A state the control does not have is an empty cell.
- **Each cell holds its own copy of the control,** so a state reached in one cell never shows in another.
- **Both themes.** The page is drawn in Ritemark Light and Ritemark Dark (the script switches the theme).
- **It needs nothing else:** no AI, no folder, no network; it sends the host nothing beyond its ready message; motion and the text caret are turned off on the page so captures are stable.

### R3: One input-mode tracker decides the ring

As someone who works with the mouse, the keyboard, or both, I want a ring only when I'm using the keyboard, on every control, and I want to carry on with the keyboard from where I was.

Acceptance criteria:
- **One tracker per webview** marks the page as keyboard or pointer, in the capture phase, before any control handles the input: pointer after a press of a mouse, pen or finger; keyboard after a key that is not a modifier alone or a shortcut (⌘, Ctrl or Alt held), where the keys that move or act on a menu (Enter, Space, Escape, Tab, the arrows, Home, End, Page Up, Page Down) count whatever is held and AltGr's and the Mac's Option characters count as typing; keyboard too after a click no press made, but not the clicks a press makes; an event a script made says nothing (PR 1's review, #618). Before any input the page is in keyboard mode, so a page reached from the workbench by keyboard shows where the focus is. #585's `close-focus.ts` grows into it; it is not a second tracker.
- **The ring shows only in keyboard mode,** whatever Chromium's `:focus-visible` guess, on every non-field control: Button, split button parts, Select's trigger, Switch, Tabs, FilterChip, Slider's thumb, the menus' triggers, Dialog's close, and every screen's own ring (the hand-written `:focus-visible` rules).
- **A field keeps its focused look in both modes:** Input, Textarea, the composer and the editor show where the typing goes after a click too.
- **A tooltip opens on focus only in keyboard mode** (`focusOpensTooltip`); hover still opens it, and leaving still closes it. Sprint 142's R9 case (a button that replaces itself) stays fixed.
- **Menus, Select and dialogs return the focus by one rule,** the one decision 1 chooses. Share's menu keeps only what its stand-in trigger needs (the real Share button gets the focus) and drops its own copy of the input bookkeeping.
- **Every webview has it:** one call in `main.tsx`, beside `watchScrollingMark()`.
- A unit test of the tracker (inputs to modes), and the catalogue's states (R4) as the check.

### R4: `scripts/qa/control-states.mjs` tests every state

As the person who merges a PR or passes Gate 1, I want a script that says which control states no longer look as approved.

Acceptance criteria:
- **Real input only.** It reaches each state with `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent` on the window, never `element.click()` or `element.focus()` in the page. A unit test of the script's source fails if one appears in an evaluated expression.
- **Device pixels.** Each state's cell is captured at device pixels, in both themes, and compared with its approved image inside the running instance, as `frame-screenshots.mjs` compares (no image library).
- **The exit code is 1 when any state differs** from its approved image or has none, and 0 otherwise. The script prints how many states differ (an exit status holds only 0–255, so a count of 256 would read as a pass; Codex on #603). `compare.html` shows each differing state's reference, capture and difference; `sheet.html` lays the captures out as the catalogue's grid, for the Experience lead.
- **A background window draws as a front one:** the script turns on the debugging protocol's focus emulation, and one run compares a front and a background capture.
- **The approved images** live in `docs/development/control-baseline/`, with a README saying how to run the script, how to take a new set, and that the Experience lead approves each image once.
- **It fails first:** run against the approved set on a branch with R1's shared rule reverted, it exits non-zero and names the mouse-pick states; on the sprint branch it exits 0.
- **It is part of the review process:** the PR template's Risk section asks for its result when a PR touches `components/ui/`, `index.css` or a control's look; `REVIEW.md` and the reviewer brief leave `control-baseline/` out of what is reviewed, as `frame-baseline/`; Gate 1's technical checks run it on the candidate beside `frame-screenshots.mjs` (the `release` skill and the `release-manager` agent); `docs/development/review/incidents.md` row 10 names it as the check added.

### R5: One tooltip look (#576)

As someone who points at things in Ritemark, I want every tooltip to look the same.

What is known: Ritemark's own `Tooltip` draws dark ink with white words in Light and the reverse in Dark; VS Code's workbench hover (the status bar, the tab row, the places) is white with dark words in Light and dark indigo in Dark. Native `title` tooltips are a third look.

Acceptance criteria:
- **The Experience lead chooses the look** (Ritemark's or the workbench's) for Light and Dark, and it is applied to both kinds: in `ui/tooltip.tsx` if Ritemark's moves; in the themes' `editorHoverWidget.*` colours (and 018's stylesheet if the hover's shape changes) if the workbench's moves.
- **Native `title` tooltips are listed** (the audit). Those on buttons and other controls use the shared `Tooltip`; the rest are listed for the lead.
- A tooltip's words still wrap within the page (Sprint 142 merge 2's width rule), and a disabled button's tooltip still explains why.
- The catalogue's tooltip cells are approved again in both themes.

### R6: A button too narrow for its first word shows its icon only (#566)

As someone with a narrow desk, I want a button that can't show its first word to show its icon, with its words in its tooltip, not "A…".

Acceptance criteria:
- **One rule in the shared control:** `ui/split-button.tsx`'s main part, and a `Button` with an icon and a label where it can be cut, show the icon alone when the first word doesn't fit. The words stay the accessible name; the tooltip has the whole words first (as #565 put them).
- **No flicker:** resizing across the edge, step by step, switches once each way.
- **Every place that cuts a label is found** (the audit): Home's first-day card, the board's Give to, Word and PowerPoint's Open in…, the spreadsheet's Open in another app, dictation, Share's label. Each takes the shared rule or keeps its own whole-toolbar rule (the viewers' toolbar goes icon-only under 560), and the audit says which.
- A button with no icon keeps today's cut.
- At a 152 px desk: Home's first-day button and the other split buttons show their icons only, no ellipsis, with the words in the tooltip; screenshots in Light and Dark. The catalogue's narrow cells are approved.

### R7: File changes speaks Ritemark when there is no Git, and a mouse open draws no outline (#567)

As someone who opens File changes in a folder without Git, I want Ritemark's words, and no outline round the panel when I opened it with the mouse.

The Experience lead's words (the issue's comment, experience 3, ritemark-dev 685bf29):
- **No Git in the project:** "Git isn't set up in this project"; "File changes shows what changed in each file since your last commit. Set up Git to use it. Its record stays inside this folder."; the button Set up Git here; no docs link.
- **No Git on the computer:** "File changes needs Git"; "Git isn't on this computer. Once it is, File changes works in every project."; no button and no download link (patch 016, the Store's rule).
- Never "VS Code", "repository", "initialize" or "source control" in either. The publish paragraph and its Publish to GitHub button go, unless the lead says otherwise (decision 4).

Acceptance criteria:
- Both states show the lead's words, and Set up Git here runs what Initialize Repository ran.
- **Git's other welcome states** (Git turned off, no folder open, a workspace, a repository in a parent folder, an unsafe one, a closed one, scanning) say nothing the lead's rule forbids: the lead's words, or as the lead decides for each.
- **No download link anywhere** in them (patch 016's Store rule still holds).
- **Opened with the mouse, File changes draws no outline; reached by the keyboard, it does.** The other places that take the same outline on a mouse open are found (the audit) and follow the same rule.
- Shell-tier: VS Code's Git and GitHub extensions' strings (patch 016) and the outline (patch 018). Windows is proved at Gate 2, where most PCs have no Git.

### R8: A document tab's menu holds Ritemark's items (#568)

As someone who right-clicks a document's tab, I want the usual tab items, not VS Code's developer ones.

What is known: a document tab's menu also lists Add File to Chat, Reveal in Explorer View, Open Preview, Reopen Editor With… and Find File References. A terminal tab's menu already adds only Rename to the usual items (patch 019, Sprint 132).

Acceptance criteria:
- **The Experience lead names, for each of the five, keep, rename or drop**, and which other tabs follow the same list (Home, the Task board, Word, PDF, a web page). The terminal tab's menu stays as it is.
- **One filter where the tab row builds the menu** (patch 019) leaves out the dropped items, whatever registered them (VS Code's workbench or a built-in extension), as patch 003's filter does for All commands.
- **Each dropped command still runs from All commands**, where it is offered today (the audit checks each).
- A command the lead hasn't named still shows: the filter names what goes, it doesn't list what stays.
- Light and Dark; a production build without Copilot Chat and a dev build with it (Add File to Chat shows only while chat is on).

### R9: The left column's hovered row stops at the scroll thumb (#594)

As someone who points at a row in the left column, I want its fill and the thumb to read as two clean things.

What is known: at RC3, the hovered row's fill ran about 2 px under the scroll thumb, and the thumb showed in two tones on that row. The issue's second half, the thumb flush against the desk's hairline, was fixed in 2.1.0's join pass (the thumb stops 2 short; `layout-invariants.md`).

Acceptance criteria:
- **The audit names every list where it happens** (Documents, Tasks, Agents, Transcribe, Home's projects, Search, File changes), at 1× and 2×, Light and Dark. The tier follows the list: patch 018 for the workbench's lists, the webview's CSS for a webview's.
- **The Experience lead chooses the fix:** the fill stops where the thumb begins, or the thumb draws over it in one tone.
- It holds for every list the audit names; the thumb still stops 2 short of the desk's hairline; the frame's joins pass is ok.

### R10: A task card opens in a dialog over the board (#598)

As someone on the Task board, I want to look at a card without leaving the board.

Acceptance criteria:
- **A click on a card on the board** (Board, Ideas, Your calls, Log) opens it in a dialog over the board, behind a scrim. The board stays where it was scrolled.
- **Esc, the close button or a click on the scrim** brings the person back to the board, scrolled where it was, with the focus on the card (with its ring only after a keyboard close, R3).
- **Enter on a focused card opens the dialog;** the focus goes inside and stays inside until it closes.
- **Open in separate tab** opens today's card page as a tab and closes the dialog.
- **It shows what the card page shows:** the title and Done when, the state's block and its one action, the files, the history and the card's text. The text is read, not edited, in the dialog (decision 2), so the card page stays the one place that writes it.
- **It follows the board:** a card that changes while open (an agent moves it, another surface edits it) redraws from the snapshot; a card deleted elsewhere closes the dialog with the board's notice.
- **A card's text is shown, not run:** raw HTML in it is not rendered as HTML; links open through the board's own opener; remote images are treated as the card page treats them, or not loaded. A card file from someone else's folder can't draw over the board.
- **Built on `ui/dialog.tsx`,** with a wider size added to the shared dialog if the drawing needs it (not a local restyle).
- **The Tasks side bar keeps opening the card's tab** (decision 3).
- The Experience lead draws it first; screenshots in Light and Dark before the merge.

## Engineering requirements

### E1: Each fix has its check, and it fails first

Each requirement's check fails on `main` at the commit the branch starts from and passes on the branch: a unit test where the cause is in code, `control-states.mjs` or a scripted run where it is in the running app, a patch test where it is in VS Code. The evidence goes in `qa-evidence.md`.

### E2: Records and older versions

No card file, flow, document, conversation or setting changes shape. The dialog has no write path of its own: its changes (stage, state, title, Files) go through the board's existing messages, as the card page's strip and head do (experience 42). No host message changes; the catalogue adds one webview type (`control-catalogue`) that only its own panel uses.

### E3: Tier

Shell, by `patches/vscode/016-ritemark-store-acquisition-policy.patch`, `018-ritemark-surfaces.patch` and `019-ritemark-tab-row.patch`. The per-PR tiers are in the sprint plan; the tier line changes first when an audit moves a fix.

### E4: Bundle

`media/webview.js` is measured before and after (`notes/bundle.md`), with the catalogue's share stated.

### E5: Docs

`docs/development/architecture.md` (the tracker as the controls' focus rule; the catalogue page and its launch setting; the card dialog as a fourth way the board shows a card); `CLAUDE.md`'s patch table and `layout-invariants.md` for what 016, 018 and 019 now do (a document tab's menu beside the terminal tab's row; the left column's rows); `docs/CHANGELOG.md`; the release notes lines through the `release-notes` skill; `incidents.md` row 10.

## Non-Requirements

- A tracker for the workbench itself. VS Code's own focus outlines are fixed where a surface shows the fault (R7), not workbench-wide.
- Replacing Radix, or adding a shared popover (two screens use Radix's popover directly; the tracker covers their rings).
- One ring look. The catalogue will show the controls' different rings (4 px, 3 px, 1 px, a 2 px outline); the Experience lead may file that for later.
- Editing a card's text in the dialog (decision 2), and a dialog from the side bar (decision 3).
- The viewers' own split button moving onto the shared one: it already composes the shared Button and menu, and the audit checks its states.
- The two frame items the Experience lead's Home notes leave for 2.2 without an issue (Home's S as one path; You's menu's top line), unless they are filed.
- The fresh profile's sign-in button that holds the focus from its first paint (#585's notes): a separate issue.

## Decisions

Five, for Jarmo, each with a recommendation. The sprint plan carries the same list in plain words.

1. **After a mouse pick, where the keyboard carries on.** Recommended: from the button that opened the menu, with no ring (the tracker hides it). The other answer: from the top of the page, as #585 and Share's menu do today.
2. **The card dialog's text.** Recommended: read in the dialog, edited in its own tab. The other answer: edited in the dialog.
3. **The Tasks side bar.** Recommended: a click keeps opening the card's tab. The other answer: it opens the board with the card's dialog.
4. **VS Code's entries off two Ritemark surfaces, kept in All commands:** Publish to GitHub in File changes with no Git; the tab menu's items the lead drops. Recommended: yes.
5. **The catalogue inside the app, hidden behind a launch setting,** so Gate 1 runs it on the candidate. Recommended: yes. Small; the Development manager may answer it.

Still open:

- **For the Experience lead:** the catalogue's images; #598's dialog; #576's look; #566's rule; #567's heading and the other Git states; #568's list; #594's fix (sprint plan, *For the Experience lead*).

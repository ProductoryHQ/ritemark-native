# Sprint 142 Spec — 2.1 polish

## Purpose

2.1's smoke test of main (26 October 2026, #557) and 2.0's release candidate left a set of visible faults:
- lists in the AI's answers with no markers;
- a panel with two names;
- a note that won't go;
- a path with a gap in it;
- split buttons in two tones;
- sheets whose shadows are cut;
- a white scrollbar track;
- a tooltip that stays;
- a board that scrolls sideways at the default window;
- Home scrolling sideways in a very narrow window;
- a restored tab with a file name;
- a transcribed file that doesn't open.

Each one is small, and together they are what a person sees first. This sprint makes 2.1 look the way the Experience lead drew it.

## Principles

- **The drawings are the contract.** `ritemark-dev`, `product/design/experience/`:
  - `framework.md` §3, "A split button is one button, in one tone" (Jarmo, 26 October; commit bb368b5), and §4's Elevation and Window sizes;
  - experience 35, *Found later, in 2.1's smoke test* (lists, the split button; commits f4f5a12, bb368b5);
  - experience 3, *Found in 2.1's smoke test* (File changes, the switch note, Home's path; commit f4f5a12);
  - the Experience lead's rule on #503 (the issue's comment, framework 3fcdd03);
  - experience 20 (a recording opens as a tab) and the Tasks experience, frame 1 (the board at 1440).

  Where a drawing and this spec disagree, the drawing wins and this spec changes first.
- **Fix it once, where every surface gets it.** One split-button contract for every split button. One tooltip rule in `ui/tooltip.tsx`. One scrollbar rule for the left column's webviews. One shadow rule for the sheets.
- **Nothing is removed.** Every button, menu, note and place keeps working; only how it looks and when it goes changes (CLAUDE.md, HARD RULE #1).
- **Light and Dark, Mac and Windows.** Every look is checked in Ritemark Light and Ritemark Dark. The four items with a Windows case (the board, Home at its narrowest, the sheets' edges, the scrollbars) are checked on Windows too.
- **People's words.** File changes, not Source Control; no new words beyond those drawn.

## Requirements

### R1: Lists in the AI's answers have markers (#557, item 2)

As someone reading an AI's answer, I want its lists to show bullets and numbers, so I can see the items and answer "the second one".

Acceptance criteria:
- Wherever the AI's Markdown shows (`RenderedMarkdown`: answers, plans, the plan review card, the chat's bubbles), `ul` has bullets and `ol` has numbers.
- A second level has a hollow bullet and a third a square: the browser's own `disc`, `circle` and `square`.
- An ordered list keeps its start number (`3.` stays 3).
- The markers are in muted ink (`--r-ink-muted`) in Light and Dark. Numbers use tabular figures.
- The markers hang in the indent the list has now (20 px, outside the text). Each item's text starts where it starts today.
- The items keep today's spacing (6 above and below a list, 2 between items).
- A task list in an answer (`- [ ] …`) shows its checkboxes and no bullet before them.

### R2: File changes is its name everywhere (#557, item 3; shell-tier)

As someone who opened File changes from More, I want the panel to be called what I clicked.

Acceptance criteria:
- The panel More's File changes opens is headed **File changes**: the left column's head, and the place's tooltip wherever the place shows (the places row or More).
- If the Development manager agrees (*Open Questions* 4), View ▸ Advanced ▸ Source Control reads **File changes** too.
- Inside, the panel stays VS Code's: Changes, Repositories, Graph and its messages are unchanged. It is machinery, for people who use Git (experience 3).
- The SCM container's id, commands and settings are unchanged, so a profile's layout, and an extension that opens the view by id, still work.

### R3: The project-switch note goes when it has done its job (#557, item 4)

As someone who has just switched projects, I want the note to tell me where I am and then get out of the way.

Acceptance criteria:
- **Where.** The note ("Switched to Team offsite 2027. Leadership programme is kept as you left it." with Go back and ✕) sits on one line at the foot of Home's desk, as experience 3's frame 3 draws it.
  - It is as wide as its words, up to the desk's width less 24 on each side.
  - It wraps only on a narrower desk, and the ✕ stays at its end.
- **Six seconds.** It goes 6 seconds after it shows on a visible Home, as experience 36's Done note does.
  - It stays while the pointer is on it or it holds the keyboard's focus.
  - When both leave, it goes 6 seconds later.
- **At once, when the person starts something:**
  - a press anywhere on Home's page (outside the note);
  - a key typed in Home, or in a document;
  - files dragged over Home;
  - another tab chosen or opened, a document opened from the left column, or a message sent on the AI's sheet;
  - Home losing the keyboard to the left column.

  So it never covers "Drop files here" when that is wanted.
- Go back works as today until the note has gone. Once gone, it doesn't come back in that window (the host forgets it, as ✕ does today).
- With reduced motion, the note goes without its fade.

### R4: Home's path line, cut in the middle without a gap (#557, item 5)

As someone looking at Home, I want to see which folder this project is, even when its path is long.

Acceptance criteria:
- When the path is too long for the line, it is cut in the middle. The ellipsis joins the two parts with no space, as in "…/T/rm-smo…/proj/Leadership programme". The gap between the ellipsis and the next character is 0 px, measured.
- **The order things give way:** the start goes first, then the project's parent folder. The end, the project's own folder, is never cut.
- If the project's own folder name alone is wider than the line, it wraps at its spaces onto a second line instead (*Open Questions* 6). The line never scrolls sideways.
  - *(revised 2026-10-26, the Experience lead's answer to Q6; experience 3, ritemark-dev 76b3a50)*: a name with no spaces breaks anywhere, and the › stays after its last word.
  - *(revised 2026-10-27, built)*: when not even "…/" fits beside the folder's name, the line is the folder's name on its own. It stays on one line when that fits, and wraps only when the name alone is wider.
  - *(revised 2026-10-27, the Development manager's review of #560, merge 2)*: when the line can show only the folder's name and that name is the project's title just above it, the line shows only its folder icon and ›; the full path stays in the tooltip. At the narrowest Home the first-day card's button may cut its words, as long as its tooltip starts with them whole (and no tooltip is wider than the page). Open in Excel is an outline button with the arrow-out-of-a-box icon, as Open in Word is.
- The full path is in the line's tooltip, as its first line (unchanged).
- A short path shows whole, with no ellipsis. A Windows path cuts at its backslashes.
- The cut follows the desk's width as it changes (window resize, a side column shown or hidden).

### R5: Every split button is one button, in one tone (Jarmo, 26 October; framework §3; experience 35)

As someone looking at a split button, I want to see one button with a menu, not two buttons or one half switched off.

**R5a: The look, for every split button.** Acceptance criteria:
- **This applies to every split button in Ritemark:**
  - Home's ready request;
  - the Task board's Give to, Review with (and Review again with), Retry with and Send to;
  - the editor's dictation button;
  - Word's and PowerPoint's Open in… on their viewers' bar;
  - the spreadsheet's Open in Excel / Numbers.
- **One fill in every state.** The main part and the caret share one fill.
  - A filled button's parts are divided by one 1 px line at 28% white.
  - An outline or quiet button's parts are divided by its own hairline.
- **Rest, hover and pressed apply to the whole button.** Pointing at the caret lightens the main part too, and pressing either part presses the whole.
- **With its menu open,** the button keeps its rest tone; the menu is the sign. There is no darker caret.
- **Disabled and busy apply to the whole button,** caret included, never to one half.
- **Only the 2 px keyboard focus ring outlines one part,** the one with focus.
- The indigo shadow, where there is one, belongs to the whole button.
- Every part keeps its tooltip, and the spreadsheet's split button gets real ones (`ui/tooltip.tsx`) in place of native `title`.

**R5b: Home's ready request (experience 35).** Acceptance criteria:
- **The empty project's button never disables.**
  - The first press opens a new chat with the request in the box, as today.
  - A second press opens that same chat on the AI's sheet and focuses its box. If the person cleared the box, the request is put back, with the cursor after "This project is for ". If they wrote their own words, those stay.
  - If that chat is gone, the press works as the first one did.
- **The folder-with-files button** (*Open Questions* 1): a second press, while its request is unanswered, opens the chat it was sent in. It sends nothing again and is never disabled.
- **The sample's 15 seconds:** from the press until the task shows in Doing, the whole button is disabled, the caret too. It reads "Giving it to <AI>…" with its spinner, and the note beside it reads "It shows in Doing in a moment." (unchanged words).
- **With no AI ready,** the main part keeps the request's words and opens Ask with (unchanged), in the rest tone.

**R5c: The Task board's agent buttons.** Acceptance criteria:
- While a press is pending, a hand-over is being sent, a review runs, or Send to has no text, the whole button is disabled, and its tooltip says why.
- With no agent ready, the whole button is disabled, with "Set up Claude, ChatGPT or OpenCode in the AI sidebar first".
- **When the chosen agent isn't ready but another is** (*Open Questions* 2), the main part opens the agent menu. The button isn't half disabled, and its tooltip says "<Agent> is not ready. Choose another agent."

**R5d: Dictation, the viewers' and the spreadsheet's split buttons.** Acceptance criteria:
- Each follows R5a with its own tone: quiet for dictation, outline for the viewers and the spreadsheet.
- **While dictation runs,** its language part is not faded (*Open Questions* 3). Pressing it opens the language menu with the languages unavailable and the line "Stop dictation to change the language".
- **While dictation finishes,** the whole button is busy.
- *(revised 2026-10-26, the Experience lead's answer to Q3; framework §3, ritemark-dev 76b3a50)*:
  - **While dictation runs, the whole button takes the dictating look,** caret included, never two tones.
  - The caret still opens its menu. The languages are unavailable, the current one keeps its check, and one line reads "Stop dictation to change the language".
  - §3's general rule: while the main part is on, the whole button shows it, and whatever can't change then is unavailable in the menu, with one line saying why.

### R6: Chat Debug never shows in More on a release build (#557, item 1)

As someone using a released Ritemark, I want More to list only the places I can use.

Acceptance criteria:
- On 2.1's release candidate, More lists no "Chat Debug", and the app contains no `extensions/copilot` folder. This is checked at Gate 1 and in Gate 2 on Windows.
- No code changes. Audit A1 (`research/chat-debug-release-build.md`) shows it can't appear: release packaging removes the built-in Copilot Chat, and only a dev build sets `github.copilot.chat.showLogView`.

### R7: A sheet's edge is drawn whole or not at all (#503; shell-tier in part)

As someone looking at the window, I want every sheet's corner to look finished, the same on every surface.

Acceptance criteria (the Experience lead's rule on #503, framework §4 Elevation):
- **The desk and the AI's sheet** each draw their hairline as an inset ring inside their own box. It goes all the way round the 10 radius and is never clipped.
- **The desk's shadow** is shadow-md (0 4px 6px and 0 2px 4px, ink 8% and 6%), and the AI's sheet's is shadow-xs (0 1px 2px, ink 5%).
- **Each shadow has its room,** the 8 of ground, inside the box that paints it. Where the editor part can't give the desk that room without moving the frame's measured edges, the desk keeps its hairline and drops its shadow. Never a cut shadow or a cut hairline.
- **The sheet shadow colour** (`ritemark.sheetShadow`) is ink in Light and transparent in Dark: Ritemark Dark draws hairlines only.
  - *(revised 2026-10-27, QA N3; the Experience lead, framework §4 and the kit, `ritemark-dev` 30f0adb)*: transparent in Dark reached too far. The desk and the AI's sheet draw hairlines only, with no shadow, in both themes, and in merge 2 they stop using the token. Whatever floats keeps a shadow in Dark: menus, dialogs, quick input, the editor's bubbles and toolbars, a card being dragged. So the token is ink in Light (`#1E1B4B12`), black at 40% in Dark (`#00000066`), and none in high contrast.
- **Brought onto the kit:**
  - the Agent Library's cards;
  - Home's switch note (ink 18% today);
  - the Mermaid diagram's expand toolbar (slate 24% today).
- *(revised 2026-10-26, after audit A6; `research/sheet-edges-audit.md`)*:
  - In 2.1's frame, the desk and the AI's sheet both sit flush with the boxes that clip them. The 8 of ground around each belongs to the neighbouring part's padding.
  - Neither can have its shadow's room without moving part boundaries in patch 018's layout. So in 2.1 **both keep a whole inset hairline and no shadow**: the Experience lead's fallback on #503, and framework §4's "the sheet keeps its hairline only".
  - The shadows' room is a layout change noted for 2.2.
- **Unchanged:**
  - the floating sheets (menus, More), the chosen tab, the cards on Home and the welcome, and the desk's webviews (the Experience lead: "fine as they are");
  - the frame's measured edges (`scripts/qa/frame-geometry.mjs` passes as on main).

### R8: The left column's lists scroll on the ground (#504)

As someone scrolling a long list in the left column, I want the scrollbar to look like the rest of the column.

Acceptance criteria:
- In Transcribe's recordings list, the scrollbar's track is transparent on the ground: no white strip, in Light or Dark. The thumb is thin and shows on hover or while scrolling, as Documents' tree does.
- Every other webview place in the left column with a scrolling list does the same (audit A3 lists them: at least Agents, Browser Recent, Home's projects list and Tasks' list).

### R9: A tooltip follows the mouse after a click (#505)

As someone who clicked a button that changes into another, I want the new button's tooltip to show only when I point at it.

Acceptance criteria:
- After a mouse or touch press, a tooltip shows on hover and goes when the pointer leaves.
- **Keyboard focus still shows the tooltip** (focus that is `:focus-visible`), as now.
- **Give to Claude on a task card's page:** after the click, the Stop button that takes its place shows "Stop the agent. You can give the task again" only while the pointer is on it. It never stays up for the turn.
- The same holds for the composer's Send/Stop, dictation's Start/Stop and every other button that replaces itself when clicked. The fix is in `ui/tooltip.tsx`, so every tooltip gets it.

### R10: The Task board's four columns fit at 1440 (#516)

As someone with the default 1440 × 900 window and both side columns showing, I want to see the whole board.

Acceptance criteria:
- **At 1440 × 900, both side columns showing,** the board's four columns (Ideas, To do, Doing, Done) fit the desk with no sideways scroll, as the Tasks experience's frame 1 draws it (about 168 wide each, 12 apart, 24 from the desk's sides). Checked on the Mac and on Windows at 100% scaling.
- **A card's contents fit its column at that width:** the title wraps; a Give to split button truncates its name and keeps its caret; nothing sticks out.
- **Below the four columns' least width,** the board does what *Open Questions* 8 decides. The recommendation is today's sideways scroll, so a desk narrower than 1440's never squeezes a card below that width.

### R11: Home fits a 150 px desk (#535)

As someone who forced the AI's sheet open in a very narrow window, I want Home to stay inside its desk.

Acceptance criteria:
- **At the 402 px window minimum with the AI's sheet forced open** (a desk of about 152 px), Home doesn't scroll sideways: its `scrollWidth` equals its `clientWidth`. The same at 550 px wide and 125% on Windows.
- **The project's name wraps at its spaces.** A single word longer than the line steps the name's size down at Home's narrowest width, and breaks only as a last resort.
- **Change image stays inside the cover.**
- **The rows' times stack under their names** instead of scrolling out of view.
- **The frame is not changed** (*Open Questions* 7): Home fits its desk, as framework §4 asks of every page on the desk.

### R12: A restored task card's tab shows its title (#508; tier decided by audit A2)

As someone relaunching Ritemark, I want a task card's tab to read as the task, not as its file.

Acceptance criteria:
- **After a relaunch,** a restored task card's tab shows the card's title and the task mark from the first paint, before it is opened.
- This is shown by a reproducer that fails on main before the fix.
- **The AI's chip** for a restored card that is the active tab names the card by its title on the same path.
- **A title changed before quitting** comes back as changed.
- **Every other restored tab** keeps its own name.

### R13: Transcribe a file… opens the recording as a tab (#517)

As someone transcribing a file, I want its transcript to appear where I am, as a recording made in the app does (experience 20, frame 2).

Acceptance criteria:
- **When Transcribe a file… adds a recording,** it opens as a tab in the Transcript Workbench, and the transcript fills in there as it finishes. "Adds" means the moment its engine is chosen and the job starts. This holds whether it starts from the head's Transcribe a file… or the panel's Add recording.
- Record and Transcribe a file… take the same path: whatever audit A5 finds Record doing today, both end the same way.
- **It never takes the keyboard from a document the person is typing in.** The tab opens without focus, and in the background if the person is typing in a document on that desk.
- It works the same for both engines (on-device and ElevenLabs).
- **Cancelling** the file picker or the engine choice opens nothing.

## Engineering requirements

### E1: Tests

Pure parts get tests in the existing chains (`npm test` in `extensions/ritemark`):
- the path cut (R4);
- the note's end rule (R3);
- the split button's state mapping (R5);
- the tooltip's focus rule (R9);
- the ready request's second press (R5b);
- the card's restored title (R12);
- the Transcribe open rule (R13).

### E2: The bundle

`media/webview.js` is measured before and after. The sprint adds CSS and a small component, nothing that moves the bundle more than a few kB.

### E3: Screenshots to the Experience lead

Before each merge, every changed look goes to the Experience lead, in Light and Dark at 1440 × 900 (memory: match the Experience prototype):
- the lists;
- the switch note;
- the path;
- each split button in rest, hover, menu open, disabled, busy and focus;
- the corners;
- the scrollbars;
- the board;
- Home at 402 px.

### E4: Windows

The extension-tier parts go through the Windows test overlay (`scripts/qa/make-windows-test-overlay.sh`) on the latest Windows build from main: R5, R8, R10, R11, R13. The shell-tier parts (R2, R7's desk, R12 if it needs a patch) are checked on 2.1's first Windows release-candidate build. No extra Windows CI run (the Actions budget).

### E5: Docs

- `docs/development/architecture.md`: the one-tone split button and the tooltip rule, in the webview section.
- `.claude/skills/ritemark-design/references/components.md`: the split button pattern (the skill's own rule for a new shared component).
- `CLAUDE.md`: patch 018's row, and patch 002's and 019's if they change.
- `docs/CHANGELOG.md`.

### E6: The patches

The shell-tier changes go through `./scripts/create-patch.sh` onto the existing patches (018, and 002 or 019 if used). No new patch file. Every patch applies to the pinned submodule (`./scripts/apply-patches.sh --dry-run`).

## Non-Requirements

- A desk-wide note over documents. The switch note stays Home's, where a switch lands (Sprint 134 R9).
- Renaming the SCM view's inner parts (Changes, Repositories, Graph) or its commands.
- A new Task board layout for narrow desks beyond *Open Questions* 8's answer.
- A guard in `validate-build-output.sh` for the built-in Copilot (A1, "Not taken").
- The frame keeping the desk 200 px wide (#535's other fix, patch 018).
- Other polish not listed here (#509, #510, #507, #511, #513, #514 belong to other sprints or 2.2).

## Resolved Questions

- **Does Chat Debug show on a release build?** No (A1). The built-in Copilot Chat is removed at packaging on all three platforms, and the installed 2.0.1 has no `extensions/copilot`. No code; a Gate 1 check.

## Open Questions

Each has a recommendation. Looks go to the Experience lead; the rest are the Development manager's under Jarmo's delegation.

1. **Home's folder-with-files button, on a second press:** open the chat its request went to, sending nothing again and never disabling? *Recommended: yes.* It matches the empty project's rule (R5b) and the one-tone rule's "never one half switched off". Today it disables its main part for up to 30 seconds.
2. **The board's split button when the chosen agent isn't ready but another is:** the main part opens the agent menu, as Home's card does with no AI ready? *Recommended: yes.* Today the main part is disabled and the caret isn't: the two tones the rule forbids.
3. **Dictation's language part while dictating:** keep it in its rest tone, opening its menu with the languages unavailable and "Stop dictation to change the language"? *Recommended: yes.* Hiding it would move the main part under the pointer, and a faded half is what the rule forbids. For the Experience lead.
4. **View ▸ Advanced ▸ Source Control** (patch 002): rename it File changes too? *Recommended: yes.* "File changes is its name everywhere". It is one string in a patch this release already rebuilds.
5. **The switch note's "a click in the left column":** the extension hears a document opened, a tab chosen, Home losing the keyboard, and Home's own presses, keys and drags, but not a click on the left column that changes nothing. Accept that, with the 6 seconds covering the rest? *Recommended: yes.* Hearing every click there needs a patch for no visible gain.
6. **A project folder whose name alone is wider than Home's path line:** wrap it at its spaces onto a second line? *Recommended: yes.* "Never cut" and "nothing scrolls sideways" (framework §4) leave only wrapping. For the Experience lead.
7. **#535's fix:** Home holds at 150 px (extension) rather than the frame refusing the sheet (patch 018)? *Recommended: Home.* Framework §4 asks every page on the desk to fit at any width, and it needs no patch.
8. **The board below its four columns' least width** (under about 724 px of desk): keep today's sideways scroll there? *Recommended: yes, for 2.1.* #516 asks for 1440, the left column already hides below 1200, and no narrower board is drawn. If the Experience lead draws one (two rows of two, say), it is its own issue.
9. **#508, if the title can only be kept by VS Code's tab restore** (patch 019): accept the shell-tier change? *Recommended: yes.* 2.1 is a shell release, and patch 019 owns the tab row. Audit A2 decides whether it is needed at all.

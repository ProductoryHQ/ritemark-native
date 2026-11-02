# PR 3, the controls' polish: what was measured and found (A4, A5; #576, #566, #614, #613, #615)

Run on 2 November 2026 on one hidden dev instance of `sprint-146-controls-polish` (launched as `research/catalogue-capture.md` says: `open -n -g -j`, the three backgrounding flags, `--use-mock-keychain`, a short profile under `/private/tmp`, scratch homes for the AIs, `RITEMARK_CONTROL_CATALOGUE=1`), on a VS Code tree at Electron 43.8.6. The Experience lead's rules are ritemark-dev `releases/v2.2.0/analysis/2026-10-31-sprint-146-experience-answers.md`, §3, §4 and §9, and the comment on #615.

**The environment first.** With this branch's base bundle (`1b8d8d08`, unchanged), `control-states.mjs` against the approved set: **0 of 456 differ** (Dark in the first run, Light in a second run once the palette had opened; the first theme of a fresh window's first run reads every keyboard-focus state as different, as run 15 of `control-states-runs.md` found). So the tree at 43.8.6 draws the approved images exactly, and every difference below is this PR's.

## A4: the workbench hover, measured (#576)

Read from the live workbench (`getComputedStyle` on `.monaco-hover.workbench-hover` and its `.hover-contents`):

| Hover | Classes | Radius | Padding | Words | Border | Fill | Shadow |
|---|---|---|---|---|---|---|---|
| A tab's (Home), Light | `compact` | 5 | 2 and 8 | 12/19, #1E1B4B | 1 px #E2E8F0 | #FFFFFF | 0 0 12px rgba(0,0,0,.14) |
| The status bar's (Send feedback), a place's (Tasks), Light | `compact with-pointer` | 3 | 2 and 8 | 12/19, #1E1B4B | 1 px #E2E8F0 | #FFFFFF | the same |
| A tab's, Dark | `compact` | 5 | 2 and 8 | 12/19, #F8FAFC | 1 px rgba(199, 210, 254, 0.12) | #1E1B4B | the same |

In both themes the hover's colours are Ritemark's own tokens: `--r-surface`, `--r-ink-strong` and `--r-hairline`. The 3 is the pointer's: VS Code rounds a hover less when it draws its arrow (`hover.css`, `.with-pointer`). Ritemark's tooltip has no arrow (§3), so it takes the hover without one: **radius 5, padding 2 and 8**. The lead names the rest: the theme's surface (`--r-surface`), the strong ink, a 1 px `--r-hairline`, and the menus' shadow (`shadow-md`, as `ui/dropdown-menu.tsx`). The font stays the tooltip's own (12/1.35), and Sprint 142's width rule stays. It is one class string, `TOOLTIP_SURFACE` in `ui/tooltip.tsx`.

**Other tooltip looks found, and moved onto the one look:**
- `ai-sidebar/ConversationTooltip.tsx`: a second Radix tooltip, the old ink tag with its arrow. It takes `TOOLTIP_SURFACE` and loses the arrow.
- The editor's own buttons outside React (the code block's copy and diagram buttons, and the block's +, which `Editor.tsx` builds as a plain element): a CSS tooltip (`data-tooltip` and `::after`), the old ink tag. Same look in CSS; the + had a native title and now has the CSS tooltip.
- The equation's error tooltip (`math.css`): its commands in the code face were coloured for an ink tooltip (light indigo in Light). They take the tooltip's own ink now.

## Native titles (#576, R5)

**Moved to the shared Tooltip** (each button keeps or gains an `aria-label` with its words, since a title was the only name of several icon buttons):

| File | Controls |
|---|---|
| `DataTable.tsx` | Column actions, Add column, Confirm delete, Cancel, Delete row |
| `Dialog.tsx` | Close |
| `FormattingBubbleMenu.tsx` | Bold, Italic, Heading 1–3, the three lists, Blockquote, Code block, Link, Add comment; the link dialog's Open |
| `MarginCommentRail.tsx` | the card's Edit, Mark as done, Delete |
| `TableOverlayControls.tsx` | Add row above, Delete row, Add column left, Delete column |
| `agent/ScheduleEditor.tsx` | the seven day chips, Copy (twice) |
| `ai-sidebar/ActivePlanBanner.tsx` | Expand or collapse (twice), Mark plan complete |
| `ai-sidebar/ChatInput.tsx` | an attachment's Remove; the permission mode's picker |
| `ai-sidebar/CodexView.tsx` | Dismiss |
| `ai-sidebar/SelectedContextTab.tsx` | Remove selected text |
| `ai-sidebar/ThinkingEffortControl.tsx` | the effort button |
| `flows/FlowsPanel.tsx` | Edit flow, Delete flow |
| `flows/NodeConfigPanel.tsx` | Browse folders, Insert variable |
| `header/CommentsMenuButton.tsx` | Comments |
| `header/PropertiesModal.tsx` | Close |
| `properties/PropertyRow.tsx` | Remove |
| `transcribe/workbench/InsightsRail.tsx` | Play from here |
| `transcribe/workbench/Waveform.tsx` | the waveform's Seek (twice) |
| `transcribe/workbench/Workbench.tsx` | Open the saved document, Play or Pause, Rename a speaker |
| `Editor.tsx` | the block's + (the CSS tooltip above) |

**Left as they are**, for the lead's list (a cut text's whole words, or not a control); `controlsPolish.test.ts` names the four on buttons and fails on any other:

| File | Element | Why |
|---|---|---|
| `InlineTableOfContents.tsx` | an outline row's button | the heading's whole words when the outline cuts them |
| `MarginCommentRail.tsx` | the marker | its note; pointing at the marker opens the card, which holds the whole note |
| `ai-sidebar/ChatInput.tsx` | the AI picker in the message box's footer | its whole words when the footer cuts them; its narrow rules sit on the trigger itself |
| `DragHandleWithMenu.tsx` | Add block | nothing renders this component (`Editor.tsx` draws the + itself) |
| `ai-sidebar/ChatInput.tsx` | the file chip, the browser chip and its picture, a context chip, an attachment's name; a model's "default" in the picker's list | cut names; an option in an open list, where a tooltip would cover the next options |
| `ai-sidebar/ChatBubbles.tsx`, `CodexView.tsx`, `QueuePanel.tsx`, `ActivityStatusLine.tsx` | a file's path, a queued message, a status line | cut text |
| `ai-sidebar/ThinkingEffortControl.tsx` | the effort slider's value and its ticks | the slider's value, already its `aria-valuetext`; the ticks are drawn marks, hidden from assistive tech |
| `DataTable.tsx` | a cell's value; the formula bar's read-only note | cut text; a field, where a tooltip would open over the words being read |
| `ResizableImage.tsx` | a diagram's "Double-click to edit" | an image in the text, not a control |
| `agent/AgentConfiguratorPanel.tsx` | a tool pill's note | a pill, not a control |
| `flows/nodes/BaseNode.tsx` | a step's number, a field's value | not controls |
| `transcribe/TranscribePanel.tsx` | a recording's file name (three places) | cut names |
| `transcribe/workbench/Workbench.tsx` | a transcript row's "Click to play from here", a speaker's name, "The engine was unsure about this word" | the row: a 300 ms tooltip on every row while reading would get in the way (a decision for the lead); the rest are cut names and marks in the text |

## A5: buttons that cut their words (#566)

| Place | What it does now |
|---|---|
| Home's first-day card (the shared split button) | The shared rule: its icon alone when its first word doesn't fit; the whole words first in its tooltip, now added by the split button itself |
| Home's Change image | Moved onto the shared rule (`iconWhenNarrow`); Home's own container rule for it is gone |
| The board's Give to, Retry with (`AgentSplitButton`) | Words only: keeps today's cut |
| Word's and PowerPoint's Open in… (`ViewerToolbar.tsx`) | Their whole-toolbar rule stays (icons under 560) |
| The spreadsheet's Open in Excel | Its words are a component, so the shared rule leaves it; the toolbar's own rule (icons under 500) stays |
| Dictation | Its own split button shows words only while dictating; not changed |
| Share | Words only, and it never shrinks: not changed |

**The rule, as built** (`ui/button.tsx`): a `Button` with `iconWhenNarrow` and an icon and words draws the words in two parts, the first word apart. Its first word is cut when the word, with the ellipsis after it when the words run past the label, ends past the label's edge. The measurement is made with the words drawn, whatever the button shows, so the answer depends only on the room, and the button switches once each way (a unit test steps a room down and up). A `ResizeObserver` watches the button while it shows its words and the page always; with its icon alone the button is a fixed square, so its own switch is never watched. The square is the button's height (`aspect-ratio`), 32 for `sm`, 28 for Home's card. The words stay in the button, out of sight, as its accessible name.

**Found on the way, in the catalogue's first run:** the primary and quiet split buttons in the narrow cell still showed "A…": the first word's box fitted the label by half a pixel, and the ellipsis took its last letters. The rule now counts the ellipsis.

**Home, stepped through widths** (Home's page held at a width inside its tab, 300 → 120 → 300, Light and Dark; `qa/pr3-narrow/`): the first-day card's button shows its words down to 180 and its icon alone at 150 and 120, back to its words at 180; Change image shows its words down to 180, "Change…" at 150, its icon alone at 120, and back the same way. One switch each way for each. A first build showed Change image running past the cover's left edge at 120: the absolutely placed button took the width of its words, so the label never cut. The cover now bounds it (`max-width`, 12 clear each side, 8 under 200).

## #614: an icon's colour

`ui/Icon.tsx` drew every icon with its tone as the svg's `fill`, so a colour class on an icon set `color` and changed nothing. Every icon is now drawn in `currentColor`, as a button's icons are, and its tone sets the colour from `index.css` with no specificity (`:where(svg[data-icon-tone="muted"])`). A colour class on the icon or a stylesheet's rule for it wins; an icon with no colour of its own keeps its tone. A menu's items gave their icons their words' colour through `[&_svg]:fill-current`, which worked only while a tone was a fill; they carry `rm-icons-take-ink` now, so nothing changes there.

Sixty-five icons had a colour class that never showed (twelve more had `tone="inherit"` and showed it already). Each one, by the lead's rules: working and neutral marks are ink, indigo is a fill or an icon colour for primary things, amber is gone, errors are red.

| File | Icon | Drew (before) | Meant | Now |
|---|---|---|---|---|
| `DataTable.tsx` | sort carets (3) | muted | muted | muted |
| `DataTable.tsx` | Delete row's minus, on the red dot | muted | white | white |
| `DataTable.tsx` | Add row's plus, on hover | muted | indigo | the row's words' ink (`--r-ink-strong`) |
| `ai-sidebar/ActivePlanBanner.tsx` | a step in progress (dot) | muted | the progress bar's indigo | ink-strong (working) |
| `ai-sidebar/ActivePlanBanner.tsx` | a pending step (circle) | muted | muted | muted |
| `ai-sidebar/ActivityCard.tsx` | a subagent starting or working (robot, 2) | muted | the progress bar's indigo | ink-strong (working) |
| `ai-sidebar/AgentView.tsx`, `ChatInput.tsx`, `CodexView.tsx`, `PlanReviewCard.tsx`, `QueuePanel.tsx` (clock) | neutral marks (5) | muted | muted | muted |
| `ai-sidebar/QueuePanel.tsx` | a queued item's source | muted | faint | faint (as meant; below 3:1 on white, for the lead) |
| `ai-sidebar/CodexSetupView.tsx`, `SetupWizard.tsx` | broken (warning, 2) | muted | VS Code's failed red | `--r-error` |
| `ai-sidebar/CodexSetupView.tsx`, `SetupWizard.tsx` | signing in (spinner, 2) | muted | indigo | ink-strong (working) |
| `ai-sidebar/CodexSetupView.tsx`, `SetupWizard.tsx`, `OpenCodeSetupView.tsx` | sign in, set up, keys (sign-in 2, wrench, key) | muted | indigo | ink-strong (the title's ink) |
| `ai-sidebar/CodexView.tsx` | the compatibility notice's warning | muted | amber | ink-strong |
| `ai-sidebar/EnvironmentStatusNotice.tsx` | needs reload (arrows) | muted | indigo | ink-strong |
| `ai-sidebar/EnvironmentStatusNotice.tsx` | environment checks (warning) | muted | VS Code's failed red | `--r-error` |
| `ai-sidebar/OnboardingWizard.tsx` | a missing or failed tool (x, 2) | muted | VS Code's failed red | `--r-error` |
| `ai-sidebar/OnboardingWizard.tsx` | installing (spinner) | muted | indigo | ink-body (the installed check's ink) |
| `ai-sidebar/SubagentCard.tsx` | running (spinner) | muted | indigo | ink-strong (the done check's ink) |
| `ai-sidebar/SubagentCard.tsx` | stopping, stopped, ended, carets, robot (6) | muted | muted | muted |
| `ai-sidebar/SubagentCard.tsx` | error (warning-circle) | muted | red | `--r-error` |
| `dialogs/ConflictDialog.tsx` | the title's warning | muted | amber | ink-strong |
| `flows/ExecutionPanel.tsx` | a step running (spinner) | muted | the progress bar's colour | ink-strong (the done check's ink) |
| `flows/ExecutionPanel.tsx` | a step failed (x-circle) | muted | VS Code's failed red | `--r-error` |
| `flows/ExecutionPanel.tsx` | a step's icon, carets (3) | muted | muted | muted |
| `flows/ExecutionPanel.tsx` | Claude's progress: started, a tool, thinking (3) | muted | terminal blue, yellow, magenta | muted (its message's ink) |
| `flows/FlowsPanel.tsx`, `settings/RitemarkSettings.tsx` | loading (spinner, 2) | muted | muted | muted |
| `settings/GoogleDocsSettingsCard.tsx`, `settings/RitemarkSettings.tsx` | section heads (8) | muted | ink-strong | ink-strong |
| `settings/RitemarkSettings.tsx` | the voice model's drive | muted | muted | muted |
| `transcribe/TranscribePanel.tsx` | a file waiting to be transcribed (microphone) | muted | indigo | indigo (as meant: the card that waits for you; as the recording cards' microphone, for the lead) |
| `transcribe/TranscribePanel.tsx` | a transcript (waveform) | muted | muted | muted |
| `transcribe/workbench/InsightsLanguageCombobox.tsx` | the field's magnifier and caret (2) | muted | faint | faint (as meant: a field's marks; for the lead) |
| `transcribe/workbench/InsightsLanguageCombobox.tsx` | the chosen language's check | muted | indigo | indigo (as meant, as the shared Select's check today; the lead's issue on chosen rows says ink, after 2.2) |
| `transcribe/workbench/InsightsRail.tsx` | Insights' sparkle | muted | indigo | ink-body (its label's ink) |
| `transcribe/workbench/InsightsRail.tsx` | reading the transcript (spinner) | muted | indigo | ink-body (its words' ink) |
| `transcribe/workbench/Workbench.tsx` | the note's info | muted | faint | faint (as meant; for the lead) |

## #613: the Task board's columns

`.tb-cols` laid its columns out with `align-items: start`, so each column was as tall as its own cards, and a column's sticky header could only stick inside its own column. Scrolled past the end of a short column, the header left with it. The columns now stretch to the tallest (`align-items: stretch`): every header stays at the board's top while the board scrolls, and an empty or short column shows its whole lane, which is also its drop area.

## #615: the comment card

`.rm-marker` and `.rm-bubble` take `--r-surface`, a 1 px `--r-hairline-strong` and the menus' shadow; everything on them (the words, the done marks, Delete's and Edit's hovers, the agent badge and pill, the @ mentions and their picker, the compose field and its error) takes the theme's own tokens. No block of light values: the marker's focus ring keeps `--r-accent`, the idle dot `--r-ink-faint`. `theme/greenIsTheReadyDot.test.ts` pins it, and fails on any fixed light colour (`--ritemark-…`) left on the card. Two looks for the lead: the marker's hover darkens its edge one step further, to `--r-ink-faint`, since its rest edge is now the strong hairline; the marker's comment icon keeps the comment's amber, through the theme's `--r-warning`.

## The catalogue, and the proof

**`control-states.mjs`, all 456 states against the approved set:** with this PR, 100 differ (50 in each theme), all expected: the destructive button's eight states (the new red) and the dialog's nine (its Remove button is the destructive red); the tooltip's four; the 21 split button and More actions states that show a tooltip (hover, pressed, keyboard focus on either part, after Escape, after a keyboard pick: the new look, and the split button's tooltip now starts with its whole words); and the narrow cells of the five other buttons with an icon and of the three split buttons (their icon alone). The link button's narrow cell, words only, is unchanged. The catalogue's narrow button cell is now 56 wide (it was 72, where "Ask" still fits), so it shows the switch. Those 100 images replace their approved ones in `docs/development/control-baseline/` and wait for the Experience lead. Before and after crops of the changed cells: `qa/pr3-catalogue/`.

**Fails first:** `controlsPolish.test.ts` against the base's source fails at its first check ("every icon is drawn in currentColor"), and the updated `greenIsTheReadyDot.test.ts` at ".rm-marker is the theme's surface". On this branch both pass.

**Screenshots** (hidden dev instance, 1440 × 900 at 2×), each with the base's bundle for "before":
- `qa/pr3-board/`: the board scrolled 209 px with a short Doing column, Light and Dark, before and after.
- `qa/pr3-icons/`: the AI sheet's onboarding, Light and Dark, before and after: "Almost there!" with Git missing (its x red; it was grey) and "You're all set!" (its check in ink, as #612 left it). The states come from the host's own `onboarding:status` message, sent into the page, since the isolated instance has no AI signed in.
- `qa/pr3-comment/`: in Dark, the comment's marker, its card opened by pointing, held open, and the marker focused by the keyboard; the card in Light; and the card in Dark before (white).
- `qa/pr3-narrow/`: Home at 300 and 120 (Change image), and its first-day card at 320 and 120, Light and Dark (no "before": these widths are drawn by holding Home's page narrow).

# Sprint 142 Technical Plan

The plan for [spec.md](spec.md). The release is 2.1.0. The drawings are in `ritemark-dev`, `product/design/experience/`:
- `framework.md` §3 and §4;
- experiences 3, 20 and 35;
- the Tasks experience's frame 1;
- the Experience lead's rule on #503.

Code shapes here are proposals. When the code needs something else, this file changes first. File references are to `main` at `84ea15db` (Sprint 138's merge). Paths are under `extensions/ritemark/` unless they say otherwise; `webview/…` is `extensions/ritemark/webview/src/…`.

## What exists today

| Part | Today | File |
|---|---|---|
| The AI's Markdown | `RenderedMarkdown` parses with `marked` and injects `markdownStyles` once, from `AISidebar`. Its list rule sets margins and a 20 px `padding-left`, but no `list-style`. Tailwind 3's preflight (`@tailwind base`) sets `ol, ul { list-style: none }`, so lists have no markers. Used by `AgentResponse`, `CodexView`, `PlanReviewCard`, `ChatBubbles`; nowhere outside the AI's sheet | `webview/components/ai-sidebar/RenderedMarkdown.tsx:197–209`; `webview/index.css:1–3` |
| More's names | Patch 018's `RITEMARK_PLACE_WORDS` maps `workbench.view.scm` to "File changes" for More's menu only. The container's own title is VS Code's `localize2('source control', 'Source Control')`, and that heads the panel and its tooltip. Patch 002 adds View ▸ Advanced ▸ "Source Control" | `patches/vscode/018-ritemark-surfaces.patch` (`compositeBarActions.ts`); `vscode/src/vs/workbench/contrib/scm/browser/scm.contribution.ts:70–82`; `patches/vscode/002-ritemark-ui-layout.patch` (`layoutActions.ts`) |
| The switch note | `HomePanel` takes `switchedFrom` once, from global state, when it is created. The webview draws `.rh-toast` until Go back or ✕ (`home/go-back`, `home/dismiss-switched`): no timer, no end on activity. Fixed at the desk's foot, `max-width: calc(100% - 32px)`, ink 18% shadow | `src/views/HomePanel.ts:64–68`, `:263–272`, `:475`; `webview/components/home/HomePage.tsx:307–317`; `home.css:340–362`; `src/projects/switchProject.ts:21–23`, `:189–195` |
| Home's path | `placeParts()` splits the start from the last two folders. CSS gives the start an extreme shrink and `text-overflow: ellipsis`. Chromium draws the ellipsis after the last whole glyph that fits, and the rest of the start's box stays empty: most likely the gap seen in #557 (S23 measures it before and after). The tail can be cut too (`flex: 0 1 auto` with an ellipsis), so the project's folder can lose its end | `webview/components/home/homeWords.ts:33–43`; `HomePage.tsx:81–86`, `:95–102`; `home.css:102–110` |
| Split buttons | Five, each its own: | |
| | Home's ready request: `.rh-split`, two shadcn `Button`s. The main is disabled by `pressing` for up to 30 s after any press; the caret never is. The caret goes `#3730a3` while its menu is open. Each part has its own hover and `active:scale` | `webview/components/home/GuidanceCards.tsx:44–132`; `home.css:471–478` |
| | The board's `AgentSplitButton`: Give to, Review with, Retry with, Send to. The main is disabled when the chosen agent isn't usable, while the caret stays on if any agent is. Opacity per part | `webview/components/tasks/AgentSplitButton.tsx`; `tasks.css:26–34`; used in `CardParts.tsx:282`, `:308`, `:325`, `CardPage.tsx:154`, `IdeasView.tsx:64` |
| | Dictation: hand-rolled `<button>`s. The language part is disabled and faded while dictating | `webview/components/VoiceDictationButton.tsx:200–345` |
| | The viewers' `SplitButton` (Open in Word / PowerPoint): ghost parts in a bordered frame, hover per part | `webview/components/viewers/ViewerToolbar.tsx:207–269`; `DOCXViewer.tsx:634`, `PPTXViewer.tsx:465` |
| | The spreadsheet's Open in Excel / Numbers: hand-rolled `<button>`s with native `title`, hover per part | `webview/components/header/SpreadsheetToolbar.tsx:85–125` and its `<style>` |
| `Button` | Every variant carries its own hover, `active:scale-[0.98]`, `disabled:opacity-50` and a focus ring. The default variant has the indigo shadow | `webview/components/ui/button.tsx:16–49` |
| The ready request's press | `pressReadyRequest()`: the sample through the board's Give; folder-with-files sends `READY_REQUEST_TEXT.files` in a new chat; an empty project fills the box. The sheet reports each chat's origin (`onChatOrigin`), kept in `origins`; `record.chatId` is set when that chat's first turn is accepted. `openConversation(id)` already opens a chat on the sheet | `src/guidance/GuidanceHost.ts:95`, `:178–208`, `:339–343`; `src/views/UnifiedViewProvider.ts:191–199`, `:1882–1890`, `:1941`; `webview/components/ai-sidebar/store.ts:3025–3036` |
| Chat Debug | Answered: a dev-build artefact. A release build removes the built-in Copilot Chat | `research/chat-debug-release-build.md` |
| The sheets' edges | The desk (`.editor-container`) draws an outset hairline plus `0 1px 3px` and `0 6px 16px` with `overflow: hidden`, flush with the editor part's right and bottom edges, so those are cut. The AI's sheet (`.rm-ai-sheet`) draws an outset hairline and `0 1px 2px`, flush with its webview's bottom. `ritemark.sheetShadow` is slate `#0F172A` 7% in Light and black 35% in Dark | `patches/vscode/018-ritemark-surfaces.patch` (desk, `--rm-shadow`); `webview/index.css:262–266`; `package.json:1037` |
| The left column's scrollbars | Transcribe's list is `flex-1 overflow-y-auto pb-4`, with no scrollbar style. A few surfaces style their own (the welcome, the properties panel, the TOC); there is no shared rule | `webview/components/transcribe/TranscribePanel.tsx:233–240`; `welcome.css:27–30` |
| Tooltips | `ui/tooltip.tsx` wraps Radix Tooltip around a `span`. Radix opens on the trigger's focus unless a pointer press is in progress, and a tooltip opened by focus closes on blur. Stop on a card's page replaces Give to under the pointer. Focus landing on Stop is #505's inferred cause, not yet shown: A4 reproduces it first | `webview/components/ui/tooltip.tsx`; `webview/components/tasks/CardPage.tsx:166–174` |
| The board | `.tb-cols` is `repeat(4, minmax(220px, 1fr))` with `min-width: 964px`, 12 gaps and 24 padding. At 1440 with both side columns the drawn desk is 784 wide (A6 measures the build's), so the board scrolls | `webview/components/tasks/tasks.css:58–59` |
| Home at its narrowest | `#526` added container queries down to 388 px, and `.rh-name` uses `overflow-wrap: anywhere` (the mid-word break). Nothing covers a 150 px desk | `webview/components/home/home.css:23`, `:84–89`, `:239–300` |
| A card's tab | `ritemarkEditor.ts` sets `webviewPanel.title` and `iconPath` from the card's title when the editor is resolved (#477). VS Code serializes a custom editor's `getName()` and restores it as its title. So why the restored tab showed the file name in RC1 is unproven: A2 finds out | `src/ritemarkEditor.ts:763–783`; `src/taskBoard/cardPages.ts:185`; `vscode/src/vs/workbench/contrib/customEditor/browser/customEditorInputFactory.ts:69–110` |
| Transcribe a file… | `addFile()` → `_pickFile()` → `_stageImport()` (pending, waiting for an engine) → `_start()` enqueues the job. Nothing opens a tab; the workbench opens only from a row's click (`_openSession`), and it already shows a job's progress. No code path opens one for Record either: A5 checks what Record does on screen | `src/views/TranscribeViewProvider.ts:184–194`, `:310–371`, `:376–393`; `src/transcriptWorkbenchProvider.ts:77–85`, `:481–501` |
| Opening without focus | `vscode.openWith` takes `{ preserveFocus, preview, background }`; `background` maps to the editor's `inactive` | `vscode/src/vs/workbench/api/common/extHostTypeConverters.ts:1545–1560` |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Webview: shared | One split-button contract: a `SplitButton` component and `.rm-split` CSS (tones `primary`, `outline`, `quiet`; states on the wrapper). One tooltip rule. One left-column scrollbar rule | `webview/components/ui/split-button.tsx` (new), `webview/index.css`, `webview/components/ui/tooltip.tsx` |
| Webview: surfaces | The AI's lists; Home's note, path, card and narrow layout; the board's columns and buttons; dictation; the viewers' and spreadsheet's buttons; Transcribe's list | `ai-sidebar/RenderedMarkdown.tsx`, `home/*`, `tasks/*`, `VoiceDictationButton.tsx`, `viewers/ViewerToolbar.tsx`, `header/SpreadsheetToolbar.tsx`, `transcribe/TranscribePanel.tsx` |
| Host | Home's note ends on activity; the ready request's second press; Transcribe opens the workbench at a job's start; (A2) a restored card's title | `src/views/HomePanel.ts`, `src/guidance/GuidanceHost.ts`, `src/views/UnifiedViewProvider.ts`, `src/views/TranscribeViewProvider.ts`, (A2) `src/ritemarkEditor.ts` or `src/taskBoard/cardPages.ts` |
| Theme | `ritemark.sheetShadow`'s defaults | `package.json` |
| VS Code (shell-tier) | The SCM container's title; the desk's edge; (Q4) View ▸ Advanced; (A2) the restored card tab | `patches/vscode/018-ritemark-surfaces.patch`; (Q4) `002-ritemark-ui-layout.patch`; (A2) `019-ritemark-tab-row.patch` |

**Release tier: shell.** R2 (the SCM title) and R7's desk change patch 018, and Q4 and A2 may touch 002 and 019. Everything else is extension-tier and ships in the same 2.1.0 shell release (decision 1). No new runtime, protocol family, subsystem, patch file or feature flag.

## Phase 1 audits

Five things carry an unknown, so each gets a short audit under `research/` before its code (spec-driven-sprint, "Audit-First"). A1 was run while writing this plan.

1. **`research/chat-debug-release-build.md` (A1; R6). Done.** No code; one Gate 1 check.
2. **`research/restored-card-tab-audit.md` (A2; R12).**
   - **Reproduce on a dev build of main:** open a card's page in a background tab, quit, relaunch, and capture the tab's label at the first paint. Then the same with the card active, with its title edited before quitting, and with a profile carried over from 2.0.0 RC1's window state.
   - **Read what was restored:**
     - the window's serialized editor (`workbench.parts.editor` state in the profile's `state.vscdb`): which input type it was saved as;
     - whether its `title` is the card's;
     - whether a later step (the sticky-tab healer, the `*.md` → Ritemark association, `cardPages` not ready at resolve) puts the file name back.
   - **Decide:**
     - a fix in the extension (when the title is lost after restore, for example `applyCardTab` writing the base name before `cardPages` is ready);
     - or one in patch 019 (when core restores a card's tab from the file, for example an untyped restore through the editor association);
     - or "not reproducible on main", recorded with the profile that shows it and the issue closed as a migration artefact.

     *Open Questions* 9 covers the patch case.
   - **Reproducer:** the steps above as a CDP check (`scripts/qa/` or the audit's own snippet), failing on main if the bug is there.
3. **`research/left-column-scrollbars-audit.md` (A3; R8).**
   - **What paints the white strip** in Transcribe's list: VS Code's webview default scrollbar CSS, the panel's background, or the body's. Read in the dev tools, Light and Dark.
   - **Every left-column webview place with a list that scrolls,** filled until it scrolls: Transcribe, Agents, Browser Recent, Home's projects list, Tasks' list, and any other.
   - **Documents' native tree's scrollbar** (width, thumb colour, hover) as the look to match.
   - **The decision:** one rule for these places. A shared class or a `:root` rule in the left-column pages, with `scrollbar-width: thin` and `scrollbar-color: <thumb> transparent`, and `::-webkit-scrollbar*` only if Chromium ignores the standard properties there.
4. **`research/tooltip-after-click-audit.md` (A4; R9).**
   - **Reproduce #505** on a card's page and say what keeps the tooltip open: focus on Stop, a pointer that never left, or a remount.
   - **List every button that replaces itself when clicked:**
     - Give to → Stop;
     - the composer's Send → Stop;
     - dictation's Start → Stop;
     - Home's ready request → busy;
     - Review with → reviewing;
     - and others.
   - Confirm the fix below closes each one and keeps keyboard focus showing tooltips.
5. **`research/transcribe-tab-audit.md` (A5; R13).**
   - **What Record does today, on screen:** does its recording open as a tab, when, and from where (the webview, the controller, the workbench).
   - **Whether the workbench opened on a job's audio path** shows its progress before a session exists, for both engines.
   - **Whether `background: true` with `preserveFocus: true`** opens the tab without taking the keyboard from a Ritemark document being typed in.
   - **The decision:** one open path for Record and Transcribe a file…, and its focus rule.
6. **`research/sheet-edges-audit.md` (A6; R7, R10).** The frame's measures on a dev build at 1440 × 900, Light and Dark, with `scripts/qa/frame-geometry.mjs` and close-ups:
   - each sheet's box, its painter, its `overflow`, and how much room its shadow has (the desk, the AI's sheet, two desks, an empty desk, the welcome alone);
   - whether the editor part can hold 8 of ground inside the box that paints the desk's shadow without moving the measured edges. If not, the desk keeps its hairline only, as the Experience lead's rule allows;
   - the three surfaces to bring onto the kit (the Agents place's cards, Home's note, Mermaid's expand toolbar), with their current shadows;
   - the desk's width at 1440 with both side columns, on the Mac and (from the overlay) Windows at 100%, for R10.

When an audit changes a requirement, `spec.md` changes first (the Mid-Sprint Scope Change Protocol).

## Workstream 1: The AI's lists (R1)

In `RenderedMarkdown.tsx`'s `markdownStyles`:
- `ul { list-style: disc outside }`, `ul ul { list-style-type: circle }`, `ul ul ul { list-style-type: square }`;
- `ol { list-style: decimal outside }`, which keeps `marked`'s `start`;
- `li::marker { color: var(--r-ink-muted) }`, and `ol > li::marker { font-variant-numeric: tabular-nums }`;
- `li:has(> input[type="checkbox"]:first-child) { list-style: none }`, for task lists;
- the 20 px `padding-left` and the margins unchanged, so the text doesn't move.

`ol` inside `ul` takes `decimal`, not the nesting's types.

**Tests:** the webview tests run under `tsx` with no DOM, so the check is S1–S5 by CDP on the dev instance: each level's computed `list-style-type` and marker colour, and the first item's text x against main's.

## Workstream 2: File changes (R2; shell-tier)

In patch 018, `scm.contribution.ts`:
- the container's `title` becomes `localize2('ritemark.fileChanges', "File changes")`;
- `containerTitle` follows it;
- ids, `storageId` and the view names inside are unchanged.

More's `RITEMARK_PLACE_WORDS` entry for `workbench.view.scm` then repeats the container's name, so it goes, leaving one source for the name. If Q4 is yes, patch 002's View ▸ Advanced item reads "File changes". Both go through `./scripts/create-patch.sh` on a CoW-cloned `vscode/` in the sprint worktree, the drift check before the commit.

**Check:** S8–S11 on the dev instance with the patches applied. The pre-commit hook's patch checks.

## Workstream 3: The switch note's end (R3)

**Webview** (`HomePage.tsx`, a small hook `useNoteEnd` beside it):
- **The timer.** When the note mounts on a visible Home (`document.visibilityState`), start 6 s. Pause it while `pointerenter`/`focusin` hold, and restart 6 s on `pointerleave`/`focusout` when neither holds. At the end, send `home/dismiss-switched` (the existing message) and fade out (no fade with `prefers-reduced-motion`).
- **At once:**
  - a `pointerdown` on the page outside the note;
  - a `keydown` in Home (not Tab or Shift+Tab, which only move focus);
  - a `dragenter` on Home with files;
  - the page's `blur` while the note shows (the left column or another surface took the keyboard).

  Each sends `home/dismiss-switched`.
- **The pure rule** `noteEnds(event, state)` lives in `homeWords.ts` and is tested.

**Host** (`HomePanel.ts`): while `switchedFrom` is set, listen once, and dispose of the listeners when it clears:
- `window.tabGroups.onDidChangeTabs` (a tab chosen or opened);
- `workspace.onDidChangeTextDocument` for a document in this window (typing);
- the AI sheet's accepted turn (`onTurnAccepted`).

The first of these clears `switchedFrom` and pushes the state.

**CSS** (`home.css`):
- `.rh-toast` gets `max-width: calc(100% - 48px)` and `width: max-content`, so it is one line when it fits and wraps when it doesn't;
- the ✕ stays its last child;
- the shadow comes onto the kit with W7.

**Tests:** `home.test.ts` for `noteEnds` and the timer's pause and restart (fake timers). `homeState.test.ts` for the host's clear.

## Workstream 4: Home's path (R4)

Replace the CSS cut with a measured one, so the ellipsis touches the next character:
- **`placeParts()` returns three parts:** `start`, `parent` and `folder`, splitting at the last two separators.
- **A pure `middleCut(parts, fits)`** in `homeWords.ts` returns the shown string. It tries the whole path, then shortens `start` from its end one character at a time to its least ("…"), then `parent` the same way, and never `folder`. `fits(text)` is a width test.
- **A `useMiddleCut(ref, place)` hook in `HomePage.tsx`** gives `fits` from a canvas `measureText` in the line's computed font against the line's width. A `ResizeObserver` reruns it.
- **The line renders one text node** (no flex parts), so there is no box to leave a gap.
- **When `folder` alone doesn't fit,** the line renders `…/` plus the folder with `white-space: normal`, so it wraps at its spaces (Q6).
- The tooltip and the `aria-label` keep the whole path (unchanged).
- The missing-project row (`.rh-missing .rh-path`) uses the same hook.

**Tests:**
- `home.test.ts`: `placeParts` (POSIX, Windows, `~`, a two-part path);
- `middleCut` with a fake `fits`: the order things give way, the folder never cut, and no space beside the ellipsis.

## Workstream 5: One button, one tone (R5)

**The contract (`webview/index.css`, `.rm-split`):**
- **The wrapper** owns the radius, the shadow (primary only) and the pressed scale: `.rm-split:has(.rm-split-part:active:not(:disabled))`.
- **Hover is the wrapper's:** `.rm-split:hover:not([data-disabled]) > .rm-split-part` takes the tone's hover fill. The parts' own `hover:` and `active:` from `button.tsx` are neutralised inside `.rm-split`.
- **The divider.** A filled tone draws the caret's left edge as `inset 1px 0 0 rgba(255,255,255,.28)`; outline and quiet tones draw it as their hairline.
- **No open state.** `[data-state="open"]` changes nothing.
- **Disabled and busy are the wrapper's.** With `data-disabled` the whole button takes the disabled opacity, and both parts are `disabled`. With `data-busy` it does too, and the wrapper gets `aria-busy`.
- **Focus.** Each part keeps its `focus-visible` ring, 2 px and outlining that part only.

**The component (`webview/components/ui/split-button.tsx`, shadcn pattern):**

```tsx
<SplitButton
  tone="primary" | "outline" | "quiet"
  disabled?: boolean      // the whole button
  busy?: boolean          // the whole button, with aria-busy
  main={{ label, icon?, tooltip, onClick }}
  menu={{ label /* aria-label */, tooltip, open?, onOpenChange?, align?, alignOffset?, content /* DropdownMenuContent's children */ }}
/>
```

**Callers:**
- **Home's `ReadyRequestCard`** → `tone="primary"`:
  - `busy` only for the sample's press (`card.busy`);
  - never `disabled` for the empty project or the folder with files (R5b, Q1);
  - the `#3730a3` open rule goes.
- **`AgentSplitButton`** → `tone={variant === 'outline' ? 'outline' : 'primary'}`:
  - `disabled = disabled || !anyUsable`;
  - when `!usable && anyUsable`, the main part's `onClick` opens the menu, and its tooltip says "<Agent> is not ready. Choose another agent." (Q2);
  - `tasks.css`'s `.tb-split` rules go.
- **The viewers' `SplitButton`** (`ViewerToolbar.tsx`) becomes a thin wrapper of the shared one with `tone="outline"`. It is renamed `ViewerSplitButton` in that file, so the two names never meet.
- **The spreadsheet's split button** keeps its own menu, but its two parts become shadcn `Button`s with `Tooltip`s (no native `title`) inside a `.rm-split[data-tone="outline"]` wrapper. Its `<style>`'s per-part hover rules go.
- **Dictation** keeps its own language menu and states, inside a `.rm-split[data-tone="quiet"]` wrapper:
  - while dictating, the language part is not `disabled`; a press opens the menu with the language rows disabled and the line "Stop dictation to change the language" (Q3);
  - `finishing` sets `data-busy`;
  - the per-part disabled opacity goes.

**The ready request's second press (R5b, host):**
- **`GuidanceHost.pressReadyRequest()`:**
  - for `empty`, find this project's `what_for` chat (the newest in `origins` for this project, or `record.chatId`);
  - if it exists, call the sheet with `startChat({ …, conversationId, fill: 'if-empty' })`;
  - for `files` (Q1), find `record.chatId` or the `what_is_here` origin. If its request is unanswered (`answered()`), call `openConversation(id)` and send nothing.
- **`ChatStartRequest`** gains optional `conversationId` and `fill?: 'if-empty'`.
- **The sheet's `startChatFromHost`** reopens that conversation when it exists, and focuses the box. It writes the text and cursor only when the box is empty (whitespace only). Otherwise, a new chat as today.
- **`GuidanceCards.tsx`'s `pressing`** applies only to the sample (`card.kind === 'sample'`). The 30 s safety stays for it.

**Tests:**
- a `splitButtonState.test.ts` for the pure mapping (props → wrapper data attributes, each part's `disabled`, the main part's action);
- `guidance.test.ts` for the second press (empty with and without a chat, cleared and not; files answered and not);
- the sheet's `landingChat.test.ts` (or a new case beside it) for `fill: 'if-empty'`;
- `boardClicks.test.ts` for the not-ready main part.

**Docs:** the pattern into `.claude/skills/ritemark-design/references/components.md`, with the date and Jarmo's words (E5).

## Workstream 6: Chat Debug (R6)

No code. The Gate 1 check (S45) is added to the release plan's Gate 2 list and to the RC's checklist. #557's item 1 closes with A1 and the candidate's screenshot.

## Workstream 7: Sheets' edges (R7; shell-tier for the desk)

From A6, and the Experience lead's list on #503:
1. **Inset hairlines.**
   - The desk (patch 018, `.editor-container`): the hairline as `inset 0 0 0 1px var(--rm-hairline)` on an overlay inside the sheet (a `::after` with the same radius and `pointer-events: none`), since `overflow: hidden` would clip an outset one.
   - The AI's sheet (`index.css`, `.rm-ai-sheet`): the same, inset.
2. **The desk's shadow down to shadow-md:** `0 4px 6px -1px` and `0 2px 4px -2px` in ink 8% and 6%.
3. **The 8 of ground moves inside the box that paints each shadow**: the editor part and the AI's webview get the room as padding, as A6 measures it. Where the desk can't have it without moving the measured edges, its shadow goes and its hairline stays.
4. **`ritemark.sheetShadow`** (`package.json`): Light `#1E1B4B` (ink) at the kit's alpha, Dark `#00000000`.
5. **Onto the kit:**
   - the Agents place's cards (the Agent Library's HTML in `src/views/AgentLibraryViewProvider.ts`);
   - Home's `.rh-toast` (ink 18% → the kit's toast shadow);
   - Mermaid's expand toolbar (`webview/components/Editor.tsx:1320`, slate 24% → the kit's floating shadow).

**Checks:** `frame-geometry.mjs` passes as on main (S51), and `frame-screenshots.mjs --compare` against main's captures shows only the edges changed.

## Workstream 8: The left column's scrollbars (R8)

From A3:
- **One rule in `index.css`:** `.rm-ground-scroll { scrollbar-width: thin; scrollbar-color: var(--r-scroll-thumb) transparent; }`. The thumb is shown on hover or while scrolling, as Documents' tree does, with a `:hover` rule and a short "scrolling" class set by a passive scroll listener only if needed.
- **The rule goes on every list A3 names:** Transcribe's `flex-1 overflow-y-auto pb-4` first.
- **A3's answer decides the white source.** If it is the panel's own background, the fix is that background's token (the ground), not the scrollbar.

## Workstream 9: The tooltip after a click (R9)

In `ui/tooltip.tsx`, the trigger gets an `onFocus` that calls `event.preventDefault()` when the focused element isn't `:focus-visible`. Radix's handlers are composed after it and skip a prevented event, so a focus that follows a mouse or touch press opens nothing, and keyboard focus still opens the tooltip.

If A4 shows a remount under a still pointer is also involved, the trigger also closes on `pointerdown` inside it and opens only on a real `pointermove` (Radix's own `onPointerMove` already does that). That is decided by A4, not assumed.

**Tests:** a `tooltipFocus.test.ts` for the predicate. A4's reproducer passes.

## Workstream 10: The board at 1440 (R10)

In `tasks.css`:
- `.tb-cols { grid-template-columns: repeat(4, minmax(160px, 1fr)); min-width: 724px }`. That is 4 × 160 plus 3 gaps of 12 plus 48 of padding, and gives about 168 per column on 1440's desk, as drawn.
- Then each card's contents checked at 168:
  - the title wraps;
  - `.tb-split`'s main part truncates (W5);
  - the file chips truncate;
  - the agent mark stays.

Below 724 the board scrolls sideways as today (Q8).

**Checks:** S57 by CDP at 1440 × 900 (`scrollWidth === clientWidth` on the board's scroller), and S58 on Windows through the overlay.

## Workstream 11: Home at 150 px (R11)

In `home.css`, a container query `@container rh-desk (max-width: 200px)`:
- **`.rh-name`:**
  - `overflow-wrap: normal` and `word-break: normal`, so it breaks at spaces;
  - a smaller size (`clamp`) so a word of about 12 letters fits;
  - `overflow-wrap: anywhere` only as the last resort, set on the name's longest word by measure, if one is longer than the line.
- **`.rh-cover .rh-change`:** icon only, inside the cover (its label goes to its tooltip and `aria-label`).
- **The rows:** time under the name (`flex-wrap: wrap`; the time `flex-basis: 100%`).
- **Anything with a fixed least width** found at 150 px (the guidance card's split button, the starting tiles) wraps or shrinks: the split button's main part truncates, and the tiles go one across (already at 388).

No patch: the frame isn't changed (Q7).

**Checks:** S60 and S61 by CDP: `document.scrollingElement.scrollWidth === clientWidth` on Home.

## Workstream 12: A restored card's tab (R12)

By A2's decision:
- **In the extension:** `applyCardTab()` never writes the base name over a title it doesn't yet know. While `cardPages` isn't ready it leaves the restored title, then applies once the board has loaded (through the board's existing change event, or a small one added for it). `cardFile.test.ts` gains the case.
- **In patch 019:** a card file's tab restores with the serialized webview title. The exact hunk comes from A2, against `customEditorInputFactory.ts` or the editor association's restore.
- **The AI's chip:** the label path (`UnifiedViewProvider.ts:3546`) asks `cardPages` for the title once it is ready, and repaints the chip.

## Workstream 13: Transcribe a file… as a tab (R13)

In `TranscribeViewProvider._start()`, after `enqueue`, open the workbench on the job's audio:

```ts
const typing = isTypingInDocument(); // the active tab is a Ritemark or text document, and the window has focus
await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(pending.audioPath), TRANSCRIPT_WORKBENCH_VIEW_TYPE, {
  preview: false,
  preserveFocus: true,
  background: typing,
});
```

- Record goes through `_start()` too (its `stageImport`), so both end the same way. If A5 finds Record already opens a tab elsewhere, that path is moved here, so there is one.
- `_pickFile()` and the engine choice cancelled leave `_pending` and open nothing (unchanged).

**Tests:** a `transcribeOpen.test.ts` for `isTypingInDocument`'s rule, and S65–S69 by hand.

## Two merges

- **Merge 1 (extension-tier):** W1, W3, W4, W5, W7's webview and `package.json` parts, W8, W9, W10, W11, W13, and W12 if A2 puts it in the extension. It runs and is tested on any dev build of main.
- **Merge 2 (shell-tier):** W2, W7's desk, and W12 if A2 puts it in patch 019. These need a CoW-cloned, patched `vscode/` in the worktree and the drift check. They go in their own PR, so merge 1 never waits on a patch rebuild, and each patch's change is reviewed alone.

Both merge before 2.1's first release-candidate build. Main is frozen from that build (memory: freeze main during a release).

## Coordination

- **Sprint 141** (the model lineup) touches no file here.
- **Sprint 143** (fixes) is planned beside this one. If it takes Home or the board, it lands after merge 1 or rebases onto it. Home's `home.css`, `HomePage.tsx` and `GuidanceCards.tsx` are this sprint's main files.
- **The Experience lead** sees the screenshots before each merge (E3) and answers Q3 and Q6. The Development manager answers Q1, Q2, Q4, Q5, Q7, Q8 and Q9.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| The shared split button changes five surfaces, one of them the editor's toolbar | The pure state mapping is tested; each surface gets its own scenario (S28–S44); dictation keeps its own menu and states |
| The tooltip rule changes every tooltip in the app | It narrows only focus that isn't `:focus-visible`; keyboard focus is checked (S55); A4 lists the cases first |
| Measuring the path costs a layout on every resize | One `ResizeObserver`, one canvas context, a binary search over characters; only Home's head and the missing row use it |
| The desk's shadow can't have its room without moving the frame | The Experience lead's own fallback: the hairline alone (A6) |
| Patch 018 grows again | One hunk for the SCM title and the desk's CSS, through `create-patch.sh`, the drift check at merge |
| #508 doesn't reproduce on main | A2 records the profile that shows it, and the issue closes as a migration artefact with that evidence |
| Five separate faults become a long tail | Each requirement is small and independent; the cut line in the sprint plan says what goes first |

# Sprint 140 Technical Plan

The plan for [spec.md](spec.md). The release is 2.1.0, a cross-repo release whose shape lives in `ritemark-dev` (`releases/v2.1.0/shape.md`, items 2 and 5); its release plan follows from the Development manager. Code shapes here are proposals: when the code needs something else, this file changes first. File references are to `main` at `b1ac84a7` (2.0.1's closeout). `R/` is `extensions/ritemark/`.

## What exists today

| Part | Today | File |
|---|---|---|
| Home's page | Cover; head; the empty project's line; a notice with OK; **What moved**; **Waiting for you**; Start something (Text, Table, Web page); Drop files (empty) or Last changed | `R/webview/src/components/home/HomePage.tsx:273–316` |
| Home's host and protocol | `HomeHost`, view type `ritemark.home`. One host message, `home/state`; requests decoded strictly in `decodeHomeRequest`. `HomeState` has no AI and no guidance field. Redraws on project file changes, the chat index, the list, extensions and board snapshots | `R/src/views/HomePanel.ts:68–97, 361–451`; `R/src/projects/protocol.ts:62–207` |
| What moved | Shown while `ritemark.updatedFrom1x` is set and `ritemark.whatMovedSeen` is not; Got it writes the latter | `R/src/projects/homeState.ts:100–108`; `HomePanel.ts:253–256, 411` |
| File kinds on Home | The host scans up to 5,000 supported files for Last changed and throws the counts away; `empty` from `findFiles(…, 1)` | `HomePanel.ts:30, 423–434`; `homeState.ts:14–24` |
| Ritemark's project list | `<globalStorage>/projects/v1/list.json`; each entry has `foundBy: 'opened' \| 'recent' \| 'chats'` and `addedAt`. No "sample" or "new" mark | `R/src/projects/ProjectList.ts:26–35, 94–125`; `firstFill.ts:63–111` |
| The sample | `R/sample-project/Leadership programme/`, card `m4d7r2` "Draft Module 4 from the brief" (files: `Brief.md`, `Research/Interviews with shift leaders.md`); copied by the welcome, cards re-dated | `.ritemark/tasks/m4d7r2-draft-module-4.md`; `R/src/welcome/sampleProject.ts:42–98` |
| Give to Claude | `GiveButton` (on `AgentSplitButton`) → `board/give` → `BoardController.give` → `tryStart` → `startTurn` → `CardHandoffLedger.start` → `comment-task/enqueue` with `newConversation`: a chat that runs in the background, never made the open one | `R/webview/src/components/tasks/CardParts.tsx:301–321`, `AgentSplitButton.tsx:31–103`; `R/src/taskBoard/BoardController.ts:738–981`, `CardHandoffLedger.ts:113–198` |
| A new chat from the host | No way to open a visible chat with a message sent or put in the box. `landing:new-chat` sets a placeholder only. Per-chat drafts exist in the store. `createConversation` reuses a blank chat | `R/src/views/UnifiedViewProvider.ts:1714–1721`; `R/webview/src/components/ai-sidebar/store.ts:341–342, 1083–1086, 1199–1206, 2151–2185` |
| The AI's empty chat | Claude and OpenCode: "<AI> can work with your files" and three examples that **send at once**. ChatGPT: "ChatGPT can work with your files", "Type a message to start.", a compatibility notice, no examples | `R/webview/src/components/ai-sidebar/EmptyState.tsx`; `AgentView.tsx:175–178`; `CodexView.tsx:50–71` |
| What is open, for the AI | `active-file-changed {path, label}`; the host knows the editor's view type but drops it | `UnifiedViewProvider.ts:3207–3213, 3334–3372` |
| A chat's outcome | Durable records for all three AIs: `assistant-message` with `terminalStatus` `completed` or `failed`; `boundary` `failed` with `failureKind`; the index's `lastReplyAt` | `R/src/conversations/types.ts:103–137, 746–753` |
| Word to Markdown | Only in the webview's Office preview: Mammoth, then Ritemark's Turndown rules, for Make an editable copy. The host writes the result. Mammoth is a webview dependency only; the host lists Turndown but never imports it | `R/webview/src/components/viewers/DOCXViewer.tsx:530–591`; `R/src/export/saveAsMarkdown.ts:36–127`; `R/webview/src/utils/turndownService.ts:25`; `R/package.json:1172–1173` |
| PDF to Markdown | Only in the webview (`convertPdfToMarkdown`, pdf.js passed in) | `R/webview/src/conversion/pdfToMarkdown.ts:64` |
| The Office package check | Size, entries, unpacked size and zip-bomb ratio, host side | `R/src/officePreview/officePackageCheck.ts:18–27, 78, 192` |
| Ritemark's agent tools | One registry, two groups (`ritemark_browser`, `ritemark_board`); Claude through an in-process SDK MCP server, Codex through dynamic tools, OpenCode through a stdio MCP adapter over a socket. `ToolContext` has no project root. No tool reads a document | `R/src/runtime/ritemarkTools.ts:45–404`; `RitemarkToolsInjector.ts:39–119`; `RitemarkIpcServer.ts:31–47`; `R/src/browser/browserMcpAdapter.ts:44–46` |
| What the AIs get for a .docx | The path only (`[Currently editing: <path>]`). The composer drops a .docx attachment; Codex drops text and PDF attachments; OpenCode's `fs/read_text_file` returns a .docx as garbled UTF-8 | `R/src/agent/AgentRunner.ts:774–795`; `R/src/codex/CodexRuntime.ts:332–341`; `R/src/acp/AcpRuntime.ts:93–101`; `R/src/acp/acpFsProxy.ts:105–175`; `ChatInput.tsx:76–90, 750–752` |
| Standing instructions | One source for all three: `capabilityContext.ts` `SECTIONS`; Claude appends it, Codex takes it at thread start, OpenCode gets it on the first turn. Nothing about Office files | `R/src/ai/capabilityContext.ts:87–189`; `UnifiedViewProvider.ts:1096–1107` |
| Send Feedback | `ritemark.reactions`, All commands only: a quick pick of four reactions, then an input box. `ConsentGate.sendFeedback` sends even with usage data off, from a one-off client (`captureImmediate`), and returns true or false | `R/src/analytics/reactions.ts:25–70`; `R/src/analytics/consent.ts:198–230` |
| Report AI issue | Status bar item (right, 99) and AI information's "Report AI output" open `ReportDialog` on the AI's sheet. `mailto:` to info@productory.eu, bounded at 1,800 encoded characters, three outcomes, Copy, the address always visible, no claim of delivery | `R/src/reporting/` (`reportStatusBar.ts`, `reportCopy.ts`, `composeReport.ts`, `reportTransport.ts`, `protocol.ts`); `R/webview/…/reporting/ReportDialog.tsx`; `AIInformation.tsx:231–248` |
| The status bar's right group | Word count 101, AI status 100, update 100, Report AI issue 99, scheduled tasks 98, then VS Code's bell. No patch reorders items | the files above; `R/src/daemon/DaemonStatusEvents.ts:5–17` |
| The Help menu | Patch 015: a fail-closed allowlist (Getting started, Support, View License, Advanced, About) on both menu bars; Getting started is an `Action2` in `helpActions.ts`. There is no extension menu point for Help | `patches/vscode/015-ritemark-help-menu-policy.patch:50–163` |
| Window-level dialogs | VS Code's dialog, styled as experience 31 by 018, already passes `renderBody` through (`dialogHandler.ts`); the extension can only show text, detail and buttons | `patches/vscode/018-ritemark-surfaces.patch:2178–2340, 2896` |
| Toasts | VS Code's notifications, restyled by 018; Home and the board draw their own small toasts | `018:2390–2460`; `HomePage.tsx:304` |
| Events | `app_session_start`, `feature_used`, `agent_used`, `reaction_submitted`, `feedback_sent`, the welcome's four. Nearest to "made something": `feature_used` `export_pdf`, `export_word` (on request, not on success), `save_as_markdown`; nothing for publishing | `R/src/analytics/events.ts:8–61`; `R/src/ritemarkEditor.ts:1028–1065` |
| Empty places | Tasks' side bar "Nothing waits for you" + New task; the board's column hints; Conversations "No conversations yet"; Transcribe "Record, or transcribe a file." + the accepted kinds | `R/webview/src/components/tasks/TasksList.tsx:168–178`, `BoardColumns.tsx:25–30`; `ai-sidebar/ConversationsPanel.tsx:221`; `transcribe/TranscribePanel.tsx:323–345, 535–562` |
| Store notes | 2.0's certification notes name "Report AI issue" | `docs/microsoft-store-submission/CERTIFICATION-NOTES-v2.0.0.md:35` |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Extension: a new `guidance` module | Which guidance card is due, the ready request's kind and lifetime, the counts line, the saved days, the starting place; state in global storage | `R/src/guidance/` (new) |
| Extension: Home | `HomeState` gains the guidance card and the AIs; new `home/*` requests; the order | `R/src/projects/protocol.ts`, `homeState.ts`, `R/src/views/HomePanel.ts`, `R/webview/src/components/home/` |
| Extension: the AI's sheet | A host-started chat (sent or filled, in front); the starting place sent with what is open; starting points; counts on send | `UnifiedViewProvider.ts`, `ai-sidebar/store.ts`, `ChatInput.tsx`, `AgentView.tsx`, `CodexView.tsx`, `StartingPoints.tsx` (new) |
| Extension: documents (R1a only) | Word to Markdown on the host; a `documents` tool group; a capability line | `R/src/documents/` (new), `ritemarkTools.ts`, `capabilityContext.ts` |
| Extension: offers (R7 only) | An `offers` tool group; offer cards under an answer | `ritemarkTools.ts`, `ai-sidebar/OfferCards.tsx` (new) |
| Extension: feedback | One door, one sheet, two routes; replaces the report window's entry points and the reaction picker | `R/src/feedback/` (new), `R/src/reporting/` (kept: transport, compose, copy), `R/src/analytics/` |
| Webview: empty places | Words and layout of three empty states | `tasks/`, `ai-sidebar/ConversationsPanel.tsx`, `transcribe/TranscribePanel.tsx` |
| Patch 018 | The Ritemark sheet over the window (`_ritemark.feedbackSheet`), its styles | `patches/vscode/018-ritemark-surfaces.patch` |
| Patch 015 | Help ▸ Send feedback, and its id in the allowlist | `patches/vscode/015-ritemark-help-menu-policy.patch` |

The release tier is **shell** (patches 015 and 018). Everything else is extension-tier. The sprint changes structure (a new `guidance` module, a new feedback module, new message types across the AI sheet's boundary, perhaps new tool groups), so `architecture.md` is updated before the sprint closes (Sprint Architecture Gate).

## Phase 1: the spike and the audits

Nothing in Workstreams 4 to 6 is built before the spike's decision; nothing in Workstream 8 before the sheet's audit. When the spike or an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol).

### The Word spike (#497), part A: what each AI reads

**The fixture.** A folder, "Training work", made for the spike and fictional throughout: 20 Word documents and 10 PDFs (8 with text, 2 scanned), 4 spreadsheets and 3 Markdown files, with the modification times set so that the five newest documents are 3 Word files and 2 PDFs. Each document carries one planted fact (a made-up sentence such as "The Fernhollow pilot runs in Tartu in March") that only reading it can give. It is generated by a small script kept with the research note; the Office files' metadata is scrubbed (memory: Office fixtures carry the saver's name).

**The runs.** On the installed 2.0.1, on the Mac and on Windows, with Claude, ChatGPT and OpenCode (OpenCode with the test keys from the Development manager's registry; Jarmo types no keys):
1. A new chat, the AI's default mode (Auto), and exactly the drawn request: "What is here? Look at the names first, and read only the five newest documents." Three runs per AI per computer.
2. The same once in Manual.
3. The open-document case from #497's comment: a Word file open and in front, "What did we promise Harbour about the team survey?". Once per AI per computer.
4. The same as 1 with a PDF-only folder, for PDFs on their own.

**What is recorded per run:** which names it listed; which of the five newest it opened, and whether its answer gives each planted fact right (that is "read"); how it read each one (its own read tool, a shell conversion such as `textutil` or a script, or nothing); whether it said what it skipped; whether anything stopped for the person's approval, failed or ran past three minutes; how long the answer took.

**The decision rule**, decided separately for Word documents and for PDFs:

1. **An AI passes a kind** when, in at least 5 of its 6 runs in Auto (3 on the Mac, 3 on Windows), it reads every one of the newest files of that kind, with no approval asked of the person, no error and no stall, and in Manual it either reads them or says plainly that it needs approval.
2. **All three pass a kind:** no Ritemark reading for that kind. The request stays as drawn. Every AI's standing instructions gain only the honesty line (spec R1).
3. **Any AI fails Word documents:** prototype R1a on a spike branch (Mammoth and Ritemark's Turndown rules on the host, one `read_document` tool in the registry, a capability line naming it) and re-run that AI. If it now passes, **R1a** is built for all three, not only for the AI that failed: one tool, defined once. The open-document case decides whether the active file's line names the tool for a .docx.
4. **An AI still fails with R1a** (it does not call the tool, or the tool's Markdown does not answer the planted facts), **or fails PDFs:**
   - for PDFs, the spike also tries the existing PDF converter on the host (pdf.js's legacy build, `convertPdfToMarkdown`). It joins R1a only if that AI then passes and `out/extension.js` grows by no more than 3 MB for Mammoth and pdf.js together; otherwise PDFs are not read through Ritemark in 2.1;
   - **R1b** applies to what is left: the sent request tells the AI to read only what it can open and to say what it skipped, in the Experience lead's words, and the card's note promises no more than the weakest AI does.
5. **The starting points follow the same result** (spec R8): "A Word file or PDF open" is offered for a kind only if every AI passes it, with or without R1a.

The decision, the runs and the numbers go in `research/word-spike.md`; `spec.md`'s R1 gains R1a or R1b (or both, per kind). The prototype stays on the spike branch; Workstream 4 builds the chosen shape with tests.

### The spike, part B: the two offers as cards (R7)

On the spike branch, a prototype `offer_next_steps` tool (`{ offers: [{ title, detail, request }] }`, at most two) in an `offers` group, with one capability line: at the end of a first look at a project, offer About this project and one piece of real work from what you found, through this tool. The answer renders the offers as plain buttons, enough to see that it works.

- **Pass:** for each AI, in at least 5 of 6 first looks (part A's runs), it calls the tool once, with two offers that fit (About this project, unless it exists, and real work named from the folder), after its paragraph; and in five ordinary chats ("Tighten this paragraph", …) it never calls it.
- **All three pass:** R7 is built (Workstream 5). **Any fails:** R7 is not built, the offers stay in the answer's words, and the Experience lead is asked to redraw frame 2 (spec J3).
- How offers persist when the chat reloads is part of this check. If they need a new conversation event kind, that is a change to `ConversationRecordV1` and gets its own audit before R7 is built (an older Ritemark rewrites records it does not know).

### The audits

1. **`research/feedback-sheet-audit.md`** (R10–R13):
   - VS Code 1.142's dialog with `renderBody`: a message field that grows from 112, two boxes whose state changes the button, the note and the foot at once, a third box that shows only when the first is ticked and a chat answer exists, a quoted block, Enter for a new line and ⌘Enter / Ctrl+Enter for the button, Escape, the focus order, VoiceOver and Narrator, the window dimmed behind it including the desk's and the AI sheet's webviews, Windows' custom dialogs;
   - how the result returns to the extension (an internal command, `_ritemark.feedbackSheet(spec) → result`, registered by 018), and that the sheet's words come from the extension so they can change without an app release;
   - frame 5's hand-off state in the same sheet, and frame 4's toast as 2.0's notification toast;
   - Help ▸ Send feedback as an `Action2` in 015 beside Getting started, with its id in the allowlist (preferred), or an extension menu point mapped in 018 as `ritemark/fileMenu` is;
   - **the fallback** if the dialog cannot carry the sheet: the sheet on the AI's sheet, as `ReportDialog` is today, extension-tier but not as drawn, to be agreed with the Experience lead before it is built.
2. **`research/feedback-delivery-audit.md`** (R13, D6): what `ConsentGate.sendFeedback` can know. With usage data off, `captureImmediate` on a one-off client: does a failed request reject? With usage data on, `track` only queues: can the sheet's send use `captureImmediate` too, so both cases know? The words of frame 4 follow what is known.
3. **`research/confirmations.md`**:
   - every empty place's sentence is true in 2.0: chats are kept on this computer, never in the project's folder, for all three AIs (Ritemark's store under global storage; each runtime's own session files);
   - a person's save in the Markdown and table editors fires `onDidSaveTextDocument`; what else counts as a saved document;
   - every copy of the sample since 2.0 holds `m4d7r2`; what Give does when that card is not in To do;
   - "a chat was started in this project" read from the chat index by the project's scope, without opening records; the ready request's chat told apart by its conversation id;
   - counting names in a OneDrive, SharePoint and Google Drive folder with online-only files, on the Mac (File Provider) and Windows (Cloud Files), hydrates nothing (`fs.readdir` with types, no `stat`), within 1 s for 10,000 names;
   - where a new document is "made" in a session: Ritemark's New, Make an editable copy, an export or publish that succeeded, or a file written during an AI turn in this window (the turn's own file changes), not a sync client's download.

## What the spike and the audits changed

Written 26 October, with the build; the spike's runs are in `research/word-spike.md`, the audits in `research/`.

- **The spike (#497), so far.** ChatGPT passed Word documents and PDFs on the Mac (one PDF run stalled for 7m27s); Claude and OpenCode were not run (no Claude sign-in on this Mac; no keyless OpenCode inside Ritemark), and Windows was not run. Part B failed for ChatGPT (0 of 3 first looks called `offer_next_steps`). So: **no R1a, no R1b**; every AI gets the honesty line (capability context version 3); **R7 is not built**, and frame 2 needs the Experience lead's redraw (J3); the Word-or-PDF starting points stay behind a gate (`READ_KINDS_EVERY_AI_PASSED` in `guidance/startingPlace.ts`) until every AI passes, so a Word file or PDF in front shows the project's points. Claude's 8 runs, OpenCode's and Windows' stay open.
- **The sheet is not VS Code's dialog.** The dialog takes its buttons once and closes on any press, so it cannot carry R11–R13 (`research/feedback-sheet-audit.md`). The sheet is its own DOM in patch 018 on the dialog's dimmed block, as drawn; the fallback for a shell without it is 2.0's report window and an input box.
- **"Sent" needed a fix to be true.** posthog-node's `captureImmediate` does not reject on a failed request. `analytics/posthog.ts` now makes a send that emitted an error throw, so the sheet's straight route knows (`research/feedback-delivery-audit.md`).
- **One PR, not two merges.** The coordinator asked for one PR with the whole sprint; the delivery plan's two merges become one.
- **Found on the way.** ChatGPT's file citations were drawn as raw markup; `chatLinks.rewriteCodexCitations` draws them as links. ChatGPT's first turn in a fresh profile took about 6 minutes in the spike (later turns took seconds).

## Workstream 1: Guidance state and Home's order (R2, R6, R14, E2, E3)

- **`guidance/guidanceState.ts`** (pure): given what moved's state, the project's ready request state, the feedback card's state, today's date and the day the ready request last showed, returns the one card due, or none (R2, R14's day rule). Unit tested with the drawn order and every pair.
- **`guidance/readyRequest.ts`** (pure): the kind (`files`, `empty`, `sample`) from `empty`, the presence of `m4d7r2` and the project list's `foundBy`; whether it is due (met first, no chat started, not answered, not hidden); its words with the AI's name (R3).
- **`guidance/folderCounts.ts`** (pure): the counts line from a list of names (kinds, at most four named, singulars, others last, the 10,000 cap). The host side lists names with `fs.readdir` and types, skipping `.ritemark/`, dot-names and the pointer `CLAUDE.md` (per the confirmation).
- **`guidance/savedDays.ts`** (pure): distinct local dates of saves in this release; due on the third.
- **`guidance/guidanceStore.ts`**: one global-state key, `ritemark.guidance.v1`: per project folder URI, the ready request's state (`answered`, `hidden`, `chatStarted`), its conversation id and the chosen AI; the release's saved days; the feedback card's answer per release (`sent`, `notNow`); the date the ready request last showed. Nothing is written in the project's folder (E2).
- **Home's state** gains `guidance: { card: 'what-moved' } | { card: 'ready-request', … } | { card: 'feedback' } | undefined`, replacing the separate `whatMoved` flag; `HomePage.tsx` draws Waiting for you, then the one card, then Start something (R2).
- **Lifetime** (R6): Home's host already redraws when the chat index changes. On each redraw it asks the conversation store about the ready request's chat (a completed `assistant-message` is "answered"; a failed one or a failed boundary leaves it) and whether the project's scope holds any other chat. For the sample, the card's hand-off record says whether it finished with a result.

## Workstream 2: The ready request card and Ask with (R3, R4)

- **`ReadyRequestCard.tsx`** (Home): experience 35's card, with the three kinds' words from the host (the words live in `guidance/readyRequest.ts`, so the host and its tests own them).
- **The split button:** built on the board's `AgentSplitButton` pattern, with the "Ask with" heading, experience 19's icons, the AI names as people know them (Claude, ChatGPT, OpenCode) and each AI's state on the right (✓, Sign in, Set up).
- **The AIs:** Home's state gains `ais: [{ id, name, state: 'ready' | 'sign-in' | 'set-up' | 'checking' }]` from `UnifiedViewProvider.runtimeAvailability()`, the host's one definition, and the chosen AI (R4's default: `ritemark.ai.selectedAgent` when ready).
- **Sign in and Set up** run the welcome's entry points (`beginClaudeLogin`, `UnifiedViewProvider.startCodexSignIn`); OpenCode's keys sheet is lifted from `welcome/WelcomeParts.tsx` into a shared component that both the welcome and Home draw, and its host handler is shared. When the AI becomes ready, the card chooses it.
- **New `home/*` requests** (exact-field, in `projects/protocol.ts`): `home/ready-request` (press), `home/ready-request-ai` (choose), `home/ready-request-hide` (×), `home/sign-in` (`ai`).

## Workstream 3: Starting a chat from Home (R5)

- **`UnifiedViewProvider.startChat({ runtimeId, text, send, origin })`** posts `chat/start` to the AI's sheet, held until `sidebar/ready` as `landing:new-chat` is. It shows the sheet and takes focus.
- **The webview** (`store.ts`): reuse the blank chat or make one, make it the open one, choose the runtime, then either put `text` in the chat's draft with the cursor at its end and focus the box (`send: false`), or send it through the runtime's own send path, Claude's and OpenCode's `sendAgentMessage` or ChatGPT's (`send: true`). The turn's `agent-execute` carries `origin: { readyRequest: 'what_is_here' | 'what_for' }`, so the host records the chat's id in the guidance store and counts it (R15).
- **The sample:** Home's host calls the board controller's `give('m4d7r2', runtimeId)` in the same window (composed in `projectsHost.ts`), so the card runs exactly as the board's Give does.

## Workstream 4: Word reading (R1), per the spike

**If R1a:**
- `R/src/documents/docxToMarkdown.ts`: Mammoth (added to `R/package.json`; pure JavaScript, inlined by esbuild into `out/extension.js`) and Ritemark's Turndown rules, moved from `webview/src/utils/turndownService.ts` to a module both sides import, so Make an editable copy and the tool give the same Markdown. Images are left out and counted ("2 pictures left out"). The package check (`checkOfficePackage`) runs first.
- A `documents` group in `ritemarkTools.ts` (`ritemark_documents`, Codex prefix `ritemark_documents_`), with `read_document({ path })`: a path inside the project only (`resolveWithinWorkspace`), `.docx` only (and PDF if the rule took it in), Markdown out, text only. The project's root reaches the tool through a setter, as the board's controller does. `ToolGroupId`, `toolGroupsFor`, `toolGroupById` and their tests change; the OpenCode permission check treats it as the board's tools are treated (never asks).
- `capabilityContext.ts` gains a `documents` section: Word documents are read with `read_document`. The active file's line for a .docx says it can be read that way.

**Either way:** the honesty line in `capabilityContext.ts` (when you cannot open a file you were asked to read, say which), and under R1b the request's added words in `guidance/readyRequest.ts`.

**Tests:** `documents/docxToMarkdown.test.ts` (a small fixture: headings, a list, a table, a picture left out, a refused package), `ritemarkTools.test.ts` (the group in each runtime's projection), `capabilityContext.test.ts`.

## Workstream 5: The offers (R7), only if part B passed

- An `offers` group with `offer_next_steps`, defined once; its result is posted to the chat as offer cards (`OfferCards.tsx`), title and muted line as drawn; a click fills the box (Workstream 6's fill). Persistence as part B decided.
- Tests: the tool's shape, the projection into all three AIs, the cards' render and fill.

## Workstream 6: Starting points (R8)

- **The starting place** (host, pure `guidance/startingPlace.ts`): from the active editor's view type and, for the Markdown editor, the document's word count (short below 300), and from the project's kind and About this project's presence, one of `project`, `empty_project`, `word_or_pdf`, `short_text`, `long_text`, `table`, `sample`. `word_or_pdf` only if the spike's result allows that kind (R1). Posted with `active-file-changed` as `place` and `hasAbout`.
- **The words** (webview, pure `ai-sidebar/startingPoints.ts`): R8's table, at most three; the "…" rule (text before it, cursor, text after it).
- **`StartingPoints.tsx`**: "What shall we work on?", the sentence, the cards; replaces `EmptyState`'s examples in `AgentView` and is added to `CodexView` under its compatibility notice. Hidden while the box holds the person's own words.
- **The fill** sets the chat's draft through `setComposerDraft` and a cursor offset; the draft remembers which starting place it came from, and `agent-execute` carries `startingPoint: { place, edited }` for R15.
- **Tests:** `startingPlace.test.ts`, `startingPoints.test.ts` (every place, at most three, the "…" fill, About present), a render test of each AI's empty chat.

## Workstream 7: Empty places (R9)

- Tasks: the board's Board view with no cards draws experience 29's empty state (icon tile, heading, sentence, the ways as icon rows); the side bar's stage lines as drawn. New task stays.
- Conversations: the empty panel's two lines.
- Transcribe: the empty library's sentence and its two actions; the accepted kinds and the engine's first run stay.
- Every sentence as confirmed in Phase 1; the AI's name from the sheet's chosen AI.

## Workstream 8: The feedback door (R10–R13)

- **`R/src/feedback/`** (new):
  - `feedbackCopy.ts`: every string of the sheet, the hand-off, the toast and the card, in one table; the honesty test covers the e-mail route's strings (`DELIVERY_CLAIM_WORDS`);
  - `feedbackRoute.ts` (pure): the route from the boxes (`straight` when neither, `email` when either), the button, note and foot;
  - `feedbackSheet.ts`: `ritemark.feedback.open({ from, kind })` builds the sheet's spec (words, whether the last-answer box exists and the chat's title), calls `_ritemark.feedbackSheet`, then sends (straight) or composes and opens the e-mail (Sprint 126's `composeReport` and `reportTransport`), then shows the outcome;
  - `feedbackStatusBar.ts`: "Send feedback", right, priority 97 (immediately left of the bell, right of scheduled tasks at 98), tooltip "Send feedback or report an AI issue"; it replaces `reporting/reportStatusBar.ts`'s item.
- **`composeReport`** gains an optional `lastAnswer` the person saw and ticked, and the kind (`feedback` with an answer wanted, or `ai-issue`) for the subject. The negative tests change on purpose: they still prove nothing else from the conversation goes. The answer is shortened to fit the 1,800 bound before the sheet shows it (D10).
- **The last answer** comes from the open chat's durable record (its newest completed `assistant-message`), the same for all three AIs.
- **AI information** (`AIInformation.tsx`): "Report an AI issue" asks the host to run `ritemark.feedback.open({ from: 'ai_info', kind: 'ai-issue' })`. `ReportDialog.tsx` and its `report/*` messages retire once every row of spec R16 that it served works from the sheet.
- **`ritemark.reactions`** (All commands' "Send Feedback", kept by 003's palette policy) runs `ritemark.feedback.open({ from: 'command' })` (J2). The internal command is hidden from All commands, so patch 003 does not change.
- **Patch 018:** `ritemarkFeedbackSheet.ts` registers `_ritemark.feedbackSheet`: it draws the sheet through `IDialogService` with `renderBody` (title, lede, field, boxes with their muted lines, the quote, the note, the foot, the two buttons), applies the route's words live as boxes change, and returns `{ button, text, aiIssue, wantAnswer, lastAnswer }`; the hand-off state takes `{ title, body, quote, foot }` and returns Copy or Done. Styles in `ritemarkSurfaces.css`, as experience 31's dialog. A VS Code unit test covers the live route words and the keys.
- **Patch 015:** an `Action2`, `ritemark.help.sendFeedback`, "Send feedback", beside Getting started and Support (D7), running `ritemark.feedback.open({ from: 'help' })`; its id joins the allowlist; the menu's test gains it.
- **Docs:** `architecture.md`'s *AI output reporting* becomes the feedback door (its two properties, the payload bound and no claim of delivery, carried and restated with the last answer); the Store's 2.1 certification notes; the user docs.

## Workstream 9: The feedback card (R14)

- `FeedbackCard.tsx` on Home: experience 34 frame 1's card. Send runs the straight route from Home's host (`home/feedback-send { text }`), with `asked: 'made_this_week'` (D11); Not now (`home/feedback-not-now`). A send that did not go keeps the text and says so.
- Saved days: `onDidSaveTextDocument` for the editors the confirmation names, recorded as local dates in the guidance store, per release (major.minor).

## Workstream 10: Counts (R15)

- `events.ts` gains `ready_request_used`, `starting_point_used`, `made_something`, `feedback_opened` with exactly R15's properties, through the one gate; `feedback_sent` gains the optional `asked`.
- `guidance/madeSomething.ts`: the window session's tracker; the first new document, export and publish each fire once, with whether a ready request was used in this session. Export and publish hooks fire on success (the export's write, Google Docs' publish), not on request.
- **The 7-day return** is a PostHog insight over these events and `app_session_start`, by the anonymous id, as `first-week.md`'s numbers are read (personless events: HogQL, not cohorts). Defined with the User lead and linked from the release's measures.
- **Privacy lines:** one line per event (when, what it carries, what it never carries) to the Development manager for `ritemark-web`.
- Tests in `analytics.test.ts`: each event's properties exactly, none before a yes, `feedback_sent` with `asked` still sent with usage data off.

## Workstream 11: Tests, docs and builds (E3–E6)

- **Unit tests** (added to `package.json`'s test script): the guidance modules, `startingPlace`, `feedbackRoute`, `feedbackCopy`, `composeReport` with the last answer, the analytics events, and Workstreams 4 and 5's tests if built. Webview tests: `startingPoints`, Home's order, the card's three kinds.
- **VS Code unit tests:** the sheet (018) and the Help item (015).
- **CDP checks** (`scripts/qa/`): Home's order with each card due; the card's kinds; each AI's empty chat with each starting place; the status bar's order; the sheet's two routes and the hand-off. Screenshots light and dark beside experience 35's frames 1, 3, 4, 5 and experience 34's frames 1–5.
- **Bundles:** `media/webview.js` and `out/extension.js` before and after (`notes/bundle.md`).
- **Builds:** after the shell merge, a production build from a clean-room worktree at the merged commit, all patches applied on the pin and a second run clean, the stacking check; a Windows build from main.
- **Docs:** `architecture.md` (Home's guidance; the feedback door; the starting points; the documents and offers groups if built; the capability context's new lines; the version-history row), `CLAUDE.md`'s rows for 015 and 018, the Store notes, the user docs, `docs/CHANGELOG.md` and the 2.1 notes draft.

## Delivery plan: two merges

1. **Merge 1, extension-tier:** Workstreams 1–7 and 10's day-one counts. Tried on the Mac on a dev instance and on Windows through the test overlay before the merge.
2. **Merge 2, the door:** Workstreams 8 and 9 and `feedback_opened`, with patches 015 and 018. After it: the production build check, the Windows round from main, and the Store notes.

Two merges keep the shell part small and separate, and let the team try the first day's guidance while the door is built.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| The spike shows an AI that reads neither Word files nor Ritemark's tool | The rule's step 4: R1b's words, and the card's note promises no more than that AI does |
| The offers are not called reliably by all three AIs | Part B decides before any build; R7 not built and frame 2 redrawn |
| The dialog cannot carry the sheet as drawn | The audit first; the fallback on the AI's sheet only with the Experience lead's agreement |
| "Sent" cannot be proven | The delivery audit; frame 4's words follow what is known |
| Counting a synced folder downloads online-only files | Names only, no `stat`; checked on OneDrive, SharePoint and Google Drive, Mac and Windows |
| The card shows on a project the person already uses | It needs `foundBy: 'opened'` and no chat in the project; a 1.x folder opened fresh after the update can still get it, which is accepted |
| A sync client's new files look like "made something" | Only Ritemark's own creates, successful exports and publishes, and files written during an AI turn count |
| Mammoth grows the host bundle | Measured; pdf.js joins only under the rule's 3 MB bound |
| The 7-day comparison can't be read from personless events | The insight is drafted with the User lead before merge 1 |
| Replacing "Report AI issue" in the status bar reads to a Store reviewer as removing the report path | AI information's labelled link stays, the door's tooltip names AI issues, and the 2.1 certification notes describe the path exactly |
| The Help item is dropped by 015's fail-closed filter | Its id is in the allowlist and the menu's test |
| Small numbers | 54 new people in three weeks: a week's change is noise; the counts are read over the release |

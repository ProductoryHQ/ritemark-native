# Sprint 143 Technical Plan

The plan for [spec.md](spec.md). The release is 2.1.0 ([release-plan.md](../release-plan.md)). Code shapes here are proposals; when the code needs something else, this file changes first. File references are to `main` at `1e91466c` (Sprint 137's merge). Paths are under `extensions/ritemark/` unless they say otherwise. The reproductions behind every row are in [research/reproductions.md](research/reproductions.md).

## What exists today

| Part | Today | File |
|---|---|---|
| Home's subscriptions | Pushed into one array; the project list's unsubscribe function is cast to a `Disposable`; `dispose()` calls each in a `forEach` and throws at that one | `src/views/HomePanel.ts:68–91`, `:515–519`; `src/projects/ProjectList.ts:98` |
| The welcome's landing | `goTo()` writes `ritemark.welcome.landing.v1` with the chosen AI, then `vscode.openFolder`; after the reload `runLanding()` → `openLandingChat(runtime, "Ask ChatGPT about this project")`, held until `sidebar/ready` | `src/welcome/welcomeHost.ts:255–296`, `:943–960`; `src/welcome/landing.ts`; `src/views/UnifiedViewProvider.ts:1864–1875`, `:627–636` |
| The landing in the sheet | `openLandingChat` → a new chat, `pendingLanding`; applied when the AI's model is known, retried after every host message, **dropped after 20 s** whatever the AI | `webview/src/components/ai-sidebar/store.ts:2191–2264`, `:3523–3524` |
| The AI a new chat starts with | `ritemark.ai.selectedAgent`, default `claude-code`; the welcome never writes it, the landing writes it once it applies (`ai-select-agent`); the sheet's first bootstrap binds the blank chat to it | `src/views/UnifiedViewProvider.ts:586–603`, `:2730`; `store.ts:2684–2760` |
| Codex's notifications | Ritemark listens to `turn/started`, `item/*`, deltas, plans, `turn/completed` and its own `progress`; not `error` (`willRetry`) or `mcpServer/startupStatus/updated` | `src/codex/CodexRuntime.ts:866–945` |
| A slow Codex call | `thread/start` posts "Starting ChatGPT. This may take a moment…" after 10 s (`codex-rpc-progress`), drawn on the running turn while nothing else shows | `src/codex/codexAppServer.ts:136–160`; `UnifiedViewProvider.ts:1453–1456`; `store.ts:3406–3414`; `CodexView.tsx:244–249` |
| The status line | "Working…" or "Working — <activity>" while running; Sprint 139's states after | `webview/src/components/ai-sidebar/activityState.ts:101–135`, `ActivityStatusLine.tsx:36–46` |
| A failed Codex turn | Sprint 139's classifier: codes first; a 429 after the retries (`responseTooManyFailedAttempts`, with `httpStatusCode`) falls through to `provider`, showing "exceeded retry limit, last status: 429 Too Many Requests" | `src/runtime/runtimeErrorPresentation.ts:262`, `:340–349`; `src/runtime/turnFailureCopy.ts:38–56`, `:318–345` |
| The title's one-shot | `runOneShotTurn` with the title prompt, no `settingSources` (the person's user, project and local Claude settings load), default tools | `src/conversations/ConversationTitleGenerator.ts:43–61`; `src/runtime/oneShotTurn.ts:73–103` |
| One-shots that load nothing of the person's | Idea review and the transcript insights: `settingSources: []`, `availableTools: []` | `src/taskBoard/ideaReview.ts:143–158`; `src/speech/insights.ts:55–70` |
| The comment's mention list | `ComposeBubble`: `findMentionQuery`, `insertMention`, `mentionKeyAction`; save → `applyNote` → `detectAgentAlias(note)` → the mark's `agentAlias`. The list sits above the box at `z-index` 40 | `webview/src/components/MarginCommentRail.tsx:290–420`, `:866–898`; `components/comment/AgentMentionPicker.tsx`; `extensions/comment/commentModel.ts:81–84`; `webview/src/index.css:589–590` |
| The formatting toolbar | A TipTap `BubbleMenu` whose own `shouldShow` asks only for a non-empty selection outside a code block, not for the editor's focus (TipTap's default asks for it); it stays up while the comment's box has the focus | `webview/src/components/FormattingBubbleMenu.tsx:263–276`; `node_modules/@tiptap/extension-bubble-menu/dist/index.js:8–24` |
| A person's message in the sheet | `UserPromptBubble` draws `turn.userPrompt` as a text child, no `white-space` rule; the older `ChatMessage` the same | `webview/src/components/ai-sidebar/ChatBubbles.tsx:31–68`; `AgentView.tsx:80–82`; `CodexView.tsx:179–181`; `ChatMessage.tsx:19–30` |
| Keys inside a webview | VS Code's webview host forwards every keydown (`did-keydown`); the workbench re-dispatches it only if its token matches and the webview's frame is the document's active element | `vscode/src/vs/workbench/contrib/webview/browser/pre/index.html:603–651`; `webviewElement.ts:536–556`, `:744–770` |
| Home's page | A `WebviewPanel` (`ritemark.home`, `retainContextWhenHidden`), HTML set once per panel; its React page handles keys only in the line's input and the feedback card's input | `src/views/HomePanel.ts:134–200`; `webview/src/components/home/HomePage.tsx:51–56`; `GuidanceCards.tsx:164` |
| Transcribe's formats | `.m4a, .mp3, .wav, .flac, .ogg, .aac` on every platform; on-device reads `.mp3, .wav, .flac, .ogg`; `.m4a`/`.aac` need `afconvert` (the Mac); on Windows the job fails once it runs | `src/speech/audioPrep.ts:18`, `:59–62`, `:110–120`; `engines/whisperLocalEngine.ts:31` |
| The pending card's engines | `_stageImport` lists every supported engine with a cost estimate; nothing per file | `src/views/TranscribeViewProvider.ts:323–351` |
| Needs attention | `AttentionRow`: the name, the message, Try again only when retryable; jobs in memory | `webview/src/components/transcribe/TranscribePanel.tsx:288–297`, `:662–684`; `src/speech/JobManager.ts:73–140` |
| Ritemark's pickers | 22 `showOpenDialog`/`showSaveDialog` calls; 12 pass a `defaultUri` | `src/views/TranscribeViewProvider.ts:310–318`, `src/views/ProjectsViewProvider.ts:140–143`, `src/views/HomePanel.ts:230`, `:293`, `:364`, … |
| The main process's dialogs | One per window per identical options; a second identical one returns "cancelled" at once | `vscode/src/vs/platform/dialogs/electron-main/dialogMainService.ts:213–275` |

## Architecture overview

Nine small changes in existing modules, no new subsystem, no new message type except one optional field on an existing one (W3), no record shape change.

| Layer | Requirement | Where |
|---|---|---|
| Home's host | R1 | `src/views/HomePanel.ts` |
| The welcome and the AI's sheet | R2 | `src/welcome/welcomeHost.ts`, `src/welcome/landing.ts`, `webview/.../ai-sidebar/store.ts`, `scripts/qa/` |
| Codex's runtime, the host, the classifier, the sheet | R3 | `src/codex/CodexRuntime.ts`, `src/views/UnifiedViewProvider.ts`, `src/runtime/runtimeErrorPresentation.ts`, `turnFailureCopy.ts`, `webview/.../ai-sidebar/` |
| The title's one-shot | R4 | `src/conversations/ConversationTitleGenerator.ts` |
| The formatting toolbar | R5 | `webview/src/components/FormattingBubbleMenu.tsx` |
| The person's message | R6 | `webview/.../ai-sidebar/ChatBubbles.tsx`, `ChatMessage.tsx` |
| Home's page, or the webview host | R7 | by A3 |
| Transcribe | R8 | `src/speech/audioPrep.ts`, `src/speech/JobManager.ts`, `src/views/TranscribeViewProvider.ts`, `webview/src/components/transcribe/` |
| Ritemark's pickers, maybe the main process | R9 | a helper beside the pickers, by A4 |

**Release tier: extension**, unless A3 or A4 puts a fix in a patch (E3).

## Phase 1: the audits still missing

The plan's own session reproduced #556, #544, #513 and #511 and most of #509, ran #551 21 times and #507 24 times without a failure. These four remain, each in `research/` before its code:

1. **A1, `research/landing-audit.md` (R2).** Not a new reproduction: the 21 runs are its first table. It adds what R2's three changes rest on: every path from `goTo()` to the first chat's runtime, with the three ways the chat stays on Ritemark's default (no landing record after the reload, the landing posted to a sheet that is then replaced, the 20 s limit), and one scripted run of each forced by hand (a deleted record, a sheet reloaded during the landing, a host that holds the bootstrap's model list). If a forced run shows a fourth way, R2 grows under the scope-change protocol.
2. **A2, `research/mention-audit.md` (R5): the other covers.** The cause is shown (the formatting toolbar over the list). A2 only checks, with `research/repro/repro-513b.mjs`, whether anything else of the editor's can cover the comment's bubble once the toolbar follows the focus: the drag handle's menu, the slash menu, the table menu, the link dialog. Each found is fixed in W5 or filed.
3. **A3, `research/home-keys-audit.md` (R7): a person's keyboard.** Synthetic keys, raw CDP and agent-browser's, didn't reproduce #507. A3 asks the Social manager how the films sent ⌘⇧P (the tool, the target, the step before), and has a person type S27–S32 on a real keyboard, ten presses each, on the Mac and on Windows, with `--log trace` on the dev instance. If one fails it records the workbench's active element and Home's, and whether the webview host forwarded the key (`did-keydown`) and which of the workbench's two checks refused it; the fix's place (Home's page, Ritemark's host, or a patch) is decided there. If none fails, #507 moves to 2.2 with the evidence (spec R7).
4. **A4, `research/windows-pickers-audit.md` (R9), on Windows.** Run by the "Ritemark on Windows" session through the test overlay, with `USERPROFILE=C:\Ritemark` and `--log trace`:
   - Transcribe a file… three times and Add a project ▸ Open a folder… three times, recording the main log's `[DialogMainService]` and the renderer's `[FileDialogService]` lines (the default path each dialog was given);
   - quitting, then the process list after 10 s and after 30 s;
   - the same with the branch's W9a (an existing folder for every Ritemark picker), to see whether that alone is the fix.
   The decision: W9a is enough; or the lock needs a patch (shell-tier, the tier line changes first); or the processes left after quitting have a cause of their own.

## Workstream 1: Home lets go (R1)

- `HomePanel.ts:86`: `const offProjects = deps.projectList.onDidChange(() => this.scheduleRedraw()); this.disposables.push({ dispose: offProjects });` (the board's way, `:70`).
- `dispose()`: each disposable in its own `try`, logged and passed over on a throw, then the panel. The same fault elsewhere can't take Home's panel with it again.
- **Test:** `src/views/HomePanel.test.ts` (new; `vscode` stubbed through `Module._load`, as `permanentTabs.test.ts` does): a `HomeHost` with a stub project list, file watchers and panel; `dispose()` calls every `dispose`, the project list's listener is gone (`listeners.size` back to 0), the panel is disposed; and a subscription that throws doesn't stop the rest. Added to `npm test`.

## Workstream 2: the first chat's AI (R2)

- **The chosen AI is saved before the reload.** `welcomeHost.goTo()`, when `this.readyProvider` is set (the person chose it on this welcome), writes `ritemark.ai.selectedAgent` (`runtimeOfProvider`) before `vscode.openFolder`, the same value the landing's `ai-select-agent` writes today. The fallback `landingProvider()` uses on the update welcome writes nothing.
- **No give-up for local catalogs.** `store.ts` `applyPendingLanding`: the 20 s limit applies only to `opencode`. For `codex` and `claude-code` the landing waits for the bootstrap that brings their list.
- **A dropped landing says why.** `runLanding()` logs the `decideLanding` reason when a record is dropped (an unreadable record, another folder, too old), and logs a missing record only when `ritemark.welcome.finished` is less than 10 minutes old; the sheet posts `landing/dropped` with the reason to the host when its wait ends without applying, and the host logs it. Both are log lines, never a count.
- **The check.** `research/repro/landing-551.mjs` becomes `scripts/qa/landing-check.mjs` (N runs, fresh profiles, `--updates on|off`), and `scripts/qa/three-runtimes-check.mjs` fails its step "the project opened its chat on another AI" instead of picking the AI itself.
- **Tests:** `landingChat.test.ts` gains: ChatGPT's landing with no Codex list at first and a bootstrap after 25 s still lands on ChatGPT; OpenCode's still gives up after 20 s; `welcome` tests for the setting written before `openFolder` only with a chosen AI (`welcomeState.test.ts` or a new case in `landing.test.ts`, whichever holds `goTo`'s pure part).

## Workstream 3: the wait on ChatGPT (R3)

- **Listen.** `CodexRuntime._setupEventListeners` subscribes to the app-server's `error` notification: `{ error: { message, codexErrorInfo, additionalDetails }, willRetry, threadId, turnId }`. For a session's current turn with `willRetry: true`, it calls a new optional `config.onRuntimeRetry?.({ attempt, of, httpStatus })`, parsed from Codex's "Reconnecting... 1/5" and `codexErrorInfo.*.httpStatusCode`. The raw notification goes to the turn's activity trace (`traceCodex`), where Report AI issue reads it. `willRetry: false` changes nothing: `turn/completed` carries the failure as today.
- **Tell the sheet.** `UnifiedViewProvider`'s Codex turn passes `onRuntimeRetry` → `codex-retry { conversationId, attempt, of, busy }` (`busy` when the status is 429), guarded by `isCurrentRuntimeTurn()` as `onRpcProgress` is. The store keeps `retry` on the running turn and clears it on the next delta, activity, question, approval or result.
- **Show it.** `activityState.ts` gains a `retrying` state, drawn in amber with the clock icon: "ChatGPT is busy. Ritemark will keep trying (1 of 5)." for a 429, "Trying again to reach ChatGPT (1 of 5)." otherwise (words proposed; the Development manager decides small wording, the Experience lead sees the screenshot before merge). The working line's place, so it shows mid-turn too. Stop is unchanged.
- **When it ends on a 429.** `runtimeErrorPresentation.ts`: a Codex code `responsetoomanyfailedattempts` or `responsestreamdisconnected` with `httpStatus` 429 → `limit` with `limit: 'busy'`. `turnFailureCopy.ts`: `LimitKind` gains `'busy'`; its card is "ChatGPT is busy right now" / "Too many requests reached ChatGPT. Wait a few minutes, then send your message again.", with Continue with <another ready AI> as the plan limit has. An older 2.1 build decodes `busy` as an unknown detail and shows "ChatGPT stopped this request" with the sentence (E2).
- **Nothing changes in how Codex starts:** no `-c`, no `CODEX_HOME`, `codexManager.ts` untouched.
- **Tests:** `CodexRuntime.test.ts`: an `error` with `willRetry: true` for the session's thread reaches `onRuntimeRetry` with 1 of 5 and 429; one for another thread doesn't; `willRetry: false` doesn't. `runtimeErrorPresentation.test.ts`: the mock's final error (the research's exact JSON) is `limit`/`busy`; a 429 without retries is too. `activityState.test.ts`: the retry label and its clearing. `turnFailureCopy` via the existing tests.
- **The check:** no product switch is added to point Ritemark's Codex at a test endpoint. The app-server's side is `research/repro/mock-429.mjs` with `codex-first-turn.mjs`, as in the research; Ritemark's side is a store and status-line test fed those exact recorded notifications, and a dev-instance screenshot with the host message injected through the bridge (memory: webview bridge trace and hold-back). A real 429 can't be made on demand without spending the account's limit.

## Workstream 4: the title's language (R4)

- `ConversationTitleGenerator.generate`: `settingSources: []` and `availableTools: []` in `runOneShotTurn`'s input. Nothing else changes: the prompt, the model, the timeout, the fallback.
- **Test:** `ConversationTitleGenerator.test.ts` pins both options (and still pins the prompt's wording).
- **The check (ChatGPT):** `scripts/qa/title-language-check.mjs` (new, small): 10 English and 10 Estonian first messages sent through the title generator's own prompt on the bundled Codex, as `codex-first-turn.mjs` drives it, read back and judged by script (Estonian letters and words). It sends 20 short turns spaced a few seconds apart, so it doesn't meet the 429 of W3.
- **Claude** at Gate 2 (spec R4).

## Workstream 5: the mention list (R5)

- `FormattingBubbleMenu.tsx:268–276`: the toolbar's `shouldShow` adds TipTap's own focus rule: `if (!view.hasFocus() && !element.contains(document.activeElement)) return false`, before the existing empty-selection and code-block checks. The rule moves into a pure helper (`formattingToolbarShows({ empty, inCodeBlock, editorHasFocus, focusInToolbar })`) so it can be tested; the component passes it the live values. The link dialog is a separate Radix `Dialog.Root` outside the `BubbleMenu` and is not affected; the toolbar's buttons keep their `onMouseDown` `preventDefault`, so pressing them never moves the focus out of the editor.
- Nothing changes in `ComposeBubble`, the picker, `applyNote` or the comment's Markdown.
- **Tests:** `webview/src/components/formattingToolbar.test.ts` (new): the helper hides the toolbar with the focus in a comment's box and shows it with the focus in the editor or in the toolbar. The mention picker's existing tests stay as they are.
- **The check:** `research/repro/repro-513b.mjs` becomes `scripts/qa/comment-mention-check.mjs`: S18–S22, the click centred on each option, with `elementFromPoint` recorded; it fails on `main` (the toolbar under @claude) and passes on the branch.

## Workstream 6: line breaks (R6)

- `ChatBubbles.tsx`: the message's text in its own element with `whitespace-pre-wrap break-words` (`[overflow-wrap:anywhere]` for long paths), not the whole bubble, so the file and attachment rows above it keep their layout. `ChatMessage.tsx`'s user bubble the same.
- **Test:** `webview/.../ai-sidebar/chatBubbles.test.ts` (new): `renderToStaticMarkup` of `UserPromptBubble` with a card's text keeps the newlines inside an element with the `whitespace-pre-wrap` class (the pattern of `shareQuestionCard.test.ts`).
- **The check:** a card given to ChatGPT on a dev instance; the screenshot shows its three parts on their own lines, live and after Reload Window.

## Workstream 7: ⌘⇧P on Home (R7)

By A3; no code before a reproduction. `research/repro/repro-513-507.mjs`'s Home cases become `scripts/qa/home-keys-check.mjs` either way (S27–S32). If a person reproduces it, there are three places the fix can land, in the order A3 checks them:
1. **Home's page** keeps a key or the focus from the webview host: fixed in `webview/src/components/home/`.
2. **Ritemark's host** moves the workbench's focus away from Home's frame while the frame keeps the keyboard (a reveal with `preserveFocus`, the permanent tabs' re-pin, the AI sheet): fixed where it does.
3. **VS Code's webview host** refuses the forwarded key (the token or the active-element check, `webviewElement.ts:744–770`): a patch hunk, shell-tier, in patch 018 beside the frame's other webview changes.

## Workstream 8: Transcribe's formats and Dismiss (R8)

- `audioPrep.ts`: `cannotTakeOnDevice(ext, engineAccepts, canConvert): string | null` (pure), the sentence of `:117–118` or null. `prepareAudio` uses it, so the words stay one.
- `TranscribeViewProvider._stageImport`: each estimate gains `refusal?: string` from it, for the on-device engine; `_start` refuses an engine with a refusal (a stale page can't start it).
- `PendingImportCard`: an engine with a refusal is shown disabled with its sentence under it; ElevenLabs stays as it is.
- `JobManager.dismiss(jobId)`: removes a failed or interrupted job, emits a change; never touches a running job or the audio file. `TranscribeViewProvider` handles `transcribe:dismissJob`.
- `AttentionRow`: Dismiss (`Button variant="ghost" size="sm"`, `Tooltip` "Remove this from the list. The recording stays where it is."), beside Try again when that shows; also on the interrupted recording's row if it has none.
- **Tests:** `audioPrep.test.ts` for `cannotTakeOnDevice` (Mac: null for .m4a; no converter: the sentence for .m4a and .aac, null for .mp3); `JobManager.test.ts` for `dismiss`; the panel's test (`panelChrome.test.ts` or a new `attentionRow.test.ts`) for the button and its tooltip.
- **The check (Mac):** a broken .mp3 (a text file renamed) on On-device fails; Dismiss removes its card. The pending card's refusal can't be shown on the Mac without a switch that fakes Windows, and none is added: the unit test covers it, and Windows shows it at Gate 2.

## Workstream 9: the pickers with no Desktop (R9)

- **W9a, Ritemark's half, built either way.** `src/utils/dialogDefaults.ts` (new, small; its folder choice is a pure function the test calls with an injected `exists`): `pickerDefaultUri(projectFolder?: string): vscode.Uri`: the project folder if it exists, else `os.homedir()`. Every Ritemark `showOpenDialog`/`showSaveDialog` without a `defaultUri` gets one (about half of the 22 calls; A4 lists them).
- **W9b, by A4.** If the main process's lock stays held by a dialog that never returned, a hunk in patch 005 (Windows and OSS fixes) settles it in `dialogMainService.ts`: the lock is released when the window's dialog promise rejects or the dialog is closed by Windows' error. If the processes left after quitting have their own cause, it is written in A4 and fixed or filed.
- **Tests:** `dialogDefaults.test.ts` (an existing folder, a missing one, none); a `grep`-style test that every `showOpenDialog(`/`showSaveDialog(` call in `src/` passes `defaultUri` (cheap, and keeps the next picker honest).

## Coordination

- **Sprint 139** owns the classifier and the cards (W3 adds one `LimitKind`), **Sprint 140** owns Home's guidance (W1 touches only `HomeHost`'s plumbing), **Sprint 137** nothing shared. All three are merged or in review; this sprint branches from `main` after them and rebases if one lands later.
- **The "Ritemark on Windows" session** runs A4 and the Windows half of the Gate 2 rows, through the Development manager.
- **The Experience lead** sees R3's line and card, R8's disabled engine and Dismiss before the merge (memory: match the Experience prototype exactly; screenshots).

## Delivery plan

One merge, extension-tier, unless A3 or A4 needs a patch. Then the patch hunks go in the same PR, the tier line changes first, `./scripts/apply-patches.sh --dry-run` passes, and a hunk in patch 018 is also checked with the frame script (`scripts/qa/frame-screenshots.mjs`) as 018's changes are. If A4 can't run before 2.1's feature freeze, R9's W9a merges and W9b moves to 2.2 (*Open Questions* 5).

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| #551 isn't the three ways R2 closes | A1 forces each by hand; the 20-run check stays in `scripts/qa/` and #551 stays open until it passes on the branch |
| A real 429 can't be made on demand | The app-server's own notifications were recorded against a local endpoint (research); the webview is tested on those exact messages |
| The retry line flickers on short waits | It shows from the first `willRetry` and clears on the next output; a 54 s wait is the shortest seen, never sub-second |
| Titles without the person's Claude settings break a custom endpoint | The fallback title stays; *Open Questions* 2 |
| Hiding the toolbar without the editor's focus hides it somewhere a person still needs it | The toolbar's buttons keep the editor's focus (`preventDefault` on mouse down) and the link dialog is separate; S18–S22 and a formatting pass (bold, a heading, a link) on the branch |
| Nobody reproduces #507 with a keyboard | Spec R7: no code without a reproduction; the check joins `scripts/qa/` and #507 moves to 2.2 with the evidence |
| A3 finds the cause in VS Code | A3's third place is a patch; 2.1 is a shell release, and the tier line changes first |
| Windows can't be reached before the freeze | W9a and R8 are provable by unit tests; A4 and the Gate 2 rows say plainly what wasn't run |
| A shared ChatGPT account limit during QA | The checks space their turns; a QA run that meets a 429 is a W3 test case, not a failure |

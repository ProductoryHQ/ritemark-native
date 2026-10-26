# Sprint 143 research: the reproductions

Each issue was reproduced, or tried, before this plan named a fix (26 October 2026, the plan's own session). Where the cause is shown, the fix in [../technical-plan.md](../technical-plan.md) is the cause's. Where it isn't, the plan says so and its first task is the reproduction that is still missing (memory: no unproven diagnoses).

**Where.** A Mac (macOS 26, Apple silicon), region Estonia with English as the language (`AppleLocale` `en-EE`). The dev tree of `origin/main` at `1e91466c` (2.0.1 plus Sprints 137, 139 and 140), built in this plan's worktree; the bundled Codex 0.163.0 of `binaries/agents/manifest.json`. Hidden launches (`open -n -g -j`, `--use-mock-keychain`, the three backgrounding flags), each on its own short profile under `/private/tmp`, a port nobody else used, one launch per run and quit with ⌘Q.

**What could be used** (the Development manager's limits for this plan): ChatGPT through Jarmo's own sign-in in the shared `~/.codex`, unit tests and code. Claude is not signed in on this Mac and there are no test keys ("Mitte praegu"), so nothing here ran a Claude or OpenCode turn.

**`~/.codex` was not changed.** Every Codex run used a folder Codex already trusts or sent no turn, and `config.toml`'s modification time stayed 22 October 16:09. Codex wrote its own session records under `~/.codex/sessions`, as every Codex client does.

The scripts are in [repro/](repro/). They are evidence, not product code, and nothing in the app runs them.

## #556: HomePanel's dispose throws on every project switch

**Reproduced from the installed app's own logs.** The installed Ritemark's extension host logged the throw on 21 and 24 October:

```
2026-10-24 14:02:04.349 [error] TypeError: disposable.dispose is not a function
	at …/extensions/ritemark/out/extension.js:115344:61
	at Array.forEach (<anonymous>)
	at HomeHost.dispose (…/extensions/ritemark/out/extension.js:115344:26)
```

(`~/Library/Application Support/Ritemark/logs/20261024T125714/window4/exthost/exthost.log`; also four windows of `20261021T161644`.)

**Cause, from the code.** `HomeHost`'s constructor (`src/views/HomePanel.ts:86`) pushes `deps.projectList.onDidChange(…) as unknown as vscode.Disposable`, but `ProjectList.onDidChange` returns a plain unsubscribe function (`src/projects/ProjectList.ts:98`). `dispose()` (`:515–519`) calls `.dispose()` on each pushed item in a `forEach`; the function has none, so it throws there. Everything pushed after it is never disposed: the `vscode.extensions.onDidChange` listener, the guidance listener (Sprint 140), and `this.panel?.dispose()`.

The cast is the only `as unknown as vscode.Disposable` in the extension; TypeScript would have caught the same mistake anywhere else.

## #551: after the welcome is finished with ChatGPT, the chat sometimes opens on Claude

**Not reproduced in 21 runs.** `repro/landing-551.mjs` does what Sprint 139's three-runtime check did before it learned to pick the AI itself: a fresh profile, the welcome's step-1 cards checked, Continue on ChatGPT (signed in; Claude not), Open a folder… through the simple dialog with the folder's path typed (with its trailing slash, as the check typed it), the reload into the project, then the AI sheet's composer read every 500 ms for 45 s after the reload. One hidden launch per run, quit with ⌘Q, the profile deleted after.

| Runs | The update notice | The chat's AI | Its box |
|---|---|---|---|
| 1 + 10 | off (`ritemark.updates.enabled: false`) | ChatGPT in 11 of 11 | "Ask ChatGPT about this project" in 11 of 11 |
| 10 | on: the dev tree's `product.json` set to 2.0.0, so "Ritemark 2.0.1 is available (729.4 MB)" was on screen at the end of 9 of the 10 runs | ChatGPT in 10 of 10 | the same, 10 of 10 |

Every run went the same way: the sheet appeared 2 to 3 s after the reload with "Checking ChatGPT…" in the box, already on ChatGPT, and the landing's words followed 1.5 s later. It was never on Claude, not even for one sample.

**What is known of the one sighting.** Sprint 139's QA evidence: "In one run, the project's chat opened on Claude after the welcome was finished with ChatGPT. That is not root-caused: the update notice was in the corner in that run too." It was one of the first five runs of a harness that, by the same evidence, still typed before the window had reloaded and once clicked the update notice by mistake. Its profile and screenshots are gone (the five reports under `/private/tmp/claude-501/r139-evidence*/` are later runs, all landing on ChatGPT).

**Three ways the code leaves the first chat on Ritemark's default AI**, read from the code. Each ends with the chat bound to `ritemark.ai.selectedAgent`, which the welcome never writes, so on a fresh profile it is Claude:
1. **No landing.** `runLanding()` finds no usable record: none written before the reload, another folder's URI (`decideLanding` compares the record's URI with the window's folder exactly), or older than 10 minutes. The record is written with `globalState.update` just before `vscode.openFolder`.
2. **The landing reaches a sheet that is then replaced.** `openLandingChat` posts once: at once when `_sidebarReady` is true, else on `sidebar/ready`. A sheet created after that (the view disposed and resolved again) never gets it, and its blank chat takes the bootstrap's default.
3. **The landing gives up.** `applyPendingLanding` waits for the AI's model list and drops the landing after 20 s, for every AI. ChatGPT's and Claude's lists come in the sheet's first bootstrap, so this should never fire for them, but nothing stops it if the bootstrap is late.

The plan closes all three (spec R2) and keeps #551 open until the check passes on the branch (*Open Questions* 4).

## #544: ChatGPT's first turn can stall about 6 minutes

**The issue's guess (MCP servers starting) is not the cause. The stall is ChatGPT answering 429 Too Many Requests and Codex waiting, silently, as long as ChatGPT tells it to.**

### The spike's own runs, from Codex's records

Sprint 140's Word spike ran 13 ChatGPT turns on 26 October between 17:34 and 17:56 (`~/.codex/sessions/2026/10/26/`). Codex's log database (`~/.codex/logs_2.sqlite`, read-only) has this for the stalled turn's thread (`01a178e5-…`, cwd `/private/tmp/s140/Training PDFs`, the run `chatgpt-pdfonly-1`):

```
15:47:41 WARN codex_core::responses_retry  stream disconnected - retrying sampling request (1/5 in 418.999929584s)…
         sampling_error=exceeded retry limit, last status: 429 Too Many Requests
15:54:40 INFO responses_websocket          connecting to websocket: wss://chatgpt.com/backend-api/codex/responses
```

The turn's own record shows the session ready in 3.3 s: the person's message was written at 3.3 s and the first tool call at 427 s. Nothing happened in between but the wait. The same day had five such waits, all 429s, from 54 s to 539 s (UTC):

| Time | Thread | Codex waited |
|---|---|---|
| 15:38:28 | `01a178dc-…` | 370 s |
| 15:39:25 | `01a178dd-…` | 313 s (a second stall in the spike, in the Training work folder: first action at 320 s) |
| 15:47:41 | `01a178e5-…` | 419 s (the issue's stall) |
| 15:53:46 | `01a178ea-…` | 54 s |
| 15:55:42 | `01a178ec-…` | 539 s |

The spike sent many ChatGPT turns in a short time, which is what a rate limit answers. A person sending their first message after a busy session in ChatGPT's own app or Codex shares the same account limit.

### The first turn timed with and without the person's MCP servers

`repro/codex-first-turn.mjs` starts the bundled `codex-app-server` 0.163.0 exactly as Ritemark does (same binary, same environment, no arguments), sends `initialize`, `thread/start` and one `turn/start` ("Reply with the single word: ok."), and records every notification with its time. It ran in `/private/tmp/ritemark-s116-rundev-workspace`, a folder Codex trusts.

This Mac's `~/.codex/config.toml` lists nine MCP servers: two that run here (a design tool's, `node_repl` with `startup_timeout_sec = 120`), seven remote (Figma and Cloudflare's five) that need a new OAuth sign-in, and ChatGPT's own `codex_apps` and `cua_repl` come with the account.

| Run | Overrides | Person's message accepted | Answer | Turn done |
|---|---|---|---|---|
| As Ritemark starts it | none | 4.7 s | 7.3 s | 7.4 s |
| `-c 'mcp_servers={}'` | none took effect: Codex merges the table, all nine still started | 3.1 s | 6.6 s | 6.7 s |
| An extra server that never answers (`/bin/sleep 600`) | `-c mcp_servers.zz_hang…` | 3.0 s | 5.5 s | 5.6 s |
| **Without the person's servers** | `-c mcp_servers.<name>.enabled=false` for each of the nine; only ChatGPT's own `codex_apps` and `cua_repl` start | 3.2 s | 5.3 s | 5.5 s |

- Every server reports its state through `mcpServer/startupStatus/updated`. The seven remote ones fail within 3 s ("requires OAuth reauthentication"); the local ones are ready within 0.2 s; ChatGPT's `codex_apps` within 2.5–4.7 s.
- **With and without the person's servers, the first turn differs by under 2 s** (taken at 3.0–4.7 s with them, 3.2 s without; done at 5.6–7.4 s with them, 5.5 s without). What waits longest is ChatGPT's own `codex_apps`, which comes with the account, not the person's file.
- **A server that never starts does not hold the turn.** With `/bin/sleep 600` as a server, the turn ran at once and finished in 5.6 s while the server was still "starting".
- An empty `mcp_servers` table can't switch the person's servers off: Codex merges `-c` tables into `config.toml`'s. Turning them off takes `-c mcp_servers.<name>.enabled=false` per server (the last row), which means reading the person's file for the names, or a separate Codex home, which would lose their sign-in.

### What Ritemark shows during the wait: nothing

`repro/mock-429.mjs` is a local endpoint that answers every request with 429 and `Retry-After: 20`. Pointed at it through `-c model_provider=…` overrides (nothing written), the same app-server sent the client this:

```
3.1 s   error  {"error":{"message":"Reconnecting... 1/2","codexErrorInfo":{"responseStreamDisconnected":{"httpStatusCode":429}},
                "additionalDetails":"exceeded retry limit, last status: 429 Too Many Requests"},"willRetry":true,…}
23.1 s  error  {… "Reconnecting... 2/2" … "willRetry":true …}
43.1 s  error  {"error":{"message":"exceeded retry limit, last status: 429 Too Many Requests",
                "codexErrorInfo":{"responseTooManyFailedAttempts":{"httpStatusCode":429}}},"willRetry":false,…}
43.1 s  turn/completed {"status":"failed", …}
```

So Codex waits as long as `Retry-After` says (20 s here, 419 s in the stall), tells its client before each wait (`error`, `willRetry: true`), and fails the turn when the retries run out. **Ritemark subscribes to neither the `error` notification nor `mcpServer/startupStatus/updated`** (`src/codex/CodexRuntime.ts` `_setupEventListeners`): the person sees "working" and nothing else for minutes. When the retries run out, Sprint 139's classifier has no 429 rule for Codex: `responsetoomanyfailedattempts` with a status is neither a network code nor a limit, so the turn shows "ChatGPT couldn't finish this request" with "exceeded retry limit, last status: 429 Too Many Requests" as the provider's sentence (`src/runtime/runtimeErrorPresentation.ts:262`, `:343–348`).

### The decision this asks for

What Ritemark's Codex starts with stays as it is: the person's own Codex configuration, MCP servers included.
- The servers cost under two seconds here, start beside the turn, and one that hangs doesn't hold the turn.
- Leaving some out needs either a second copy of the person's settings or reading their file, and changes what their ChatGPT can do in Ritemark (a Figma or design tool they set up on purpose).
- The fix is the wait: say it while it happens, and say it plainly when it ends (spec R3).

## #514: an English chat's automatic title came out in Estonian

**What is known.** The Inbound Traffic manager's site run (2.0.0 RC1, 21 October) names the chat: in the "Northfield Bank proposal" project, **Claude** was working, and when the run finished the chat's title was "Filiaalijuhtide koolituspakkumise ülevaade" (`ritemark-dev`: `releases/v2.0.0/pictures/raw/site/PROGRESS.md`, rows `home/persona-consultant` and `features/story/two-windows`). The chat itself was English. The project and its profile are gone, so its first message is unknown.

**It is the 23 September failure again, in a smaller share.** `docs/development/analysis/2026-09-23-conversation-title-language.md` found that a Claude title session loads the person's own Claude settings, skills and `CLAUDE.md` (`settingSources` defaulting to user, project and local), and that on this Mac several skills are described in Estonian. Its fix (variant C) tied the language to the USER MESSAGE in the prompt: 0 of 16 then. Its variant B, the same session without the person's user settings, was 0 of 8. Only C shipped. The title session still loads everything (`src/conversations/ConversationTitleGenerator.ts` passes no `settingSources` and no `availableTools` to `runOneShotTurn`). Sprint 130's idea review and the transcript insights already run with `settingSources: []` and `availableTools: []` "so the answer comes from the idea alone" (`src/taskBoard/ideaReview.ts:150–153`, `src/speech/insights.ts:68`).

**ChatGPT's titles are right on this Mac.** Every Ritemark title session ChatGPT ran in October is in `~/.codex/sessions` (the title prompt is recognisable). Of 39: 31 English chats got English titles, 5 Estonian chats got Estonian titles, and 3 got no title (the one-shot ended without one). None was in the wrong language.

**Not run:** a Claude title, here or on any machine (no sign-in, "Mitte praegu").

## #513: choosing @claude from a comment's mention list doesn't assign the comment

**Reproduced, 3 of 3, and the cause shown.** `repro/repro-513b.mjs` opens a document, double-clicks a word, chooses Comment in the formatting toolbar, types "@", and clicks @claude in the list (CDP mouse events at the option's centre, a move first as a hand does, once with a 0.8 s pause before the press). Before the press it asks the page what is under the option's centre (`elementFromPoint`).

| Run | Under @claude's centre | After the click | After typing "Make this warmer" |
|---|---|---|---|
| 1, 2 (slow), 3 | the formatting toolbar's own box (`div.flex.items-center.gap-1.bg-surface.border…`) | the box still "@", the list still open, the focus on a plain `div` | the box still "@": the words went nowhere |

The screenshot shows it: the formatting toolbar (B, I, H1–H3, lists, quote, code, link, Comment) stays up over the comment, because the word is still selected, and its row covers the mention list's first option, which is @claude, the one highlighted. The click lands on the toolbar, the comment's box loses the focus, and what is typed next goes nowhere. Saved like that, the comment has no address: the issue's "dropped the address on save".

- The toolbar's `shouldShow` asks only that the selection is not empty and not in a code block; unlike TipTap's own default, it doesn't ask whether the editor has the focus (`webview/src/components/FormattingBubbleMenu.tsx:263–276`). The comment's box takes the focus, the selection stays, so the toolbar stays.
- The list's `z-index` is 40, inside the comment's bubble (`index.css:589–590`); the toolbar is a tippy with its own, higher layer.
- **Choosing with Enter works**, and so does typing "@claude " by hand (the first run, `repro/repro-513-507.mjs`, saved `<mark data-comment="@claude Add an example" … data-agent="claude">` for both). That is why the site run's typed comments were assigned.
- @codex and @opencode sit lower in the list and were clickable in this layout; where the toolbar sits depends on the selection, so any option can be the one under it.

## #507: ⌘⇧P sometimes does nothing while Home has the keyboard focus

**Not reproduced in 24 tries.** `repro/repro-513-507.mjs` put the focus on Home six ways, three rounds each, and pressed ⌘⇧P with CDP key events (which the page sees as trusted): a click on Home's title; Tab to a control; the line's input open; a file added to the project so Home redrew; back on Home by its tab without a click inside; back and a click inside. All 18 opened All commands; in each the workbench's active element was Home's frame (`IFRAME.webview.ready`) and Home's document had the focus. `repro/repro-507b.mjs` then pressed it with the tool the launch films and the site run were driven by, `agent-browser press Meta+Shift+p` (Playwright's keyboard over CDP), after a click inside Home: 3 of 3 opened, as did 3 raw-CDP presses in between and one with the focus in the workbench.

**What the code says.** VS Code's webview host forwards every keydown from Home's page (`did-keydown`), and the workbench re-dispatches it only when the key event carries the host's token and Home's frame is the document's active element (`vscode/src/vs/workbench/contrib/webview/browser/webviewElement.ts:744–770`). Home's page stops no key: it handles keys only in the line's input and the feedback card's input (`HomePage.tsx:51–56`, `GuidanceCards.tsx:164`), and neither stops propagation. No Ritemark patch touches the webview's key path.

**What remains.** The films were recorded on 21 October with RC1 by the Social manager, an agent session, which drives the app with synthetic input, not a person's keyboard. The site run of the same day notes that "the first ⌘Q over CDP did nothing; after a click into the page … the second one quit it" (`ritemark-dev`: `releases/v2.0.0/pictures/raw/site/PROGRESS.md`, row "Third run checked"): a key sent before the window or frame had taken the focus. Whether a person at a keyboard meets #507 is not known. A real-keyboard try on the Mac would need System Events or a person, and neither was used here. The plan's audit A3 asks the person who can type it (*Open Questions* 6).

## #511: a task's message loses the card's line breaks

**Reproduced in code.** The card's request is built with blank lines between its parts (`src/taskBoard/boardPrompt.ts:22–29`, joined by `\n\n`), and the record keeps them: ChatGPT's own record of the spike's "Draft Module 4 from the brief" turn has the line breaks. The AI's sheet draws every person's message through `UserPromptBubble` (`webview/src/components/ai-sidebar/ChatBubbles.tsx:31–68`) as a plain text child of a `div` with no `white-space` rule, so HTML collapses the breaks into spaces. It is the same for a message typed with Shift+Enter, a comment task's message, and all three AIs (`AgentView.tsx:80–82`, `CodexView.tsx:179–181`). The older `ChatMessage.tsx:19–30` does the same. What is sent to the agent is unchanged.

## #509 (Windows): an .m4a passes the picker, then fails on-device; its card can't be dismissed

**Read from the code; Windows not available here.**
- The picker's filter and the place's list are `AUDIO_EXTENSIONS` (`.m4a, .mp3, .wav, .flac, .ogg, .aac`) on every platform (`src/speech/audioPrep.ts:18`, `src/views/TranscribeViewProvider.ts:310–318`). `_stageImport` checks only that the file is audio, and the pending card offers every supported engine (`:323–351`).
- The on-device engine reads `.mp3, .wav, .flac, .ogg` itself (`src/speech/engines/whisperLocalEngine.ts:31`); `.m4a` and `.aac` need `afconvert`, which only the Mac has (`audioPrep.ts:59–62`). On Windows, `prepareAudio` throws the issue's sentence only once the job runs (`:110–120`).
- That error is a `TranscriptionError` with `retryable` false (`src/speech/types.ts:191`), and the Needs attention card (`AttentionRow`, `webview/src/components/transcribe/TranscribePanel.tsx:662–684`) has only Try again, shown when retryable. So the card has no button at all, and jobs live in memory until the app restarts. **This half is on every platform**: any non-retryable failure (an unreadable file, a cancelled job) leaves a card that can't be dismissed.

## #510 (Windows): with no Desktop folder, two pickers stop opening, and quitting leaves processes

**Read from the code; not reproduced, and the cause is not known.**
- The two pickers are `TranscribeViewProvider._pickFile` and `ProjectsViewProvider`'s `projects/open-folder`; neither passes a `defaultUri`. In VS Code 1.142 that is filled by the workbench: the last active file's folder or workspace root, else the person's home (`vscode/src/vs/workbench/services/dialogs/browser/abstractFileDialogService.ts:70–121`, `electron-browser/fileDialogService.ts:177–186`). Nothing in Ritemark names a Desktop folder.
- The main process allows one open dialog per window and per identical options. If a dialog's promise never settles, every later dialog with the same options returns "cancelled" at once, and logs `[DialogMainService]: file open dialog is already or will be showing for the window with the same configuration` (`vscode/src/vs/platform/dialogs/electron-main/dialogMainService.ts:213–247`). That would explain "never opened a picker again" while Ctrl+K Ctrl+O (other options) still worked. **It is a lead, not a result:** it needs the Windows run with a trace log that shows the line, the default path, and which processes stay after quitting.
- Who passes a missing folder to Windows' dialog is the open question: VS Code's default, Windows' own memory of the last folder, or the dialog's navigation pane. It decides whether the fix is Ritemark's (an existing folder for each of its pickers) or VS Code's (a patch: shell-tier).

## The scripts

All run from this folder with Node 22 or later, against a dev tree whose `vscode/.build` and `extensions/ritemark/out` are built. Each launch is hidden, on its own profile under `/private/tmp`, on the port given, and quits with ⌘Q.

| Script | Issue | What it does |
|---|---|---|
| `repro/codex-first-turn.mjs <app-server> <trusted folder> <label> [-c …]` | #544 | One Codex first turn, every notification timed; `-c` overrides only, nothing written |
| `repro/mock-429.mjs [port] [retry-after]` | #544 | A local Responses endpoint that always answers 429 |
| `repro/landing-551.mjs --repo <tree> --workspace <folder> --runs N [--updates on]` | #551 | The welcome finished with ChatGPT N times on fresh profiles; the first chat's AI |
| `repro/repro-513-507.mjs --repo <tree> --out <json>` | #513, #507 | The comment four ways, and ⌘⇧P on Home six ways × 3 |
| `repro/repro-513b.mjs --repo <tree> --out <json>` | #513 | One comment at a time: what is under @claude when it is clicked |
| `repro/repro-507b.mjs --repo <tree> --ab <agent-browser> --out <json>` | #507 | ⌘⇧P on Home through agent-browser, as the films sent it |
| `repro/cdp-lib.mjs` | | The raw-CDP helpers the last four share |

`config.toml`'s modification time was checked after the Codex runs: 22 October 16:09, unchanged.

# Sprint 130 research — current-state audit

**Date:** 2026-10-11 · **Branch audited:** `main` at `200adae9`
**Purpose:** the existing patterns a task board must reuse, and the gaps it must close, before the plan proposes any new file. Paths are relative to `extensions/ritemark/` unless they start with `docs/`, `scripts/` or `patches/`.

## TL;DR

| Area | What exists | What the board needs | Verdict |
|---|---|---|---|
| Activity-bar entry | Four extension-only containers (Home, Transcribe, Agent Library, Browser) in `package.json`; only Home's first position comes from patch 002 | A fifth container, `ritemark-tasks` | **Extension-only.** No patch, no `product.json` |
| Side bar + editor area | Transcribe: a `WebviewView` on the shared `webview.js` plus an editor-area surface; the host sits between them | A side-bar list + an editor-area board | **Copy Transcribe.** The editor-area board is a `WebviewPanel` like Settings (not a custom editor: the board is not one file) |
| Project-folder storage | `.ritemark/flows/*.flow.json`, one file per flow, plain `fs.writeFile` | `.ritemark/tasks/*.md`, one file per card, written atomically | **Reuse the folder and the one-file-per-item idea; reuse the atomic-write and quarantine pattern of the global stores.** It becomes the first atomic store in the project folder |
| Front matter | `gray-matter` 4.0.3 is already a dependency (`ritemarkEditor.ts`, `editorSync/state.ts`) | Card fields in YAML front matter | **Reuse.** No new dependency |
| Handing work to an agent | Sprint 117 comment tasks: host-owned ledger, availability gate, enqueue handshake, `agent-execute` with `taskId`, attention/terminal events by turn id | Give to agent from a card, result back onto the card | **Reuse the sidebar half and the lifecycle; add a card source.** One gap: only one task controller can listen to turn events |
| Agent tools | Browser tools only, in three hand-copied shapes, one hardcoded server name per runtime | Board tools in all three runtimes | **Generalise once.** Adding a second server today touches every runtime path |
| Telling the agent | `src/ai/capabilityContext.ts`, one module, one `hasBrowserTools` switch | A TASK BOARD section when board tools are on | **Extend** with `hasBoardTools` |
| One-shot model call | `ConversationTitleGenerator`: `createRuntime(runtimeId)`, no tools, one turn, disposed | The idea review | **Copy** the pattern |
| Feature flag | `flags.ts`; Home's pattern: experimental + `ritemark.features.<id>: true` in `package.json`, a disabled notice instead of a `when` clause | `task-board` kill switch | **Copy Home** |

## 1. Activity-bar entries

`package.json` `contributes.viewsContainers.activitybar` (lines 453–475) declares four containers with no `order` field; they sort in declaration order after the built-ins:

| Container | Icon | View (all `type: "webview"`, no `when`) |
|---|---|---|
| `ritemark-home` | `media/home-icon.svg` | `ritemark.homeView` |
| `ritemark-transcribe` | `media/transcribe-icon.svg` | `ritemark.transcribeView` |
| `ritemark-agent-library` | `media/agent-library-icon.svg` | `ritemark.agentLibraryView` |
| `ritemark-browser` | `media/browser-icon.svg` | `ritemark.browserView` ("Recent") |

- `patches/vscode/002-ritemark-ui-layout.patch` (the `viewsExtensionPoint.ts` hunk) pins `ritemark-home` at `effectiveOrder -1` and `ritemark-ai` in the auxiliary bar. Every other container takes the running order. **A Tasks container needs no patch wherever it is declared; declared first among Ritemark's containers it should land right after Home (to confirm in P6).**
- No feature flag is used in a `when` clause, and there is no `setContext` in `src/`. A `when` clause cannot read a hyphenated configuration key, and a container whose only view is hidden disappears (`docs/development/architecture.md`, v1.8.6 note). Home therefore always contributes its view and renders a one-line notice when `home-launcher` is off (`src/views/HomeViewProvider.ts:164-167`).
- Icons are SVG files in `media/`, Phosphor regular glyphs on a 256 viewBox with `currentColor`. **An extension-only release ships `out/**/*.js`, `media/webview.js`, `media/office-preview.js`, their notices and `package.json` only** (`scripts/list-unshipped-extension-changes.mjs:22-28`). A new `media/tasks-icon.svg` reaches users only with an app (shell) release. A `$(codicon)` icon is accepted (`ThemeIcon.fromString` in `viewsExtensionPoint`) but would not match the other four.

## 2. Transcribe: the model for "its own button and its own interface"

- **Side bar:** `src/views/TranscribeViewProvider.ts`, a `WebviewViewProvider` that writes `<div id="root" data-editor-type="transcribe-panel">` and loads the shared `media/webview.js`. Handshake `transcribe:ready` → one `transcribe:state` snapshot pushed on every change; `view.badge` set from the host (464–466, with the `{value:0}` workaround). Registered with `retainContextWhenHidden: true` (`src/extension.ts:504-518`).
- **Editor area:** `src/transcriptWorkbenchProvider.ts`, a custom editor on the audio file, same bundle with `data-editor-type="transcript-workbench"`.
- **They never talk directly.** The side bar asks the host (`transcribe:openSession`), the host opens the editor; both subscribe to the same host services (`JobManager`, `SessionStore`) and re-push their own state.
- **Routing in the bundle:** `webview/src/main.tsx:41-103` reads `data-editor-type` and lazy-loads one surface (`settings`, `flow`, `flows-panel`, `ai-sidebar`, `transcribe-panel`, `transcript-workbench`; anything else is the Markdown `App`). Side-bar surfaces are listed for the background colour at lines 50–57. Vite builds one IIFE with `inlineDynamicImports`, so every surface lives in `webview.js`.
- **The only editor-area `WebviewPanel`** is Settings (`src/settings/RitemarkSettingsProvider.ts`): one panel, `reveal` if it exists, `WebviewPanelSerializer` for restore after restart (`deserializeWebviewPanel` 263–265, `registerWebviewPanelSerializer` at `extension.ts:670-674`, `onWebviewPanel:ritemark.settings` activation event). This is the pattern for the board, because the board is not one file and so cannot be a custom editor.

Agent Library (`src/views/AgentLibraryViewProvider.ts`) and Home are self-contained inline-HTML webviews, not `webview.js`. Their "launch" actions only pin an agent in the composer (`ritemark.pinAgent`) or drop file paths (`ritemark.sendToChat`); neither sends a prompt or tracks a result.

## 3. Project-folder storage today

- `.ritemark/flows/*.flow.json` (`src/flows/FlowStorage.ts`): one JSON file per flow, `fs.writeFile` without a temp file, unreadable files skipped. Also read by `ritemarkEditor.ts:315, 1016` and `AgentLibraryViewProvider.ts:226`. `HomeViewProvider.ts:115` already excludes `.ritemark` from its recent-Markdown search.
- Scheduled agents are Markdown with front matter in `<ws>/.claude/agents` and `<ws>/.agents` (`daemon/Scheduler.ts:28`). Markdown-with-front-matter as a data record is an existing pattern.
- The global stores (`ConversationStore`, `CommentTaskStore`, `GoogleDocsBindingStore`) share one pattern: an injected seven-method filesystem (`ConversationStore.ts:35-43`), one serialized mutation tail, `<target>.tmp-<id>` then rename, unreadable records moved to `quarantine/` with a reason sidecar, never deleted or guessed around.
- **No store writes atomically into the project folder yet.** The board store is the first; it reuses the global stores' pattern rather than FlowStorage's.

## 4. Comment tasks (Sprint 117): what a card can reuse

`src/commentTasks/` is 3,778 lines including tests. Full map: `docs/development/architecture.md` § Comment tasks.

**Generic already (the names say "comment", the logic does not):**
- The lifecycle `accepting → queued → running ⇄ needs-user → completed | failed | cancelled | interrupted`, its transition table (`types.ts:161-170`), binding generations and retry (`CommentTaskStore.ts:260-328`).
- `summarizeTerminalText` (280-character bound, sentence cut, "The task finished. Open the conversation for details." fallback) and `safeFailureMessage`.
- The whole sidebar half in `src/views/UnifiedViewProvider.ts`: the availability gate (`_checkRuntimeAvailability` 1654–1699 → `deriveRuntimeAvailabilities`), the enqueue handshake (`_enqueueCommentTask` 1729–1757, 10 s waiter keyed by task id), `agent-execute` with `taskId` (570, 673–676, 744–748), attention events (approval 1006, question 1071, Codex plan 1158, Codex question 1170) and terminal events (Claude 1029–1049, Codex/OpenCode 1085–1109, exit 1137–1141), all found by turn id.
- The sidebar queue bridge (`webview/.../ai-sidebar/store.ts` `handleCommentTaskEnqueue` 809–840, `enqueueCaptured` 669–677, `dispatchQueueItem` 684–800). The `comment-task/enqueue` message carries no comment fields.

**Tied to comments:** the record's `source` (a `file:` document URI, version and hash), the required `comments[]`, `assignment.surface: rail | menu`, the index keyed by document, the projection posted to that document's editor webviews, the containment checks, and the prompt builder's marker guard.

**Gaps that matter for cards:**

| # | Gap | Where | Consequence for a card |
|---|---|---|---|
| G1 | Only one controller listens to turn events | `_commentTaskController` (UnifiedViewProvider:208, `attachCommentTaskController` 1545) | A second task source cannot hear its own turns |
| G2 | The destination is always the conversation open in the sidebar | `_resolveOpenConversation` 1619–1646 | No way to start a conversation for a card and enqueue into it in one step. The host can only post `clear-chat` (→ `startNewConversation()`, store.ts:2764) and wait for the next active-conversation report |
| G3 | `needs-user` never returns to `running` | `applyTurnStarted` is called once, at dispatch (UnifiedViewProvider:1212) | A card would say "Needs you" until the turn ends |
| G4 | Codex/OpenCode summaries come from the start of the stream | `streamedResponseText` accumulates every chunk (988–991) | The result on the card would be the opening narration, not the conclusion |
| G5 | Editing a queued item replaces the host-built prompt | `QueuePanel.tsx:96` → `editQueued` | A queued card task would lose its card context and file list |
| G6 | A dispatch exception never reaches the host | store.ts:791–798 | The task stays `queued` until the restart sweep |
| G7 | `approvalMode` is frozen to `auto` | `_commentTaskRuntimeSettings` 1707–1721 | Known Sprint 117 TO BE item; out of scope here |

## 5. Agent tools: browser tools are the only precedent, and they are browser-specific

| Runtime | Path | Notes |
|---|---|---|
| Claude | `src/browser/browserMcpServer.ts`: SDK `createSdkMcpServer({ name: 'ritemark_browser' })`, zod shapes; `BrowserToolsInjector.getMcpServers` returns one cached server; `UnifiedViewProvider.ts:751-754` gates it; `BROWSER_TOOL_ALLOW_NAMES` added to `allowedTools` (978–980) | One server object shared by every Claude conversation; handlers do not know the conversation |
| Codex | `src/browser/codexBrowserTools.ts`: JSON Schema dynamic tools on `thread/start` (`CodexRuntime.ts:261, 300`); **every** `item/tool/call` goes to `config.onBrowserToolCall` (891–910); wired only for browser (`UnifiedViewProvider.ts:1178-1188`) | Thread reset keys on one boolean (235–243). `thread/resume` sends no `dynamicTools` (267–272), unverified whether a resumed thread keeps them |
| OpenCode | `src/browser/browserMcpAdapter.ts` (own esbuild entry, `out/browser/browserMcpAdapter.js`): hand-written stdio MCP server with a hardcoded `TOOLS` array and `serverInfo.name`; calls the host over `RITEMARK_IPC` (`BrowserIpcServer.ts`, request type limited to the six browser names); sent on `session/new` and `session/resume` (`acpManager.ts:165, 183`) | One socket and one `mcpServers` list for every OpenCode session; flag read once when the subprocess spawns (`AcpRuntime.ts:486-528`) |

- The schema exists in **three hand-maintained copies**, whose descriptions already differ.
- **Approval:** none of the three runtimes gates an injected tool. Claude auto-allows MCP tools (`allowedTools`, and `_handleCanUseTool` only gates Bash/Write/Edit/NotebookEdit); Codex `item/tool/call` never reaches `routeApprovalRequest`; OpenCode's `OPENCODE_PERMISSION` asks only for edit, bash and webfetch.
- `browser-agent-control` is **macOS-only**, so board tools need their own flag.
- `workspacePath` is `workspaceFolders[0]` (`extension.ts:372-373`): the app is single-root in practice.
- Places a second tool server touches: the injector, Claude server + allow names, Codex dynamic tools + thread reset + call routing + `AgentRuntime.ts:178` callback, OpenCode adapter + IPC request type + `AcpRuntime` dispatch, capability context, three build checks that hardcode the adapter path (`scripts/build-prod.sh:409-416`, `check-bundled-extension-complete.sh:66`, `validate-build-output.sh:203-204`), and the tests `BrowserToolsInjector.test.ts` (asserts exactly one ACP descriptor and six Codex tools), `capabilityContext.test.ts`, `AcpRuntime.test.ts`, `CodexRuntime.test.ts`.
- `docs/development/architecture.md` § Browser Tool Injection still describes the Sprint 79 *target* (Codex via MCP). It is out of date and gets rewritten with this sprint.

## 6. Prior art

- `docs/development/analysis/2026-03-05-kanban-task-management-for-ai-agents.md` recommended a single `.tasks.json` custom editor plus seven MCP tools, for developers. Two of its premises no longer hold: Ritemark now has tool injection in three runtimes, and #119 (2026-10-11) targets writers and consultants, one board per project folder under `.ritemark/`, with Give to agent from the start. Its MCP tool list and the `get_next_task` idea are reused in the tool design; its storage choice is revisited in [storage-decision.md](./storage-decision.md).
- The Dev Dashboard (`ritemark-dev/dev-manager/dashboard.template.html`, `governance/dev-manager.md`) is the product model Jarmo named: tabs Your calls, Board, Ideas, Log; cards with stage, whose move and a next line; a card opens as a dialog with facts, actions and history; Ideas is a one-line composer with Claude's review (value, fit, clarity); Log is a day-by-day rail.

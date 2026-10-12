# Sprint 130 Phase 0 probes

Run 2026-10-12, after Jarmo approved the plan and before any product code. Each probe answers one question from [technical-plan.md W0](../technical-plan.md#w0--phase-0-probes-before-any-product-code). **None failed. Two pass as planned (P4, P7); five pass with a change, and none of those needed the plan's fallback.** The changes are folded into the technical plan and tasks.

| Probe | Verdict | What changes |
|---|---|---|
| P1 Enqueue into a conversation that is not open | Pass with change | The sidebar store adds a card's new conversation, or loads one from history, without making it the open one |
| P2 Codex tools after `thread/resume` | Pass with a guard | Resume keeps the tools the thread started with and cannot add any, so the continuation fingerprint gains the tool set |
| P3 OpenCode permission prompt for MCP tools | No prompt | Hardening in `_handlePermission` for users whose own OpenCode config asks for everything |
| P4 One zod definition for all three runtimes | Pass | None: `z.toJSONSchema` reproduces today's schemas |
| P5 Last assistant message for Codex and OpenCode | Pass with change | Both protocols mark message boundaries; the runtimes keep the last message |
| P6 Activity-bar position, icon, badge | Pass with change | The badge comes from a hidden companion tree view, not the webview view |
| P7 Show the AI sidebar without taking focus | Pass | `ritemark.unifiedView.focus` with `{ preserveFocus: true }` |

Methods: P1, P2, P3 and P5 by reading the code and the agents' own source at the bundled versions; P4 by running the real modules; P6 and P7 on a dev instance. The dev instance used a throwaway profile and port 9251, launched from this worktree with `vscode/` cloned from the Sprint 129 worktree (same gitlink, canonical patches). The probe code was never committed and is removed.

## P1 — Enqueue into a conversation that is not the open one

**Pass with change. The fallback (reveal the card's conversation first) is not needed.**

What the code does today (paths under `extensions/ritemark/`):
- The sidebar store holds many conversations (`conversations: Record<id, ConversationState>` plus one `activeConversationId`, `webview/src/components/ai-sidebar/store.ts:283-286`).
- `comment-task/enqueue` accepts any `conversationId` (`commentTasks/protocol.ts:155-169`). The sidebar queues into exactly that id, never "the visible one" (`store.ts:809-840`), and answers `no-conversation` when it does not hold the id (`:817`).
- Turns already run per conversation:
  - `dispatchQueueItem` reads nothing from the active conversation (`store.ts:684-800`).
  - The host keys runtime sessions by conversation (`UnifiedViewProvider.ts:188, 574`).
  - Every streamed post carries `conversationId`, and the webview routes by it (`conversationRouting.ts:45-58`).
  - So a conversation that is loaded but not displayed streams normally.

Two gaps:
1. **Creating a conversation always makes it the open one.** `createConversation()` reuses an empty active thread and activates the new one (`store.ts:960-984`).
2. **A conversation that is only in durable history cannot be enqueued.** The enqueue answers `no-conversation`, and both load paths make the conversation active and focus the composer (`loadSavedConversation`, `store.ts:2014-2017`; the `conversation/get` result, `:2333-2342`, which also posts `ai-select-agent`). Open conversations are not restored after a reload (only `selectedConversationId` is, `store.ts:2294-2295`). So after any restart every card conversation except the open one is history-only: this is the common case, not an edge case.

Change (W4, G2):
- **New conversation:** the store inserts it into `conversations` without touching `activeConversationId`, then queues. The id becomes canonical at the first turn (`ConversationController.ts:432-438`, `canonical-id` at `UnifiedViewProvider.ts:681-688`, already absorbed by `findByTurn`). The host sets the manual title once that first turn has given the record its id.
- **History-only conversation:** when the id is unknown, the store posts `conversation/get` with a remembered `requestId`. In the result handler, a branch for that request adds the conversation to `conversations` only (no activation, no focus, no `ai-select-agent`), then queues. It answers `no-conversation` only if the load fails. This fits inside the host's 10 s wait (`UnifiedViewProvider.ts:1741`).

What the user sees: the card's conversation appears in the rail as Working; the open conversation and the focus stay where they were.

Also found: at most **five conversations can be working or waiting on the user at once** (`conversations/runtimeAttachmentPolicy.ts:3`; one when the `parallelChats` kill-switch is off). The user's own chats count too, and idle conversations, such as a card in Ready to review, are released first. See the Doing limit note in W2.

## P2 — Codex dynamic tools after `thread/resume`

**Pass with a guard.** Bundled Codex 0.160.0 (`manifest.json`; `codex-app-server --version`). Read from the official source at tag `rust-v0.160.0`.

- Dynamic tools are saved with the thread at start (`protocol/src/protocol.rs:3171-3176` `SessionMeta.dynamic_tools`, written at `core/src/session/session.rs:1035`, also in the state DB, `state/migrations/0004_thread_dynamic_tools.sql`).
- On resume they are restored from that metadata (`core/src/session/mod.rs:750-755`, with the comment "Dynamic tools are defined at thread start and persisted in rollout session metadata"; `history/src/lib.rs:451-463`).
- `ThreadResumeParams` has **no** `dynamic_tools` field (`app-server-protocol/src/protocol/v2/thread.rs:354-431`). A thread started without board tools never gains them by resuming.

Ritemark today:
- It resumes only when the stored continuation fingerprint matches (`src/runtime/continuation.ts:110, 180-195`), and the tool set is not part of that fingerprint.
- `CodexRuntime.ts:309` records `_browserToolsEnabledForThread` from what it *would* have sent, not from what the resumed thread has.
- The tool-call handler sends every dynamic tool call to `onBrowserToolCall` (`:891-907`).

Change (W5): the fingerprint gains a hash of the tool names and schemas, so a thread whose tools differ starts fresh with the Sprint 110 context pack; this also covers Ritemark releases that change a tool. Line 309 records the thread's actual tools. Tool calls are dispatched by name.

Not run live: a real resume end to end (it would need a signed-in Codex). S27 covers it in QA.

## P3 — OpenCode permission for MCP tools

**No prompt with Ritemark's configuration.** Bundled OpenCode 1.18.34; source read at tag `v1.18.34`. Nothing was run and no model was called.

- Every MCP tool call is permission-checked: `session/tools.ts:408` asks under the key `<server>_<tool>` (`mcp/catalog.ts:119`), e.g. `ritemark_board_add_card`.
- The last matching rule wins, with `"ask"` only when nothing matches (`permission/index.ts:28-37`). The default ruleset starts with `"*": "allow"` (`agent/agent.ts:119-120`).
- Ritemark sets only `OPENCODE_PERMISSION = {"edit":"ask","bash":"ask","webfetch":"ask"}` (`src/acp/acpManager.ts:45, 413`), so a board tool matches only `*` → allow. No `permission.asked` event is published, and the ACP bridge sends `session/request_permission` only for that event (`acp/permission.ts:61-70`).
- The same holds for the browser tools today, in every mode.

Two edge cases, both inferred from the code:
- **Doom loop:** three identical calls in a row ask under `doom_loop`, whose default is `"ask"` (`session/processor.ts:356-379`, `agent.ts:121`). In Manual mode Ritemark would show a card titled `doom_loop`.
- **The user's own config:** Ritemark does not isolate OpenCode's config, so `~/.config/opencode/opencode.json` with `"*": "ask"` would make MCP tools prompt.

Change (W5): in `AcpRuntime._handlePermission`, allow a request whose `toolCall.title` starts with `ritemark_board_`, and a `doom_loop` request whose `rawInput.tool` is a board tool (`acp/tool.ts:136`). Edits and shell commands keep asking. Browser tools are left as they are.

## P4 — One zod definition for all three runtimes

**Pass.**
- The Claude Agent SDK 0.3.289 declares `tool<Schema extends AnyZodRawShape>` with `AnyZodRawShape = zod/v3 | zod/v4 ZodRawShape` (`sdk.d.ts:126, 9716`; peer `zod ^4.0.0`). The installed zod is 4.4.3, and the browser server already uses it in production.
- The script built the real `createBrowserMcpServer()` with the real SDK, then compared three things for all six browser tools: `z.toJSONSchema(<registered zod object>, { io: 'input' })`, the schema the SDK serves on `tools/list`, and the two hand-written copies.

| Comparison | Result |
|---|---|
| zod → JSON Schema vs the SDK's `tools/list` (what Claude sees) | Equal, 6/6 |
| zod → JSON Schema vs the OpenCode adapter's `TOOLS` | Equal, 6/6 |
| zod → JSON Schema vs Codex's `buildCodexBrowserDynamicTools` | Equal 3/6. `fill`, `type` and `scroll` differ only in descriptions: the Codex copy lacks three field descriptions and has one shorter wording |

Consequence (W5): the registry generates the Codex and OpenCode schemas from the zod definition. Tool names stay the same. Codex's browser schemas gain the three missing descriptions, a small improvement the model sees. Codex keeps `additionalProperties: false` (`io: 'input'` omits it), so the generator adds it for Codex.

## P5 — The last assistant message for Codex and OpenCode

**Pass with change.** Today the Codex/OpenCode result text is the whole stream concatenated (`UnifiedViewProvider.ts:688, 988-991`), and `summarizeTerminalText` keeps its first 280 characters (`CommentTaskController.ts:140-160, 608`): the opening narration, not the conclusion. Claude already returns its final answer (the SDK `result`, `AgentRunner.ts:183, 507-533`).

- **Codex:** `item/agentMessage/delta` carries `itemId` and `turnId` (`codexProtocol.ts:374-379`), but the handler drops them (`CodexRuntime.ts:815-818`). `item/started` sees `agentMessage` items (`:801-811`). Change: keep `lastAgentMessage` per session, reset when a new `agentMessage` item starts, append its deltas, and prefer `item.text` from `item/completed` when present. Inferred, not seen on the wire: the 0.160 binary has `phase` values `commentary` / `final_answer`. Capture one `item/completed` trace in W4 to confirm.
- **OpenCode:** ACP SDK 1.4.0 has an optional `ContentChunk.messageId` ("a change in messageId indicates a new message", `types.gen.d.ts:3448-3459`), and OpenCode 1.18.34 sends it on `agent_message_chunk`. `acpManager.handleSessionUpdate` ignores it (`acpManager.ts:449-455`). Change: track the text under the latest `messageId`, reset for each prompt, and fall back to the whole stream when the id is missing.
- **Host:** both runtimes pass `lastAgentMessage` in `onCodexComplete` (`AgentRuntime.ts:158`). At `UnifiedViewProvider.ts:1105-1109` the summary uses `lastAgentMessage ?? streamedResponseText`; the transcript keeps the full text. Comment tasks get the same fix (G4).

## P6 — Activity-bar position, icon and badge

**Pass with change**, on the dev instance with a throwaway `ritemark-tasks` container declared right after Home.

- **Position:** the activity bar read Home, the VS Code built-ins, **Tasks**, Transcribe, Agent Library, Browser. That is just above Transcribe, as D7 says. The dev build shows extra built-ins (Chat, Chat Debug) from the dev-only Copilot extension; they are not in the product.
- **Icon:** Phosphor `kanban` (regular, 256 viewBox, `fill="currentColor"`) renders at the same size and weight as its neighbours, including the selected state.
- **Badge from the webview view:** it exists only once the view has been opened. The probe's Tasks view resolved 43.8 s after start, when I clicked it, so a count that arrives before the user opens Tasks would not show. Transcribe never meets this, because its jobs start from its own view.
- **Badge from a hidden companion tree view:** a tree view `ritemark.tasksBadge` with `"when": "false"` in the same container, created with `createTreeView` at activation. Its badge showed **from activation** (the log reads "tree badge set at activation +0 ms"), before Tasks was opened. The icon's accessible name reads "Tasks - 3 tasks need you (tree badge)", so the tooltip carries the words.
  - It works because VS Code's tree view sets the activity from its badge setter (`treeView.ts:486-499`), and the activity resolves the container from the view id (`activityService.ts`, `ViewContainerActivityByView.update`).
  - With `when: false` the view takes no space: opening Tasks shows only the webview, with no extra header.
  - `undefined` clears a tree badge, so Transcribe's zero-badge workaround is not needed.
- **Two badges add up:** with both set, the icon read "5" (3 + 2). Only the companion view carries the badge.

## P7 — Show the AI sidebar without taking focus

**Pass**, on the dev instance. Each run started with the document (the Ritemark editor webview) focused and the AI sidebar hidden (⌥⌘B). The probe then ran each variant from a file trigger, so my own input did not move focus.

| Variant | AI sidebar | Focus afterwards |
|---|---|---|
| `ritemark.unifiedView.focus` with `{ preserveFocus: true }` | shown | still the document |
| `ritemark.unifiedView.open` with `{ preserveFocus: true }` | shown | still the document |
| `ritemark.unifiedView.focus` (no options, the control) | shown | moved to the AI sidebar |

VS Code's `.focus` and `.open` commands call `openView(id, !preserveFocus)` (`viewsService.ts:515-534, 598-599`).

Notes:
- Ritemark already opens and focuses the AI sidebar 4 s after every start (`extension.ts:332`), so "never opened" does not happen in practice; "opened, then hidden" does. Its webview keeps its context when hidden (`retainContextWhenHidden`).
- Change (W4): the card path passes `{ preserveFocus: true }` wherever it shows the sidebar. That includes `_awaitActiveConversation` (`UnifiedViewProvider.ts:1611`), which today runs the plain focus command when the view is not resolved; the comment-task path keeps its behaviour.
- Not run: the never-resolved case. It uses the same `openView(id, false)` call, but this probe did not watch a never-resolved view resolve under `preserveFocus`.

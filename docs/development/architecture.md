# Ritemark Extension Architecture

**Status:** Living document — updated at the end of each sprint that changes extension architecture.
**Last updated:** 2026-09-01 (v1.10.0 RC — recoverable Claude authentication failures)
**Owner:** Jarmo (decisions) · Claude (maintenance)

---

## Purpose

This document is the single source of truth for Ritemark extension architecture — system layers, subsystem structure, data flows, and invariants that must hold across sprints. It covers the extension host and its integration with VS Code OSS; VS Code patch specifics are in `CLAUDE.md`; webview component internals are in `extensions/ritemark/webview/`.

Sprint planning must consult this document. Any sprint that changes the structure of a subsystem listed here must update this document as part of its definition of done (see [Sprint Architecture Gate](#sprint-architecture-gate)).

---

## System Architecture Overview

Ritemark Native is a **VS Code OSS fork — as a git submodule, not a hard fork** — with the Ritemark markdown editor built in natively. `.md` files open in a TipTap WYSIWYG webview via a Custom Editor Provider. The submodule choice is the keystone structural decision: all VS Code customizations live in **patch files** (`patches/vscode/`), never in the submodule tree, keeping upstream VS Code sync cheap.

```
┌─────────────────────────────────────────────────────────┐
│  Ritemark.app                                           │
│                                                         │
│  Layer 4: Webview        /webview/src                   │
│           React + TipTap + Vite (IIFE, ~7.6 MB)         │
│                    ↕ bridge.ts (postMessage)             │
│  Layer 3: Extension host /extensions/ritemark/src       │
│           TypeScript → Node.js                          │
│                    ↕ VS Code Extension API              │
│  Layer 2: VS Code patches /patches/vscode               │
│           001–010.patch (applied at build time)         │
│                    ↕                                    │
│  Layer 1: VS Code OSS    /vscode  (git submodule)       │
└─────────────────────────────────────────────────────────┘
```

**Layer boundaries are isolation boundaries.** Patches never touch the extension source; the webview never touches Node APIs directly. Every cross-boundary interaction is explicit and documented. This is what makes the system maintainable across VS Code upstream bumps.

---

## Webview ↔ Extension Protocol

The load-bearing boundary. The TipTap editor cannot read files, make AI calls, or do any I/O. It requests everything through `bridge.ts`. This keeps the editor sandboxed and independently testable; the webview bundle (`media/webview.js`) is a self-contained artifact that ships separately from the host.

`bridge.ts` exposes four channels:

| Function | Direction | Use |
|---|---|---|
| `sendToExtension(type, data)` | webview → host | request file ops, AI calls, navigation |
| `onMessage(cb)` | host → webview | document content, AI streams, state pushes |
| `sendDocumentMessage(message)` | webview → host | typed Markdown/CSV edit, visible-apply ACK, and conflict actions |
| `getDocumentSyncBootstrap()` | host bootstrap → webview | URI, document session, and per-view epoch for the typed document channel |
| `emitInternalEvent` / `onInternalEvent` | webview ↔ webview | UI-only events, no host round-trip |
| `openExternalUrl` / `openInternalLink` | webview → host | external and cross-document links |

`saveState` / `getState` (VS Code webview API) persist webview UI state across panel hide/show without a host round-trip.

### Core file editing flow

```text
.md/.csv file opened
  → host creates/joins one URI coordinator record
  → webview sends document:ready with its view epoch
  → host sends document:update(revision, complete payload, payloadHash)
  → TipTap/table applies the payload and sends document:applied

user edits
  → webview sends document:edit(basedOnRevision, clientSequence, full editable payload)
  → coordinator applies one version-sensitive WorkspaceEdit to TextDocument
  → every visible view receives and acknowledges the new authoritative revision

watcher / TextDocument / save / 3 s poll invalidates a URI
  → coordinator compares disk, model, and retained base
  → a save-scoped shell receipt identifies the exact snapshot VS Code wrote
  → clean external: converge TextDocument first, then publish a revision
  → local-only: keep quiet
  → two-sided divergence: preserve both snapshots and require explicit resolution
```

**Protocol type safety (current boundary):** most legacy `sendToExtension(type, data)` traffic remains stringly typed; issue #106 tracks the broader migration. Sprint 115 deliberately types only the load-bearing editable-document slice in `src/editorSync/protocol.ts`. Both directions use discriminated unions plus exact-field runtime validation, while unrelated bridge messages remain compatible.

### Editor–disk synchronization (Sprint 115)

`src/editorSync/DocumentSyncCoordinator.ts` is the sole owner of Markdown/CSV synchronization state. `RitemarkEditorProvider` adapts VS Code lifecycle and payload serialization; it no longer infers visibility from `postMessage`, watcher timing, a time-bounded self-write heuristic, or a destructive reload timer. The webview owns rendering only and proves it with an exact receipt.

Each URI record owns one `TextDocument`, one watcher, one three-second level-triggered fallback poll, one serialized transition queue, one document-session UUID, and zero or more independent view leases. Each view lease owns its epoch UUID, last client sequence, last acknowledged server revision, and one bounded delivery schedule. Hiding or closing one view never destroys another view's URI resources.

The coordinator keeps three content identities separate:

| Identity | Meaning |
|---|---|
| Exact disk SHA-256 | Lost-update validator for explicit conflict actions, including BOM/EOL byte differences. |
| Logical text SHA-256 | Three-way disk/model/base classification after one UTF-8 BOM and CRLF/CR normalization. |
| Canonical render-payload SHA-256 | Proof that body, properties/front matter, mappings, features, and CSV metadata belong to one applied revision. |

The derived states are intentionally asymmetric. A model ahead of an unchanged disk is ordinary local-only/autosave state and has no header action. A disk-only change is imported into the `TextDocument` under version/hash preconditions and sent to focused views. A true two-sided change freezes local and disk evidence and shows **Review changes**. There is no background choice between versions.

Save lag is classified by identity and ordering, not time. Patch `014-ritemark-save-receipts.patch` captures the Ritemark logical SHA-256 input and the write snapshot in the same synchronous turn after save participants, finishes that hash before handing the snapshot to the file service, and emits it only after the write succeeds. This ordering prevents either the file watcher or the save event from observing a completed local write before its receipt exists. The main-thread/ext-host bridge exposes the hash through `Symbol.for('ritemark.savedLogicalHash')` only for the synchronous `onDidSaveTextDocument` delivery. The extension never infers a receipt from the newer live model or by rereading a path that an external writer may already have replaced; a missing or malformed shell receipt remains conservative and cannot suppress a conflict. This also captures format-on-save and code-action output exactly, while a canceled or failed save creates no receipt.

Each confirmed receipt gets a monotonic sequence, and each disk read records the latest sequence that existed when the read began. A matching disk snapshot is accepted only when no later save was already confirmed at read start; it then consumes through the newest valid match and can advance the common ancestor while newer model text remains local-only. An unmatched or superseded match retires only receipts old enough for that observation to invalidate; receipts created while the read was in flight survive. This prevents stale successful receipts or old matching content from masking a later external write, without letting older reads erase newer saves. A disk hash that matches no ordered confirmed local receipt still follows the normal three-way path and can produce a true conflict.

`document:update` is idempotently sent immediately and retried at 750 ms and 2.5 s. Five seconds without the exact session + epoch + revision + payload-hash `document:applied` receipt produces **Retry document update**; a newer revision cancels the old budget. Hidden/disposed leases are dormant and receive the newest snapshot when visible/ready again.

Markdown applies the smallest valid ProseMirror structural transaction, maps selection through it, restores focus/scroll, and uses a clamped whole-document fallback only when structural application cannot reproduce the target. CSV acknowledges only after parsing and a committed render frame. Host-applied updates suppress normal edit feedback.

The React-to-TipTap value reconciler uses explicit causes (initial mount, a genuinely external value, or image-mapping refresh). It never infers initial mount from an empty Markdown projection: an empty H1 created by the `# ` input rule is valid editor structure even though Turndown serializes it as an empty string until the first title character arrives.

Conflicts expose memory-only `ritemark-sync:` local/disk `.txt` snapshots through VS Code's read-only diff editor. The non-custom suffix prevents recursive Ritemark editor activation. **Use disk version** is one undoable `WorkspaceEdit`. **Keep my version** rechecks the exact disk validator, writes through the public VS Code filesystem API, and performs a same-content revert solely to refresh the text model's etag/clean marker; the no-op model resolve preserves the existing undo stack. Conflict evidence is cleared only after every currently visible view acknowledges the resolution revision. A hidden view does not block resolution and receives current state when it returns.

The strong validator is an immediate precondition and post-write verification identity, not an atomic filesystem CAS claim: public portable local-filesystem APIs cannot combine “SHA still matches” and write as one operation. A non-cooperating writer inside that final interval follows unavoidable last-writer semantics. The user must explicitly choose **Keep my version**, and release QA retains a race-injection row; stronger guarantees would require a cooperating broker/lock or platform-specific primitive.

The original Sprint 115 implementation added no provider, feature flag, dependency, direct webview filesystem access, or CRDT/OT layer. The RC audit subsequently proved that public `onDidSaveTextDocument` cannot identify the completed snapshot when the live model advances or another writer replaces the path before a reread. Patch 014 is the narrow shell-tier exception: one private, save-scoped hash receipt, with no new public VS Code API and conservative behavior when absent.

**Comment callouts (Sprint 94, #81).** Editor-only comments live entirely in the editor webview (TipTap `CommentMark` for anchored highlights, an atom `CommentNode` for `///` notes, and a DOM-scanning `MarginCommentRail`); they round-trip through a scoped `marked` tokenizer + Turndown rules and are stripped at the shared export chokepoint (`export/v2/htmlPipeline.ts`). The one cross-subsystem seam is **Send-to-AI**: the editor and the AI sidebar are separate webviews, so an assigned comment relays across two new host messages — `comment:send-to-ai` (editor → `RitemarkEditorProvider`) and `comment:submit` (`UnifiedViewProvider` → sidebar, then the store's existing `sendAgentMessage`/`sendCodexMessage`/`sendOpenCodeMessage` → `agent-execute`). No `AgentRuntime` change. Gated by the `comment-callouts` experimental flag (default on). The comment webview.js bundle is now cache-busted via `?v=<mtime>` (was silently serving stale bundles across reloads).

---

### Conversation scoping (Sprint 99)

Every message that concerns a conversation carries `conversationId` at the top level — inbound
(`agent-execute`, `agent-cancel`, `agent-approve`, `agent-answer-question`, `codex-answer-question`,
`conversation:reset`) and outbound (`agent-progress`, `agent-result`, `agent-question`,
`agent-approval-request`, `codex-streaming`, `codex-progress`, `codex-result`, `codex-question`,
`codex-plan-text-delta`, `codex-plan-update`, `codex-rpc-progress`).

**An inbound message with an unknown `conversationId` is dropped with a warning, never delivered to
the active conversation.** Falling back to "whatever is on screen" is the bug class parallel chats
exist to remove.

`UnifiedApprovalRequest` gained `conversationId`; adapters do not set it, the view provider stamps
it where the callback already closes over the conversation.

## Subsystem Map (current, post-Sprint 78)

```
extensions/ritemark/src/
├── agent/           Claude Code runtime — SDK-based, in-process + bundled binary
├── codex/           Codex runtime — JSON-RPC 2.0 / stdio binary, custom protocol
├── acp/             ACP runtime — JSON-RPC 2.0 / stdio, @agentclientprotocol/sdk
├── browser/         Integrated browser — CDP panel, MCP server, action tools
├── flows/           Flow engine — scheduler, executor, storage, test runner
├── features/        Feature flags — flags.ts registry, featureGate.ts
├── conversations/   Durable project-scoped agent conversations, migration, typed protocol/controller
├── editorSync/      Markdown/CSV disk-model-view coordinator, typed protocol, retry and three-way state
├── ai/              Shared AI utilities — modelConfig.ts, connectivity, analytics
├── views/           View providers — UnifiedViewProvider (AI sidebar), AgentLibraryViewProvider
├── settings/        Settings page bridge
├── utils/           Binary resolution, platform utils, bundledAgentRuntime
├── voiceDictation/  Whisper-based STT for live dictation (macOS only)
├── speech/          Transcription subsystem (Sprint 108) — engines, jobs, sessions
├── export/          PDF/DOCX export
├── update/          Seamless updates — feed, resolver, installer, integrity, status bar
└── [editors]        ritemarkEditor.ts, docxEditorProvider.ts, pdfEditorProvider.ts, excelEditorProvider.ts, drawioEditorProvider.ts, transcriptWorkbenchProvider.ts
```

Editor provider contracts: `ritemarkEditor.ts` is a `CustomTextEditorProvider` (Markdown + CSV, editable) with multiple views per `TextDocument`; `src/editorSync/` owns their shared URI state and per-view delivery. `excelEditorProvider.ts` is a full `CustomEditorProvider<ExcelDocument>` since Sprint 81 — .xlsx is editable (dirty tracking via `CustomDocumentContentChangeEvent`, save/save-as/revert/hot-exit backup; no undo-redo stack), .xls stays read-only. `docxEditorProvider.ts` and `pdfEditorProvider.ts` are read-only (`CustomReadonlyEditorProvider`), as is `transcriptWorkbenchProvider.ts` — whose document is the AUDIO file, with the transcript held as session state beside it (Sprint 108).

Entry point `extension.ts` registers all providers, commands, and views.

### Durable Agent Conversations (Sprint 109)

`src/conversations/` is the canonical owner of non-empty agent conversations. `ConversationStore` writes versioned records atomically under extension global storage, maintains a rebuildable index, isolates corrupt records, and protects deletion with tombstones plus one ephemeral process-lifetime Undo token per actionable native notification. Dismissing a notification releases its token and reserved record. The extension host owns this transient feedback through native VS Code information notifications and executes each Undo action even when the Conversations webview is closed; the webview owns only contextual persistent notices such as degraded storage state. `projectScope.ts` derives a stable project identity for single-root, multi-root, workspace-file, no-folder, and unassigned legacy records.

The sandbox boundary uses the exact-field `conversation/*` request/result/event union in `protocol.ts`. `ConversationController` alone enforces scope, canonical UUIDs, binding generations, persist-before-dispatch ordering, delete/Undo, migration, and runtime lifecycle checkpoints. User events carry a display-only prompt separately from the runtime prompt so hidden context never leaks into restored transcripts; one webview turn ID is preserved across runtime continuations. `UnifiedViewProvider` composes this controller, forwards typed messages, and owns only the bounded live-session pool, never durable storage rules.

Conversation naming is host-owned. `ConversationTitlePolicy` creates the immediate, deterministic first-prompt fallback and validates both 3–6-word generated titles and manual titles. After the first successful assistant response, `ConversationTitleGenerator` builds a fresh one-shot runtime through the shared `createRuntime(runtimeId)` factory, with tools disabled and Codex-style execution read-only, and disposes it after classification. It never borrows the interactive session or adds a classifier turn to the transcript. The controller applies the AI result only while the record still carries the exact fallback; `conversation/rename` checkpoints an explicit user title through the same exact-field protocol and therefore always wins a race with generation.

The webview is a projection. It may persist the selected canonical ID, up to five workspace-scoped Pin IDs, and harmless UI preferences through `vscode.setState`, but it must not persist a second transcript, writable history, or an "open thread" set. The permanent 56px conversation rail derives Pinned + current + Working/Needs you + three recent idle shortcuts from host summaries and remains present even when `parallelChats` limits live runtime capacity to one. The host-backed Conversations panel is the only durable list. Switching or closing the panel never deletes a record or disposes unrelated runtime work.

Each record owns a persisted project-scoped `identityColorSlot`. Allocation uses eight base rainbow families before deeper and softer rounds, never reuses a slot until all 24 are occupied, preserves the slot through Rename/Delete+Undo, and deterministically backfills pre-release Sprint 109 records. When all slots are occupied the least-recently-active slot is reused; title remains canonical identity while color is a recognition aid.

Live runtime context is separately bounded by `runtimeAttachmentPolicy.ts`: five conversation attachments when parallel work is enabled, one otherwise. Working, Needs-you, and current attachments are protected; starting work releases the least-recently-used non-current idle attachment and tells the webview that the next turn starts with a new context. If every attachment is protected, only Send is blocked with user-facing work-state copy. Extension deactivation checkpoints every attached Working/Needs-you record as Interrupted before runtimes are disposed. New/read/select/save operations remain unlimited.

Legacy localStorage is read-only after monotonic host cutover. `LegacyConversationMigrator` imports known single-root records into that project, sends ambiguous/global records to the explicit unassigned bucket, fingerprints content for idempotent dedupe, and preserves source conflicts rather than overwriting them. `durableAgentConversations` is an experimental default-on kill switch; after host authority exists, flag-off uses host compatibility presentation and never returns to dual writes.

### Runtime continuation (Sprint 110)

Durable transcript and provider memory are separate authorities. Each conversation may hold a host-only `continuations[runtimeId]` descriptor containing an opaque native reference, exact project/runtime/version/model/policy/auth compatibility binding, and `coveredThroughEventId`. The descriptor map is never projected to the webview. `runtime/continuation.ts` owns compatibility, HMAC fingerprinting, redacted diagnostics, and the shared `RuntimeContinuationRequest`/state contract; `conversations/contextPack.ts` owns one deterministic 32,000-byte transcript fallback for all runtimes.

Continuation remains lazy: selecting or reading a conversation performs no runtime/auth/network work. On an accepted Send, `UnifiedViewProvider` excludes the new user event from context, tries only that runtime's exact-compatible native descriptor, and otherwise opens a fresh session with canonical user prompts plus completed assistant text. Tool/progress/approval/plan state, hidden prompts, partial responses, provider history, and attachment binaries are never replayed. Claude uses SDK `resume`, Codex uses `thread/resume`, and OpenCode uses capability-gated ACP `session/resume`; ACP `session/load` is forbidden because it replays provider history into the canonical transcript boundary.

Dispatch certainty is append-only host state: the store atomically saves user text plus `not-sent`, writes `ambiguous` before transport, and appends `accepted` only after runtime-specific provider evidence. Coverage advances atomically with a completed assistant final. Any ambiguous/accepted turn without a saved final invalidates only that runtime's descriptor and uses fresh fallback next time. A per-conversation execution token plus controller lifecycle checks reject callbacks from an agent superseded by a handoff. The webview receives only truthful continuation status and durable transcript boundaries.

---

## Agent Runtime Architecture

### Bundled runtime baseline (Sprint 111)

The v1.10.0 host↔binary baseline is exact and reproducible: Codex `0.149.0`, Claude Code `2.1.239` paired with Agent SDK `0.3.239`, and OpenCode `1.18.21` paired with ACP SDK `1.4.0`. `extensions/ritemark/binaries/agents/manifest.json` remains the single binary supply-chain contract with one row per required component × supported platform (`darwin-arm64`, `darwin-x64`, `win32-x64`). Codex has two mandatory, version-matched components: `app-server` and the sibling `code-mode-host` that serves Code Mode file tools. Claude and OpenCode each have one `runtime` component. Codex retains direct GitHub release assets; Claude and OpenCode retain official npm optional-package artifacts. This changes no `AgentRuntime` interface and adds no runtime kind.

`scripts/validate-agent-runtime-manifest.mjs` is the hard pre-fetch/build gate. Schema 2 requires twelve component rows and rejects an incomplete component/platform matrix, duplicate or noncanonical per-target install names, a snapshot outside the approved pins, malformed checksums/source URLs, stale vendor identity, package-lock drift, or a missing/mismatched Claude optional package. It runs from fetch, runtime verification, and the repository QA gate. The canonical install name is part of the runtime contract: Codex discovers `codex-code-mode-host[.exe]` by its exact sibling filename. The manifest fetcher verifies archive SHA-256 before extraction, validates the recorded path/architecture, and runs each component's supported native smoke (`--version` for primary runtimes, `--help` for the code-mode host). Build-output validation and the Windows installer preflight both enumerate the manifest, while macOS signing re-signs every executable component under the agent directory. `.github/workflows/agent-runtime-matrix.yml` reruns the exact SDK compile, native fetch, and component smoke on Intel macOS and Windows x64 when supply-chain inputs change. Full installer/signing and a real packaged Codex file-tool canary remain release gates; a macOS cross-fetch alone proves bytes/layout, not native behavior.

The measured protocol delta is deliberately narrow: Codex 0.149.0 adds `isBlocking` to `request_user_input`; Ritemark tolerates it as optional so older explicitly selected system runtimes still work. ACP 1.4.0 retains the client API used by `src/acp/`; OpenCode effort discovery stays semantic (`configOptions.category === "thought_level"`) and model-dependent. Composer effort UI belongs to Sprint 112, not this supply-chain baseline.

### Per-turn thinking effort (Sprint 112)

`runtime/thinkingEffort.ts` is the canonical vocabulary and validation boundary for Composer effort: `auto | low | medium | high | xhigh | max | ultra`. `RuntimeSessionConfig` reports model-catalog or live-session capability and optional applied-value evidence; `RuntimeTurnConfig` carries the immutable accepted-turn snapshot. The webview never imports vendor SDK types or hardcodes model IDs. `agent-execute` and the exact-field conversation protocol validate the same union, and the experimental/default-on `composer-thinking-effort` flag gates both UI and host application without deleting stored metadata.

Effort draft state is durable per conversation and runtime. The Composer may change while work is running, but accepted and queued turns retain their own snapshot; requested and provider-evidenced applied values are metadata, never transcript prompt text. Claude maps explicit values to SDK `Options.effort` and changes warm sessions through awaited `applyFlagSettings`; Codex maps execute and plan turns to the same app-server effort and restores its captured default when warm Auto follows a manual override; OpenCode discovers only semantic ACP `thought_level` options after the existing lazy session starts and awaits the full config response before prompting. Unsupported or rejected values fail closed to Auto without neighboring-level coercion or automatic duplicate dispatch.

### Sessions (Sprint 99)

`AgentRuntime` is an adapter — **one instance per runtime KIND**, held by `RuntimeRegistry`. It
mints **one `RuntimeSession` per conversation**:

```ts
interface AgentRuntime {
  createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession>;
  disposeSession(conversationId: string): void; // exactly one provider attachment
  getStatus(): Promise<RuntimeStatus>;   // adapter-level: binary + auth, NOT per-conversation
  dispose(): void;                        // every session
}
interface RuntimeSession {
  readonly conversationId: string;
  prompt(turn); cancel(); respondToApproval(...); dispose();   // this conversation only
}
```

Before Sprint 99, `start()`/`prompt()`/`cancel()` lived on the adapter and `start()` ran on EVERY
turn against the shared instance — so a second conversation overwrote the first one's callbacks. A
session OBJECT rather than an id parameter, because `RuntimeSessionConfig` already carries the
per-turn callbacks: letting them close over the conversation means a callback *cannot* fire against
another one, instead of merely being told not to.

`getStatus()` stays adapter-level deliberately — per-conversation status would imply a
per-conversation binary.

Per-runtime session mapping, and the shared thing each keeps:

| Runtime | Session is | Shared across sessions |
|---|---|---|
| Claude Code | one `AgentSession` (`AgentRunner.ts`) | nothing — the SDK is per-session |
| Codex | one app-server **thread** | ONE `codex-app-server` process, one listener registration; events route by `params.threadId` |
| OpenCode / ACP | one ACP **session** | ONE subprocess (measured: 339 MB for 5 sessions vs 1291 MB for 5 processes) |

### Recoverable runtime failures (v1.10.0 RC correction)

Provider error text is diagnostic data, not user-interface copy. The runtime
boundary classifies known recoverable failures into stable `failureKind`
values; `agent-result` carries that category alongside the user-facing error.
The webview renders the recovery action from the category and never has to
parse a vendor sentence. Claude authentication failures therefore appear as a
plain-language card with **Sign in to Claude**, while the raw SDK error remains
inside the collapsed activity trace. That active-turn recovery card takes
precedence over the full-sidebar setup/onboarding gate, so the ensuing
`needs-auth` status refresh cannot hide the action the user was just shown;
empty or newly started conversations continue to use the normal setup wizard.

Claude OAuth and its macOS Keychain credential are app-global even though
conversation sessions are independent. A proven Claude authentication failure
releases every warm Claude session, invalidates setup status, and does not run a
model-discovery probe while authentication is unavailable. Starting or
finishing sign-in also releases stale Claude sessions so a process holding the
old token cannot survive the browser flow and race the new credential. Settings,
commands, onboarding, and the chat recovery card use one app-global login
coordinator; a second surface reports the already-open flow instead of spawning
a competing login process. No credential or token crosses into the webview.

Sprint 99 fixed three concurrency defects that the single-conversation shape had hidden:
`CodexRuntime` held `_threadApprovalKey`/`_browserToolsEnabledForThread` as scalars whose mismatch
nulled `_threadId`, so one conversation switching Auto↔Ask would have silently destroyed another's
thread context; `AcpRuntime._recentlyPermissionedWrites` was a process-wide `Set<filePath>`, a
cross-chat approval bypass; and `AgentSession` held single-slot pending-approval fields that
overwrote each other when the model emitted two `tool_use` blocks in one message — a live bug on one
conversation, not just a concurrency risk.

**Browser tools are serialized across conversations** (`BrowserActionTools.callBrowserAction`). There
is one integrated browser and one active tab, so tool calls are commands against shared state.
Per-chat browsers would need per-chat tab ownership in the workbench — shell-tier, out of scope.

### Capability Context (Sprint 101, #154)

The standing "what Ritemark is and how you act inside it" guidance every runtime receives lives in
**exactly one module**, `src/ai/capabilityContext.ts` (`renderCapabilityContext(descriptor)`). It
describes the real capability surface: an agent's only way to change a document is its file-editing
tool writing the markdown file on disk; comments are `<!-- … -->` / `<mark data-comment>` (not
footnotes, not `///`); internal links are relative Markdown links; slash-menu / `/image` / `/diagram`
/ export / voice are USER-ONLY; prefer the integrated browser over `open`/`xdg-open`. Adding a
Ritemark capability = editing this one module.

Each runtime delivers the same context through its own native mechanism — `UnifiedViewProvider` is
the single injection point, rendering the per-runtime descriptor into `RuntimeSessionConfig.extraSystemPrompt`:

| Runtime | Mechanism | Notes |
|---|---|---|
| Claude Code | `systemPrompt.append` (after the safety prefix) | `extraSystemPrompt` → `extraSystemPromptAppend` (`ClaudeCodeRuntime.ts`) |
| Codex | `baseInstructions` (`buildCodexBaseInstructions`) | context IS the base; the legacy `CODEX_BASE_INSTRUCTIONS` survives only as a defensive fallback |
| OpenCode / ACP | per-turn prompt prefix, **once per session** | ACP has no system-prompt concept; `buildAcpPromptText` prepends the context on the first turn only |

This replaced a documented asymmetry where `extraSystemPrompt` was APPENDED by Claude but REPLACED
Codex's base — so only Claude received the browser hint. The browser guidance is now included for any
runtime whose integrated browser is actually available (`descriptor.hasBrowserTools`).

### AS IS (Sprints 1–78) — Three Parallel Worlds

Each runtime was integrated independently. The result is three structurally similar but incompatible stacks:

| Dimension | Claude Code (`src/agent/`) | Codex (`src/codex/`) | ACP/OpenCode (`src/acp/`) |
|---|---|---|---|
| **Interface** | In-process TS SDK (`@anthropic-ai/claude-agent-sdk`) + bundled `claude` binary | Bundled `codex-app-server` binary, hand-written JSON-RPC 2.0/stdio (`codexProtocol.ts` 463 LOC) | `@agentclientprotocol/sdk` over stdio |
| **Session manager** | `AgentRunner.ts` (1235 LOC) | `CodexManager.ts` (906 LOC) | `AcpManager.ts` (286 LOC) |
| **Auth** | Claude OAuth / Anthropic API key | ChatGPT OAuth built into binary | BYOK — env-var injection from Settings |
| **Approval** | `agent-answer-plan` webview message → PlanApprovalCard | `codex-approve` → CodexApprovalCard | `acp-approval-response` → CodexApprovalCard (shared shape, different message type) |
| **Browser tools** | `BrowserMcpServer` injected via `AgentSessionConfig.mcpServers` | `codexBrowserTools.ts` — dynamic tool injection via Codex protocol | Not implemented |
| **File attachments** | Full `FileAttachment` (image/pdf/text) | Images converted to data URLs; PDF/text not supported | No attachment support |
| **Model config** | `modelCatalog.getModels('anthropic')` — live `/v1/models` → catalog | `modelCatalog.getModels('codex')` — `~/.codex` cache → catalog | `modelCatalog.getModels('opencode')` — curated BYOK — all via `src/ai/modelCatalog` (Sprint 89) |
| **Webview execute message** | `ai-execute-agent` | `codex-execute` | `acp-execute` |
| **Webview cancel message** | `ai-cancel-agent` | `codex-cancel` | `acp-cancel` |

**Dispatch (post-Sprint 79 AS IS):** `UnifiedViewProvider.ts` is 1097 LOC. Three unified switch cases replace the previous 9 runtime-specific variants. Adding a fourth runtime requires only a new adapter class + a registry entry.

### AS IS (Sprint 79) — Runtime Adapter Pattern

```
src/runtime/                          ← added Sprint 79
├── AgentRuntime.ts                   interface + shared types
├── RuntimeRegistry.ts                holds the shared interactive instances (lookup, lifecycle)
├── runtimeFactory.ts                 createRuntime(id) — single runtime construction source (Sprint 80)
├── UnifiedApprovalGate.ts            single approval path for all runtimes
└── BrowserToolsInjector.ts           browser MCP injection config

src/agent/ClaudeCodeRuntime.ts   → implements AgentRuntime, wraps AgentRunner/AgentSession
src/codex/CodexRuntime.ts        → implements AgentRuntime, wraps CodexAppServer+CodexAuth
src/acp/AcpRuntime.ts            → implements AgentRuntime, wraps AcpManager
```

**`AgentRuntime` interface:**

```typescript
interface AgentRuntime {
  readonly id: AgentId;

  start(config: RuntimeSessionConfig): Promise<void>;
  prompt(turn: RuntimeTurnConfig): Promise<void>;
  cancel(): Promise<void>;
  dispose(): void;

  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean): void;
  getStatus(): Promise<RuntimeStatus>;
}
```

**Unified dispatch in `UnifiedViewProvider`:**

```typescript
// 3 cases total (was 9 runtime-specific)
case 'agent-execute': {
  const runtime = this._runtimeRegistry.get(message.agentId);
  await runtime.start(sessionConfig);
  await runtime.prompt({ prompt, attachments });
  break;
}
case 'agent-cancel': {
  this._runtimeRegistry.get(message.agentId)?.cancel();
  break;
}
// agent-approve → _approvalGate.respond(requestId, approved, alwaysAllow)
```

---

## Unified Approval Gate

One webview message contract, one approval card component, all runtimes:

```typescript
// Extension → Webview (all runtimes):
{
  type: 'agent-approval-request',
  agentId: AgentId,
  requestId: string,
  kind: 'file-write' | 'shell-command' | 'permission' | 'plan',
  // kind-specific payload (file path, diff, command, plan text, etc.)
}

// Webview → Extension (all runtimes):
{
  type: 'agent-approve',
  agentId: AgentId,
  requestId: string,
  approved: boolean,
  alwaysAllow: boolean,
}
```

Each runtime adapter translates its native approval format (Codex JSON-RPC, ACP `session/request_permission`, Claude plan approval) into this shape before forwarding to the webview.

### Two-axis turn policy (Sprint 103, supersedes the Sprint 79 three-mode strip)

Two independent per-conversation axes govern agent behavior (Sprint 103, #132):

- **Autonomy** — `approvalMode: 'auto' | 'ask'` (UI labels **Auto** / **Manual**). Legacy `'plan'` in messages/storage normalizes to auto + planFirst.
- **Plan-first** — `planFirst: boolean` (UI: the **Plan** chip; session state, auto-resets when a plan is approved — cancel leaves it on).

Sent as `approvalMode` + `planFirst` on `agent-execute`; the webview derives both from `PendingRuntimeSelection` via `policyOf()` (lossless migration of stored `mode: 'plan'` threads).

| Axis value | Claude Code | Codex | OpenCode (ACP) |
|---|---|---|---|
| **Auto** | SDK `acceptEdits` + canUseTool auto-allow (NEVER `bypassPermissions` — its mere availability disables native plan enforcement) | `approvalPolicy: never`, `workspace-write` | auto-allow `request_permission` |
| **Manual (ask)** | SDK `default` + mutating tools gated via `canUseTool` | `approvalPolicy: untrusted` + `sandbox: read-only` | native `request_permission` prompt |
| **Plan on** | SDK native `permissionMode: 'plan'` (enforced read-only) + `planModeInstructions`; `ExitPlanMode` → plan card; approve → `updatedPermissions setMode` to the autonomy mode, same turn continues | `collaborationMode: plan` on a **read-only sandbox** thread; approval sends the continuation turn on a write-sandbox thread | **not offered** — no enforceable plan contract (capability-gated) |

Capability gating: `src/runtime/capabilities.ts` is the single registry of per-runtime capabilities (`planFirst`, `liveModeSwitch`, `structuredPlanSteps`), delivered to the webview on `agent:config`; no component hardcodes runtime ids for capability checks.

Mechanics & constraints:
- `allowedTools` in the Claude SDK means *auto-allowed without prompting* and auto-allowed tools NEVER reach `canUseTool` — mutating tools **and `ExitPlanMode`** must be excluded from it (audit F7; only `AskUserQuestion` is documented as always prompting).
- Claude autonomy changes use the SDK's live `setPermissionMode` — no session rebuild, conversation memory survives (Sprint 103, audit F8). A genuine rebuild (model change) emits a `session_reset` progress event rendered as a transcript divider.
- Codex `approvalPolicy`/`sandbox` remain fixed at `thread/start`; the plan boundary (read-only ↔ write sandbox) reuses the thread-reset machinery, and the approved-plan continuation prompt re-carries the task context.
- Prompt-text mode sniffing (`"plan mode"` phrase detection) is removed on both Claude and Codex paths (D4); model-initiated planning is surfaced via the `plan_autonomous` progress event, never silently.
- Activity truth (#161): `webview …/activityState.ts` (`deriveActivityState`) is the single status source for both the conversation status line (`ActivityStatusLine`) and the Sprint 99 thread-rail attention state; a turn with a terminal result cannot be "waiting". Metrics carry `waitedMs` (human-wait time) and `filesModified` is workspace-filtered host-side.
- "Always allow" was removed from the approval card (it was OpenCode-only and did not actually persist); cards offer Approve / Reject only.

---

## Browser Tool Injection

**Target:** All runtimes receive browser tools through a single `BrowserToolsInjector` that produces an MCP server spec. Each adapter knows how to inject an MCP server into its runtime.

```
BrowserToolsInjector.getServers() → MCP server config
  → ClaudeCodeRuntime: mcpServers field (already works this way)
  → CodexRuntime: replaces codexBrowserTools.ts with MCP injection via Codex protocol
  → AcpRuntime: MCP server list in ACP initialize request
```

`codexBrowserTools.ts` is deleted in Sprint 79 (Path A) if the Phase 0 Codex MCP injection audit confirms support. If not (Path B), the logic moves inside `CodexRuntime` and is tracked as ARCH-5 debt for a future sprint.

---

## Flows Architecture

Flows are JSON-serialized, node-based automation workflows. The engine resolves node dependencies and executes nodes through pluggable executors.

Engine files: `FlowExecutor.ts` (run), `FlowScheduler.ts` (timed triggers), `FlowStorage.ts` (load/save/enumerate), `FlowEditorProvider.ts` (custom editor for `.flow.json` files).

Node executors (`src/flows/nodes/`): `LLMNodeExecutor`, `ImageNodeExecutor`, `SaveFileNodeExecutor`, `ClaudeCodeNodeExecutor`, `CodexNodeExecutor`. Template interpolation (`{{variables}}`) handled by `interpolate.ts`.

UI: `webview/src/components/flows/` — canvas editor, node config panels, execution monitor.

**Key invariant:** flow nodes call model APIs directly through their own executors, not through the `AgentRuntime` interface. `ClaudeCodeNodeExecutor` and `CodexNodeExecutor` call their respective managers for single-shot turns within a flow. The distinction — autonomous agent runtime vs. single-shot flow node — is a deliberate design decision (see Locked Decisions).

---

## File Attachments

### AS IS

| Runtime | Images | PDFs | Text files |
|---|---|---|---|
| Claude Code | ✅ via `FileAttachment` | ✅ | ✅ |
| Codex | ⚠️ converted to data URLs; no `kind` check | ❌ silently dropped | ❌ silently dropped |
| ACP/OpenCode | ❌ not implemented | ❌ | ❌ |

### TO BE (Sprint 79)

Single `UnifiedAttachment` type in `src/runtime/AgentRuntime.ts`. Each adapter converts to its native format:

```typescript
interface UnifiedAttachment {
  id: string;
  kind: 'image' | 'pdf' | 'text';
  name: string;
  data: string;       // base64 for image/pdf, raw text for text
  mediaType: string;
}
```

- `ClaudeCodeRuntime`: passes through unchanged (already compatible).
- `CodexRuntime`: images → data URLs; PDF/text → inlined as fenced block in prompt preamble with notice.
- `AcpRuntime`: images → inline base64 if provider supports multimodal (check `BYOK_PROVIDER_MODELS`); text/PDF → inlined fenced block with downgrade notice.

---

## Build Pipeline

```
tsc --noEmit + esbuild  extension host: 2 bundles (out/extension.js + out/browser/browserMcpAdapter.js)  [Sprint 92 #105]
Vite → media/webview.js webview bundle: ~7.6 MB IIFE
apply-patches.sh        applies patches/vscode/001–014.patch to /vscode submodule
gulp darwin-arm64-min   VS Code full build against submodule
codesign                Apple Developer ID + Hardened Runtime + agent binary re-signing (JKBSC3ZDT5)
xcrun notarytool        Apple notarization (pull log with --id before assuming outage)
create-dmg              Sparkle-compatible .dmg
update-feed.json        Sparkle update feed → jarmo-productory/ritemark-public
```

Build prerequisites (not enforceable at commit time): Node v20.x arm64 for prod, Node v22.21.1 arm64 for dev, `arch -arm64` shell wrapper. Full commands and gotchas in `.claude/skills/vscode-development/SKILL.md`.

**RESOLVED ([#105](https://github.com/ProductoryHQ/ritemark-native/issues/105), Sprint 92):** The host was ~130 loose `.js` files plus the full `node_modules` tree (~180 packages) — root cause of Windows EMFILE, the 0-byte tsc trap (v1.7.1), and DMG bloat. Now esbuild-bundled into **two files** (`out/extension.js` + the standalone `out/browser/browserMcpAdapter.js` subprocess). Pure-JS deps are inlined; `node_modules` is retained ONLY for what esbuild can't/shouldn't bundle: the two ESM agent SDKs loaded via `new Function('return import(...)')` (`@anthropic-ai/claude-agent-sdk`, `@agentclientprotocol/sdk`), `pdfkit` (runtime font-data loader), and `fsevents` (native, macOS-only). Type-checking preserved via `tsc --noEmit`. **Future extension code must follow the bundle-safe rules** (no `__dirname`-depth path math; native/dynamic deps → esbuild `external`; separate-process code → its own entry point) — see `.claude/skills/vscode-development/SKILL.md`. #107 (webview bundle size) and #108 (build-integrity gate) are now unblocked but not built here.

**Known architectural issue ([#107](https://github.com/ProductoryHQ/ritemark-native/issues/107)):** The webview bundle is documented in several places as "~900 KB" but is actually **~7.6 MB** (~8× undocumented growth). All surfaces in one IIFE loaded on every `.md` open. No CI bundle-size budget exists.

---

## Scheduled Tasks (Daemon)

### Per-workspace consent gate (Sprint 107 R2)

Schedule-triggered runs fire without a user gesture, so arming is gated on a
per-workspace opt-in (`src/daemon/workspaceConsent.ts`, stored in
`workspaceState`). D1 = Option A (one-shot non-blocking toast when a workspace
first presents schedule-eligible agents; reversible via the Agent Library's
Scheduled-section Allow/Pause toggle). D2 = grandfather: existing
`DaemonResultStore` run history counts as granted. Without consent the
`Scheduler` still parses and registers entries UNARMED (visible in the Agent
Library, `timerId: undefined`), and `fire()`/`tick()` re-check consent as
defense in depth. The `scheduled-tasks-daemon` flag is unchanged — this is a
layer under it, not a new kill-switch.

### Vision

A daemon is a **scheduler** — "a clock that fires registered tasks." What it fires is deliberately *not* the daemon's concern. Running an AI agent on a schedule is the first and primary use case, but it is one **task handler** among potentially many (git sync, file backup, future deterministic jobs). The scheduler knows only how to fire a task on schedule and record its result; each handler knows what to actually do.

This generality is a structural decision, not speculative scope. Coupling the scheduler to `AgentRuntime` would repeat the mistake the Sprint 79 runtime-adapter work exists to fix: a parallel world per use case. The scheduler-with-pluggable-handlers shape mirrors the runtime-adapter and flow-node-executor patterns already established in this codebase.

### Architecture (TO BE — Sprint 79 foundation, Sprint 80 activation)

```
src/daemon/                          ← NEW in Sprint 80
├── Scheduler.ts                     cron watcher, registration, lifecycle (handler-agnostic)
├── ScheduledTask.ts                 ScheduledTask interface + shared types
├── cron.ts                          minimal pure 5-field cron engine (unit-tested)
├── scheduleParser.ts                schedule frontmatter parser + cron validation
├── handlers/
│   ├── AgentTaskHandler.ts          runs a headless AgentRuntime session (Sprint 80)
│   ├── GitSyncHandler.ts            git pull/commit/push        (stub — interface only)
│   └── ScriptHandler.ts             arbitrary deterministic Node job (stub — interface only)
├── DaemonResultStore.ts             persists run history (workspaceState, 10/run cap per task)
└── DaemonStatusEvents.ts            VS Code status bar + Agent Library notifications
```

The scheduler scans and watches agent files under **both** `.claude/agents/` and `.agents/` in the workspace; a frontmatter `schedule:` block makes a file eligible.

**`ScheduledTask` interface (the load-bearing abstraction):**

```typescript
interface ScheduledTask {
  readonly id: string;
  readonly schedule: string;              // cron expression (future: event triggers e.g. "on-save")
  run(ctx: TaskContext): Promise<TaskResult>;
  readonly autoApprovalPolicy?: AutoApprovalPolicy;
}
```

`Scheduler` depends only on `ScheduledTask`. It never imports `AgentRuntime`. `AgentTaskHandler` is the adapter that bridges the two: it implements `ScheduledTask.run()` by calling `runtime.prompt()` on a headless session. Each run constructs its **own fresh** runtime via the `createRuntime()` factory (`src/runtime/runtimeFactory.ts`) — the single construction source that `UnifiedViewProvider` also uses for the shared interactive registry — so a headless run is fully isolated from the user's live conversation (Jarmo decision #2) and is runtime-agnostic *by construction* (claude-code is the verified default; pointing a task at another runtime is a constructor argument, not a rewrite). A future `GitSyncHandler` implements the same interface by calling `simpleGit` — the scheduler is unchanged.

**Key design decisions:**

1. **Scheduler is handler-agnostic.** The clock fires `ScheduledTask.run()` and stores the result. It has no knowledge of agents, git, or any specific job type. New scheduled capability = new handler, not a change to the scheduler. (Same shape as "new automation = new flow node executor.")

2. **Agent runs go through the same `AgentRuntime` interface.** `AgentTaskHandler` calls `runtime.prompt()` like an interactive session, but with a headless session that routes approvals to auto-block-or-skip logic instead of the UI. This is why the `AgentRuntime` abstraction must exist first (Sprint 79 is a hard prerequisite for the agent handler specifically).

3. **No daemon-specific runtime.** The agent handler is a client of the existing runtime layer, not a fourth runtime. It builds its instance through the shared `createRuntime()` factory rather than constructing a concrete runtime class directly — keeping runtime construction in one place.

4. **Auto-approval policy for headless runs:** carried by `autoApprovalPolicy` on the task. For agent tasks: file-reads auto-approved; file-writes blocked and surfaced as a notification; shell commands blocked. The agent's `allowedTools` frontmatter narrows this further. Deterministic handlers (git sync) define their own policy — they are not bound to the agent policy.

5. **Runs only while Ritemark is open (Phase 1, Sprint 80).** Any open window drives the scheduler. True background execution (process survives app close) requires OS-level service integration (launchd/systemd, menu-bar agent) and is **out of scope** until there is user demand. Deferred as a Phase 2 GitHub issue.

6. **Cross-runtime context (Sprint 80 pre-flight, agent handler only):** When an agent-task result is surfaced in the Agent Library alongside interactive history, what context (if any) carries between them? Design decision required before wiring `AgentTaskHandler` — see [#97](https://github.com/ProductoryHQ/ritemark-native/issues/97). Does not block the scheduler or non-agent handlers.

**Sprint 80 scope:** ship `Scheduler`, `ScheduledTask`, `DaemonResultStore`, `DaemonStatusEvents`, and exactly one concrete handler (`AgentTaskHandler`). `GitSyncHandler` / `ScriptHandler` ship as interface-only stubs (`run()` throws `not implemented`) to prove the interface generalizes without committing to their behaviour.

---

## Transcription (Sprint 108)

`src/speech/` turns a recording into a document. It is shaped like `src/runtime/`
rather than folded into `ai/modelConfig.ts`, because an STT engine is a **runtime**
— a child process or an HTTP client, with its own readiness, platform support and
failure modes — not an LLM model id. `ai/modelConfig.ts` remains the single
registry for LLM models, including the one the insights rail uses.

```
src/speech/
├── TranscriptionEngine.ts   the interface (capabilities, readiness, cost, transcribe)
├── engineRegistry.ts        registration + platform filtering + local-first preference
├── engines/
│   ├── whisperLocalEngine.ts   bundled whisper.cpp, macOS only (#133)
│   └── elevenLabsEngine.ts     Scribe v2, diarized, one request per file
├── JobManager.ts            single-flight queue, progress, cancel, restart recovery
├── SessionStore.ts          file-backed sessions in globalStorage (D5)
├── audioPrep.ts             format gate, afconvert for m4a/aac, waveform peaks
├── durationProbe.ts         afinfo / WAV header — returns null rather than guessing
├── segmentFolding.ts        word stream → segments (majority-vote speaker)
├── insights.ts              one-shot extraction on the existing agent runtime
├── insightsParsing.ts       prompt + citation resolution (pure, unit-tested)
├── insightsLanguage.ts      Auto/known/custom language contract + search + legacy provenance
├── insightsMarkdown.ts      Insights snapshots + exclusive new-file writes
├── speakerNames.ts          full-name whitespace normalization
├── workbenchProtocol.ts     typed/validated webview → host requests
├── transcriptMarkdown.ts    session → document
├── exportTranscript.ts      where the document lands
└── activeTranscript.ts      resolver so the AI sidebar gets the transcript, not the .m4a
```

**Two facts shape every surface** and are not implementation details:

1. **On-device Whisper cannot separate speakers.** whisper.cpp offers only
   English-only turn markers (`-tdrz`) or a stereo split. Real diarization means
   ElevenLabs. So "private" and "knows who spoke" are mutually exclusive, and the
   UI states the trade at the point of choice rather than hiding it.
2. **On-device Whisper is macOS-only** (`binaries/darwin-arm64/`, #133). Transcribe
   still ships on Windows with ElevenLabs; the registry reports the gap so the UI
   can explain it rather than the feature silently shrinking.

**Insights output contract (Sprint 113).** The sandboxed workbench sends a
validated discriminated choice: Auto, a known catalog code, or an explicitly
committed normalized custom language name. Search text never crosses the bridge.
The host resolves Auto, passes the resolved language as quoted data to the prompt,
and persists selected/resolved metadata only with a successful result.
Pre-Sprint-113 Insights retain English provenance because their prompt was
implicitly English. The separate
`workbench:createInsightsDocument` request never enters the primary transcript
save path: the host validates filename/path aliases and uses exclusive creation
for an Insights-only Markdown snapshot. It never changes transcript bytes, the
workbench link, or `session.exportPath`. Speaker labels remain ordinary Unicode
strings; normalization preserves word boundaries while the webview alone
ellipsizes long display labels.

Insights generation is a focused, self-contained runtime session rather than an
interactive coding conversation. `RuntimeSessionConfig.availableTools` controls
which built-in tools exist (`[]` removes them), while `allowedTools` continues to
mean only which exposed tools are auto-approved. `settingSources: []` prevents
the extraction from importing user/project/local Claude coding settings, and the
turn requests low thinking effort explicitly. These policies keep authentication
and cancellation on the existing Claude adapter without sharing AI-chat context
or adding another provider stack.

**Engine facts worth not rediscovering** (measured in the Phase 0 audits, see
`docs/development/sprints/sprint-108-transcription-workbench/research/`):

- whisper-cli reads mp3/wav/flac/ogg natively; only m4a/aac need `afconvert`
  (1.2 s for a 60-minute file). Nothing decodes in the webview.
- whisper-cli **exits 0 when audio exists but cannot be decoded**. Success requires
  a parseable JSON sidecar with ≥1 segment, never the exit code alone.
- 60 minutes transcribes in ~154 s (23.5× realtime) at ~2.5 GB peak RSS.
- ElevenLabs `speaker_id` is assigned **per request**, so a diarized file is never
  windowed — windowing renumbers speakers and breaks global rename.
- Webview `<audio>` + `asWebviewUri` serves range requests (seek to 45:00 in a
  42 MB file: 223 ms). The first `play()` must ride a real user gesture.

**Open debt:** live dictation (`voiceDictation/`) still has its own whisper
integration with a 30 s timeout and `--no-timestamps`, deliberately untouched by
Sprint 108. A later sprint can collapse both callers onto `speech/engines/whisperLocalEngine`
so there is one Whisper integration rather than two.

---

## Model Configuration (Single Source of Truth)

### AS IS — Model Catalog resolver (post-Sprint 89, GH #109)

The authority is the **`src/ai/modelCatalog/`** subsystem — a provenance-tracked waterfall
resolving model lists + per-surface defaults for every runtime and view:

**live provider probe → remote catalog → on-disk cache → bundled baseline** (highest-trust-that-succeeds wins).

| Layer | Source |
|---|---|
| Live | Anthropic `GET /v1/models` (primary, API-key); OpenAI `models.list()`; Gemini `/v1/models`; Codex `~/.codex/models_cache.json`; OpenCode ACP `configOptions` (deferred) |
| Remote | `feeds/model-catalog.json` in `jarmo-productory/ritemark-public` — edit to add a model with **no app release** (HTTPS + strict schema v1 + 512 KB cap + origin allowlist) |
| Cache | last good remote fetch in `globalState` (offline survival) |
| Bundled | `bundledCatalog.ts` typed baseline shipped in the VSIX (offline floor) |

Public API: `getModels(provider)`, `getModel(provider, id)`, `getDefault(provider, surface)`, `onUpdate(cb)`, `refresh()`.
Gated by the `remote-model-catalog` flag (off → bundled/cache floor only). Default Claude model: `claude-sonnet-5`.

Live runtimes may expose several request aliases for one actual model. The catalog
preserves the provider's `resolvedModel`, groups only exact equal resolved identities,
and exposes one selectable representative plus retained aliases and provider-default
metadata. Persisted aliases reconcile at this boundary; the webview never deduplicates
by label. Claude sessions receive the request id and expected resolved identity
separately, so init diagnostics compare like with like while genuine model drift still
surfaces. A provider-default row uses one accessible trailing `*` in the picker.

`src/ai/modelConfig.ts` is **retained but narrowed** — only OpenAI/Gemini image arrays,
`DEFAULT_MODELS` (image defaults), and the `ModelConfig` types remain. Deleted: `CLAUDE_MODELS`,
`DEFAULT_MODEL`, `BYOK_PROVIDER_MODELS`, `ClaudeModelOption`, `ByokProvider`/`ByokModelOption`/
`toOpenCodeModelValue`; deleted files `src/agent/claudeModels.ts` + `src/codex/codexModels.ts`.

---

## Open Architectural Debt

**Resolved in Sprint 79:**

| Item | Resolution |
|---|---|
| `@agentclientprotocol/sdk` esbuild compatibility audit | Phase 0 audit complete → `research/arch-1-esbuild-audit.md`; no bundler blocker found |
| Unified approval gate (3 incompatible message types) | Done — `UnifiedApprovalGate` + `agent-approve` unified message type |
| `document-search` zombie flag (RAG removed Sprint 74) | Done — flag status set to `'disabled'` with tombstone description |
| `CODEX_MODELS` deprecated constant | Done — deleted; `CLAUDE_MODELS` + `DEFAULT_MODEL` moved to `modelConfig.ts` |
| Codex browser tools: dynamic injection vs MCP server (two patterns) | Done — Phase B: dynamic injection moved inside `CodexRuntime`; `_codexBrowserToolsEnabledForThread` now internal |
| File attachments broken for Codex (partial) and ACP (missing) | Done — `UnifiedAttachment` type; ACP fenced-block fallback with notice |
| `UnifiedViewProvider` at 2480 LOC | Done in Sprint 79 — 2480 → 1097 LOC (target ≤ 1100). **Reopened as tracked debt by Sprint 89**: catalog wiring pushed it to 1223 LOC, back over target — see Version History 2026-07-01 entry; no dedicated extraction sprint yet |

Post-Sprint 79 items tracked as GitHub Issues:

| Issue | Item | Prerequisite |
|---|---|---|
| ~~[#105](https://github.com/ProductoryHQ/ritemark-native/issues/105)~~ ✅ | **RESOLVED Sprint 92** — extension host esbuild-bundled (2 files); node_modules retained only for the ESM SDKs + pdfkit + fsevents. Unblocks #107/#108. | Sprint 92 |
| [#106](https://github.com/ProductoryHQ/ritemark-native/issues/106) | Typed webview ↔ host protocol — `bridge.ts` is stringly-typed; renames fail silently at runtime | Sprint 79 (reduces message count 9→3 first) |
| [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107) | Webview bundle ~7.6 MB IIFE (documented as ~900 KB); no CI size budget; all surfaces loaded on every `.md` open | #105 esbuild first |
| [#108](https://github.com/ProductoryHQ/ritemark-native/issues/108) | Build-integrity gate — Gate 1 has passed 0-byte builds (v1.7.1); checks presence not integrity | #105 esbuild first |
| [#109](https://github.com/ProductoryHQ/ritemark-native/issues/109) | Model gateway — **model-resolution unified in Sprint 89** (`src/ai/modelCatalog/` resolver + publishable catalog); shared **retry + telemetry** unification still deferred | Sprint 89 (partial) |
| [#97](https://github.com/ProductoryHQ/ritemark-native/issues/97) | Cross-runtime conversation context — switching agents drops prior context; open design decision | **Decide before Sprint 80 daemon wiring** |

---

## Locked Decisions

The decisions that define the system. Changing any of these is an architecture-level change requiring Jarmo's approval and an architecture.md update.

- **VS Code as submodule, not fork** — customise via patches; keep upstream sync cheap. The brittleness of patch files is the accepted price.
- **Extension symlinked, not copied** — single source of truth in `extensions/ritemark/`; symlinked into `vscode/extensions/ritemark` at build time. Never edit the submodule copy.
- **Webview is sandboxed** — no filesystem/Node access; everything through `bridge.ts`. Never give the webview direct FS access to "simplify" things. ARCH-9 hardens this boundary; it must not dissolve it.
- **Model catalog is the single authority** — model lists + defaults resolve through `src/ai/modelCatalog/` (live provider probes → remote `ritemark-public` catalog → cache → bundled baseline), evolved from the static `modelConfig.ts` registry in Sprint 89 (GH #109). Never hardcode model ids in runtimes, views, or the webview; add models by editing the published catalog (no app release). The single-authority spirit is preserved; the mechanism is now dynamic + remotely updatable.
- **Flows are JSON + pluggable executors** — new automation capability = new node executor, not a new engine.
- **Features ON by default, gated by flags** — never delete code to disable (broke Settings in v1.3.0). Disable only via `src/features/flags.ts` and only on explicit instruction.
- **Layout invariants owned by patch 002** — sidebar, terminal, titlebar placement is contractual; enforced by `.claude/hooks/pre-commit-validator.sh`.
- **darwin-arm64 is the primary target** — Apple Silicon first; x64/Windows follow.
- **Three distinct AI execution shapes** — autonomous agent runtimes (Claude Code, Codex, ACP) vs. single-shot flow nodes are genuinely different and must stay so. Sprint 79 unifies the plumbing, not the behavior. The distinction is why `AgentRuntime.prompt()` is separate from `FlowExecutor` node execution.

---

## Sprint Architecture Gate

**Rule:** Any sprint whose implementation changes the structure of a subsystem listed in this document must update this document before the sprint is closed.

"Changes structure" means:
- Adding, removing, or renaming a module at the `src/<subsystem>/` level
- Adding a new webview↔extension message type that crosses a subsystem boundary
- Changing an interface that other subsystems depend on
- Adding or removing a feature flag that gates a named architectural feature
- Changing the binary bundling manifest or `AgentRuntimeKind` enum

**Enforcement:** The sprint-manager skill checks for this requirement. The `qa-validator` blocks merge if the sprint's technical-plan says "changes architecture" but this document's `Last updated` date is older than the sprint branch creation date.

---

## Version History

| Date | Sprint | Changes |
|---|---|---|
| 2026-08-24 | Sprint 113 | **Typed Transcribe Insights output boundary.** The sandboxed workbench sends a validated Auto/known/custom language selection through one protocol; autocomplete search remains local UI state and any explicitly committed normalized language or dialect can be used. The host records selected/resolved provenance, passes the language as quoted prompt data, preserves legacy English provenance, validates primary-path aliases and cross-platform filenames, and exclusively creates separate Insights-only Markdown snapshots. Full Unicode speaker labels remain intact through storage, prompts, and exports while webview layout alone truncates their display. |
| 2026-08-24 | Sprint 113 R7 | **Focused Insights runtime policy.** An authenticated 48-minute run exposed 3m43s latency, ~82k coding-context input/cache tokens, and 15,836 output tokens for a ~3k-character memo. The existing Claude adapter now accepts explicit available-tool and setting-source policies; Insights supplies empty lists for both, keeps `allowedTools: []` as defense in depth, and requests low turn effort. AI chat sessions and other runtime defaults remain unchanged. |
| 2026-08-24 | Sprint 112 | **Capability-driven Composer thinking effort.** One canonical Auto–Ultra contract crosses the durable conversation draft, accepted/queued turn snapshot, typed host bridge, and all three existing `AgentRuntime` adapters. Claude uses SDK effort plus warm flag updates; Codex keeps execute/plan values aligned and restores captured defaults; OpenCode remains lazy and exposes only live ACP `thought_level` choices. Requested/applied evidence stays metadata, model/UI capability is truthful, and the default-on experimental flag provides rollback without data loss. |
| 2026-08-24 | Sprint 111 | **Exact agent-runtime supply-chain baseline.** Bundled pins move atomically to Codex app-server 0.149.0, Claude Code 2.1.239 + Agent SDK 0.3.239, and OpenCode 1.18.21 + ACP SDK 1.4.0 across nine platform rows. New `validate-agent-runtime-manifest.mjs` makes platform completeness, approved exact pins, SHA/source shape, package-lock/optional-package parity, and vendor identity hard pre-fetch/QA failures; `agent-runtime-matrix.yml` adds native Intel macOS and Windows x64 PR evidence. Codex’s additive `request_user_input.isBlocking` is tolerated for bundled 0.149 and older system runtimes. No new runtime, shared interface, message contract, or feature flag. |
| 2026-08-23 | Sprint 110 | **Truthful agent conversation continuation.** `runtime/continuation.ts` adds one host-owned descriptor/compatibility/state contract across Claude SDK resume, Codex `thread/resume`, and capability-gated ACP `session/resume` (never `session/load`). `conversations/contextPack.ts` adds the shared deterministic 32 KB user/final-text fallback. Runtime-keyed opaque descriptors and append-only `not-sent → ambiguous → accepted` receipts stay out of webview projections; coverage advances only with an atomically saved assistant final. Explicit cross-runtime confirmation preserves drafts and unanswered user intent, while per-conversation execution tokens and lifecycle checks reject late old-runtime events. |
| 2026-08-23 | Sprint 109 | **Durable conversation lifecycle completed.** Records persist a stable 24-slot project color identity; hidden runtime context is separated from display prompts; UI and host share turn IDs; same-turn assistant continuations project as one response; Project unknown records can be explicitly moved/deleted/undone; running Delete+Undo and extension shutdown restore as honest Interrupted boundaries. The old webview open-thread cap/storage path is removed. A host-side five-or-one live attachment pool protects Working/Needs-you/current contexts, releases LRU non-current idle sessions, and never limits durable conversations. |
| 2026-08-23 | Sprint 109 | **Host-owned conversation titles.** New `conversations/ConversationTitlePolicy.ts` is the single fallback/generated/manual normalization authority for Claude, Codex, and OpenCode conversations. `ConversationTitleGenerator.ts` runs once after the first successful response through a fresh tool-free/read-only runtime made by `createRuntime(runtimeId)`; it never touches the live session. New exact-field `conversation/rename` lets the Conversations row dialog checkpoint a manual title, with controller-side fallback comparison ensuring a late AI result cannot overwrite user intent. Codex/ACP streamed assistant text is now included in the terminal durable checkpoint so those runtimes have the same first-response title input and restart transcript fidelity. |
| 2026-08-05 | Sprint 107 | **Clean Start (v1.8.6, #— Clean Start).** R1: patch 013 wires `branding/product.json` `configurationDefaults` into DESKTOP (`IProductConfiguration.configurationDefaults` + static `product` read in `DefaultConfiguration`; the block was previously web-only dead config) — first open of a loose `.md` lands in the Ritemark editor with trust off, no dialogs; `build-prod.sh` copies the block from branding; `apply-patches.sh` already syncs `vscode/product.json` from branding. R2: per-workspace daemon consent (see subsection above). R3: one-shot sticky-tab healer (`src/utils/stickyTabHealer.ts` pure selection + `extension.ts` globalState-guarded `vscode.openWith` reopen; named tradeoff: a deliberate per-tab Reopen-With→Text choice is lost once). R4 (welcome-card removal) shipped early on 2026-08-04. |
| 2026-08-04 | Sprint 106 | **Home launcher (v1.8.6, #74).** New Activity Bar container `ritemark-home` + `ritemark.homeView` webview (`src/views/HomeViewProvider.ts`, self-contained HTML — no webview-bundle dependency). Reuses existing commands only (`ritemark.newDocument`/`newChat`/`newTable`, workbench open file/folder) behind a fixed allow-list; recents = workspace .md mtimes (no new persistence). Flag `home-launcher` (experimental; ON via `ritemark.features.home-launcher` default). Two gotchas codified: a when-clause cannot reference hyphenated config keys (sole-view containers then vanish via `hideIfEmpty`), and experimental flags are OFF unless package.json contributes a config default. First-position pinning added to patch 002 on Jarmo's explicit order (2026-08-04): `ritemark-home` gets `effectiveOrder` −1 in `viewsExtensionPoint.ts`, placing it before the built-in Explorer — shell-tier, rides the Sprint 107 shell release. Design pass replaced placeholder unicode glyphs with inline Phosphor-style SVG icons. Folderless parity (2026-08-05): the no-folder state renders the same launcher; recents come from `_workbench.getRecentlyOpened` (recent FOLDERS) and a new `open-recent-folder` webview→host message opens one via `vscode.openFolder`; "New AI task" stays folder-gated. |
| 2026-08-04 | Sprint 105 | **Comments Command Center (v1.8.6, #164/#165).** New shared `webview …/extensions/comment/commentIndex.ts` — the single ID-deduplicated document comment index (badge, overview, dispatch payloads; rail identity rules preserved). Toolbar `CommentsMenuButton` (DocumentHeader `commentsSlot`, gated by `comment-callouts`) with overview + per-agent confirmation; bulk dispatch = one ordered task per agent via `comment:send-to-ai` → Sprint 104 queue. Message contract additions: `comment:send-to-ai` gains `commentIds`, host attaches `documentPath` (editor URI, workspace-relative); `comment:submit` passes both onto the QueueItem; NEW sidebar→host `comment:task-status` relayed via `RitemarkEditorProvider.broadcastCommentTaskStatus` to all editor webviews; editor-side `commentTaskStatus.ts` registry feeds margin-marker status dots (queued/running/done/failed, `cleared` on user removal). Status reflects queue/turn facts only. |
| 2026-08-04 | Sprint 104 | **Bounded multi-prompt queue (v1.8.6, #162).** `composerQueues` one-string slots replaced by `promptQueues: Record<conversationId, QueueItem[]>` (cap 10; new `webview …/promptQueue.ts` pure model). Items freeze target conversation/runtime/policy/prompt/attachments at enqueue. Dispatch moved from a ChatInput render effect to store-level `maybeDrainQueue` triggered on turn results and card resolutions, gated on `deriveActivityState` (`idle`/`done` only; failed/cancelled pause for explicit Resume) — background threads now drain. `comment:submit` no longer retargets the active thread or calls send directly: it resolves a stable conversation for the assigned runtime (idle match → busy match → new background thread) and enqueues. New `QueuePanel` UI (edit/remove/reorder/retry, full + paused states). No host-protocol change — `agent-execute` already carried the payload. |
| 2026-08-04 | Sprint 103 | **Truthful agent plans + activity state (v1.8.6, #132/#161).** Three-mode `Auto·Ask·Plan` strip replaced by two axes: autonomy (`auto`/`ask`, UI Manual/Auto) + `planFirst` chip. Claude: `bypassPermissions`/`allowDangerouslySkipPermissions` removed from every session (bypass availability disabled native plan enforcement); Auto → `acceptEdits`+canUseTool auto-allow, Plan → native `permissionMode:'plan'` + `planModeInstructions`; `ExitPlanMode` excluded from `allowedTools` (bare allow-names never reach `canUseTool`); plan approval returns `updatedPermissions setMode`; autonomy switches via live `setPermissionMode` (no session rebuild; rebuilds announced via `session_reset`). Codex: plan turns on read-only sandbox threads, continuation on write sandbox. Prompt-text mode sniffing deleted (D4); model-initiated planning surfaced via `plan_autonomous`. New `runtime/capabilities.ts` registry gates the Plan chip (hidden for OpenCode). New `activityState.ts` + `ActivityStatusLine` = single status source shared with the thread rail; metrics gain `waitedMs`; `filesModified` workspace-filtered. Evidence: `docs/development/releases/v1.8.6/sprint-103-agent-truth/research/` (live audit + SDK spike + CDP matrix `scripts/qa/plan-truth-matrix.sh`). |
| 2026-07-22 | Sprint 99 | **Parallel agent chats, v1.8.5.** `AgentRuntime.start()/prompt()/cancel()` replaced by `createSession(conversationId, config)` → `RuntimeSession`; one adapter per runtime KIND minting one session per conversation. `getStatus()` stays adapter-level. All three adapters hold session maps: Codex keeps one shared app-server process and one listener registration, routing by `params.threadId`; OpenCode runs N ACP sessions in ONE subprocess (spike-measured 339 MB for 5 sessions vs 1291 MB for 5 processes); Claude holds one `AgentSession` each — the audit found `AgentRunner` has no module-level singleton, so it was already a clean per-conversation unit. Webview store keyed by conversation with routing by `conversationId` and unknown ids DROPPED rather than misrouted. New thread rail (right edge, "+"/History pinned, one shared Phosphor `robot` tinted per runtime, one status slot where amber attention overrides the running spinner). Browser tools serialized across conversations — one browser, one active tab; per-chat browsers are shell-tier and out of scope. Three latent defects fixed: Codex scalar `_threadApprovalKey`/`_browserToolsEnabledForThread` silently destroying a sibling's thread context, `AcpRuntime._recentlyPermissionedWrites` as a cross-chat approval bypass, and `AgentSession`'s single-slot pending approvals overwriting each other (a live bug on ONE conversation). Also fixed in dev-validation: New Chat disposed every conversation's session, leaving a visible transcript whose agent had forgotten it. Touches #95/#97/#140 without resolving them. |
| 2026-07-21 | Sprint 98 | **Safe extension-update lane (GH #142), v1.8.5.** Two structural changes after the 1.8.3-ext.1 incident, where an update shipped a delta-only package and the extension died at module load (`require('pdfkit')`) before `activate()` — taking every extension-side recovery path down with it. (1) **Patch 012 (shell watchdog)** hooks `mainThreadExtensionService.$onExtensionActivationError` — verified to receive module-load throws — and renames the failing USER-dir copy of `ritemark.ritemark` so the scanner marks it invalid and filters it out, then prompts a reload onto the bundled built-in. Scoped by extension id + `extensionLocation` matching an `ExtensionType.User` install; gating on `isBuiltin` would be wrong because `dedupExtensions` rewrites it to `true` on a winning user copy. Inserted before the `isDev` early-return, which would otherwise skip it in production. (2) **`applyUpdate` is now clone-then-overlay**: it clones the bundled built-in extension (resolved from `vscode.env.appRoot`, never `getExtension().extensionPath` — that returns the user copy and would perpetuate corruption) and overlays the manifest delta, so an incomplete manifest degrades to stale files instead of an unloadable extension. Adds installer-layer `minimumAppVersion` enforcement, manifest path containment at both validation and write time, `UpdateFile.op: 'write' \| 'delete'` (deletions only became expressible once absent started meaning "inherited"), a validity probe so a broken install no longer short-circuits a corrected re-release, and `applyUpdate.test.ts` closing that function's previous zero coverage. Also: publish-side completeness + install-and-activate guards, and a `ritemark.updates.channel` canary ring. **Lane stays CLOSED until the watchdog ships and one trivial ext update passes end-to-end.** |
| 2026-07-12 | Sprint 93 | `src/update/` gains two modules: `updateStatusBar.ts` ("Relaunch to update" status-bar affordance) and `activationIntegrity.ts` (N-1 rollback + activation-crash quarantine). New `ritemark.updates.mode` setting (`auto`/`prompt`) governs silent vs. prompted extension-tier updates; full-app updates unaffected. `release-extension.sh` (renamed from `create-extension-release.sh`) + new `release-extension-preflight.sh` are the one-command extension-release path, gated by the new shell/extension release-tier rule (`CLAUDE.md` "Release Tiers"). |
| 2026-06-06 | Baseline | Initial document (agent runtime scope). Captures AS IS post-Sprint 78: 3 runtimes, 2 browser integration patterns, 3 model config locations. Defines TO BE for Sprint 79 (runtime adapter unification). |
| 2026-06-06 | Pre-Sprint 79 | Expanded to full system scope. Added: system layers overview, webview↔host protocol, flows architecture, build pipeline (with ARCH-8 and ARCH-10 observations), broader TO BE roadmap (ARCH-8 through ARCH-13), locked decisions. Reconciled with `docs-internal/architecture/` (high-level-architecture.md + to-be-proposal.md). |
| 2026-06-08 | Sprint 79 | Runtime unification: `src/runtime/` added (AgentRuntime, RuntimeRegistry, UnifiedApprovalGate, BrowserToolsInjector); ClaudeCodeRuntime/CodexRuntime/AcpRuntime adapters; `UnifiedViewProvider` 2480→1097 LOC; unified `agent-execute`/`agent-cancel`/`agent-approve` webview messages; browser IPC server + `browserMcpAdapter.ts` for ACP browser injection via Unix socket; `AgentDaemon` foundation (inactive); `CLAUDE_MODELS`/`DEFAULT_MODEL` moved to `modelConfig.ts`; `CODEX_MODELS` deleted; `document-search` flag disabled; ARCH-2/3/4/5 resolved. |
| 2026-06-08 | Sprint 79 (close) | Integration-test hardening: unified approval **policy** (Auto/Ask/Plan `approvalMode`) across all 3 runtimes; restored per-turn context dropped in the dispatch migration (active file, browser context, @mentions, Codex approval-policy/sandbox + plan toggle, Claude api-key/excludedFolders/timeout, `onExit`, Codex base-instruction clobber); fixed Claude warm-session reuse (was recreated every turn → lost memory); "Always allow" removed from the approval card; OpenCode model picker auto-default + BYOK env wiring. |
| 2026-06-08 | Pre-Sprint 80 | Generalized the daemon from agent-specific (`AgentDaemon`/`DaemonSession`) to a handler-agnostic `Scheduler` + `ScheduledTask` interface with pluggable handlers (`AgentTaskHandler` in Sprint 80; `GitSyncHandler`/`ScriptHandler` interface-only). Scheduler no longer depends on `AgentRuntime`; the agent handler is the adapter that bridges them. |
| 2026-06-10 | Sprint 82 | Draw.io diagram embedding (GH#111): `drawioEditorProvider.ts` added to [editors] — `CustomTextEditorProvider` for `*.drawio.svg` hosting the vendored draw.io v30.0.4 webapp subset (`media/drawio/`, 36 MB, Apache 2.0 incl. LICENSE/NOTICE, committed to git); clean-room bridge over the draw.io embed JSON protocol. `/diagram` slash command creates `images/diagram[-N].drawio.svg` and reuses the `imageSaved` insertion flow; `.drawio.svg` images in TipTap are double-click-to-edit. New `drawio-diagrams` flag (stable, kill-switch). `scripts/vendor-drawio.sh` re-vendors the bundle. The drawio bundle is NOT part of `media/webview.js` (no impact on GH#107). |
| 2026-06-12 | Sprint 82 (QA close) | Draw.io hosting rearchitected after manual QA found the editor blank: the app runs DIRECTLY in the webview document (patched `index.html` + `<base>` + CSP), NOT in an iframe — desktop VS Code serves vscode-resource requests only for the webview document itself (iframe navigations unserved; srcdoc clients 404 — the SW authorizes by client URL). draw.io's embed-protocol partner is a hidden same-origin relay iframe (`window.opener` → relay; its `initializeEmbedMode` rejects a self-window partner). Diagrams AUTOSAVE (debounced `autosave` event → export→save chain) matching markdown UX; markdown embeds live-refresh via an image watcher + `imageRefreshed` (cache-busted, surgical node-src swap); `/diagram` insert waits for the webview's `imageInserted` ack before opening the editor (focus-steal + externalChange reload wiped the insert). |
| 2026-07-01 | Sprint 89 | **Model Gateway (GH #109, model-resolution part).** New `src/ai/modelCatalog/` subsystem: provenance-tracked waterfall (live provider probe → remote `ritemark-public` catalog → `globalState` cache → bundled `bundledCatalog.ts` floor). Anthropic `GET /v1/models` is the primary live Claude source (supersedes the bundled SDK `supportedModels()`, which is capped at the CLI version). Publishable `feeds/model-catalog.json` adds a model with **no app release** (HTTPS + schema v1 + 512 KB cap + origin allowlist; pinned-key signature deferred). Deleted zombies `CLAUDE_MODELS`/`DEFAULT_MODEL`/`BYOK_PROVIDER_MODELS` + files `claudeModels.ts`/`codexModels.ts`. Consumers (UnifiedViewProvider, FlowEditorProvider, LLMNodeExecutor, extension.ts, webview store) rewired to `modelCatalog.*`; persisted-stale selection reconciled against the resolved list. New `remote-model-catalog` flag (stable). Default Claude model `claude-sonnet-5`. UnifiedViewProvider 1267→1223 LOC (pre-existing >1100 debt, reduced not increased). Retry/telemetry unification (rest of #109) deferred. |
| 2026-07-08 | Sprint 92 | **Extension host esbuild bundling (GH #105), v1.8.2.** `tsc -p ./` (emit) replaced by `tsc --noEmit` (typecheck) + `esbuild.config.mjs` (emit). The ~130 loose `out/*.js` files collapse to two self-contained bundles: `out/extension.js` (~5 MB, first-party + inlined pure-JS deps) and the standalone `out/browser/browserMcpAdapter.js` subprocess. `external`: `vscode`, `fsevents`, `pdfkit`, and (invisibly, via `new Function` import) the two ESM agent SDKs — so `node_modules` is retained but massively reduced in relevance. Fixed two `__dirname`-depth path landmines (`bundledAgentRuntime.ts`, `BrowserToolsInjector.ts`) that assumed the old multi-level `out/` tree. Closes the Windows EMFILE class + the 0-byte tsc trap. New "bundle-safe extension code" rule added to the `vscode-development` skill. Unblocks #107/#108. |
| 2026-07-08 | Sprint 90 | **Export Integrity (GH #127, #76), shipped in v1.8.1.** Fail-safe image export: the single chokepoint `export/v2/imageSource.ts` now returns `null` (skip) for SVG bytes and encoder-undecodable data-URLs (GIF/BMP/TIFF for pdfkit), and the IMG case in `pdfHtmlExporter.ts`/`wordHtmlExporter.ts` is wrapped in per-node try/catch — one bad image can no longer abort a whole export. SVG/draw.io rendering: new webview `lib/svgRasterExport.ts` (`inlineSvgImagesForExport` + shared `rasterizeSvgToPngDataUrl`, extracted from the mermaid path) rasterizes inline + file-referenced `.svg`/`.drawio.svg` to PNG via `<canvas>` before the HTML is posted to the host — **no new native dependency**. Atomic `saveAsMarkdown`: tracks only newly-created image paths and unlinks exactly those on failure. Shared `parseImageDataUrl` in `imageWriter.ts` accepts the compound `svg+xml` subtype (fixes `/image` SVG insert). Planned `export-svg-rasterization` flag dropped (webview flags not plumbed; graceful-skip already provides the safety). |

**Sprint 89 architecture-gate decision memo (2026-07-01, approved by Jarmo):** the Sprint 79 locked decision "Model IDs centralised in `modelConfig.ts`" is evolved — the single authority is now `src/ai/modelCatalog/` (resolver + remote catalog), not a static array. The single-place-to-look spirit is preserved; the mechanism is now dynamic and remotely updatable. Remote-catalog host: `jarmo-productory/ritemark-public`. Trust model v1: HTTPS + strict schema v1 + 512 KB cap + origin allowlist; pinned-key signature deferred to a follow-up issue.

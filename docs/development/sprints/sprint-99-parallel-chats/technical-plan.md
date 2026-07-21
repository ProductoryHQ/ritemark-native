# Sprint 99 — Technical Plan

Derived from [`spec.md`](spec.md) (R1–R15), [`scenarios.md`](scenarios.md), and the Jarmo-approved
[`design.md`](design.md). Grounded in the Phase-1/2 singleton audit; every `path:line` below was
verified against the tree at branch `sprint-99-parallel-chats`.

---

## 1. The core change: sessions become objects

`AgentRuntime` (`src/runtime/AgentRuntime.ts:12-26`) has no session handle, and `RuntimeRegistry`
(`src/runtime/RuntimeRegistry.ts:5`) holds one adapter per runtime *kind*. The concrete failure is at
`src/views/UnifiedViewProvider.ts:361-362`: **`runtime.start(sessionConfig)` runs on EVERY execute**
against that shared adapter, so a second chat overwrites the first chat's callbacks.

```ts
// BEFORE                                  // AFTER
interface AgentRuntime {                   interface AgentRuntime {
  start(config): Promise<void>;              createSession(config): Promise<RuntimeSession>;
  prompt(turn): Promise<void>;               getStatus(): Promise<RuntimeStatus>;   // adapter-level
  cancel(): Promise<void>;                   dispose(): void;                        // all sessions
  respondToApproval(...): void;            }
  getStatus(): Promise<RuntimeStatus>;
  dispose(): void;                         interface RuntimeSession {
}                                            readonly conversationId: string;
                                             prompt(turn): Promise<void>;
                                             cancel(): Promise<void>;
                                             respondToApproval(...): void;
                                             dispose(): void;
                                           }
```

**Why an object rather than an id parameter on every method.** `RuntimeSessionConfig`
(`AgentRuntime.ts:28-72`) already carries the per-turn callbacks, and they are already built
per-execute closing over `agentId` (`UnifiedViewProvider.ts:292-350`). A session object lets those
same closures capture `conversationId` — no id parameter threaded through ten callback signatures,
and no chance of a callback firing against the wrong conversation because it *cannot* see another.
It also maps 1:1 onto each runtime's own concept: a Codex thread, a Claude `AgentSession`, an ACP
session.

`getStatus()` deliberately stays adapter-level (see spec R1): it reports on the binary and auth,
which are properties of the installed runtime, not of a conversation.

**Session ownership.** `UnifiedViewProvider` keeps `Map<conversationId, Map<AgentId, RuntimeSession>>`
— a conversation is bound to one runtime at a time, but switching runtime inside a conversation must
not destroy the other conversations' sessions. `RuntimeRegistry` is unchanged: still one adapter per
kind. Per-chat adapter instances via `runtimeFactory.ts:23` are the ACP fallback only (§4).

---

## 2. Recorded decisions

### D1 — ACP concurrency model: multi-session in ONE subprocess (option a), gated on a Phase-0 spike

The plan required this to be decided and recorded rather than defaulted.

Evidence: `@agentclientprotocol/sdk@0.22.1` is multi-session clean — `Connection.sendRequest` mints a
JSON-RPC id and resolves through `pendingResponses` (`dist/acp.js:1211-1217`), and the read loop
calls `processMessage` **without awaiting** (`:1067`), so a slow permission handler cannot head-of-line
block another session's `session/update`. `AcpClient` is already fully session-parameterized —
`prompt(sessionId, …)` (`acpClient.ts:154`), `cancel(sessionId)` (`:189`). The single-session
assumption lives entirely in Ritemark's `acpManager.ts`.

Chosen (a) because option (b) means five separate Bun processes plus five more `browserMcpAdapter`
Node subprocesses at the design's 5-thread cap — a user-visible resource regression in a markdown
editor — and five cold starts. (The spike below measured the real cost: **1291 MB vs 339 MB**.)
Option (a) also gives all three runtimes the same shape, which matters for R1.

**SPIKE RESULT (2026-07-21): D1 SURVIVES — decision confirmed, not provisional.**

*Q1 — concurrency.* One process, two sessions, two `session/prompt` calls in the same tick, with
real model-backed turns (OpenCode Zen free models are the zero-config default, so no BYOK key was
needed). Streaming windows overlapped 1795–2228 ms with 33–36 alternation blocks. A control run
using two SEPARATE processes overlapped 2396–2632 ms with 15–27 blocks — **shared alternated more
finely than split**. One process is not a concurrency bottleneck. Five `session/new` calls on one
connection all returned distinct `ses_…` ids, and every `session/update` carried `params.sessionId`
(the field `acpManager.ts:225` currently ignores).

*Q2 — memory, and the plan's estimate was wrong in option (b)'s favour.* Measured idle RSS:

| topology | RSS |
|---|---|
| 1 process / 5 sessions (option a) | **339 MB** |
| 5 processes / 1 session (option b) | **1291 MB** (203–284 MB each) |

Marginal cost of a session inside one process is ~1 MB. The 104 MB figure previously cited here is
the *binary size*; real per-process idle RSS is 203–284 MB, so option (b) at the 5-thread cap costs
**~1.3 GB before** the five extra `browserMcpAdapter` Node subprocesses. This makes (a) a much
stronger choice than when the decision was first taken.

*Known false alarm for QA.* One early run serialized strictly, with first-token latency climbing
7.5 s → 12.4 s → 19.0 s. The split-process control reproduced the same profile, so it was upstream
free-tier throttling, not a client-side lock. **Under provider throttling, parallel ACP chats will
legitimately appear to queue with no bug present** — recorded in `scenarios.md` so QA does not read
it as a serialization regression.

*Q3 — `session/cancel` is still unimplemented on 1.15.13,* returning
`-32601 "Method not found": session/cancel`, and it is a genuine no-op: after cancel the turn kept
streaming and settled `end_turn`, not `cancelled`.

**The spike also found a bug that promotes C3 from cleanup to hard blocker.** In SDK 0.22.1
`Connection.cancel` is a **notification**, not a request (`dist/acp.js:838-840` →
`sendNotification`). So `acpClient.ts:189-201`'s `try/catch` **can never observe the -32601** — the
error surfaces only on the agent's stderr. The catch is dead code and `killProcess('SIGTERM')`
(`:202`) therefore fires **unconditionally on every cancel**, not as a fallback. With one chat that
matches the documented intent; under D1 it is an unconditional kill of every chat. See C3.

### D2 — One shared browser for all chats, with serialized tool access

Every browser tool is a `vscode.commands.executeCommand` against **the active tab**
(`src/browser/BrowserActionTools.ts:19-24`), and `BrowserContextStore` is a process singleton
(`UnifiedViewProvider.ts:227`). So the browser is global regardless of how the MCP server object is
scoped.

Per-chat browsers would need per-chat tab ownership in the workbench browser — **shell-tier**, and out
of this sprint's extension-tier scope. Sprint 99 therefore keeps one shared browser and adds a mutex
around the `executeCommand` calls in `BrowserActionTools.ts`, so two chats cannot interleave a
navigate and a snapshot into each other. The remaining limitation — chat B's snapshot may show the
page chat A navigated to — is documented in `scenarios.md` as a known trade-off, not a bug.

*Jarmo can override this one:* if per-chat browsers matter more than staying extension-tier, it
becomes a separate shell-tier sprint.

---

## 3. Workstream A — Claude Code (`src/agent/`)

The audit's headline: **`AgentRunner.ts` has no module-level singleton blocking multi-session.** The
only file-scope mutable is `let queryFn` (`:35`), a benign idempotent ESM-import cache. `AgentSession`
is already a clean per-conversation unit — every turn field is an instance field. The sprint-plan
risk "AgentRunner may hide more singleton state" is **closed as not confirmed.**

**A1 — Fix a live bug first (do this before any multi-session work).** Three single-slot pending
fields — `_pendingQuestion` (`:433`), `_pendingPlanApproval` (`:438`), `_pendingToolApproval` (`:443`)
— are assigned bare at `:1064`, `:1073`, `:1112` with no check for an existing occupant. When the
model emits two `tool_use` blocks in one message (two `Write`s in Ask mode), the second assignment
orphans the first promise: **that tool call hangs forever** until the 15-minute inactivity timeout at
`:690`. This happens today, with one chat. Replace all three with `Map<toolUseId, {resolve, reject}>`.
`toolUseId` is Anthropic's server-minted `toolu_…`, globally unique, so it is already a safe key —
the defect is scalar-vs-map, not the key. Touches `:433-448`, `:709-724`, `:729-775`, `:1060-1179`.
Ship with a regression test that drives two concurrent `canUseTool` calls.

**A2 — `conversationId` into `AgentSessionConfig`,** so emitted `AgentQuestion` /
`AgentToolApprovalRequest` / `AgentPlanApprovalRequest` carry attribution. Today they carry only
`toolUseId` and `ClaudeCodeRuntime.ts:121-146` maps that straight to `UnifiedApprovalRequest.requestId`
— the provider genuinely cannot tell which chat an approval belongs to. Prerequisite for R7.

**A3 — `ClaudeCodeRuntime` → `Map<conversationId, AgentSession>`.** Replace `_session` (`:37`),
`_pendingQuestions` (`:40-53`), `_activeModel`/`_activeAskMode`. **Delete the reuse shortcut at
`:77-97`**: it keys on model + ask-mode only and would happily hand conversation B the session
belonging to A. Session reuse is now strictly per-conversation; crossing the Ask boundary still
recreates that conversation's session (architecture.md:207-209), nothing else.

---

## 4. Workstream B — Codex (`src/codex/`)

Cheapest win: the app-server protocol is natively multi-thread (`thread/start` returns an id;
`turn/start`/`turn/interrupt` take `threadId` — `codexAppServer.ts:142,182,211`) and `rpc()`
(`:278-355`) has no mutex, queue, or in-flight guard, so concurrent turns on different threads are
already possible. The adapter collapses it.

**B1 — Scalars that silently destroy another chat's context (highest-severity item in the sprint).**
`_browserToolsEnabledForThread` (`:104`) and `_threadApprovalKey` (`:111`) are compared at `:237` and
`:245`, and a mismatch nulls `_threadId` at `:242-243` / `:250-251`. With N threads that means:
**chat B toggling browser control, or switching Auto→Ask, destroys chat A's entire thread context.**
Data loss, silent. Both become `Map<conversationId, …>`.

**B2 — `_threadId`/`_turnId` (`:94-95`) → maps;** `resetSession()` (`:124`) and `dispose()` (`:371-373`)
become per-conversation. `turn/completed` (`:443`) must clear only its own thread's turn id — it
currently destructures `threadId` and discards it, so thread B completing clears thread A's
`_turnId`, which makes A's subsequent `cancel()` silently no-op (`:331` requires both non-null).

**B3 — Event routing.** `_setupEventListeners()` (`:398-538`) registers listeners **once** — keep that
(one process, one listener set; per-thread registration would multiply listeners on one emitter).
Change the *destination lookup* inside each callback from `this._sessionConfig` (`:404,432,445,469`)
to `configFor(params.threadId)`. Three handlers must **start destructuring `threadId`, which they do
not today**: `item/agentMessage/delta` (`:414`, the main streaming path), `item/completed` (`:431`),
`item/plan/delta` (`:418`). `codexApproval.ts:22-49` must propagate `threadId` out of
`ApprovalRouteResult`.

**B4 — The one genuinely unroutable event.** `progress` (`codexAppServer.ts:303`) is synthetic and
client-side — fired by `rpc()`'s `progressAfterMs` timer, carrying only a method name and message. It
correlates to a `pendingRequests` id (`:289`), so thread a conversation id through `rpc()`'s options.
Everything else on the wire carries `threadId`. `exit` and the `account/*` events are correctly
global; `exit` must fan out to every conversation, not just `this._sessionConfig` (`:462`).

**B5 — `_requestIdMap` (`:117`) needs no re-keying** — `codex-${request.id}` uses the app-server's
connection-wide JSON-RPC id, unique across threads. Add a parallel `Map<requestId, conversationId>`
for R7 attribution and for rejecting a thread's outstanding approvals on close; make the clears at
`:373`/`:461` per-conversation.

**B6 — Stale types.** `codexProtocol.ts:247,261` declare `conversationId` on the approval params, but
the real wire sends `threadId`/`turnId` (proven by the recorded fixtures at `codexApproval.test.ts:24-30`).
Correct them — they will otherwise mislead whoever implements B3.

---

## 5. Workstream C — ACP / OpenCode (`src/acp/`)

Per D1, multi-session in one subprocess. `AcpClient` needs no structural change.

**C1 — SAFETY, do this first.** `AcpRuntime._recentlyPermissionedWrites` (`:63`) is a process-wide
`Set<filePath>` consulted at `:269-272`. Under multi-session that is a **cross-chat approval bypass**:
chat A approving a write to `foo.md` silently auto-allows chat B's write to the same path. Key it per
session. This is the OpenCode permission-gate invariant from
[[project_opencode_acp_approval_gate]] — treat any regression here as a release blocker.

**C2 — `acpManager.ts` per-session state.** `sessionId` (`:62`) → map; `sawContentThisTurn` (`:179`)
→ per-session (otherwise B's streamed text suppresses A's legitimate empty-turn "no API key" error —
the failure most likely to be reported as "OpenCode silently does nothing"); `thoughtBuffer` (`:186`)
→ per-session (otherwise two sessions' reasoning interleaves into one garbled stream);
`handleSessionUpdate` (`:225`) must read and route on `params.sessionId`, which it currently ignores
entirely; drop the "already running" throw (`:82-84`); `cancel()` (`:161-167`) and `handleExit()`
(`:272-280`) must stop nuking global state.

**C3 — Cancel (HARD BLOCKER — must land before any multi-session ACP wiring).** The spike proved
`killProcess('SIGTERM')` at `acpClient.ts:202` is unconditional, not a fallback. Left alone, the
first cancel in any chat kills every other OpenCode chat. Delete the kill and correct the misleading
comment at `:180-188` (it claims the -32601 is caught; it cannot be).

That leaves 1.15.13 with no working cancel, so cancel must degrade honestly rather than either
killing everyone or silently doing nothing:

- Send the protocol cancel notification anyway (harmless, and correct for any agent that implements it).
- If this is the **only** live ACP session, keep today's behaviour and kill the process — nothing else
  is harmed and the user gets a real cancel.
- If **other** ACP sessions are live, do not kill. Mark the session cancel-requested and discard its
  updates until it settles; from the user's side the chat returns to idle immediately, and the
  wasted upstream work is invisible.

Marked `// Sprint 100: re-check against 1.18.1` — if the bumped binary implements `session/cancel`,
this collapses to a real per-session cancel and the special-casing goes away.

**C4 — IPC.** `BrowserIpcServer` already builds a per-instance socket path from
`crypto.randomUUID()` (`AcpRuntime.ts:86-91`, `BrowserIpcServer.ts:38-43`) — option (b) would get
isolation free. Under (a), all sessions share one socket and therefore one browser-tool channel,
which is consistent with D2. `_approvalSeq` (`:52`) is unique per `AcpRuntime` instance, fine under
(a); under (b) it would need an instance nonce.

---

## 6. Workstream D — extension host plumbing (`src/views/UnifiedViewProvider.ts`)

**D1 — Ten conversation-blind outbound message types** must gain `conversationId` (`:295-350`):
`agent-progress`, `codex-streaming`, `codex-progress`, `agent-result`, `agent-question`,
`codex-result`, `codex-plan-text-delta`, `codex-plan-update`, `codex-question`, `codex-rpc-progress`.
Inbound: `agent-execute`, `agent-cancel`, `agent-approve` carry it too.

**D2 — Two handlers the sprint plan did not list.** `agent-answer-question` (`:381-385`) hardcodes
`registry.get('claude-code')` and routes by `toolUseId` alone — once A1's pending map is per-session
it must resolve *which* session owns that id. `agent-approve` (`:387-395`) calls **both**
`_approvalGate.respond()` and `rt.respondToApproval()` — two stores keyed by the same string, neither
carrying conversation identity; both need attribution and must not drift.

**D3 — `_activeAbortController` (`:76`) is currently dead code** — aborted at `:158-160`, never
assigned anywhere in the file. Its replacement must be an actually-populated
`Map<conversationId, AbortController>`, not just a mapped version of a vestigial field.

**D4 — `_resetProviderSessions()` (`:861`) → per-conversation.**

**D5 — Intentionally global; document so a later reviewer does not "fix" them.**
`_documentContent`/`_currentSelection` (`:77-78`, one active editor regardless of chat count),
`_annotationScreenshotCache` (`:89`, keyed by URL, caches the one browser),
login/status/secrets/browser-poll singletons (`:80-92`), `src/ai/connectivity.ts:12-14`,
`apiKeyManager`'s singleton, `CodexManager.compatibilityCache` (keyed by binary path).

**D6 — `UnifiedApprovalGate` (`:16`)** keying is already correct (`Map` by `requestId`); it needs
`conversationId` on the request so the webview can route the card. No re-keying.

---

## 7. Workstream E — webview (`webview/src/components/ai-sidebar/`)

**E1 — Store reshape (`store.ts:151-308`).** `agentConversation` (`:178`), `codexConversation`
(`:185`), `currentConversationId` (`:201`) and global `isStreaming` (`:173`) collapse into
`Map<conversationId, ConversationState>` + `activeConversationId`. Turn types (`types.ts:191,292`)
gain `conversationId`.

**E2 — Inbound dispatch (`store.ts:~1200-1804`)** routes by `conversationId` instead of appending to
the tail of the single array. An unknown id is **dropped with a warning, never misrouted** (R5).

**E3 — Send guards per-conversation:** `store.ts:422,744,812` and `ChatInput.tsx:223-224,273,1257`.

**E4 — `resetProviderSessions()` (`:56-57`) must stop firing on switch** (`:1034,1127,1157`) — that
teardown is what makes switching destructive today.

**E5 — Composer queue (`composerQueue.ts`) becomes per-conversation.** Queue semantics themselves are
unchanged — redesigning them is #95, explicitly out of scope.

**E6 — The rail.** New component per `design.md` §3–5: right edge, messages-area only (never over the
composer), "+" pinned top / History pinned bottom, no dividers, active = indigo pill only, one
Phosphor `robot` tinted per runtime, one status slot per icon with amber overriding spinner.
`ChatHistoryPanel.tsx` becomes an archive+reopen surface rather than load-one-destroy-current.

**E7 — Persistence (`chatHistoryStorage.ts:207-233`)** is already conversation-id keyed. Add the set
of OPEN thread ids per workspace (R13).

---

## 8. Phasing

| Phase | Content | Gate |
|---|---|---|
| **0** | ~~ACP concurrency spike + RSS measurement (D1)~~ **DONE — D1 confirmed.** ~~Fix A1 (live pending-approval bug)~~ **DONE.** Remaining: C3 cancel fix, promoted to blocker by the spike. | ✅ Spike recorded in §2 D1; A1 shipped with a regression test |
| **1** | R1 interface (`createSession`/`RuntimeSession`) + E1/E2 store reshape + D1 message protocol, landed together | Two chats visibly coexist with ONE runtime wired (Codex) |
| **2** | Workstream B (Codex) complete, incl. B1 data-loss fix | Scenario suite for Codex×Codex concurrency green |
| **3** | Workstream A (Claude) — A2, A3 | Claude×Claude and Claude×Codex green |
| **4** | Workstream C (ACP) — C1 safety first | OpenCode approval-isolation scenarios green |
| **5** | E6 rail + E5 queue + D2 browser mutex + R13 persistence | Full scenario suite; dev-mode self-validation |

Phase 1 lands the interface and the store together deliberately: doing the interface alone leaves
nothing observable, and doing the store alone has nothing to drive it. From Phase 2 on, each runtime
is independently demoable.

## 9. Feature flag

`parallelChats` (R15), default ON, code-level kill-switch only (Settings has no flag UI —
[[project_feature_flags_no_ui]]). Flag OFF collapses to the most-recently-active conversation; the
others stay in History (spec §6).

**Phase-1 finding — the flag does not yet gate anything user-visible.** There is no generic flag
channel to the AI-sidebar webview. Individual flags reach it as bespoke booleans inside the
`agent:config` message (`agenticEnabled`, `codexEnabled`, `opencodeEnabled`); Flows has its own
separate `flow:featureFlags` message. `parallelChats` is registered and readable host-side, but the
webview cannot currently read it, and the Phase-1 agent correctly declined to invent plumbing for it.

Since parallel chats are overwhelmingly a webview-side behaviour, the kill-switch is not real until
this is closed. **Decision needed before Phase 5** (recorded here so it is not discovered at sprint
end): either add a `parallelChats` boolean to `agent:config` — cheapest, consistent with the three
flags already carried there — or introduce a general flags message for the sidebar, which is the
better shape but is scope this sprint did not plan for. Default recommendation: the `agent:config`
boolean, and note the general channel as follow-up debt in `architecture.md`.

## 10. Sprint 100 coordination

Every version-keyed workaround carries a grep-able `// Sprint 100: re-check against <version>`
marker. Known at plan time: ACP `session/cancel` `-32601` (C3), ACP model selection via
`setSessionConfigOption`, and Claude's `Map<conversationId, AgentSession>` design, which must be
re-verified against the 2.1.210 + bumped-SDK tuple. Sprint 100's compatibility matrix gains a
parallel-sessions row per runtime.

---

*Derived from [`spec.md`](spec.md), [`scenarios.md`](scenarios.md) and the Jarmo-approved
[`design.md`](design.md) (2026-07-21), plus the Phase-1/2 singleton audit.*

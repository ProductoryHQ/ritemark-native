# Sprint 99 Spec — Parallel Agent Chats

## Purpose

Let a user run several agent conversations at once in the AI sidebar — potentially across different runtimes (Claude, Codex, OpenCode) — and switch between them instantly without stopping, resetting, or losing any of them. Each thread keeps its own agent session, its own streaming output, its own approval flow, and its own composer state. A slim **thread rail** on the right edge of the sidebar is the single home for creating, switching, watching, and closing threads.

This spec is the behaviour contract for Sprint 99 implementation. If implementation reveals the spec is wrong, update the spec before changing code.

**Authoritative UX source:** [`design.md`](design.md), approved by Jarmo 2026-07-21. Every decision recorded there is final and must not be re-litigated during implementation. Where this spec's wording and `design.md` appear to disagree, `design.md` governs and this spec gets corrected.

**Verified current-state ground truth** (file:line references) lives in [`sprint-plan.md`](sprint-plan.md) § "Current-State Ground Truth" — the technical plan builds on those citations rather than restating them.

## Principles

- **Nothing you switch away from stops working.** Switching threads is a view change, never a lifecycle event. No teardown, no reset, no session destruction on switch.
- **Close is not delete.** The rail is the open working set; History is the permanent archive. Closing a thread frees a live agent session and keeps every message.
- **The rail answers one question at a glance: who is waiting for whom.** Spinner = the agent is working. Amber = you are the blocker. Nothing else competes for that slot.
- **Parallelism does not loosen the approval gate.** Every file edit, command, and web fetch still pauses for approval, per thread, nothing approves silently.
- **Threads are independent.** No cross-thread context, no cross-thread queues, no cross-thread approval side effects.
- **One thread still runs one turn at a time.** Parallelism is across threads, never inside one.
- **Reuse existing plumbing where it already fits.** `chatHistoryStorage.ts` is already conversation-id keyed; `UnifiedApprovalGate` is already `requestId` keyed. Add attribution and routing, do not rebuild these.
- **Ship behind a kill-switch flag.** The webview store reshape is the highest-blast-radius change in the sprint.

## Requirements

Requirement numbering R1–R7 is inherited from `sprint-plan.md`'s draft and kept stable (the sprint-plan phase checklist already references it). R8–R15 encode behaviour from `design.md` that the draft numbering did not cover.

---

### R1: Multi-session-capable `AgentRuntime` interface

As a user, I want two conversations on the same runtime to run at the same time, so one chat's work never blocks another's.

Rationale: `runtime/AgentRuntime.ts:12-26` has no session handle on `start`/`prompt`/`cancel`/`getStatus`/`dispose`, and `RuntimeRegistry.ts:5` holds one adapter instance per runtime *kind*. Without a session handle, every concurrency requirement below is unimplementable.

Acceptance criteria:

- A call for conversation A never mutates conversation B's state.
- Each runtime adapter can hold ≥2 concurrent sessions and route protocol events to the correct one.
- Disposing one conversation's session tears down only that session; other sessions on the same adapter keep running.
- `getStatus` stays **adapter-level** and is explicitly NOT per-conversation: it reports on the runtime binary and auth (`ready`, `authState`, `version`, `diagnostics`), which are properties of the installed runtime, not of a conversation. Making it per-conversation would imply a per-conversation binary.
- **Structure (decided during Phase 2):** `start(config)` is replaced by `createSession(config): Promise<RuntimeSession>`, where `RuntimeSession` owns `prompt`/`cancel`/`respondToApproval`/`dispose`. Rationale: `RuntimeSessionConfig` already carries the per-turn callbacks (`onProgress`, `onApprovalRequest`, …) and they are already constructed per-execute closing over `agentId` (`UnifiedViewProvider.ts:292-310`) — a session object lets them close over `conversationId` too, instead of threading an id parameter through every method and every callback signature. It also maps 1:1 onto each runtime's own concept: a Codex thread, a Claude `AgentSession`, an ACP session.
- The structural bug this fixes must be gone: today `runtime.start(sessionConfig)` runs on EVERY execute against a shared per-kind adapter (`UnifiedViewProvider.ts:361-362`), so a second chat replaces the first chat's callbacks.
- Preferred structure is multi-session-internal per adapter; per-chat adapter instances via `runtime/runtimeFactory.ts:23` are permitted **only** as the recorded ACP fallback (R4), with the rationale written into `technical-plan.md`.
- Any code path that depends on a specific runtime binary version carries a grep-able `// Sprint 100: re-check against <version>` marker (see `sprint-plan.md` § "Coordination with Sprint 100").

---

### R2: Codex native multi-thread wiring

As a user, I want two Codex conversations running side by side, so the runtime whose protocol already supports it actually does.

Rationale: the Codex app-server protocol is natively multi-thread (`thread/start` returns a thread id; `turn/start` / `turn/interrupt` take `threadId`), but `CodexRuntime.ts:94-95` collapses it to a single `_threadId`/`_turnId` and ignores `params.threadId` when routing events (`:398-537`). This is the cheapest proof of the whole sprint.

Acceptance criteria:

- The adapter holds one thread id per conversation, not one per adapter.
- Inbound events route by the protocol-provided `threadId`; an event for thread A never appends to conversation B's transcript.
- `turn/interrupt` targets only the requesting conversation's thread.
- Two Codex conversations stream simultaneously with no interleaved or cross-attributed output.
- Codex approval requests (`codex-<id>`) carry conversation attribution (R7).

---

### R3: Claude Code multi-session wiring

As a user, I want two Claude conversations running side by side without one clobbering the other's session.

Rationale: the SDK supports multiple `AgentSession`s, but `agent/ClaudeCodeRuntime.ts` holds a single `_session` (`:37`) and single `_pendingQuestions` (`:40-53`), and `start()` reuses one session (`:77-97`). `agent/AgentRunner.ts` (1235 LOC) may hold further hidden singletons.

Acceptance criteria:

- `ClaudeCodeRuntime` holds a `Map<conversationId, AgentSession>`; `_pendingQuestions` is keyed per conversation.
- An `AgentRunner.ts` singleton audit is completed **before** the wiring is written, and every hidden global/singleton found is documented in `technical-plan.md` with its resolution (fixed, scoped, or accepted-with-reason).
- Two Claude conversations stream simultaneously with no cross-attributed output.
- Claude `AskUserQuestion` / plan-review prompts are attributed to the conversation that raised them and drive that thread's amber state (R8).
- Cancelling one Claude conversation leaves the other's session alive and streaming.
- The design is re-verified against the Sprint-100-pinned binary + SDK pair; a `Sprint 100: re-check` marker records this.

---

### R4: ACP/OpenCode concurrency

As a user, I want two OpenCode conversations running side by side, with approvals and cancels landing on the right one.

Rationale: hardest case. `acpManager.ts` stores ONE `sessionId` (`:62`) plus one subprocess; `AcpRuntime.ts:50-63` holds a single `_manager`, `_ipcServer`, `_pendingApprovals`, `_recentlyPermissionedWrites`; `cancel()` nulls the manager (`:146-155`).

Acceptance criteria:

- The concurrency model — **multi-session in one subprocess** vs **one subprocess per chat** — is decided and recorded in `technical-plan.md` with explicit rationale and resource trade-off. Not defaulted silently.
- `_pendingApprovals` and `_recentlyPermissionedWrites` are keyed per conversation; an approval resolved in one conversation never resolves another's.
- `cancel()` for one conversation does not tear down another conversation's session or subprocess.
- If per-chat subprocess is chosen: process count tracks open OpenCode threads and processes are reaped on thread close.
- If multi-session-in-subprocess is chosen: two sessions in one subprocess isolate approvals, cancels, and model selection.
- The known `session/cancel` `-32601` (not-implemented) fallback to process-kill on OpenCode 1.15.13 is marked in `AcpRuntime.ts` with a `Sprint 100: re-check` marker, since the fallback may become wrong once 1.18.1 implements the method.
- `setSessionConfigOption`-based per-conversation model selection is verified in the multi-session world, not only single-session.

---

### R5: Webview multi-conversation store

As a user, I want each thread to keep its own messages, streaming state, and running flag, so the UI can show N live conversations truthfully.

Rationale: `store.ts` today holds parallel single-conversation arrays (`agentConversation:178`, `codexConversation:185`) with a global `isStreaming:173`; turn types carry no `conversationId` (`types.ts:191,292`); send guards (`store.ts:422,744,812`) and `ChatInput.tsx:223-224,273,1257` are global; inbound dispatch appends to "the tail of the single array".

Acceptance criteria:

- State shape becomes `Map<conversationId, ConversationState>` + `activeConversationId`; per-conversation streaming/running replaces the global `isStreaming`.
- Every turn type carries a `conversationId`.
- Every outbound webview→host message (`agent-execute`, `agent-cancel`, `agent-approve`, …) and every inbound host→webview message (`agent-progress`, `agent-result`, `codex-*`, `agent-approval-request`, …) carries a `conversationId`.
- Inbound dispatch routes strictly by `conversationId`; a message with an unknown or missing `conversationId` is dropped with a logged warning rather than appended to the active conversation.
- Send guards are per-conversation: a running thread A does not disable sending in idle thread B.
- `UnifiedViewProvider.ts`'s single `_activeAbortController` (`:158-161`) becomes a per-conversation map.
- Existing id-keyed localStorage persistence (`chatHistoryStorage.ts:207-233`) continues to work with no migration data loss; conversations saved before Sprint 99 still load.
- Switching the active conversation performs **no** `resetProviderSessions()` / `conversation:reset` — the destructive path at `store.ts:56-57,1034-1076,1120-1135` is removed from switch and new-thread flows.

---

### R6: Thread rail

As a user, I want one obvious place to see my open threads and move between them, so parallel work does not become hidden work.

Rationale: `design.md` § 3. The rail is the single home for thread management; the named-list variant was explicitly rejected.

Acceptance criteria:

- A vertical icon rail (38px) sits on the **right edge** of the AI sidebar, listing one icon per open thread in creation order, scrollable on overflow.
- The rail spans the **messages area only**. It must NOT extend over the composer; the composer runs full width below both the messages area and the rail.
- **"+" (new thread) is pinned at the rail top; History is pinned at the rail bottom**, just above the composer boundary.
- The sidebar **title bar carries neither "+" nor History** — no duplicate entry points.
- No dividers, no left emphasis bar, no additional rail chrome.
- The active thread is indicated by an **indigo-soft pill background on its icon and nothing else**.
- There is **no named-list or wide-sidebar variant** at any sidebar width.
- Clicking a thread icon switches the sidebar content and composer to that thread instantly, with no teardown of any thread.
- Hovering a thread icon shows a tooltip with the thread title and its status (e.g. "Translate memo — needs approval").
- Thread titles are auto-derived from the thread's first prompt.

---

### R7: Approval attribution and per-thread approval isolation

As a user, I want an approval raised in a background thread to be clearly attributed to that thread and actionable without disturbing whatever I am currently watching.

Rationale: `UnifiedApprovalGate.ts:16` is already keyed by `requestId` (namespaced per runtime), so keying is fine — what is missing is conversation ATTRIBUTION so the webview routes a card to the right thread instead of assuming "the" active one.

Acceptance criteria:

- Every approval request carries the `conversationId` of the thread that raised it, end to end (runtime adapter → `UnifiedApprovalGate` → `UnifiedViewProvider` → webview).
- The approval card renders **inside the thread that asked** — never in the active thread by default.
- Approving or denying in one thread has no effect on any other thread's pending approvals, including when both threads are on the same runtime.
- A thread with an unresolved approval shows amber on the rail (R8), and switching to it shows the card.
- Resolving an approval in a background thread does not change which thread is active and does not disturb the foreground thread's streaming or composer state.
- Multiple simultaneous pending requests in one thread are all resolvable independently; the thread stays amber until the last one is resolved.

---

### R8: Thread status language — spinner vs amber

As a user, I want to know at a glance which agents are working and which are waiting on me, so I never leave an agent stalled without noticing.

Rationale: `design.md` § 5. This is the sprint's trust story and the single most likely detail to be lost in implementation.

Acceptance criteria:

- Each thread icon has exactly **one status slot** (inside the button, bottom-right) and shows **at most one signal**.
- **Spinner (indigo)** = a turn is in flight (streaming, running tools) and nothing is blocked on the user.
- **Amber dot (pulsing)** = the thread is blocked on the user: an unresolved approval request attributed to this conversation, OR a pending agent question / plan review (Claude `AskUserQuestion` / plan review, Codex `request_user_input`, OpenCode `session/request_permission`).
- **Amber overrides spinner.** A turn that is technically mid-flight but waiting on the user shows amber only.
- **Idle = no badge.** Hovering an idle thread shows the close (×) affordance in place of the badge.
- When all pending items for a thread resolve, the badge returns to **spinner** if the turn resumes, or **disappears** if the turn ended.
- Multiple simultaneous pending requests still show a **single** amber dot. No counts on the rail.
- Badges show on **all** threads **including the currently active one**.
- Adjacent icons' badges never visually collide.
- The per-thread state machine is `idle → running → attention → running → idle`, and the badge is a pure function of that state.

---

### R9: Thread identity and runtime colour coding

As a user, I want to tell which engine is behind each thread without reading labels.

Rationale: `design.md` § 4. Recognition comes from colour, consistency from a shared glyph.

Acceptance criteria:

- **Every** thread icon uses the same glyph: the app's Phosphor `robot`, regular weight, via `ui/Icon.tsx`. No invented per-runtime glyph shapes.
- The glyph is tinted by runtime: Claude `#D97757` (clay), Codex `#10A37F` (green), OpenCode `#0EA5E9` (sky).
- The **same** colour coding appears in the conversation meta row (the "CLAUDE / CODEX / OPENCODE" label above each agent reply).
- Each thread is bound to exactly one runtime for its lifetime.
- Dark mode (Deep Space `#1E1B4B`) keeps identical rail anatomy, identical status language, and unchanged runtime colours and amber dot.

---

### R10: Thread creation and empty-thread hygiene

As a user, I want a new thread to be a cheap, safe action that never destroys anything and never litters the rail with blanks.

Rationale: `design.md` § 6 "Creating". The old "new chat wipes the current one" semantic disappears entirely.

Acceptance criteria:

- Pressing "+" creates a new empty thread that is immediately active and visible on the rail.
- Creating a thread **never** tears down, resets, cancels, or reloads any existing thread — including running ones.
- **Only one empty thread exists at a time.** Pressing "+" while an empty thread already exists refocuses that thread instead of creating a second blank.
- An empty thread that the user switches away from is quietly auto-discarded (removed from the rail, nothing written to History).
- Reopening a conversation from History promotes it back onto the rail; if it is already open, Ritemark just switches to it.

---

### R11: Thread closing and the soft cap

As a user, I want closing a thread to free the agent session without ever risking my conversation or my in-flight work.

Rationale: `design.md` § 6 "Closing".

Acceptance criteria:

- Hovering an **idle** thread's icon reveals a close (×); activating it removes the thread from the rail and tears down its live agent session.
- **Close ≠ delete:** the conversation remains in History in full and can be reopened.
- A **running** or **approval-waiting** thread offers **no ×** at all — the user must stop the turn or resolve the pending item first. Accidentally killing in-flight work must not be possible.
- There is **no timer-based auto-close**. The rail changes only when the user changes it.
- **Soft cap of 5 open threads.** Pressing "+" at the cap does not silently create a 6th; it prompts the user to close an idle thread first.
- The rail scrolls when icons overflow the available vertical space.

---

### R12: History as archive and reopen surface

As a user, I want History to be a real archive I can pull from, not a picker that destroys what I am doing.

Rationale: `design.md` § 6 "History". `ChatHistoryPanel.tsx` today is load-one-destroy-current and needs redesign, not just a data-shape change.

Acceptance criteria:

- History (rail bottom) lists **all** conversations, open and closed.
- Conversations currently on the rail carry an "open" badge.
- Clicking a **closed** conversation reopens it onto the rail as an open thread and switches to it.
- Clicking an **open** conversation simply switches to it.
- Opening anything from History **never** resets, cancels, or destroys any other thread.
- Every thread autosaves continuously, so a conversation is complete in History without any explicit save action.

---

### R13: Persistence and restart semantics

As a user, I want my open threads to still be there after a relaunch, and I want to know if a turn was cut off.

Rationale: `design.md` § 6 "Restart / relaunch".

Acceptance criteria:

- The set of open threads persists **per workspace** and is restored on relaunch, along with each thread's runtime binding and title.
- Transcripts restore immediately on relaunch (no agent process required to read them).
- The underlying agent session **re-attaches lazily** — on the user's next prompt in that thread, not eagerly at startup.
- A turn that was mid-flight at shutdown is marked **interrupted** in that thread's transcript. It is never silently resumed and never left looking as if it is still running.
- After relaunch, no thread shows a spinner unless a turn is genuinely in flight again.
- Restored threads that had an unresolved approval at shutdown do not present a stale, un-actionable approval card; the turn shows as interrupted instead.

---

### R14: Per-thread composer and queue

As a user, I want the composer to belong to whatever thread I am looking at, and queued prompts to stay in the thread I typed them in.

Rationale: `design.md` § 7. The composer queue itself (`composerQueue.ts`, `ChatInput.tsx:261,326-335,424`) is kept and scoped per thread — redesigning it is #95's scope, not this sprint's.

Acceptance criteria:

- The composer always reflects the **active** thread, including its footer runtime + model label (e.g. "Claude · Sonnet 5").
- Active thread running → the button is **Stop**, and Stop stops **only that thread**.
- Active thread idle → the button is the indigo **Send**.
- While a thread runs, its composer stays **unlocked**: Enter queues a follow-up prompt for that thread using the existing composer-queue notch.
- **Queues never cross threads.** A prompt queued in thread A fires in thread A when A becomes free, and never in thread B.
- Switching threads swaps composer draft text, queue contents, and Send/Stop state to the newly active thread, losing nothing from the thread being left.
- Sending a prompt to a different, **idle** thread starts immediately rather than queuing — the global "second prompt parks in the queue" behaviour is gone.

---

### R15: `parallelChats` feature-flag kill-switch

As Jarmo, I want a fast rollback path if the store reshape regresses in the field.

Rationale: R5 touches state used by the entire AI sidebar. Per project memory, Settings has no flag-toggle UI, so this is a code-level kill-switch for an emergency follow-up release, not a user-facing setting.

Acceptance criteria:

- A `parallelChats` flag exists in `extensions/ritemark/src/features/flags.ts`, all platforms, **default ON** per the "features ON by default" rule.
- The flag's `description` states explicitly that it is a code-level kill-switch with no Settings UI.
- With the flag off, the sidebar falls back to single-conversation behaviour without crashing and without corrupting stored conversations.
- The flag stays functional through every implementation phase, not just at sprint end.
- The flag is not scoped for removal in this sprint (per the flag lifecycle rule, removal comes after a full stable release cycle).

---

## Non-Requirements

Explicit, to prevent scope creep. None of the linked issues is closed by this sprint — reference them in commits, do not scope-creep to solve them.

- **#95 (composer queue actions) is NOT resolved.** Only "the queue stays correctly scoped per thread" (R14) is in scope. No editing, promoting, reordering, or removing queued prompts.
- **#97 (cross-runtime conversation context) is NOT resolved.** Parallel threads remain fully independent conversations. **No cross-thread context sharing** of any kind: no thread can see another thread's messages, and no mechanism is added to pass context between threads.
- **#140 (background-work / attention indicator) is NOT resolved.** Only the rail's per-thread spinner/amber badges (R8) are in scope. **No global "all background activity" overview / activity center / notification surface.**
- **No parallel turns inside one thread.** A single thread still runs exactly one turn at a time; parallelism is strictly across threads.
- **Flows are unaffected.** Flow runs do not appear on the thread rail and no flow behaviour changes in this sprint.
- **No named-list or wide-sidebar thread switcher.** Rejected by Jarmo 2026-07-21; the icon rail is the only switcher at every sidebar width.
- **No per-runtime glyph shapes.** One shared `robot` icon, colour only.
- **No timer-based or automatic thread closing.**
- **No thread renaming UI, no thread reordering, no drag-and-drop on the rail.** Titles are auto-derived; order is creation order.
- **No hard cap on open threads.** The 5-thread limit is a soft cap with a prompt (R11), not an enforced maximum in the data model.
- **No new agent runtime.** The three existing runtimes only.

## Resolved Questions

All resolved by Jarmo on 2026-07-21 in `design.md` unless noted. Not reopenable during implementation.

- **Switcher form:** icon rail on the right edge, terminal-panel pattern. Named-list variant **rejected**.
- **Rail vs composer:** the rail spans the messages area only and never extends over the composer.
- **Where thread management lives:** the rail owns it — "+" at top, History at bottom, sidebar title bar carries neither.
- **Rail chrome:** no dividers, no left emphasis bar. Active = indigo-soft pill only.
- **Thread icon:** one shared Phosphor `robot`, colour-coded per runtime (clay / green / sky), same coding in the conversation meta row.
- **Status priority:** amber overrides spinner; one status slot; badges on all threads including the active one; idle shows no badge.
- **Multiple pending requests:** single amber dot, no count on the rail.
- **Close semantics:** close ≠ delete; only idle threads offer ×; no auto-close.
- **Empty-thread hygiene:** one empty thread at a time; "+" refocuses; switching away auto-discards.
- **Soft cap:** 5 open threads, with a prompt to close an idle one.
- **Restart:** open-thread set persists per workspace; transcripts restore instantly; sessions re-attach lazily; mid-flight turns marked interrupted.
- **Queue fate:** kept, scoped per thread. Queue redesign stays in #95.
- **Approval keying:** `UnifiedApprovalGate`'s existing `requestId` keying is retained; only conversation attribution is added.
- **Interface direction:** multi-session-internal adapters preferred; per-chat instances are an ACP-only fallback (R1/R4).

## Resolved Design Gaps

`design.md` did not determine these eight points. Rather than block the sprint, each is resolved
below with the reasoning; all are small and reversible. **Jarmo can override any of them with one
sentence** — the two most product-visible (2 and 4) are called out in the sprint summary.

1. **(R6) Thread title truncation.** Auto-title = the first prompt, trimmed to the first sentence
   or 60 characters (whichever comes first), broken on a word boundary, ellipsis at the end. The
   title appears only in the hover tooltip and History, never on the rail itself, so the budget is
   generous. A prompt shorter than the budget is used verbatim.

2. **(R11) Soft cap with no idle thread to close.** **Allow the new thread.** A cap that blocks the
   user when every thread is busy would punish exactly the workflow this sprint exists to enable —
   and "you cannot start work because your other work is still running" is the wrong answer. The
   cap stays advisory: the prompt offers idle threads to close when there are any, and otherwise
   explains that many concurrent agents will be slow and lets the user continue. This keeps "soft
   cap" honest.

3. **(R12 + R11) Reopening from History at the cap.** Same rule as "+". A reopened thread is an
   open thread; there is no reason for it to be exempt, and an exemption would be an easy way to
   accumulate 10 open threads without ever seeing the prompt.

4. **(R11 + R14) A thread with a queued prompt but no running turn is NOT idle.** It offers no ×,
   exactly like a running thread. Closing it would silently discard work the user has already
   written, and a confirmation dialog for a rare case is worse than simply withholding the
   affordance until the queue drains. The tooltip states the thread has queued work.

5. **(R13) Interrupted turns are informational only.** The transcript marks the turn as interrupted
   and the user re-prompts if they want. A retry/resume action implies replaying a partially
   applied turn, whose side effects (files already written, commands already run) are not tracked —
   offering it would be a correctness claim the code cannot back.

6. **(R15) Flag off with threads already open.** The most-recently-active thread becomes the single
   conversation; every other thread is closed (not deleted) and stays reachable in History. This is
   the least surprising collapse and loses nothing.

7. **(R8 + R6) Attention on a scrolled-out thread — moot in practice, guarded anyway.** With the
   soft cap at 5 and 30 px icons, the rail does not overflow at any realistic sidebar height, so
   the case only arises once a user has overridden the cap (see 2). When the rail does overflow, an
   amber icon outside the visible range shows an amber chevron at the corresponding rail edge. This
   is a small addition and not a global activity center, so it does not cross the non-goal.

8. **(R9) Runtime unavailable for a restored thread.** The thread stays on the rail with its
   transcript readable; the failure surfaces when the user next prompts in it, which is exactly how
   an unavailable runtime behaves today. Silently relegating a thread to History would hide the
   user's work and imply a decision the app is not entitled to make on their behalf.

---

*Derived from the Jarmo-approved [`design.md`](design.md) (2026-07-21). All UX decisions recorded there are final; this spec restates them as testable requirements and does not re-open them.*

# Sprint 99: Parallel Agent Chats

Track: SDD (auto-detected — see rationale below)
Override with: "use plain full track"
Release tier: extension
Branch: `sprint-99-parallel-chats` (create immediately after Jarmo approves this plan — no code before that)

## Track Decision

**Recommend SDD.** Signals present:
- Multi-component flow: webview store ↔ bridge messages ↔ extension host (`UnifiedViewProvider`) ↔ three independent runtime adapters (Claude/Codex/ACP), each with a different native concurrency model.
- ≥3 distinct user-facing requirements once decomposed (interface support for concurrent sessions, per-runtime wiring x3, webview multi-conversation state, multi-chat UI switcher, approval attribution) — more than the "single feature" shape lightweight/plain-track sprints assume.
- Edge-case-heavy: session/thread lifecycle, approval-gate keying across concurrent turns, restart/recovery semantics — exactly the class of bug that hides from code review and needs BDD-style scenarios (e.g. "two chats streaming simultaneously, one gets an approval prompt, user cancels the OTHER chat").
- This sprint also trips the **Sprint Architecture Gate** (`docs/development/architecture.md` "Sprint Architecture Gate" section) — it changes the `AgentRuntime` interface (`src/runtime/AgentRuntime.ts:12-26`) and adds a new field crossing the webview↔extension boundary (`conversationId` on `agent-execute`/`agent-progress`/`agent-approval-request`/etc.) — both are explicit "changes structure" triggers requiring an architecture.md update before sprint close.

Recommend pulling `.claude/skills/spec-driven-sprint/SKILL.md` — the skill defines the five-artifact structure (spec / scenarios / technical-plan / tasks / sprint-plan). This sprint-plan.md is artifact 5. **Artifacts 1-3 (`spec.md`, `scenarios.md`, `technical-plan.md`) do not exist yet** — they are the remainder of Phase 2 and must be authored (and folded into a Product Decision entry here) before Phase 3 branch/code work starts. This sprint-plan.md drafts provisional requirement numbers below as a head start for `spec.md`; treat them as proposals, not final.

Jarmo can override the track with one sentence ("use plain full track" / "just do it without SDD ceremony").

## Release Context

**Decided (Jarmo, 2026-07-21):** v1.8.5 is a full shell-tier DMG release bundling four sprints in this order: **Sprint 98 (safe ext lane) → Sprint 99 (this sprint, parallel chats) → Sprint 100 (runtime bumps) → Sprint 101 (agent capability context)**. (1.9.0 stays reserved for potential cloud capabilities.) Sprint 99 itself is extension-tier, but rides in the same shell release as 98 and 100 rather than shipping alone via the (currently closed) ext fast lane. Sprint 98 ships first so the safe-ext-lane pieces are in place before this sprint's work lands; Sprint 100 ships deliberately AFTER this sprint, so the runtime-bump compatibility matrix can validate the parallel-session behavior this sprint introduces (see "Coordination with Sprint 100" below) rather than bumping binaries blind to it.

## Goal

Allow N concurrent agent chats/threads in the AI sidebar. Today exactly one live conversation exists per webview session (`webview/src/components/ai-sidebar/store.ts:151-308`); starting a second prompt while one is running gets parked in the composer queue rather than running in parallel. This sprint makes multiple chats — potentially across different runtimes (Claude/Codex/OpenCode) — genuinely concurrent, each with its own streaming state, approval flow, and cancel/restart lifecycle.

## Linked Issues

- #95 — composer queue actions (this sprint touches queue semantics per-chat; does not fully resolve #95, see Non-Goals)
- #97 — cross-runtime conversation context (parallelization is a prerequisite for some #97 designs but does not itself solve context-sharing across runtimes)
- #140 — background-work / attention indicator (this sprint's UI switcher must surface a "running in background" badge, partially advancing #140; full #140 scope may exceed this sprint)

None of these three issues should be treated as closed by this sprint — reference them in commits, don't scope-creep to fully solve them.

## Current-State Ground Truth (verified by Explore agent — cite in spec.md/technical-plan.md)

1. **Store model:** parallel single-conversation arrays `agentConversation` (`store.ts:178`, Claude), `codexConversation` (`store.ts:185`, Codex+OpenCode shared), `currentConversationId` (`store.ts:201`), global `isStreaming` (`store.ts:173`). Turn types carry NO `conversationId` (`types.ts:191`, `types.ts:292`). Persistence (`chatHistoryStorage.ts:207-233`) is already id-keyed — mostly compatible with a multi-conversation reshape. Switching conversations today is destructive: `loadSavedConversation` (`store.ts:1034-1076`) and `startNewConversation` (`store.ts:1120-1135`) both call `resetProviderSessions()` (`store.ts:56-57`), which posts `conversation:reset` and tears down the runtime session — this is the behavior that must change.

2. **Runtime concurrency capability (varies wildly):**
   - **Codex** (`codex/CodexRuntime.ts`) — app-server protocol is natively multi-thread (`thread/start` returns a thread id; `turn/start`/`turn/interrupt` take `threadId` — `codexAppServer.ts:142,182,211`; events carry `threadId`/`turnId`). The adapter collapses this to a single `_threadId`/`_turnId` (`CodexRuntime.ts:94-95`) and ignores `params.threadId` in event routing (`:398-537`). **Cheapest win — protocol already supports it, only the adapter needs to stop collapsing.**
   - **Claude Code** (`agent/ClaudeCodeRuntime.ts`) — SDK supports multiple `AgentSession`s, but the adapter holds a single `_session` (`:37`), single `_pendingQuestions` (`:40-53`), and reuses one session in `start()` (`:77-97`). Needs a `Map<conversationId, Session>` plus an audit of `agent/AgentRunner.ts` (1235 LOC) for hidden singletons — this audit is an explicit Phase 1 research task, not an assumption.
   - **OpenCode/ACP** (`acp/AcpRuntime.ts`, `acp/acpManager.ts`) — ACP `session/new` returns a `sessionId` (`acpManager.ts:113-115`) but the manager stores ONE `sessionId` (`:62`) plus one subprocess; `AcpRuntime` holds a single `_manager`, `_ipcServer`, `_pendingApprovals`, `_recentlyPermissionedWrites` (`:50-63`); `cancel()` nulls the manager (`:146-155`). **Hardest case.** Phase-1/2 decision task: multi-session within one subprocess (mirrors Codex/Claude shape) vs. one subprocess per chat (simpler isolation, materially more memory/process overhead) — decide and record in technical-plan.md, don't default silently.

3. **Interface blocker:** `runtime/AgentRuntime.ts:12-26` — `start`/`prompt`/`cancel`/`getStatus`/`dispose` take no session handle; only `respondToApproval(requestId)` is keyed at all. `RuntimeRegistry.ts:5` is `Map<AgentId, AgentRuntime>` — one instance per runtime KIND, constructed in `UnifiedViewProvider.ts:114-118`. Two structural options:
   - (a) **Preferred** — make each runtime adapter multi-session internally (mirrors what Codex's protocol already does natively); interface methods gain a `conversationId`/session-handle parameter.
   - (b) **ACP fallback only** — mint one runtime instance per chat via the existing `runtime/runtimeFactory.ts:23` `createRuntime()` (already used by the scheduler daemon for isolated instances). Present as the fallback specifically for ACP if multi-session-in-one-subprocess proves too invasive; not the default for all three runtimes.

4. **Extension plumbing:** `UnifiedViewProvider.ts:192-373` (agent-execute handler), `:375-379` (agent-cancel), `:387-395` (agent-approve); single `_activeAbortController` (`:158-161`) must become a per-conversation map. EVERY outbound postMessage (`agent-progress`, `agent-result`, `codex-*`, `agent-approval-request`) must gain a `conversationId`.

5. **Approval gate:** `runtime/UnifiedApprovalGate.ts:16` is already a `Map` keyed by `requestId` (namespaced per runtime: `codex-<id>` at `CodexRuntime.ts:525`, `acp-<seq>` at `AcpRuntime.ts:246,280`, Claude `toolUseId` at `ClaudeCodeRuntime.ts:122-139`). Keying is fine as-is; what's missing is conversation ATTRIBUTION so the webview routes an approval card to the correct chat rather than assuming "the" active one.

6. **Webview send/dispatch guards:** `store.ts:422,744,812` (early-return if `lastTurn.isRunning`) and `ChatInput.tsx:223-224,273,1257` (global `isLoading`/`disabled`) are global today — must become per-conversation. Inbound dispatch (`store.ts:~1200-1804`) currently appends to "the tail of the single array" — must route by `conversationId`. Target state shape: `Map<conversationId, ConversationState>` + `activeConversationId`. Composer queue (`composerQueue.ts`, `ChatInput.tsx:261,326-335,424`) — recommend KEEPING per-chat (still useful to queue multiple prompts within one busy chat); do not attempt to supersede/redesign the queue mechanism itself in this sprint (that's #95's scope).

7. **UI:** needs a multi-chat switcher (tabs or list of OPEN chats with running/attention indicators). `ChatHistoryPanel.tsx` today is load-one-destroy-current and needs redesign, not just a data-shape change. Also needs a "background chat needs your approval" indicator (relates to #140).

   **Design APPROVED by Jarmo (2026-07-21). Complete UX design: [`design.md`](design.md)** — the authoritative description of the rail, status language, lifecycle, and vocabulary; `product-marketer` uses it later for help texts. Summary of the locked decisions: terminal-tabs pattern, OPTION A (icon rail) — threads listed top-down on the RIGHT EDGE of the sidebar, like VS Code's terminal panel lists multiple terminals. Interactive pixel prototype: `prototypes/parallel-threads.html` (Indigo-Editorial tokens; A = chosen icon rail, B = named-list alternate kept for reference/wide sidebars, C = dark/Deep Space). Decisions encoded per Jarmo's review:
   - The rail must NOT extend over the composer boundary — it spans the messages area only; the composer runs full-width below both.
   - One icon for every thread: the app's own Phosphor `robot` (regular 400, via `ui/Icon.tsx` — no invented per-runtime glyphs), **color-coded by runtime**: Claude `#D97757` (clay), Codex `#10A37F` (green), OpenCode `#0EA5E9` (sky). Same color coding in the conversation meta row.
   - Active thread = indigo-soft pill ONLY — no left emphasis bar, no rail dividers (Jarmo 2026-07-21: remove visual clutter). Status = ONE slot per icon, inside the button bottom-right; a thread shows at most one signal and adjacent icons cannot visually collide.
   - **Status rule ("who is waiting for whom"):** spinner = the agent is working and nothing is blocked on the user (turn in flight: streaming/tools). Amber dot = the thread is BLOCKED ON THE USER — it has an unresolved approval request in `UnifiedApprovalGate` attributed to this conversation, or a pending agent question/plan review (Claude `AskUserQuestion`/plan-review via `canUseTool`, Codex `request_user_input`, OpenCode `session/request_permission`). Priority: **amber overrides spinner** — a turn mid-flight that hits an approval shows amber only; when all pending items for the thread are resolved it returns to spinner (turn resumes) or idle (turn ended). State machine: idle → running → attention → running → idle. Multiple simultaneous pending requests still show a single amber dot (no count on the rail — the count lives in the conversation). Badges show on ALL threads including the active one, so the rail reads at a glance regardless of which chat is open. Idle = no badge (hover shows × instead).
   - Hover tooltip shows title + status; switching swaps chat content + composer state (running thread shows Stop, idle shows Send) instantly.
   - **The rail owns thread management (Jarmo 2026-07-21):** "+" (new thread) pinned at the rail TOP, History pinned at the rail BOTTOM (just above the composer boundary); the sidebar title bar carries neither — no duplicate entry points.
   **Named-list variant REJECTED by Jarmo (2026-07-21)** — the icon rail is the only switcher at every sidebar width; the prototype keeps only A (light) + B (dark).

   **Thread lifecycle (proposed 2026-07-21, awaiting Jarmo's pick):** rail = OPEN working set, History = permanent archive; every thread autosaves continuously (existing `chatHistoryStorage.ts` per-conversation-id keying is compatible).
   - *Promotion:* a thread is born on the rail — the rail-top "+" creates an empty thread, immediately active and visible on the rail. Guard against rail pollution: only one empty thread at a time ("+" refocuses the existing empty one); an empty thread you switch away from is auto-discarded. Opening a conversation from History re-opens it onto the rail (if already open → just switch). The old "new chat wipes the current one" semantic disappears entirely.
   - *Removal:* explicit close only (hover × on the rail icon) — close ≠ delete: the conversation stays in History, close just tears down the live session. Only idle threads offer ×; running or approval-waiting threads must be stopped/resolved first (prototype encodes this). No timer-based auto-close. Soft cap on open threads (proposed 5): "+" past the cap prompts to close an idle thread; the rail scrolls on overflow.
   - *Restart:* the open-thread set persists per workspace; on relaunch transcripts restore instantly and runtime sessions re-attach lazily on next prompt (today's reload behavior, generalized to N); a turn that was mid-flight is marked interrupted.
   - *History (rail-bottom button):* archive of ALL conversations with open ones badged "open" — click closed → reopens onto rail, click open → switches. History stops being a load-one-destroy-current picker.

8. **Tier:** confirmed extension-tier — nothing under `patches/`, `vscode` submodule, `branding/`, `binaries/agents/`, or build scripts. Interface change still triggers the Sprint Architecture Gate (see Track Decision above) — `docs/development/architecture.md` must be updated at sprint end regardless of tier.

## Provisional Requirements (draft numbering for `spec.md`)

- **R1 — Multi-session-capable `AgentRuntime` interface.** Each runtime adapter can run ≥2 concurrent sessions/threads without one blocking or corrupting the other's state.
- **R2 — Codex native multi-thread wiring.** Adapter stops collapsing to a single `_threadId`; routes events by the `threadId` the protocol already provides.
- **R3 — Claude Code multi-session wiring.** Adapter holds a `Map` of sessions; `AgentRunner.ts` singleton audit completed and any hidden global state fixed.
- **R4 — ACP/OpenCode concurrency.** Either multi-session-in-one-subprocess or one-subprocess-per-chat (decision recorded with rationale); approvals and cancel scoped correctly per chat either way.
- **R5 — Webview multi-conversation store.** `Map<conversationId, ConversationState>` replaces the single-array model; send guards and dispatch routing become per-conversation; existing localStorage persistence (already id-keyed) continues to work.
- **R6 — Multi-chat UI switcher.** User can see and switch between multiple open chats, with per-chat running/attention indicators (relates to #140).
- **R7 — Approval attribution.** An approval request surfaced while the user is viewing a different chat is clearly attributed to its originating chat and actionable without losing the foreground chat's state.

Non-Requirements (explicit, to prevent scope creep):
- Full resolution of #95 (composer queue redesign) — only "queue stays correctly scoped per chat" is in scope.
- Full resolution of #97 (cross-runtime shared context) — parallel chats remain independent conversations; no context-sharing mechanism between them is added.
- Full resolution of #140 — only the "background chat needs attention" indicator directly needed for R6/R7 is in scope; broader notification-center-style UX is not.

## Sequencing Decision (proposed — confirm with Jarmo)

The sprint description offered phasing "A: interface+Codex, B: Claude, C: ACP, D: webview reshape+UI switcher" and explicitly asked whether the webview store reshape must come first, since nothing is visibly parallel without it.

**Recommendation: reorder so the webview store reshape (R5) lands together with the interface change (R1), as Phase 1 — before any single runtime is fully wired for concurrency.** Rationale: doing R1+R5 first means each subsequent runtime phase (R2 Codex, R3 Claude, R4 ACP) is independently demoable and testable through the real UI as it lands, rather than three runtimes worth of adapter work sitting invisible behind a single-conversation UI until Phase D. The UI switcher (R6) can start as a minimal "list of open chats" and get richer (attention badges, etc.) as R7 approval attribution lands. This is a plan-time judgment call — flag it to Jarmo for a one-line override if a different order is preferred (e.g. proving Codex end-to-end first as a smaller, self-contained proof before touching the store).

## Coordination with Sprint 100

Sprint 100 (Claude 2.1.156→2.1.210 + SDK, OpenCode 1.15.13→1.18.1) ships immediately after this sprint in the same v1.8.5 release. This sprint's multi-session code must be written **version-agnostic** — no workaround keyed to the CURRENT binary versions without an explicit `// Sprint 100: re-check against <version>` marker in the code (and a corresponding line in `technical-plan.md`'s ACP/Claude workstreams) so Sprint 100 knows exactly what to re-verify.

Known version-specific quirks this sprint will touch, that Sprint 100 must re-check against the bumped binaries:

- **OpenCode `session/cancel` returns `-32601` (method not implemented) on 1.15.13** — this sprint's ACP cancel path therefore falls back to a process kill rather than a protocol-native cancel. If OpenCode 1.18.1 implements `session/cancel`, that fallback becomes unnecessary (or actively wrong, if the killed-process path now races with a proper cancel response) — mark this fallback clearly in `AcpRuntime.ts` for Sprint 100 to revisit.
- **Model selection via `setSessionConfigOption`** — if this call's shape or semantics change in 1.18.1, per-conversation model selection in a multi-session ACP world needs re-verification, not just single-session re-verification.
- **ACP concurrency model choice (Phase 4, R4)** — if this sprint goes one-subprocess-per-chat, note explicitly in `technical-plan.md` that OpenCode 1.18.1 (Desktop-v2 migration) may change multi-process behavior/resource characteristics; Sprint 100 must re-test the chosen model against the new binary, not just re-test single-session behavior.
- **Claude multi-session (`Map<conversationId, AgentSession>`)** — must be re-verified end-to-end against the Sprint-100-pinned `2.1.210` binary + bumped SDK pair. A `Map`-of-sessions design that works against 2.1.156's SDK behavior is not assumed to be correct against the bumped pair without an explicit re-test.

Practical rule for this sprint: any code comment, test fixture, or workaround that references a specific runtime version number gets a `Sprint 100: re-check` marker (grep-able string) so Sprint 100's Phase 1 research can `grep -rn "Sprint 100: re-check"` as a starting checklist rather than re-discovering these quirks from scratch.

## Feature Flag Check

- Does this sprint need a feature flag? **YES.** `parallelChats` flag in `extensions/ritemark/src/features/flags.ts` as a code-level kill-switch — the webview store reshape (R5) touches state shared by the entire AI sidebar, so a fast rollback path matters if a regression ships. Note: Settings has no flag-toggle UI (per memory `project_feature_flags_no_ui`), so this flag is a kill-switch for an emergency follow-up release, not a user-facing setting — document that explicitly in the flag's `description` field.
- Flag removed only when the feature has been stable for a full release cycle (per CLAUDE.md flag lifecycle rule); not scoped for removal in this sprint.

## Success Criteria

- [ ] Two agent chats can run simultaneously (streaming) without one blocking the other, including across two DIFFERENT runtimes (e.g. one Claude chat + one Codex chat running at the same time)
- [ ] Starting a second prompt no longer parks in the composer queue when it targets a DIFFERENT, idle chat — it starts immediately in that chat
- [ ] Within a single chat, the existing composer-queue-when-busy behavior is preserved (queuing is per-chat, not global)
- [ ] An approval request raised in a background (non-focused) chat is visibly attributed to that chat and can be approved/rejected without losing the foreground chat's in-progress state
- [ ] Cancelling one running chat does not affect any other running chat
- [ ] Restarting the app (or reloading the webview) correctly recovers/reflects the state of multiple chats, consistent with existing per-id localStorage persistence
- [ ] `docs/development/architecture.md` updated: Agent Runtime Architecture section reflects the multi-session interface and updated message contracts (Sprint Architecture Gate requirement)
- [ ] `parallelChats` feature flag exists, defaults ON per "features ON by default" rule, and demonstrably disables concurrency (falls back to single-conversation behavior) when flipped off

## Deliverables

| Deliverable | Description |
|-------------|--------------|
| `spec.md` | Behaviour contract, R1-R7 (or renumbered) with acceptance criteria — authored before Phase 3 |
| `scenarios.md` | BDD scenarios incl. negative/edge cases (concurrent approval, cancel-one-of-two, restart recovery) |
| `technical-plan.md` | Workstreams per R-number, message shape changes, ACP subprocess-vs-multi-session decision recorded |
| `AgentRuntime.ts` interface change | Session-handle-aware `start`/`prompt`/`cancel`/`getStatus`/`dispose` |
| `CodexRuntime.ts` multi-thread wiring | Stops collapsing `_threadId`, routes by protocol-native thread id |
| `ClaudeCodeRuntime.ts` multi-session wiring | `Map` of sessions; `AgentRunner.ts` singleton audit resolved |
| `AcpRuntime.ts` / `acpManager.ts` concurrency | Per decided model (multi-session-in-subprocess or per-chat subprocess) |
| `UnifiedViewProvider.ts` per-conversation plumbing | Per-conversation `AbortController` map; `conversationId` on all agent-* messages |
| `UnifiedApprovalGate.ts` attribution | Approval requests/cards carry `conversationId` |
| Webview store reshape | `Map<conversationId, ConversationState>` + `activeConversationId` in `store.ts` |
| Multi-chat UI switcher | New/redesigned `ChatHistoryPanel.tsx` area — design routed through `ux-expert` |
| `parallelChats` feature flag | `features/flags.ts` entry, kill-switch semantics documented |
| `docs/development/architecture.md` update | Agent Runtime Architecture section + Sprint Architecture Gate entry |

## Implementation Checklist (phases — see `tasks.md` for the granular tracker)

### Phase 0: SDD Artifacts (part of Phase 2/PLAN)
- [ ] Author `spec.md` (R1-R7, acceptance criteria)
- [ ] Author `scenarios.md` (BDD examples incl. negative cases)
- [ ] Author `technical-plan.md` (workstreams, message shapes, ACP decision)
- [ ] Jarmo approves the completed SDD artifact set (in addition to this sprint-plan.md)

### Phase 1: Foundation — interface + webview store reshape (R1, R5)
- [ ] `AgentRuntime.ts` interface: add session-handle parameter to all methods
- [ ] `RuntimeRegistry.ts` / `UnifiedViewProvider.ts`: per-conversation `AbortController` map
- [ ] `conversationId` added to all outbound agent-* messages
- [ ] Webview `store.ts` reshape: `Map<conversationId, ConversationState>` + `activeConversationId`
- [ ] Send guards (`store.ts`, `ChatInput.tsx`) made per-conversation
- [ ] Inbound dispatch routes by `conversationId`
- [ ] Minimal "list of open chats" UI stub (not yet the full switcher) so Phase 2+ work is demoable

### Phase 2: Codex native multi-thread (R2 — cheapest proof)
- [ ] `CodexRuntime.ts` stops collapsing `_threadId`; routes by protocol thread id
- [ ] `UnifiedApprovalGate.ts` attribution wired for Codex approval requests
- [ ] Demo: two concurrent Codex chats streaming simultaneously

### Phase 3: Claude Code multi-session (R3)
- [ ] `agent/AgentRunner.ts` singleton audit (1235 LOC) — document every hidden global/singleton found
- [ ] `ClaudeCodeRuntime.ts`: `Map` of sessions replacing `_session`/`_pendingQuestions`
- [ ] Approval attribution wired for Claude
- [ ] Demo: two concurrent Claude chats streaming simultaneously

### Phase 4: ACP/OpenCode concurrency (R4 — hardest)
- [ ] Decision recorded in `technical-plan.md`: multi-session-in-subprocess vs. per-chat subprocess
- [ ] `AcpRuntime.ts`/`acpManager.ts` updated per decision
- [ ] Approval attribution wired for ACP
- [ ] Demo: two concurrent OpenCode chats streaming simultaneously

### Phase 5: Cross-runtime + UI polish (R6, R7)
- [ ] Multi-chat UI switcher (design via `ux-expert` routing) replaces the Phase-1 stub
- [ ] Per-chat running/attention indicators (#140-adjacent)
- [ ] Background-chat approval attribution verified end-to-end in the real UI
- [ ] `parallelChats` feature flag added; verified ON by default and disables concurrency when flipped off

### Phase 6: QA, Cleanup, Architecture Update
- [ ] Full QA matrix run (see below)
- [ ] `docs/development/architecture.md` updated (Sprint Architecture Gate)
- [ ] Debug code removed
- [ ] `qa-validator` recommended for Phase 4→5 sign-off and again for prod-build sign-off

## QA / Manual Test Plan

| Scenario | How to test |
|----------|--------------|
| Multi-runtime concurrent streaming | Start a Claude chat and a Codex chat simultaneously; confirm both stream independently, no interleaved/corrupted output |
| Same-runtime concurrent streaming | Two Claude chats (or two Codex, or two OpenCode) running at once |
| Approval in background chat | Trigger an approval-requiring action in a chat that is NOT currently focused; confirm the card is attributed correctly and actionable |
| Cancel one of two running | Cancel chat A while chat B is still streaming; confirm B is unaffected |
| Restart recovery | Kill/reload the app mid-multi-chat-session; confirm saved chats reload correctly per existing id-keyed persistence |
| Per-chat queue preserved | Send two prompts to the SAME busy chat; confirm the second still queues (not superseded by parallelization) |
| Flag kill-switch | Flip `parallelChats` off; confirm the sidebar falls back to single-conversation behavior without crashing |
| ACP subprocess model (whichever chosen) | If per-chat subprocess: confirm process count scales with open chat count and cleans up on chat close. If multi-session: confirm one subprocess correctly isolates two sessions' approvals/cancels |

## Sprint Exit: Dev-Mode Self-Validation (MANDATORY — before any handoff to Jarmo)

**Standing rule (Jarmo 2026-07-21):** Claude runs dev mode and validates the sprint's results HIMSELF before telling Jarmo anything is ready. Jarmo must never be the first person to find out the work doesn't run.

1. Launch dev mode: `/rundev` (`./vscode/scripts/code.sh` from project root — serves from `out/`; remember CSS/static assets do not auto-copy from `src/` to `out/`).
2. Drive the running instance and verify multiple threads streaming at once across runtimes, the rail (+ top / History bottom, spinner-vs-amber badges), switching without teardown, approval in a background thread, cancel-one-of-two, and reopen-from-History. Use the `ritemark-automation` CDP harness for scripted UI verification and screenshots; check the console for errors.
3. Fix whatever fails and re-verify — do not hand over a known-broken build.
4. Only then notify Jarmo: state what was verified, attach/describe evidence (screenshots for UI work), and name exactly what he should look at.

This step sits BEFORE `qa-validator` sign-off and before any release gate. It is not optional and not delegable to Jarmo.

## Risks

- ACP concurrency model choice (Phase 4) is the highest-uncertainty piece — a per-chat-subprocess fallback is more expensive at scale but far simpler to reason about; don't discover this mid-Phase-4, decide explicitly in `technical-plan.md` during Phase 0.
- `AgentRunner.ts` (1235 LOC) may have more hidden singleton state than the ground-truth audit above assumes — Phase 3 audit task exists specifically to surface this before code changes, not during them.
- Webview store reshape (Phase 1) is the highest blast-radius single change in the sprint — it touches state used by the entire AI sidebar. The `parallelChats` flag is the safety net; keep the flag functional through every phase, not just at the end.
- Sequencing with Sprint 100: if Sprint 100 (Claude/OpenCode binary bumps) lands first, Sprint 99's Claude/ACP multi-session work should be verified against the BUMPED binaries to avoid rework; if Sprint 99 lands first, its Claude/ACP phases need a light re-verification pass after Sprint 100's bump. Flag actual release sequencing as part of the "fold sprints into one release?" open question above.

## Status

**Track:** SDD
**Current Phase:** 3 (BUILD) — Phase 2 complete: [`spec.md`](spec.md) (R1–R15), [`scenarios.md`](scenarios.md) (75 scenarios), [`technical-plan.md`](technical-plan.md) all authored; singleton audit done
**Approval Required:** Plan approved by Jarmo 2026-07-21 ("approved", then "proceed")

## Approval

- [x] Jarmo approved this sprint plan (and, for SDD track, the completed spec.md/scenarios.md/technical-plan.md set once authored)

**Awaiting Jarmo approval — no code until approved.**

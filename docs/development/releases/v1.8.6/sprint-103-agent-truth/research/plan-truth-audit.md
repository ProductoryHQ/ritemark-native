# Sprint 103 — Plan & Mode Truth Audit

**Date:** 2026-08-03
**Author:** Claude (Phase 1/2 research for Sprint 103)
**Method:** source audit (`extensions/ritemark/src`, bundled SDK type defs) + official docs verification + **live reproduction in the dev instance** (CDP-driven, `ritemark.ai.debugTrace: true`)
**Evidence:** [`screenshots/`](./screenshots/) `00`–`07`, [`traces/`](./traces/) (Claude + Codex debug traces of the full session)

This audit answers, with evidence: **why plans are often not shown**, **why Auto mode plans silently**, and **what each runtime can actually guarantee** — before any UI redesign.

---

## 1. Executive summary of findings

| # | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| F1 | Claude "Plan" mode runs the SDK in `bypassPermissions` — nothing technically blocks writes during planning | High | `AgentRunner.ts:506` `_permissionModeForApproval()`; SDK docs |
| F2 | In `bypassPermissions`, the model's `ExitPlanMode` call **fails with a harness error** ("not currently in plan mode") and **never reaches `canUseTool`** → no plan card, the drafted plan text is lost | High | Trace 20:25:34–20:25:43; screenshot `02` |
| F3 | The plan card appears **only** when the model *happens to recover* by calling `EnterPlanMode` itself and then `ExitPlanMode` again — nondeterministic model behavior, which is exactly the "sometimes shows, sometimes doesn't" experience | High | Trace 20:25:46 → 20:31:04; screenshot `03` |
| F4 | The per-turn reminder "*Use ExitPlanMode when a reviewable draft plan is ready*" is injected on **every** turn in **every** mode (`CLAUDE_TURN_REMINDER`), so Claude plans autonomously in Auto mode too | High | `AgentRunner.ts:138–142`; trace 20:45:13 |
| F5 | In **Auto** mode ("agent acts without asking") the recovered `ExitPlanMode` **does** produce a blocking plan-approval card — the inverse of the mode's promise. Plan mode often shows no card; Auto mode does | High | Trace 20:45:39; screenshot `05` |
| F6 | The bundled SDK (0.3.217, CLI 2.1.217) natively supports everything we simulate by prompt: `permissionMode: 'plan'` (enforced read-only), `planModeInstructions`, live `setPermissionMode()`, and `canUseTool` routing for file/shell writes during planning | — | `sdk.d.ts:1700–1720, 2065, 2273`; agent-sdk permissions docs |
| F7 | `allowedTools` includes `ExitPlanMode` as a bare name — per SDK docs, bare-name allow rules **auto-approve and never reach `canUseTool`**; our plan card depends on canUseTool being reached | High | `AgentRunner.ts:124`; SDK permissions doc ("Auto-approved tools never reach canUseTool") |
| F8 | Crossing Auto/Plan ↔ Ask **closes and rebuilds** the Claude session → the agent silently loses all conversation memory on a mode switch | Medium | `ClaudeCodeRuntime.ts:96–111` |
| F9 | Codex Plan mode is the strongest today: native `collaborationMode: 'plan'`, a real review card, "No files changed yet", and a working continuation — but the plan turn still runs in a `workspace-write` sandbox, and in our run **no structured plan events** (`turn/plan/updated`, `item/plan/delta`) arrived: the card was populated by the text fallback | Medium | Codex trace 20:50:22–20:50:44; screenshots `06`,`07` |
| F10 | OpenCode "Plan" is a fiction: approval behavior identical to Ask, no plan instruction sent, no plan contract (ACP does define a `plan` session update + `session/set_mode`, unexercised by us) | High | `AcpRuntime.ts:439,489`; `acpManager.ts:368` |
| F11 | Truth bugs in the completed state: "Current plan" banner shows the **result text** as the plan; "Modified 6 files" counts non-workspace writes (`~/.claude/plans/*`); "Completed in 662.2s" includes ~5 min of waiting for the human | Medium | `lifecycle.ts:170–179` (`completedResultText || planText`); trace Write 20:31:03; screenshot `04` |
| F12 | Interaction history evaporates: the answered question card and the failed first plan attempt leave no trace in the transcript — the user cannot reconstruct what happened | Medium | Screenshots `02`→`03` diff; store.ts question handling |

Bottom line: **the runtime models behave well — the mode mapping and presentation layer lie about them.** Claude's own clarifying questions and plans in our runs were excellent; every failure was ours.

---

## 2. Current mode mapping (code-derived, verified)

What the three buttons actually configure today:

| Runtime | Auto | Ask | Plan |
| --- | --- | --- | --- |
| **Claude** (`AgentRunner._permissionModeForApproval`) | SDK `bypassPermissions` + `allowDangerouslySkipPermissions: true` | SDK `default`; mutating tools (`Bash/Write/Edit/NotebookEdit`) gated via `canUseTool` | **Same as Auto** (`bypassPermissions`) + 3-line prompt reminder (`CLAUDE_PLAN_TURN_REMINDER`) |
| **Codex** (`UnifiedViewProvider.ts:305–315`) | `approvalPolicy: never`, sandbox `workspace-write` | `approvalPolicy: untrusted`, sandbox `read-only` | `approvalPolicy: never`, sandbox `workspace-write`, native `collaborationMode: plan` + developer instructions |
| **OpenCode** (`AcpRuntime.ts:439,489`) | `session/request_permission` auto-approved | permission requests surfaced | **Identical to Ask** — no plan instruction, no plan contract |

Additional hidden mode levers (silent magic to remove or make explicit):

- `shouldStartCodexInPlanMode()` (`CodexRuntime.ts:89`) and webview `shouldRequestPlanMode()` (`lifecycle.ts:26`) flip a turn into plan mode when the prompt contains "plan mode" / "work in plan" / "enter plan mode" — regardless of the selected button.
- `CLAUDE_TURN_REMINDER` (every turn, every mode): "*Use ExitPlanMode when a reviewable draft plan is ready.*" (F4's root cause.)

---

## 3. Live reproduction — full timeline

Environment: dev instance (`./scripts/code.sh`, CDP :9224), fresh user-data-dir, `ritemark.ai.debugTrace: true`, workspace `/tmp/ritemark-s103-workspace` (README.md + itinerary.md fixtures). Traces archived in [`traces/`](./traces/).

### Repro A — Plan mode: plan not shown (F1–F3)

Steps: new thread → runtime Claude → mode **Plan** → prompt *"Split itinerary.md into one file per day (day-1.md, day-2.md, day-3.md) and update README.md to link to them."*

| Time (trace) | Event | User sees |
| --- | --- | --- |
| 20:25:11 | Turn starts. Session `permissionMode: bypassPermissions`, prompt prefixed with the Ritemark plan reminder | "Starting Claude…" |
| 20:25:16–25 | Reads files, drafts plan | activity ticker |
| 20:25:34 | Text "Here's my plan to review: …" + **`ExitPlanMode` call** | **nothing** — no `canUseTool` trace line, no card; the drafted plan is never rendered |
| 20:25:43 | Model: "*I need to enter plan mode first, since the harness reports I'm not currently in it.*" — the CLI rejected `ExitPlanMode` because the session is not in plan mode | nothing |
| 20:25:46 | Model recovers: calls **`EnterPlanMode`** itself | one transient ticker line |
| 20:25:52 | `AskUserQuestion` (good question, btw) | question card (screenshot `02`) — **still no plan anywhere** |
| 20:31:03 | A `Write` executes **before any approval** (plan file to `~/.claude/plans/…`; nothing blocks a workspace write either) | nothing |
| 20:31:04 | Second `ExitPlanMode` → **now** routed to `canUseTool` → plan card emitted | plan card (screenshot `03`) |
| 20:35:59 | User approves → `behavior: allow` → same-turn execution under `bypassPermissions` | files created; "Done", "662.2s", "Modified 6 files" (screenshot `04`) |

Key mechanism: **`ExitPlanMode` reaches `canUseTool` only when the CLI-side session believes it is in plan mode.** Ritemark never puts it in plan mode; only the model's own accidental `EnterPlanMode` recovery does. Whether that recovery happens is model-dependent → intermittent plan cards, lost plans, and "sometimes it doesn't respond at all" (the model gives up or the turn burns time in the recovery dance).

### Repro B — Auto mode: silent/inverted planning (F4–F5)

Steps: new thread → mode **Auto** → prompt *"Propose a plan for adding a packing checklist section to each day file. Do not implement it yet — I want to review the plan first."*

| Time | Event | User sees |
| --- | --- | --- |
| 20:37:24 | Explores files | ticker |
| 20:38:31 | `AskUserQuestion` (checklist content options) | question card |
| 20:45:13 | After answer: model calls **`EnterPlanMode` on its own** (nudged by our always-on reminder) | one ticker line, easy to miss |
| 20:45:37 | `Write` (plan file) during "planning" | nothing |
| 20:45:39 | `ExitPlanMode` → routed (CLI now in plan mode) → **blocking plan-approval card in Auto mode** | screenshot `05` |

So the *stated* contract is inverted: Plan mode frequently shows no plan; Auto mode ("acts without asking") can block on a plan approval. The mode buttons do not govern behavior; prompt phrasing and model whim do.

### Repro C — Codex Plan mode (F9)

Steps: new thread → runtime Codex (GPT-5.6-Sol) → mode **Plan** → prompt *"Reorganize README.md: move the Destinations list into its own destinations.md and link it. Plan the change."*

- Thread started with `approvalPolicy: never`, **sandbox `workspace-write`**, `collaborationMode: {mode: 'plan', …}` (trace 20:50:22).
- During the plan turn Codex ran a shell command (read-only `sed`/`find`) — allowed by the sandbox; a write would have been allowed too.
- Turn completed in 21.7s. **Zero** `item/plan/delta` / `turn/plan/updated` events — the review card was populated from streamed text (the `finalizeCodexTurnResult` fallback).
- UI: "Codex is waiting for plan review" + plan + "No files changed yet." + **Approve & continue / Discard** (screenshot `06`). Approval sent the continuation turn; `destinations.md` created correctly (screenshot `07`).

Codex is the model to generalize: the *presentation contract* (card, no-files-yet claim, explicit continuation) works. Gaps: plan-turn sandbox is not read-only (the "No files changed yet" claim is unverified trust), and structured plan events cannot be relied on — the text fallback is the real path.

### Repro D — OpenCode (F10)

Not runnable in the fresh automation profile (BYOK keys live in profile secret storage; picker shows "Add API keys to use OpenCode"). Code-derived behavior stands: `AcpRuntime` treats `plan` identically to `ask` for approvals and sends no plan instruction; `acpManager` maps the ACP `plan` session update to `plan_text` if the agent ever sends one. **Live verification on a keyed profile is a Phase 1 task** — including whether the bundled OpenCode 1.18.4 advertises ACP session modes (`session/new` → `modes`, switchable via `session/set_mode`), which would be the honest path to a real OpenCode plan mode later.

---

## 4. What the platform actually provides (docs-verified)

### Claude Agent SDK 0.3.217 / CLI 2.1.217 (bundled)

- `permissionMode: 'plan'` — "Planning mode, no execution of tools". File edits are **never** auto-approved in plan mode, even with an allow rule; they prompt through `canUseTool`. Since CLI 2.1.212, file-modifying shell commands (`touch`, `rm`, …) also route to `canUseTool` during planning. Our bundled CLI is 2.1.217 → qualifies.
- `planModeInstructions` — replaces the default plan-mode workflow body; the CLI still wraps it with the read-only enforcement preamble and the ExitPlanMode protocol footer. This is where Ritemark's "plan for a markdown workspace" voice belongs — instead of our hand-rolled reminder.
- `setPermissionMode(mode)` — live mode switch mid-session (streaming input mode, which we use). Removes both the Ask-boundary session rebuild (F8) and any need for `bypassPermissions` in the plan flow.
- `canUseTool` results can carry `updatedPermissions` (e.g. `{type: 'setMode', mode: 'acceptEdits', destination: 'session'}`) — the documented way to approve a plan *and* transition the session into the execution mode in one step.
- **Critical caveat** (permission-modes doc): "In sessions with bypass permissions available, Claude Code doesn't enforce plan mode's blocks." → a session that sets `allowDangerouslySkipPermissions: true` can never have an enforced plan mode. The flag must go entirely, not just in plan mode.
- Bare-name `allowedTools` entries auto-approve and **never reach `canUseTool`** (F7); the SDK even warns (`CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`). `AskUserQuestion` is exempt (always prompts). `ExitPlanMode`'s exemption is *not* documented — it must not sit in `allowedTools`.

Sources: [permission modes](https://code.claude.com/docs/en/permission-modes), [Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions), bundled `sdk.d.ts`.

### Codex app-server 0.144.4 (bundled)

- `collaborationMode: {mode: 'plan', settings…}` on `turn/start` — native, works (used today).
- `turn/plan/updated` / `item/plan/delta` exist in the protocol but are **not guaranteed per turn** (0 events in our run); official docs mark collaboration modes experimental. Treat structured plan steps as progressive enhancement; the text plan is the contract.
- Sandbox and `approvalPolicy` are **fixed at `thread/start`** — switching requires the existing thread-reset machinery (`_threadApprovalKey`).

### OpenCode / ACP

- ACP defines a `plan` session update (agent → client plan entries; already mapped to `plan_text`) and **session modes** (`session/new` returns available modes; `session/set_mode` switches). Whether bundled OpenCode exposes a plan-like mode is unverified (Phase 1 audit item). Until verified, OpenCode has **no enforceable plan contract** — the honest UI hides Plan for it. Source: [ACP session modes](https://agentclientprotocol.com/protocol/session-modes).

---

## 5. Technical conclusions (feed into spec/technical-plan)

1. **Claude:** stop simulating plan mode. Map Ritemark Plan → SDK `permissionMode: 'plan'`; drop `allowDangerouslySkipPermissions` everywhere; move Auto from `bypassPermissions` to `acceptEdits` + auto-allow-in-`canUseTool` (behaviorally identical for our tool surface, keeps plan enforceable, removes the dangerous flag); remove `ExitPlanMode` from `allowedTools`; on plan approval, respond `allow` + `updatedPermissions setMode` to the user's autonomy policy; switch modes with `setPermissionMode` instead of session rebuilds.
2. **Claude prompts:** delete the plan lines from `CLAUDE_LIFECYCLE_APPEND`/`CLAUDE_TURN_REMINDER` (non-plan turns must not nudge `ExitPlanMode`); express Ritemark plan-mode voice via `planModeInstructions`.
3. **Autonomous planning must be visible, not suppressed:** if the model still enters plan mode on its own (it may), the UI labels it ("Claude chose to plan first") and shows the same review card. Never a silent ticker line.
4. **Codex:** keep the native plan collaboration mode; run plan turns in a `read-only` sandbox (extend `_threadApprovalKey` so the reset machinery handles it); keep the text-plan fallback as the primary contract; treat structured plan steps as enhancement.
5. **Remove silent prompt-sniffing** (`shouldStartCodexInPlanMode`, `shouldRequestPlanMode`) — mode is an explicit user choice; text like "plan mode" in a prompt must not secretly retarget permissions.
6. **OpenCode:** hide Plan until a verified contract exists; audit ACP session modes on the bundled binary first.
7. **State/labels:** "Done" only when the turn result arrived *and* no interaction is pending; separate active time from human-wait time; count only workspace-relative files in "Modified N files"; the approved-plan banner must show the plan, not the result text; resolved questions/plan attempts stay in the transcript.

## 6. Decision

**Ship Sprint 103 on this basis** — no blockers found; every needed platform capability exists in the bundled binaries. Two audit items remain inside the sprint (Phase 0 spikes, results recorded here):

- SDK spike: verify with 0.3.217 that (a) `ExitPlanMode` reliably reaches `canUseTool` in `permissionMode: 'plan'`, (b) mutating tools are denied during planning, (c) `setPermissionMode` + `updatedPermissions setMode` behave as documented across turns of one session.
- OpenCode spike: probe `session/new` modes on bundled OpenCode 1.18.4 with a keyed profile.

### Phase 0 spike results (2026-08-04)

Run: [`spikes/sdk-plan-mode-spike.mjs`](./spikes/sdk-plan-mode-spike.mjs) against the bundled SDK/CLI (model `claude-opus-4-8[1m]`).

| Assert | Result |
| --- | --- |
| A — `ExitPlanMode` reaches `canUseTool` on the FIRST call in `permissionMode:'plan'` | **PASS** — no EnterPlanMode recovery dance needed |
| B — writes blocked during planning | **PASS, stronger than expected** — the model attempted a `Write` (sneaky.md) mid-plan; the **CLI denied it internally** without even consulting `canUseTool`; no file was created. Keep the `canUseTool` denial as cheap defense-in-depth, but enforcement is CLI-level |
| C — approve + `updatedPermissions [{type:'setMode', mode:'acceptEdits', destination:'session'}]` | **PASS** — the planned `Edit` executed in the same turn with zero further prompts |
| D — `setPermissionMode('default')` between turns + conversation memory | **PASS** — turn 2 recalled the approved plan's content on the same session |

Side confirmation of F7: the SDK emitted `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` for the bare `Read/Glob/Grep` allow entries — bare `allowedTools` names never reach `canUseTool`, exactly as the audit claimed for `ExitPlanMode`.

**Decision: implement as planned (W1).** OpenCode ACP-modes spike deferred to a keyed-profile session; not a blocker for R6 (Plan stays hidden for OpenCode regardless).

# Sprint 103 Spec — Truthful Agent Plans and Activity State

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Issues:** [#132](https://github.com/ProductoryHQ/ritemark-native/issues/132), [#161](https://github.com/ProductoryHQ/ritemark-native/issues/161) · **Evidence base:** [research/plan-truth-audit.md](./research/plan-truth-audit.md) (findings F1–F12)

## Purpose

Make the mode controls, plan flow, and activity status tell the truth. Today the Plan button does not put Claude in plan mode (F1), plan cards appear only by model accident (F2–F3), Auto mode plans and blocks without saying so (F4–F5), OpenCode's Plan button is a fiction (F10), and "Done"/"Modified N files" overstate what happened (F11). After this sprint, every visible mode, card, and status is backed by an enforced runtime behavior or it is not shown.

## Principles

- **Truth over parity.** A control appears for a runtime only if that runtime can honor it. Unequal runtimes get unequal UI.
- **Two axes, not three buttons.** *Autonomy policy* (does the agent ask before mutating?) and *plan-first collaboration* (draft a reviewable plan before executing) are independent concepts.
- **Enforcement over prompt-politeness.** "Do NOT edit files" as prose is a request; a permission mode is a guarantee. Plan mode must be the latter.
- **Autonomous agent behavior is surfaced, never suppressed.** If the model chooses to plan or ask, the user is told plainly.
- **No silent magic.** No prompt-text sniffing that flips modes; no hidden session rebuilds that drop context.

## Requirements

### R1: Two-axis mode model

As a user, I want one clear autonomy choice and a separate plan-first action, so the controls match what actually happens.

Acceptance criteria:
- The internal turn configuration carries two independent fields: `autonomy: 'manual-review' | 'work-automatically'` and `planFirst: boolean`, replacing the single `'auto' | 'ask' | 'plan'` enum at the runtime boundary (a compatibility mapping may remain at the storage/message layer).
- `planFirst` (UI label: **"Plan"**, decision D2) is a per-thread session state: switching it on applies to subsequent turns until a plan is **approved**, at which point it auto-resets to off. Cancelling or discarding a plan does NOT reset it — no plan was approved yet; the user can always toggle it manually.
- Prompt-text sniffing that changes modes (`shouldStartCodexInPlanMode`, `shouldRequestPlanMode`) is removed; only explicit UI state selects plan-first.
- Every turn's effective configuration (autonomy, planFirst, runtime, SDK/native mode used) is visible in the debug trace.

### R2: Claude plan mode is enforced, and the plan is always shown

As a user who picks Plan, I want Claude to actually run in plan mode and always end with a reviewable plan card, so no work happens before I approve.

Acceptance criteria:
- Plan-first Claude turns run with SDK `permissionMode: 'plan'`. `allowDangerouslySkipPermissions` is not set on any Ritemark session in any mode (audit F6 caveat: its mere availability disables plan enforcement).
- `ExitPlanMode` is not in `allowedTools` (F7); the plan approval card renders on every `ExitPlanMode`, verified by the Phase 0 SDK spike and a regression test.
- During a plan-first turn, mutating tools (`Write`, `Edit`, `NotebookEdit`, file-modifying `Bash`) that reach `canUseTool` are denied with a plan-phase message; no workspace file changes before approval (Repro A regression: the 20:31:03 pre-approval `Write` class of writes must be non-workspace or denied).
- Approving the plan responds `allow` with `updatedPermissions: [{type:'setMode', mode: <user's autonomy policy>, destination:'session'}]`, and execution continues in the same conversation without a session rebuild.
- Rejecting with feedback keeps the session in plan mode and returns the feedback to the model ("Keep planning").
- The Ritemark plan-mode voice moves from the hand-rolled turn reminder into `planModeInstructions`; `CLAUDE_LIFECYCLE_APPEND`/`CLAUDE_TURN_REMINDER` no longer mention `ExitPlanMode` on non-plan turns (F4 root cause removed).

### R3: Claude mode changes never lose conversation context

As a user, I want to switch between Manual and Auto mid-thread without the agent forgetting our conversation.

Acceptance criteria:
- Autonomy changes between turns use `setPermissionMode()` on the live session; `ClaudeCodeSession.applyConfig` no longer closes/rebuilds the session when crossing the Ask boundary (F8).
- A session is rebuilt only for model change or process death, and a rebuild is surfaced in the transcript ("New session started — previous context not carried over") rather than silent.
- Autonomy mapping without the dangerous flag: `work-automatically` → SDK `acceptEdits` with remaining prompts auto-allowed in `canUseTool`; `manual-review` → SDK `default` with mutating tools gated (current Ask behavior preserved).

### R4: Autonomous planning and questions are truthfully surfaced

As a user in any mode, when the agent decides on its own to plan or to ask, I want that shown as a first-class event, so nothing blocks or happens silently.

Acceptance criteria:
- If Claude enters plan mode autonomously (model-initiated `EnterPlanMode`), the transcript shows a labeled event ("Claude chose to plan first") and the resulting plan uses the same review card as user-requested plans (Repro B regression).
- If Codex emits autonomous plan updates during a non-plan turn, they render as progress (existing behavior), never as a blocking review gate.
- A turn that ends while a plan card, question card, or approval card is pending is presented as "waiting for you", not "Done" (ties to R7).
- Resolved cards (questions answered, plans approved/rejected, earlier failed plan attempts) remain in the transcript as collapsed history (F12).

### R5: Codex plan turns are hardened

As a user who picks Plan with Codex, I want the "No files changed yet" claim to be enforced, not merely narrated.

Acceptance criteria:
- Plan-first Codex turns start (or reset onto) a thread with sandbox `read-only`; the continuation-after-approval turn restores the configured write sandbox. Thread resets reuse the existing `_threadApprovalKey` machinery extended with the plan flag.
- The plan review card populates from the text plan as the primary contract; `turn/plan/updated` steps, when present, enhance it (F9: zero structured events in the live run must still yield a complete card).
- Approve & continue / Keep planning (with feedback) / Cancel all work; "Keep planning" sends the feedback as a follow-up plan-mode turn rather than silently discarding the plan.

### R6: OpenCode capability truth

As an OpenCode user, I want to see only controls OpenCode honors.

Acceptance criteria:
- Plan-first is not offered when the active runtime is OpenCode (hidden or disabled with an explanatory tooltip — design decision in design.md), because no enforceable plan contract exists (F10).
- A per-runtime capability map (single registry module) drives which controls render; no component hardcodes runtime names for capability checks.
- Phase 0 spike result recorded in the audit: whether bundled OpenCode advertises ACP session modes. If it does, enabling a real OpenCode plan mode is a **new requirement for a future sprint**, not silent scope growth here.

### R7: Truthful activity state and completion (#161)

As a user, I want the thread to say "Done" only when it is actually done, and to distinguish what it is waiting for.

Acceptance criteria:
- A conversation-level activity state is derived in one place with the vocabulary: `running`, `waiting-approval`, `waiting-input`, `plan-review`, `done`, `failed`, `cancelled`. The thread rail's `attention` maps from the three waiting states (existing `threadStatus.ts` logic extends, not forks).
- The chat surface shows the current state as a status line; "Done" (result summary) appears only when the runtime reported turn completion AND no card is pending.
- Turn duration reporting separates active runtime time from time spent waiting on the user; the headline number is active time (Repro A regression: "Completed in 662.2s" for ~90s of agent work).
- "Modified N files" counts only workspace-relative paths; runtime-internal writes (e.g. `~/.claude/plans/*`) are excluded (F11).
- The approved-plan banner shows the approved plan (with live step status when available), never the turn's result text (F11, `getActiveApprovedPlanForClaude`).
- No invented signals: where a runtime provides no authoritative background-work information, the UI says nothing rather than guessing (issue #161 boundary).

### R8: Compact capability-aware mode control

As a user, I want one small, honest control instead of three tiny buttons that overpromise.

Acceptance criteria:
- The composer footer control is: an autonomy select with exactly two options — labels **Manual** / **Auto** (decided D1, 2026-08-04), with one-line descriptions carrying the semantics — plus a separate **Plan** toggle chip (decided D2), per design.md.
- The control renders per the runtime capability map (R6); switching runtime updates it without losing composer text.
- Selected autonomy persists per thread; the Plan chip behaves per R1 (auto-reset on approval only).
- Existing threads/storage with the old `auto/ask/plan` value migrate losslessly (`plan` → `work-automatically` + planFirst on; `ask` → `manual-review`; `auto` → `work-automatically`).

### R9: Regression test set and visual evidence

As the team, we want the plan/mode contract pinned by repeatable tests so it cannot silently regress.

Acceptance criteria:
- Unit tests cover: mode mapping per runtime (R1–R3), plan approval/rejection flows including `updatedPermissions` payloads (R2), capability gating (R6), activity-state derivation and duration/file-count rules (R7), storage migration (R8).
- A CDP-driven scripted run (extending the audit's repro method) executes the runtime matrix — Claude plan / Claude auto-with-autonomous-plan / Codex plan / OpenCode no-plan — captures screenshots into the sprint's `research/screenshots/`, and asserts: plan card presence, no pre-approval workspace writes, truthful status line.
- The scenarios in [scenarios.md](./scenarios.md) are the manual QA matrix; each maps to a requirement ID.

## Non-Requirements

- No fourth runtime; no runtime-specific approval message types (locked architecture).
- No prompt queue changes (Sprint 104) — but state vocabulary from R7 is designed so Sprint 104's "ready to drain" check can consume it.
- No durable plan storage across app restarts; no plan editing in place (approve/feedback/cancel only).
- No OpenCode plan-mode implementation this sprint (R6 records the audit only).
- No broad AI-sidebar visual redesign beyond the surfaces named in design.md.
- No invented background-work indicators beyond authoritative runtime signals (#161 boundary).

## Resolved Questions

- *Why do plan cards appear only sometimes?* — Answered with evidence: audit F2/F3 (CLI-side plan-mode state gates `ExitPlanMode` routing; Ritemark never sets it).
- *Can we keep bypassPermissions for Auto and still enforce Plan?* — No: bypass availability disables plan enforcement session-wide (audit §4). Hence R3's `acceptEdits`+canUseTool mapping.
- *Is the Codex structured plan protocol reliable?* — No (F9): text plan is the contract, steps are enhancement.

## Open Questions (product decisions — status mirrored in sprint-plan.md)

- D1: **Decided 2026-08-04** — UI labels are **Manual / Auto** (Jarmo: shorter); option descriptions carry the semantics.
- D2: **Decided 2026-08-04** — chip label is **"Plan"**; stays on until a plan is Approved (auto-reset on approval only; cancel keeps it on).
- D3: **Decided 2026-08-04** — OpenCode Plan control is **hidden**.
- D4: **Decided 2026-08-04** — prompt-text mode sniffing is removed; the Plan chip is the only explicit path (model-initiated planning surfaces per R4).
- D5: **Decided 2026-08-04** — Claude Auto backend moves to `acceptEdits` + auto-allow; `bypassPermissions` is removed everywhere.

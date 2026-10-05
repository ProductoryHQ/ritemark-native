# Sprint 128 — Background agent turns: show what Claude's background subagents are really doing

Track: SDD (auto-detected: eleven user-facing requirements; multi-component flow SDK stream → AgentSession → host → conversation store → webview; turn-ownership race in a persistent session)<br>
Override with: "use plain full track"<br>
Release tier: **extension** by path (everything is under `extensions/ritemark/src/` and `extensions/ritemark/webview/`; the Agent SDK 0.3.289 / CLI 2.1.289 that v1.13.0 already bundles ships every message this sprint needs). It **ships inside the shell-tier v1.13.0**, so the extension-tier gate does not apply to it. **No VS Code patch, no `binaries/agents/` change, no new esbuild external expected.** If a Phase 0 probe shows otherwise (for example that the bundled CLI needs a newer version for `perTaskStopAffordance`), stop and flag it to Jarmo.<br>
Status: **Phase 2 (PLAN) — written 2026-10-05, awaiting Jarmo's approval. No implementation, no branch yet.**<br>
Branch: `sprint-128-background-agent-turns` (created from `main` only after approval, before the first code edit)<br>
Release: [v1.13.0](../release-plan.md)<br>
Issue: none yet. Jarmo asked for the sprint directly on 2026-10-05 (option B, "the real fix"). Create one under milestone `v1.13.0` when the plan is approved (task T0.1).

## SDD Artifacts

- [spec.md](./spec.md) — behaviour contract (R1–R11).
- [scenarios.md](./scenarios.md) — BDD matrix (S1–S34); becomes the dev-instance QA matrix.
- [technical-plan.md](./technical-plan.md) — workstreams W0–W8, message shapes, files to change, test strategy, architecture-gate note.
- [tasks.md](./tasks.md) — implementation checklist.
- [research/background-subagents-audit.md](./research/background-subagents-audit.md) — Phase 0 audit input (official SDK behaviour, current code, gaps, options A/B/C).

## Goal

When Claude works through background subagents, Ritemark tells the truth at every moment: which tasks are running, finished or stopped; whether the turn is really over; and what Claude did when it came back on its own. The user can stop any one task.

## Why

Observed 2026-10-05 (see the audit TL;DR): Ritemark showed "Done in 2m 24s" while subagent cards kept spinning. About 2.5 minutes later the Claude Code process started an automatic follow-up turn (a `task-notification`), wrote a Markdown file and answered. Ritemark dropped all of it. The work finished and the main agent did come back, but the user saw neither, and could not tell "finished" from "stuck".

Root causes, each verified against the code in this plan (file:line in [technical-plan.md](./technical-plan.md#verified-code-facts)):

1. The turn is closed at the first `result`. Everything after it goes to a no-op emitter.
2. Subagent cards are created with the `tool_use` id and completed with the task's own id, so they never match. A foreground card has no completion signal at all.
3. Only `task_notification` and `tool_progress` are read. `task_started`, `task_updated`, `task_progress`, `background_tasks_changed`, `session_state_changed` and every `origin` are ignored.
4. Nothing asks the SDK for a per-task stop, so Stop kills background agents silently, and so do a model switch and an error disposal.
5. Found while planning: the per-turn inactivity timer is restarted by any message that arrives after `result` and then calls `interrupt()` on an idle session. That can kill background tasks fifteen minutes (the default) after the last message. See R3.

## Scope

In scope (option B from the audit, extension-tier):

- **Honest status.** Cards keyed by `tool_use_id` (fallback `task_id`); foreground cards complete on the Agent `tool_result`; `task_started`, `task_updated`, `task_progress`, `task_notification` and `background_tasks_changed` (ambient tasks ignored) handled; task events keep flowing after `result`; a turn that ends with tasks still running says so.
- **Runtime-initiated turns.** A `task-notification` follow-up turn appears in the same conversation as a new turn (streamed, activity shown, file changes reported, explorer refreshed, persisted). Turns are matched to results by `origin`. User prompts are sent with `origin: { kind: 'human' }`. `session_state_changed: 'idle'` is the "all work finished" signal.
- **Control.** `perTaskStopAffordance: true` plus `Query.stopTask(taskId)` behind a stop button on each running card. Stop of the main turn says what it did to background work. A model switch or disposal that would end live background tasks warns first, or says afterwards when there was no choice.
- **The audit's unverified risk** (a human prompt sent while a hidden follow-up turn runs resolves the wrong turn) is reproduced or ruled out in Phase 0 with a probe script, and is covered by scenarios S18–S21.

Out of scope:

- Codex and OpenCode (ACP). The shared `AgentRuntime` interface grows only **optional** members, and those two runtimes implement nothing: they never call the new callbacks and have no `stopBackgroundTask`. See [spec.md](./spec.md#r10-the-shared-runtime-interface-grows-only-optionally).
- Flows (`runAgent`, string prompt = closed input). Per the headless doc the CLI stays open there until background subagents finish. Not verified in Ritemark and not changed.
- Option C (`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`). **Rejected alternative:** it makes every subagent foreground and "Done" true, but also removes background Bash and Monitor and the "keep chatting while it works" behaviour. It stays in the audit as a documented fallback if Phase 0 shows B cannot be made safe.
- New settings or a Settings page entry. No new feature flag (see [Feature Flag Decision](#feature-flag-decision)).

## Requirement Traceability

| Requirement | Scenarios | Workstreams | Close evidence |
|---|---|---|---|
| R1 cards resolve to the truth | S1–S7 | W2, W5 | stream unit tests + dev-instance run |
| R2 the turn end says what is still running | S8–S11 | W2, W5 | `activityState` tests + dev-instance run |
| R3 task events and the idle signal survive past `result`; no stray interrupt | S12–S14 | W1, W2 | stream unit tests (incl. timer test) |
| R4 a runtime-initiated turn is a real turn | S15–S17 | W3, W4, W5 | stream + controller tests + dev-instance run |
| R5 results belong to the right turn | S18–S21 | W0, W1 | probe evidence + ownership unit tests |
| R6 idle means all work finished | S22–S23 | W1, W5 | stream unit tests |
| R7 stop one task | S24–S26 | W6 | unit tests + dev-instance run |
| R8 Stop of the main turn is honest | S27–S28 | W6 | unit tests + dev-instance run |
| R9 no silent kill of live background work | S29–S31 | W6 | unit tests + dev-instance run |
| R10 shared interface grows only optionally | S32 | W3 | typecheck + Codex/ACP tests unchanged |
| R11 plain language, existing surfaces | S33–S34 | W5 | design review + screenshots |

## Product Decisions

- **2026-10-05 (Jarmo):** option B, "the real fix", over A (status only) and C (no background subagents).
- **2026-10-05 (proposed with this plan, accepted with approval):**
  - **P1 — Reuse existing surfaces.** The subagent card, the activity status line (the "Done in…" row) and the activity feed carry every new state. The only new control is a stop button on a card that already exists.
  - **P2 — Never claim "done" without evidence.** A card finishes only on a completion signal from the SDK, or is closed as "ended" by the idle sweep (R6). It is never finished by a guess.
  - **P3 — No new feature flag.** The partial states this sprint removes (cards spinning forever, an answer nobody sees) are the defect; a flag would keep them reachable. Revert is by PR.
  - **P4 — Phase 0 comes first.** The probes in W0 can change the design (see the decision points in the technical plan). They run before any product code.

## Pre-Implementation Gate

- Sprint Architecture Gate applies: this sprint adds optional members to `AgentRuntime` / `RuntimeSessionConfig` / `RuntimeSession`, new host↔webview message types (`agent-turn-started`, `agent-background-tasks`, `agent-stop-task`) and a conversation event origin. `docs/development/architecture.md` is updated before the sprint closes (task T8.1).
- Needs Jarmo before the sprint starts: the open questions at the end of this file.
- Phase 0 evidence that needs credentials (a Claude subscription or API key and a real background subagent) can only be gathered on Jarmo's machine or with his account. The plan names exactly what that is in [technical-plan.md](./technical-plan.md#what-cannot-be-proven-without-credentials).

## Success Criteria

- [ ] In the observed scenario, Ritemark says "Done — 1 task still running in the background" instead of "Done in 2m 24s", the card shows it is running, and when the task ends the card says so (R1, R2).
- [ ] The automatic follow-up turn appears in the conversation with its text, activity and file changes, and survives a sidebar reload (R4).
- [ ] No result is ever attached to the wrong turn, proven by the Phase 0 probe and the ownership tests (R5).
- [ ] One background task can be stopped without ending the others or the conversation (R7).
- [ ] Stop, model switch and disposal never end live background tasks without saying so (R8, R9).
- [ ] Codex and OpenCode behave exactly as before; their existing tests are untouched and green (R10).
- [ ] `npm test`, the extension typecheck and the webview typecheck pass; the pre-commit validator passes on the rebuilt `media/webview.js`.
- [ ] A dev-instance run with a real background subagent matches scenarios S1–S31, with anything that could not be run named plainly.

## Open Questions for Jarmo

Plain-language decisions only. The plan proposes a default for each, so none blocks approval.

1. **The words for "still running".** Proposed status line: "Done — 1 task still running in the background" (and "2 tasks"). The card says "Running in the background". When Claude comes back on its own, the new turn starts with one muted line: "A background task finished — Claude is continuing". Are these the words you want?
2. **Should Claude's automatic follow-up tell you when the sidebar is not visible?** Today no turn completion shows a pop-up at all. Proposed: no pop-up in this sprint; the status line and the rail already change colour. If you work in several windows and want a pop-up, say so and it becomes a small extra task.
3. **Switching the model while background tasks run.** Switching starts a new session, which ends running tasks. Proposed: ask first ("Switching to this model ends 1 running background task. Switch anyway?") in a normal dialog. The alternative is no question, only a line afterwards. A forced end (a crash, a sign-in failure) is always just reported afterwards.
4. **What a new message does while Claude is busy with its own follow-up.** Proposed: your message waits in the queue until the follow-up finishes, and the status line says so. The alternative is to let your message go in at once, which depends on how Claude Code handles it. Phase 0 measures that; if the measurement says "safe", you can choose the faster behaviour.
5. **Stopping everything at once.** Proposed: the existing Stop button stops only the current turn and says "1 task still running in the background"; each task has its own stop. Do you also want a "stop all background tasks" action? (Nothing new is planned for it.)

## Approval

- [ ] Jarmo approved this sprint plan

## Sprint close (2026-10-05)

**Branch:** `sprint-128-background-agent-turns` · **Issue:** #393 · Jarmo approved the plan with the default answers to the five open questions.

**Phase 0:** all seven decisions settled on the bundled CLI ([research/phase0-findings.md](research/phase0-findings.md)). D1 and D2 changed the design: the follow-up turn opens with `system:init`, and "all finished" is an empty live set (no `session_state_changed` by default). D6 passed, so per-task stop shipped.

**Found and fixed during the sprint (not in the original plan):**
- Ask mode failed open outside a human turn: a background subagent's or a follow-up turn's file change or command ran without approval. Approvals and questions now go through the live channel to the same gate.
- `task_updated` and `task_notification` both completed a card; only the notification does now.
- shadcn Button's `has-[>svg]:px-3` widened the card header padding; fixed on the card.

**Verified on a dev instance with real Claude (Sonnet 5.5, then Opus 5.5):** a background subagent shows "Running in the background" with its own stop button; the status line reads "Done — 2 tasks still running in the background" on two lines at 300 px; Claude's follow-up turns appear with the header line and the final answer; the card ends ✓ with its result; the card's stop ends the task as "Stopped" and Claude explains in a follow-up; the model-switch dialog appears with live work; after "Switch", "1 background task ended with the session." is shown.

**Not run:** the main Stop with tasks still running (S27), widths 250 and 223 px, Windows, a multi-minute task against the 15-minute timer (covered by a unit test with a short timeout), and an 'ask'-mode approval raised live by a background subagent (covered by a unit test: the write waits for the gate and a rejection blocks it).


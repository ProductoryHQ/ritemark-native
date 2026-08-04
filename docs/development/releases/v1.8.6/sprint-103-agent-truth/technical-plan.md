# Sprint 103 Technical Plan

Architecture and implementation approach for [spec.md](./spec.md). Grounded in [research/plan-truth-audit.md](./research/plan-truth-audit.md); reread §5 before touching code.

## Architecture Overview

Components touched:

```
webview (React)                         extension host                        runtime processes
──────────────────                      ─────────────────────────             ─────────────────
ChatInput mode control  ──agent-execute──▶ UnifiedViewProvider ──config──▶ ClaudeCodeRuntime → AgentRunner → claude CLI (SDK)
store.ts / lifecycle.ts ◀─progress/cards── (mode mapping W1/W2)          ──▶ CodexRuntime → codex app-server
threadStatus.ts (rail)                    runtime/capabilities.ts (NEW)  ──▶ AcpRuntime → opencode (ACP)
PlanReviewCard / ActivityStatus
```

One new shared module: `extensions/ritemark/src/runtime/capabilities.ts` (per-runtime capability map, R6). Everything else is surgery on existing files — no new subsystems, no locked-decision changes (unified approval gate and `AgentRuntime` interface stay; the `RuntimeSessionConfig.approvalMode` field is *extended*, not forked per-runtime).

Turn configuration model (R1):

```typescript
// runtime/AgentRuntime.ts — replaces approvalMode at the runtime boundary
export interface TurnPolicy {
  autonomy: 'manual-review' | 'work-automatically';
  planFirst: boolean;
}
// Compatibility: webview messages/storage may still say 'auto'|'ask'|'plan';
// UnifiedViewProvider maps old→new at the boundary (R8 migration).
```

## Workstream 0: Audit spikes (Phase 0 — before implementation)

Two short, throwaway verifications; results appended to the audit doc.

1. **SDK plan-mode spike** (script under `research/spikes/`, run with the bundled CLI): one streaming session; assert (a) `permissionMode:'plan'` routes `ExitPlanMode` to `canUseTool` on the *first* call; (b) `Write`/`Edit`/`touch` reach `canUseTool` during planning and can be denied without killing the turn; (c) `canUseTool` allow + `updatedPermissions [{type:'setMode', mode:'acceptEdits', destination:'session'}]` transitions the session; (d) `setPermissionMode()` between turns preserves conversation memory.
2. **OpenCode ACP modes spike**: on a keyed profile, log `session/new` response `modes` from bundled OpenCode 1.18.4. Record only; no implementation (R6).

## Workstream 1: Claude permission-mode rework (R2, R3, R4)

### Extension host — `src/agent/AgentRunner.ts`

- Mode mapping (`_permissionModeForApproval` → renamed `_sdkModeFor(policy)`):
  - `planFirst` → `'plan'`
  - `work-automatically` → `'acceptEdits'`
  - `manual-review` → `'default'`
  - **Delete** the `bypassPermissions` branch and `allowDangerouslySkipPermissions` (audit F6 caveat).
- Session options: add `planModeInstructions` (Ritemark plan voice — markdown-workspace phrasing, moved from `CLAUDE_PLAN_TURN_REMINDER`); remove `ExitPlanMode` from the `allowedTools` array passed to the SDK (F7) — it stays in the tools available to the model (the CLI provides it), just never auto-allowed.
- `_handleCanUseTool`:
  - `ExitPlanMode` → existing card flow; on approve return `{behavior:'allow', updatedInput, updatedPermissions:[{type:'setMode', mode: _sdkModeFor({...policy, planFirst:false}), destination:'session'}]}`; on reject return deny with feedback (session stays in plan).
  - During `planFirst`, deny mutating tools that arrive anyway (defense-in-depth; SDK routes them in plan mode): message "Ritemark plan phase: file changes wait for plan approval."
  - `work-automatically`: auto-allow everything that falls through (this preserves today's Auto behavior without the dangerous flag).
  - `manual-review`: current Ask gating unchanged.
- Prompt hygiene: remove plan lines from `CLAUDE_LIFECYCLE_APPEND` and `CLAUDE_TURN_REMINDER` (F4). Keep AskUserQuestion lines.
- Autonomous plan detection stays via `EnterPlanMode`/`ExitPlanMode` tool_use blocks (`updatePlanModeState`), now emitting a dedicated progress type `plan_autonomous` for R4 labeling.

### Extension host — `src/agent/ClaudeCodeRuntime.ts`

- `applyConfig`: drop the Ask-boundary close/rebuild (F8). Between turns call `session.setPolicy(policy)`, which internally uses `queryStream.setPermissionMode(...)` when the SDK mode changes. Rebuild only on model change; emit a `session_reset` progress event so the webview can announce it (R3).
- Delete `CLAUDE_PLAN_TURN_REMINDER` prompt prefixing (replaced by `planModeInstructions`).

### Tests

- `AgentRunner.test.ts`: mode mapping table; ExitPlanMode approve/reject payloads incl. `updatedPermissions`; mutating-tool denial in plan phase; no `allowDangerouslySkipPermissions` in built options (regression assert).
- Live spike doubles as the integration check before wiring UI.

## Workstream 2: Codex plan hardening (R5)

### Extension host — `src/codex/CodexRuntime.ts`

- Plan-first turns: request sandbox `'read-only'`; extend the thread reset key `${approvalPolicy}:${sandbox}` → `${approvalPolicy}:${sandbox}:${planFirst?'plan':'exec'}` so the existing reset machinery recreates the thread across the plan boundary (approval policy/sandbox are fixed at `thread/start`).
- Continuation turn (post-approval) uses the configured write sandbox — the key change above triggers the reset back.
- Remove `shouldStartCodexInPlanMode` prompt sniffing (R1). `collaborationMode: plan` + developer instructions stay as today.
- "Keep planning": new turn in plan collaboration mode carrying the user feedback (webview already builds continuation prompts in `lifecycle.ts`; add `buildCodexKeepPlanningPrompt`).

### Trade-off note

Thread reset across the plan boundary costs Codex its server-side thread context (same as today's Auto↔Ask reset). The approved-plan continuation prompt already re-carries the task + plan text, which the audit showed works (Repro C). Documented as accepted behavior in the spec's R5.

### Tests

- `codexApproval.test.ts` additions: plan-first → read-only sandbox in `thread/start` params; reset-key transitions; keep-planning prompt shape.

## Workstream 3: Capability map + OpenCode gating (R6)

### New module — `src/runtime/capabilities.ts`

```typescript
export interface RuntimeCapabilities {
  planFirst: boolean;          // enforceable plan contract exists
  liveModeSwitch: boolean;     // mode change without context loss
  structuredPlanSteps: boolean;
}
export const RUNTIME_CAPABILITIES: Record<AgentId, RuntimeCapabilities> = {
  'claude-code': { planFirst: true,  liveModeSwitch: true,  structuredPlanSteps: false },
  'codex':       { planFirst: true,  liveModeSwitch: false, structuredPlanSteps: true  },
  'opencode':    { planFirst: false, liveModeSwitch: false, structuredPlanSteps: false },
};
```

Delivered to the webview alongside the existing agent config message; consumed by the mode control (no component hardcodes runtime ids). `AcpRuntime` unchanged except that it never receives `planFirst: true` (assert + trace if it does).

## Workstream 4: Plan review surface + transcript truth (R4, R7-banner, F12)

### Webview — `components/ai-sidebar/`

- `PlanReviewCard.tsx` becomes the single card for Claude and Codex (today Claude uses `AgentPlanApproval.tsx` — merge, keep one). Anatomy per [design.md](./design.md): eyebrow status, rendered-markdown body (`RenderedMarkdown`, fixes the broken hard-wrap rendering seen in screenshot `03`), sticky action row: **Approve & continue** (primary), **Keep planning** (secondary, opens feedback input), **Cancel** (ghost).
- Autonomous-plan labeling: `plan_autonomous` progress → transcript event chip "Claude chose to plan first" preceding the card (R4).
- Resolved-card history: answered `AgentQuestion`s and resolved plan cards collapse to compact summary rows instead of unmounting (store keeps them on the turn; render state `resolved`) (F12).
- `ActivePlanBanner`/`lifecycle.ts`: `getActiveApprovedPlanForClaude` returns the approved plan text; result text is never substituted (F11).

## Workstream 5: Truthful activity state (R7, #161)

### Webview — `conversationState.ts` / new `activityState.ts`

```typescript
export type ConversationActivityState =
  | 'running' | 'waiting-approval' | 'waiting-input' | 'plan-review'
  | 'done' | 'failed' | 'cancelled' | 'idle';
export function deriveActivityState(c: ConversationState): ConversationActivityState { /* single source */ }
```

- `threadStatus.ts`'s `isConversationAwaitingUser` refactors onto this (attention = the three waiting states); rail behavior unchanged (Sprint 99 contract preserved).
- Status line component under the last turn shows the state vocabulary from design.md; "Done" summary renders only in `done`.
- Duration: `AgentRunner` already knows wait spans (pending question/plan/tool approval open→close timestamps); emit `waitedMs` alongside `durationMs` in metrics; UI headline = `durationMs - waitedMs`, tooltip shows total (R7).
- Files summary: filter `filesModified` to paths under the workspace root before display and count (F11) — host-side in `AgentRunner` (it knows `workspacePath`).

### Tests

- `activityState.test.ts`: every state transition incl. "result arrives while card pending → waiting, then done after resolve"; duration math; file filtering (workspace vs `~/.claude/plans`).

## Workstream 6: Compact mode control (R8)

### Webview — `ChatInput.tsx` + `store.ts`

- Replace the three-button strip with: autonomy `Select` (two options, working copy per D1) + **Plan first** toggle chip, both per design.md §Control. Rendered from `RUNTIME_CAPABILITIES`.
- `pendingRuntime.mode` storage stays `'auto'|'ask'|'plan'` on disk for compatibility; selectors expose `TurnPolicy`; migration mapping exactly as spec R8.
- Plan-chip auto-reset on approval only (D2) lives in the store (single reducer point where plan decisions land); cancel/discard leaves the chip on.

## Workstream 7: Regression harness + visual set (R9)

- `research/spikes/` scripts promoted into `scripts/qa/plan-truth-matrix.sh` (CDP driver, same technique as the audit: fresh user-data-dir, `debugTrace` on, fixture workspace, per-scenario screenshots into `research/screenshots/`, assertions on trace lines + workspace md5s).
- Matrix: ★ scenarios from scenarios.md. Claude runs need the machine's Claude auth; Codex needs `~/.codex` auth; OpenCode scenario asserts only UI gating (no keys needed).
- Manual QA = scenarios.md, walked on the dev build (`/rundev`) before handoff, per the dev-validation-before-handoff rule.

## Order of implementation

W0 spikes → W1 (Claude core) → W6 (control, needs W1 semantics) → W4 (cards) → W2 (Codex) → W3 (capabilities/gating — can land with W6) → W5 (activity truth) → W7 throughout, finalized last. Commits per workstream, requirement IDs in messages (`feat(sprint-103): R2 native plan mode …`).

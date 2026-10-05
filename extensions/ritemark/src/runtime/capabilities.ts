/**
 * Sprint 103 R6 — per-runtime capability map. THE single source for which
 * mode controls the webview may render for a runtime. No component may
 * hardcode runtime ids for capability checks; consume this map instead.
 *
 * Truth rule (spec R6): a capability is declared only when the runtime can
 * technically honor it — never for label parity.
 */
import type { AgentId } from '../agent/types';

export interface RuntimeCapabilities {
  /**
   * An enforceable plan-first contract exists: the runtime plans in a
   * no-write phase and presents a reviewable plan before executing.
   * Claude: native SDK `permissionMode: 'plan'`. Codex: native
   * `collaborationMode: 'plan'` on a read-only sandbox. OpenCode: none —
   * the audit found no plan contract (ACP session-modes probe pending).
   */
  planFirst: boolean;
  /** Autonomy can change mid-thread without losing conversation context. */
  liveModeSwitch: boolean;
  /** Runtime may emit structured plan steps (turn/plan/updated) as enhancement. */
  structuredPlanSteps: boolean;
  /** Where the Composer gets model/session-specific effort choices. */
  thinkingEffortSource: 'model-catalog' | 'runtime-live';
  /**
   * The host sends the shared browser tab (URL, title, page summary, and the
   * annotation screenshot) with this runtime's turns. Claude and Codex: yes.
   * OpenCode: no — ACP has never been sent browser context. The Composer's
   * browser chip and the AI information dialog read this same flag.
   */
  browserContext: boolean;
  /**
   * Sprint 128: the runtime reports work that keeps running after a turn's
   * result (background subagents and commands), can stop one such task, and
   * may open a turn of its own when that work finishes. Claude Code only.
   */
  backgroundWork: boolean;
}

export const RUNTIME_CAPABILITIES: Record<AgentId, RuntimeCapabilities> = {
  'claude-code': { planFirst: true, liveModeSwitch: true, structuredPlanSteps: false, thinkingEffortSource: 'model-catalog', browserContext: true, backgroundWork: true },
  'codex': { planFirst: true, liveModeSwitch: false, structuredPlanSteps: true, thinkingEffortSource: 'model-catalog', browserContext: true, backgroundWork: false },
  'opencode': { planFirst: false, liveModeSwitch: false, structuredPlanSteps: false, thinkingEffortSource: 'runtime-live', browserContext: false, backgroundWork: false },
};

export function capabilitiesFor(agentId: AgentId): RuntimeCapabilities {
  return RUNTIME_CAPABILITIES[agentId] ?? {
    planFirst: false,
    liveModeSwitch: false,
    structuredPlanSteps: false,
    thinkingEffortSource: 'runtime-live',
    browserContext: false,
    backgroundWork: false,
  };
}

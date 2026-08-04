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
}

export const RUNTIME_CAPABILITIES: Record<AgentId, RuntimeCapabilities> = {
  'claude-code': { planFirst: true, liveModeSwitch: true, structuredPlanSteps: false },
  'codex': { planFirst: true, liveModeSwitch: false, structuredPlanSteps: true },
  'opencode': { planFirst: false, liveModeSwitch: false, structuredPlanSteps: false },
};

export function capabilitiesFor(agentId: AgentId): RuntimeCapabilities {
  return RUNTIME_CAPABILITIES[agentId] ?? { planFirst: false, liveModeSwitch: false, structuredPlanSteps: false };
}

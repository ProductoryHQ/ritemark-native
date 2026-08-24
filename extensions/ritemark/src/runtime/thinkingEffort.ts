/** Canonical, provider-neutral Composer thinking-effort contract (Sprint 112). */

export const EXPLICIT_THINKING_EFFORTS = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
] as const;

export type ExplicitThinkingEffort = typeof EXPLICIT_THINKING_EFFORTS[number];
export type ThinkingEffort = 'auto' | ExplicitThinkingEffort;

export interface ThinkingEffortCapability {
  /** Manual values the selected runtime/model truthfully advertises. */
  selectable: ExplicitThinkingEffort[];
  /** Provider default captured before Ritemark applies a manual override. */
  defaultLevel?: ExplicitThinkingEffort;
  source: 'model-catalog' | 'runtime-live';
  supportsAppliedValue: boolean;
}

export interface ThinkingEffortApplied {
  requested: ThinkingEffort;
  /** Omitted when the provider gives no truthful applied-value evidence. */
  applied?: ExplicitThinkingEffort;
  adjusted: boolean;
}

const THINKING_EFFORT_SET = new Set<string>(['auto', ...EXPLICIT_THINKING_EFFORTS]);

export function isThinkingEffort(value: unknown): value is ThinkingEffort {
  return typeof value === 'string' && THINKING_EFFORT_SET.has(value);
}

export function isExplicitThinkingEffort(value: unknown): value is ExplicitThinkingEffort {
  return typeof value === 'string' && (EXPLICIT_THINKING_EFFORTS as readonly string[]).includes(value);
}

export function thinkingEffortLabel(value: ThinkingEffort): string {
  if (value === 'auto') return 'Auto';
  if (value === 'xhigh') return 'Extra';
  return value[0].toUpperCase() + value.slice(1);
}

/** Fail closed: stale/unknown UI values become provider-controlled Auto. */
export function validateThinkingEffort(
  value: unknown,
  capability: ThinkingEffortCapability,
): ThinkingEffort {
  if (value === 'auto') return 'auto';
  return isExplicitThinkingEffort(value) && capability.selectable.includes(value)
    ? value
    : 'auto';
}

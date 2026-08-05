/**
 * workspaceConsent — Sprint 107 R2 (D1 = Option A, decided 2026-08-04):
 * per-workspace opt-in for schedule-triggered daemon runs.
 *
 * Scheduled agents fire WITHOUT a user gesture, so arming them is gated on an
 * explicit per-workspace consent recorded in `workspaceState` (same scope
 * DaemonResultStore already uses). D2 (grandfather, decided 2026-08-04): a
 * workspace that already has scheduled-run history is treated as consented —
 * users who were actively scheduling before this shipped keep working without
 * a retroactive prompt.
 *
 * Pure state module — the toast/UI lives in daemon/index.ts and the Agent
 * Library; nothing here talks to the user.
 */
import type * as vscode from 'vscode';

export type ConsentState = 'granted' | 'declined' | 'undecided';

const CONSENT_KEY = 'ritemark.daemon.workspaceConsent';

export interface ConsentStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

/** Minimal surface of DaemonResultStore the grandfather check needs. */
export interface RunHistorySource {
  getAllRuns(limit?: number): unknown[];
}

export function getConsentState(
  state: ConsentStore | vscode.Memento,
  history: RunHistorySource,
): ConsentState {
  const stored = state.get<ConsentState>(CONSENT_KEY);
  if (stored === 'granted' || stored === 'declined') {
    return stored;
  }
  // D2 grandfather: existing run history = the workspace was already
  // scheduling before the consent gate shipped.
  if (history.getAllRuns(1).length > 0) {
    return 'granted';
  }
  return 'undecided';
}

export function setConsentState(
  state: ConsentStore | vscode.Memento,
  value: ConsentState,
): Thenable<void> {
  if (value === 'undecided') {
    return state.update(CONSENT_KEY, undefined);
  }
  return state.update(CONSENT_KEY, value);
}

/**
 * Sprint 155: the files an OpenCode turn changed, from its ACP tool calls.
 *
 * OpenCode announces a tool call (`tool_call`, usually `pending` with no
 * locations yet), fills it in as it runs (`tool_call_update`, `in_progress`,
 * with `locations`) and ends it (`tool_call_update`, `completed`, with the edit's
 * `diff` content). Only a completed call of kind `edit` changed a file; a
 * `read`, a search or a failed edit changed nothing.
 */

interface ToolCallState {
  kind?: string;
  status?: string;
  paths: Set<string>;
}

type ToolCallLike = {
  toolCallId?: unknown;
  kind?: unknown;
  status?: unknown;
  locations?: unknown;
  content?: unknown;
};

export class AcpTurnChanges {
  private readonly calls = new Map<string, ToolCallState>();
  private readonly changed = new Set<string>();

  /** A new turn: nothing changed yet. */
  reset(): void {
    this.calls.clear();
    this.changed.clear();
  }

  /** A `tool_call` or `tool_call_update` notification's fields. */
  note(update: ToolCallLike): void {
    if (typeof update.toolCallId !== 'string' || !update.toolCallId) return;
    const state = this.calls.get(update.toolCallId) ?? { paths: new Set<string>() };
    if (typeof update.kind === 'string') state.kind = update.kind;
    if (typeof update.status === 'string') state.status = update.status;
    if (Array.isArray(update.locations)) {
      for (const location of update.locations) {
        const file = (location as { path?: unknown } | null)?.path;
        if (typeof file === 'string' && file) state.paths.add(file);
      }
    }
    if (Array.isArray(update.content)) {
      for (const item of update.content) {
        const entry = item as { type?: unknown; path?: unknown } | null;
        if (entry?.type === 'diff' && typeof entry.path === 'string' && entry.path) state.paths.add(entry.path);
      }
    }
    this.calls.set(update.toolCallId, state);
    if (state.status === 'completed' && state.kind === 'edit') {
      for (const file of state.paths) this.changed.add(file);
    }
  }

  /** The files this turn's completed edits changed. */
  files(): string[] {
    return Array.from(this.changed);
  }
}

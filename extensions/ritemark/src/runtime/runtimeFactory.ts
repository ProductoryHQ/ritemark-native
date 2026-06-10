import type { AgentId } from '../agent/types';
import type { AgentRuntime } from './AgentRuntime';
import { ClaudeCodeRuntime } from '../agent/ClaudeCodeRuntime';
import { CodexRuntime } from '../codex/CodexRuntime';
import { AcpRuntime } from '../acp/AcpRuntime';

/**
 * Construct a FRESH AgentRuntime instance for the given agent id.
 *
 * This is the single source of runtime construction. Two callers use it:
 *  - UnifiedViewProvider builds the shared interactive registry (one instance
 *    of each runtime, reused across the user's live conversation).
 *  - The scheduled-tasks daemon (AgentTaskHandler) mints its OWN isolated
 *    instance per headless run — never the shared interactive instance, so a
 *    background run cannot clobber the user's live conversation or its approval
 *    mode (Sprint 80, Jarmo decision #2).
 *
 * Because the daemon programs against the AgentRuntime interface via this
 * factory rather than a concrete class, scheduled execution is runtime-agnostic
 * by construction: pointing it at 'codex' or 'opencode' is a one-line change,
 * not a rewrite.
 */
export function createRuntime(id: AgentId): AgentRuntime {
  switch (id) {
    case 'claude-code':
      return new ClaudeCodeRuntime();
    case 'codex':
      return new CodexRuntime();
    case 'opencode':
      return new AcpRuntime();
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown agent runtime: ${String(exhaustive)}`);
    }
  }
}

/**
 * OpenCodeSetupView — zero-key card shown when OpenCode is selected
 * but no BYOK provider keys are configured (A4).
 *
 * Follows the CodexSetupView layout contract (icon + heading + copy + primary button).
 */

import { Icon } from '../ui/Icon';
import { vscode } from '../../lib/vscode';

export function OpenCodeSetupView() {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <Icon name="key" size={20} className="text-[var(--r-accent)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Set up your API keys</div>
            <p className="mt-1 text-xs leading-5 opacity-75">
              OpenCode uses your own provider accounts for AI. Add at least one key (Gemini, OpenAI,
              Anthropic, or OpenRouter) to get started.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => vscode.postMessage({ type: 'codex:openSettings' })}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--r-accent)] px-3 py-2 text-xs font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
              >
                Open Key Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

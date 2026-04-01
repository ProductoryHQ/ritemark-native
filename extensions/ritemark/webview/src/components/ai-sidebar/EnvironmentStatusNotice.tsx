import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { AgentEnvironmentStatus } from './types';

export function EnvironmentStatusNotice({
  environmentStatus,
}: {
  environmentStatus: AgentEnvironmentStatus | null;
}) {
  if (!environmentStatus || environmentStatus.diagnostics.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {environmentStatus.restartRequired ? (
            <RefreshCw className="h-4 w-4 text-[var(--vscode-textLink-foreground)]" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[var(--vscode-testing-iconFailed)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">
            {environmentStatus.restartRequired ? 'Environment needs reload' : 'Environment checks'}
          </div>
          <div className="mt-1 space-y-1 text-xs leading-5 opacity-80">
            {environmentStatus.diagnostics.map((line) => (
              <div key={line} className="break-words">{line}</div>
            ))}
          </div>
          {environmentStatus.recommendedAction === 'install-git' && (
            <div className="mt-2 text-xs opacity-80">
              Install Git for Windows first, then retry setup.
            </div>
          )}
          {environmentStatus.recommendedAction === 'install-node' && (
            <div className="mt-2 text-xs opacity-80">
              Node.js is required to run Claude on Windows. Install it, then reload Ritemark.
            </div>
          )}
          {environmentStatus.recommendedAction === 'reload' && (
            <div className="mt-2 text-xs opacity-80">
              Reload Ritemark before retrying setup or sign-in.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

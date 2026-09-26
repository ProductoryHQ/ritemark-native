import { Icon } from '../ui/Icon';
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
    <div className="mt-3 rounded-lg border border-[var(--r-hairline)] bg-[var(--vscode-sideBar-background)]/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {environmentStatus.restartRequired ? (
            <Icon name="arrows-clockwise" size={16} className="text-[var(--r-accent)]" />
          ) : (
            <Icon name="warning" size={16} className="text-[var(--vscode-testing-iconFailed)]" />
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
          {/* Git and Node.js are only checked with Runtime preference: system — the bundled runtimes need neither. */}
          {environmentStatus.recommendedAction === 'install-git' && (
            <div className="mt-2 text-xs opacity-80">
              Your own Claude install may need Git for Windows. Install Git and reload Ritemark, or switch Runtime preference to Bundled in Settings.
            </div>
          )}
          {environmentStatus.recommendedAction === 'install-node' && (
            <div className="mt-2 text-xs opacity-80">
              Claude or Codex installed with npm runs on Node.js. Install Node.js and reload Ritemark, or switch Runtime preference to Bundled in Settings.
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

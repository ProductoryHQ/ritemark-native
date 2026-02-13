/**
 * NoApiKey — prompt to configure API key.
 */

import { Key } from 'lucide-react';
import { useAISidebarStore } from './store';

export function NoApiKey() {
  const configureApiKey = useAISidebarStore((s) => s.configureApiKey);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
      <div className="w-10 h-10 rounded-full bg-[var(--vscode-input-background)] flex items-center justify-center mb-3">
        <Key size={18} className="opacity-60" />
      </div>
      <h3 className="text-[13px] font-medium mb-1.5">OpenAI API Key Required</h3>
      <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-4">
        Add your API key to enable AI features
      </p>
      <button
        onClick={configureApiKey}
        className="px-4 py-1.5 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
      >
        Configure API Key
      </button>
    </div>
  );
}

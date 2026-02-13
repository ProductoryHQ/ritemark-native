/**
 * EmptyState — example prompts when there are no messages.
 */

import { MessageSquare, Bot } from 'lucide-react';

interface EmptyStateProps {
  variant: 'chat' | 'agent';
  onPrompt?: (prompt: string) => void;
}

const chatExamples = [
  'What does the contract say about deadlines?',
  'Summarize report.pdf',
  'Make this paragraph shorter',
];

const agentExamples = [
  'Reorganize my research notes',
  'Create an outline from these files',
  'Find all mentions of X and summarize',
];

export function EmptyState({ variant, onPrompt }: EmptyStateProps) {
  const examples = variant === 'agent' ? agentExamples : chatExamples;
  const Icon = variant === 'agent' ? Bot : MessageSquare;
  const title =
    variant === 'agent'
      ? 'Claude Code can work with your files'
      : 'Ask about your documents or edit text';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
      <div className="w-10 h-10 rounded-full bg-[var(--vscode-input-background)] flex items-center justify-center mb-3">
        <Icon size={18} className="opacity-50" />
      </div>
      <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">{title}</p>
      <ul className="space-y-1.5">
        {examples.map((example) => (
          <li key={example}>
            <button
              onClick={() => onPrompt?.(example)}
              className="text-[11px] text-[var(--vscode-textLink-foreground)] hover:underline cursor-pointer bg-transparent border-none"
            >
              "{example}"
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

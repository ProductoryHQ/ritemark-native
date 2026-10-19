/**
 * EmptyState — example prompts when there are no messages.
 */

import { Icon, type PhosphorIconName } from '../ui/Icon';

interface EmptyStateProps {
  variant: 'chat' | 'agent';
  onPrompt?: (prompt: string) => void;
  /** The AI in use, named as people know it: Claude, ChatGPT or OpenCode. */
  aiName?: string;
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

export function EmptyState({ variant, onPrompt, aiName = 'Claude' }: EmptyStateProps) {
  const examples = variant === 'agent' ? agentExamples : chatExamples;
  const iconName: PhosphorIconName = variant === 'agent' ? 'robot' : 'chat';
  const title =
    variant === 'agent'
      ? `${aiName} can work with your files`
      : 'Ask about your documents or edit text';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
      <div className="w-10 h-10 rounded-full bg-[var(--vscode-input-background)] flex items-center justify-center mb-3">
        <Icon name={iconName} size={20} className="opacity-50" />
      </div>
      <p className="text-xs text-[var(--r-ink-muted)] mb-3">{title}</p>
      <ul className="space-y-1.5">
        {examples.map((example) => (
          <li key={example}>
            <button
              onClick={() => onPrompt?.(example)}
              className="text-[11px] text-[var(--r-accent)] hover:underline cursor-pointer bg-transparent border-none"
            >
              "{example}"
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

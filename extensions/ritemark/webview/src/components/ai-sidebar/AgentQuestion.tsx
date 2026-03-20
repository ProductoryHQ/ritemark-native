/**
 * AgentQuestion — renders an AskUserQuestion tool call as an interactive UI.
 *
 * The Claude Code agent pauses execution and waits for the user to answer
 * 1-4 multiple-choice questions before continuing.
 *
 * Visual design follows existing chat panel patterns:
 * - VS Code CSS variables throughout (no hardcoded colors)
 * - Same font-size variable as chat messages (--chat-font-size)
 * - Button states reuse --vscode-button-* variables
 * - Container matches activity card aesthetic
 */

import { useState, useCallback } from 'react';
import { MessageCircle, Check } from 'lucide-react';
import type { AgentQuestion as AgentQuestionData, AgentQuestionItem } from './types';

interface AgentQuestionProps {
  turnId: string;
  question: AgentQuestionData;
  onAnswer: (turnId: string, question: AgentQuestionData, answers: Record<string, string>) => void;
  providerLabel?: string;
}

/** State for a single question's selected answers */
type QuestionAnswer = string | string[] | null;

function SingleQuestion({
  item,
  index,
  answer,
  onSelect,
}: {
  item: AgentQuestionItem;
  index: number;
  answer: QuestionAnswer;
  onSelect: (index: number, value: string | string[]) => void;
}) {
  const [otherText, setOtherText] = useState('');
  const [otherSelected, setOtherSelected] = useState(false);

  const selectedValues = item.multiSelect
    ? (Array.isArray(answer) ? answer : [])
    : (typeof answer === 'string' ? [answer] : []);

  const handleOptionClick = useCallback((label: string) => {
    if (item.multiSelect) {
      // Toggle the option in the array
      const current = Array.isArray(answer) ? answer : [];
      const next = current.includes(label)
        ? current.filter((v) => v !== label)
        : [...current, label];
      onSelect(index, next);
    } else {
      // Single select — deselect others
      onSelect(index, label);
    }
    // Deselect "Other" if a predefined option is clicked
    setOtherSelected(false);
  }, [item.multiSelect, answer, index, onSelect]);

  const handleOtherClick = useCallback(() => {
    if (item.multiSelect) {
      setOtherSelected((prev) => {
        const next = !prev;
        if (!next) {
          // Remove other text from selection
          const current = Array.isArray(answer) ? answer : [];
          onSelect(index, current.filter((v) => v !== `Other: ${otherText}`));
        }
        return next;
      });
    } else {
      setOtherSelected(true);
      // Clear predefined selection
      onSelect(index, otherText ? `Other: ${otherText}` : '');
    }
  }, [item.multiSelect, answer, index, onSelect, otherText]);

  const handleOtherTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setOtherText(text);
    if (item.multiSelect) {
      if (otherSelected) {
        const current = Array.isArray(answer) ? answer.filter((v) => !v.startsWith('Other:')) : [];
        onSelect(index, text ? [...current, `Other: ${text}`] : current);
      }
    } else {
      if (otherSelected) {
        onSelect(index, text ? `Other: ${text}` : '');
      }
    }
  }, [item.multiSelect, otherSelected, answer, index, onSelect]);

  return (
    <div className="space-y-2">
      {/* Question header chip */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)]"
          style={{ fontSize: '10px' }}
        >
          {item.header}
        </span>
        {item.multiSelect && (
          <span className="text-[10px] text-[var(--vscode-descriptionForeground)] italic">
            select all that apply
          </span>
        )}
      </div>

      {/* Question text */}
      <p
        className="text-[var(--vscode-foreground)]"
        style={{ fontSize: 'var(--chat-font-size, 13px)' }}
      >
        {item.question}
      </p>

      {/* Options */}
      <div className="space-y-1.5">
        {item.options.map((option) => {
          const isSelected = selectedValues.includes(option.label);
          return (
            <button
              key={option.label}
              onClick={() => handleOptionClick(option.label)}
              className="w-full text-left px-3 py-2 rounded border transition-colors"
              style={{
                background: isSelected
                  ? 'var(--vscode-button-background)'
                  : 'var(--vscode-button-secondaryBackground)',
                color: isSelected
                  ? 'var(--vscode-button-foreground)'
                  : 'var(--vscode-button-secondaryForeground)',
                borderColor: isSelected
                  ? 'var(--vscode-button-background)'
                  : 'var(--vscode-panel-border)',
                fontSize: 'var(--chat-font-size, 13px)',
              }}
            >
              <div className="flex items-start gap-2">
                {/* Selection indicator */}
                <span className="shrink-0 mt-0.5 w-3.5 h-3.5 flex items-center justify-center">
                  {isSelected && <Check size={11} />}
                </span>
                <div>
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div
                      className="mt-0.5"
                      style={{
                        fontSize: '11px',
                        opacity: 0.75,
                      }}
                    >
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* "Other" fallback option */}
        <div>
          <button
            onClick={handleOtherClick}
            className="w-full text-left px-3 py-2 rounded border transition-colors"
            style={{
              background: otherSelected
                ? 'var(--vscode-button-background)'
                : 'var(--vscode-button-secondaryBackground)',
              color: otherSelected
                ? 'var(--vscode-button-foreground)'
                : 'var(--vscode-button-secondaryForeground)',
              borderColor: otherSelected
                ? 'var(--vscode-button-background)'
                : 'var(--vscode-panel-border)',
              fontSize: 'var(--chat-font-size, 13px)',
            }}
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 w-3.5 h-3.5 flex items-center justify-center">
                {otherSelected && <Check size={11} />}
              </span>
              <span className="font-medium">Other</span>
            </div>
          </button>
          {otherSelected && (
            <input
              type="text"
              value={otherText}
              onChange={handleOtherTextChange}
              placeholder="Type your answer..."
              autoFocus
              className="mt-1.5 w-full px-2.5 py-1.5 rounded text-xs outline-none"
              style={{
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                fontSize: 'var(--chat-font-size, 13px)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentQuestion({ turnId, question, onAnswer, providerLabel = 'Claude' }: AgentQuestionProps) {
  const [answers, setAnswers] = useState<QuestionAnswer[]>(
    question.questions.map(() => null)
  );

  const handleSelect = useCallback((index: number, value: string | string[]) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // Submit is enabled when every question has at least one non-empty answer
  const canSubmit = answers.every((a) => {
    if (a === null) return false;
    if (typeof a === 'string') return a.trim().length > 0;
    if (Array.isArray(a)) return a.length > 0;
    return false;
  });

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    // Build answers record keyed by question TEXT (SDK format).
    // Values are option labels; multi-select values joined with ", ".
    const answersRecord: Record<string, string> = {};
    question.questions.forEach((q, i) => {
      const a = answers[i];
      if (a === null) return;
      if (typeof a === 'string') {
        answersRecord[q.question] = a;
      } else if (Array.isArray(a)) {
        answersRecord[q.question] = a.join(', ');
      }
    });

    onAnswer(turnId, question, answersRecord);
  }, [canSubmit, answers, onAnswer, turnId, question]);

  return (
    <div
      className="rounded border px-3 py-3 space-y-4"
      style={{
        background: 'var(--vscode-input-background)',
        borderColor: 'var(--vscode-panel-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
        <MessageCircle size={13} className="shrink-0" />
        <span>{providerLabel} needs your input to continue</span>
      </div>

      {/* Questions */}
      {question.questions.map((item, i) => (
        <SingleQuestion
          key={i}
          item={item}
          index={i}
          answer={answers[i]}
          onSelect={handleSelect}
        />
      ))}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="px-3 py-1.5 rounded text-xs font-medium transition-opacity"
        style={{
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          opacity: canSubmit ? 1 : 0.4,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          fontSize: 'var(--chat-font-size, 13px)',
        }}
      >
        Submit answers
      </button>
    </div>
  );
}

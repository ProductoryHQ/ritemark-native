import { useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardCheck, Dot } from 'lucide-react';
import type { CodexPlanStep } from './types';
import { buildActivePlanViewModel } from './activePlan';

interface ActivePlanBannerProps {
  planText: string;
  planSteps?: CodexPlanStep[];
  isRunning?: boolean;
  allCompleted?: boolean;
  onDismiss?: () => void;
}

export function ActivePlanBanner({
  planText,
  planSteps,
  isRunning = false,
  allCompleted = false,
  onDismiss,
}: ActivePlanBannerProps) {
  const [expanded, setExpanded] = useState(isRunning);
  const model = buildActivePlanViewModel(planText, planSteps, isRunning, allCompleted);

  if (!model) {
    return null;
  }

  return (
    <div className="mx-3 mb-2 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)] px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-w-0 flex-1 text-left"
          title={expanded ? 'Collapse plan details' : 'Expand plan details'}
          aria-label={expanded ? 'Collapse plan details' : 'Expand plan details'}
        >
          <div className="flex items-center gap-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
            <ClipboardCheck size={13} className="shrink-0" />
            <span>Current plan</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-[var(--vscode-foreground)]">
            {model.summary}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded p-1 text-[var(--vscode-descriptionForeground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)]"
              title="Mark plan complete and hide"
              aria-label="Mark plan complete and hide"
            >
              <Check size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded p-1 text-[var(--vscode-descriptionForeground)] transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-foreground)]"
            title={expanded ? 'Collapse plan details' : 'Expand plan details'}
            aria-label={expanded ? 'Collapse plan details' : 'Expand plan details'}
          >
            {expanded ? (
              <ChevronDown size={14} className="shrink-0" />
            ) : (
              <ChevronRight size={14} className="shrink-0" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {model.steps.map((step, index) => (
            <div
              key={`${step.label}-${index}`}
              className="flex items-start gap-2 text-[11px] leading-4"
            >
              <span className="mt-[1px] shrink-0">
                {step.status === 'completed' ? (
                  <CheckCircle2 size={12} className="text-[var(--vscode-testing-iconPassed)]" />
                ) : step.status === 'inProgress' ? (
                  <Dot size={16} className="-ml-[2px] text-[var(--vscode-progressBar-background)]" />
                ) : (
                  <Circle size={10} className="mt-[1px] text-[var(--vscode-descriptionForeground)]" />
                )}
              </span>
              <span
                className={
                  step.status === 'completed'
                    ? 'opacity-60 line-through'
                    : step.status === 'inProgress'
                      ? 'font-medium text-[var(--vscode-foreground)]'
                      : 'text-[var(--vscode-descriptionForeground)]'
                }
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Icon } from '../ui/Icon';
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
    <div className="mx-3 mb-2 rounded-lg border border-[var(--r-hairline)] bg-[var(--vscode-input-background)]/80 px-3 py-2 shadow-[0_1px_2px_rgba(30,27,75,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-w-0 flex-1 text-left"
          title={expanded ? 'Collapse plan details' : 'Expand plan details'}
          aria-label={expanded ? 'Collapse plan details' : 'Expand plan details'}
        >
          <div className="flex items-center gap-2 text-[11px] text-[var(--r-ink-muted)]">
            <Icon name="clipboard-text" size={14} className="shrink-0" />
            <span>Current plan</span>
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[var(--r-ink-strong)]">
            {model.summary}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md p-1 text-[var(--r-ink-muted)] transition-colors hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
              title="Mark plan complete and hide"
              aria-label="Mark plan complete and hide"
            >
              <Icon name="check" size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-md p-1 text-[var(--r-ink-muted)] transition-colors hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)]"
            title={expanded ? 'Collapse plan details' : 'Expand plan details'}
            aria-label={expanded ? 'Collapse plan details' : 'Expand plan details'}
          >
            {expanded ? (
              <Icon name="caret-down" size={14} className="shrink-0" />
            ) : (
              <Icon name="caret-right" size={14} className="shrink-0" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5 rounded-md border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]/50 px-2.5 py-2">
          {model.steps.map((step, index) => (
            <div
              key={`${step.label}-${index}`}
              className="flex items-start gap-2 text-[11px] leading-4"
            >
              <span className="mt-[1px] shrink-0">
                {step.status === 'completed' ? (
                  <Icon name="check-circle" size={12} className="text-[var(--vscode-testing-iconPassed)]" />
                ) : step.status === 'inProgress' ? (
                  <Icon name="dot" size={16} className="-ml-[2px] text-[var(--vscode-progressBar-background)]" />
                ) : (
                  <Icon name="circle" size={12} className="mt-[1px] text-[var(--r-ink-muted)]" />
                )}
              </span>
              <span
                className={
                  step.status === 'completed'
                    ? 'opacity-60 line-through'
                    : step.status === 'inProgress'
                      ? 'font-medium text-[var(--r-ink-strong)]'
                      : 'text-[var(--r-ink-muted)]'
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

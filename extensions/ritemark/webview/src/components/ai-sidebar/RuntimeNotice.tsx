import { Button } from '../ui/button';
import { Icon, type PhosphorIconName } from '../ui/Icon';

export interface RuntimeNoticeAction {
  label: string;
  icon: PhosphorIconName;
  onAction: () => void;
  disabled?: boolean;
}

interface RuntimeNoticeProps {
  title: string;
  message: string;
  tone?: 'warning' | 'progress' | 'success' | 'error';
  primaryAction?: RuntimeNoticeAction;
  secondaryAction?: RuntimeNoticeAction;
  statusLabel?: string;
}

/** Shared provider/setup notice used by both proactive and failed-turn recovery. */
export function RuntimeNotice({
  title,
  message,
  tone = 'warning',
  primaryAction,
  secondaryAction,
  statusLabel,
}: RuntimeNoticeProps) {
  const visual = {
    warning: { icon: 'warning' as const, background: 'var(--r-warning-soft)', color: 'var(--r-warning)' },
    progress: { icon: 'circle-notch' as const, background: 'var(--r-accent-soft)', color: 'var(--r-accent)' },
    success: { icon: 'check-circle' as const, background: 'var(--r-success-soft)', color: 'var(--r-success)' },
    error: { icon: 'warning-circle' as const, background: 'var(--r-error-soft)', color: 'var(--r-error)' },
  }[tone];
  const hasActions = Boolean(primaryAction || secondaryAction);

  return (
    <div
      role={tone === 'progress' || tone === 'success' ? 'status' : 'alert'}
      aria-label={title}
      className="overflow-hidden rounded-lg border border-[var(--r-hairline)] bg-[var(--r-surface)] shadow-[0_1px_2px_rgba(30,27,75,0.04)]"
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: visual.background, color: visual.color }}
        >
          <Icon
            name={visual.icon}
            size={14}
            tone="inherit"
            className={tone === 'progress' ? 'animate-spin' : undefined}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold leading-5 text-[var(--r-ink-strong)]">{title}</div>
          <div className="mt-0.5 text-[11px] leading-[1.45] text-[var(--r-ink-muted)]">{message}</div>
        </div>
      </div>
      {(statusLabel || hasActions) && (
        <div className="border-t border-[var(--r-hairline)] bg-[var(--r-surface-muted)] px-3 py-2">
          {statusLabel && (
            <div className="flex min-h-8 w-full items-center gap-1.5 pl-[34px] text-xs font-medium text-[var(--r-accent)]">
              <Icon name="circle-notch" size={12} tone="inherit" className="animate-spin" />
              {statusLabel}
            </div>
          )}
          {hasActions && (
            <div className={`flex w-full flex-wrap items-center justify-end gap-1 ${statusLabel ? 'mt-1' : ''}`}>
              {secondaryAction && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={secondaryAction.onAction}
                  disabled={secondaryAction.disabled}
                >
                  <Icon name={secondaryAction.icon} size={12} tone="inherit" />
                  {secondaryAction.label}
                </Button>
              )}
              {primaryAction && (
                <Button
                  type="button"
                  size="sm"
                  onClick={primaryAction.onAction}
                  disabled={primaryAction.disabled}
                >
                  <Icon name={primaryAction.icon} size={12} tone="inherit" />
                  {primaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

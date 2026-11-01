import { Button } from '../ui/button';
import { Icon, type PhosphorIconName } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';

export interface RuntimeNoticeAction {
  label: string;
  /** Drawn before the label; a ghost action has none (Sprint 152). */
  icon?: PhosphorIconName;
  onAction: () => void;
  disabled?: boolean;
  /** Sprint 139 (#376): every button says what it does, or why it can't be pressed. */
  tooltip: string;
  /**
   * Sprint 152 (the Experience lead's check of #632): `ghost` for an action that is a choice, not the next step,
   * such as Try again while a check still runs beside the message box, whose primary action is Send.
   */
  variant?: 'default' | 'ghost';
}

interface RuntimeNoticeProps {
  title: string;
  message: string;
  /**
   * `checking` (Sprint 152, the Experience lead's check of #632): a check that is taking long, which is work in
   * progress, not an alarm: the kit's turning mark in ink on the quiet chip, read out politely (`role="status"`).
   */
  tone?: 'warning' | 'progress' | 'checking' | 'success' | 'error';
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
    // The icon is not drawn for `checking`: the chip holds the turning mark instead (below)
    checking: { icon: 'circle-notch' as const, background: 'var(--r-done-chip)', color: 'var(--r-ink-strong)' },
    // Sprint 145 (#578): done, in ink on a quiet chip, as "You're all set!" is; green is only the small ready dot.
    // A plain check, not check-circle, so the mark doesn't sit in two outlines (the Experience lead, 31 October).
    // The chip is --r-done-chip: the soft surface in Light (the muted one vanishes on the white card), muted in Dark.
    success: { icon: 'check' as const, background: 'var(--r-done-chip)', color: 'var(--r-ink-strong)' },
    error: { icon: 'warning-circle' as const, background: 'var(--r-error-soft)', color: 'var(--r-error)' },
  }[tone];
  const hasActions = Boolean(primaryAction || secondaryAction);

  return (
    <div
      role={tone === 'progress' || tone === 'checking' || tone === 'success' ? 'status' : 'alert'}
      aria-label={title}
      className="overflow-hidden rounded-lg border border-[var(--r-hairline)] bg-[var(--r-surface)] shadow-[0_1px_2px_rgba(30,27,75,0.04)]"
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: visual.background, color: visual.color }}
        >
          {tone === 'checking' ? (
            // The kit's turning mark, as the AI column's starting look draws it (src/views/aiStartingMark.ts): 16, 1.5 of
            // the strong hairline with its top in ink, once a second; still under Reduce motion
            <span
              aria-hidden="true"
              className="box-border h-4 w-4 animate-spin rounded-full border-[1.5px] border-solid motion-reduce:animate-none [.vscode-reduce-motion_&]:animate-none"
              style={{ borderColor: 'var(--vscode-input-border)', borderTopColor: 'var(--vscode-foreground)' }}
            />
          ) : (
            <Icon
              name={visual.icon}
              size={14}
              tone="inherit"
              className={tone === 'progress' ? 'animate-spin' : undefined}
            />
          )}
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
                <Tooltip label={secondaryAction.tooltip}>
                  <Button
                    type="button"
                    size="sm"
                    variant={secondaryAction.variant === 'ghost' ? 'ghost' : 'secondary'}
                    onClick={secondaryAction.onAction}
                    disabled={secondaryAction.disabled}
                  >
                    {secondaryAction.icon && <Icon name={secondaryAction.icon} size={12} tone="inherit" />}
                    {secondaryAction.label}
                  </Button>
                </Tooltip>
              )}
              {primaryAction && (
                <Tooltip label={primaryAction.tooltip}>
                  <Button
                    type="button"
                    size="sm"
                    variant={primaryAction.variant ?? 'default'}
                    onClick={primaryAction.onAction}
                    disabled={primaryAction.disabled}
                  >
                    {primaryAction.icon && <Icon name={primaryAction.icon} size={12} tone="inherit" />}
                    {primaryAction.label}
                  </Button>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

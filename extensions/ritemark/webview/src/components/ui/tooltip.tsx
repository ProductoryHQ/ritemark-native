/**
 * A short explanation on hover and keyboard focus (Radix Tooltip, styled like
 * the conversation rail's tooltip). Wrap the trigger:
 *
 *   <Tooltip label="Record from the microphone"><Button …/></Tooltip>
 *
 * The trigger is always a wrapping span: a disabled button receives no pointer
 * events, so the span is what lets a tooltip explain why an action is
 * unavailable, and it works the same around any child. Pass layout classes for
 * the span through `className`.
 *
 * Use it instead of a native `title`, which shows late or not at all in a
 * webview and never on keyboard focus.
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { FocusEvent, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Sprint 142 R9 (#505; audit A4): whether a focus may open a tooltip. Keyboard focus may (`:focus-visible`). A focus
 * that follows a mouse or touch press may not: a button that replaces itself hands the focus to the one that took
 * its place (a task card's Give to becoming Stop), and Radix kept that tooltip open, wherever the pointer went, until
 * the focus moved on. Hover still opens it, and leaving still closes it.
 */
export function focusOpensTooltip(target: { matches(selector: string): boolean } | null): boolean {
  if (!target) return false;
  try {
    return target.matches(':focus-visible');
  } catch {
    return true; // a browser without :focus-visible keeps today's behaviour
  }
}

function onTriggerFocus(event: FocusEvent<HTMLElement>): void {
  // Radix composes its own handler after this one and skips a prevented event
  if (!focusOpensTooltip(event.target as Element | null)) event.preventDefault();
}

export function Tooltip({
  label,
  side = 'bottom',
  className,
  children,
}: {
  label: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild onFocus={onTriggerFocus}>
          <span className={cn('inline-flex', className)}>{children}</span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-[100] max-w-[240px] rounded-[8px] bg-[var(--r-ink-strong)] px-2.5 py-1.5 font-ui text-[12px] leading-[1.35] text-[var(--r-surface)] shadow-lg"
          >
            {label}
            <TooltipPrimitive.Arrow className="fill-[var(--r-ink-strong)]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

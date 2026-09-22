/**
 * A short explanation on hover and keyboard focus (Radix Tooltip, styled like
 * the conversation rail's tooltip). Wrap the trigger:
 *
 *   <Tooltip label="Record from the microphone"><Button …/></Tooltip>
 *
 * The trigger is always a wrapping span: `Button` does not forward refs, which
 * Radix needs to place the tooltip, and a disabled button receives no pointer
 * events — so the span is also what lets a tooltip explain why an action is
 * unavailable. Pass layout classes for the span through `className`.
 *
 * Use it instead of a native `title`, which shows late or not at all in a
 * webview and never on keyboard focus.
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({
  label,
  side = 'bottom',
  className,
  children,
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={100}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
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

/**
 * A short explanation on hover and keyboard focus (Radix Tooltip, in the
 * workbench hover's look: `TOOLTIP_SURFACE`). Wrap the trigger:
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
import { inputMode, type InputMode } from './input-mode';

/**
 * Sprint 142 R9 (#505; audit A4): whether a focus may open a tooltip. Keyboard focus may. A focus that follows a mouse
 * or touch press may not: a button that replaces itself hands the focus to the one that took its place (a task card's
 * Give to becoming Stop), and Radix kept that tooltip open, wherever the pointer went, until the focus moved on. Hover
 * still opens it, and leaving still closes it.
 *
 * Sprint 146 (R3): the page's input mode decides first (`input-mode.ts`). In pointer mode no focus opens a tooltip,
 * whatever Chromium's `:focus-visible` guess, so the focus a menu gives back to its trigger after a mouse pick opens
 * none (2.1 RC3's tooltip). In keyboard mode, `:focus-visible` as before.
 */
export function focusOpensTooltip(target: { matches(selector: string): boolean } | null, mode: InputMode = inputMode()): boolean {
  if (!target || mode === 'pointer') return false;
  try {
    return target.matches(':focus-visible');
  } catch {
    return true; // a browser without :focus-visible keeps today's behaviour
  }
}

/**
 * Sprint 146 (#576; the Experience lead, 31 October, §3): one tooltip look, the workbench hover's. A tooltip is a small
 * floating sheet, so it takes the menus' family in the theme's own colours: the surface with the strong ink, a 1 px
 * hairline and the menus' shadow, with no arrow, its radius (5) and padding (2 and 8) the hover's (measured on a
 * tab's hover, `.monaco-hover.workbench-hover.compact`, which has no arrow either). Light: white with ink words; Dark:
 * the desk's indigo with light words, as the status bar's hover. Its width rule (Sprint 142 merge 2): never wider than the page less its collision
 * padding, so a tooltip in a desk of 152 wraps its words instead of running past the edge. Every Radix tooltip in the
 * webview takes these classes (`ConversationTooltip` too). A tooltip draws above everything, the modals too: `Dialog`'s
 * backdrop is at 9999 and its sheet at 10000, `PropertiesModal`'s at 999 (Codex on #637).
 */
export const TOOLTIP_SURFACE =
  'z-[10001] rounded-[5px] border border-hairline bg-surface px-2 py-0.5 font-ui text-[12px] leading-[1.35] text-ink-strong shadow-md'

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
            className={cn(TOOLTIP_SURFACE, 'max-w-[min(240px,calc(100vw_-_16px))]')}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

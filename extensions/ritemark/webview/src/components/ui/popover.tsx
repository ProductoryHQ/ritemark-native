/**
 * Popover — shadcn/ui's, on Radix (17 November 2026: popups close when you click outside them).
 *
 * The first choice for any popup anchored to a button: Radix closes it on a press outside and on Esc, gives the focus
 * back to the trigger, and lets the trigger toggle it. A panel Radix can't carry takes `lib/dismissOnOutside.ts`.
 *
 *   <Popover open={open} onOpenChange={setOpen}>
 *     <PopoverTrigger asChild><Button …/></PopoverTrigger>
 *     <PopoverContent align="start">…</PopoverContent>
 *   </Popover>
 */
import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'

import { cn } from '../../lib/utils'
import { popupWithTooltipEscape } from './tooltip'

const Popover = popupWithTooltipEscape(PopoverPrimitive.Root)
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // Ritemark's popup card (the deck slide's Settings since Sprint 157): a hairline ring and a soft indigo shadow.
        'z-[70] rounded-xl bg-surface p-3 font-ui text-ink-strong outline-none shadow-[0_0_0_1px_var(--r-hairline),0_16px_34px_-10px_rgba(30,27,75,.28)]',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }

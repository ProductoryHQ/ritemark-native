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
import { focusOpensTooltip, popupWithTooltipEscape } from './tooltip'

const Popover = popupWithTooltipEscape(PopoverPrimitive.Root)
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { portalContainer?: HTMLElement | null }
>(({ className, align = 'center', sideOffset = 4, portalContainer, ...props }, ref) => (
  <PopoverPrimitive.Portal container={portalContainer}>
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

/** A hover/focus popover anchored to an element rendered outside React. */
export function AnchoredHoverPopover({
  anchor, contentRef, children, onClose, onPointerEnter, onPointerLeave, label, collisionBoundary, className,
}: {
  anchor: HTMLElement
  contentRef: React.Ref<HTMLDivElement>
  children: React.ReactNode
  onClose: () => void
  label: string
  collisionBoundary?: Element | null
  /** Added to the card's own classes (this card only; the shared Popover keeps its look). */
  className?: string
  onPointerEnter: () => void
  onPointerLeave: () => void
}) {
  const virtualRef = { current: anchor }
  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose() }}>
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        ref={contentRef}
        aria-label={label}
        align="start"
        sideOffset={2}
        collisionBoundary={collisionBoundary ?? undefined}
        collisionPadding={collisionBoundary ? 12 : 8}
        sticky={collisionBoundary ? 'always' : 'partial'}
        className={cn(collisionBoundary
          ? 'w-[17rem] max-w-[var(--radix-popover-content-available-width,0px)] max-h-[var(--radix-popover-content-available-height)] overflow-auto'
          : undefined, className)}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => {
          if (anchor.isConnected && anchor.ownerDocument.activeElement?.closest('[role="dialog"]')) {
            anchor.focus()
          }
        }}
        onKeyDown={(event) => {
          // One Esc closes the card even while its action's tooltip shows (that tooltip is a layer of its own, and
          // would otherwise take the first press), and gives focus back to the link.
          if (event.key === 'Escape') {
            event.preventDefault()
            if (anchor.isConnected) anchor.focus()
            onClose()
            return
          }
          if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
          // Return to the anchor so normal tab order can continue from there.
          anchor.focus()
          if (event.shiftKey) event.preventDefault()
          onClose()
        }}
        onFocusOutside={(event) => {
          if (anchor.contains(event.target as Node)) event.preventDefault()
        }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}


/** Pointer grace period across the gap to the card, plus keyboard entry into its first action. */
export function useAnchoredHover<T extends { anchor: HTMLElement; content: string }>(content: string) {
  const [target, setTarget] = React.useState<T | null>(null)
  const active = target?.content === content ? target : null
  const contentRef = React.useRef<HTMLDivElement>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout>>()
  const keepOpen = React.useCallback(() => clearTimeout(timer.current), [])
  React.useEffect(() => keepOpen, [content, keepOpen])
  const close = React.useCallback(() => {
    keepOpen()
    setTarget(null)
  }, [keepOpen])
  const leave = () => {
    keepOpen()
    timer.current = setTimeout(() => {
      const focus = active?.anchor.ownerDocument.activeElement
      if (!contentRef.current?.contains(focus ?? null) && !(focus === active?.anchor && focusOpensTooltip(focus ?? null))) close()
    }, 180)
  }
  const show = (next: T) => {
    keepOpen()
    setTarget((previous) => previous?.anchor === next.anchor ? previous : next)
  }
  const enterWithKeyboard = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.target !== active?.anchor) return
    const action = contentRef.current?.querySelector('button:not(:disabled)')
    if (action instanceof HTMLElement) {
      event.preventDefault()
      action.focus()
    }
  }
  return { active, contentRef, close, leave, show, keepOpen, enterWithKeyboard }
}

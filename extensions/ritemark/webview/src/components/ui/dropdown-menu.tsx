/**
 * A menu that opens from a button (Radix DropdownMenu), styled like
 * `context-menu.tsx` so the two read as one family. Keyboard support comes from
 * Radix: Enter/Space/↓ open it, arrows move, Escape closes and returns focus
 * to the trigger.
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild><Button …/></DropdownMenuTrigger>
 *     <DropdownMenuContent align="end">
 *       <DropdownMenuItem onSelect={…}><Icon …/>Rename</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        // Above the 56 px thread rail (z-60), below dialogs (z-80) and tooltips (z-100).
        'z-[70] min-w-[10rem] max-w-[16rem] overflow-hidden rounded-md border border-hairline-strong bg-surface p-1 font-ui text-ink-strong shadow-md',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    tone?: 'default' | 'danger'
  }
>(({ className, tone = 'default', ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] outline-none focus:bg-surface-soft data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:shrink-0 [&_svg]:fill-current',
      tone === 'danger' && 'text-[var(--r-error)] focus:text-[var(--r-error)]',
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-hairline', className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator }

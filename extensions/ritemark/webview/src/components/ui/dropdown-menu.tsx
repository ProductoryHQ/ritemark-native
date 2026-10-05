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
import { cn } from '../../lib/utils'
import { Button } from './button'
import { Icon } from './Icon'
import { Tooltip } from './tooltip'

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

/**
 * The one "More actions" (…) button that opens a menu of a row's or a header's
 * actions. Convention (ritemark-design: references/webview-ui.md § More actions
 * menus): Phosphor `dots-three` at 14px, a ghost Button, the tooltip "More
 * actions", an aria-label that names the target. `density="row"` (24px) in list
 * rows, `"header"` (28px) beside a title. Put it inside <DropdownMenu modal={false}>;
 * `className` positions it or makes it hover-only in a row.
 */
const MoreActionsTrigger = React.forwardRef<
  HTMLButtonElement,
  { label?: string; density?: 'row' | 'header'; className?: string }
>(({ label = 'More actions', density = 'row', className }, ref) => (
  <Tooltip label="More actions">
    <DropdownMenuPrimitive.Trigger asChild>
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className={cn(
          'shrink-0 text-ink-muted data-[state=open]:bg-surface-soft data-[state=open]:text-ink-strong',
          density === 'row' ? 'size-6 rounded-[6px]' : 'size-7 rounded-[7px]',
          className
        )}
      >
        <Icon name="dots-three" size={14} />
      </Button>
    </DropdownMenuPrimitive.Trigger>
  </Tooltip>
))
MoreActionsTrigger.displayName = 'MoreActionsTrigger'

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, MoreActionsTrigger }

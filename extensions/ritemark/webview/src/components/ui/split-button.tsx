/**
 * SplitButton: one button, in one tone (framework §3; Jarmo, 26 October: "splitbuttons should not look like this in
 * two tones"; Sprint 142 R5, #557). Its main part and its caret share one fill in every state, parted only by a 1 px
 * line (28% white on a filled button, the hairline on an outline or quiet one). Rest, hover and pressed are the
 * whole button's; with its menu open it keeps its rest tone, and the menu is the sign. Disabled and busy are the
 * whole button's, never one half's. Only the keyboard's focus ring outlines one part, the one that has the focus.
 *
 * The look lives in `.rm-split` (index.css), so a split button with its own menu (dictation, the spreadsheet's Open
 * in Excel) takes the same contract through `splitButtonState` and the same classes.
 */

import type { ReactNode, Ref } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu'
import { Icon } from './Icon'
import { Tooltip } from './tooltip'

export type SplitTone = 'primary' | 'outline' | 'quiet'

/**
 * The whole button's state, for its wrapper and both parts (pure, tested). Disabled and busy turn off both parts;
 * `on` is a main part that is on (dictating): the whole button shows it, and the caret still opens its menu.
 */
export function splitButtonState({ disabled = false, busy = false, on = false }: { disabled?: boolean; busy?: boolean; on?: boolean }): {
  wrapper: { 'data-disabled'?: ''; 'data-busy'?: ''; 'data-on'?: ''; 'aria-busy'?: true }
  mainDisabled: boolean
  menuDisabled: boolean
} {
  const off = disabled || busy
  return {
    wrapper: {
      ...(off ? { 'data-disabled': '' as const } : {}),
      ...(busy ? { 'data-busy': '' as const, 'aria-busy': true as const } : {}),
      ...(on && !off ? { 'data-on': '' as const } : {}),
    },
    mainDisabled: off,
    menuDisabled: off,
  }
}

const VARIANT: Record<SplitTone, 'default' | 'outline' | 'ghost'> = { primary: 'default', outline: 'outline', quiet: 'ghost' }

export function SplitButton({
  tone = 'primary',
  disabled,
  busy,
  className,
  wrapperRef,
  main,
  menu,
}: {
  tone?: SplitTone
  disabled?: boolean
  busy?: boolean
  className?: string
  wrapperRef?: Ref<HTMLSpanElement>
  main: { label: ReactNode; icon?: ReactNode; tooltip: ReactNode; onClick: () => void; className?: string; ariaLabel?: string }
  menu: {
    /** The caret's accessible name, e.g. "Ask with". */
    label: string
    tooltip: ReactNode
    content: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    align?: 'start' | 'center' | 'end'
    alignOffset?: number
    contentClassName?: string
  }
}) {
  const state = splitButtonState({ disabled, busy })
  return (
    <span ref={wrapperRef} className={cn('rm-split', className)} data-tone={tone} {...state.wrapper}>
      <Tooltip label={main.tooltip} className="rm-split-slot min-w-0">
        <Button
          type="button"
          size="sm"
          variant={VARIANT[tone]}
          className={cn('rm-split-part rm-split-main', main.className)}
          disabled={state.mainDisabled}
          aria-label={main.ariaLabel}
          onClick={main.onClick}
        >
          {main.icon}
          <span className="truncate">{main.label}</span>
        </Button>
      </Tooltip>
      <DropdownMenu open={menu.open} onOpenChange={menu.onOpenChange} modal={false}>
        <Tooltip label={menu.tooltip} className="rm-split-slot">
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant={VARIANT[tone]} className="rm-split-part rm-split-more" aria-label={menu.label} disabled={state.menuDisabled}>
              <Icon name="caret-down" size={12} tone="inherit" />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align={menu.align ?? 'end'} alignOffset={menu.alignOffset} className={menu.contentClassName}>
          {menu.content}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

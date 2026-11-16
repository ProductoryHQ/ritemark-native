/**
 * Sprint 159 (experience 17 frame 1, as corrected on 15 November): Present on the deck's bar. The button presents from
 * the current slide (⌘↩); its menu has From the start (⇧⌘↩) and Presenter view (PR 6), which comes on by itself with
 * a second display and names it ("Slides on Projector, your comments here"). The keys work anywhere in the deck view, caught
 * before the handout's editor (`usePresentKeys`), so ⇧↩ stays a line break in the handout.
 */
import { useEffect, useState } from 'react'
import { isMac } from '../../../hooks/usePlatform'
import { onMessage, sendToExtension } from '../../../bridge'
import { DropdownMenuItem, DropdownMenuSeparator } from '../../ui/dropdown-menu'
import { Icon } from '../../ui/Icon'
import { SplitButton } from '../../ui/split-button'
import { presentKeyOf } from './wallKeys'

export type PresentFrom = 'here' | 'start'

const HERE_KEYS = isMac ? '⌘↩' : 'Ctrl+Enter'
const START_KEYS = isMac ? '⇧⌘↩' : 'Shift+Ctrl+Enter'

/** The host's answer for the menu's Presenter view (`deck/present-options`). */
interface PresentOptions {
  available: boolean
  on: boolean
  wallDisplay: string | null
}

/** ⌘↩ and ⇧⌘↩ in the deck view, while it has slides and no dialog is open. */
export function usePresentKeys(onPresent: (from: PresentFrom) => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const from = presentKeyOf(event, isMac)
      if (!from || event.isComposing) return
      // A dialog or sheet over the deck, and a field of its own (a sheet's name box), keep their keys. The handout
      // and the slide's words don't: in a deck, ⌘↩ presents (sprint plan, decision 5), and ⇧↩ stays the line break.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      if ((event.target as Element | null)?.closest?.('input, textarea, select')) return
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) onPresent(from)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onPresent, enabled])
}

/** The menu's Presenter view line under its name. */
function presenterLine(options: PresentOptions | null): string {
  if (!options) return 'Looking for a second display…'
  if (!options.available) return 'Comes on with a second display'
  return options.wallDisplay ? `Slides on ${options.wallDisplay}, your comments here` : 'Slides and your comments, each in a window'
}

export function PresentButton({ slideNumber, startNumber, onPresent }: {
  /** The current slide's number, or null when the deck has no slides. */
  slideNumber: number | null
  /** The first slide shown (skipped slides are passed), or null when every slide is skipped. */
  startNumber: number | null
  onPresent: (from: PresentFrom) => void
}) {
  const [options, setOptions] = useState<PresentOptions | null>(null)
  // Present stays enabled on an older shell too: pressing it is answered with a notice in the bar (the host's
  // `deck/present-failed`), never a disabled button.
  const disabled = slideNumber === null

  useEffect(() => onMessage(message => {
    if (message.type !== 'deck/present-options') return
    setOptions({ available: message.available === true, on: message.on === true, wallDisplay: typeof message.wallDisplay === 'string' ? message.wallDisplay : null })
  }), [])
  useEffect(() => { sendToExtension('deck/present-options') }, [])

  return (
    // The bar's one primary, last on the bar, at the bar's 30 px (the Experience lead, frame 2)
    <SplitButton
      tone="primary"
      size="bar"
      disabled={disabled}
      className="deck-present"
      main={{
        label: 'Present',
        icon: <Icon name="play" size={14} tone="inherit" />,
        tooltip: disabled ? 'Add a slide to present the deck' : `Present from this slide (${HERE_KEYS})`,
        onClick: () => onPresent('here'),
      }}
      menu={{
        label: 'More ways to present',
        tooltip: 'More ways to present',
        align: 'end',
        // The displays are asked each time the menu opens: a projector may have been plugged in since.
        onOpenChange: open => { if (open) sendToExtension('deck/present-options') },
        content: (
          <>
            <DropdownMenuItem disabled={startNumber === null} onSelect={() => onPresent('start')}>
              <Icon name="play" size={14} tone="inherit" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>From the start</span>
                <span className="text-[12px] leading-4 text-ink-muted">{startNumber === null ? 'Every slide is skipped' : `Slide ${startNumber}, full screen`}</span>
              </span>
              <span className="pl-4 text-[12px] text-ink-muted">{START_KEYS}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!options?.available}
              onSelect={event => {
                // The menu stays open, so the check is seen to change.
                event.preventDefault()
                if (options) sendToExtension('deck/present-presenter', { on: !options.on })
              }}
            >
              <Icon name="monitor" size={14} tone="inherit" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>Presenter view</span>
                <span className="text-[12px] leading-4 text-ink-muted">{presenterLine(options)}</span>
              </span>
              {options?.on ? <Icon name="check" size={14} tone="inherit" /> : <span className="w-[14px]" aria-hidden="true" />}
            </DropdownMenuItem>
          </>
        ),
      }}
    />
  )
}

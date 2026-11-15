/**
 * Sprint 159 (PR 5; experience 17 frame 1, as corrected on 15 November): Present on the deck's bar. The button
 * presents from the current slide (⌘↩); its menu has From the start (⇧⌘↩). The keys work anywhere in the deck view,
 * caught before the handout's editor (`usePresentKeys`), so ⇧↩ stays a line break in the handout.
 */
import { useEffect } from 'react'
import { isMac } from '../../../hooks/usePlatform'
import { DropdownMenuItem } from '../../ui/dropdown-menu'
import { Icon } from '../../ui/Icon'
import { SplitButton } from '../../ui/split-button'
import { presentKeyOf } from './wallKeys'

export type PresentFrom = 'here' | 'start'

const HERE_KEYS = isMac ? '⌘↩' : 'Ctrl+Enter'
const START_KEYS = isMac ? '⇧⌘↩' : 'Shift+Ctrl+Enter'

/** ⌘↩ and ⇧⌘↩ in the deck view, while it has slides and no dialog is open. */
export function usePresentKeys(onPresent: (from: PresentFrom) => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const from = presentKeyOf(event, isMac)
      if (!from || event.isComposing) return
      // A dialog or sheet over the deck keeps its own keys.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) onPresent(from)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onPresent, enabled])
}

export function PresentButton({ slideNumber, startNumber, onPresent }: {
  /** The current slide's number, or null when the deck has no slides. */
  slideNumber: number | null
  /** The first slide shown (skipped slides are passed), or null when every slide is skipped. */
  startNumber: number | null
  onPresent: (from: PresentFrom) => void
}) {
  const disabled = slideNumber === null
  return (
    <SplitButton
      tone="outline"
      disabled={disabled}
      className="deck-present"
      main={{
        label: 'Present',
        icon: <Icon name="play" size={14} tone="inherit" />,
        tooltip: disabled ? 'Add a slide to present the deck' : `Present from slide ${slideNumber}, full screen (${HERE_KEYS})`,
        onClick: () => onPresent('here'),
      }}
      menu={{
        label: 'More ways to present',
        tooltip: 'More ways to present',
        align: 'end',
        content: (
          <DropdownMenuItem disabled={startNumber === null} onSelect={() => onPresent('start')}>
            <Icon name="play" size={14} tone="inherit" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span>From the start</span>
              <span className="text-[12px] leading-4 text-ink-muted">{startNumber === null ? 'Every slide is skipped' : `Slide ${startNumber}, full screen`}</span>
            </span>
            <span className="pl-4 text-[12px] text-ink-muted">{START_KEYS}</span>
          </DropdownMenuItem>
        ),
      }}
    />
  )
}

import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Tooltip } from '../ui/tooltip'
import { useDismissOnOutside } from '../../lib/dismissOnOutside'
import { MAX_LENGTH_MINUTES } from '../../../../src/decks/present/presentSession'
import type { TimetableSlide } from '../../../../src/decks/timetable'
import { slideCountWithMinutes } from '../../../../src/decks/timetableDisplay'

export function draftMinutes(draft: string): string | undefined | null {
  if (draft === '') return undefined
  return /^\d{1,4}$/.test(draft) && Number(draft) <= MAX_LENGTH_MINUTES ? String(Number(draft)) : null
}

export function DeckMinutes({ count, timing, fromLabel, onCommit }: {
  count: string
  timing: TimetableSlide
  fromLabel: boolean
  onCommit: (value: string | undefined) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const edit = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  // Return and Escape close the box themselves; a blur the browser may fire as the box leaves the page must not save
  // again (Escape would otherwise save what it meant to drop).
  const closing = useRef(false)
  const editing = draft !== null
  if (editing === false) closing.current = false
  useLayoutEffect(() => {
    if (editing) {
      input.current?.focus()
      input.current?.select()
    } else if (returnFocus.current) {
      returnFocus.current = false
      trigger.current?.focus({ preventScroll: true })
    }
  }, [editing])

  // Outside presses can keep their target from taking focus (for example the slide toolbar).
  // Blur the field explicitly so those presses save through the same path.
  useDismissOnOutside(edit, () => input.current?.blur(), { enabled: editing })

  if (draft === null) {
    const label = slideCountWithMinutes(count, timing)
    const action = timing.minutes === null ? 'Set slide minutes' : 'Edit slide minutes'
    return (
      <Tooltip label={fromLabel ? 'From the exercise label. Click to change.' : action}>
        <Button
          ref={trigger}
          variant="ghost"
          size="compact"
          className="deck-minutes-run"
          aria-label={`${label}, ${action.toLowerCase()}`}
          onClick={() => setDraft(timing.minutes === null ? '' : String(timing.minutes))}
        >
          {label}
        </Button>
      </Tooltip>
    )
  }

  const value = draftMinutes(draft)
  return (
    <span ref={edit} className="deck-minutes-edit">
      <span>{count} ·</span>
      <Tooltip label={`Whole minutes, 0 to ${MAX_LENGTH_MINUTES}. Press Return or click away to save.`}>
        <Input
          ref={input}
          className="deck-minutes-input"
          inputMode="numeric"
          aria-label="Slide minutes"
          aria-invalid={value === null}
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={() => {
            if (closing.current) return
            setDraft(null)
            if (value !== null) onCommit(value)
          }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return
            event.preventDefault()
            event.stopPropagation()
            if (event.key === 'Enter' && value === null) return
            returnFocus.current = true
            closing.current = true
            setDraft(null)
            if (event.key === 'Enter' && value !== null) onCommit(value)
          }}
        />
      </Tooltip>
      <span>min</span>
    </span>
  )
}

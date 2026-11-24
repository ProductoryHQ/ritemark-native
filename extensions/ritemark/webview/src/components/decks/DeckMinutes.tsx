import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { Tooltip } from '../ui/tooltip'
import { MAX_LENGTH_MINUTES } from '../../../../src/decks/present/presentSession'

export function DeckMinutes({ label, minutes, addFromCount, onCommit }: {
  label: string
  minutes: number | null
  addFromCount?: boolean
  onCommit: (value: string | undefined) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  useLayoutEffect(() => {
    if (draft !== null && document.activeElement !== input.current) {
      input.current?.focus()
      input.current?.select()
    } else if (draft === null && returnFocus.current) {
      returnFocus.current = false
      trigger.current?.focus()
    }
  }, [draft])

  // A slide's minutes stay within a day, as the session's do: a slip of the keyboard never plans 2500000 minutes.
  const valid = draft === '' || (draft !== null && /^\d{1,4}$/.test(draft) && Number(draft) <= MAX_LENGTH_MINUTES)
  return draft === null ? (
    <Tooltip label={minutes === null ? 'Set slide minutes' : 'Edit slide minutes'} className="deck-minutes">
      <Button
        ref={trigger}
        variant={addFromCount ? 'ghost' : 'outline'}
        size="sm"
        className={addFromCount ? 'deck-minutes-count' : 'deck-minutes-chip'}
        aria-label={`${label}, ${minutes === null ? 'set' : 'edit'} slide minutes`}
        onClick={() => setDraft(minutes === null ? '' : String(minutes))}
      >
        {addFromCount ? null : <Icon name="timer" size={14} tone="muted" />}
        {label}
      </Button>
    </Tooltip>
  ) : (
    <Tooltip label={valid ? 'Whole minutes. Press Return to save.' : `Enter whole minutes, up to ${MAX_LENGTH_MINUTES}.`}>
      <Input
        ref={input}
        className="deck-minutes-input"
        inputMode="numeric"
        aria-label="Slide minutes"
        aria-invalid={!valid}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Enter' && !valid) return
          returnFocus.current = true
          if (event.key === 'Enter') onCommit(draft === '' ? undefined : String(Number(draft)))
          setDraft(null)
        }}
      />
    </Tooltip>
  )
}

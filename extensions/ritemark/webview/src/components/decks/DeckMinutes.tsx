import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { Tooltip } from '../ui/tooltip'

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

  const valid = draft === '' || (draft !== null && /^\d+$/.test(draft) && Number.isSafeInteger(Number(draft)))
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
    <Tooltip label={valid ? 'Whole minutes. Press Return to save.' : 'Enter a whole number of minutes.'}>
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

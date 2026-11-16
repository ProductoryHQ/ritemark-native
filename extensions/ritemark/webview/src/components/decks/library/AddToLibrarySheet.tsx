/**
 * Sprint 157 (the Experience lead's note of 15 November; prototype `sh.kind === 'addlib'`): Add to library as a small
 * sheet beside the slide, in place of a quick pick at the top of the window, so the eye stays on the deck. The topics
 * come from the host; "New topic…" takes a name.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button } from '../../ui/button'
import { Icon } from '../../ui/Icon'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '../../ui/select'
import { Tooltip } from '../../ui/tooltip'
import { useDismissOnOutside } from '../../../lib/dismissOnOutside'

export interface LibraryTopic {
  path: string
  name: string
  count: number
}

const NEW_TOPIC = '__new'
/** A topic's name never holds these: it is a file name in the Slide library folder. */
const BAD_NAME = /[\\/:*?"<>|]/
/** A new topic's name, at most this long: it becomes a file name, and the host takes paths up to its own limit. */
const MAX_NAME = 120

interface AddToLibrarySheetProps {
  number: number
  /** The library's topics; null while the host reads them. */
  topics: LibraryTopic[] | null
  style: CSSProperties
  onAdd: (topic: string) => void
  onClose: () => void
}

export function AddToLibrarySheet({ number, topics, style, onAdd, onClose }: AddToLibrarySheetProps) {
  const [choice, setChoice] = useState<string>('')
  const [name, setName] = useState('')
  const nameField = useRef<HTMLInputElement>(null)
  // 17 November (Jarmo): a press outside the sheet closes it, as Esc does. A Select's list is its own layer: choosing
  // a topic keeps the sheet open.
  const ref = useRef<HTMLDivElement>(null)
  useDismissOnOutside(ref, onClose)

  // The first topic is chosen once the topics come; with none, a new topic.
  useEffect(() => {
    if (topics && !choice) setChoice(topics[0]?.path ?? NEW_TOPIC)
  }, [topics, choice])
  useEffect(() => {
    if (choice === NEW_TOPIC) nameField.current?.focus()
  }, [choice])

  const trimmed = name.trim()
  const nameProblem = choice === NEW_TOPIC ? (!trimmed ? 'Give the topic a name' : BAD_NAME.test(trimmed) ? 'A topic name has no / \\ : * ? " < > |' : trimmed.length > MAX_NAME ? `A topic name has at most ${MAX_NAME} characters` : null) : null
  const ready = !!choice && !nameProblem
  const add = () => { if (ready) onAdd(choice === NEW_TOPIC ? trimmed : choice) }

  return (
    <div
      ref={ref}
      className="deck-settings deck-addlib"
      style={style}
      role="dialog"
      aria-label={`Add slide ${number} to the library`}
      onKeyDown={event => {
        if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') { event.preventDefault(); add() }
      }}
    >
      <header className="deck-settings-head">
        <span>Add slide {number} to the library</span>
        <Tooltip label="Close without adding">
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={14} tone="inherit" />
          </Button>
        </Tooltip>
      </header>
      <p className="deck-addlib-lede">It goes into the topic's deck in the Slide library, and this slide becomes a copy of it.</p>
      <div className="deck-settings-k">Topic</div>
      <Select value={choice} onValueChange={setChoice} disabled={!topics}>
        <SelectTrigger aria-label="Topic" className="deck-addlib-topic">
          <SelectValue placeholder={topics ? 'Choose a topic' : 'Reading the library…'} />
        </SelectTrigger>
        <SelectContent>
          {(topics ?? []).map(topic => (
            <SelectItem key={topic.path} value={topic.path}>
              {topic.name} · {topic.count} slide{topic.count === 1 ? '' : 's'}
            </SelectItem>
          ))}
          {topics?.length ? <SelectSeparator /> : null}
          <SelectItem value={NEW_TOPIC}>New topic…</SelectItem>
        </SelectContent>
      </Select>
      {choice === NEW_TOPIC ? (
        <>
          <Input
            ref={nameField}
            className="deck-addlib-name"
            placeholder="Working with data"
            aria-label="The new topic's name"
            value={name}
            onChange={event => setName(event.target.value)}
          />
          {name && nameProblem ? <p className="deck-addlib-problem" role="alert">{nameProblem}</p> : null}
        </>
      ) : null}
      <footer className="deck-addlib-foot">
        <Tooltip label="Close without adding">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </Tooltip>
        <Tooltip label={ready ? 'Add this slide to the topic; the slide here becomes a copy of it' : nameProblem ?? 'Choose a topic first'}>
          <Button size="sm" disabled={!ready} onClick={add}>Add to library</Button>
        </Tooltip>
      </footer>
    </div>
  )
}

/**
 * Sprint 161 (PR 3): the slide editor's small tools that open from a block on the slide.
 *
 *  - `SlideIconPicker`: a box's icon, chosen from the grid of 24 with No icon under it (README frame 4), opened under
 *    the icon the person clicked. The menu sits in `document.body`, outside the scaled slide, at its own size.
 *  - `WebPageDialog`: the / menu's Web page asks for the page's address and puts it on the slide as a link (no live
 *    page is drawn: the sprint plan's "same place as a Picture with a link").
 *  - `UnknownIconHint` (#850): pointing at a box's unknown icon shows No icon named “xyz” with Choose an icon.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Dialog, DialogBody, DialogButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Icon } from '../../ui/Icon'
import { Input } from '../../ui/input'
import { Tooltip } from '../../ui/tooltip'
import { IconGridItems } from '../slide/IconGrid'
import { unknownIconWords } from './slideDivView'

/** Where the picker opens, and for which box. */
export interface IconPick {
  pos: number
  rect: { left: number; top: number; width: number; height: number }
  current: string | null
}

export function SlideIconPicker({ pick, onPick, onClose }: { pick: IconPick | null; onPick: (pos: number, name: string | null) => void; onClose: () => void }) {
  if (!pick) return null
  return createPortal(
    <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose() }}>
      <DropdownMenuTrigger asChild>
        {/* The icon's place on the screen: the menu opens under it. */}
        <span
          aria-hidden="true"
          style={{ position: 'fixed', left: pick.rect.left, top: pick.rect.top, width: pick.rect.width, height: pick.rect.height, pointerEvents: 'none' }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto max-w-none" onCloseAutoFocus={event => event.preventDefault()}>
        <IconGridItems current={pick.current} onPick={name => onPick(pick.pos, name)} />
      </DropdownMenuContent>
    </DropdownMenu>,
    document.body,
  )
}

/** #850: a box's unknown icon being pointed at on the stage: which box, its badge, and the name as written. */
export interface IconHint {
  pos: number
  anchor: HTMLElement
  name: string
}

/**
 * #850 (the Experience lead, 19 November; decks README, "Every Phosphor icon"): pointing at a box's unknown icon (the
 * dashed circle) shows a tooltip, No icon named “xyz”, with Choose an icon, which opens the box's icon menu, as a click
 * on the badge does. The menu has no search yet, so the name isn't in one: that waits for Sprint 169's icon search. No
 * banner, no toast.
 *
 * The tooltip's trigger is a round place over the badge, in a layer of the slide's frame (so a wheel over it still
 * reaches the stage), put there when the pointer comes onto the badge (`SlideDivHandlers.hintIcon`). It follows the
 * badge while it shows (the slide may scale or move under it), and goes once the pointer has left it and the tooltip
 * has closed, when the pointer had already gone before it came, when the badge is gone or known, or at a key. The
 * stage ends it too when the slide's words change (`SlideEditor`), so its box's place is never an old one.
 */
export function UnknownIconHint({ frame, hint, onChoose, onDone }: {
  frame: HTMLElement | null
  hint: IconHint | null
  onChoose: (hint: IconHint, rect: DOMRect) => void
  onDone: () => void
}) {
  // A layer of its own, the frame's last child while the frame is there (SlideBlockBar's way: React inserting beside
  // the frame's other children failed), over the block bar's (`deck-icon-hint-layer`, whatever order they came in).
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!frame) return
    const element = document.createElement('div')
    element.className = 'deck-block-layer deck-icon-hint-layer'
    frame.append(element)
    setLayer(element)
    return () => { element.remove(); setLayer(null) }
  }, [frame])
  if (!frame || !layer || !hint || !hint.anchor.isConnected) return null
  return createPortal(<UnknownIconPlace key={`${hint.pos}:${hint.name}`} frame={frame} hint={hint} onChoose={onChoose} onDone={onDone} />, layer)
}

/** How long the place waits for the pointer: one that had already left the badge never comes (a quick sweep). */
const HINT_WAIT_MS = 400

function UnknownIconPlace({ frame, hint, onChoose, onDone }: { frame: HTMLElement; hint: IconHint; onChoose: (hint: IconHint, rect: DOMRect) => void; onDone: () => void }) {
  const open = useRef(false)
  const over = useRef(false)
  const measure = useCallback(() => {
    const badge = hint.anchor.getBoundingClientRect()
    const origin = frame.getBoundingClientRect()
    return { left: badge.left - origin.left, top: badge.top - origin.top, width: badge.width, height: badge.height }
  }, [frame, hint.anchor])
  const [place, setPlace] = useState(measure)
  useEffect(() => {
    // A key ends it (an edit may move the box); so does a pointer that never comes onto the place.
    const end = () => onDone()
    window.addEventListener('keydown', end, true)
    const wait = window.setTimeout(() => { if (!over.current && !open.current) onDone() }, HINT_WAIT_MS)
    // The badge's place, each frame while the hint shows: a new stage size or a move of the slide carries it along.
    let frameId = 0
    const follow = () => {
      if (!hint.anchor.isConnected || !hint.anchor.classList.contains('is-unknown')) {
        onDone()
        return
      }
      const next = measure()
      setPlace(now => (now.left === next.left && now.top === next.top && now.width === next.width && now.height === next.height ? now : next))
      frameId = requestAnimationFrame(follow)
    }
    frameId = requestAnimationFrame(follow)
    return () => {
      window.removeEventListener('keydown', end, true)
      window.clearTimeout(wait)
      cancelAnimationFrame(frameId)
    }
  }, [hint.anchor, measure, onDone])
  const words = unknownIconWords(hint.name)
  const choose = () => onChoose(hint, hint.anchor.getBoundingClientRect())
  return (
    <div className="deck-block-at" style={{ ...place, zIndex: 5 }}>
      <Tooltip
        className="size-full"
        // Beside the badge, where a box has nothing (under it is the box's heading).
        side="right"
        onOpenChange={next => {
          open.current = next
          if (!next && !over.current) onDone()
        }}
        label={(
          <span className="flex flex-col items-start gap-0.5 py-0.5">
            {words}
            <Button variant="link" className="h-auto p-0 text-[12px]" onMouseDown={event => event.preventDefault()} onClick={choose}>Choose an icon</Button>
          </span>
        )}
      >
        <span
          role="button"
          aria-label={`${words}: choose an icon`}
          className="deck-icon-hint"
          // A press keeps the caret where it is, as on every handle over the slide.
          onMouseDown={event => event.preventDefault()}
          onClick={choose}
          onPointerEnter={() => { over.current = true }}
          onPointerMove={() => { over.current = true }}
          onPointerLeave={() => {
            over.current = false
            if (!open.current) onDone()
          }}
        />
      </Tooltip>
    </div>
  )
}

/** The Steps pill being typed in: which block, where the pill is drawn, and its look there. */
export interface PillEdit {
  pos: number
  rect: { left: number; top: number; width: number; height: number }
  /** The slide's scale on the stage (its width / 960): the field's type is the pill's, at that size. */
  scale: number
  words: string
  /** Each press opens a new field. */
  serial: number
  look: { background: string; color: string; font: string; radius: string }
}

/**
 * The Steps pill's words typed in place (README, "The 'Exercise' pill is the person's own word"): a field drawn over the
 * pill in its own look, each key written to the block (`onWords`). Emptied, the pill hides, and while the caret is
 * here the default word shows faint as the placeholder. Enter, Esc or a press elsewhere ends it; Cmd+Z is the deck's.
 */
interface PillFieldProps {
  edit: PillEdit | null
  placeholder: string
  onWords: (pos: number, words: string) => void
  onDone: (refocus: boolean) => void
  onUndo: (redo: boolean) => void
}

export function PillField(props: PillFieldProps) {
  // A new field for each press, starting from the pill's words then.
  return props.edit ? <PillInput key={`${props.edit.pos}:${props.edit.serial}`} {...props} edit={props.edit} /> : null
}

function PillInput({ edit, placeholder, onWords, onDone, onUndo }: PillFieldProps & { edit: PillEdit }) {
  const [words, setWords] = useState(edit.words)
  // The caret goes into the field as it is drawn, after its words (the app run: a focus asked for a frame later was
  // lost when the press had started outside the slide's words).
  const attach = useCallback((input: HTMLInputElement | null) => {
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [])
  const size = 14 * edit.scale
  const shown = words || placeholder
  return createPortal(
    <input
      ref={attach}
      className="deck-pill-field"
      aria-label="The label over the steps"
      spellCheck={false}
      placeholder={placeholder}
      value={words}
      style={{
        position: 'fixed',
        left: edit.rect.left,
        top: edit.rect.top,
        height: edit.rect.height,
        width: `calc(${shown.length}ch + ${shown.length * 0.12 + 1.8}em)`,
        minWidth: edit.rect.width,
        padding: `0 ${12 * edit.scale}px`,
        border: 0,
        borderRadius: edit.look.radius,
        background: edit.look.background,
        color: edit.look.color,
        font: edit.look.font,
        fontSize: size,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        boxShadow: `0 0 0 ${Math.max(1, 2 * edit.scale)}px rgba(242,181,68,.7)`,
        outline: 'none',
        zIndex: 50,
      }}
      onChange={event => {
        const next = event.target.value.replace(/[\r\n]+/g, ' ')
        setWords(next)
        onWords(edit.pos, next)
      }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        const mod = event.metaKey || event.ctrlKey
        if (mod && !event.altKey && (event.key === 'z' || event.key === 'Z' || event.key === 'y')) {
          event.preventDefault()
          onDone(false)
          onUndo(event.key === 'y' || event.shiftKey)
          return
        }
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          onDone(true)
        }
      }}
      onBlur={() => onDone(false)}
    />,
    document.body,
  )
}

/** A web page's address as the slide keeps it: http or https only, as typed; null for anything else. */
export function webPageAddress(typed: string): string | null {
  const text = typed.trim()
  // A scheme only before `//` (`https://`, `file:///`): `localhost:3000` is a host and its port (review of #769), and
  // a `javascript:` or `data:` text read as a host never parses as one.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname || url.username || url.password || /\s/.test(text)) return null
    return withScheme
  } catch {
    return null
  }
}

export function WebPageDialog({ open, onAdd, onClose }: { open: boolean; onAdd: (address: string) => void; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) setTyped('') }, [open])
  const address = webPageAddress(typed)
  const add = () => { if (address) onAdd(address) }
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
      <DialogContent className="max-w-[420px]" onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus() }}>
        <DialogHeader icon={<Icon name="globe" size={20} />} onClose={onClose}>
          <DialogTitle>Web page</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription className="text-sm text-[var(--r-ink-strong)] m-0 mb-3">The page's address goes on the slide as a link.</DialogDescription>
          <Input
            ref={inputRef}
            aria-label="The page's address"
            placeholder="https://"
            value={typed}
            onChange={event => setTyped(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
          />
        </DialogBody>
        <DialogFooter>
          <DialogButton variant="secondary" onClick={onClose}>Cancel</DialogButton>
          <DialogButton disabled={!address} onClick={add}>Add the link</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

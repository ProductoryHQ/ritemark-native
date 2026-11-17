/**
 * Sprint 161 (PR 3): the slide editor's small tools that open from a block on the slide.
 *
 *  - `SlideIconPicker`: a box's icon, chosen from the grid of 24 with No icon under it (README frame 4), opened under
 *    the icon the person clicked. The menu sits in `document.body`, outside the scaled slide, at its own size.
 *  - `WebPageDialog`: the / menu's Web page asks for the page's address and puts it on the slide as a link (no live
 *    page is drawn: the sprint plan's "same place as a Picture with a link").
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Dialog, DialogBody, DialogButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Icon } from '../../ui/Icon'
import { Input } from '../../ui/input'
import { IconGridItems } from '../slide/IconGrid'

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
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname || /\s/.test(text)) return null
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
          <p className="text-sm text-[var(--r-ink-strong)] m-0 mb-3">The page's address goes on the slide as a link.</p>
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

/**
 * Sprint 163 PR 3 (the decks README, "The Button block"; tabs-editor.html's `#bbar2` and `#apop`): the chosen button's
 * bar and its address sheet, on a slide and in a Text document alike.
 *
 *  - **The bar:** Address (opens the sheet), Open (tries the link in the person's own browser) and Delete. It sits under
 *    the button, or over it when the button is at the slide's foot (or the window's). It is the page's own size at any
 *    stage size, so it goes in `document.body`, as the slide block's bar does, and follows its button.
 *  - **The sheet:** the address, "A full address, such as a SharePoint or Drive link. It opens in a new tab." An address
 *    that isn't a full https one is refused: "Use a full address that starts with https://". Done or Enter keeps it and
 *    puts the caret on the button's words; Esc or a press outside leaves the address as it was. The sheet lines up with
 *    the card's left edge, or its right edge where it would run past the editor's (`sheetLeft`): Done is always in view.
 *  - A new button (`BUTTON_ASK`) opens its sheet at once. Left with Esc or a press outside before it has an address, it
 *    goes, as if it had never been added (`dropNewButton`; the smoke run of 19 November).
 *  - #848: a press on the sheet's own button is not outside: the sheet stays, and the caret goes into the button's words
 *    (`pressOnPill` for its icon). While the sheet is open, Enter in the button's words goes on to the address; once it
 *    is closed, Enter ends them as before.
 *
 * Every button has a tooltip and one line of words; a press on the bar never takes the caret out of the editor. ⌘Z is
 * the editor's (a slide's: the deck's): each change is an undo step of its own.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Editor as TipTapEditor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import { BUTTON_WORDS, isButtonAddress } from '../../../../src/decks/blocks/buttonBlock'
import { sendToExtension } from '../../bridge'
import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { Icon } from '../../components/ui/Icon'
import { useDismissOnOutside } from '../../lib/dismissOnOutside'
import { BUTTON_ASK, BUTTON_DROP, BUTTON_LABEL_NODE, buttonAt, deleteButton, newButtonOf, setButtonAddress, sheetLeft, sheetWidth, takeBackNewButton, type NewButton } from './buttonCommands'
import { unchooseButton } from './ButtonBlock'
import './buttonBlock.css'

/** Between the button and its bar, clear of its ring (the drawing's 12 px). */
const GAP = 12
/** Between the bar and the sheet. */
const SHEET_GAP = 8
/** The chosen button's ring, out from its card: every chosen block's (`blockBar.ringGap`). */
const RING_GAP = 8

export interface ButtonBlockToolsProps {
  editor: TipTapEditor | null
  /** The slide's frame (a slide editor's): the bar goes over the button at the slide's foot. A Text document: none. */
  frame?: HTMLElement | null
  /**
   * A slide's: take a new button back through the deck's own history (its adding is the deck's last undo step), so no
   * step is left. False when that can't be done exactly; the button then goes as `dropNewButton` takes it.
   */
  takeBackNew?: () => boolean
}

/** An open address sheet: its button; for a new one, how it was added and whether nothing else has changed since
 *  (`exact`: its adding can be undone as it was); and which opening it is (`id`: its field takes the keys once, as it
 *  opens, never again at each change while it is open). */
interface Sheet {
  pos: number
  added: NewButton | null
  exact: boolean
  id: number
}

let sheetIds = 0

interface Placed {
  pos: number
  href: string
  left: number
  right: number
  top: number
  bottom: number
}

/** Ask the host to open a button's address in the person's own browser: a full https one only. */
export function openButtonAddress(href: string): boolean {
  if (!isButtonAddress(href)) return false
  sendToExtension('openButtonLink', { url: href })
  return true
}

export function ButtonBlockTools({ editor, frame = null, takeBackNew }: ButtonBlockToolsProps) {
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [focused, setFocused] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [draft, setDraft] = useState('')
  const [refused, setRefused] = useState(false)
  const [barAt, setBarAt] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const addressRef = useRef<HTMLSpanElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  /** The chosen button now, and where it is on the screen. */
  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const found = buttonAt(editor.state)
    const dom = found ? (editor.view.nodeDOM(found.pos) as HTMLElement | null) : null
    if (!found || !dom || typeof dom.getBoundingClientRect !== 'function') {
      setPlaced(null)
      return
    }
    const rect = dom.getBoundingClientRect()
    const next: Placed = { pos: found.pos, href: String(found.node.attrs.href ?? ''), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    setPlaced(current => (current && current.pos === next.pos && current.href === next.href && current.left === next.left && current.right === next.right && current.top === next.top && current.bottom === next.bottom ? current : next))
  }, [editor])

  useEffect(() => {
    if (!editor) return
    let frameId = 0
    const later = () => { cancelAnimationFrame(frameId); frameId = requestAnimationFrame(measure) }
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      // A new button: its address sheet opens at once, empty.
      if (transaction.getMeta(BUTTON_ASK)) {
        const found = buttonAt(editor.state)
        // Measured now, with the sheet: a sheet whose button isn't placed yet would close at once.
        measure()
        if (found) {
          setSheet({ pos: found.pos, added: newButtonOf(transaction, editor.state, found.pos), exact: true, id: ++sheetIds })
          setDraft(String(found.node.attrs.href ?? ''))
          setRefused(false)
        }
      } else if (transaction.docChanged && !transaction.getMeta(BUTTON_DROP)) {
        // Anything else changed: the sheet follows its button, and its adding is no longer the last step.
        setSheet(current => {
          if (!current) return current
          const pos = transaction.mapping.map(current.pos)
          return { ...current, pos, added: current.added ? { ...current.added, pos } : null, exact: false }
        })
      }
      later()
    }
    const onFocus = () => { setFocused(true); later() }
    const onBlur = () => setFocused(false)
    measure()
    setFocused(editor.isFocused)
    editor.on('transaction', onTransaction)
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    window.addEventListener('resize', later)
    document.addEventListener('scroll', later, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later)
    observer?.observe(editor.view.dom)
    return () => {
      cancelAnimationFrame(frameId)
      editor.off('transaction', onTransaction)
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
      window.removeEventListener('resize', later)
      document.removeEventListener('scroll', later, true)
      observer?.disconnect()
    }
  }, [editor, measure])


  const showing = !!placed && (focused || !!sheet)

  // Under the button, or over it at the slide's foot (or the window's); never off the window.
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!showing || !placed || !bar) { setBarAt(null); return }
    const height = bar.offsetHeight
    const width = bar.offsetWidth
    const foot = Math.min(window.innerHeight - 8, frame ? frame.getBoundingClientRect().bottom : Infinity)
    const above = placed.bottom + GAP + height > foot
    const top = above ? Math.max(8, placed.top - GAP - height) : placed.bottom + GAP
    const left = Math.max(8, Math.min(placed.left, window.innerWidth - width - 8))
    setBarAt(current => (current && current.left === left && current.top === top && current.above === above ? current : { left, top, above }))
  }, [showing, placed, frame, sheet])

  // The sheet's field takes the keys as it opens, its words chosen; only then: the words typed on the button while it
  // is open (#848) are changes too, and the field must not take the keys back at each one.
  const sheetId = sheet?.id ?? 0
  useEffect(() => {
    if (!sheetId) return
    const id = requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
    return () => cancelAnimationFrame(id)
  }, [sheetId])

  // #848: while the sheet is open, Enter in its button's own words ends them by going on to the address, the next thing
  // the button needs. Ending them as a closed sheet's button does (the caret to the line after) would leave the button,
  // close the sheet and take a new button, its words just typed, away. Before the editor's own keys hear it.
  const sheetPos = sheet?.pos ?? -1
  useEffect(() => {
    if (!editor || editor.isDestroyed || !sheetId) return
    const dom = editor.view.dom
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return
      const { $from, empty } = editor.state.selection
      if (!empty || $from.parent.type.name !== BUTTON_LABEL_NODE || buttonAt(editor.state)?.pos !== sheetPos) return
      event.preventDefault()
      event.stopImmediatePropagation()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    dom.addEventListener('keydown', onKey, true)
    return () => dom.removeEventListener('keydown', onKey, true)
  }, [editor, sheetId, sheetPos])

  /** A new button left before it has an address goes, leaving no undo step (one that has an address keeps it). */
  const takeBack = useCallback((was: Sheet | null): boolean => {
    if (!editor || editor.isDestroyed || !was?.added) return false
    const node = editor.state.doc.nodeAt(was.pos)
    if (!node || node.type.name !== 'buttonBlock' || String(node.attrs.href ?? '')) return false
    if (was.exact && takeBackNew?.()) return true
    return takeBackNewButton(editor.view, was.added, was.exact)
  }, [editor, takeBackNew])

  // The sheet belongs to its button: the caret leaving it (another button, other words) closes it, and a new button
  // left so goes too.
  useEffect(() => {
    if (sheet && (!placed || placed.pos !== sheet.pos)) {
      setSheet(null)
      takeBack(sheet)
    }
  }, [placed, sheet, takeBack])

  const closeSheet = useCallback((refocus: boolean) => {
    const was = sheet
    setSheet(null)
    setRefused(false)
    if (!editor || editor.isDestroyed) return
    if (takeBack(was)) {
      if (refocus) editor.view.focus()
      return
    }
    if (refocus) editor.view.focus()
    // A press elsewhere: the focus went with it, so the button is no longer chosen.
    else if (!editor.view.hasFocus()) unchooseButton(editor.view)
  }, [editor, sheet, takeBack])

  // A press on the sheet's own button (its words, its pill) is not outside (#848): the caret goes there, the sheet stays.
  const sheetButton = useCallback((): HTMLElement | null => {
    if (!sheet || !editor || editor.isDestroyed) return null
    const dom = editor.view.nodeDOM(sheet.pos)
    return dom instanceof HTMLElement ? dom : null
  }, [editor, sheet])
  useDismissOnOutside(sheetRef, () => closeSheet(false), { trigger: () => addressRef.current, alsoInside: sheetButton, enabled: !!sheet })

  if (!editor || !placed || !showing) return null

  const run = (tr: Transaction | null) => {
    if (tr && !editor.isDestroyed) editor.view.dispatch(tr)
    editor.view.focus()
  }
  /** The chosen button as it is now: an AI's edit or an undo may have moved it since it was measured. */
  const nowPos = (): number | null => buttonAt(editor.state)?.pos ?? null

  const done = () => {
    const pos = nowPos()
    if (pos === null) { closeSheet(true); return }
    const tr = setButtonAddress(editor.state, pos, draft)
    if (!tr) {
      setRefused(true)
      inputRef.current?.focus()
      return
    }
    setSheet(null)
    setRefused(false)
    run(tr)
  }

  const onKeys = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // After the key's own events: the Enter would otherwise reach the editor, now focused, and leave the button.
    if (event.key === 'Enter') { event.preventDefault(); setTimeout(done, 0) }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSheet(true) }
  }

  const canOpen = isButtonAddress(placed.href)
  const hidden = barAt ? {} : { visibility: 'hidden' as const }
  const sheetAt = sheetLeft(placed, sheetWidth(window.innerWidth), { left: 8, right: window.innerWidth - 8 })
  const sheetStyle = barAt
    ? (barAt.above ? { left: sheetAt, top: barAt.top - SHEET_GAP, transform: 'translateY(-100%)' } : { left: sheetAt, top: barAt.top + (barRef.current?.offsetHeight ?? 38) + SHEET_GAP })
    : { visibility: 'hidden' as const }

  // On a slide, the chosen button's ring is every chosen block's (`.deck-block-ring`, 8 px out, in the frame), not
  // an amber outline of its own (the Experience lead, 19 November).
  const origin = frame ? frame.getBoundingClientRect() : null
  const ring = frame && origin
    ? createPortal(<div className="deck-block-ring" style={{ left: placed.left - origin.left - RING_GAP, top: placed.top - origin.top - RING_GAP, width: placed.right - placed.left + RING_GAP * 2, height: placed.bottom - placed.top + RING_GAP * 2 }} aria-hidden="true" />, frame)
    : null

  return createPortal(
    <>
      {ring}
      <div ref={barRef} className="btn-block-bar" role="toolbar" aria-label="The button" style={{ left: barAt?.left ?? 0, top: barAt?.top ?? 0, ...hidden }}>
        <Tooltip label={BUTTON_WORDS.addressTip}>
          <span ref={addressRef} className="inline-flex">
            <Button
              variant="toolbar"
              size="compact"
              aria-expanded={!!sheet}
              data-state={sheet ? 'active' : undefined}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                if (sheet) { closeSheet(true); return }
                setDraft(placed.href)
                setRefused(false)
                setSheet({ pos: placed.pos, added: null, exact: false, id: ++sheetIds })
              }}
            >
              <Icon name="link" size={16} tone="inherit" />
              {BUTTON_WORDS.address}
            </Button>
          </span>
        </Tooltip>
        <Tooltip label={canOpen ? BUTTON_WORDS.openTip : BUTTON_WORDS.openNone}>
          <Button variant="toolbar" size="compact" disabled={!canOpen} onMouseDown={event => event.preventDefault()} onClick={() => openButtonAddress(placed.href)}>
            <Icon name="arrow-up-right" size={16} tone="inherit" />
            {BUTTON_WORDS.open}
          </Button>
        </Tooltip>
        <span className="btn-block-sep" aria-hidden="true" />
        <Tooltip label={BUTTON_WORDS.deleteTip}>
          <Button
            variant="toolbar"
            size="compact"
            aria-label={BUTTON_WORDS.deleteTip}
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              const pos = nowPos()
              setSheet(null)
              run(pos === null ? null : deleteButton(editor.state, pos))
            }}
          >
            <Icon name="trash" size={16} tone="inherit" />
          </Button>
        </Tooltip>
      </div>
      {sheet ? (
        <div ref={sheetRef} className="btn-block-sheet" role="dialog" aria-label={BUTTON_WORDS.sheetTitle} style={sheetStyle}>
          <div className="btn-block-sheet-head">{BUTTON_WORDS.sheetTitle}</div>
          <input
            ref={inputRef}
            className="btn-block-sheet-input"
            value={draft}
            placeholder={BUTTON_WORDS.placeholder}
            spellCheck={false}
            aria-label={BUTTON_WORDS.sheetTitle}
            aria-invalid={refused || undefined}
            onChange={event => { setDraft(event.target.value); setRefused(false) }}
            onKeyDown={onKeys}
          />
          <p className={`btn-block-sheet-hint${refused ? ' is-refused' : ''}`} role={refused ? 'alert' : undefined}>
            {refused ? BUTTON_WORDS.refused : BUTTON_WORDS.hint}
          </p>
          <div className="btn-block-sheet-row">
            <Tooltip label={BUTTON_WORDS.doneTip}>
              <Button size="sm" onClick={done}>{BUTTON_WORDS.done}</Button>
            </Tooltip>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  )
}

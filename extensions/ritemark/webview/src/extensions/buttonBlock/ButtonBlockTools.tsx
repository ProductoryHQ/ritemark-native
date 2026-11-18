/**
 * Sprint 163 PR 3 (the decks README, "The Button block"; tabs-editor.html's `#bbar2` and `#apop`): the chosen button's
 * bar and its address sheet, on a slide and in a Text document alike.
 *
 *  - **The bar:** Address (opens the sheet), Open (tries the link in the person's own browser) and Delete. It sits under
 *    the button, or over it when the button is at the slide's foot (or the window's). It is the page's own size at any
 *    stage size, so it goes in `document.body`, as the slide block's bar does, and follows its button.
 *  - **The sheet:** the address, "A full address, such as a SharePoint or Drive link. It opens in a new tab." An address
 *    that isn't a full https one is refused: "Use a full address that starts with https://". Done or Enter keeps it and
 *    puts the caret on the button's words; Esc or a press outside leaves the address as it was.
 *  - A new button (`BUTTON_ASK`) opens its sheet at once.
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
import { BUTTON_ASK, buttonAt, deleteButton, setButtonAddress } from './buttonCommands'
import './buttonBlock.css'

/** Between the button and its bar, clear of its ring (the drawing's 12 px). */
const GAP = 12
/** Between the bar and the sheet. */
const SHEET_GAP = 8

export interface ButtonBlockToolsProps {
  editor: TipTapEditor | null
  /** The slide's frame (a slide editor's): the bar goes over the button at the slide's foot. A Text document: none. */
  frame?: HTMLElement | null
}

interface Placed {
  pos: number
  href: string
  left: number
  top: number
  bottom: number
}

/** Ask the host to open a button's address in the person's own browser: a full https one only. */
export function openButtonAddress(href: string): boolean {
  if (!isButtonAddress(href)) return false
  sendToExtension('openButtonLink', { url: href })
  return true
}

export function ButtonBlockTools({ editor, frame = null }: ButtonBlockToolsProps) {
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [focused, setFocused] = useState(false)
  const [sheet, setSheet] = useState<{ pos: number } | null>(null)
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
    const next: Placed = { pos: found.pos, href: String(found.node.attrs.href ?? ''), left: rect.left, top: rect.top, bottom: rect.bottom }
    setPlaced(current => (current && current.pos === next.pos && current.href === next.href && current.left === next.left && current.top === next.top && current.bottom === next.bottom ? current : next))
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
          setSheet({ pos: found.pos })
          setDraft(String(found.node.attrs.href ?? ''))
          setRefused(false)
        }
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

  // The sheet belongs to its button: the caret leaving it (another button, other words) closes it.
  useEffect(() => {
    if (sheet && (!placed || placed.pos !== sheet.pos)) setSheet(null)
  }, [placed, sheet])

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

  // The sheet's field takes the keys as it opens, its words chosen.
  useEffect(() => {
    if (!sheet) return
    const id = requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
    return () => cancelAnimationFrame(id)
  }, [sheet])

  const closeSheet = useCallback((refocus: boolean) => {
    setSheet(null)
    setRefused(false)
    if (refocus && editor && !editor.isDestroyed) editor.view.focus()
  }, [editor])

  useDismissOnOutside(sheetRef, () => closeSheet(false), { trigger: () => addressRef.current, enabled: !!sheet })

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
    if (event.key === 'Enter') { event.preventDefault(); done() }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSheet(true) }
  }

  const canOpen = isButtonAddress(placed.href)
  const hidden = barAt ? {} : { visibility: 'hidden' as const }
  const sheetStyle = barAt
    ? (barAt.above ? { left: barAt.left, top: barAt.top - SHEET_GAP, transform: 'translateY(-100%)' } : { left: barAt.left, top: barAt.top + (barRef.current?.offsetHeight ?? 38) + SHEET_GAP })
    : { visibility: 'hidden' as const }

  return createPortal(
    <>
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
                setSheet({ pos: placed.pos })
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
            <Button size="sm" onClick={done}>{BUTTON_WORDS.done}</Button>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  )
}

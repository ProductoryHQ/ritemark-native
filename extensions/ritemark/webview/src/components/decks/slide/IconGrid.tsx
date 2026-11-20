/**
 * Sprint 157 (prototype frame 4): a box's icon chosen from the grid of 24, with No icon under it. The menu's items,
 * shared by the old layout's picker (`SlideCanvas`) and, since Sprint 161's PR 3, the block slide's (`SlideIconPicker`).
 * Sprint 169 PR 2 (#867): each choice is drawn as the slide draws it (`SlideIconGlyph`, the full set), not by the
 * chrome's `Icon`; No icon's cross is the menu's own, so it stays the chrome's.
 *
 * Sprint 169 PR 3 (#868; decks README, "Every Phosphor icon, found by searching"): a Search icons field on top, which
 * takes focus when the menu opens. Before typing, the deck's icons in use, then the 24; as one types, the icons found
 * by name, Phosphor's tags and the grid's aliases (`iconSearch.ts`), a page at a time; "No icons match" when none are.
 * No icon stays at the foot. The caret stays in the field: ↑ and ↓ move the highlight a row, ← and → an icon once one is
 * highlighted, Enter chooses (through the item, so the menu closes), Esc and a click outside close the menu as every
 * popup does. The field names the highlight to a screen reader (`aria-activedescendant`). The choices' place keeps its
 * size, so the menu never jumps.
 */
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { DropdownMenuItem, DropdownMenuSeparator } from '../../ui/dropdown-menu'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { iconMenuChoices, iconMenuMoreLine, iconMenuMove, type IconMenuMove } from './iconSearch'
import type { SlideIcon } from './iconSet'
import { SlideIconGlyph } from './SlideIconGlyph'

/**
 * The open deck's icons in use (`deckIconsInUse`), for the menu's first view. The deck view gives a getter, so the deck
 * is read only when a menu opens, not at every edit.
 */
export const DeckIconsContext = createContext<() => readonly SlideIcon[]>(() => [])

/** The grid's columns (decks.css `.deck-icon-grid`): ↑ and ↓ move by one row of them. */
const COLUMNS = 6

/** How long a highlighted icon waits before its name shows: the tooltips' own wait (`ui/tooltip.tsx`). */
const TIP_WAIT_MS = 300

const MOVES: Readonly<Record<string, IconMenuMove>> = { ArrowDown: 'down', ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right' }

/** Radix moves focus to an item under the pointer, and back to the menu as it leaves: the caret stays in the field. */
const keepFocus = (event: PointerEvent) => event.preventDefault()

export function IconGridItems({ current, onPick }: { current: string | null; onPick: (name: string | null) => void }) {
  const inUseOf = useContext(DeckIconsContext)
  // The deck's icons as the menu opens; they don't change while it is open.
  const [inUse] = useState(inUseOf)
  const [query, setQuery] = useState('')
  const { icons, total, searching } = useMemo(() => iconMenuChoices(query, inUse), [query, inUse])
  // The highlighted choice: an icon's place, `icons.length` for No icon, -1 for none. Typing highlights the best result.
  const [active, setActive] = useState(-1)
  useEffect(() => setActive(searching && icons.length ? 0 : -1), [query, searching, icons.length])
  const noIcon = current ? icons.length : -1
  const choicesId = useId()

  // The field takes focus as the menu opens, so one can type at once: after Radix has focused the menu itself (its
  // mount, and an item for a menu opened by keyboard), which runs after this component's own effects.
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [])

  const scroller = useRef<HTMLDivElement>(null)
  // Only a key scrolls the list to the highlight; the pointer highlights what it is over, and the list stays put.
  const byKey = useRef(false)
  useEffect(() => {
    if (active < 0) {
      scroller.current?.scrollTo({ top: 0 })
      return
    }
    if (!byKey.current) return
    byKey.current = false
    scroller.current?.querySelector(`[data-choice="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, icons])

  // The highlighted icon's name in a tooltip (the words a screen reader hears), when the pointer or an arrow key put the
  // highlight there; not for the best result typing highlights. Shown after the tooltips' usual wait, one at a time.
  const tipWanted = useRef(false)
  const [tip, setTip] = useState(-1)
  // Bumped as the pointer comes onto an icon, so coming back onto the highlighted one shows its name again.
  const [entered, setEntered] = useState(0)
  useEffect(() => {
    setTip(-1)
    if (!tipWanted.current || active < 0 || active >= icons.length) return
    const wait = window.setTimeout(() => setTip(active), TIP_WAIT_MS)
    return () => window.clearTimeout(wait)
  }, [active, icons, entered])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Esc and Tab go on to the menu (it closes; it keeps focus in). Every other key is the field's, not the menu's typeahead.
    if (event.key === 'Escape' || event.key === 'Tab') return
    event.stopPropagation()
    const move = MOVES[event.key]
    // ← and → move the caret until an icon is highlighted (typing highlights the best one), then the highlight.
    if (move && ((move !== 'left' && move !== 'right') || (active >= 0 && active < icons.length))) {
      event.preventDefault()
      byKey.current = true
      tipWanted.current = true
      setActive(at => iconMenuMove(at, move, icons.length, !!current, COLUMNS))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      // Through the item itself, so the menu chooses and closes as on a click, whoever owns it.
      const item = active === noIcon ? 'none' : active >= 0 && active < icons.length ? String(active) : null
      if (item) scroller.current?.parentElement?.querySelector<HTMLElement>(`[data-choice="${item}"]`)?.click()
    }
  }

  return (
    <>
      <label className="deck-icon-search">
        <Icon name="magnifying-glass" size={14} tone="inherit" />
        <input
          ref={field}
          type="search"
          placeholder="Search icons"
          aria-label="Search icons by name or word"
          role="combobox"
          aria-expanded="true"
          aria-controls={choicesId}
          aria-activedescendant={active === noIcon && noIcon >= 0 ? `${choicesId}-none` : active >= 0 && active < icons.length ? `${choicesId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={event => { tipWanted.current = false; setQuery(event.target.value) }}
          onKeyDown={onKeyDown}
        />
      </label>
      <div ref={scroller} className="deck-icon-scroll" id={choicesId}>
        {icons.length ? (
          <div className="deck-icon-grid" role="group" aria-label={searching ? 'Icons found' : 'Icons'}>
            {icons.map((icon, index) => (
              <Tooltip key={icon.phosphor} label={icon.label} open={index === tip}>
                <DropdownMenuItem
                  aria-label={icon.label}
                  id={`${choicesId}-${index}`}
                  data-choice={index}
                  data-state={icon.name === current ? 'on' : undefined}
                  className={`deck-icon-choice${index === active ? ' is-active' : ''}`}
                  onPointerEnter={() => { tipWanted.current = true; setEntered(n => n + 1) }}
                  onPointerMove={event => { keepFocus(event); tipWanted.current = true; setActive(index) }}
                  onPointerLeave={event => { keepFocus(event); tipWanted.current = false; setTip(-1) }}
                  onSelect={() => onPick(icon.name)}
                >
                  <SlideIconGlyph name={icon.phosphor} size={16} />
                </DropdownMenuItem>
              </Tooltip>
            ))}
          </div>
        ) : (
          <p className="deck-icon-none" role="status">No icons match</p>
        )}
      </div>
      {/* Under the grid, in view whatever the scroll; its place is kept when empty, so the menu doesn't jump. */}
      <p className="deck-icon-more" aria-live="polite">{iconMenuMoreLine(icons.length, total) ?? ''}</p>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        id={`${choicesId}-none`}
        data-choice="none"
        disabled={!current}
        className={active === noIcon && noIcon >= 0 ? 'bg-surface-soft' : undefined}
        onPointerMove={event => { keepFocus(event); if (current) setActive(icons.length) }}
        onPointerLeave={keepFocus}
        onSelect={() => onPick(null)}
      >
        <Icon name="x" size={14} tone="inherit" />
        No icon
      </DropdownMenuItem>
    </>
  )
}

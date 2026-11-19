/**
 * Sprint 157 (prototype frame 4): a box's icon chosen from the grid of 24, with No icon under it. The menu's items,
 * shared by the old layout's picker (`SlideCanvas`) and, since Sprint 161's PR 3, the block slide's (`SlideIconPicker`).
 * Sprint 169 PR 2 (#867): each choice is drawn as the slide draws it (`SlideIconGlyph`, the full set), not by the
 * chrome's `Icon`; No icon's cross is the menu's own, so it stays the chrome's.
 *
 * Sprint 169 PR 3 (#868; decks README, "Every Phosphor icon, found by searching"): a Search icons field on top, which
 * takes focus when the menu opens. Before typing, the deck's icons in use, then the 24; as one types, the icons found
 * by name, Phosphor's tags and the grid's aliases (`iconSearch.ts`), a page at a time; "No icons match" when none are.
 * No icon stays at the foot. The caret stays in the field: ↑ and ↓ move the highlight a row, Enter chooses, Esc and a
 * click outside close the menu as every popup does. The choices' place keeps its size, so the menu never jumps.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { DropdownMenuItem, DropdownMenuSeparator } from '../../ui/dropdown-menu'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { iconMenuChoices, iconMenuMove } from './iconSearch'
import type { SlideIcon } from './iconSet'
import { SlideIconGlyph } from './SlideIconGlyph'

/** The open deck's icons in use (`deckIconsInUse`), for the menu's first view; the deck view gives them. */
export const DeckIconsContext = createContext<readonly SlideIcon[]>([])

/** The grid's columns (decks.css `.deck-icon-grid`): ↑ and ↓ move by one row of them. */
const COLUMNS = 6

/** Radix moves focus to an item under the pointer, and back to the menu as it leaves: the caret stays in the field. */
const keepFocus = (event: PointerEvent) => event.preventDefault()

export function IconGridItems({ current, onPick }: { current: string | null; onPick: (name: string | null) => void }) {
  const inUse = useContext(DeckIconsContext)
  const [query, setQuery] = useState('')
  const { icons, total, searching } = useMemo(() => iconMenuChoices(query, inUse), [query, inUse])
  // The highlighted choice: an icon's place, `icons.length` for No icon, -1 for none. Typing highlights the best result.
  const [active, setActive] = useState(-1)
  useEffect(() => setActive(searching && icons.length ? 0 : -1), [query, searching, icons.length])
  const noIcon = current ? icons.length : -1

  // The field takes focus as the menu opens, so one can type at once: after Radix has focused the menu itself (its
  // mount, and an item for a menu opened by keyboard), which runs after this component's own effects.
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [])

  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // The highlighted icon in view (a long list scrolls); the top when the list starts again.
    if (active < 0 || active >= icons.length) {
      if (active < 0) scroller.current?.scrollTo({ top: 0 })
      return
    }
    scroller.current?.querySelector(`[data-choice="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, icons])

  const choose = (index: number) => {
    if (index === noIcon) onPick(null)
    else if (index >= 0 && index < icons.length) onPick(icons[index].name)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Esc goes on to the menu, which closes. Every other key is the field's, not the menu's typeahead.
    if (event.key === 'Escape') return
    event.stopPropagation()
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const down = event.key === 'ArrowDown'
      setActive(at => iconMenuMove(at, down ? 1 : -1, icons.length, !!current, COLUMNS))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      choose(active)
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
          aria-controls="deck-icon-choices"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      <div ref={scroller} className="deck-icon-scroll" id="deck-icon-choices">
        {icons.length ? (
          <div className="deck-icon-grid" role="group" aria-label={searching ? 'Icons found' : 'Icons'}>
            {icons.map((icon, index) => (
              <Tooltip key={icon.phosphor} label={icon.label} hoverOnly>
                <DropdownMenuItem
                  aria-label={icon.label}
                  data-choice={index}
                  data-state={icon.name === current ? 'on' : undefined}
                  className={`deck-icon-choice${index === active ? ' is-active' : ''}`}
                  onPointerMove={event => { keepFocus(event); setActive(index) }}
                  onPointerLeave={keepFocus}
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
        {total > icons.length ? (
          <p className="deck-icon-more">{`${icons.length} of ${total} icons. Type more to narrow them.`}</p>
        ) : null}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem
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

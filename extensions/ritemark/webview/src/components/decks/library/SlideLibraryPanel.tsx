/**
 * Sprint 157 (README frame 3): the Slide library place in the left column. A search; the topics, each a deck in the
 * `Slide library` folder, opening to their slides as thumbnails with titles; below, Other decks, every other deck in
 * the project, each opening the same way. A slide is clicked for "Insert after slide N", which the host copies into
 * the deck that is open (`library/insert`); the copy keeps a `from:` line when it came from a topic.
 *
 * Sprint 165 PR 3: the search lists each slide once, at its newest copy, library slides first, each with its place
 * and "also in N older decks"; a tick on a thumbnail says its copy is already in the open deck (the host works out
 * both, `librarySearch.ts`).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { onMessage, sendToExtension } from '../../../bridge'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { BUILT_IN_THEME, parseTheme, themePathOf, type DeckTheme } from '../../../../../src/decks/deckTheme'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { SlideCanvas } from '../slide/SlideCanvas'
import { AgendaContext, agendaEntriesFrom } from '../slide/agendaContext'
import type { AgendaDrawing } from '../../../../../src/decks/blocks/agenda'
import { alsoLine, deckExpanded, deckMeta, deckPlace, groupByFolder, hitMeta, hitsCount, placeLine, sectionIds, sectionsOf, takeSectionTip, type DeckSection } from './libraryGroups'
import { Button } from '../../ui/button'
import '../decks.css'

interface LibrarySlide {
  index: number
  id?: string
  kind: string
  data: SlideData
  handout: string
}

interface LibraryDeck {
  path: string
  name: string
  topic: boolean
  theme: string | null
  borderless: boolean
  modified: number
  slides: LibrarySlide[]
  /** The deck's sections, for an Agenda's tile (from all its slides; a search sends only some). */
  agenda?: unknown
}

/** Sprint 165 PR 3: one slide search shows, at its copy in `path`, with how many other decks have it. */
interface LibraryHit {
  path: string
  index: number
  also: number
  library: boolean
}

interface ActiveDeck {
  path: string
  name: string
  current: number
  count: number
}

interface LibraryState {
  enabled: boolean
  project: boolean
  decks: LibraryDeck[]
  /** Each deck's pictures as webview URIs, by the paths its slides name; the themes' text, by path. */
  assets: Record<string, Record<string, string>>
  themes: Record<string, string | null>
  active: ActiveDeck | null
  query: string
  /** The project folder's name: the heading of the decks at its top level (Sprint 165 PR 1). */
  projectName?: string
  /** Sprint 165 PR 3: the slides (`<path>#<index>`) whose copy is already in the open deck. */
  here?: string[]
  /** Sprint 165 PR 3: a search's slides in their order (the decks hold only them), and how many it found. */
  search?: { hits: LibraryHit[]; total: number }
}

const NO_ASSETS: Record<string, string> = {}

const TILE_WIDTH = 104

/** A slide's title as the tile shows it. */
function titleOf(slide: LibrarySlide): string {
  const title = typeof slide.data.title === 'string' ? slide.data.title.trim() : ''
  return title || 'Untitled slide'
}

/** "Insert after slide N" for the open deck, or why there is nowhere to insert. */
export function insertLabel(active: ActiveDeck | null): string | null {
  if (!active) return null
  if (active.count === 0) return 'Insert as slide 1'
  if (active.current < 0) return 'Insert before slide 1'
  return `Insert after slide ${Math.min(active.current, active.count - 1) + 1}`
}

/**
 * Sprint 165 PR 1 (the Experience lead): an other deck's row, on two lines. The name takes up to two lines before an
 * ellipsis, and only a name cut there gets its full text in a tooltip; under it, "18 Nov · 9 slides", muted.
 */
function DeckRow({ name, meta, expanded, onToggle }: { name: string; meta: string; expanded: boolean; onToggle: () => void }) {
  const nameRef = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState(false)
  useLayoutEffect(() => {
    const element = nameRef.current
    if (!element) return
    const measure = () => setCut(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [name])
  return (
    <Tooltip label={name} side="bottom" hoverOnly suppressed={!cut} className="flex w-full">
      <button type="button" className="deck-lib-row deck-lib-row-two" aria-expanded={expanded} aria-label={`${name}, ${meta}`} onClick={onToggle}>
        <Icon name={expanded ? 'caret-down' : 'caret-right'} size={12} tone="inherit" className="deck-lib-caret" />
        <Icon name="presentation" size={16} tone="inherit" />
        <span className="deck-lib-deck-text">
          <span ref={nameRef} className="deck-lib-deck-name">{name}</span>
          <span className="deck-lib-deck-meta">{meta}</span>
        </span>
      </button>
    </Tooltip>
  )
}

export function SlideLibraryPanel() {
  const [state, setState] = useState<LibraryState | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [openOthers, setOpenOthers] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  // The field shows once the place's Search is pressed (as Tasks' does), and stays while it holds words.
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusSearch, setFocusSearch] = useState(0)

  useEffect(() => {
    const stop = onMessage((message) => {
      if (message.type === 'library/state') setState(message as unknown as LibraryState)
      else if (message.type === 'library/active') setState((value) => (value ? { ...value, active: (message.active as ActiveDeck | null) ?? null } : value))
      else if (message.type === 'library/focus-search') {
        setSearchOpen(true)
        setFocusSearch((count) => count + 1)
      } else if (message.type === 'library/notice' && typeof message.text === 'string') setNotice(message.text)
      else if (message.type === 'library/show' && (message.section === 'topics' || message.section === 'other')) {
        const section = message.section
        setQuery('')
        sendToExtension('library/search', { query: '' })
        // Other decks open with their slides, so a slide is one click away.
        requestAnimationFrame(() => document.querySelector(section === 'other' ? '.deck-lib-group-other' : '.deck-lib-search, .deck-lib-row')?.scrollIntoView({ block: 'start' }))
        // Each open starts as asked: "From another deck…" opens the newest other deck, "From the library…" does not.
        setOpenOthers(section === 'other')
      } else if (message.type === 'library/reveal' && typeof message.path === 'string') {
        const path = message.path
        setQuery('')
        sendToExtension('library/search', { query: '' })
        setOpen((value) => ({ ...value, [path]: true }))
        setSelected(typeof message.id === 'string' ? `${path}#${message.id}` : null)
      }
    })
    sendToExtension('library/ready')
    return stop
  }, [])

  // The search goes to the host (it reads every deck), a moment after the typing stops; an emptied one at once, so the
  // decks come back without a wait.
  useEffect(() => {
    const timer = setTimeout(() => sendToExtension('library/search', { query }), query.trim() ? 150 : 0)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!focusSearch) return
    field.current?.focus()
    field.current?.select()
  }, [focusSearch])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  // A revealed slide scrolls into view once its topic has opened.
  useEffect(() => {
    if (!selected) return
    document.querySelector(`[data-library-slide="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected, state, open])

  const topics = useMemo(() => state?.decks.filter((deck) => deck.topic) ?? [], [state])
  // Sprint 165 PR 1: Other decks by the folder they are in, folders by their newest deck, decks newest first.
  const folders = useMemo(
    () => groupByFolder(state?.decks.filter((deck) => !deck.topic && deck.path !== state.active?.path) ?? [], state?.projectName ?? ''),
    [state],
  )
  const newestOther = folders[0]?.decks[0]?.path
  const here = useMemo(() => new Set(state?.here ?? []), [state])
  const deckOf = useMemo(() => new Map((state?.decks ?? []).map((deck) => [deck.path, deck])), [state])

  // Small details 14: each deck's Agenda list, as its tiles draw it (no hint: the editor's only), once per state.
  const agendaOfDeck = useMemo(() => {
    const drawings = new Map<string, AgendaDrawing>()
    for (const deck of state?.decks ?? []) drawings.set(deck.path, { entries: agendaEntriesFrom(deck.agenda), hint: false })
    return drawings
  }, [state])

  // Each theme read once per state.
  const themeOf = useMemo(() => {
    const parsed = new Map<string, DeckTheme>()
    return (named: string | null): DeckTheme => {
      // The host reads each deck's theme by `themePathOf` (Evening's path for none), falling back to Evening's file.
      const path = themePathOf(named)
      const text = state?.themes?.[path]
      if (!text) return BUILT_IN_THEME
      let theme = parsed.get(path)
      if (!theme) {
        theme = parseTheme(text)
        parsed.set(path, theme)
      }
      return theme
    }
  }, [state])

  if (!state) return null
  if (!state.enabled) return <p className="deck-lib-empty">Decks are turned off.</p>
  if (!state.project) return <p className="deck-lib-empty">Open a folder to keep a slide library.</p>

  const searching = query.trim().length > 0
  const label = insertLabel(state.active)

  /**
   * A slide's tile: its thumbnail, title and menu. In a search (Sprint 165 PR 3) also its place and "also in N older
   * decks"; anywhere, the tick when its copy is already in the open deck.
   */
  const tile = (deck: LibraryDeck, slide: LibrarySlide, options: { numbered: boolean; hit?: { place: string; where: string; meta: string; also: string | null } }) => {
    const key = `${deck.path}#${slide.id ?? slide.index}`
    const title = titleOf(slide)
    const number = options.numbered ? `${slide.index + 1}. ` : ''
    const inOpenDeck = here.has(`${deck.path}#${slide.index}`)
    const hit = options.hit
    const spoken = [hit?.place, hit?.also, inOpenDeck ? 'already in the open deck' : null].filter(Boolean).join(', ')
    const trigger = (
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`deck-lib-tile${selected === key ? ' sel' : ''}`}
              data-library-slide={key}
              aria-label={`${number}${title}${spoken ? `, ${spoken}` : ''}: insert into the open deck`}
            >
              <span className="deck-lib-thumb" aria-hidden>
                <SlideCanvas kind={slide.kind} data={slide.data} width={TILE_WIDTH} theme={themeOf(deck.theme)} borderless={deck.borderless} assets={state.assets?.[deck.path] ?? NO_ASSETS} />
                {inOpenDeck ? (
                  <span className="deck-lib-here">
                    <Icon name="check" size={12} tone="inherit" />
                  </span>
                ) : null}
              </span>
              <span className="deck-lib-title">{number}{title}</span>
              {/* "Folder › Deck" may wrap and be cut; under it the date and "also in N older decks" never are. */}
              {hit ? <span className="deck-lib-place">{hit.where}</span> : null}
              {hit?.meta ? <span className="deck-lib-also">{hit.meta}</span> : null}
            </button>
          </DropdownMenuTrigger>
    )
    return (
      <DropdownMenu key={key} onOpenChange={(isOpen) => setSelected(isOpen ? key : null)}>
        {/* The tick's tooltip, on the tiles that have one: hundreds of tiles mount no tooltip they never show. */}
        {inOpenDeck ? (
          <Tooltip label="Already in the open deck" side="bottom" hoverOnly className="flex min-w-0">
            {trigger}
          </Tooltip>
        ) : trigger}
        <DropdownMenuContent align="start" className="deck-lib-menu">
          <div className="deck-lib-menu-head">{title}</div>
          {hit ? <div className="deck-lib-menu-place">{[hit.place, hit.also].filter(Boolean).join(' · ')}</div> : null}
          {inOpenDeck ? (
            <div className="deck-lib-menu-here">
              <Icon name="check" size={12} tone="inherit" />
              Already in the open deck
            </div>
          ) : null}
          {label && slide.id ? (
            <DropdownMenuItem onSelect={() => sendToExtension('library/insert', { path: deck.path, id: slide.id })}>
              <Icon name="arrow-right" size={14} tone="inherit" />
              {label}
            </DropdownMenuItem>
          ) : (
            <div className="deck-lib-menu-note">{slide.id ? 'Open a deck to insert this slide into it.' : 'This slide has no id yet. Open its deck once to give it one.'}</div>
          )}
          <DropdownMenuItem onSelect={() => sendToExtension('library/open', { path: deck.path })}>
            <Icon name="arrow-square-out" size={14} tone="inherit" />
            Open {deck.topic ? 'the topic' : 'the deck'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const deckRows = (deck: LibraryDeck, numbered: boolean) => {
    // "From another deck…" opens the newest other deck; the others stay one click away.
    const expanded = deckExpanded(deck.path, { searching, open, openNewest: openOthers, newest: newestOther })
    const grid = (slides: LibrarySlide[]) => (
      <AgendaContext.Provider value={agendaOfDeck.get(deck.path) ?? null}>
        <div className="deck-lib-grid">{slides.map((slide) => tile(deck, slide, { numbered }))}</div>
      </AgendaContext.Provider>
    )
    // Sprint 165 PR 2: an open deck shows its sections, each with Take section; a search's hits stay one grid (a
    // section would be only the slides found).
    const sectioned = (shown: LibraryDeck) => {
      // The host's own query too: until it answers a cleared search, its decks hold only the hits.
      if (searching || state.query.trim()) return grid(shown.slides)
      const { before, sections } = sectionsOf(shown.slides)
      if (sections.length === 0) return grid(before)
      return (
        <>
          {before.length ? grid(before) : null}
          {sections.map((section) => sectionBlock(shown, section))}
        </>
      )
    }
    const sectionBlock = (shown: LibraryDeck, section: DeckSection<LibrarySlide>) => {
      const ids = sectionIds(section.slides)
      const ready = !!label && !!ids
      const tip = takeSectionTip(label, ids, section.slides.length)
      return (
        <div key={`${shown.path}#section-${section.slides[0].index}`} className="deck-lib-section">
          <div className="deck-lib-section-head">
            {section.number ? <span className="deck-lib-section-number">{section.number}</span> : null}
            <span className="deck-lib-section-title">{section.title}</span>
            {/* #861: shown only while the pointer is over the section or the heading holds the keyboard (CSS). */}
            <span className="deck-lib-take-slot">
              <Tooltip label={tip} side="bottom">
                {/* Not `disabled` when it can't be taken: it stays in the Tab order, so the keyboard shows it and its reason. */}
                <Button
                  variant="secondary"
                  size="compact"
                  className="deck-lib-take"
                  aria-disabled={!ready}
                  aria-label={`Take section ${section.title}`}
                  onClick={() => { if (ready) sendToExtension('library/insert-section', { path: shown.path, ids }) }}
                >
                  <Icon name="plus" size={12} tone="inherit" />
                  Take section
                </Button>
              </Tooltip>
            </span>
          </div>
          {grid(section.slides)}
        </div>
      )
    }
    return (
      <div key={deck.path}>
        {deck.topic ? (
        <button
          type="button"
          className="deck-lib-row"
          aria-expanded={expanded}
          onClick={() => setOpen((value) => ({ ...value, [deck.path]: !expanded }))}
        >
          <Icon name={expanded ? 'caret-down' : 'caret-right'} size={12} tone="inherit" className="deck-lib-caret" />
          <Icon name="presentation" size={16} tone="inherit" />
          <span className="deck-lib-name">{deck.name}</span>
          <span className="deck-lib-count">{deck.slides.length}</span>
        </button>
        ) : (
          <DeckRow
            name={deck.name}
            meta={deckMeta(deck.modified, deck.slides.length)}
            expanded={expanded}
            onToggle={() => setOpen((value) => ({ ...value, [deck.path]: !expanded }))}
          />
        )}
        {expanded ? (
          sectioned(deck)
        ) : null}
      </div>
    )
  }

  /**
   * Sprint 165 PR 3 (README "Search shows each slide once"): one grid of the slides found, each once, library slides
   * first, under "Best match first". Until the host has answered the first words, nothing shows (no flash of every deck).
   */
  const searchResults = () => {
    const search = state.search
    if (!search || !state.query.trim()) return null
    const shown = search.hits.flatMap((hit) => {
      const deck = deckOf.get(hit.path)
      const slide = deck?.slides.find((entry) => entry.index === hit.index)
      return deck && slide ? [{ hit, deck, slide }] : []
    })
    if (!shown.length) return <p className="deck-lib-none">No slide matches.</p>
    return (
      <>
        <div className="deck-lib-group deck-lib-group-hits">
          Best match first
          <span className="deck-lib-group-count">{hitsCount(shown.length, search.total)}</span>
        </div>
        <div className="deck-lib-grid">
          {shown.map(({ hit, deck, slide }) => (
            <AgendaContext.Provider key={`${deck.path}#${slide.index}`} value={agendaOfDeck.get(deck.path) ?? null}>
              {tile(deck, slide, {
                numbered: false,
                hit: {
                  place: placeLine(deck.path, deck.name, deck.modified, state.projectName ?? ''),
                  where: deckPlace(deck.path, deck.name, state.projectName ?? ''),
                  meta: hitMeta(deck.modified, hit.also, hit.library),
                  also: alsoLine(hit.also, hit.library),
                },
              })}
            </AgendaContext.Provider>
          ))}
        </div>
        {search.total > shown.length ? <p className="deck-lib-none">More words find fewer slides.</p> : null}
        <p className="deck-lib-hint">A slide that is in several decks shows once, at its newest. A tick says it's already in the open deck.</p>
      </>
    )
  }

  return (
    <div className="deck-lib font-ui">
      {searchOpen || query ? (
      <label className="deck-lib-search">
        <Icon name="magnifying-glass" size={14} tone="inherit" />
        <input
          ref={field}
          type="search"
          placeholder="Search the library"
          aria-label="Search the library by slide title and words"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            if (query) setQuery('')
            else setSearchOpen(false)
          }}
          onBlur={() => { if (!query) setSearchOpen(false) }}
        />
      </label>
      ) : null}
      {/* Just cleared: until the host answers, its decks hold only the hits, so nothing is drawn as the library. */}
      {searching ? searchResults() : state.search ? null : (
        <>
          <div className="deck-lib-group">Library</div>
          {topics.map((deck) => deckRows(deck, false))}
          {topics.length === 0 ? (
            <p className="deck-lib-none">No topics yet. Add a slide to the library from a deck's slide menu.</p>
          ) : null}
          {folders.length ? <div className="deck-lib-group deck-lib-group-other">Other decks</div> : null}
          {folders.map((group) => (
            <div key={group.folder || '.'} className="deck-lib-folder-group">
              <div className="deck-lib-folder">
                <Icon name="folder-simple" size={14} tone="inherit" />
                <span className="deck-lib-name">{group.name}</span>
              </div>
              {group.decks.map((deck) => deckRows(deck, true))}
            </div>
          ))}
          <p className="deck-lib-hint">Each topic is a deck in the Slide library folder. A slide you take is a copy: the library's slide stays as it is.</p>
        </>
      )}
      {notice ? <div className="deck-lib-notice" role="status">{notice}</div> : null}
    </div>
  )
}

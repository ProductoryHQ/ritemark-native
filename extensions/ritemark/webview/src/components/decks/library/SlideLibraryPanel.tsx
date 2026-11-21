/**
 * Sprint 157 (README frame 3): the Slide library place in the left column. A search; the topics, each a deck in the
 * `Slide library` folder, opening to their slides as thumbnails with titles; below, Other decks, every other deck in
 * the project, each opening the same way. A slide is clicked for "Insert after slide N", which the host copies into
 * the deck that is open (`library/insert`); the copy keeps a `from:` line when it came from a topic.
 *
 * Sprint 165 PR 3: the search lists each slide once, at its newest copy, library slides first, each with its place
 * and "also in N older decks"; a tick on a thumbnail says its copy is already in the open deck (the host works out
 * both, `librarySearch.ts`).
 *
 * Sprint 165 PR 4: at the library's top, the offer of the slides in most of the decks (`libraryOffer.ts`), with Add
 * all, Choose… (the slides ticked) and Not now. Only a press writes, and Add's notice has the Undo.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { onMessage, sendToExtension } from '../../../bridge'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { BUILT_IN_THEME, parseTheme, themePathOf, type DeckTheme } from '../../../../../src/decks/deckTheme'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import { SlideCanvas } from '../slide/SlideCanvas'
import { AgendaContext, agendaEntriesFrom } from '../slide/agendaContext'
import type { AgendaDrawing } from '../../../../../src/decks/blocks/agenda'
import {
  addAllLabel, addChosenLabel, alsoLine, deckExpanded, deckMeta, deckPlace, decksCount, groupByFolder, hitMeta, hitsCount, inDecksLine, offerHeadline, offerHint, placeLine,
  sectionIds, sectionsOf, takeSectionTip, type DeckSection,
} from './libraryGroups'
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

/** Sprint 165 PR 4: one slide the offer shows, at its newest copy (`libraryOffer.ts`'s `OfferedSlide`). */
interface OfferedSlide {
  path: string
  index: number
  id: string
  title: string
  families: number
  decks: number
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
  /**
   * Sprint 165 PR 3: a search's slides in their order (the decks hold only them), and how many it found; and (#877) the
   * decks whose folder or name has the words, whole, for the Decks group, and how many there are.
   */
  search?: { hits: LibraryHit[]; total: number; decks?: LibraryDeck[]; deckTotal?: number }
  /** Sprint 165 PR 4: the slides in most of the decks, offered at the library's top (none while searching). */
  offer?: OfferedSlide[]
}

/** The place's notice, with the Undo of the write it tells of (Sprint 165 PR 4, Add all and Choose…). */
interface Notice {
  text: string
  undo?: string
}

/** A notice stays this long; one with an Undo longer, so there is time to press it. */
const NOTICE_MS = 5000
const UNDO_NOTICE_MS = 10000
/** #887: a search pending longer than this says "Searching…". */
const SLOW_SEARCH_MS = 500
/** The words a search takes, at most (the host refuses more, `decodeLibraryRequest`). */
const MAX_SEARCH_CHARS = 200
const searchedWords = (query: string) => query.slice(0, MAX_SEARCH_CHARS)

/** An offered slide's key in Choose…'s ticks. */
const offerKey = (slide: { path: string; id: string }) => `${slide.path}#${slide.id}`

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

/** The tick's tooltip, only on a tile that has the tick: hundreds of tiles mount no tooltip they never show. */
function TickTip({ on, children }: { on: boolean; children: ReactElement }) {
  return on ? (
    <Tooltip label="Already in the open deck" side="bottom" hoverOnly className="flex min-w-0">
      {children}
    </Tooltip>
  ) : children
}

export function SlideLibraryPanel() {
  const [state, setState] = useState<LibraryState | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  // Sprint 165 PR 4: Choose…'s ticks (null when not choosing), and a press on the offer waiting for the host's answer.
  const [choosing, setChoosing] = useState<Set<string> | null>(null)
  const [offerBusy, setOfferBusy] = useState(false)
  const chooseButton = useRef<HTMLButtonElement>(null)
  const firstChoice = useRef<HTMLButtonElement>(null)
  const [openOthers, setOpenOthers] = useState(false)
  // #877: the Decks group's rows open on their own, apart from browsing's, and start closed at each search.
  const [openNamed, setOpenNamed] = useState<Record<string, boolean>>({})
  const field = useRef<HTMLInputElement>(null)
  // The field shows once the place's Search is pressed (as Tasks' does), and stays while it holds words.
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusSearch, setFocusSearch] = useState(0)
  // #887: the shell's Search row is the field (patch 018) and sends its words: the place draws no field of its own.
  const [shellField, setShellField] = useState(false)
  // #887: a search slower than about half a second says so where its results go.
  const [slow, setSlow] = useState(false)
  const [focusResults, setFocusResults] = useState(0)

  useEffect(() => {
    const stop = onMessage((message) => {
      if (message.type === 'library/state') setState(message as unknown as LibraryState)
      else if (message.type === 'library/active') setState((value) => (value ? { ...value, active: (message.active as ActiveDeck | null) ?? null } : value))
      else if (message.type === 'library/focus-search') {
        // The host asks for the page's own field (a shell without the row's field): it shows, whatever came before.
        setShellField(false)
        setSearchOpen(true)
        setFocusSearch((count) => count + 1)
      } else if (message.type === 'library/query' && typeof message.query === 'string') {
        setShellField(true)
        setQuery(message.query)
      } else if (message.type === 'library/focus-results') {
        // ↓ or Enter in the shell's field: the keyboard goes to the first result once the results are the words'.
        setFocusResults((count) => count + 1)
      } else if (message.type === 'library/notice' && typeof message.text === 'string') {
        setNotice({ text: message.text, ...(typeof message.undo === 'string' ? { undo: message.undo } : {}) })
        // The host's answer to an offer press, whatever it was (every press gets one): the buttons work again.
        setOfferBusy(false)
      }
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
    const timer = setTimeout(() => sendToExtension('library/search', { query: searchedWords(query) }), query.trim() ? 150 : 0)
    return () => clearTimeout(timer)
  }, [query])

  // #887 (the Experience lead): until the host has answered the words typed, the search is pending; after about half a
  // second of that, "Searching…" shows where the results go, and gives way to them.
  const pending = query.trim().length > 0 && state?.query !== searchedWords(query)
  useEffect(() => {
    if (!pending) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), SLOW_SEARCH_MS)
    return () => clearTimeout(timer)
  }, [pending, query])

  // ↓ or Enter in the shell's field, once the host has answered the words in it: never a result of older words.
  useEffect(() => {
    if (!focusResults || pending) return
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.deck-lib .deck-lib-row, .deck-lib [data-library-slide]')?.focus())
    setFocusResults(0)
  }, [focusResults, pending])

  // #887: ⌘F (Ctrl+F) in the place puts the caret in its search field: the host says where (the Search row's, or this one).
  useEffect(() => {
    const mac = /Mac/.test(navigator.platform)
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyF' || event.shiftKey || event.altKey || !(mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      sendToExtension('library/find')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // A new search's Decks group starts closed.
  useEffect(() => setOpenNamed({}), [state?.query])

  useEffect(() => {
    if (!focusSearch) return
    field.current?.focus()
    field.current?.select()
  }, [focusSearch])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), notice.undo ? UNDO_NOTICE_MS : NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // Choose… puts the keyboard on the first slide; Cancel gives it back to Choose….
  const isChoosing = choosing !== null
  useEffect(() => {
    if (isChoosing) firstChoice.current?.focus()
  }, [isChoosing])

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
  // Sprint 165 PR 4: the offered slides with their decks, to draw them as the library's tiles.
  const offered = useMemo(() => (state?.offer ?? []).flatMap((entry) => {
    const deck = deckOf.get(entry.path)
    const slide = deck?.slides.find((item) => item.index === entry.index && item.id === entry.id)
    return deck && slide ? [{ entry, deck, slide }] : []
  }), [state, deckOf])
  // An offer that went (all added, hidden, or the decks changed) ends Choose….
  useEffect(() => {
    if (!offered.length) setChoosing(null)
  }, [offered.length])

  // Small details 14: each deck's Agenda list, as its tiles draw it (no hint: the editor's only), once per state.
  const agendaOfDeck = useMemo(() => {
    const drawings = new Map<string, AgendaDrawing>()
    for (const deck of [...(state?.decks ?? []), ...(state?.search?.decks ?? [])]) drawings.set(deck.path, { entries: agendaEntriesFrom(deck.agenda), hint: false })
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
  const tile = (deck: LibraryDeck, slide: LibrarySlide, options: { numbered: boolean; named?: boolean; hit?: { place: string; where: string; meta: string[]; also: string | null }; note?: string }) => {
    // A Decks group's tile (#877) and an offered one (PR 4) are keyed apart: the same slide can be under its deck too.
    const key = `${options.named ? 'decks:' : options.note ? 'offer:' : ''}${deck.path}#${slide.id ?? slide.index}`
    const title = titleOf(slide)
    const number = options.numbered ? `${slide.index + 1}. ` : ''
    const inOpenDeck = here.has(`${deck.path}#${slide.index}`)
    const hit = options.hit
    const spoken = [hit?.place, hit?.also, options.note, inOpenDeck ? 'already in the open deck' : null].filter(Boolean).join(', ')
    return (
      <DropdownMenu key={key} onOpenChange={(isOpen) => setSelected(isOpen ? key : null)}>
        <TickTip on={inOpenDeck}>
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
              {/* "Folder › Deck" may wrap and be cut; under it the date and "also in N older decks", each a line of its own (#935), never are. */}
              {hit ? <span className="deck-lib-place">{hit.where}</span> : null}
              {hit?.meta.map((line, index) => <span key={index} className="deck-lib-also deck-lib-meta">{line}</span>)}
              {options.note ? <span className="deck-lib-also">{options.note}</span> : null}
            </button>
          </DropdownMenuTrigger>
        </TickTip>
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

  /**
   * A deck's row and, open, its slides. `named` (#877): a row of search's Decks group, which starts closed whatever the
   * search, is drawn on two lines for a topic too, and opens to the whole deck by section.
   */
  const deckRows = (deck: LibraryDeck, numbered: boolean, named = false) => {
    // "From another deck…" opens the newest other deck; the others stay one click away.
    const expanded = named ? openNamed[deck.path] === true : deckExpanded(deck.path, { searching, open, openNewest: openOthers, newest: newestOther })
    const toggle = () => (named ? setOpenNamed : setOpen)((value) => ({ ...value, [deck.path]: !expanded }))
    const grid = (slides: LibrarySlide[]) => (
      <AgendaContext.Provider value={agendaOfDeck.get(deck.path) ?? null}>
        <div className="deck-lib-grid">{slides.map((slide) => tile(deck, slide, { numbered, named }))}</div>
      </AgendaContext.Provider>
    )
    // Sprint 165 PR 2: an open deck shows its sections, each with Take section; a search's hits stay one grid (a
    // section would be only the slides found).
    const sectioned = (shown: LibraryDeck) => {
      // The host's own query too: until it answers a cleared search, its decks hold only the hits. A Decks group's
      // deck is whole.
      if (!named && (searching || state.query.trim())) return grid(shown.slides)
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
        {deck.topic && !named ? (
        <button
          type="button"
          className="deck-lib-row"
          aria-expanded={expanded}
          onClick={toggle}
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
            onToggle={toggle}
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
    const decks = search.decks ?? []
    if (!shown.length && !decks.length) return <p className="deck-lib-none">No slide matches.</p>
    return (
      <>
        {/* #877 (the Experience lead): decks whose folder or name has the words, closed, above the slides. */}
        {decks.length ? (
          <>
            <div className="deck-lib-group deck-lib-group-hits">
              Decks
              <span className="deck-lib-group-count">{decksCount(decks.length, search.deckTotal ?? decks.length)}</span>
            </div>
            {decks.map((deck) => deckRows(deck, true, true))}
          </>
        ) : null}
        {shown.length ? slideHits(shown, search.total) : <p className="deck-lib-none">No slide has these words.</p>}
      </>
    )
  }

  /** Search's slides, each once, under "Best match first". */
  const slideHits = (shown: Array<{ hit: LibraryHit; deck: LibraryDeck; slide: LibrarySlide }>, total: number) => {
    return (
      <>
        <div className="deck-lib-group deck-lib-group-hits">
          Best match first
          <span className="deck-lib-group-count">{hitsCount(shown.length, total)}</span>
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
        {total > shown.length ? <p className="deck-lib-none">More words find fewer slides.</p> : null}
      </>
    )
  }

  /**
   * Sprint 165 PR 4 (README "The library offers what he repeats"): the offer at the library's top. At rest its slides
   * are the library's tiles (a click inserts one, as anywhere); Choose… turns them into ticks, all ticked to start.
   * Nothing is added without a press, and a press waits for the host's answer (no second add from a double click).
   */
  const offerBlock = () => {
    if (!offered.length) return null
    const count = offered.length
    const keys = offered.map(({ entry }) => offerKey(entry))
    const ticked = choosing ? offered.filter(({ entry }) => choosing.has(offerKey(entry))) : []
    const send = (type: 'library/offer-add' | 'library/offer-not-now', list: typeof offered) => {
      if (offerBusy || !list.length) return
      setOfferBusy(true)
      setChoosing(null)
      sendToExtension(type, { slides: list.map(({ entry }) => ({ path: entry.path, id: entry.id })) })
    }
    const cancel = () => {
      setChoosing(null)
      requestAnimationFrame(() => chooseButton.current?.focus())
    }
    const toggle = (key: string) => setChoosing((value) => {
      const next = new Set(value ?? [])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    return (
      <section
        className="deck-lib-offer"
        aria-label="Slides in most of your decks"
        aria-busy={offerBusy || undefined}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !choosing) return
          event.preventDefault()
          cancel()
        }}
      >
        <p className="deck-lib-offer-text">
          <b>{offerHeadline(count)}</b> {choosing ? 'Tick the ones to add to Every training.' : offerHint(count)}
        </p>
        <div className="deck-lib-grid deck-lib-offer-grid">
          {offered.map(({ entry, deck, slide }, at) => {
            const note = inDecksLine(entry.decks)
            if (!choosing) {
              return (
                <AgendaContext.Provider key={`offer:${offerKey(entry)}`} value={agendaOfDeck.get(deck.path) ?? null}>
                  {tile(deck, slide, { numbered: false, note })}
                </AgendaContext.Provider>
              )
            }
            const key = offerKey(entry)
            const on = choosing.has(key)
            return (
              <AgendaContext.Provider key={`choose:${key}`} value={agendaOfDeck.get(deck.path) ?? null}>
                <Tooltip label={on ? 'Leave this slide out' : 'Add this slide too'} side="bottom" hoverOnly className="flex min-w-0">
                  <button
                    ref={at === 0 ? firstChoice : undefined}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`deck-lib-tile deck-lib-choice${on ? ' on' : ''}`}
                    aria-label={`${titleOf(slide)}, ${note}`}
                    onClick={() => toggle(key)}
                  >
                    <span className="deck-lib-thumb" aria-hidden>
                      <SlideCanvas kind={slide.kind} data={slide.data} width={TILE_WIDTH} theme={themeOf(deck.theme)} borderless={deck.borderless} assets={state.assets?.[deck.path] ?? NO_ASSETS} />
                      <span className="deck-lib-tickbox">{on ? <Icon name="check" size={12} tone="inherit" /> : null}</span>
                    </span>
                    <span className="deck-lib-title">{titleOf(slide)}</span>
                    <span className="deck-lib-also">{note}</span>
                  </button>
                </Tooltip>
              </AgendaContext.Provider>
            )
          })}
        </div>
        <div className="deck-lib-offer-actions">
          {choosing ? (
            <>
              <Tooltip label={ticked.length ? `Copy the ${ticked.length === 1 ? 'ticked slide' : `${ticked.length} ticked slides`} into the library's topic Every training` : 'Tick at least one slide to add it'}>
                <Button size="compact" className="deck-lib-offer-button" aria-disabled={!ticked.length || offerBusy} onClick={() => send('library/offer-add', ticked)}>
                  {addChosenLabel(ticked.length)}
                </Button>
              </Tooltip>
              <Tooltip label="Back to the offer, nothing added">
                <Button variant="outline" size="compact" className="deck-lib-offer-button" onClick={cancel}>Cancel</Button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip label={`Copy ${count === 1 ? 'this slide' : `these ${count} slides`} into the library's topic Every training`}>
                <Button size="compact" className="deck-lib-offer-button" aria-disabled={offerBusy} onClick={() => send('library/offer-add', offered)}>{addAllLabel(count)}</Button>
              </Tooltip>
              <Tooltip label="Pick which of these slides to add">
                <Button ref={chooseButton} variant="outline" size="compact" className="deck-lib-offer-button" aria-disabled={offerBusy} onClick={() => { if (!offerBusy) setChoosing(new Set(keys)) }}>Choose…</Button>
              </Tooltip>
              <Tooltip label={count === 1 ? 'Hide this slide: it won’t be offered again' : 'Hide these slides: they won’t be offered again'}>
                <Button variant="outline" size="compact" className="deck-lib-offer-button" aria-disabled={offerBusy} onClick={() => send('library/offer-not-now', offered)}>Not now</Button>
              </Tooltip>
            </>
          )}
        </div>
      </section>
    )
  }

  return (
    <div className="deck-lib font-ui">
      {!shellField && (searchOpen || query) ? (
      <label className="deck-lib-search">
        <Icon name="magnifying-glass" size={14} tone="inherit" />
        <input
          ref={field}
          type="search"
          maxLength={MAX_SEARCH_CHARS}
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
      {searching ? (pending && slow ? <p className="deck-lib-none" role="status">Searching…</p> : searchResults()) : state.search ? null : (
        <>
          <div className="deck-lib-group">Library</div>
          {offerBlock()}
          {topics.map((deck) => deckRows(deck, false))}
          {topics.length === 0 && !offered.length ? (
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
      {notice ? (
        <div className="deck-lib-notice" role="status">
          <span className="deck-lib-notice-text">{notice.text}</span>
          {notice.undo ? (
            <Tooltip label="Take these slides out of the library again">
              <Button
                variant="link"
                size="compact"
                className="deck-lib-notice-undo"
                onClick={() => {
                  sendToExtension('library/undo', { token: notice.undo })
                  setNotice(null)
                }}
              >
                Undo
              </Button>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Sprint 157 (README frame 3): the Slide library place in the left column. A search; the topics, each a deck in the
 * `Slide library` folder, opening to their slides as thumbnails with titles; below, Other decks, every other deck in
 * the project, each opening the same way. A slide is clicked for "Insert after slide N", which the host copies into
 * the deck that is open (`library/insert`); the copy keeps a `from:` line when it came from a topic.
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
import { deckExpanded, deckMeta, groupByFolder, sectionsOf, type DeckSection } from './libraryGroups'
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

  // The search goes to the host (it reads every deck), a moment after the typing stops.
  useEffect(() => {
    const timer = setTimeout(() => sendToExtension('library/search', { query }), 150)
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

  const deckRows = (deck: LibraryDeck, numbered: boolean) => {
    // "From another deck…" opens the newest other deck; the others stay one click away.
    const expanded = deckExpanded(deck.path, { searching, open, openNewest: openOthers, newest: newestOther })
    const tile = (slide: LibrarySlide) => {
              const key = `${deck.path}#${slide.id ?? slide.index}`
              const title = titleOf(slide)
              return (
                <DropdownMenu key={key} onOpenChange={(isOpen) => setSelected(isOpen ? key : null)}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`deck-lib-tile${selected === key ? ' sel' : ''}`}
                      data-library-slide={key}
                      aria-label={`${numbered ? `${slide.index + 1}. ` : ''}${title}: insert into the open deck`}
                    >
                      <span className="deck-lib-thumb" aria-hidden>
                        <SlideCanvas kind={slide.kind} data={slide.data} width={TILE_WIDTH} theme={themeOf(deck.theme)} borderless={deck.borderless} assets={state.assets?.[deck.path] ?? NO_ASSETS} />
                      </span>
                      <span className="deck-lib-title">{numbered ? `${slide.index + 1}. ` : ''}{title}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="deck-lib-menu">
                    <div className="deck-lib-menu-head">{title}</div>
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
    const grid = (slides: LibrarySlide[]) => <div className="deck-lib-grid">{slides.map(tile)}</div>
    // Sprint 165 PR 2: an open deck shows its sections, each with Take section; a search's hits stay one grid (a
    // section would be only the slides found).
    const sectioned = (shown: LibraryDeck) => {
      if (searching) return grid(shown.slides)
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
      const ids = section.slides.map((slide) => slide.id).filter((id): id is string => !!id)
      const ready = !!label && ids.length === section.slides.length
      const count = section.slides.length === 1 ? '1 slide' : `${section.slides.length} slides`
      const tip = !label
        ? 'Open a deck to insert this section into it.'
        : ready
          ? `${label.replace(/^Insert/, 'Insert all')}: ${count}, with their handout and prompts`
          : 'A slide here has no id yet. Open its deck once to give it one.'
      return (
        <div key={`${shown.path}#section-${section.slides[0].index}`} className="deck-lib-section">
          <div className="deck-lib-section-head">
            {section.number ? <span className="deck-lib-section-number">{section.number}</span> : null}
            <span className="deck-lib-section-title">{section.title}</span>
            <Tooltip label={tip} side="bottom">
              <Button
                variant="secondary"
                size="compact"
                className="deck-lib-take"
                disabled={!ready}
                aria-label={`Take section ${section.title}`}
                onClick={() => sendToExtension('library/insert-section', { path: shown.path, ids })}
              >
                <Icon name="plus" size={12} tone="inherit" />
                Take section
              </Button>
            </Tooltip>
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
          <AgendaContext.Provider value={agendaOfDeck.get(deck.path) ?? null}>
          {sectioned(deck)}
          </AgendaContext.Provider>
        ) : null}
      </div>
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
      {topics.length || !searching ? <div className="deck-lib-group">Library</div> : null}
      {topics.map((deck) => deckRows(deck, false))}
      {topics.length === 0 && !searching ? (
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
      {searching && topics.length === 0 && folders.length === 0 ? <p className="deck-lib-none">No slide matches.</p> : null}
      <p className="deck-lib-hint">Each topic is a deck in the Slide library folder. A slide you take is a copy: the library's slide stays as it is.</p>
      {notice ? <div className="deck-lib-notice" role="status">{notice}</div> : null}
    </div>
  )
}

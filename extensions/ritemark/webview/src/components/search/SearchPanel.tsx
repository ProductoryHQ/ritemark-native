/**
 * Search's results (Sprint 148, PR 2; R6, R8): the left column under the box
 * once it holds words (experience 8, frames 1 and 5; the Experience lead's
 * answers of 1 November).
 *
 * The count line holds the states and More; More holds Match capital letters,
 * Whole words only and the kinds with their counts, not Replace (decision 2).
 * Documents, Chats and Tasks follow, 5 rows each, then Show all. The top row
 * is chosen and shows Enter; ↓ and ↑ move through the rows and the Show rows
 * alike, ↑ on the first and Esc go back to the box. Nothing found, still
 * reading, past the limits and not available are lines, never a spinner.
 *
 * The box itself is the shell's (patch 018, PR 3).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { SEARCH_KINDS, type SearchHostToViewMessage, type SearchKind, type SearchOptions, type SearchResult } from '../../../../src/search/protocol'
import { ConversationBubbleIcon } from '../ai-sidebar/ConversationBubbleIcon'
import { Button } from '../ui/button'
import { Icon, type PhosphorIconName } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { sendSearch } from './searchClient'
import {
  INITIAL_STATE,
  KIND_WORDS,
  UNAVAILABLE_LINES,
  countLine,
  csvSnippet,
  detailOf,
  repeatsName,
  groupsOf,
  limitedLine,
  nothingLines,
  readingOf,
  reduceSearchView,
  rowLabel,
  rowTip,
  speakerWords,
  tooBigWords,
  visibleTotal,
  widened,
  type MarkedText,
  type SearchViewState,
} from './searchModel'
import './search.css'

/** A kind opened whole draws this many rows at a time, more as the list scrolls (question 5). */
const ROWS_AT_A_TIME = 60

const FORMAT_ICONS: Record<string, PhosphorIconName> = { markdown: 'file-text', docx: 'file-doc', pdf: 'file-pdf', csv: 'table' }

function Marked({ text, marks }: MarkedText) {
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of [...marks].sort((a, b) => a[0] - b[0])) {
    if (start < at || end <= start) continue
    if (start > at) parts.push(text.slice(at, start))
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>)
    at = end
  }
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}

function KindIcon({ result }: { result: SearchResult }) {
  if (result.kind === 'chat') return <ConversationBubbleIcon identityColorSlot={result.colorSlot ?? 0} size={14} />
  const name: PhosphorIconName = result.kind === 'task' ? 'check-square' : FORMAT_ICONS[result.format ?? 'markdown'] ?? 'file-text'
  return <Icon name={name} size={14} tone="inherit" />
}

function Snippet({ result }: { result: SearchResult }) {
  const passage = result.passage
  // A heading that only repeats the name says nothing more: the row shows the name alone, as for a hit in the name
  if (passage && repeatsName(result)) return null
  if (passage) {
    const csv = csvSnippet(result)
    if (csv) {
      return (
        <span className="rs-snippet">
          <span className="rs-ink"><Marked {...csv.first} /></span>
          {csv.cell && <>{' · '}{csv.column ? `${csv.column}: ` : ''}<Marked {...csv.cell} /></>}
        </span>
      )
    }
    return (
      <span className="rs-snippet">
        {result.kind === 'chat' ? `${speakerWords(passage.at.speaker)}: ` : ''}
        <Marked text={passage.text} marks={passage.marks} />
      </span>
    )
  }
  if (result.nameOnly === 'too-large') return <span className="rs-snippet">{tooBigWords(result.size)}</span>
  return null
}

function ResultRow({ result, item, chosen, now, roots }: { result: SearchResult; item: number; chosen: boolean; now: number; roots: string[] }) {
  const detail = detailOf(result, now)
  return (
    <Tooltip label={rowTip(result, roots)} side="bottom" className="block">
      <Button
        variant="ghost"
        className="rs-row"
        data-rs-item={item}
        data-chosen={chosen ? '' : undefined}
        aria-label={rowLabel(result, detail)}
        onClick={() => sendSearch({ type: 'search/open', key: result.key })}
      >
        <span className="rs-line">
          <span className="rs-icon" aria-hidden="true"><KindIcon result={result} /></span>
          <span className="rs-name">{result.name || 'Untitled'}</span>
          {detail && <span className="rs-detail">{detail}</span>}
          {chosen && <kbd className="rs-key">Enter</kbd>}
        </span>
        <Snippet result={result} />
      </Button>
    </Tooltip>
  )
}

function Option({ id, label, checked, count, onChange }: { id: string; label: string; checked: boolean; count?: number; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor={id} className="rs-opt">
      <input id={id} type="checkbox" className="rm-check" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
      {count !== undefined && <span className="rs-opt-count">{count.toLocaleString('en-US')}</span>}
    </label>
  )
}

/** The view drawn from its state; the panel below feeds it. Rendered alone by the tests. */
export function SearchPanelView({
  state,
  now,
  initialMoreOpen = false,
  onOptions,
}: {
  state: SearchViewState
  now: number
  initialMoreOpen?: boolean
  onOptions: (options: SearchOptions) => void
}) {
  const [moreOpen, setMoreOpen] = useState(initialMoreOpen)
  const [focused, setFocused] = useState<number | null>(null)
  const [drawn, setDrawn] = useState(ROWS_AT_A_TIME)
  const column = useRef<HTMLElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const { answer, status, options, setup } = state
  const projectName = setup?.projectName ?? ''
  const roots = setup?.roots ?? []
  const expandedKind = answer?.expanded?.kind ?? null

  // A kind opened whole starts at its first rows again
  useEffect(() => setDrawn(ROWS_AT_A_TIME), [expandedKind])

  // ... and draws more as the list scrolls (question 5)
  useEffect(() => {
    const target = sentinel.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setDrawn((count) => count + ROWS_AT_A_TIME)
    })
    observer.observe(target)
    return () => observer.disconnect()
  })

  const items = () => Array.from(column.current?.querySelectorAll<HTMLElement>('[data-rs-item]') ?? [])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      sendSearch({ type: 'search/back-to-box' })
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      list[index < 0 ? 0 : Math.min(list.length - 1, index + 1)]?.focus()
    } else if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault()
      if (index === 0) sendSearch({ type: 'search/back-to-box' })
      else list[index - 1]?.focus()
    }
  }

  const setOption = (change: Partial<SearchOptions>) => onOptions({ ...options, ...change })
  const setKind = (kind: SearchKind, on: boolean) =>
    setOption({ kinds: SEARCH_KINDS.filter((candidate) => (candidate === kind ? on : options.kinds.includes(candidate))) })

  const unavailable = status?.state === 'unavailable' || answer?.unavailable === true
  const body = (() => {
    if (unavailable) {
      return (
        <div className="rs-nothing" role="status">
          <p className="rs-nothing-first">{UNAVAILABLE_LINES.first}</p>
          <p className="rs-nothing-line">{UNAVAILABLE_LINES.second}</p>
        </div>
      )
    }
    // Fewer than two characters: nothing shows yet, and no line says nothing was found (R5)
    if (!answer || answer.tooShort) return null
    const reading = readingOf(state)
    const groups = groupsOf(answer, options)
    const total = visibleTotal(answer, options)
    const counts = Object.fromEntries(SEARCH_KINDS.map((kind) => [kind, answer.groups.find((group) => group.kind === kind)?.total ?? 0])) as Record<SearchKind, number>
    const countRow = (
      <div className="rs-count" role="status">
        <span className="rs-count-words">{countLine(total, reading, options)}</span>
        <Tooltip label={moreOpen ? 'Hide the options' : 'Match capital letters, whole words only, and which kinds to search'} side="bottom" className="rs-more-tip">
          <Button variant="ghost" size="sm" className="rs-more" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
            {moreOpen ? 'Less' : 'More'}
          </Button>
        </Tooltip>
      </div>
    )
    const optionsList = moreOpen && (
      <div className="rs-options" role="group" aria-label="Search options">
        <Option id="rs-match-case" label="Match capital letters" checked={options.matchCase} onChange={(on) => setOption({ matchCase: on })} />
        <Option id="rs-whole-words" label="Whole words only" checked={options.wholeWords} onChange={(on) => setOption({ wholeWords: on })} />
        {SEARCH_KINDS.map((kind) => (
          <Option key={kind} id={`rs-kind-${kind}`} label={KIND_WORDS[kind].heading} checked={options.kinds.includes(kind)} count={counts[kind]} onChange={(on) => setKind(kind, on)} />
        ))}
      </div>
    )

    if (total === 0) {
      const lines = nothingLines(projectName, reading, options, status?.tooLarge ?? 0)
      return (
        <>
          {moreOpen && countRow}
          {optionsList}
          <div className="rs-nothing" role="status">
            <p className="rs-nothing-first">{lines.first}</p>
            {lines.narrowing && (
              <p className="rs-nothing-line">
                {lines.narrowing.words}
                <Tooltip label="Search again with every option off and every kind on" side="bottom">
                  <Button variant="outline" size="sm" className="rs-turn-off" onClick={() => onOptions(widened())}>{lines.narrowing.button}</Button>
                </Tooltip>
              </p>
            )}
            {lines.hint && <p className="rs-nothing-line">{lines.hint}</p>}
            {lines.tooLarge && <p className="rs-nothing-line">{lines.tooLarge}</p>}
          </div>
        </>
      )
    }

    const limited = limitedLine(projectName, status, answer.limited || status?.limited === true)
    let item = 0
    const firstResult = focused === null ? 0 : -1
    return (
      <>
        {countRow}
        {optionsList}
        {limited && <p className="rs-limited">{limited}</p>}
        {groups.map((group) => {
          const whole = expandedKind === group.kind
          const rows = whole ? group.rows.slice(0, drawn) : group.rows
          return (
            <section key={group.kind} className="rs-group" aria-label={KIND_WORDS[group.kind].heading}>
              <h2 className="rs-heading">{group.heading}<span className="rs-heading-count">{group.total.toLocaleString('en-US')}</span></h2>
              {rows.map((result) => {
                const index = item++
                const chosen = focused === null ? index === firstResult : focused === index
                return <ResultRow key={result.key} result={result} item={index} chosen={chosen} now={now} roots={roots} />
              })}
              {whole && rows.length < group.rows.length && <div ref={sentinel} aria-hidden="true" />}
              {group.show && (() => {
                const index = item++
                const show = group.show
                return (
                  <Tooltip label={show.kind === 'all' ? `List every ${KIND_WORDS[group.kind].one} with these words here` : `Back to the first rows of each kind`} side="bottom" className="block">
                    <Button
                      variant="ghost"
                      className="rs-show"
                      data-rs-item={index}
                      data-chosen={focused === index ? '' : undefined}
                      onClick={() => sendSearch(show.kind === 'all' ? { type: 'search/more', kind: group.kind } : { type: 'search/fewer' })}
                    >
                      {show.words}
                    </Button>
                  </Tooltip>
                )
              })()}
            </section>
          )
        })}
      </>
    )
  })()

  return (
    <main
      ref={column}
      className="rs-column"
      aria-label="Search results"
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        const value = (event.target as HTMLElement).getAttribute('data-rs-item')
        setFocused(value === null ? null : Number(value))
      }}
      onBlur={(event) => {
        if (!column.current?.contains(event.relatedTarget as Node | null)) setFocused(null)
      }}
    >
      {body}
    </main>
  )
}

type PanelAction = SearchHostToViewMessage | { type: 'local/options'; options: SearchOptions }

function reduce(state: SearchViewState, action: PanelAction): SearchViewState {
  if (action.type === 'local/options') return { ...state, options: action.options }
  return reduceSearchView(state, action)
}

export function SearchPanel() {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent<SearchHostToViewMessage>) => {
      const message = event.data
      if (!message || typeof message !== 'object' || typeof message.type !== 'string' || !message.type.startsWith('search/')) return
      if (message.type === 'search/focus-first') {
        // ↓ in the box (R8): the keyboard to the first row, once it is drawn
        requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-rs-item]')?.focus())
        return
      }
      dispatch(message)
    }
    window.addEventListener('message', onMessage)
    sendSearch({ type: 'search/ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // M2: tell the host once this answer is on screen (a frame, then the paint)
  const queryId = state.answer?.queryId
  useEffect(() => {
    if (queryId === undefined) return
    const frame = requestAnimationFrame(() => setTimeout(() => sendSearch({ type: 'search/painted', queryId }), 0))
    return () => cancelAnimationFrame(frame)
  }, [queryId])

  const onOptions = useCallback((options: SearchOptions) => {
    dispatch({ type: 'local/options', options })
    sendSearch({ type: 'search/options', ...options })
  }, [])

  const now = useMemo(() => Date.now(), [state.answer])
  return (
    <div ref={root}>
      <SearchPanelView state={state} now={now} onOptions={onOptions} />
    </div>
  )
}

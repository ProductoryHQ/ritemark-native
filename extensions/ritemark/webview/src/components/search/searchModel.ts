/**
 * Sprint 148, PR 2 (R5, R6, R8): the results view's state and words, pure, so
 * render tests and the panel share them.
 *
 * The words are the Experience lead's (ritemark-dev
 * `releases/v2.2.0/analysis/2026-11-01-sprint-148-experience-answers.md`):
 * the count line holds the states (question 2), the nothing-found lines
 * (question 1), one row per kind (question 4), 5 rows then Show all
 * (question 5), and the chosen row with Enter (question 6).
 */
import {
  DEFAULT_SEARCH_LIMITS,
  DEFAULT_SEARCH_OPTIONS,
  SEARCH_KINDS,
  WHOLE_KIND_LIMIT,
  type IndexStatus,
  type SearchHostToViewMessage,
  type SearchKind,
  type SearchOptions,
  type SearchResult,
  type SearchViewSetup,
} from '../../../../src/search/protocol'

export type ResultsMessage = Extract<SearchHostToViewMessage, { type: 'search/results' }>

/** Rows per kind before Show all (question 5); the host's PER_KIND. */
export const ROWS_PER_KIND = 5

export interface SearchViewState {
  setup: SearchViewSetup | null
  answer: ResultsMessage | null
  status: IndexStatus | null
  options: SearchOptions
}

export const INITIAL_STATE: SearchViewState = {
  setup: null,
  answer: null,
  status: null,
  options: { ...DEFAULT_SEARCH_OPTIONS, kinds: [...DEFAULT_SEARCH_OPTIONS.kinds] },
}

/** A host message applied; an answer older than the one shown is dropped (R5, R10). */
export function reduceSearchView(state: SearchViewState, message: SearchHostToViewMessage): SearchViewState {
  switch (message.type) {
    case 'search/setup':
      return { ...state, setup: message.setup, options: message.setup.options }
    case 'search/results':
      if (state.answer && message.queryId <= state.answer.queryId) return state
      return { ...state, answer: message }
    case 'search/status':
      return { ...state, status: message.status }
    default:
      return state
  }
}

export const KIND_WORDS: Record<SearchKind, { heading: string; one: string; many: string; label: string }> = {
  document: { heading: 'Documents', one: 'document', many: 'documents', label: 'Document' },
  chat: { heading: 'Chats', one: 'chat', many: 'chats', label: 'Chat' },
  task: { heading: 'Tasks', one: 'task', many: 'tasks', label: 'Task' },
}

const number = (value: number) => value.toLocaleString('en-US')
const results = (n: number) => `${number(n)} ${n === 1 ? 'result' : 'results'}`

export interface GroupView {
  kind: SearchKind
  heading: string
  total: number
  rows: SearchResult[]
  /** The row under the group: Show all, Show fewer, or none; with its tooltip. */
  show: { kind: 'all'; words: string; tip: string } | { kind: 'fewer'; words: string; tip: string } | null
  /** A kind shown whole past WHOLE_KIND_LIMIT: the muted line at its end, not a row (the Experience lead, #636). */
  rest: string | null
}

/** The groups as drawn: the kinds More leaves on, 5 rows each, a kind opened whole with Show fewer at its end. */
export function groupsOf(answer: ResultsMessage, options: SearchOptions): GroupView[] {
  return answer.groups
    .filter((group) => options.kinds.includes(group.kind) && group.total > 0)
    .map((group) => {
      const whole = answer.expanded?.kind === group.kind
      const rows = whole ? group.results : group.results.slice(0, ROWS_PER_KIND)
      const words = KIND_WORDS[group.kind]
      const kindWords = group.total === 1 ? words.one : words.many
      // "Show all 1,240 documents" would promise more than a kind shown whole holds: past the limit, "Show 500 of 1,240"
      const capped = group.total > WHOLE_KIND_LIMIT
      const show: GroupView['show'] = whole
        ? answer.expanded?.auto ? null : { kind: 'fewer', words: 'Show fewer', tip: `Back to the first ${ROWS_PER_KIND} of each kind` }
        : group.total > rows.length
          ? capped
            ? { kind: 'all', words: `Show ${number(WHOLE_KIND_LIMIT)} of ${number(group.total)} ${kindWords}`, tip: `List the first ${number(WHOLE_KIND_LIMIT)} here` }
            : { kind: 'all', words: `Show all ${number(group.total)} ${kindWords}`, tip: `List every ${words.one} with these words here` }
          : null
      const more = whole ? group.total - group.results.length : 0
      const rest = more > 0 ? `${number(more)} more ${more === 1 ? 'has' : 'have'} these words. Add a word to narrow the list.` : null
      return { kind: group.kind, heading: words.heading, total: group.total, rows, show, rest }
    })
}

export function visibleTotal(answer: ResultsMessage, options: SearchOptions): number {
  return groupsOf(answer, options).reduce((sum, group) => sum + group.total, 0)
}

/** How far the index has read, from the freshest of the status and the answer; null once it has read everything. */
export function readingOf(state: Pick<SearchViewState, 'answer' | 'status'>): { done: number; total: number } | null {
  if (state.status?.state === 'reading' || state.status?.state === 'starting') return state.status.documents
  if (state.status?.state === 'ready') return null
  return state.answer?.reading ?? null
}

/** The count line (question 2): "3 results so far · 120 of 900 documents read", then "3 results with these words". */
export function countLine(total: number, reading: { done: number; total: number } | null, options: SearchOptions): string {
  if (reading) return `${results(total)} so far · ${number(reading.done)} of ${number(reading.total)} documents read`
  // One kind on in More: "2 results in documents" (frame 5)
  if (options.kinds.length === 1) return `${results(total)} in ${KIND_WORDS[options.kinds[0]].many}`
  return `${results(total)} with these words`
}

/** The Experience lead's example, the same every time, never built from the person's words (question 1). */
export const WORD_START_HINT = 'Words are found from their start, so a shorter start finds more forms: “hinna” finds “hinnakiri” and “hinnapakkumine”.'

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** What narrows the search, if anything: More's two options, and the kinds turned off (question 1). */
export function narrowingOf(options: SearchOptions): { words: string; button: string } | null {
  const on = [options.matchCase ? 'Match capital letters' : null, options.wholeWords ? 'Whole words only' : null].filter((item): item is string => item !== null)
  const off = SEARCH_KINDS.filter((kind) => !options.kinds.includes(kind)).map((kind) => KIND_WORDS[kind].heading)
  if (on.length === 0 && off.length === 0) return null
  const onWords = on.length ? `${listWords(on)} ${on.length === 1 ? 'is' : 'are'} on` : ''
  // The kinds' names are plural ("Chats are off"), however many are off
  const offWords = off.length ? `${listWords(off)} are off` : ''
  const words = on.length && off.length ? `${onWords}, and ${offWords}.` : `${onWords || offWords}.`
  // Both at once: the button does both, and "Turn off" wouldn't say it turns the kinds back on (the Experience lead, #636)
  return { words, button: on.length && off.length ? 'Search everything' : on.length ? 'Turn off' : 'Turn on' }
}

/** The nothing-found button's tooltip, whichever its words (the Experience lead, #636). */
export const WIDEN_TIP = 'Search again in documents, chats and tasks, with no options on'

/** Every option back to its default: what the nothing-found line's button does. */
export function widened(): SearchOptions {
  return { matchCase: false, wholeWords: false, kinds: [...SEARCH_KINDS] }
}

export interface NothingLines {
  first: string
  narrowing: { words: string; button: string } | null
  hint: string | null
  tooLarge: string | null
}

/** Nothing found (question 1): the first line, then the narrowing option or the word-start hint, then the big files. */
export function nothingLines(projectName: string, reading: { done: number; total: number } | null, options: SearchOptions, tooLarge: number): NothingLines {
  const first = reading
    ? `Nothing yet. Still reading ${number(reading.done)} of ${number(reading.total)} documents.`
    : `Nothing in ${projectName || 'this project'} has these words.`
  const narrowing = narrowingOf(options)
  return {
    first,
    narrowing,
    hint: narrowing || reading ? null : WORD_START_HINT,
    tooLarge: reading || tooLarge <= 0
      ? null
      : tooLarge === 1
        ? '1 file too big to read was searched by its name only.'
        : `${number(tooLarge)} files too big to read were searched by their names only.`,
  }
}

/** Past the documents limit (question 2): a muted line under the count while results show. */
export function limitedLine(projectName: string, status: IndexStatus | null, limited: boolean): string | null {
  if (!limited) return null
  const name = projectName || 'This project'
  const max = number(DEFAULT_SEARCH_LIMITS.maxDocuments)
  if (status && status.documents.total > DEFAULT_SEARCH_LIMITS.maxDocuments) {
    return `${name} has more than ${max} documents. The ${max} newest are searched inside, the rest by their names.`
  }
  // Past the text kept for search (R1's budget) rather than the documents limit: the same rule in the same words
  return `${name} has more text than search can keep. The newest documents are searched inside, the rest by their names.`
}

/** The index stopped twice (R4): what happened, then the way that still works, by its name on screen (the Experience lead, #636). */
export const UNAVAILABLE_LINES = {
  first: 'Search couldn’t read this project.',
  second: 'More ▸ Search still finds words in your documents.',
}

/**
 * A chat's age at the right of its row (question 4): today its time in the clock's short format ("14:32"), as Mail
 * lists today's messages, then "Tue", "3 Oct", "3 Oct 2025".
 */
export function ageWords(iso: string | null, now: number): string | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const today = new Date(now)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (then.getTime() >= startOfToday) return then.toLocaleTimeString(undefined, { timeStyle: 'short' })
  if (then.getTime() >= startOfToday - 6 * 24 * 60 * 60 * 1000) return then.toLocaleDateString('en-GB', { weekday: 'short' })
  if (then.getFullYear() === today.getFullYear()) return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The muted detail at the right of a row (question 4): a document's folder, a chat's age, a task's state. */
export function detailOf(result: SearchResult, now: number): string | null {
  if (result.kind === 'chat') return ageWords(result.changedAt, now)
  return result.where
}

/** Who said a chat's message, as the AI's sheet names them. */
export function speakerWords(speaker: string | undefined): string {
  switch (speaker) {
    case 'you':
      return 'You'
    case 'claude-code':
      return 'Claude'
    case 'codex':
      return 'ChatGPT'
    case 'opencode':
      return 'OpenCode'
    default:
      return 'AI'
  }
}

export interface MarkedText {
  text: string
  marks: [number, number][]
}

/** A piece of `text` with the marks that fall inside it, moved to its start. */
function slice(source: MarkedText, start: number, end: number): MarkedText {
  return {
    text: source.text.slice(start, end),
    marks: source.marks
      .filter(([s, e]) => e > start && s < end)
      .map(([s, e]) => [Math.max(s, start) - start, Math.min(e, end) - start] as [number, number]),
  }
}

export interface CsvSnippet {
  first: MarkedText
  column: string | null
  cell: MarkedText | null
}

const CELL_SEPARATOR = ' · '

/**
 * A CSV row's words (question 4): its first cell, then the matching cell with its column's name,
 * "Harbour Logistics · Contact: Mari Tamm". When the match is in the first cell, the next filled cell follows.
 * Null when the row can't be split (the header row itself, or a row cut at its start): the passage shows as it is.
 */
export function csvSnippet(result: SearchResult): CsvSnippet | null {
  const passage = result.passage
  if (result.format !== 'csv' || !passage || !result.columns || passage.at.row === undefined || passage.at.row === 0) return null
  if (passage.text.startsWith('…')) return null
  const cells: { start: number; end: number }[] = []
  let start = 0
  for (;;) {
    const at = passage.text.indexOf(CELL_SEPARATOR, start)
    cells.push({ start, end: at < 0 ? passage.text.length : at })
    if (at < 0) break
    start = at + CELL_SEPARATOR.length
  }
  if (cells.length < 2) return null
  const marked = cells.findIndex((cell) => passage.marks.some(([s, e]) => s < cell.end && e > cell.start))
  const source = { text: passage.text, marks: passage.marks }
  const first = slice(source, cells[0].start, cells[0].end)
  const index = marked > 0 ? marked : cells.findIndex((cell, i) => i > 0 && cell.end > cell.start)
  if (index <= 0) return { first, column: null, cell: null }
  const column = result.columns[index]?.trim() || null
  return { first, column, cell: slice(source, cells[index].start, cells[index].end) }
}

/** A too-big document's line in place of its words (question 2). */
export function tooBigWords(size: number | undefined): string {
  const mb = size ? Math.max(1, Math.round(size / (1024 * 1024))) : null
  return mb ? `Searched by its name only: too big to read inside (${number(mb)} MB).` : 'Searched by its name only: too big to read inside.'
}

/** A passage that is only the name again (a document's title heading): the row shows no words under it. */
export function repeatsName(result: SearchResult): boolean {
  const passage = result.passage?.text.trim().toLowerCase()
  return !!passage && passage === result.name.trim().toLowerCase()
}

/** A row's words for a screen reader (R8): its kind, its name and its passage. */
export function rowLabel(result: SearchResult, detail: string | null): string {
  const parts = [KIND_WORDS[result.kind].label, result.name || 'Untitled']
  if (detail) parts.push(detail)
  if (result.passage && !repeatsName(result)) {
    const who = result.kind === 'chat' ? `${speakerWords(result.passage.at.speaker)}: ` : ''
    parts.push(`${who}${result.passage.text}`)
  } else if (result.nameOnly === 'too-large') {
    parts.push(tooBigWords(result.size))
  }
  return parts.join(', ')
}

/** A document's place inside the project, for its tooltip: "Meetings/Brief.md". */
export function relativePlace(path: string | undefined, roots: readonly string[]): string | null {
  if (!path) return null
  const normal = path.replace(/\\/g, '/')
  for (const root of roots) {
    const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
    if (normal.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return normal.slice(base.length + 1)
  }
  return normal.split('/').pop() ?? null
}

/**
 * A row's tooltip, on hover only (the Experience lead, #636): a document's place in the project, "Meetings/Weekly
 * sync.md". Chats and tasks have none: their words say what they are, and the row's accessible name carries them.
 */
export function rowTip(result: SearchResult, roots: readonly string[]): string | null {
  if (result.kind === 'document') return relativePlace(result.path, roots) ?? result.name
  return null
}

/**
 * Found words joined by a hyphen, or touching, are one mark, so "one-page" is marked whole; words with a space
 * between them keep their own marks (the Experience lead, #636).
 */
export function joinedMarks(text: string, marks: readonly [number, number][]): [number, number][] {
  const joined: [number, number][] = []
  for (const [start, end] of [...marks].sort((a, b) => a[0] - b[0])) {
    if (end <= start) continue
    const last = joined[joined.length - 1]
    if (last && start >= last[1] && /^[-‐‑]*$/.test(text.slice(last[1], start))) last[1] = Math.max(last[1], end)
    else if (!last || start >= last[1]) joined.push([start, end])
  }
  return joined
}

import TurndownService from 'turndown'
import { tables, taskListItems } from 'turndown-plugin-gfm'
import { isRelativeImagePath, isWebviewResourceUri } from '../../../src/utils/imagePaths'
import { addMathTurndownRules } from '../extensions/math/mathTurndownRules'
import { addAsWrittenTurndownRules, blockImage, escapeTextRun, neutraliseBrackets, wrapMarked } from './markdownAsWritten'

/**
 * Create a fresh TurndownService configured with Ritemark's canonical
 * HTML → Markdown rules. Use this for any HTML-to-MD conversion (paste-flow
 * "Copy as Markdown", DOCX-preview Save as Markdown, etc.) so output style
 * stays consistent across surfaces.
 *
 * Includes:
 *  - ATX headings, fenced code blocks, `*` italic, `**` bold
 *  - GFM tables + task list items
 *  - `~~` strikethrough for `<s>`, `<del>` and `<strike>`
 *  - Tilde escaping so literal `~` in ordinary text is not read back as
 *    strikethrough (Turndown's own escaper only covers a leading `~~~`)
 *  - Image rule preferring `title="./..."` over DOM-resolved `src` (used for
 *    both paste-flow and Save-as-Markdown image references); an image that is
 *    a block of its own is written on its own lines
 *  - Sprint 137 (#270): the as-written rules (`markdownAsWritten.ts`) — lists,
 *    task lists, line breaks, quotes, thematic breaks, bare addresses, code
 *    fences and tables written the way the source wrote them, and escapes only
 *    where a character would change what the line means. HTML without the
 *    editor's `data-md-*` attributes (paste, Word's Save as Markdown) gets one
 *    plain form: `- item`, tight lists, `---`, `| --- |`, a backslash break.
 */
export function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    hr: '---',
    br: '\\',
    // Inline code keeps the spaces at its edges (`2026. `, `# `): without this
    // Turndown moves them outside the backticks, which changes the code.
    preformattedCode: true,
  })

  service.use(tables)
  service.use(taskListItems)

  // Literal tildes in ordinary text. `marked` reads both `~x~` and `~~x~~` as
  // strikethrough, and Turndown's escaper only covers a leading `~~~`, so a
  // paragraph typed as `a~b~c` was saved verbatim and reopened as
  // `a<del>b</del>c` — the tildes gone, and the next save making it permanent.
  // Escapes only where a character would change what the line means (R4):
  // `escapeTextRun` is Turndown's escaper without its line-start escapes,
  // which the paragraph rule applies at the start of each line instead.
  service.escape = (text: string) => escapeLiteralTildes(escapeTextRun(text))

  // Brackets a mark splits across runs (`[**x**]: y`) are escaped from the
  // block's text as a whole, which Turndown's per-run escaper cannot see
  // (`neutraliseBrackets`). Only input with a bracket takes the extra pass; it
  // is parsed in an inert document, as Turndown parses its own string input.
  const turndown = service.turndown.bind(service)
  service.turndown = (input: string | TurndownService.Node): string => {
    if (typeof document === 'undefined') return turndown(input)
    if (typeof input === 'string') {
      if (!/[[\]]/.test(input)) return turndown(input)
      const inert = document.implementation?.createHTMLDocument?.('') ?? document
      const root = inert.createElement('div')
      root.innerHTML = input
      neutraliseBrackets(root)
      return turndown(root)
    }
    if (!/[[\]]/.test(input.textContent ?? '')) return turndown(input)
    const root = input.cloneNode(true)
    neutraliseBrackets(root)
    return turndown(root as TurndownService.Node)
  }

  // Strikethrough: TipTap's Strike mark renders `<s>`, and `marked` loads
  // `~~x~~` as `<del>`. Turndown has no default rule for either, so without
  // this the text survives a save but the mark is dropped. The GFM plugin's
  // `strikethrough` rule writes a single `~`, which several parsers (markdown-it
  // among them) do not read as strikethrough, so write `~~`. An empty run stays
  // empty: `~~~~` at the start of a line would open a code fence.
  service.addRule('strikethrough', {
    filter(node) {
      return node.nodeName === 'S' || node.nodeName === 'DEL' || node.nodeName === 'STRIKE'
    },
    replacement(content) {
      // Line breaks at the run's edges go outside the tildes (`wrapMarked`).
      const wrapped = wrapMarked(content, '\u0000')
      if (!wrapped.includes('\u0000')) return wrapped
      return wrapped.replace(/\u0000([\s\S]*)\u0000/, (_match, inner: string) => `~~${escapeStrikeTildes(inner)}~~`)
    },
  })

  // Image rule: the title holds the canonical relative path whenever the src
  // is only a display URI — set by the host's image mapping (./a.png,
  // ../a.png, img/a.png) or by paste-flow's saveImage and mammoth's
  // convertImage (always ./). A title on a remote image is the author's own
  // caption and never replaces its src.
  service.addRule('imageWithRelativePath', {
    filter: 'img',
    replacement(_content, node) {
      const el = node as HTMLImageElement
      const alt = el.alt || ''
      const title = el.getAttribute('title') || ''
      const displaySrc = el.getAttribute('src') || el.src
      const src = title.startsWith('./') || (isRelativeImagePath(title) && isWebviewResourceUri(displaySrc))
        ? title
        : displaySrc
      return blockImage(`![${alt}](${src})`, el)
    },
  })

  // The as-written rules, which also escape a table cell's pipes (the GFM
  // plugin doesn't, and an unescaped `|` breaks a table holding code).
  addAsWrittenTurndownRules(service)
  // Sprint 138 (#481, R2): equations written back as they were, `\$` kept,
  // and a typed `$` escaped only when it would pair up as math on reopening.
  addMathTurndownRules(service)

  return service
}

/** A code span, an existing backslash escape, or a run of tildes. */
const STRIKE_CONTENT_TOKENS = /(`+)[\s\S]*?(?<!`)\1(?!`)|\\[\s\S]|~+/g

/**
 * Escape every literal tilde in a struck run, because `marked` reads tildes
 * inside a strike as delimiters. A leading tilde makes the run start `~~~`,
 * which opens a code fence at the start of a line and swallows the rest of the
 * document on reopen. Two tildes together close the strike early. Two single
 * tildes pair up as a nested strike and vanish: `~~a~b~c~~` reopens as `abc`.
 * `marked` also only closes a strike after a character that is not a tilde,
 * escaped or not, so a final tilde is written as the character reference
 * `&#126;`.
 *
 * Code spans are literal, so they are left alone, as are the backslash escapes
 * already in the content: Turndown's own leading `\~~~`, and the openers
 * `escapeLiteralTildes` escaped before this rule ran. Neither can be the last
 * thing in the content, so only a bare final tilde needs `&#126;`.
 */
function escapeStrikeTildes(content: string): string {
  return content.replace(
    STRIKE_CONTENT_TOKENS,
    (match: string, _codeFence: string | undefined, offset: number) => {
      if (match[0] !== '~') return match
      const escaped = '\\~'.repeat(match.length)
      return offset + match.length === content.length
        ? escaped.slice(0, -2) + '&#126;'
        : escaped
    },
  )
}

/** The longest tilde run `marked` will read as a strikethrough delimiter. */
const MAX_DELIMITER_TILDES = 2

interface TildeRun {
  /** Where an escape has to start: past a backslash that is already there. */
  openStart: number
  /** Tildes available to open a strike, which is what an escape rewrites. */
  openLength: number
  /** The whole run, which is what a closing delimiter has to consume. */
  length: number
  canOpen: boolean
  canClose: boolean
}

/**
 * `marked` only reads a tilde run as a delimiter when the character on the
 * inside of the strike is there and is not whitespace.
 */
function isDelimiterNeighbour(char: string | undefined): boolean {
  return char !== undefined && !/\s/.test(char)
}

/** Whether the character at `index` is escaped, i.e. preceded by an odd run of backslashes. */
function isEscaped(text: string, index: number): boolean {
  let backslashes = 0
  while (index - backslashes > 0 && text[index - backslashes - 1] === '\\') backslashes++
  return backslashes % 2 === 1
}

/**
 * Escape the literal tildes `marked` would otherwise read as strikethrough
 * delimiters, and only those.
 *
 * `marked` opens a strike on a run of one or two tildes followed by a
 * non-space character and closes it on an *identical* run preceded by one, so
 * a tilde is dangerous only when a matching partner can pair with it. Most
 * tildes therefore survive byte for byte as the author wrote them — a save
 * must not rewrite text nobody touched (the same class as #270):
 *
 *  - `~/Downloads`, `~5 min`, `from ~5 to ~10` — nothing can close them.
 *  - `a~b~~` — the two runs are different lengths, so they never pair.
 *  - `a~~~b~~~c` — three or more tildes are not a delimiter at all.
 *
 * `a~b~c`, `~c~` and a literal `~~word~~` do pair, and there the *opening* run
 * is escaped. Only the opener is worth escaping: `marked` matches on the raw
 * source and does not honour backslashes while scanning, so an escaped closer
 * still closes — it just takes the `\` in front of it as the last character of
 * the strike. An escaped opener, on the other hand, is never reached: the
 * lexer consumes the backslash and the tilde together and moves past them.
 *
 * Escaping is applied to a fixed point, because writing `~~` as `\~\~` splits
 * it into two single tildes that can close a single-tilde opener further left.
 *
 * Runs are read off the already-escaped string; that is also why this pass runs
 * second, so its own backslashes are not doubled by Turndown's escaper.
 *
 * Pairing is judged within one text node. `marked` sees a whole paragraph, so
 * a pair split across an inline element — `~a **b** c~` — is still read as a
 * strike. Catching that would mean escaping every lone tilde and rewriting
 * `~/Downloads` in every document, which is the worse trade.
 */
function escapeLiteralTildes(text: string): string {
  let escaped = text
  let pass = escapeTildeOpeners(escaped)
  while (pass !== escaped) {
    escaped = pass
    pass = escapeTildeOpeners(escaped)
  }
  return escaped
}

/** One pass: escape every tilde run that could open a strike `marked` would close. */
function escapeTildeOpeners(text: string): string {
  const runs: TildeRun[] = []
  for (const match of text.matchAll(/~+/g)) {
    const start = match.index
    const length = match[0].length
    // A tilde that is already escaped — Turndown writes a leading `~~~` as
    // `\~~~`, and an earlier pass may have escaped one here — is never scanned
    // as an opener: the lexer takes the backslash and the tilde together and
    // moves past both. The rest of the run still opens, and the whole run,
    // escaped tilde and all, still closes.
    const openStart = isEscaped(text, start) ? start + 1 : start
    const openLength = start + length - openStart
    runs.push({
      openStart,
      openLength,
      length,
      canOpen:
        openLength >= 1 &&
        openLength <= MAX_DELIMITER_TILDES &&
        isDelimiterNeighbour(text[start + length]),
      canClose: length <= MAX_DELIMITER_TILDES && isDelimiterNeighbour(text[start - 1]),
    })
  }

  const needsEscape = runs.map(() => false)
  const closerLengthsAfter = new Set<number>()
  for (let index = runs.length - 1; index >= 0; index--) {
    const run = runs[index]
    if (run.canOpen && closerLengthsAfter.has(run.openLength)) needsEscape[index] = true
    if (run.canClose) closerLengthsAfter.add(run.length)
  }

  let escaped = ''
  let cursor = 0
  runs.forEach((run, index) => {
    if (!needsEscape[index]) return
    escaped += text.slice(cursor, run.openStart) + '\\~'.repeat(run.openLength)
    cursor = run.openStart + run.openLength
  })
  return cursor === 0 ? text : escaped + text.slice(cursor)
}

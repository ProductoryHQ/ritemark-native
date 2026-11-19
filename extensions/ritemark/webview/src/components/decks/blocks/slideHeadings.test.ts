/**
 * Sprint 168 PR 3 (the decks README, "Quotes, prompts and heading levels on a slide", item 3): a slide's headings in the
 * document's order. H1 the largest (2 em), then H2 (1.3 em, bold, the heading colour), then H3 (1.15 em); an H2 right
 * under the title is the title's own line (weight 500, the sub colour, still 1.3 em); a box's H3 keeps its 1.1 em.
 *
 * The sizes are computed, not read off one rule: a small cascade takes every rule of slide.css (the one sheet the stage,
 * the strip, the wall, the presenter view and the page draw with) and decks.css (the stage's own), matches them against
 * a slide's elements by selector, specificity and order, and inherits and resolves the em sizes from the flow's 24 px
 * times the fit. Then a realistic slide with three H2s in its middle goes through the fit (`fitFlow`, the one measure of
 * every view), laid out by a model whose heights come from those computed sizes. Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { BLOCK_FIT_STEPS } from '../../../../../src/decks/blocks/slideRenderer'
import { fitFlow } from './slideFit'

const sheet = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  // At-rules' own blocks (the boxes' @container rules) set no heading's type.
  .replace(/@[^{}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  .replace(/\s+/g, ' ')

// ---- A small cascade -------------------------------------------------------------------------------------------------

interface El { tag: string; classes: string[]; attrs?: Record<string, string>; parent?: El; prev?: El; next?: El; kids: El[] }
function el(tag: string, classes: string[], parent?: El, prev?: El): El {
  const made: El = { tag, classes, parent, prev, kids: [] }
  if (prev) prev.next = made
  parent?.kids.push(made)
  return made
}

interface Decl { property: string; value: string; specificity: number; order: number }
type Spec = [number, number, number]
const weigh = ([a, b, c]: Spec) => a * 10000 + b * 100 + c

/** Split at top-level `sep` (never inside parentheses). */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0 && ch === sep) { out.push(text.slice(from, i)); from = i + 1 }
  }
  out.push(text.slice(from))
  return out.map(part => part.trim()).filter(Boolean)
}

/** A complex selector as compounds and the combinators between them (`' '`, `'>'`, `'+'`, `'~'`). */
function parts(selector: string): { compounds: string[]; combinators: string[] } {
  const compounds: string[] = []
  const combinators: string[] = []
  let depth = 0
  let current = ''
  let pending: string | null = null
  const flush = () => {
    if (!current) return
    if (compounds.length) combinators.push(pending ?? ' ')
    compounds.push(current)
    current = ''
    pending = null
  }
  for (const ch of selector.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) {
      flush()
      if (ch !== ' ') pending = ch
      continue
    }
    current += ch
  }
  flush()
  return { compounds, combinators }
}

/** One compound's simple selectors: its tag, classes and pseudo-classes (with their arguments). */
function simples(compound: string): string[] {
  return compound.match(/::?[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?|\.[\w-]+|\[[^\]]*\]|^[\w*-]+/g) ?? []
}

function specificityOf(selector: string): Spec {
  const spec: Spec = [0, 0, 0]
  for (const compound of parts(selector).compounds) {
    for (const simple of simples(compound)) {
      const inner = /^:(is|not|has|where)\((.*)\)$/.exec(simple)
      if (inner) {
        if (inner[1] === 'where') continue
        const most = splitTop(inner[2], ',').map(specificityOf).sort((x, y) => weigh(y) - weigh(x))[0] ?? [0, 0, 0]
        spec[0] += most[0]; spec[1] += most[1]; spec[2] += most[2]
      } else if (/^:nth-(last-)?child\(.* of /.test(simple)) {
        // `:nth-child(An+B of S)`: a pseudo-class, plus the most specific selector of S.
        const of = simple.slice(simple.indexOf(' of ') + 4, -1)
        const most = splitTop(of, ',').map(specificityOf).sort((x, y) => weigh(y) - weigh(x))[0] ?? [0, 0, 0]
        spec[0] += most[0]; spec[1] += most[1] + 1; spec[2] += most[2]
      } else if (simple.startsWith('::')) spec[2]++
      else if (simple.startsWith('.') || simple.startsWith('[') || simple.startsWith(':')) spec[1]++
      else if (simple !== '*') spec[2]++
    }
  }
  return spec
}

/** The pseudo-classes this cascade evaluates; a heading's rule with any other is listed (`UNREAD`, under). */
const READ_PSEUDO = /^:(is|where|not|has)\(|^:(first|last)-child$|^:nth-child\(1 of /
/** The attribute selectors this cascade evaluates: a name with its value. */
const ATTRIBUTE = /^\[([\w-]+)="([^"]*)"\]$/
const UNREAD: string[] = []

/** `:has()`'s relative selector (`+ h2`, `~ p`, `> h3`, `h3`) from `anchor`, forwards. */
function hasRelative(anchor: El, relative: string): boolean {
  const lead = /^([+~>])\s*(.*)$/.exec(relative.trim())
  const { compounds, combinators } = parts(lead ? lead[2] : relative)
  const after = (from: El, combinator: string): El[] => {
    if (combinator === '+') return from.next ? [from.next] : []
    if (combinator === '~') { const out: El[] = []; for (let at = from.next; at; at = at.next) out.push(at); return out }
    if (combinator === '>') return from.kids
    const out: El[] = []
    const walk = (node: El) => node.kids.forEach(kid => { out.push(kid); walk(kid) })
    walk(from)
    return out
  }
  const on = (from: El, combinator: string, index: number): boolean =>
    after(from, combinator).some(next => matchesCompound(next, compounds[index]) && (index === compounds.length - 1 || on(next, combinators[index], index + 1)))
  return on(anchor, lead ? lead[1] : ' ', 0)
}

/** Does one compound match the element? Pseudo-elements and the pseudo-classes it doesn't evaluate never do. */
function matchesCompound(element: El, compound: string): boolean {
  for (const simple of simples(compound)) {
    const inner = /^:(is|where|not|has)\((.*)\)$/.exec(simple)
    if (inner && inner[1] === 'has') {
      if (!splitTop(inner[2], ',').some(relative => hasRelative(element, relative))) return false
    } else if (inner) {
      const any = splitTop(inner[2], ',').some(selector => matches(element, selector))
      if (inner[1] === 'not' ? any : !any) return false
    } else if (/^:nth-child\(1 of /.test(simple)) {
      // One of the selector's, and the first of its siblings that are (the stage's `1 of :not(ritemark-comment)`).
      const of = (at: El) => splitTop(simple.slice(':nth-child(1 of '.length, -1), ',').some(selector => matches(at, selector))
      if (!of(element)) return false
      for (let at = element.prev; at; at = at.prev) if (of(at)) return false
    } else if (simple === ':first-child') {
      if (element.prev) return false
    } else if (simple === ':last-child') {
      if (element.next) return false
    } else if (ATTRIBUTE.test(simple)) {
      // An attribute with its value (`[data-placeholder=""]`); a bare one is not read.
      const [, name, value] = ATTRIBUTE.exec(simple) ?? []
      if (element.attrs?.[name] !== value) return false
    } else if (simple.startsWith(':') || simple.startsWith('[')) return false
    else if (simple.startsWith('.')) {
      if (!element.classes.includes(simple.slice(1))) return false
    } else if (simple !== '*' && simple !== element.tag) return false
  }
  return true
}

/** Does a complex selector match the element (right to left, with backtracking for ' ' and '~')? */
function matches(element: El, selector: string): boolean {
  const { compounds, combinators } = parts(selector)
  const from = (at: El | undefined, index: number): boolean => {
    if (!at || !matchesCompound(at, compounds[index])) return false
    if (index === 0) return true
    const combinator = combinators[index - 1]
    if (combinator === '>') return from(at.parent, index - 1)
    if (combinator === '+') return from(at.prev, index - 1)
    const step = (node: El) => (combinator === '~' ? node.prev : node.parent)
    for (let up = step(at); up; up = step(up)) if (from(up, index - 1)) return true
    return false
  }
  return from(element, compounds.length - 1)
}

/** `font: 700 2em/1.12 family` as its longhands (a font this doesn't read, such as `inherit`, sets none here). */
function expand(property: string, value: string): Array<[string, string]> {
  if (property === 'font') {
    const length = String.raw`calc\([^()]*\([^()]*\)\)|[\d.]+(?:em|px)?`
    const font = new RegExp(String.raw`^(?:(\d{3}|bold|normal) )?(${length})(?:/(${length}))? `).exec(`${value} `)
    if (!font) return []
    return [['font-weight', font[1] ?? '400'], ['font-size', font[2]], ['line-height', font[3] ?? 'normal']]
  }
  if (property === 'margin') {
    const sides = value.match(/calc\([^()]*\([^()]*\)\)|[^ ]+/g) ?? ['0']
    const top = sides[0]
    return [['margin-top', top], ['margin-bottom', sides[2] ?? top]]
  }
  return [[property, value]]
}

/** Each rule's selectors and its declarations as longhands, each with whether it is `!important`. */
function rulesOf(...texts: string[]): Array<{ selectors: string[]; decls: Array<[string, string, boolean]> }> {
  const rules: Array<{ selectors: string[]; decls: Array<[string, string, boolean]> }> = []
  for (const text of texts) {
    for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls: Array<[string, string, boolean]> = []
      for (const part of match[2].split(';')) {
        const at = part.indexOf(':')
        if (at <= 0) continue
        const value = part.slice(at + 1).trim()
        const important = / ?!important$/.test(value)
        for (const [name, longhand] of expand(part.slice(0, at).trim(), value.replace(/ ?!important$/, ''))) decls.push([name, longhand, important])
      }
      rules.push({ selectors: splitTop(match[1], ','), decls })
    }
  }
  return rules
}

function cascade(rules: ReturnType<typeof rulesOf>) {
  const declared = (element: El, property: string): string | undefined => {
    let best: Decl | undefined
    rules.forEach((rule, order) => {
      const hit = rule.selectors.filter(selector => matches(element, selector)).map(specificityOf).sort((x, y) => weigh(y) - weigh(x))[0]
      if (!hit) return
      for (const [name, value, important] of rule.decls) {
        if (name !== property) continue
        // An !important declaration outranks every normal one, then specificity, then order, as the browser does.
        const decl = { property, value, specificity: (important ? 1e9 : 0) + weigh(hit), order }
        if (!best || decl.specificity > best.specificity || (decl.specificity === best.specificity && decl.order >= best.order)) best = decl
      }
    })
    return best?.value
  }
  const length = (value: string, em: number, fit: number): number => {
    if (value === '0') return 0
    let m = /^calc\(([\d.]+)px \* var\(--fit, 1\)\)$/.exec(value)
    if (m) return Number(m[1]) * fit
    m = /^([\d.]*\.?\d+)(em|px)$/.exec(value)
    assert.ok(m, `a length this test reads: ${value}`)
    return m[2] === 'em' ? Number(m[1]) * em : Number(m[1])
  }
  const inherited = (element: El, property: string, fallback: string): string => {
    for (let at: El | undefined = element; at; at = at.parent) {
      const value = declared(at, property)
      if (value !== undefined) return value
    }
    return fallback
  }
  const fontSize = (element: El, fit: number): number => {
    const value = declared(element, 'font-size')
    const parent = element.parent ? fontSize(element.parent, fit) : 16
    return value === undefined ? parent : length(value, parent, fit)
  }
  return {
    /** The element's computed type at a fit: size and line height in px, weight, colour, and its bottom margin in px. */
    computed(element: El, fit = 1) {
      const size = fontSize(element, fit)
      // A unitless line height is a factor of the element's own size; a length is what it says.
      const lineHeight = inherited(element, 'line-height', '1.2')
      return {
        size,
        lineHeight: /^[\d.]+$/.test(lineHeight) ? Number(lineHeight) * size : length(lineHeight, size, fit),
        weight: Number(inherited(element, 'font-weight', '400')),
        color: inherited(element, 'color', ''),
        marginBottom: length(declared(element, 'margin-bottom') ?? '0', size, fit),
        paddingTop: length(declared(element, 'padding-top') ?? '0', size, fit),
      }
    },
  }
}

const slideCss = sheet('../slide/slide.css')
const decksCss = sheet('../decks.css')
const drawn = cascade(rulesOf(slideCss))
const stage = cascade(rulesOf(slideCss, decksCss))

// The heading rules this cascade can't evaluate: a heading as the subject (not its ::before), setting what this test
// reads, with a pseudo-class it doesn't read (`:hover`, `nth-child(… of …)`) or an attribute. Each such rule must be
// listed in `UNREAD` by name (there are none today), so a new one fails here until it is looked at, never skipped unseen.
{
  const READS = new Set(['font-weight', 'font-size', 'line-height', 'color', 'margin-top', 'margin-bottom', 'padding-top'])
  const unreadable = (selector: string): boolean => parts(selector).compounds.some(compound => simples(compound).some(simple => {
    if (/^:(is|where|not|has)\(/.test(simple)) return splitTop(simple.slice(simple.indexOf('(') + 1, -1), ',').some(inner => unreadable(inner.replace(/^[+~>]\s*/, '')))
    return (simple.startsWith(':') && !READ_PSEUDO.test(simple)) || (simple.startsWith('[') && !ATTRIBUTE.test(simple))
  }))
  const unreadHeadingRules = (...texts: string[]) => rulesOf(...texts)
    .filter(rule => rule.decls.some(([name]) => READS.has(name)))
    .flatMap(rule => rule.selectors)
    .filter(selector => {
      // The subject: the last compound, without what :has() and :not() only look at.
      const subject = (parts(selector).compounds.pop() ?? '').replace(/:(has|not)\((?:[^()]|\([^()]*\))*\)/g, '')
      return !selector.includes('::') && /(^|[\s>+~(,])h[1-3]\b/.test(subject) && unreadable(selector)
    })
  assert.deepEqual(unreadHeadingRules(slideCss, decksCss), UNREAD, 'a heading rule this test cannot evaluate: look at it, then list it here')
  // It would see one: a state, an attribute, nth-child's `of`; not a ::before, nor a rule on another element.
  assert.deepEqual(
    unreadHeadingRules('.deck-sl.is-blocks h2:hover { color: red; } .deck-sl.is-blocks :is(h1, h3)[data-x] { font-size: 3em; } .x h2:nth-last-child(1 of p) { margin-bottom: 0; } .x h2::before { color: red; } .x p:hover:has(+ h2) { color: red; }'),
    ['.deck-sl.is-blocks h2:hover', '.deck-sl.is-blocks :is(h1, h3)[data-x]', '.x h2:nth-last-child(1 of p)'],
  )
}

/** A block slide's flow, as the renderer (or, `editing`, the stage) draws it, Card or Borderless. */
function flowOf(options: { borderless?: boolean; editing?: boolean } = {}): El {
  const frame = el('div', options.borderless ? ['deck-slide', 'is-borderless'] : ['deck-slide'])
  const sl = el('div', ['deck-sl', 'is-blocks', ...(options.editing ? ['is-editing'] : [])], frame)
  return el('div', ['blk-flow'], sl)
}

/** Children of `parent` in order, each one's `prev` the one before. */
function children(parent: El, ...specs: Array<[string, string[]?]>): El[] {
  const out: El[] = []
  for (const [tag, classes = []] of specs) out.push(el(tag, classes, parent, out[out.length - 1]))
  return out
}

const near = (actual: number, expected: number, what: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${what}: ${actual} (expected ${expected})`)

// The cascade itself: an !important declaration beats a more specific normal one; `:has(+ …)` looks at what follows.
{
  const tiny = cascade(rulesOf('.a h2 { color: red !important; } .x .a h2.b { color: blue; } .a h1:has(+ h2) { color: green; }'))
  const [a] = children(el('div', ['x']), ['div', ['a']])
  const [h1, h2] = children(a, ['h1'], ['h2', ['b']])
  assert.equal(tiny.computed(h2).color, 'red')
  assert.equal(tiny.computed(h1).color, 'green')
}

// ---- H1 > H2 > H3, on Card and on Borderless -------------------------------------------------------------------------

for (const borderless of [false, true]) {
  const look = borderless ? 'Borderless' : 'Card'
  const hd = borderless ? 'var(--s-hd, #1C1F4A)' : 'var(--s-hd, #fff)'
  const sub = borderless ? 'var(--s-sub, #5B5F86)' : 'var(--s-sub, #C7CAEB)'
  // A title, a line under it, words, then an H2 and an H3 in the slide's middle.
  const [h1, line, , h2, h3] = children(flowOf({ borderless }), ['h1'], ['h2'], ['p'], ['h2'], ['h3'])
  for (const fit of [1, BLOCK_FIT_STEPS[2]]) {
    const [one, two, three, title] = [h1, h2, h3, line].map(element => drawn.computed(element, fit))
    near(one.size, 48 * fit, `${look}: the H1 is 2 em of the flow's 24 px`)
    near(two.size, 31.2 * fit, `${look}: the H2 is 1.3 em`)
    near(three.size, 27.6 * fit, `${look}: the H3 is 1.15 em`)
    assert.ok(one.size > two.size && two.size > three.size, `${look}: H1 > H2 > H3 at ${fit}`)
    // The title's line: an H2 at the same size, so still above an H3.
    near(title.size, two.size, `${look}: the title's line is the H2's size`)
    assert.ok(title.size > three.size)
  }
  const [one, two, three, title] = [h1, h2, h3, line].map(element => drawn.computed(element))
  assert.deepEqual([one.weight, two.weight, three.weight, title.weight], [700, 700, 700, 500], `${look}: the weights`)
  assert.deepEqual([one.color, two.color, three.color, title.color], [hd, hd, hd, sub], `${look}: the H2 in the heading colour, the title's line quiet`)
  // The H2's lines and room: 1.3 of its size, and 6 px under it (#901); the title's line keeps the title close (.12 em).
  near(two.lineHeight, 31.2 * 1.3, `${look}: the H2's line height`)
  near(two.marginBottom, 6, `${look}: the H2's room under it`)
  near(one.marginBottom, 48 * 0.12, `${look}: the title keeps its line close (h1:has(+ h2))`)
}

// The title's line only right under the title: after words, or with a Label between, an H2 is a heading.
{
  const [, , afterWords] = children(flowOf(), ['h1'], ['p'], ['h2'])
  assert.equal(drawn.computed(afterWords).weight, 700)
  const [, , afterLabel] = children(flowOf(), ['h1'], ['p', ['blk-label']], ['h2'])
  assert.equal(drawn.computed(afterLabel).color, 'var(--s-hd, #fff)')
  const [, , notTitle] = children(flowOf(), ['h3'], ['h2'], ['h2'])
  assert.equal(drawn.computed(notTitle).weight, 700, 'an H2 after an H2 is a heading')
}

// On the stage, comment notes between the title and its line (never drawn) leave it the title's line, Card and Borderless.
for (const borderless of [false, true]) {
  for (const notes of [1, 2, 3]) {
    const specs: Array<[string, string[]?]> = [['h1'], ...Array.from({ length: notes }, (): [string] => ['ritemark-comment']), ['h2']]
    const elements = children(flowOf({ borderless, editing: true }), ...specs)
    const line = elements[elements.length - 1]
    const look = stage.computed(line)
    near(stage.computed(elements[0]).marginBottom, 48 * 0.12, `${notes} note(s): the title keeps its line close`)
    assert.equal(look.weight, 500, `${notes} note(s): weight 500`)
    assert.equal(look.color, borderless ? 'var(--s-sub, #5B5F86)' : 'var(--s-sub, #C7CAEB)', `${notes} note(s): the sub colour`)
    near(look.size, 31.2, `${notes} note(s): the H2's size`)
  }
  const [, , heading] = children(flowOf({ borderless, editing: true }), ['h1'], ['p'], ['h2'])
  assert.equal(stage.computed(heading).weight, 700, 'the stage: a heading H2 stays bold')
}

// ---- A box's H3 keeps its size, relative to the box; a tab pane's too ------------------------------------------------

{
  const flow = flowOf()
  const [boxes] = children(flow, ['div', ['blk-boxes']])
  const [box] = children(boxes, ['div', ['blk-box']])
  const [icon, h3] = children(box, ['div', ['blk-icon']], ['h3'])
  void icon
  // The box's words are .86 of the flow's; its H3 1.1 of that, as before Sprint 168 (the README: "A box's h3 stays").
  near(drawn.computed(h3).size, 24 * 0.86 * 1.1, "a box's H3")
  near(drawn.computed(h3, 0.84).size, 24 * 0.84 * 0.86 * 1.1, "a box's H3, stepped down")
  assert.equal(drawn.computed(h3).weight, 700)
  const [tabs] = children(flowOf(), ['div', ['blk-tabs']])
  const [panes] = children(tabs, ['div', ['blk-tabpanes']])
  const [pane] = children(panes, ['div', ['blk-tabpane']])
  const [paneH3] = children(pane, ['h3'])
  near(drawn.computed(paneH3).size, 24 * 0.625 * 1.15, "a tab pane's H3")
}

// ---- The fit with a grown H2 ------------------------------------------------------------------------------------------
// A realistic slide (synthetic): a title, a line of words, then three sections, each an H2 over a list or a line
// ("Week two of the pilot": What helped, What slowed us down, What we change next). With the H2 at its old 1.12 em it
// fits at 100 %; at 1.3 em it no longer does, and the fit steps the slide's words down until it does, with nothing past
// the bottom. Each block's height at a fit comes from its computed type here; its line count stays as at 100 %.

const OLD_H2 = { size: 1.12, lineHeight: 1.3, marginBottom: 0.7 }
/** The H2 as it was drawn: `old` before Sprint 168 PR 3 (1.12 em), `pr3` after it (1.3 em, .7 em under it and no room
 *  above it, before #901), `now` from slide.css as it stands. */
type H2Mode = 'old' | 'pr3' | 'now'
/** A mid-slide heading's room under it before #901, an em of its own type (`old` and `pr3`); none above it then. */
const PRE_901_UNDER: Partial<Record<Block['tag'], number>> = { h2: 0.7, h3: 0.35 }
type Block = { tag: 'h1' | 'h2' | 'h3' | 'p' | 'ul'; lines: number[] }
const SLIDE: Block[] = [
  { tag: 'h1', lines: [1] },
  { tag: 'p', lines: [1] },
  { tag: 'h2', lines: [1] },
  { tag: 'ul', lines: [1, 1] },
  { tag: 'h2', lines: [1] },
  { tag: 'p', lines: [1] },
  { tag: 'h2', lines: [1] },
  { tag: 'p', lines: [1] },
]

/** The flow's blocks laid out at a fit, top to bottom, with the type from slide.css (or the old H2's). */
function layout(blocks: Block[], fit: number, mode: H2Mode): Array<{ top: number; height: number; marginBottom: number }> {
  const flow = flowOf()
  const elements = children(flow, ...blocks.map((block): [string] => [block.tag]))
  const out: Array<{ top: number; height: number; marginBottom: number }> = []
  let top = 0
  blocks.forEach((block, index) => {
    const element = elements[index]
    let height: number
    let marginBottom: number
    if (block.tag === 'ul') {
      const items = children(element, ...block.lines.map((): [string] => ['li']))
      const li = drawn.computed(items[0], fit)
      height = block.lines.reduce((sum, lines) => sum + lines * li.lineHeight, 0) + (block.lines.length - 1) * li.marginBottom
      marginBottom = Math.max(drawn.computed(element, fit).marginBottom, li.marginBottom)
    } else {
      const look = drawn.computed(element, fit)
      const h2 = block.tag === 'h2'
      // Before #901 a mid-slide heading had no room above it and an em of its own type under it (H2 .7, H3 .35).
      const oldUnder = PRE_901_UNDER[block.tag]
      const size = h2 && mode === 'old' ? 24 * fit * OLD_H2.size : look.size
      const lineHeight = h2 && mode === 'old' ? size * OLD_H2.lineHeight : look.lineHeight
      // A heading's own room above it is inside its box (`offsetHeight`), as the padding it is (#901).
      height = block.lines[0] * lineHeight + (oldUnder !== undefined && mode !== 'now' ? 0 : look.paddingTop)
      marginBottom = oldUnder !== undefined && mode !== 'now' ? size * oldUnder : look.marginBottom
    }
    // The flow's last block has no margin under it (`.blk-flow > :last-child`).
    if (index === blocks.length - 1) marginBottom = 0
    out.push({ top, height, marginBottom })
    top += height + marginBottom
  })
  return out
}

/** A flow the fit can measure: the room of a 960 × 540 slide's flow (540 − 46 − 34), its blocks from `layout`. */
function modelFlow(blocks: Block[], mode: H2Mode) {
  let fit = 1
  const room = 460
  // Laid out once per fit, as the browser lays out once per `--fit`; the getters read that layout.
  let laid: { fit: number; blocks: ReturnType<typeof layout> } | null = null
  const at = () => {
    if (laid?.fit !== fit) laid = { fit, blocks: layout(blocks, fit, mode) }
    return laid.blocks
  }
  const kids = blocks.map((_, index) => ({
    get offsetTop() { return at()[index].top },
    get offsetHeight() { return at()[index].height },
    offsetLeft: 0,
    offsetWidth: 832,
    style: { display: 'block', position: 'static', marginTop: '0', get marginBottom() { return `${at()[index].marginBottom}px` } },
  }))
  return {
    clientHeight: room,
    clientWidth: 832,
    offsetWidth: 832,
    scrollHeight: room,
    getBoundingClientRect: () => ({ width: 832 }),
    children: kids,
    querySelectorAll: () => [],
    style: { setProperty: (_name: string, value: string) => { fit = Number(value) } },
    content: () => { const blocks = at(); const last = blocks[blocks.length - 1]; return last.top + last.height },
  }
}
;(globalThis as unknown as { getComputedStyle: (element: { style: object }) => object }).getComputedStyle = element => element.style

{
  const before = modelFlow(SLIDE, 'old')
  const old = fitFlow(before as unknown as HTMLElement)
  assert.deepEqual(old, { step: 0, full: false }, 'with the old H2 the slide fits at 100 %')
  const after = modelFlow(SLIDE, 'pr3')
  after.style.setProperty('--fit', '1')
  assert.ok(after.content() > 460, `with the grown H2 it no longer fits at 100 % (${after.content().toFixed(1)} px of 460)`)
  const { step, full } = fitFlow(after as unknown as HTMLElement)
  assert.ok(step > 0, 'the fit steps the words down')
  assert.equal(full, false, 'and the slide is not full')
  assert.ok(after.content() <= 460, `nothing past the bottom at ${BLOCK_FIT_STEPS[step]} (${after.content().toFixed(1)} px)`)
  // The step found is the biggest that fits: one up runs past the bottom.
  after.style.setProperty('--fit', String(BLOCK_FIT_STEPS[step - 1]))
  assert.ok(after.content() > 460, `the step above does not fit (${after.content().toFixed(1)} px)`)
}

// ---- #901: a heading sits nearer to what it introduces ------------------------------------------------------------
// The decks README, "Spacing on the slide" (20 November): an H2 to H6 has 6 px under it, and 24 px in all above an H2,
// 18 above an H3 to H6: the block before gives its 12, the heading adds 12 or 6 as padding (so a flex column, whose
// margins don't collapse, draws the same). Slide px times the fit, never an em of the heading's own type.

/** The space above `heading` (the block before's margin under it and the heading's own padding) and under it, in px. */
function room(look: ReturnType<typeof cascade>, heading: El, fit = 1): { above: number; under: number } {
  let before = heading.prev
  while (before && before.tag === 'ritemark-comment') before = before.prev
  const above = (before ? look.computed(before, fit).marginBottom : 0) + look.computed(heading, fit).paddingTop
  return { above, under: look.computed(heading, fit).marginBottom }
}
const sameRoom = (actual: { above: number; under: number }, expected: { above: number; under: number }, what: string) => {
  near(actual.above, expected.above, `${what} (above)`)
  near(actual.under, expected.under, `${what} (under)`)
}

for (const fit of [1, BLOCK_FIT_STEPS[2]]) {
  // In the flow: a title, words, an H2, words, an H3, words, an H4.
  const [, , h2, , h3, , h4] = children(flowOf(), ['h1'], ['p'], ['h2'], ['p'], ['h3'], ['p'], ['h4'], ['p'])
  sameRoom(room(drawn, h2, fit), { above: 24 * fit, under: 6 * fit }, `the flow: an H2 at ${fit}`)
  sameRoom(room(drawn, h3, fit), { above: 18 * fit, under: 6 * fit }, `the flow: an H3 at ${fit}`)
  sameRoom(room(drawn, h4, fit), { above: 18 * fit, under: 6 * fit }, `the flow: an H4 at ${fit}`)
  // After a list too: the list's own 12 under it.
  const [, listH2] = children(flowOf(), ['ul'], ['h2'], ['p'])
  near(room(drawn, listH2, fit).above, 24 * fit, 'an H2 after a list')

  // In a column of a Columns block (the slide's flow is a flex column then): the same, and none at the column's top.
  const [, columns] = children(flowOf(), ['h1'], ['div', ['blk-columns']])
  const [column] = children(columns, ['div', ['blk-column']])
  const [first, , colH3, , colH2] = children(column, ['h2'], ['p'], ['h3'], ['p'], ['h2'], ['p'])
  near(drawn.computed(first, fit).paddingTop, 0, "a column's first heading adds nothing above it")
  near(drawn.computed(first, fit).marginBottom, 6 * fit, "a column's first heading: 6 under it")
  sameRoom(room(drawn, colH3, fit), { above: 18 * fit, under: 6 * fit }, 'a column: an H3')
  sameRoom(room(drawn, colH2, fit), { above: 24 * fit, under: 6 * fit }, 'a column: an H2')

  // In a tab's pane, as the renderer draws it (its hidden name first) and as the stage does (a note, never drawn, first).
  const [tabs] = children(flowOf(), ['div', ['blk-tabs']])
  const [panes] = children(tabs, ['div', ['blk-tabpanes']])
  const [pane] = children(panes, ['div', ['blk-tabpane']])
  const [, paneFirst, , paneH2] = children(pane, ['div', ['blk-tabname']], ['h3'], ['p'], ['h2'], ['p'])
  near(drawn.computed(paneFirst, fit).paddingTop, 0, "a pane's first heading (after its hidden name) adds nothing")
  sameRoom(room(drawn, paneH2, fit), { above: 24 * fit, under: 6 * fit }, "a pane: an H2, in slide px, not the pane's smaller em")
  const [stageTabs] = children(flowOf({ editing: true }), ['div', ['blk-tabs']])
  const [stagePanes] = children(stageTabs, ['div', ['blk-tabpanes']])
  const [stagePane] = children(stagePanes, ['div', ['blk-tabpane']])
  const [, stageFirst, , stageH3] = children(stagePane, ['ritemark-comment'], ['h2'], ['p'], ['h3'], ['p'])
  near(stage.computed(stageFirst, fit).paddingTop, 0, "the stage: a pane's first heading after a note adds nothing")
  sameRoom(room(stage, stageH3, fit), { above: 18 * fit, under: 6 * fit }, "the stage: a pane's H3")
}

// None at the start of the flow, on the renderer and on the stage (a note first).
{
  const [h2] = children(flowOf(), ['h2'], ['p'])
  near(drawn.computed(h2).paddingTop, 0, "the flow's first heading adds nothing above it")
  const [, h3] = children(flowOf({ editing: true }), ['ritemark-comment'], ['h3'], ['p'])
  near(stage.computed(h3).paddingTop, 0, "the stage: the flow's first heading after a note adds nothing")
  const [, , mid] = children(flowOf({ editing: true }), ['p'], ['ritemark-comment'], ['h2'], ['p'])
  sameRoom(room(stage, mid), { above: 24, under: 6 }, 'the stage: a note before a mid-slide H2 changes nothing')
}

// The title's line keeps its close place and its room under it; the title keeps .5 em under it otherwise.
{
  const [h1, line, , heading] = children(flowOf(), ['h1'], ['h2'], ['p'], ['h2'])
  near(drawn.computed(line).paddingTop, 0, "the title's line adds nothing above it")
  near(drawn.computed(line).marginBottom, 31.2 * 0.7, "the title's line keeps .7 em under it")
  near(drawn.computed(h1).marginBottom, 48 * 0.12, 'the title keeps its line close')
  near(room(drawn, heading).above, 24, 'a later H2 is a heading')
  const [lone] = children(flowOf(), ['h1'], ['p'])
  near(drawn.computed(lone).marginBottom, 48 * 0.5, 'the title keeps .5 em under it')
  for (const notes of [1, 2, 3]) {
    const specs: Array<[string, string[]?]> = [['h1'], ...Array.from({ length: notes }, (): [string] => ['ritemark-comment']), ['h2'], ['p']]
    const elements = children(flowOf({ editing: true }), ...specs)
    const stageLine = elements[elements.length - 2]
    near(stage.computed(stageLine).paddingTop, 0, `${notes} note(s): the title's line adds nothing above it`)
    near(stage.computed(stageLine).marginBottom, 31.2 * 0.7, `${notes} note(s): the title's line keeps .7 em under it`)
  }
}

// A Label right before a heading stays 8 px above it, with or without notes between; a box's headings are unchanged.
{
  const [, , , h2] = children(flowOf(), ['h1'], ['p'], ['p', ['blk-label']], ['h2'], ['p'])
  sameRoom(room(drawn, h2), { above: 8, under: 6 }, 'a Label over an H2')
  for (const notes of [1, 2, 3]) {
    const specs: Array<[string, string[]?]> = [['p'], ['p', ['blk-label']], ...Array.from({ length: notes }, (): [string] => ['ritemark-comment']), ['h3'], ['p']]
    const elements = children(flowOf({ editing: true }), ...specs)
    sameRoom(room(stage, elements[elements.length - 2]), { above: 8, under: 6 }, `the stage, ${notes} note(s): a Label over an H3`)
  }
  const [boxes] = children(flowOf(), ['div', ['blk-boxes']])
  const [box] = children(boxes, ['div', ['blk-box']])
  const [, boxH3, , boxH2] = children(box, ['div', ['blk-icon']], ['h3'], ['p'], ['h2'])
  for (const heading of [boxH3, boxH2]) {
    near(drawn.computed(heading).paddingTop, 0, "a box's heading adds nothing above it")
    near(drawn.computed(heading).marginBottom, 0, "a box's heading keeps the box's own gap")
  }
  const [stageBoxes] = children(flowOf({ editing: true }), ['div', ['blk-boxes']])
  const [stageBox] = children(stageBoxes, ['div', ['blk-box']])
  const [, inner] = children(stageBox, ['span', ['blk-icon']], ['div', ['blk-inner']])
  const [, stageBoxH3] = children(inner, ['p'], ['h3'])
  near(stage.computed(stageBoxH3).paddingTop, 0, "the stage: a box's heading adds nothing above it")
}

// Review of #906: an empty Label is never drawn (the renderer draws nothing for it), so on the stage the heading under it
// keeps its room, as on the wall; at the start of the flow or a column it still adds none.
{
  const emptyLabel = (parent: El, prev?: El) => {
    const made = el('p', ['blk-label', 'is-empty'], parent, prev)
    made.attrs = { 'data-placeholder': '' }
    return made
  }
  const flow = flowOf({ editing: true })
  const [words] = children(flow, ['p'])
  const label = emptyLabel(flow, words)
  const h2 = el('h2', [], flow, label)
  el('p', [], flow, h2)
  // The empty Label is 0 tall with no margin, so the words' 12 and the H2's 12 meet over it.
  near(stage.computed(label).marginBottom, 0, 'the empty Label takes no room')
  near(stage.computed(words).marginBottom + stage.computed(label).marginBottom + stage.computed(h2).paddingTop, 24, 'the stage: an H2 under an empty Label keeps its 24')
  const columns = children(flowOf({ editing: true }), ['div', ['blk-columns']])[0]
  const [column] = children(columns, ['div', ['blk-column']])
  const firstLabel = emptyLabel(column)
  const h3 = el('h3', [], column, firstLabel)
  el('p', [], column, h3)
  near(stage.computed(h3).paddingTop, 0, "the stage: a column's first heading under an empty Label adds nothing")
  // A Label with words keeps its 8 px over the heading.
  const flow2 = flowOf({ editing: true })
  const [, filled, h3b] = children(flow2, ['p'], ['p', ['blk-label']], ['h3'], ['p'])
  void filled
  sameRoom(room(stage, h3b), { above: 8, under: 6 }, 'the stage: a Label with words over an H3')
}

// A heading that starts some other group (a reveal's or an unknown fenced div's `.blk-group`) mid-slide keeps its room:
// only the flow, a column, a box and a tab's pane start without it.
{
  const [, group] = children(flowOf(), ['p'], ['div', ['blk-group']], ['p'])
  const [h2] = children(group, ['h2'], ['p'])
  near(drawn.computed(h2).paddingTop, 12, "a group's first H2 keeps its 12 above it")
  const [, stageGroup] = children(flowOf({ editing: true }), ['p'], ['div', ['blk-group']], ['p'])
  const [stageH3] = children(stageGroup, ['h3'], ['p'])
  near(stage.computed(stageH3).paddingTop, 6, "the stage: a group's first H3 keeps its 6 above it")
}

// The cascade's `:nth-child(1 of S)` needs the element to be one of S, as the browser does.
{
  const tiny = cascade(rulesOf('.x p:nth-child(1 of .lead) { color: red; }'))
  const [plain, lead] = children(el('div', ['x']), ['p'], ['p', ['lead']])
  assert.equal(tiny.computed(plain).color, '', 'not one of S: no match')
  assert.equal(tiny.computed(lead).color, 'red', 'the first of S')
}

// The fit, on the same realistic slide: before #901 (Sprint 168 PR 3's record: 453 of 460 px at 100 % with the old H2,
// then 440 at 92 % with the grown one) and now. Each mid-slide H2 trades .7 em (21.84 px) under it for 6 under and
// 12 above, so the slide is shorter and its words never need a smaller step than before.
{
  const pr3 = modelFlow(SLIDE, 'pr3')
  const now = modelFlow(SLIDE, 'now')
  const pr3Fit = fitFlow(pr3 as unknown as HTMLElement)
  const nowFit = fitFlow(now as unknown as HTMLElement)
  const pr3Fitted = pr3.content()
  const nowFitted = now.content()
  now.style.setProperty('--fit', '1')
  const nowFull = now.content()
  console.log(`slideHeadings: the fit, before #901 fitted at ${BLOCK_FIT_STEPS[pr3Fit.step]} (${pr3Fitted.toFixed(1)} of 460); now ${nowFull.toFixed(1)} of 460 at 1, fitted at ${BLOCK_FIT_STEPS[nowFit.step]} (${nowFitted.toFixed(1)} of 460)`)
  assert.ok(nowFit.step <= pr3Fit.step, 'no smaller fit step than before #901')
  assert.equal(nowFit.full, false)
  assert.ok(nowFitted <= 460, 'nothing past the bottom')
}

// H3s do the opposite (review of #906): a mid-slide H3 after words had 12 above and .35 em (9.66 px) under, 21.66 in
// all; it now has 18 above and 6 under, 24 in all, 2.34 px more each. A realistic slide of H3 sections: its step,
// before and now, recorded; nothing past the bottom either way.
{
  const H3_SLIDE: Block[] = [
    { tag: 'h1', lines: [1] },
    { tag: 'p', lines: [1] },
    { tag: 'h3', lines: [1] }, { tag: 'p', lines: [1] },
    { tag: 'h3', lines: [1] }, { tag: 'p', lines: [1] },
    { tag: 'h3', lines: [1] }, { tag: 'ul', lines: [1, 1] },
    { tag: 'h3', lines: [1] }, { tag: 'p', lines: [1] },
  ]
  const pr3 = modelFlow(H3_SLIDE, 'pr3')
  const now = modelFlow(H3_SLIDE, 'now')
  pr3.style.setProperty('--fit', '1')
  now.style.setProperty('--fit', '1')
  const [pr3Full, nowFull] = [pr3.content(), now.content()]
  near(nowFull - pr3Full, 4 * 2.34, 'four mid-slide H3s after words add 2.34 px each')
  const pr3Fit = fitFlow(pr3 as unknown as HTMLElement)
  const nowFit = fitFlow(now as unknown as HTMLElement)
  console.log(`slideHeadings: H3 sections, before #901 ${pr3Full.toFixed(1)} of 460 at 1, fitted at ${BLOCK_FIT_STEPS[pr3Fit.step]} (${pr3.content().toFixed(1)}); now ${nowFull.toFixed(1)} at 1, fitted at ${BLOCK_FIT_STEPS[nowFit.step]} (${now.content().toFixed(1)})`)
  assert.equal(nowFit.full, false)
  assert.ok(now.content() <= 460, 'nothing past the bottom')
}

console.log('slideHeadings: passed')

/**
 * Sprint 159 (technical plan §6, parity): the published page's slide (`slideMarkup`) is the deck view's slide
 * (`SlideCanvas`, rendered with react-dom/server) element for element, for all nine kinds and the looks of Boxes, in
 * Card and Borderless; and the page's icons (`pageIcons.ts`) are `@phosphor-icons/core`'s drawings.
 *
 * Run: npx tsx webview/src/components/decks/slide/slideMarkup.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SlideData } from '../../../../../src/decks/deckFormat'

// SlideCanvas imports './slide.css', which Node cannot load: for this run only, a style sheet loads as an empty module.
register(`data:text/javascript,${encodeURIComponent(
  "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context) }",
)}`)
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})
// The measuring pass is a layout effect, which a server render skips (and says so for every slide).
const consoleError = console.error
console.error = (...args: unknown[]) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) consoleError(...args) }
const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
type HTMLNode = ReturnType<typeof parse>
const { SlideCanvas, LayoutSlideCanvas } = await import('./SlideCanvas')
const { SlideIconGlyph } = await import('./SlideIconGlyph')
const { slideMarkup, escapeHtml, styleText } = await import('./slideMarkup')
const { BUILT_IN_THEME } = await import('../../../../../src/decks/deckTheme')
const { blockSlideMarkup } = await import('../../../../../src/decks/blocks/slideRenderer')
const { publicSlide } = await import('../../../../../src/decks/page/publicDeck')
const { PAGE_ICON_PATHS, iconSvg } = await import('./pageIcons')
const { SLIDE_ICONS, UNKNOWN_ICON } = await import('./iconSet')

/** A node as a comparable tree: tag, attributes (style as a sorted map, `data-fit` left out), text, children. */
function shape(node: HTMLNode): unknown {
  const out: unknown[] = []
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const text = child.text
      if (text !== '') out.push(text)
      continue
    }
    if (child.nodeType !== 1) continue
    const element = child as HTMLNode & { rawTagName: string; attributes: Record<string, string> }
    const attributes: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(element.attributes)) {
      // The deck view's own measuring marks: the page sizes its slides itself
      if (name === 'data-fit' || name === 'data-step') continue
      if (name === 'style') {
        attributes.style = Object.fromEntries(value.split(';').filter(Boolean).map(part => {
          const at = part.indexOf(':')
          return [part.slice(0, at).trim(), part.slice(at + 1).trim()]
        }).sort(([a], [b]) => a.localeCompare(b)))
        continue
      }
      // React writes an SVG's attributes in its own order and adds none we draw differently; the drawing is its path.
      if (element.rawTagName.toLowerCase() === 'svg') continue
      attributes[name] = value
    }
    out.push({ tag: element.rawTagName.toLowerCase(), attributes, children: shape(element) })
  }
  return out
}

const pictures: Record<string, string> = { 'images/team.png': 'images/team.png', 'images/chart.png': 'images/chart%20one.png' }
const items = (count: number, extra: (index: number) => Record<string, string> = () => ({})) =>
  Array.from({ length: count }, (_, index) => ({ heading: `Heading ${index + 1}`, text: `A line about <${index + 1}> & "more"`, ...extra(index) }))

const slides: Array<{ kind: string; data: SlideData; label: string }> = [
  { label: 'title', kind: 'title', data: { title: 'AI assistants & agents', subtitle: 'Harbour Logistics · 3 hours' } },
  { label: 'title with a picture behind', kind: 'title', data: { title: 'Welcome', subtitle: 'Today', picture: 'behind', image: 'images/team.png' } },
  { label: 'section', kind: 'section', data: { title: 'Why agents?', number: '1' } },
  { label: 'statement', kind: 'statement', data: { title: 'Shared prompt board', subtitle: 'Every prompt from today.' } },
  { label: 'points', kind: 'points', data: { title: 'Today', items: items(5) } },
  { label: 'points, a picture on the right', kind: 'points', data: { title: 'Today', items: items(3), picture: 'right', image: 'images/chart.png' } },
  { label: 'boxes', kind: 'boxes', data: { title: "An assistant's four parts", items: items(4, index => ({ icon: ['list-checks', 'book-open', 'puzzle', 'nope'][index] })) } },
  { label: 'boxes in a grid', kind: 'boxes', data: { title: 'Six boxes', items: items(6, () => ({ icon: 'wrench' })) } },
  // Sprint 169 (#866): icons outside the 24, by their Phosphor names.
  { label: 'boxes with any Phosphor icon', kind: 'boxes', data: { title: 'Delivery', items: items(4, index => ({ icon: ['truck', 'Rocket-Launch', 'users-three', 'chat'][index] })) } },
  // Sprint 169 PR 2 (#867): the Experience lead's truck and folder, an alias, and a name no icon has.
  { label: 'boxes with truck, folder, an alias and an unknown name', kind: 'boxes', data: { title: 'Shipping', items: items(4, index => ({ icon: ['truck', 'folder', 'mail', 'not-a-real-icon'][index] })) } },
  { label: 'boxes beside a picture', kind: 'boxes', data: { title: 'Beside', items: items(3), picture: 'left', image: 'images/missing.png' } },
  { label: 'steps', kind: 'boxes', data: { title: 'Steps', look: 'steps', items: items(4) } },
  { label: 'line', kind: 'boxes', data: { title: 'A scheduled prompt', look: 'line', items: items(4) } },
  { label: 'arrows', kind: 'boxes', data: { title: 'Arrows', look: 'arrows', items: items(3) } },
  { label: 'columns', kind: 'columns', data: { title: 'Assistant or agent?', items: [{ heading: 'Assistant', text: 'Answers when you ask\nWorks in the chat' }, { heading: 'Agent', text: 'Works on a goal\nUses tools' }] } },
  { label: 'exercise', kind: 'exercise', data: { title: 'Build an assistant', items: items(4) } },
  // 16 November: the pill's own words, or none (`tag: ""`), drawn alike on the stage, the wall and the page.
  { label: 'exercise with its own pill', kind: 'exercise', data: { title: 'Proovi ise', tag: 'Harjutus <1> & "2"', items: items(2) } },
  { label: 'exercise with no pill', kind: 'exercise', data: { title: 'Proovi ise', tag: '', items: items(2) } },
  { label: 'picture', kind: 'picture', data: { title: 'A clean table', subtitle: 'One row per record.', image: 'images/team.png' } },
  { label: 'an empty picture', kind: 'picture', data: { title: 'No picture yet' } },
  { label: 'table', kind: 'table', data: { title: 'Which tool', rows: [['Data', 'In the chat', 'In Excel'], ['Public', 'Yes', 'Yes'], ['Internal', 'Company <account>', 'Yes, on a copy']] } },
  { label: 'a kind this build does not know', kind: 'gamma.v2', data: { title: 'From somewhere else' } },
]

for (const borderless of [false, true]) {
  for (const slide of slides) {
    const label = `${slide.label}, ${borderless ? 'Borderless' : 'Card'}`
    const react = renderToStaticMarkup(createElement(SlideCanvas, { kind: slide.kind, data: slide.data, width: 960, theme: BUILT_IN_THEME, borderless, assets: pictures }))
    // Sprint 161 (PR 2, decision 8): the nine kinds go to the page as the block slide their conversion writes
    // (`publicSlide`), drawn by the one block renderer; the deck view draws them the same way. A kind this build doesn't
    // know is still drawn by its layout on both.
    const shown = publicSlide(slide.kind, slide.data as SlideData)
    const drawing = { theme: BUILT_IN_THEME, borderless, width: 960, inlineTheme: true, pictureUrl: (path: string) => pictures[path] ?? null }
    const page = shown.kind === '' ? blockSlideMarkup(shown.data, drawing) : slideMarkup(slide.kind, slide.data, drawing)
    assert.deepEqual(shape(parse(page)), shape(parse(react)), label)
    // Each icon's drawing, too: the path React's Phosphor icon draws is the one the page draws.
    const paths = (html: string) => parse(html).querySelectorAll('svg path').map(path => path.getAttribute('d'))
    assert.deepEqual(paths(page), paths(react), `${label}: the icons`)
    if (slide.label === 'boxes with any Phosphor icon') {
      const drawn = (name: keyof typeof PAGE_ICON_PATHS) => /d="([^"]*)"/.exec(PAGE_ICON_PATHS[name])![1]
      // An older deck's box (the nine kinds draw as blocks on the strip and the page): `chat` is Phosphor's chat too.
      assert.deepEqual(paths(react), [drawn('truck'), drawn('rocket-launch'), drawn('users-three'), drawn('chat')], `${label}: each its own`)
    }
    if (slide.label === 'boxes with truck, folder, an alias and an unknown name') {
      const drawn = (name: keyof typeof PAGE_ICON_PATHS) => /d="([^"]*)"/.exec(PAGE_ICON_PATHS[name])![1]
      assert.deepEqual(paths(react), [drawn('truck'), drawn('folder'), drawn('envelope-simple'), drawn('circle-dashed')], `${label}: each its own`)
      const badges = (html: string) => parse(html).querySelectorAll('.blk-box > span').map(span => span.getAttribute('class'))
      assert.deepEqual(badges(react), ['blk-icon', 'blk-icon', 'blk-icon', 'blk-icon is-unknown'], `${label}: #850's look for the unknown name`)
      assert.deepEqual(badges(page), badges(react), `${label}: the page's badges`)
    }
  }
}

// On the page the slide is sized by the page: no size, no scale, no theme on it, and still hidden from screen readers.
{
  const page = parse(slideMarkup('title', { title: 'T' }, { theme: BUILT_IN_THEME, borderless: false }))
  const outer = page.querySelector('.deck-slide')!
  assert.equal(outer.getAttribute('style'), undefined)
  assert.equal(page.querySelector('.deck-sl')!.getAttribute('style'), undefined)
  assert.equal(page.querySelector('.deck-sl')!.getAttribute('aria-hidden'), 'true')
}

// Words are text, never markup.
{
  const html = slideMarkup('points', { title: '<script>alert(1)</script>', items: [{ heading: '<img src=x onerror=alert(1)>' }] }, { theme: BUILT_IN_THEME, borderless: false })
  assert.ok(!html.includes('<script>') && !html.includes('<img'), html)
  assert.ok(html.includes('&lt;script&gt;'))
  assert.equal(escapeHtml(`a&b<c>"d"'e'`), 'a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;')
  assert.equal(styleText({ fontSize: 20, fontWeight: 700, lineHeight: '28px' }), 'font-size:20px;font-weight:700;line-height:28px')
}

// A step the measuring pass found makes the words smaller, as on the stage.
{
  const size = (html: string) => Number(/font-size:(\d+)px/.exec(html)![1])
  const at = (step: number) => size(slideMarkup('title', { title: 'A title' }, { theme: BUILT_IN_THEME, borderless: false, step }))
  assert.ok(at(1) < at(0) && at(2) < at(1), 'each step is a size smaller')
}

// The icons: every regular icon (Sprint 169), the slide icons and the page's own among them, each the package's drawing.
{
  const core = fileURLToPath(new URL('../../../../../node_modules/@phosphor-icons/core/assets/regular/', import.meta.url))
  const names = Object.keys(PAGE_ICON_PATHS)
  assert.equal(names.length, 1512, "every one of @phosphor-icons/core 2.1.1's regular icons")
  for (const icon of SLIDE_ICONS) assert.ok(names.includes(icon.phosphor), `${icon.phosphor} is in pageIcons.ts`)
  // #850: the dashed circle an unknown icon name draws.
  assert.ok(names.includes(UNKNOWN_ICON), `${UNKNOWN_ICON} is in pageIcons.ts`)
  for (const name of ['arrow-right', 'copy', 'check', 'list', 'caret-up', 'caret-down', 'folder', 'file-text']) assert.ok(names.includes(name), name)
  // The generator writes the module as it is.
  const generator = new URL('../../../../../scripts/generate-page-icons.mjs', import.meta.url).href
  const { iconNames } = (await import(generator)) as { iconNames: () => string[] }
  assert.deepEqual(iconNames(), [...names].sort(), 'node scripts/generate-page-icons.mjs writes these icons')
  for (const name of names) {
    const file = readFileSync(join(core, `${name}.svg`), 'utf8').trim()
    const inner = /^<svg\b[^>]*>([\s\S]*)<\/svg>$/.exec(file)![1]
    assert.equal(PAGE_ICON_PATHS[name as keyof typeof PAGE_ICON_PATHS], inner, `${name} is @phosphor-icons/core's drawing; run node scripts/generate-page-icons.mjs`)
  }
  assert.match(iconSvg('copy', 14), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">/)
}

console.log('slideMarkup: passed')

// Sprint 169 PR 2 (#867): a slide's icon in React (`SlideIconGlyph`) is the page's inline SVG (`iconSvg`), byte for byte.
for (const name of ['truck', 'folder', 'list-checks', 'circle-dashed', 'arrow-right'] as const) {
  for (const size of [16, 20, 28]) {
    assert.equal(renderToStaticMarkup(createElement(SlideIconGlyph, { name, size })), iconSvg(name, size), `${name} at ${size}`)
  }
}

// Sprint 169 PR 2: the old layout (a kind a build may draw by its layout) draws a box's icon from the full set, as the
// page does: any Phosphor name, an alias, the grid's own, and #850's dashed circle (`ic is-unknown`) for a name no icon
// has. Red before: the chrome's Icon drew only the 24 (truck and folder came out as empty badges).
{
  const drawn = (name: keyof typeof PAGE_ICON_PATHS) => /d="([^"]*)"/.exec(PAGE_ICON_PATHS[name])![1]
  const data: SlideData = { title: 'Shipping', items: items(5, index => ({ icon: ['truck', 'folder', 'mail', 'list-checks', 'not-a-real-icon'][index] })) }
  const paths = (html: string) => parse(html).querySelectorAll('svg path').map(path => path.getAttribute('d'))
  const marks = (html: string) => parse(html).querySelectorAll('span.ic').map(span => span.getAttribute('class'))
  for (const borderless of [false, true]) {
    const react = renderToStaticMarkup(createElement(LayoutSlideCanvas, { kind: 'boxes', data, width: 960, theme: BUILT_IN_THEME, borderless, assets: {} }))
    const page = slideMarkup('boxes', data, { theme: BUILT_IN_THEME, borderless, width: 960, inlineTheme: true })
    assert.deepEqual(shape(parse(page)), shape(parse(react)), `the old layout, borderless ${borderless}`)
    assert.deepEqual(paths(react), [drawn('truck'), drawn('folder'), drawn('envelope-simple'), drawn('list-checks'), drawn('circle-dashed')], 'each its own')
    assert.deepEqual(paths(page), paths(react), 'the page draws the same')
    assert.deepEqual(marks(react), ['ic sm', 'ic sm', 'ic sm', 'ic sm', 'ic sm is-unknown'], "#850's look (five boxes draw small)")
  }
  // The colour: the theme's placeholder, on a card and borderless, as a block slide's unknown badge.
  const css = readFileSync(fileURLToPath(new URL('./slide.css', import.meta.url)), 'utf8')
  assert.ok(css.includes('.deck-sl .ic.is-unknown { color: var(--s-ph, rgba(255,255,255,.35)); }'), 'the placeholder colour')
  assert.ok(css.includes('.deck-slide.is-borderless .deck-sl .ic.is-unknown { color: var(--s-ph, rgba(28,31,74,.3)); }'), 'borderless too')
}

// The icon menu draws its choices as the slide does, never through the chrome's Icon (its No icon cross stays chrome).
{
  // Named not after the grid: Tailwind scans tests, and a negated variable of that name reads as its important class.
  const menuSource = readFileSync(fileURLToPath(new URL('./IconGrid.tsx', import.meta.url)), 'utf8')
  assert.ok(menuSource.includes('<SlideIconGlyph name={icon.phosphor} size={16} />'), 'the menu draws the slide glyph')
  assert.equal(menuSource.includes('<Icon name={icon.phosphor}'), false, 'and not the chrome icon')
  const canvas = readFileSync(fileURLToPath(new URL('./SlideCanvas.tsx', import.meta.url)), 'utf8')
  assert.equal(canvas.includes("from '../../ui/Icon'"), false, 'SlideCanvas draws no chrome icon')
}
console.log('slideMarkup: every slide icon is drawn from the full set, in React and on the page alike')

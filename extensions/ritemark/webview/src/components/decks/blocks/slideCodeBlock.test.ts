/**
 * Sprint 163 PR 1: the code block on a slide (the decks README, "A prompt is a code block, and Copy is the code
 * block's"). The / item and its hidden words; the file's round trip (a code block on a slide is an ordinary fenced block
 * inside the slide's own longer fence, byte for byte); the drawing (Copy, the ↗ and its two links, the places to fill
 * in, `open-in: none`, the address cap); Copy taking the whole block and the ↗'s menu on the wall; the host's checks on
 * what it opens; and the published page's slides. Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterSlashItems } from '../../../extensions/blockItems'
import { SLIDE_ITEMS } from './slideCommands'
import { loadSlide, saveSlide } from './slideEditorHarness'
import { fillPlaceDecorations } from '../../../extensions/codeFillPlaces'
import { codeToolsClick, closeCodeMenus } from '../slide/codeToolsClick'
import { blockSlideHtml, blockSlideMarkup } from '../../../../../src/decks/blocks/slideRenderer'
import { OPEN_IN_MAX_ADDRESS, codeBlockHtml, fillPlaces, isOpenInAddress, marksFillPlaces, openInAddresses, openInTarget } from '../../../../../src/decks/blocks/codeTools'
import { parseDeck, slideDataOf, writeSlideBlock } from '../../../../../src/decks/deckFormat'
import { decodeDeckRequest, DeckProtocolError } from '../../../../../src/decks/deckProtocol'
import { decodeWallRequest } from '../../../../../src/decks/present/presentProtocol'
import { publicDeck } from '../../../../../src/decks/page/publicDeck'
import { pageHtml } from '../../../../../src/decks/page/pageHtml'
import { BUILT_IN_THEME } from '../../../../../src/decks/deckTheme'

const PROMPT = 'You are an analyst. I have added [the report].\nWrite a one-page summary of [what the board wants to know] & stop.'

// ---- The / item: in the Text group, found by its name, its hidden words and its shortcut.
{
  const item = SLIDE_ITEMS.find(entry => entry.nodeType === 'codeBlock')
  assert.ok(item, 'the slide menu has a Code block')
  assert.equal(item!.group, 'Text')
  assert.equal(item!.title, 'Code block')
  for (const query of ['code', 'Code', 'snippet', 'kood', 'KOOD', '```']) {
    assert.ok(filterSlashItems(SLIDE_ITEMS, query).some(entry => entry.title === 'Code block'), `"/${query}" finds Code block`)
  }
  assert.ok(!filterSlashItems(SLIDE_ITEMS, 'xyzq').length, 'nothing else is found')
}

// ---- The file: a slide holding a code block is written in a longer fence, and reads back byte for byte.
const SLIDE = `# Plan the summary\n\n\`\`\`\n${PROMPT}\n\`\`\`\n\nThen check it.`
{
  // The slide editor's own pipeline: the slide's Markdown as written, and stable on a second open.
  assert.equal(saveSlide(loadSlide(SLIDE)), SLIDE, 'a slide with a code block reads back as written')
  // The editor's block holds the prompt's words and nothing more (no empty last line of marked's): what Copy takes.
  let inEditor: string | null = null
  loadSlide(SLIDE).descendants(node => { if (node.type.name === 'codeBlock') inEditor = node.textContent; return true })
  assert.equal(inEditor, PROMPT)
  const fenced = SLIDE.replace('```\n', '```text\n')
  assert.equal(saveSlide(loadSlide(fenced)), fenced, 'with its language too')
  // The deck's file: the slide's fence is longer than the code block's, so the code block is the slide's own.
  const block = writeSlideBlock('', `---\nid: c1\n---\n${SLIDE}`)
  assert.ok(block.startsWith('````slide\n'), block)
  const deck = `---\ndeck: 2\n---\n\n${block}\n\n## Plan the summary\n\nThe handout.\n`
  const parsed = parseDeck(deck)
  assert.equal(parsed.slides.length, 1)
  assert.equal(slideDataOf(parsed.slides[0].kind, parsed.slides[0].body).markdown, SLIDE, 'the deck reads the slide whole')
  // Opened and saved unchanged: the same bytes (the slide's body is written back as it was read).
  assert.equal(writeSlideBlock(parsed.slides[0].kind, parsed.slides[0].body), block, 'the slide block is written back byte for byte')
}

// ---- The drawing: Copy, the ↗ with its two links, the places to fill in.
const icons = { copy: '<svg data-i="copy"></svg>', check: '<svg data-i="check"></svg>', openIn: '<svg data-i="open"></svg>' }
{
  const html = blockSlideHtml(SLIDE)
  assert.ok(html.includes('<pre class="cb">'), html)
  assert.ok(html.includes('class="cb-copy"') && html.includes('>Copy</span>'), 'Copy')
  assert.ok(html.includes('class="cb-open"') && html.includes('aria-label="Open in…"'), 'the ↗')
  const links = openInAddresses(PROMPT)
  assert.deepEqual(links.map(link => link.label), ['Claude', 'ChatGPT'])
  for (const link of links) assert.ok(html.includes(`href="${link.href}"`), link.href)
  assert.ok(html.includes('>Open in Claude</a>') && html.includes('>Open in ChatGPT</a>'))
  assert.ok(html.includes('<span class="cb-menu" role="menu" hidden>'), 'the menu waits, hidden')
  // The places to fill in, marked; the words around them escaped.
  assert.ok(html.includes('<mark class="cb-fill">[the report]</mark>'), html)
  assert.ok(html.includes('<mark class="cb-fill">[what the board wants to know]</mark> &amp; stop.'), html)
  assert.deepEqual(fillPlaces('a [b] c [d e]'), [{ from: 2, to: 5 }, { from: 8, to: 13 }])
  assert.deepEqual(fillPlaces('[a [b]] [] [x\ny]'), [{ from: 3, to: 6 }], 'no bracket inside, never empty, one line')
  // A program's code keeps `a[0]` as it is; a language of words marks.
  assert.ok(marksFillPlaces('') && marksFillPlaces('text') && marksFillPlaces('Markdown') && !marksFillPlaces('python'))
  assert.ok(!codeBlockHtml('x = a[0]', 'python', { openIn: true, icons }).includes('<mark'), 'python: no marks')
  // The renderer draws no raw HTML from a prompt.
  const tricky = blockSlideHtml('```\n<img src=x onerror=alert(1)> [x"y]\n```')
  assert.ok(!tricky.includes('<img') && tricky.includes('&lt;img src=x onerror=alert(1)&gt; <mark class="cb-fill">[x&quot;y]</mark>'), tricky)
}

// ---- `open-in: none`, and a block too long for an address: Copy stays, no ↗.
{
  const off = blockSlideHtml(SLIDE, { openIn: false })
  assert.ok(off.includes('class="cb-copy"') && !off.includes('cb-open') && !off.includes('href'), off)
  const claudeBase = 'https://claude.ai/new?q='.length
  assert.equal(openInAddresses('a'.repeat(OPEN_IN_MAX_ADDRESS - claudeBase)).length, 2, 'at the cap: both')
  const long = 'a'.repeat(OPEN_IN_MAX_ADDRESS - claudeBase + 1)
  assert.equal(openInAddresses(long).length, 0, 'past the cap: none')
  const drawn = codeBlockHtml(long, '', { openIn: true, icons })
  assert.ok(drawn.includes('cb-copy') && !drawn.includes('cb-open'), 'past the cap: Copy only')
  assert.ok(!codeBlockHtml('   ', '', { openIn: true, icons }).includes('cb-open'), 'an empty block: no ↗')
  // The deck's front matter reaches the canvas.
  const markup = blockSlideMarkup({ markdown: SLIDE }, { theme: BUILT_IN_THEME, borderless: false, openIn: false })
  assert.ok(!markup.includes('cb-open'), 'the canvas passes open-in on')
}

// ---- The host opens only what `openInAddresses` makes, and takes Copy's words as they are.
{
  const [claude, chatgpt] = openInAddresses(PROMPT)
  assert.ok(isOpenInAddress(claude.href) && isOpenInAddress(chatgpt.href))
  for (const bad of ['https://evil.example/?q=x', 'https://claude.ai/new?q=a b', 'https://claude.ai/new?q=x#y', 'javascript:alert(1)', `https://claude.ai/new?q=${'a'.repeat(OPEN_IN_MAX_ADDRESS)}`, 42, null]) {
    assert.ok(!isOpenInAddress(bad), String(bad))
  }
  assert.deepEqual(decodeDeckRequest({ type: 'deck/open-in', url: claude.href }), { type: 'deck/open-in', url: claude.href })
  assert.throws(() => decodeDeckRequest({ type: 'deck/open-in', url: 'https://evil.example/' }), DeckProtocolError)
  assert.throws(() => decodeDeckRequest({ type: 'deck/open-in', url: claude.href, more: 1 }), DeckProtocolError)
  assert.deepEqual(decodeWallRequest({ type: 'present/open-in', url: chatgpt.href }), { type: 'present/open-in', url: chatgpt.href })
  assert.equal(decodeWallRequest({ type: 'present/open-in', url: 'https://evil.example/' }), null)
  assert.deepEqual(decodeWallRequest({ type: 'present/copy', text: PROMPT }), { type: 'present/copy', text: PROMPT })
  assert.equal(decodeWallRequest({ type: 'present/copy', text: 5 }), null)
  assert.equal(decodeWallRequest({ type: 'present/copy', text: 'x'.repeat(200_001) }), null)
  // The string goes to the browser as it is, so a prompt's own `&` stays the prompt's.
  const target = openInTarget(claude.href)
  assert.equal(target, claude.href)
  assert.equal(decodeURIComponent(target!.slice('https://claude.ai/new?q='.length)), PROMPT)
  assert.equal(openInTarget('https://evil.example/'), null, 'anything else is never opened')
}

// ---- Copy takes the whole block, and the ↗'s menu opens, closes and opens a link through the host (the wall).
{
  const doc = createDocument(`<body><div id="wall">${blockSlideHtml(SLIDE)}<p id="elsewhere">x</p></div></body>`)
  const root = doc.getElementById('wall') as unknown as Element
  const copied: string[] = []
  const opened: string[] = []
  const actions = { copy: (text: string) => copied.push(text), open: (url: string) => opened.push(url) }
  const q = (selector: string) => root.querySelector(selector) as Element
  assert.equal(codeToolsClick(q('.cb-copy .cb-w1'), root, actions), 'used')
  assert.deepEqual(copied, [PROMPT], 'Copy takes the whole block, the marked places as words')
  assert.ok(q('.cb-copy').classList.contains('ok'), 'and says Copied')
  assert.ok(q('.cb-menu').hasAttribute('hidden'))
  assert.equal(codeToolsClick(q('.cb-open svg'), root, actions), 'used')
  assert.ok(!q('.cb-menu').hasAttribute('hidden') && q('.cb-open').getAttribute('aria-expanded') === 'true', 'the ↗ opens its menu')
  assert.equal(codeToolsClick(q('#elsewhere'), root, actions), 'used', 'a click elsewhere closes it, and does nothing more')
  assert.ok(q('.cb-menu').hasAttribute('hidden') && q('.cb-open').getAttribute('aria-expanded') === 'false')
  assert.equal(codeToolsClick(q('#elsewhere'), root, actions), 'none', 'with no menu open, the click is the wall\'s')
  codeToolsClick(q('.cb-open'), root, actions)
  assert.equal(codeToolsClick(q('a.cb-item[data-host="chatgpt"]'), root, actions), 'used')
  assert.deepEqual(opened, [openInAddresses(PROMPT)[1].href], 'Open in ChatGPT asks the host to open its address')
  assert.ok(q('.cb-menu').hasAttribute('hidden'), 'and the menu closes')
  codeToolsClick(q('.cb-open'), root, actions)
  assert.equal(closeCodeMenus(root), true, 'Esc closes an open menu')
  assert.equal(closeCodeMenus(root), false)
  // A second Copy restarts Copied's time (review of #804): the first one's timer no longer takes it off.
  const copyButton = q('.cb-copy') as Element & { okTimer?: unknown }
  codeToolsClick(copyButton, root, actions)
  const first = copyButton.okTimer
  codeToolsClick(copyButton, root, actions)
  assert.ok(copyButton.okTimer !== first && copyButton.classList.contains('ok'))
  clearTimeout(copyButton.okTimer as ReturnType<typeof setTimeout>)
  // A prompt at the slide's foot opens its menu upward, where the flow (which clips) has room (review of #804).
  const flowDoc = createDocument(`<body><div class="blk-flow" id="f">${blockSlideHtml(SLIDE)}</div></body>`)
  const flow = flowDoc.getElementById('f') as unknown as Element
  const rect = (top: number, bottom: number) => () => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) })
  Object.assign(flow, { getBoundingClientRect: rect(0, 500) })
  Object.assign(flow.querySelector('.cb-open')!, { getBoundingClientRect: rect(440, 470) })
  Object.assign(flow.querySelector('.cb-menu')!, { getBoundingClientRect: rect(480, 560) })
  codeToolsClick(flow.querySelector('.cb-open'), flow, actions)
  assert.ok(flow.querySelector('.cb-menu')!.classList.contains('is-up'), 'no room below: it opens upward')
  codeToolsClick(flow.querySelector('.cb-open'), flow, actions)
  Object.assign(flow.querySelector('.cb-menu')!, { getBoundingClientRect: rect(480, 490) })
  codeToolsClick(flow.querySelector('.cb-open'), flow, actions)
  assert.ok(!flow.querySelector('.cb-menu')!.classList.contains('is-up'), 'room below: it opens downward')
}

// ---- The slide editor marks the places to fill in as the renderer does.
{
  const doc = loadSlide(SLIDE)
  const marks = fillPlaceDecorations(doc).find()
  const words = marks.map(mark => doc.textBetween(mark.from, mark.to))
  assert.deepEqual(words, ['[the report]', '[what the board wants to know]'])
  assert.equal(fillPlaceDecorations(loadSlide('```python\nx = a[0]\n```')).find().length, 0, 'never in a program')
  assert.equal(fillPlaceDecorations(loadSlide('Words [here] on the slide')).find().length, 0, 'only in a code block')
}

// ---- The published page's slides carry the same controls; `open-in: none` leaves out the ↗ there too.
{
  const here = path.dirname(fileURLToPath(import.meta.url))
  const slideCss = fs.readFileSync(path.join(here, '../slide/slide.css'), 'utf8')
  const assets = { slideCss, fonts: [] }
  const options = { digest: 'test', pictureUrl: () => null }
  const deckText = (front: string) => `---\ndeck: 2\nclient: Harbour\ntitle: Workbook${front}\n---\n\n${writeSlideBlock('', `---\nid: c1\n---\n${SLIDE}`)}\n\n## Plan the summary\n\nThe handout.\n`
  const on = pageHtml(publicDeck(deckText(''), { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME }), assets, options)
  assert.ok(on.includes('<pre class="cb"><span class="cb-tools">') && on.includes('class="cb-open"'), 'the page\'s slide has Copy and the ↗')
  assert.ok(on.includes('<mark class="cb-fill">[the report]</mark>'))
  const off = pageHtml(publicDeck(deckText('\nopen-in: none'), { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME }), assets, options)
  assert.ok(off.includes('class="cb-copy"') && !off.includes('class="cb-open"') && !off.includes('claude.ai'), 'open-in: none: no ↗ and no link anywhere')
}

console.log('slideCodeBlock: passed')

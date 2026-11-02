/**
 * Sprint 146, PR 3 (the controls' polish; the Experience lead's rules, 31 October):
 * - #576: one tooltip look, the workbench hover's, and no native `title` on a button;
 * - #566: a button too narrow for its first word shows its icon alone, switching once each way as the room changes;
 * - #614: an icon's colour class shows (every icon is drawn in currentColor; its tone has no specificity);
 * - #613: every column of the Task board keeps its header while the board scrolls;
 * - #615: the comment card follows the theme (pinned in theme/greenIsTheReadyDot.test.ts);
 * - the destructive button's words pass 4.5:1, and working is ink (RuntimeNotice's progress tone).
 *
 * Run: npx tsx webview/src/components/ui/controlsPolish.test.ts
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const React = await import('react')
;(globalThis as typeof globalThis & { React: typeof React }).React = React
Object.assign(globalThis, {
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const { parse } = await import('node-html-parser')
const { Icon } = await import('./Icon')
const { Button, firstWordCut, iconAndWords, splitFirstWord, wholeWordsTip } = await import('./button')
const { SplitButton } = await import('./split-button')
const { TOOLTIP_SURFACE } = await import('./tooltip')
const { RuntimeNotice } = await import('../ai-sidebar/RuntimeNotice')

const src = fileURLToPath(new URL('../..', import.meta.url))
const read = (path: string) => readFileSync(join(src, path), 'utf-8')
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '')
const css = withoutComments(read('index.css'))
const render = (element: ReturnType<typeof createElement>) => parse(renderToStaticMarkup(element))

// ── #614: an icon's colour ──
{
  const coloured = render(createElement(Icon, { name: 'warning', className: 'text-[var(--r-error)]' })).querySelector('svg')!
  assert.equal(coloured.getAttribute('fill'), 'currentColor', 'every icon is drawn in currentColor')
  assert.equal(coloured.getAttribute('data-icon-tone'), 'muted', 'its tone (muted by default) is named for the stylesheet')
  const inherited = render(createElement(Icon, { name: 'warning', tone: 'inherit' })).querySelector('svg')!
  assert.ok(!inherited.hasAttribute('data-icon-tone'), '`inherit` sets no tone: the parent colours it')
  for (const tone of ['muted', 'active', 'disabled']) {
    assert.match(css, new RegExp(`:where\\(svg\\[data-icon-tone="${tone}"\\]\\)\\s*\\{\\s*color:\\s*var\\(--r-`), `the ${tone} tone sets the colour with no specificity, so a colour class wins`)
  }
  // No rule for a tone outside :where(), which would outrank an icon's own class again
  const toneRules = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((match) => match[1].trim()).filter((selector) => selector.includes('data-icon-tone'))
  assert.ok(toneRules.length >= 4 && toneRules.every((selector) => selector.startsWith(':where(') && selector.endsWith(')')), `every tone rule is wrapped in :where(): ${toneRules.join(' | ')}`)
  // A menu's items give their icons their words' colour, as their `[&_svg]:fill-current` did while a tone was a fill
  assert.match(css, /:where\(\.rm-icons-take-ink svg\[data-icon-tone\]\)\s*\{\s*color:\s*inherit;/)
  for (const file of ['components/ui/dropdown-menu.tsx', 'components/ai-sidebar/ConversationsPanel.tsx', 'components/transcribe/TranscribePanel.tsx']) {
    for (const line of read(file).split('\n').filter((text) => text.includes('[&_svg]:fill-current'))) {
      assert.ok(line.includes('rm-icons-take-ink'), `${file}: a row whose icons take its words' colour carries rm-icons-take-ink`)
    }
  }
}

// ── #576: one tooltip look ──
{
  const classes = TOOLTIP_SURFACE.split(' ')
  for (const part of ['bg-surface', 'text-ink-strong', 'border', 'border-hairline', 'shadow-md', 'rounded-[5px]', 'px-2', 'py-0.5']) {
    assert.ok(classes.includes(part), `the tooltip is the theme's surface sheet: ${part}`)
  }
  assert.ok(!classes.some((part) => part.includes('ink-strong)]') || part === 'shadow-lg'), 'not the old ink tag')
  const tooltips: string[] = []
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
  const sources = walk(src)
  for (const path of sources) {
    const text = readFileSync(path, 'utf-8')
    if (/@radix-ui\/react-tooltip/.test(text)) tooltips.push(relative(src, path).split('\\').join('/'))
  }
  assert.deepEqual(tooltips.sort(), ['components/ai-sidebar/ConversationTooltip.tsx', 'components/ui/tooltip.tsx'], 'two Radix tooltips in the webview')
  for (const file of tooltips) {
    const text = read(file)
    assert.doesNotMatch(text, /\.Arrow\b/, `${file}: no arrow`)
    assert.match(text, /TOOLTIP_SURFACE/, `${file}: the one look`)
  }
  // A button's explanation is the shared Tooltip, never a native `title` (R5). The ones left say a cut text in full.
  const NATIVE_TITLE_ON_A_BUTTON_KEPT: Array<{ file: string; title: string; why: string }> = [
    { file: 'components/InlineTableOfContents.tsx', title: '{heading.text}', why: "a heading's whole words when the outline cuts them" },
    { file: 'components/MarginCommentRail.tsx', title: '{markerLabel}', why: "the marker's note: pointing at the marker opens the card with the whole note" },
    { file: 'components/ai-sidebar/ChatInput.tsx', title: '{runtimeFooterLabel}', why: "the AI picker's whole words when the message box's footer cuts them" },
    { file: 'components/DragHandleWithMenu.tsx', title: '"Add block"', why: 'nothing renders it (Editor.tsx draws the block plus itself)' },
  ]
  /** The JSX element a `title=` belongs to: back from it to the `<Tag` outside every `{…}`. */
  const ownerOf = (text: string, at: number) => {
    let depth = 0
    for (let i = at; i > 0; i--) {
      const char = text[i]
      if (char === '}') depth++
      else if (char === '{') { if (depth === 0) return null; depth-- }
      else if (char === '<' && depth === 0 && /[A-Za-z]/.test(text[i + 1])) return (text.slice(i + 1).match(/^[\w.]+/) ?? [''])[0]
    }
    return null
  }
  const found: string[] = []
  let seen = 0
  for (const path of sources.filter((file) => file.endsWith('.tsx'))) {
    const text = readFileSync(path, 'utf-8')
    const file = relative(src, path).split('\\').join('/')
    for (const match of text.matchAll(/\btitle=[{"]/g)) {
      if (!['button', 'Button', 'SelectTrigger'].includes(ownerOf(text, match.index!) ?? '')) continue
      const kept = NATIVE_TITLE_ON_A_BUTTON_KEPT.find((entry) => entry.file === file && text.startsWith(`title=${entry.title}`, match.index))
      if (kept) seen++
      else found.push(`${file}:${text.slice(0, match.index).split('\n').length}`)
    }
  }
  assert.deepEqual(found, [], 'a button with a native title')
  // A Tooltip is a plain component: right under a Radix `asChild` trigger it would take the trigger's handlers and ref
  // and drop them (the effort control's popover stopped opening in this PR's first build). It goes outside the trigger.
  const swallowed = sources.filter((path) => path.endsWith('.tsx') && /\basChild\b[^>]*>\s*<Tooltip\b/.test(readFileSync(path, 'utf-8')))
  assert.deepEqual(swallowed.map((path) => relative(src, path)), [], 'a Tooltip directly under an asChild trigger')
  assert.equal(seen, NATIVE_TITLE_ON_A_BUTTON_KEPT.length, 'each title kept is still there, so the list holds no stale entry')
  // The editor's own buttons outside React draw the same look with CSS
  const editor = read('components/Editor.tsx')
  assert.match(editor, /plusButton\.dataset\.tooltip = 'Add block'/)
  assert.doesNotMatch(editor, /plusButton\.title =/)
  assert.match(editor, /\.block-plus-btn::after \{[^}]*background: var\(--r-surface\) !important;[^}]*color: var\(--r-ink-strong\) !important;[^}]*border: 1px solid var\(--r-hairline\) !important;/)
}

// ── #566: a button too narrow for its first word ──
{
  assert.equal(firstWordCut({ right: 100 }, { right: 100 }), false, 'the first word fits exactly')
  assert.equal(firstWordCut({ right: 100 }, { right: 101 }), true, 'one pixel over: cut')
  // The catalogue's first build: the word's box fitted, yet the ellipsis took its last letters ("A…")
  assert.equal(firstWordCut({ right: 430 }, { right: 429.5 }, 9), true, 'the first word fits only with the ellipsis after it')
  assert.equal(firstWordCut({ right: 430 }, { right: 429.5 }, 0), false, 'words that fit draw no ellipsis')
  // R6: measured with the words drawn, the answer is the room's alone, so a room that shrinks and grows step by step
  // switches once each way, never back and forth
  const labelLeft = 40
  const firstWord = 25
  const rooms = [...Array.from({ length: 61 }, (_, i) => 60 - i), ...Array.from({ length: 61 }, (_, i) => i)]
  const shown = rooms.map((room) => firstWordCut({ right: labelLeft + room }, { right: labelLeft + firstWord }, 9))
  const switches = shown.filter((iconOnly, i) => i > 0 && iconOnly !== shown[i - 1]).length
  assert.equal(switches, 2, 'one switch each way')
  assert.deepEqual(splitFirstWord('Ask Claude what is here'), ['Ask', ' Claude what is here'])
  assert.deepEqual(splitFirstWord('Starting…'), ['Starting…', ''])

  // The split button's main part with an icon and words: the words in two parts, the first apart
  const split = render(createElement(SplitButton, {
    main: { label: 'Ask Claude', icon: createElement(Icon, { name: 'chat-circle', size: 14, tone: 'inherit' }), tooltip: 'Ask Claude what is here', onClick: () => {} },
    menu: { label: 'Ask with', tooltip: 'Choose which AI asks', content: null },
  }))
  const main = split.querySelector('.rm-split-main')!
  const label = main.querySelector('[data-slot="button-label"]')
  assert.ok(label, 'the words are the button label')
  assert.equal(label!.querySelector('[data-slot="first-word"]')!.text, 'Ask')
  assert.equal(label!.text, 'Ask Claude', 'the whole words stay in the button: its accessible name')
  assert.ok(main.getAttribute('class')!.split(' ').includes('min-w-0') && main.getAttribute('class')!.split(' ').includes('shrink'), 'it may shrink to its room')
  // Words that aren't text keep today's cut; a button with only words too
  const component = render(createElement(SplitButton, {
    main: { label: createElement('span', null, 'Open in Excel'), icon: createElement(Icon, { name: 'arrow-square-out' }), tooltip: 'Open it in Excel', onClick: () => {} },
    menu: { label: 'Open in another app', tooltip: 'Open in another app', content: null },
  }))
  assert.ok(!component.querySelector('[data-slot="button-label"]'), 'a component label keeps its cut')
  // Anything after the words keeps the children as they are, in their order (a shortcut, a badge)
  assert.equal(iconAndWords([createElement(Icon, { name: 'copy', key: 'i' }), 'Open', createElement('kbd', { key: 'k' }, '⌘O')]), null)
  assert.ok(iconAndWords([createElement(Icon, { name: 'copy', key: 'i' }), 'Open']), 'an icon, then words')
  const wordsOnly = render(createElement(Button, { iconWhenNarrow: true }, 'Share'))
  assert.ok(!wordsOnly.querySelector('[data-slot="button-label"]'), 'a button with only words keeps its cut')
  // The tooltip starts with the whole words
  const tip = render(createElement('div', null, wholeWordsTip('Change image', "Choose a picture for this project's cover")))
  assert.deepEqual(tip.querySelectorAll('span').map((span) => span.text), ['Change image', "Choose a picture for this project's cover"])
  assert.equal(wholeWordsTip('Copy', 'Copy'), 'Copy', 'no second line that repeats the words')
  // The icon-only look: the size's square, the words out of sight
  assert.match(css, /button\[data-slot="button"\]\[data-icon-only\]\s*\{[^}]*aspect-ratio:\s*1 \/ 1;[^}]*padding-left:\s*0;/)
  assert.match(css, /button\[data-slot="button"\]\[data-icon-only\] > \[data-slot="button-label"\]\s*\{[^}]*position:\s*absolute;[^}]*clip:/)
  // Home's Change image is on the shared rule, not a rule of its own
  const home = withoutComments(read('components/home/home.css'))
  assert.doesNotMatch(home, /rh-chip-label/, "Home's own rule for Change image is gone")
  assert.match(read('components/home/HomePage.tsx'), /<Button className="rh-chip-button" iconWhenNarrow /)
}

// ── #613: the Task board's columns ──
{
  const tasks = withoutComments(read('components/tasks/tasks.css'))
  assert.match(tasks, /\.tb-cols\s*\{[^}]*align-items:\s*stretch;/, 'every column is as tall as the tallest, so its header stays while the board scrolls')
  assert.match(tasks, /\.tb-colhead\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/, "a column's header sticks to the board's top")
}

// ── The destructive button: 4.5:1, and a hover that darkens ──
{
  const hex = (css.match(/--destructive:\s*(#[0-9a-f]{6});/i) ?? [])[1]
  assert.ok(hex, 'the destructive fill is one token')
  const luminance = (value: string) => {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (1.05) / (luminance(hex!) + 0.05)
  assert.ok(ratio >= 4.5, `white words on the destructive fill are ${ratio.toFixed(2)}:1`)
  const hover = (css.match(/--destructive-hover:\s*(#[0-9a-f]{6});/i) ?? [])[1]
  assert.ok(hover && luminance(hover) < luminance(hex!), 'its hover is darker')
  for (const file of ['components/ui/button.tsx', 'components/ui/dialog.tsx']) {
    const text = read(file)
    assert.match(text, /bg-destructive text-white hover:bg-destructive-hover/, `${file}: the hover darkens`)
    assert.doesNotMatch(text, /bg-destructive text-white hover:opacity-90/, `${file}: no fade to 90%`)
  }
}

// ── Working is ink: RuntimeNotice's progress tone ──
{
  const notice = render(createElement(RuntimeNotice, { title: 'Checking Claude', message: 'This takes a moment.', tone: 'progress', statusLabel: 'Checking…' }))
  const chip = notice.querySelectorAll('span').find((span) => span.querySelector(':scope > svg'))!
  assert.match(chip.getAttribute('style') ?? '', /color:var\(--r-ink-strong\)/, 'the turning mark is ink')
  assert.doesNotMatch(notice.toString(), /--r-accent/, 'no indigo on a working notice')
}

console.log('controlsPolish: one tooltip look, icons that take their colour, buttons that show their icon when narrow, the board\'s headers, the destructive red, working in ink')

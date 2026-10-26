/**
 * The as-written attributes and rules, one by one (Sprint 137, R1–R4, R6, R8).
 * Run with `npx tsx webview/src/utils/markdownAsWritten.test.ts`.
 *
 * The corpus test (`markdownFidelity.test.ts`) proves whole files come back as
 * written. This file pins the pieces: what the parse records, what a rule
 * writes without an attribute (new writing, R8), the escapes, and which link
 * addresses the editor keeps.
 */
import { strict as assert } from 'node:assert'
import type { Node as PMNode } from '@tiptap/pm/model'
import { createEditorTurndownService, isAllowedLinkUri, markdownToEditorHTML } from './editorMarkdown'
import { escapeLineStart, escapeTextRun, wrapMarked } from './markdownAsWritten'
import { editorMarkdown, fidelitySchema, installTestDocument, openDocument, saveDocument } from './markdownFidelity'
import { createTurndownService } from './turndownService'

installTestDocument()
const schema = fidelitySchema()
const n = schema.nodes
const p = (text = '') => n.paragraph.create(null, text ? schema.text(text) : null)
const li = (...content: PMNode[]) => n.listItem.create(null, content)
const doc = (...content: PMNode[]) => n.doc.create(null, content)
const roundTrip = (markdown: string) => saveDocument(openDocument(markdown))

// ---- the parse records how a block was written ----
{
  const html = markdownToEditorHTML('Intro:\n* one\n* two\n\n1) a\n2) b')
  assert.match(html, /<ul data-md-marker="\*" data-md-pad="1" data-md-tight="true">/, 'a `*` list under a line')
  assert.match(html, /<ol data-md-delim="\)" data-md-pad="1">/, 'a `)` list')
  assert.match(html, /<li data-md-gap="false" data-md-inner="">one<\/li>/, 'a tight item')
  assert.match(markdownToEditorHTML('a\nb'), /<br data-md-break="soft">/, 'a soft break')
  assert.match(markdownToEditorHTML('a  \nb'), /<br data-md-break="spaces-2">/, 'a two-space break')
  assert.match(markdownToEditorHTML('a\\\nb'), /<br data-md-break="backslash">/, 'a backslash break')
  assert.match(markdownToEditorHTML('a\n\n* * *\n\nb'), /<hr data-md-hr="\* \* \*">/, 'a thematic break')
  assert.match(markdownToEditorHTML('See https://x.test'), /<a data-md-link="bare" href="https:\/\/x.test">/, 'a bare address')
  assert.match(markdownToEditorHTML('```\nx\n```'), /<pre data-md-info="none">/, 'a fence with no info string')
  assert.match(markdownToEditorHTML('|a|b|\n|:-|-:|\n|1|2|'), /data-md-delims="\|:-\|-:\|" data-md-spacing="compact"/, 'a table')
  assert.match(markdownToEditorHTML('- a\n\t- b'), /data-md-tabs="true"/, 'tab-indented nesting')
  assert.match(markdownToEditorHTML('```\n\tx\n```'), /<code>\tx\n<\/code>/, 'a tab in a fence stays a tab')
}

// ---- R1: lists as written ----
for (const markdown of [
  '- first item\n- second item',
  '* one\n* two',
  '+ one\n+ two',
  '1) one\n2) two',
  '-   padded\n-   item',
  '5. five\n6. six',
  '- a\n\n- b\n\n- c',
  '- a\n  - b\n\n- c',
  '1. a\n   - b\n2. c',
  '- a\n    - b',
  '- a\n\t- b\n\t\t- c',
  'Attendees:\n- Mari\n- Jaan',
  '- [x] done\n- plain\n- [ ] open',
  '- [ ] Call the client\n  about Friday',
  '- [ ]\n- [x]',
  '- item\n  ```\n  code\n  ```\n  more',
  '- text\n\n  second paragraph',
]) {
  assert.equal(roundTrip(markdown), `${markdown}\n`, `as written: ${JSON.stringify(markdown)}`)
}

// ---- R8: new writing in one plain form ----
{
  // S34: `- milk`, Enter, `eggs`, Tab, `brown`.
  const typed = doc(n.bulletList.create(null, [li(p('milk')), li(p('eggs'), n.bulletList.create(null, [li(p('brown'))]))]))
  assert.equal(editorMarkdown(typed), '- milk\n- eggs\n  - brown', 'a new list: `- `, tight, nested at the content column')
  const numbered = doc(n.orderedList.create(null, [li(p('one'), n.bulletList.create(null, [li(p('sub'))])), li(p('two'))]))
  assert.equal(editorMarkdown(numbered), '1. one\n   - sub\n2. two', 'a new numbered list nests at three spaces')
  const twoParagraphs = doc(n.bulletList.create(null, [li(p('a'), p('more')), li(p('b'))]))
  assert.equal(editorMarkdown(twoParagraphs), '- a\n\n  more\n\n- b', 'loose only when an item holds two paragraphs')
  const empty = doc(n.bulletList.create(null, [li(p('a')), li(p())]))
  assert.equal(editorMarkdown(empty), '- a\n-', 'an empty item is its marker, no trailing space')

  // S35: a new item in a list written `*   one`.
  const opened = openDocument('*   one\n*   two\n')
  const list = opened.doc.firstChild!
  const withNew = opened.doc.copy(opened.doc.content.replaceChild(0, list.copy(list.content.addToEnd(li(p('three'))))))
  assert.equal(saveDocument(opened, withNew), '*   one\n*   two\n*   three\n', 'a new item follows its list')

  assert.equal(editorMarkdown(doc(p('a'), n.horizontalRule.create(), p('b'))), 'a\n\n---\n\nb', 'a new thematic break is `---`')
  assert.equal(editorMarkdown(doc(n.horizontalRule.create(), p('b'))), '***\n\nb', 'at the very top it is `***`, which cannot read as front matter')
  // S12: Shift+Enter (decision 3).
  const lines = doc(n.paragraph.create(null, [schema.text('Line one'), n.hardBreak.create(), schema.text('Line two')]))
  assert.equal(editorMarkdown(lines), 'Line one\\\nLine two', 'a typed line break is a backslash, no trailing spaces')
  const trailing = doc(n.paragraph.create(null, [schema.text('end'), n.hardBreak.create()]))
  assert.equal(editorMarkdown(trailing), 'end', 'a break with nothing after it writes nothing')
  const task = doc(n.taskList.create(null, [n.taskItem.create({ checked: false }, [p('write')])]))
  assert.equal(editorMarkdown(task), '- [ ] write', 'a new task')
}

// ---- R2, R4: breaks, quotes, addresses, escapes ----
{
  assert.equal(roundTrip('> one\n>\n> two'), '> one\n>\n> two\n', 'an empty quote line is `>` alone')
  assert.equal(roundTrip('Office 4  \nTallinn'), 'Office 4  \nTallinn\n', 'two-space breaks stay')
  assert.equal(roundTrip('Office 4\\\nTallinn'), 'Office 4\\\nTallinn\n', 'backslash breaks stay')
  assert.equal(roundTrip('one\n2. not a list'), 'one\n2. not a list\n', 'a number after a soft break that cannot start a list stays bare')
  assert.equal(roundTrip('one\n1. a list'), 'one\n1. a list\n', 'and a list that interrupts the line stays a list under it')
  const html = createEditorTurndownService()
  assert.equal(html.turndown('<p><a data-md-link="bare" href="https://x.test">the site</a></p>'), '[the site](https://x.test)', 'an address whose text was edited is written inline')
  assert.equal(html.turndown('<p><a data-md-link="angle" href="mailto:a@b.test">a@b.test</a></p>'), '<a@b.test>', 'an angle address stays one')
}
assert.equal(escapeTextRun('snake_case and _x_'), 'snake_case and \\_x\\_', 'an underscore inside a word stays bare')
assert.equal(escapeTextRun('See [1] and [[Note]]'), 'See [1] and [[Note]]', 'brackets that open no link stay bare')
assert.equal(escapeTextRun('[a](b) and [x]: y'), '\\[a](b) and \\[x]: y', 'brackets that would open a link or a definition are escaped')
assert.equal(escapeTextRun('C:\\Users\\me'), 'C:\\Users\\me', 'a backslash before a letter is literal')
assert.equal(escapeTextRun('a\\*b and end\\'), 'a\\\\\\*b and end\\\\', 'a backslash before punctuation or at the end is escaped')
assert.equal(escapeTextRun('Promise<string> and a < b'), 'Promise\\<string> and a < b', 'a `<` that would open a tag is escaped')
assert.equal(escapeTextRun('*x* and `y`'), '\\*x\\* and \\`y\\`', 'asterisks and backticks keep their escapes')
assert.equal(escapeLineStart('1. x', true), '1\\. x', 'a number opens a list at a block start')
assert.equal(escapeLineStart('2. x', false), '2. x', 'but cannot interrupt a paragraph unless it is 1')
assert.equal(escapeLineStart('1. x', false), '1\\. x', 'and 1 can')
assert.equal(escapeLineStart('- x', false), '\\- x', 'a bullet can interrupt a paragraph')
assert.equal(escapeLineStart('-5 degrees', true), '-5 degrees', 'a dash with no space is no bullet')
assert.equal(escapeLineStart('# x', true), '\\# x', 'a heading')
assert.equal(escapeLineStart('#270 is fixed', true), '#270 is fixed', 'an issue number is no heading')
assert.equal(escapeLineStart('> q', true), '\\> q', 'a quote')
assert.equal(escapeLineStart('---', false), '\\---', 'a setext underline or rule')
assert.equal(wrapMarked('\\\nbold\\\n', '**'), '\\\n**bold**\\\n', 'line breaks stay outside a mark')
assert.equal(wrapMarked('\\\n', '**'), '\\\n', 'a mark around a break alone writes nothing')

// ---- R4: tables ----
{
  assert.equal(roundTrip('| Name | Qty |\n|:---|---:|\n| x | |'), '| Name | Qty |\n|:---|---:|\n| x | |\n', 'delimiter row, alignment, spacing and an empty cell')
  // S22: a column added keeps the old alignments; the new one is `---`.
  const opened = openDocument('| Name | Qty |\n|:---|---:|\n| x | 1 |\n')
  const table = opened.doc.firstChild!
  const rows: PMNode[] = []
  table.forEach((row, _offset, index) => {
    const cell = index === 0 ? n.tableHeader : n.tableCell
    rows.push(row.copy(row.content.addToEnd(cell.create(null, p(index === 0 ? 'Note' : 'new')))))
  })
  const widened = opened.doc.copy(opened.doc.content.replaceChild(0, table.type.create(table.attrs, rows)))
  assert.equal(saveDocument(opened, widened), '| Name | Qty | Note |\n| :--- | ---: | --- |\n| x | 1 | new |\n', 'a new column gets `---`, old columns keep their alignment')
}

// ---- R6: link addresses ----
const defaultValidate = (url: string) => /^(https?:|mailto:|[^a-z]|[a-z0-9+.-]+(?:[^a-z+.\-:]|$))/i.test(url)
for (const url of ['notes/report.md', '../shared/brief.md', './a.md', 'a.md', '#section', 'https://example.com', 'mailto:a@b.test', 'docs/CHANGELOG.md']) {
  assert.equal(isAllowedLinkUri(url, defaultValidate), true, `kept: ${url}`)
}
for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/hosts', 'vbscript:x', 'JavaScript:alert(1)']) {
  assert.equal(isAllowedLinkUri(url, defaultValidate), false, `refused: ${url}`)
}
{
  const opened = openDocument('[x](javascript:alert(1)) and [y](data:text/html,hi) and [z](file:///etc/hosts)\n')
  let links = 0
  opened.doc.descendants(node => {
    if (node.marks.some(mark => mark.type.name === 'link')) links++
  })
  assert.equal(links, 0, 'S31: dangerous addresses are no links in the editor')
}

// ---- R8: Save as Markdown and Copy as Markdown use the same forms ----
{
  const word = createTurndownService().turndown('<ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li>first</li><li>second</li></ol><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td><p>1</p></td><td></td></tr></tbody></table>')
  assert.equal(word, '- one\n- two\n\n1. first\n2. second\n\n| a | b |\n| --- | --- |\n| 1 | |', 'S36: tight `- item` and `1. item`, a `| --- |` table, no trailing spaces')
}

console.log('markdownAsWritten.test.ts — all assertions passed')

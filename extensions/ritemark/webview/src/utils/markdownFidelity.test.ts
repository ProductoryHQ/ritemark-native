/**
 * The corpus is the bar (Sprint 137, R9). Run with
 * `npx tsx webview/src/utils/markdownFidelity.test.ts` (part of `test:editor-sync`).
 *
 * Every file in `fidelity-corpus/` goes through what the app does when a person
 * opens a document and saves it (`markdownFidelity.ts`: the host's front matter
 * split and join, the editor's own load, schema and save code):
 *
 *  - kept/:    back byte for byte after one save and after a second; typing one
 *              word at the end of the last paragraph changes exactly that line;
 *              a CRLF file and a file with a byte order mark keep both;
 *  - known/:   forms outside the bound (spec, Non-Requirements): the output is
 *              pinned in `name.expected.md`, a second save changes nothing, and
 *              no text, link, mark or image is lost, apart from the losses
 *              listed in `known/losses.json` (each skips only the check for
 *              what it names: `links`, `images`, `text` or `marks`);
 *  - cleanup/: files Ritemark 2.0.1 saved: the one-time cleanup (decision 4) is
 *              pinned in `name.expected.md`, and a second save changes nothing;
 *  - the look: every file opens to the same document as on `main` before the
 *              sprint (`look-baseline.json`, the as-written attributes taken
 *              away), apart from the exceptions listed here by file and block;
 *  - R3: no save adds whitespace at the end of a line outside fenced code.
 *
 * Set UPDATE_FIDELITY_EXPECTED=1 to rewrite the known and cleanup outputs after
 * a deliberate change; review the diff before committing it.
 */
import { strict as assert } from 'node:assert'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  encodeLikeTheFile,
  inventory,
  look,
  openDocument,
  saveDocument,
  sourceInventory,
  trailingWhitespaceLines,
  typeAtEndOfLastParagraph,
} from './markdownFidelity'

const corpus = (path: string): string => fileURLToPath(new URL(`./fidelity-corpus/${path}`, import.meta.url))
const markdownFiles = (set: string): string[] =>
  readdirSync(corpus(set)).filter(name => name.endsWith('.md') && !name.endsWith('.expected.md')).sort()
const update = process.env.UPDATE_FIDELITY_EXPECTED === '1'

/** The document's text as VS Code reads it: the byte order mark is the encoding's, not text. */
function readAsTheHostDoes(path: string): { text: string; bom: boolean; crlf: boolean } {
  const raw = readFileSync(path, 'utf8')
  const bom = raw.startsWith('\uFEFF')
  const text = bom ? raw.slice(1) : raw
  return { text, bom, crlf: text.includes('\r\n') }
}

/** Open, save, and write the bytes back as the coordinator does: the document's line endings and BOM. */
function openAndSaveFile(text: string, crlf: boolean, bom: boolean): string {
  return encodeLikeTheFile(saveDocument(openDocument(text)), crlf, bom)
}

function changedLines(before: string, after: string): { removed: string[]; added: string[] } {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--
    endB--
  }
  return { removed: a.slice(start, endA + 1), added: b.slice(start, endB + 1) }
}

type Loss = 'links' | 'images' | 'text' | 'marks'

/** A listed loss skips only its own check; what is kept of it must still come from the file. */
function assertNothingLost(name: string, original: string, saved: string, allowed?: Loss): void {
  const before = openDocument(original)
  const after = openDocument(saved)
  const source = sourceInventory(original)
  const kept = inventory(after.doc)
  if (allowed === 'links') {
    for (const link of kept.links) assert.ok(source.links.includes(link), `${name}: a link kept is one the file holds: ${link}`)
  } else {
    assert.deepEqual(kept.links, source.links, `${name}: every link the file holds survives two saves`)
  }
  if (allowed === 'images') {
    for (const image of kept.images) assert.ok(source.images.includes(image), `${name}: an image kept is one the file holds: ${image}`)
  } else {
    assert.deepEqual(kept.images, source.images, `${name}: every image survives two saves`)
  }
  if (allowed !== 'text') assert.equal(kept.text, inventory(before.doc).text, `${name}: the text survives two saves`)
  if (allowed !== 'marks') assert.deepEqual(kept.marks, inventory(before.doc).marks, `${name}: every mark survives two saves`)
}

let checked = 0

// ---- kept: byte for byte, twice, and the one-word edit ----
for (const name of markdownFiles('kept')) {
  const { text, bom, crlf } = readAsTheHostDoes(corpus(`kept/${name}`))
  const bytes = (bom ? '\uFEFF' : '') + text
  const once = openAndSaveFile(text, crlf, bom)
  assert.equal(once, bytes, `kept/${name}: byte-identical after one open and save`)
  const twice = openAndSaveFile(once.replace(/^\uFEFF/, ''), crlf, bom)
  assert.equal(twice, bytes, `kept/${name}: byte-identical after a second save`)

  const logical = text.replace(/\r\n/g, '\n')
  const opened = openDocument(logical)
  const edited = typeAtEndOfLastParagraph(opened.doc, ' EDITED')
  if (edited) {
    const saved = saveDocument(opened, edited)
    const { removed, added } = changedLines(logical, saved)
    assert.equal(removed.length, 1, `kept/${name}: the one-word edit changes one line, got ${JSON.stringify({ removed, added })}`)
    assert.equal(added.length, 1, `kept/${name}: the one-word edit changes one line, got ${JSON.stringify({ removed, added })}`)
    // The word takes the marks of the text it is typed after (an italic last
    // line stays italic), so the line differs by the word alone.
    assert.equal(added[0].replace(' EDITED', ''), removed[0], `kept/${name}: and only by the word typed`)
  }
  assertNothingLost(`kept/${name}`, logical, saveDocument(openDocument(saveDocument(opened))))
  checked++
}

// ---- known: pinned output, stable, nothing lost ----
const losses = JSON.parse(readFileSync(corpus('known/losses.json'), 'utf8')) as Record<string, { lost: Loss; why: string }>
for (const name of markdownFiles('known')) {
  const { text } = readAsTheHostDoes(corpus(`known/${name}`))
  const once = saveDocument(openDocument(text))
  const expectedPath = corpus(`known/${name.replace(/\.md$/, '.expected.md')}`)
  if (update) writeFileSync(expectedPath, once)
  assert.equal(once, readFileSync(expectedPath, 'utf8'), `known/${name}: the output is the pinned one`)
  assert.equal(saveDocument(openDocument(once)), once, `known/${name}: a second save changes nothing`)
  assertNothingLost(`known/${name}`, text, saveDocument(openDocument(once)), losses[name]?.lost)
  checked++
}
for (const [name, loss] of Object.entries(losses)) {
  assert.ok(markdownFiles('known').includes(name), `known/losses.json names a file in known/: ${name}`)
  assert.ok(['links', 'images', 'text', 'marks'].includes(loss.lost), `known/losses.json: ${name} names what is lost`)
}

// ---- cleanup: what 2.0.1 wrote, cleaned once ----
for (const name of markdownFiles('cleanup')) {
  const { text } = readAsTheHostDoes(corpus(`cleanup/${name}`))
  const once = saveDocument(openDocument(text))
  const expectedPath = corpus(`cleanup/${name.replace(/\.md$/, '.expected.md')}`)
  if (update) writeFileSync(expectedPath, once)
  assert.equal(once, readFileSync(expectedPath, 'utf8'), `cleanup/${name}: the one-time cleanup is the pinned one`)
  assert.equal(saveDocument(openDocument(once)), once, `cleanup/${name}: a second save changes nothing`)
  assert.deepEqual(trailingWhitespaceLines(once), [], `cleanup/${name}: the spaces on blank lines are gone`)
  assertNothingLost(`cleanup/${name}`, text, saveDocument(openDocument(once)))
  checked++
}

// ---- R3: a save adds no whitespace at the end of a line ----
for (const set of ['kept', 'known', 'cleanup']) {
  for (const name of markdownFiles(set)) {
    const { text } = readAsTheHostDoes(corpus(`${set}/${name}`))
    const logical = text.replace(/\r\n/g, '\n')
    const saved = saveDocument(openDocument(logical))
    const before = new Set(trailingWhitespaceLines(logical).map(line => logical.split('\n')[line - 1]))
    for (const line of trailingWhitespaceLines(saved)) {
      assert.ok(before.has(saved.split('\n')[line - 1]), `${set}/${name}: line ${line} ends in whitespace the source did not have`)
    }
  }
}

// ---- negative fixtures: what must stay escaped did not turn into formatting ----
{
  const { text } = readAsTheHostDoes(corpus('kept/escapes-negative.md'))
  const reopened = openDocument(saveDocument(openDocument(text))).doc
  const types: string[] = []
  const marks: string[] = []
  reopened.descendants(node => {
    types.push(node.type.name)
    for (const mark of node.marks) marks.push(mark.type.name)
    return true
  })
  assert.equal(types.filter(type => type === 'heading').length, 1, 'escapes: `\\# not a heading` is not a heading (only the title is)')
  assert.equal(types.includes('orderedList'), false, 'escapes: `1\\. not a list` is not a list')
  assert.equal(types.includes('taskItem'), false, 'escapes: `- \\[ ] not a task` is not a task')
  assert.equal(marks.includes('italic'), false, 'escapes: `\\*not italic\\*` is not italic')
  assert.equal(reopened.textContent.includes('[x]: not a definition'), true, 'escapes: `\\[x]: …` stays text, not a definition')
}

// ---- the look: the same document as on main, apart from these ----
/**
 * Where the editor now shows what the file holds and `main` did not (R6, R3),
 * by file and top-level block index.
 */
const LOOK_EXCEPTIONS: Record<string, { blocks: number[]; why: string }> = {
  'kept/links.md': { blocks: [1, 3, 4, 5], why: 'R6: the links into folders, the link around code and the marks around code now show' },
  'kept/github-readme.md': { blocks: [16], why: 'R6: the link into a folder (docs/CHANGELOG.md) now shows' },
  'kept/code-spaces.md': { blocks: [1], why: 'R3: a tab in fenced code is a tab, not four spaces' },
  // Sprint 138 (#481): every block but the title holds an equation or a `\$`.
  // Its baseline is Sprint 137's tip, which opens it as main does (text).
  'kept/equations.md': { blocks: [1, 2, 3, 4, 5, 6, 7], why: 'Sprint 138: equations open as equations, `\\$` as a dollar' },
  // Sprint 138: each list (and the quote holding one) has an equation in an item.
  'kept/equations-in-lists.md': { blocks: [2, 4, 6, 8, 10, 12, 14, 16], why: 'Sprint 138: equations in list items open as equations' },
}

function differingBlocks(baseline: { json: unknown }, current: { json: unknown }): number[] {
  const a = ((baseline.json as { content?: unknown[] }).content ?? [])
  const b = ((current.json as { content?: unknown[] }).content ?? [])
  const differing: number[] = []
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (JSON.stringify(a[index]) !== JSON.stringify(b[index])) differing.push(index)
  }
  return differing
}

{
  const baseline = JSON.parse(readFileSync(corpus('look-baseline.json'), 'utf8')) as Record<string, { json: unknown; html: string }>
  for (const set of ['kept', 'known', 'cleanup']) {
    for (const name of markdownFiles(set)) {
      const key = `${set}/${name}`
      const { text } = readAsTheHostDoes(corpus(key))
      const current = look(openDocument(text).doc)
      assert.ok(baseline[key], `${key}: has a look baseline from main`)
      const differing = differingBlocks(baseline[key], current)
      const exception = LOOK_EXCEPTIONS[key]
      assert.deepEqual(differing, exception?.blocks ?? [], `${key}: opens as on main${exception ? ` apart from ${exception.why}` : ''}`)
      if (!exception) assert.equal(current.html, baseline[key].html, `${key}: the editor's HTML is main's, attributes aside`)
    }
  }
  for (const key of Object.keys(LOOK_EXCEPTIONS)) assert.ok(baseline[key], `a look exception names a corpus file: ${key}`)
}

console.log(`markdownFidelity.test.ts — ${checked} corpus files, all assertions passed`)

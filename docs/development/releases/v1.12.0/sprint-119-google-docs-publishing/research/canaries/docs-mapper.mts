// Sprint 119 Phase 0 canary — native Google Docs mapper, second pass.
//
// Answers the question the other canaries left open: is a faithful
// Markdown -> Docs API mapper tractable? It reuses Ritemark's real export
// chokepoint (buildNormalizedExportHtml), so comment stripping and unsafe
// markup removal are the product's, not this script's.
//
// The index discipline that makes it work:
//   1. one insertText for the whole body, with a placeholder line where a
//      table or an image belongs, and no tab characters anywhere
//   2. styling only — paragraph styles, text styles, bullets — none of which
//      changes the document's length, so every offset stays valid
//   3. list nesting, applied from a fresh read
//   4. tables and images, located by their placeholders in a fresh read and
//      applied last-first so no insert invalidates an earlier index
//
// Research only. Prints a plan summary, never tokens.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const EXT = '/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.claude/worktrees/sprint-119-google-docs-publishing/extensions/ritemark'
const { marked } = await import(`${EXT}/node_modules/marked/lib/marked.esm.js`)
const { parse } = await import(`${EXT}/node_modules/node-html-parser/dist/index.js`)
const { buildNormalizedExportHtml } = await import(`${EXT}/src/export/v2/htmlPipeline.ts`)

const token = () => JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8')).access_token
const DOC_MIME = 'application/vnd.google-apps.document'
const MONO = 'Roboto Mono'
const INDENT_PT = 18

type Run = { start: number; end: number; bold?: boolean; italic?: boolean; code?: boolean; link?: string }
type Block = {
  kind: 'heading' | 'paragraph' | 'listItem' | 'code' | 'quote' | 'rule' | 'table' | 'image'
  text: string
  level?: number
  ordered?: boolean
  checkbox?: 'none' | 'unchecked' | 'checked'
  runs: Run[]
  rows?: string[][]
  src?: string
  alt?: string
}

// node-html-parser returns text with entities still encoded. Ritemark's own
// exporters read it raw, which is the defect recorded in integration-decisions.md.
function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}
const textOf = (node: any): string => decode(node.textContent ?? node.text ?? '')

function inlineRuns(node: any, out: { text: string; runs: Run[] }, inherited: Partial<Run> = {}) {
  for (const child of node.childNodes ?? []) {
    const tag = (child.rawTagName || '').toLowerCase()
    if (child.nodeType === 3) {
      const t = decode(child.rawText ?? '')
      if (!t) continue
      const start = out.text.length
      out.text += t
      if (inherited.bold || inherited.italic || inherited.code || inherited.link) {
        out.runs.push({ start, end: out.text.length, ...inherited })
      }
      continue
    }
    if (tag === 'br') { out.text += ''; continue }
    const next: Partial<Run> = { ...inherited }
    if (tag === 'strong' || tag === 'b') next.bold = true
    if (tag === 'em' || tag === 'i') next.italic = true
    if (tag === 'code') next.code = true
    if (tag === 'a') next.link = child.getAttribute('href') || undefined
    inlineRuns(child, out, next)
  }
}

function blockFrom(node: any, depth = 0): Block[] {
  const tag = (node.rawTagName || '').toLowerCase()
  const collect = () => {
    const acc = { text: '', runs: [] as Run[] }
    inlineRuns(node, acc)
    return acc
  }

  if (/^h[1-6]$/.test(tag)) {
    const { text, runs } = collect()
    return [{ kind: 'heading', level: Number(tag[1]), text, runs }]
  }
  if (tag === 'p') {
    const img = node.querySelector('img')
    if (img && !textOf(node).trim()) {
      return [{ kind: 'image', text: '', runs: [], src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '' }]
    }
    const { text, runs } = collect()
    return [{ kind: 'paragraph', text, runs }]
  }
  if (tag === 'pre') {
    // Take the inner <code>'s text, never the <pre>'s raw markup, or the tag
    // itself lands in the published document.
    // node-html-parser treats <pre> as a raw-text element, so querySelector
    // finds no <code> child and textContent still carries the tag. Strip it.
    const codeEl = node.querySelector('code')
    const raw = codeEl ? (codeEl.textContent ?? '') : (node.textContent ?? '')
    const body = decode(raw.replace(/^\s*<code[^>]*>/i, '').replace(/<\/code>\s*$/i, ''))
    return body.split('\n').filter((line, i, all) => line.trim() || (i > 0 && i < all.length - 1))
      .map((line) => ({ kind: 'code' as const, text: line, runs: [] }))
  }
  if (tag === 'blockquote') {
    const out: Block[] = []
    for (const child of node.childNodes ?? []) {
      for (const b of blockFrom(child, depth + 1)) out.push({ ...b, kind: 'quote', level: b.level ?? depth + 1 })
    }
    return out.filter((b) => b.text.trim())
  }
  if (tag === 'hr') return [{ kind: 'rule', text: '', runs: [] }]
  if (tag === 'ul' || tag === 'ol') {
    const out: Block[] = []
    for (const li of node.childNodes ?? []) {
      if ((li.rawTagName || '').toLowerCase() !== 'li') continue
      const own = { text: '', runs: [] as Run[] }
      let checkbox: Block['checkbox'] = 'none'
      for (const child of li.childNodes ?? []) {
        const childTag = (child.rawTagName || '').toLowerCase()
        if (childTag === 'ul' || childTag === 'ol') continue
        if (childTag === 'input') {
          checkbox = child.getAttribute('checked') !== null && child.getAttribute('checked') !== undefined ? 'checked' : 'unchecked'
          continue
        }
        inlineRuns({ childNodes: [child] }, own)
      }
      const raw = li.rawText ?? ''
      if (checkbox === 'none' && /\[[ xX]\]/.test(raw)) checkbox = /\[[xX]\]/.test(raw) ? 'checked' : 'unchecked'
      out.push({ kind: 'listItem', level: depth, ordered: tag === 'ol', checkbox, text: own.text.trim(), runs: own.runs })
      for (const child of li.childNodes ?? []) {
        const childTag = (child.rawTagName || '').toLowerCase()
        if (childTag === 'ul' || childTag === 'ol') out.push(...blockFrom(child, depth + 1))
      }
    }
    return out
  }
  if (tag === 'table') {
    const rows: string[][] = []
    for (const tr of node.querySelectorAll('tr')) rows.push(tr.querySelectorAll('th,td').map((c: any) => textOf(c).trim()))
    return [{ kind: 'table', text: '', runs: [], rows }]
  }
  if (tag === 'img') return [{ kind: 'image', text: '', runs: [], src: node.getAttribute('src') || '', alt: node.getAttribute('alt') || '' }]
  const out: Block[] = []
  for (const child of node.childNodes ?? []) out.push(...blockFrom(child, depth))
  return out
}

const HEADINGS = ['HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6']
// ParagraphBorder.color is an OptionalColor, i.e. a Color wrapped one level deeper
// than TextStyle's. Getting this wrong fails the whole batch.
const grey = (v: number) => ({ color: { color: { rgbColor: { red: v, green: v, blue: v + 0.02 } } } })

async function api(url: string, init: any = {}) {
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token()}`, ...(init.headers || {}) } })
  const body = await res.text()
  let json: any = null
  try { json = JSON.parse(body) } catch {}
  return { ok: res.ok, status: res.status, json, body }
}

const mdPath = process.argv[2]
const templateId = process.argv[3]
const md = fs.readFileSync(mdPath, 'utf8')
const html = await marked.parse(md, { async: true })
const normalized = buildNormalizedExportHtml(html, { title: '', author: '', date: '' } as never, 'default')
const root = parse(normalized.html)
const blocks = (root.querySelector('body') ?? root).childNodes
  .flatMap((n: any) => blockFrom(n))
  .filter((b: Block) => b.text.trim() || b.kind === 'table' || b.kind === 'image' || b.kind === 'rule')

// ---- pass 1: text + styles, no length-changing requests after the insert
let text = ''
const placed: { block: Block; start: number; end: number; token?: string }[] = []
let tokenSeq = 0
for (const b of blocks) {
  const start = 1 + text.length
  if (b.kind === 'table' || b.kind === 'image') {
    const tok = `⁣RITEMARK_${b.kind.toUpperCase()}_${tokenSeq++}⁣`
    text += tok + '\n'
    placed.push({ block: b, start, end: 1 + text.length - 1, token: tok })
    continue
  }
  // Leading tabs are how Docs learns a list item's nesting level: one
  // createParagraphBullets over the whole list consumes them and sets levels.
  const prefix = b.kind === 'listItem' ? '\t'.repeat(b.level ?? 0) : ''
  text += prefix + b.text + '\n'
  placed.push({ block: b, start, end: 1 + text.length - 1 })
}

const styleRequests: any[] = [{ insertText: { location: { index: 1 }, text } }]
const bulletRequests: any[] = []
const listRuns: { start: number; end: number; preset: string; lastIndex: number }[] = []
const skippedImages: { src: string; reason: string }[] = []

for (const [index, { block, start, end }] of placed.entries()) {
  if (block.kind === 'heading') {
    styleRequests.push({ updateParagraphStyle: { range: { startIndex: start, endIndex: end }, paragraphStyle: { namedStyleType: HEADINGS[(block.level ?? 1) - 1] }, fields: 'namedStyleType' } })
  }
  // Spacing is the template's job when there is one; without a template the
  // document would otherwise read as one dense block.
  if (!templateId && (block.kind === 'paragraph' || block.kind === 'heading')) {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { spaceBelow: { magnitude: block.kind === 'heading' ? 4 : 8, unit: 'PT' } },
        fields: 'spaceBelow',
      },
    })
  }
  if (block.kind === 'code') {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          shading: { backgroundColor: { color: { rgbColor: { red: 0.96, green: 0.96, blue: 0.98 } } } },
          indentStart: { magnitude: INDENT_PT, unit: 'PT' },
          spaceAbove: { magnitude: 0, unit: 'PT' },
          spaceBelow: { magnitude: 0, unit: 'PT' },
        },
        fields: 'shading,indentStart,spaceAbove,spaceBelow',
      },
    })
    styleRequests.push({ updateTextStyle: { range: { startIndex: start, endIndex: end }, textStyle: { weightedFontFamily: { fontFamily: MONO }, fontSize: { magnitude: 10, unit: 'PT' } }, fields: 'weightedFontFamily,fontSize' } })
  }
  if (block.kind === 'quote') {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          indentStart: { magnitude: INDENT_PT * (block.level ?? 1), unit: 'PT' },
          borderLeft: { ...grey(0.8), width: { magnitude: 3, unit: 'PT' }, padding: { magnitude: 6, unit: 'PT' }, dashStyle: 'SOLID' },
        },
        fields: 'indentStart,borderLeft',
      },
    })
    styleRequests.push({ updateTextStyle: { range: { startIndex: start, endIndex: end }, textStyle: { italic: true }, fields: 'italic' } })
  }
  if (block.kind === 'rule') {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: Math.max(end, start + 1) },
        paragraphStyle: { borderBottom: { ...grey(0.75), width: { magnitude: 1, unit: 'PT' }, padding: { magnitude: 1, unit: 'PT' }, dashStyle: 'SOLID' } },
        fields: 'borderBottom',
      },
    })
  }
  if (block.kind === 'listItem') {
    const preset = block.checkbox !== 'none' ? 'BULLET_CHECKBOX'
      : block.ordered ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE'
    // One request per contiguous list. A nested item always continues the list
    // above it; a top-level item only continues one with the same preset.
    const open = listRuns[listRuns.length - 1]
    const continues = Boolean(open && open.lastIndex === index - 1 && ((block.level ?? 0) > 0 || open.preset === preset))
    if (continues && open) { open.end = end; open.lastIndex = index }
    else listRuns.push({ start, end, preset, lastIndex: index })
  }
  const prefixLen = block.kind === 'listItem' ? (block.level ?? 0) : 0
  for (const run of block.runs) {
    const s = start + prefixLen + run.start
    const e = start + prefixLen + run.end
    if (e <= s) continue
    const style: any = {}
    const fields: string[] = []
    if (run.bold) { style.bold = true; fields.push('bold') }
    if (run.italic) { style.italic = true; fields.push('italic') }
    if (run.code) {
      style.weightedFontFamily = { fontFamily: MONO }
      style.backgroundColor = { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.97 } } }
      fields.push('weightedFontFamily', 'backgroundColor')
    }
    if (run.link) { style.link = { url: run.link }; fields.push('link') }
    if (fields.length) styleRequests.push({ updateTextStyle: { range: { startIndex: s, endIndex: e }, textStyle: style, fields: fields.join(',') } })
  }
}
// Bullets go last, later lists first: createParagraphBullets eats the leading
// tabs, which shifts every index after it.
for (const run of listRuns.slice().reverse()) {
  bulletRequests.push({ createParagraphBullets: { range: { startIndex: run.start, endIndex: run.end }, bulletPreset: run.preset } })
}
styleRequests.push(...bulletRequests)

console.log(`PLAN ${blocks.length} blocks -> ${styleRequests.length} requests, ${text.length} chars`)

// ---- create the document
let docId: string
if (templateId) {
  const copy = await api(`https://www.googleapis.com/drive/v3/files/${templateId}/copy?fields=id`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ritemark canary — NATIVE MAPPER (from template)', appProperties: { ritemarkCanary: 'sprint-119-phase-0' } }),
  })
  if (!copy.ok) { console.log('copy failed', copy.status, copy.body.slice(0, 200)); process.exit(1) }
  docId = copy.json.id
  const doc = await api(`https://docs.googleapis.com/v1/documents/${docId}`)
  const end = doc.json.body.content[doc.json.body.content.length - 1].endIndex - 1
  if (end > 1) {
    await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: end } } }] }),
    })
  }
} else {
  const created = await api('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ritemark canary — NATIVE MAPPER v2', mimeType: DOC_MIME, appProperties: { ritemarkCanary: 'sprint-119-phase-0' } }),
  })
  if (!created.ok) { console.log('create failed', created.status, created.body.slice(0, 200)); process.exit(1) }
  docId = created.json.id
}

const t0 = Date.now()
const main = await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests: styleRequests }),
})
console.log('BATCH 1 (text + styles + bullets)', main.status, `${styleRequests.length} requests in ${Date.now() - t0}ms`)
if (!main.ok) { console.log(String(main.json?.error?.message).slice(0, 300)); console.log('doc', docId); process.exit(1) }

// ---- pass 3: tables and images, located by their placeholders
const tokens = placed.filter((p) => p.token)
if (tokens.length) {
  const doc = await api(`https://docs.googleapis.com/v1/documents/${docId}`)
  const found: { at: number; endAt: number; entry: typeof tokens[number] }[] = []
  for (const entry of tokens) {
    for (const el of doc.json.body.content || []) {
      const runs = el.paragraph?.elements || []
      for (const run of runs) {
        if (run.textRun?.content?.includes(entry.token!)) {
          found.push({ at: run.startIndex, endAt: run.startIndex + entry.token!.length, entry })
        }
      }
    }
  }
  const requests: any[] = []
  for (const { at, endAt, entry } of found.sort((a, b) => b.at - a.at)) {
    requests.push({ deleteContentRange: { range: { startIndex: at, endIndex: endAt } } })
    if (entry.block.kind === 'table' && entry.block.rows?.length) {
      requests.push({ insertTable: { rows: entry.block.rows.length, columns: entry.block.rows[0].length, location: { index: at } } })
    } else if (entry.block.kind === 'image') {
      const src = entry.block.src || ''
      if (/^https:\/\//.test(src) && /\.(png|jpe?g|gif)(\?|$)/i.test(src)) {
        requests.push({ insertInlineImage: { uri: src, location: { index: at } } })
      } else {
        skippedImages.push({ src, reason: /^https:\/\//.test(src) ? 'Docs cannot fetch this image format' : 'not a public https URL, Docs can only fetch' })
      }
    }
  }
  if (requests.length) {
    const t2 = Date.now()
    const r = await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests }),
    })
    console.log('BATCH 3 (tables + images)', r.status, `${requests.length} requests in ${Date.now() - t2}ms`)
    if (!r.ok) console.log(String(r.json?.error?.message).slice(0, 250))
  }
}

// ---- pass 4: table cell contents, last cell first
const tables = placed.filter((p) => p.block.kind === 'table').map((p) => p.block.rows!)
if (tables.length) {
  const doc = await api(`https://docs.googleapis.com/v1/documents/${docId}`)
  const docTables = (doc.json.body.content || []).filter((e: any) => e.table)
  const fill: any[] = []
  for (let t = docTables.length - 1; t >= 0; t--) {
    const rows = tables[t]
    if (!rows) continue
    const tableRows = docTables[t].table.tableRows || []
    for (let r = tableRows.length - 1; r >= 0; r--) {
      const cells = tableRows[r].tableCells || []
      for (let c = cells.length - 1; c >= 0; c--) {
        const value = rows[r]?.[c]
        const at = cells[c].content?.[0]?.startIndex
        if (!value || typeof at !== 'number') continue
        fill.push({ insertText: { location: { index: at }, text: value } })
        if (r === 0) fill.push({ updateTextStyle: { range: { startIndex: at, endIndex: at + value.length }, textStyle: { bold: true }, fields: 'bold' } })
      }
    }
  }
  if (fill.length) {
    const t3 = Date.now()
    const r = await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests: fill }),
    })
    console.log('BATCH 4 (table cells)', r.status, `${fill.length} requests in ${Date.now() - t3}ms`)
    if (!r.ok) console.log(String(r.json?.error?.message).slice(0, 250))
  }
}

for (const img of skippedImages) console.log(`  image not published: ${img.src.slice(0, 50)} — ${img.reason}`)
console.log('DOC https://docs.google.com/document/d/' + docId + '/edit')
fs.writeFileSync(path.join(DIR, 'last-native-doc.txt'), docId)

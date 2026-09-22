// Sprint 119 Phase 0 canary — inspect a created Google Doc for content-safety claims.
// Disposable research script. Prints findings, never tokens.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const state = () => JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8'))
const id = process.argv[2]
if (!id) { console.error('usage: node inspect-doc.mjs <documentId>'); process.exit(1) }

const res = await fetch(`https://docs.googleapis.com/v1/documents/${id}`, {
  headers: { authorization: `Bearer ${state().access_token}` },
})
if (!res.ok) { console.log('HTTP', res.status, (await res.text()).slice(0, 200)); process.exit(1) }
const doc = await res.json()

// Full plain text of the document body.
let text = ''
const fonts = new Map()
const walk = (els) => {
  for (const e of els) {
    if (e.paragraph) {
      for (const el of e.paragraph.elements || []) {
        if (el.textRun) {
          text += el.textRun.content
          const f = el.textRun.textStyle?.weightedFontFamily?.fontFamily
          if (f) fonts.set(f, (fonts.get(f) || 0) + el.textRun.content.length)
        }
      }
    }
    if (e.table) for (const row of e.table.tableRows || []) for (const cell of row.tableCells || []) walk(cell.content || [])
  }
}
walk(doc.body.content || [])

const probes = {
  'Ritemark comment id (c-test-1)': /c-test-1/,
  'Ritemark comment body text': /This is a Ritemark comment/,
  'HTML comment markers': /<!--|-->/,
  'script tag': /<script/i,
  'alert(1) payload': /alert\(1\)/,
  'onerror attribute': /onerror/i,
  'code block body': /export function publish/,
}
console.log('TEXT PROBES (found in the Google Doc?)')
for (const [label, re] of Object.entries(probes)) console.log(' ', re.test(text) ? 'FOUND   ' : 'absent  ', label)

console.log('\nFONTS used (chars):', [...fonts.entries()].map(([f, n]) => `${f}=${n}`).join(', ') || 'none reported (all default)')

const objs = Object.entries(doc.inlineObjects || {})
console.log('\nINLINE OBJECTS:', objs.length)
for (const [oid, o] of objs) {
  const emb = o.inlineObjectProperties?.embeddedObject || {}
  console.log(' ', oid)
  console.log('    title/desc :', JSON.stringify(emb.title || null), JSON.stringify(emb.description || null))
  console.log('    size       :', JSON.stringify(emb.size?.width?.magnitude ?? null), 'x', JSON.stringify(emb.size?.height?.magnitude ?? null))
  const src = emb.imageProperties?.sourceUri || emb.imageProperties?.contentUri
  console.log('    source     :', src ? (src.startsWith('https://lh') || src.includes('googleusercontent') ? 'google-hosted copy' : src.slice(0, 80)) : 'none')
  console.log('    hasContentUri:', Boolean(emb.imageProperties?.contentUri))
}

const suggestions = doc.suggestionsViewMode
console.log('\nrevisionId:', doc.revisionId)
console.log('suggestionsViewMode:', suggestions || '(default)')
fs.writeFileSync(path.join(DIR, `doc-text-${id.slice(0, 8)}.txt`), text)
console.log('\nplain text written to doc-text-' + id.slice(0, 8) + '.txt', text.length, 'chars')

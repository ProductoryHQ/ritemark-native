// Sprint 119 Phase 0 canary — the fourth candidate nobody had measured:
// upload Ritemark's own normalized export HTML and let Drive convert it,
// with local images inlined as data: URIs. Research only.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const EXT = '/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.claude/worktrees/sprint-119-google-docs-publishing/extensions/ritemark'
const { marked } = await import(`${EXT}/node_modules/marked/lib/marked.esm.js`)
const { buildNormalizedExportHtml } = await import(`${EXT}/src/export/v2/htmlPipeline.ts`)

const state = () => JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8'))
const H = () => ({ authorization: `Bearer ${state().access_token}` })
const DOC = 'application/vnd.google-apps.document'

const mdPath = process.argv[2]
const md = fs.readFileSync(mdPath, 'utf8')
let html: string = await marked.parse(md, { async: true })

// Inline every local image the document references, which is the whole point:
// the importer embeds data: URIs, and it has no 2 KB cap like the Docs API.
let inlined = 0
let skipped = 0
html = html.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/g, (whole, pre, src, post) => {
  if (/^https?:|^data:/.test(src)) return whole
  const abs = path.resolve(path.dirname(mdPath), src)
  const ext = path.extname(abs).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : null
  if (!mime || !fs.existsSync(abs)) { skipped++; return whole }
  inlined++
  return `<img${pre}src="data:${mime};base64,${fs.readFileSync(abs).toString('base64')}"${post}>`
})

const normalized = buildNormalizedExportHtml(html, { title: '', author: '', date: '' } as never, 'default')
console.log(`images inlined: ${inlined}, left alone: ${skipped}, html ${(normalized.html.length / 1024).toFixed(0)} KB`)

const b = 'b' + Math.random().toString(36).slice(2)
const meta = { name: 'Ritemark canary — HTML import', mimeType: DOC, appProperties: { ritemarkCanary: 'sprint-119-phase-0' } }
const body = Buffer.concat([
  Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n`),
  Buffer.from(normalized.html),
  Buffer.from(`\r\n--${b}--\r\n`),
])
const t0 = Date.now()
const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
  method: 'POST', headers: { ...H(), 'content-type': `multipart/related; boundary=${b}` }, body,
})
const file = await res.json()
console.log('upload', res.status, `${Date.now() - t0}ms`, file.id || JSON.stringify(file).slice(0, 200))
if (!res.ok) process.exit(1)

const ex = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent('text/markdown')}`, { headers: H() })
fs.writeFileSync(path.join(DIR, 'roundtrip-html-import.md'), await ex.text())
const doc = await (await fetch(`https://docs.googleapis.com/v1/documents/${file.id}`, { headers: H() })).json()
const objs = Object.values(doc.inlineObjects || {})
console.log('inline images in the document:', objs.length, 'hosted by Google:', objs.filter((o: any) => o.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri).length)
console.log('doc', file.webViewLink)

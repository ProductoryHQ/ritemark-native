// Sprint 119 Phase 0 canary — Drive/Docs behaviour.
// Disposable research script. Not product code.
//
//   node drive-canary.mjs formats                  # about.importFormats / exportFormats
//   node drive-canary.mjs import <file.md> [name]  # markdown -> Google Doc (conversion on create)
//   node drive-canary.mjs meta <fileId>            # metadata that could serve as a version signal
//   node drive-canary.mjs export <fileId> <mime> <out>
//   node drive-canary.mjs update <fileId> <file.md># same-ID replacement via files.update
//   node drive-canary.mjs copy <fileId> [name]     # files.copy (template path)
//   node drive-canary.mjs docsget <fileId>         # Docs API documents.get (structure)
//   node drive-canary.mjs delete <fileId>
//
// Tokens are read from state.json and never printed.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const STATE = path.join(DIR, 'state.json')
const DOC_MIME = 'application/vnd.google-apps.document'
const APP_TAG = { ritemarkCanary: 'sprint-119-phase-0' }

const state = () => JSON.parse(fs.readFileSync(STATE, 'utf8'))

async function api(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${state().access_token}`, ...headers },
    body,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok) {
    console.log('HTTP', res.status, (json?.error?.message || text).slice(0, 300))
    return { ok: false, status: res.status, json, text }
  }
  return { ok: true, status: res.status, json, text }
}

function multipart(metadata, mediaType, media) {
  const boundary = 'ritemark-canary-' + Math.random().toString(36).slice(2)
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mediaType}; charset=UTF-8`,
    '',
    media,
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return { body, type: `multipart/related; boundary=${boundary}` }
}

const FIELDS = 'id,name,mimeType,version,modifiedTime,createdTime,webViewLink,headRevisionId,size,owners(emailAddress),appProperties,capabilities(canEdit),trashed'

async function formats() {
  const r = await api('https://www.googleapis.com/drive/v3/about?fields=importFormats,exportFormats')
  if (!r.ok) return
  const imp = r.json.importFormats
  const exp = r.json.exportFormats
  const mdImport = Object.entries(imp).filter(([k]) => /markdown|text\/plain|wordprocessingml|html/.test(k))
  console.log('IMPORT formats that map to a Google Doc:')
  for (const [from, to] of mdImport) console.log(' ', from, '->', to.includes(DOC_MIME) ? 'google-apps.document ✓' : to.join(','))
  console.log('EXPORT formats for a Google Doc:')
  console.log(' ', (exp[DOC_MIME] || []).join(', '))
}

async function importMd(file, name) {
  const md = fs.readFileSync(file, 'utf8')
  const meta = {
    name: name || `Ritemark canary — ${path.basename(file)} — ${new Date().toISOString()}`,
    mimeType: DOC_MIME,
    appProperties: APP_TAG,
  }
  const { body, type } = multipart(meta, 'text/markdown', md)
  const r = await api(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST', headers: { 'content-type': type }, body,
  })
  if (!r.ok) return
  const f = r.json
  console.log('CREATED', f.id)
  console.log('  name        ', f.name)
  console.log('  mimeType    ', f.mimeType)
  console.log('  version     ', f.version, ' modifiedTime', f.modifiedTime)
  console.log('  headRevision', f.headRevisionId)
  console.log('  appProps    ', JSON.stringify(f.appProperties))
  console.log('  link        ', f.webViewLink)
}

async function meta(id) {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}?fields=${FIELDS}`)
  if (!r.ok) return
  console.log(JSON.stringify(r.json, null, 2))
}

async function exportDoc(id, mime, out) {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(mime)}`)
  if (!r.ok) return
  fs.writeFileSync(out, r.text)
  console.log('EXPORTED', mime, '->', out, r.text.length, 'chars')
}

async function update(id, file) {
  const md = fs.readFileSync(file, 'utf8')
  const before = await api(`https://www.googleapis.com/drive/v3/files/${id}?fields=${FIELDS}`)
  const r = await api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=${FIELDS}`, {
    method: 'PATCH', headers: { 'content-type': 'text/markdown; charset=UTF-8' }, body: md,
  })
  if (!r.ok) return
  console.log('UPDATED same id?', r.json.id === id ? 'YES ' + r.json.id : 'NO — ' + r.json.id)
  console.log('  version   ', before.json?.version, '->', r.json.version)
  console.log('  modified  ', before.json?.modifiedTime, '->', r.json.modifiedTime)
  console.log('  headRev   ', before.json?.headRevisionId, '->', r.json.headRevisionId)
  console.log('  appProps  ', JSON.stringify(r.json.appProperties))
}

async function copy(id, name) {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}/copy?fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: name || `Ritemark canary copy — ${new Date().toISOString()}`, appProperties: APP_TAG }),
  })
  if (!r.ok) return
  console.log('COPIED to', r.json.id, r.json.webViewLink)
}

async function docsget(id) {
  const r = await api(`https://docs.googleapis.com/v1/documents/${id}`)
  if (!r.ok) return
  const d = r.json
  const body = d.body.content || []
  const counts = {}
  const styles = new Set()
  let tables = 0, images = 0, links = 0, bullets = 0
  const walk = (els) => {
    for (const e of els) {
      if (e.paragraph) {
        counts.paragraph = (counts.paragraph || 0) + 1
        const st = e.paragraph.paragraphStyle?.namedStyleType
        if (st) styles.add(st)
        if (e.paragraph.bullet) bullets++
        for (const el of e.paragraph.elements || []) {
          if (el.textRun?.textStyle?.link) links++
          if (el.inlineObjectElement) images++
        }
      }
      if (e.table) { tables++; for (const row of e.table.tableRows || []) for (const cell of row.tableCells || []) walk(cell.content || []) }
      if (e.tableOfContents) counts.toc = (counts.toc || 0) + 1
    }
  }
  walk(body)
  console.log('DOCS documentId', d.documentId)
  console.log('  revisionId    ', d.revisionId)
  console.log('  title         ', d.title)
  console.log('  paragraphs    ', counts.paragraph, ' bulleted', bullets)
  console.log('  named styles  ', [...styles].join(', '))
  console.log('  tables        ', tables, ' inline images', images, ' links', links)
  console.log('  inlineObjects ', Object.keys(d.inlineObjects || {}).length)
  console.log('  lists         ', Object.keys(d.lists || {}).length)
  console.log('  headers/footers', Object.keys(d.headers || {}).length, '/', Object.keys(d.footers || {}).length)
}

async function del(id) {
  const r = await api(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE' })
  console.log('DELETE', r.status)
}

const [cmd, ...args] = process.argv.slice(2)
const fns = { formats, import: importMd, meta, export: exportDoc, update, copy, docsget, delete: del }
if (!fns[cmd]) { console.error('commands: formats | import | meta | export | update | copy | docsget | delete'); process.exit(1) }
await fns[cmd](...args)

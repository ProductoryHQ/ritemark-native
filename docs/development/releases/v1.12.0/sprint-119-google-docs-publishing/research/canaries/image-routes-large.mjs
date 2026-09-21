// Sprint 119 Phase 0 canary — the routes that might carry a real-sized image.
// The Docs API caps an inline image URI at 2 KB, so a data: URI only works for
// a thumbnail. These two routes do not go through that field.
import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const state = () => JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8'))
const H = () => ({ authorization: `Bearer ${state().access_token}` })
const J = () => ({ ...H(), 'content-type': 'application/json' })
const DOC = 'application/vnd.google-apps.document'
const TAG = { ritemarkCanary: 'sprint-119-phase-0' }

const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)) } return ~c >>> 0 }
const chunk = (t, d) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length)
  const td = Buffer.concat([Buffer.from(t), d])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
function makePng(w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const rows = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3)
    for (let x = 0; x < w; x++) {
      row[1 + x * 3] = (x * 7 + y * 13) % 256
      row[2 + x * 3] = (x * 31 + y * 17) % 256
      row[3 + x * 3] = (x * 11 + y * 29) % 256
    }
    rows.push(row)
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 1 })), chunk('IEND', Buffer.alloc(0))])
}

async function j(url, init) {
  const r = await fetch(url, init)
  const t = await r.text()
  let body = null
  try { body = JSON.parse(t) } catch {}
  return { ok: r.ok, status: r.status, body, text: t }
}
async function upload(media, mime, name, convert) {
  const b = 'b' + Math.random().toString(36).slice(2)
  const meta = { name, appProperties: TAG, ...(convert ? { mimeType: DOC } : {}) }
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`),
    Buffer.isBuffer(media) ? media : Buffer.from(media),
    Buffer.from(`\r\n--${b}--\r\n`),
  ])
  return j('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType', {
    method: 'POST', headers: { ...H(), 'content-type': `multipart/related; boundary=${b}` }, body,
  })
}
async function images(docId) {
  const d = await j(`https://docs.googleapis.com/v1/documents/${docId}`, { headers: H() })
  const objs = Object.values(d.body?.inlineObjects || {})
  return {
    count: objs.length,
    hosted: objs.filter((o) => o.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri).length,
    width: objs[0]?.inlineObjectProperties?.embeddedObject?.size?.width?.magnitude ?? null,
  }
}

const png = makePng(1600, 1200)
const dataUri = `data:image/png;base64,${png.toString('base64')}`
console.log(`test image: 1600x1200, ${(png.length / 1024 / 1024).toFixed(2)} MB, data URI ${(dataUri.length / 1024 / 1024).toFixed(2)} MB\n`)

// ---- HTML import carrying the big data: URI
{
  const html = `<h1>Large image via HTML import</h1><p>Before.</p><p><img src="${dataUri}" alt="Big"></p><p>After.</p>`
  const t0 = Date.now()
  const r = await upload(html, 'text/html', 'Ritemark canary — LARGE via HTML import', true)
  console.log('HTML import     ', r.status, r.ok ? `${JSON.stringify(await images(r.body.id))} in ${Date.now() - t0}ms  https://docs.google.com/document/d/${r.body.id}/edit` : r.text.replace(/\s+/g, ' ').slice(0, 120))
}

// ---- Markdown import carrying the big data: URI
{
  const md = `# Large image via Markdown import\n\nBefore.\n\n![Big](${dataUri})\n\nAfter.\n`
  const t0 = Date.now()
  const r = await upload(md, 'text/markdown', 'Ritemark canary — LARGE via Markdown import', true)
  console.log('Markdown import ', r.status, r.ok ? `${JSON.stringify(await images(r.body.id))} in ${Date.now() - t0}ms` : r.text.replace(/\s+/g, ' ').slice(0, 120))
  if (r.ok) await j(`https://www.googleapis.com/drive/v3/files/${r.body.id}`, { method: 'DELETE', headers: H() })
}

// ---- Docs API with a momentarily link-shared Drive copy
{
  const t0 = Date.now()
  const up = await upload(png, 'image/png', 'ritemark-canary-temp-large.png', false)
  const fileId = up.body.id
  const perm = await j(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=id`, {
    method: 'POST', headers: J(), body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  const doc = await j('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: J(), body: JSON.stringify({ name: 'Ritemark canary — LARGE via temporary link', mimeType: DOC, appProperties: TAG }),
  })
  const r = await j(`https://docs.googleapis.com/v1/documents/${doc.body.id}:batchUpdate`, {
    method: 'POST', headers: J(),
    body: JSON.stringify({ requests: [{ insertInlineImage: { uri: `https://drive.google.com/uc?export=view&id=${fileId}`, location: { index: 1 } } }] }),
  })
  const before = r.ok ? await images(doc.body.id) : null
  if (perm.ok) await j(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${perm.body.id}`, { method: 'DELETE', headers: H() })
  await j(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE', headers: H() })
  const after = r.ok ? await images(doc.body.id) : null
  console.log('temporary link  ', r.status, r.ok
    ? `${JSON.stringify(before)} -> after unshare+delete ${JSON.stringify(after)} in ${Date.now() - t0}ms  https://docs.google.com/document/d/${doc.body.id}/edit`
    : String(r.body?.error?.message).slice(0, 120))
}

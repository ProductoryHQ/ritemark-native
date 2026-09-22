// Sprint 119 Phase 0 canary — what does publishing several local images cost?
// Uploads them in parallel, shares each for a moment, inserts them in ONE
// batchUpdate, then revokes the sharing and deletes the temporary files.
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
function makePng(w, h, seed) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const rows = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3)
    for (let x = 0; x < w; x++) {
      row[1 + x * 3] = (x * 7 + y * 13 + seed) % 256
      row[2 + x * 3] = (x * 31 + y * 17 + seed) % 256
      row[3 + x * 3] = (x * 11 + y * 29 + seed) % 256
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

const COUNT = Number(process.argv[2] || 4)
const images = Array.from({ length: COUNT }, (_, i) => makePng(1200, 900, i * 40))
console.log(`${COUNT} images, ${(images.reduce((n, b) => n + b.length, 0) / 1024 / 1024).toFixed(2)} MB total`)

const doc = await j('https://www.googleapis.com/drive/v3/files?fields=id', {
  method: 'POST', headers: J(),
  body: JSON.stringify({ name: 'Ritemark canary — MANY IMAGES', mimeType: DOC, appProperties: TAG }),
})
const docId = doc.body.id
await j(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
  method: 'POST', headers: J(),
  body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: Array.from({ length: COUNT }, (_, i) => `Figure ${i + 1}\n`).join('') } }] }),
})

const t0 = Date.now()
// upload + share, all at once
const staged = await Promise.all(images.map(async (png, i) => {
  const b = 'b' + Math.random().toString(36).slice(2)
  const meta = { name: `ritemark-temp-${i}.png`, appProperties: TAG }
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: image/png\r\n\r\n`),
    png, Buffer.from(`\r\n--${b}--\r\n`),
  ])
  const up = await j('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { ...H(), 'content-type': `multipart/related; boundary=${b}` }, body,
  })
  const perm = await j(`https://www.googleapis.com/drive/v3/files/${up.body.id}/permissions?fields=id`, {
    method: 'POST', headers: J(), body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  return { fileId: up.body.id, permId: perm.body?.id }
}))
const tUpload = Date.now() - t0

// one batch for every image, inserted last-first so earlier indices hold
const t1 = Date.now()
const requests = staged.map((s, i) => ({ at: 1 + Array.from({ length: i }, (_, k) => `Figure ${k + 1}\n`.length).reduce((a, b) => a + b, 0), s }))
  .sort((a, b) => b.at - a.at)
  .map(({ at, s }) => ({ insertInlineImage: { uri: `https://drive.google.com/uc?export=view&id=${s.fileId}`, location: { index: at } } }))
const ins = await j(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
  method: 'POST', headers: J(), body: JSON.stringify({ requests }),
})
const tInsert = Date.now() - t1

// take the sharing away and drop the temporary files
const t2 = Date.now()
await Promise.all(staged.map(async (s) => {
  if (s.permId) await j(`https://www.googleapis.com/drive/v3/files/${s.fileId}/permissions/${s.permId}`, { method: 'DELETE', headers: H() })
  await j(`https://www.googleapis.com/drive/v3/files/${s.fileId}`, { method: 'DELETE', headers: H() })
}))
const tCleanup = Date.now() - t2

const after = await j(`https://docs.googleapis.com/v1/documents/${docId}`, { headers: H() })
const objs = Object.values(after.body?.inlineObjects || {})
console.log(`upload+share (parallel) ${tUpload}ms | one insert batch ${ins.status} ${tInsert}ms | unshare+delete ${tCleanup}ms`)
console.log(`images in the document: ${objs.length}, hosted by Google: ${objs.filter((o) => o.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri).length}`)
console.log(`total ${(tUpload + tInsert + tCleanup) / 1000}s for ${COUNT} images`)
console.log('doc https://docs.google.com/document/d/' + docId + '/edit')

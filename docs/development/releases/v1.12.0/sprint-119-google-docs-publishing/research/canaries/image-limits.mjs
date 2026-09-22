// Sprint 119 Phase 0 canary — how big may an inlined data: URI image be?
// Builds real PNGs of increasing size and inlines each one. Research only.
import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const state = () => JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8'))
const H = () => ({ authorization: `Bearer ${state().access_token}` })
const J = () => ({ ...H(), 'content-type': 'application/json' })
const DOC = 'application/vnd.google-apps.document'

const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)) } return ~c >>> 0 }
const chunk = (t, d) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length)
  const td = Buffer.concat([Buffer.from(t), d])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
// Noise compresses badly, which is what makes the file big — closer to a screenshot than a flat colour.
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
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

async function j(url, init) {
  const r = await fetch(url, init)
  const t = await r.text()
  let body = null
  try { body = JSON.parse(t) } catch {}
  return { ok: r.ok, status: r.status, body, text: t }
}

const doc = await j('https://www.googleapis.com/drive/v3/files?fields=id', {
  method: 'POST', headers: J(),
  body: JSON.stringify({ name: 'Ritemark canary — IMAGE SIZE LIMITS', mimeType: DOC, appProperties: { ritemarkCanary: 'sprint-119-phase-0' } }),
})
const docId = doc.body.id

console.log('SIZE OF PNG   BASE64 PAYLOAD   STATUS   NOTE')
for (const [w, h] of [[200, 150], [800, 600], [1600, 1200], [2400, 1800], [3400, 2600]]) {
  const png = makePng(w, h)
  const uri = `data:image/png;base64,${png.toString('base64')}`
  const t0 = Date.now()
  const r = await j(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST', headers: J(), body: JSON.stringify({ requests: [{ insertInlineImage: { uri, location: { index: 1 } } }] }),
  })
  const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB'
  console.log(
    `${w}x${h}`.padEnd(13),
    mb(png.length).padEnd(9),
    mb(uri.length).padEnd(8),
    String(r.status).padEnd(8),
    r.ok ? `inserted in ${Date.now() - t0}ms` : String(r.body?.error?.message || r.text).replace(/\s+/g, ' ').slice(0, 80),
  )
}
console.log('doc https://docs.google.com/document/d/' + docId + '/edit')

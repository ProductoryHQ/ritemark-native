// Sprint 119 Phase 0 canary — can a local image reach a Google Doc without
// hosting it publicly? Four routes, measured. Research only.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const state = () => JSON.parse(fs.readFileSync(path.join(DIR, 'state.json'), 'utf8'))
const H = () => ({ authorization: `Bearer ${state().access_token}` })
const J = () => ({ ...H(), 'content-type': 'application/json' })
const DOC = 'application/vnd.google-apps.document'
const TAG = { ritemarkCanary: 'sprint-119-phase-0' }

const png = fs.readFileSync(path.join(DIR, 'fixtures/red.png'))
const dataUri = `data:image/png;base64,${png.toString('base64')}`

async function j(url, init) {
  const r = await fetch(url, init)
  const t = await r.text()
  let body = null
  try { body = JSON.parse(t) } catch {}
  return { ok: r.ok, status: r.status, body, text: t }
}

async function newDoc(name) {
  const r = await j('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: J(), body: JSON.stringify({ name, mimeType: DOC, appProperties: TAG }),
  })
  return r.body.id
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

async function imageCount(docId) {
  const d = await j(`https://docs.googleapis.com/v1/documents/${docId}`, { headers: H() })
  const objs = Object.values(d.body?.inlineObjects || {})
  const withBytes = objs.filter((o) => o.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri)
  return { total: objs.length, hosted: withBytes.length }
}

const results = []

// ---- A. data: URI straight into the Docs API
{
  const id = await newDoc('Ritemark canary — IMAGE A dataUri')
  const r = await j(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, {
    method: 'POST', headers: J(), body: JSON.stringify({ requests: [{ insertInlineImage: { uri: dataUri, location: { index: 1 } } }] }),
  })
  results.push(['A. Docs API, data: URI', r.status, r.ok ? JSON.stringify(await imageCount(id)) : String(r.body?.error?.message).slice(0, 90)])
  await j(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE', headers: H() })
}

// ---- B. Markdown import carrying a data: URI image
{
  const md = `# Image B\n\nBefore.\n\n![Red](${dataUri})\n\nAfter.\n`
  const r = await upload(md, 'text/markdown', 'Ritemark canary — IMAGE B markdown dataUri', true)
  results.push(['B. Markdown import, data: URI', r.status, r.ok ? JSON.stringify(await imageCount(r.body.id)) : r.text.slice(0, 90)])
  if (r.ok) await j(`https://www.googleapis.com/drive/v3/files/${r.body.id}`, { method: 'DELETE', headers: H() })
}

// ---- C. HTML import carrying a data: URI image
{
  const html = `<h1>Image C</h1><p>Before.</p><p><img src="${dataUri}" alt="Red"></p><p>After.</p>`
  const r = await upload(html, 'text/html', 'Ritemark canary — IMAGE C html dataUri', true)
  results.push(['C. HTML import, data: URI', r.status, r.ok ? JSON.stringify(await imageCount(r.body.id)) : r.text.slice(0, 90)])
  if (r.ok) await j(`https://www.googleapis.com/drive/v3/files/${r.body.id}`, { method: 'DELETE', headers: H() })
}

// ---- D. upload the image, share it by link for a moment, insert, then unshare and delete
{
  const up = await upload(png, 'image/png', 'ritemark-canary-temp-image.png', false)
  const fileId = up.body.id
  const perm = await j(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=id`, {
    method: 'POST', headers: J(), body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
  const id = await newDoc('Ritemark canary — IMAGE D temporary link')
  const tries = [
    `https://drive.google.com/uc?export=view&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`,
    `https://lh3.googleusercontent.com/d/${fileId}`,
  ]
  for (const uri of tries) {
    const r = await j(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, {
      method: 'POST', headers: J(), body: JSON.stringify({ requests: [{ insertInlineImage: { uri, location: { index: 1 } } }] }),
    })
    results.push([`D. ${uri.split('?')[0].replace('https://', '').slice(0, 34)}`, r.status, r.ok ? JSON.stringify(await imageCount(id)) : String(r.body?.error?.message).slice(0, 70)])
  }
  const counts = await imageCount(id)
  // Take the sharing away again and drop the uploaded file; if Docs copied the
  // bytes, the picture in the document must survive that.
  if (perm.ok) await j(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${perm.body.id}`, { method: 'DELETE', headers: H() })
  await j(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE', headers: H() })
  const after = await imageCount(id)
  results.push(['D. after unshare + delete', 'n/a', `${JSON.stringify(counts)} -> ${JSON.stringify(after)}`])
  console.log('   D document (kept for inspection): https://docs.google.com/document/d/' + id + '/edit')
}

console.log('\nROUTE                                    STATUS  RESULT')
for (const [label, status, result] of results) console.log(String(label).padEnd(40), String(status).padEnd(7), result)

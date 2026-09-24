#!/usr/bin/env node
// Sprint 124 R1/R2: render .docx files with a Ritemark webview bundle in headless
// Chromium and save one PNG per rendered page.
//
//   node capture-preview.mjs [--css extra.css] <bundle.js> <out-dir> <file.docx>...
//
// The bundle is loaded as-is (`media/office-preview.js`; during the spike, `webview.js` builds),
// behind a stub `acquireVsCodeApi`, and receives the same `load` message the
// DOCX editor provider sends. Pages are `section.docx` elements, captured at
// 1 CSS px = 1 image px, which matches `pdftoppm -r 96` of Word's PDF.
//
// Chromium: $CHROME_BIN, else Playwright's cached headless shell, else Google Chrome.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const argv = process.argv.slice(2)
let extraCss = ''
if (argv[0] === '--css') { extraCss = fs.readFileSync(argv[1], 'utf8'); argv.splice(0, 2) }
const [bundleArg, outArg, ...docxArgs] = argv
if (!bundleArg || !outArg || docxArgs.length === 0) {
  console.error('usage: capture-preview.mjs <bundle.js> <out-dir> <file.docx>...')
  process.exit(2)
}
const bundle = path.resolve(bundleArg)
const outDir = path.resolve(outArg)
fs.mkdirSync(outDir, { recursive: true })

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright')
  if (fs.existsSync(cache)) {
    const shells = fs.readdirSync(cache).filter((n) => n.startsWith('chromium_headless_shell-')).sort().reverse()
    for (const s of shells) {
      const bin = path.join(cache, s, 'chrome-headless-shell-mac-arm64/chrome-headless-shell')
      if (fs.existsSync(bin)) return bin
    }
  }
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-docx-capture-'))
const harness = path.join(work, 'harness.html')
fs.writeFileSync(harness, `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>html, body, #root { height: 100%; width: 100%; margin: 0; overflow: hidden; }</style>
<style>${extraCss}</style>
<script>window.acquireVsCodeApi = () => ({ postMessage() {}, getState() { return undefined }, setState() {} })</script>
</head><body><div id="root"></div><script src="${new URL('file://' + bundle).href}"></script></body></html>`)

const port = 9400 + Math.floor(Math.random() * 400)
const chrome = spawn(findChrome(), [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(work, 'profile')}`,
  '--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function target() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(100)
  }
  throw new Error('Chromium did not start')
}

const ws = new WebSocket(await target())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let nextId = 1
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
  }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
async function waitFor(expression, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expression)) return Date.now() - start
    await sleep(100)
  }
  throw new Error(`timed out waiting for: ${expression}`)
}

await send('Page.enable')
await send('Runtime.enable')
const W = 1400
const results = []

for (const docxArg of docxArgs) {
  const file = path.resolve(docxArg)
  const name = path.basename(file, '.docx')
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'file://' + harness })
  await waitFor(`document.readyState === 'complete' && document.getElementById('root').childElementCount > 0`)
  const content = fs.readFileSync(file).toString('base64')
  const t0 = Date.now()
  await evaluate(`window.postMessage(${JSON.stringify({
    type: 'load', fileType: 'docx', content, encoding: 'base64', filename: path.basename(file),
    sizeBytes: fs.statSync(file).size,
    features: { voiceDictation: false, markdownExport: true, saveAsMarkdownFromPreview: true },
  })}, '*'); true`)
  let status = 'ok'
  let renderMs = null
  try {
    await waitFor(`!!document.querySelector('section.docx') || /Failed to load|Unsupported|can’t be read|couldn’t draw|isn’t supported/.test(document.body.innerText)`, 120000)
    renderMs = Date.now() - t0 // message posted -> first page or error on screen (100 ms polling)
    await sleep(500) // images and embedded fonts settle
  } catch (e) {
    status = 'timeout'
  }
  const info = await evaluate(`(() => {
    const pages = [...document.querySelectorAll('section.docx')]
    const err = /(Failed to load|can’t be read|couldn’t draw|isn’t supported)[^\\n]*\\n?[^\\n]*/.exec(document.body.innerText)
    return { heights: pages.map((p) => Math.round(p.getBoundingClientRect().height)), widths: pages.map((p) => Math.round(p.getBoundingClientRect().width)), error: err ? err[0] : null, heap: performance.memory ? performance.memory.usedJSHeapSize : null }
  })()`)
  if (info.error) status = 'error: ' + info.error.replace(/\s+/g, ' ')
  const maxH = Math.max(1200, ...info.heights.map((h) => h + 80))
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: Math.min(maxH, 16000), deviceScaleFactor: 1, mobile: false })
  await sleep(200)
  for (let i = 0; i < info.heights.length; i++) {
    const rect = await evaluate(`(() => {
      const p = document.querySelectorAll('section.docx')[${i}]
      p.scrollIntoView({ block: 'start' })
      const r = p.getBoundingClientRect()
      return { x: r.left, y: r.top, width: r.width, height: r.height }
    })()`)
    await sleep(60)
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 1 }, captureBeyondViewport: true })
    fs.writeFileSync(path.join(outDir, `${name}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'))
  }
  results.push({ name, status, pages: info.heights.length, renderMs, pageHeights: info.heights, pageWidths: info.widths, heapBytes: info.heap })
  console.log(`${name}: ${status}, ${info.heights.length} page(s), ${renderMs} ms`)
}

fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify({ bundle: path.basename(bundle), results }, null, 2))
ws.close()
const exited = new Promise((r) => chrome.once('exit', r))
chrome.kill()
await exited
fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

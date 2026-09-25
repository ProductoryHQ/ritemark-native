#!/usr/bin/env node
// Sprint 125 R1/R8: render .pptx files with Ritemark's Office preview bundle in headless
// Chromium and save one PNG per slide. Adapted from Sprint 124's capture-preview.mjs.
//
//   node capture-preview.mjs <office-preview.js> <out-dir> <file.pptx>...
//
// The bundle is loaded as-is, behind a stub `acquireVsCodeApi`, and receives the same
// `load` message the host sends. At a 1400 px wide window the preview draws slides at
// 100 %, so a slide (`.pptx-slide`, 1280 x 720 for 16:9) is captured at 1 CSS px = 1 image
// px, which matches `pdftoppm -r 96` of PowerPoint's PDF. Only slides near the view are
// drawn, so each slide is scrolled into view and waited for before its capture.
//
// Chromium: $CHROME_BIN, else Playwright's cached headless shell, else Google Chrome.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const [bundleArg, outArg, ...deckArgs] = process.argv.slice(2)
if (!bundleArg || !outArg || deckArgs.length === 0) {
  console.error('usage: capture-preview.mjs <office-preview.js> <out-dir> <file.pptx>...')
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

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-pptx-capture-'))
const harness = path.join(work, 'harness.html')
fs.writeFileSync(harness, `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>html, body, #root { height: 100%; width: 100%; margin: 0; overflow: hidden; }</style>
<!-- VS Code's own webview defaults, which the real preview runs under. -->
<style>@layer vscode-default { img, video { max-width: 100%; max-height: 100%; } }</style>
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
    await sleep(50)
  }
  throw new Error(`timed out waiting for: ${expression}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })
const ERROR_TEXT = /(can’t be read|couldn’t draw|isn’t supported|turned off|too large|password-protected|looks damaged|too complex)[^\n]*/
const results = []

for (const deckArg of deckArgs) {
  const file = path.resolve(deckArg)
  const name = path.basename(file, '.pptx')
  await send('Page.navigate', { url: 'file://' + harness })
  await waitFor(`document.readyState === 'complete' && document.getElementById('root').childElementCount > 0`)
  const content = fs.readFileSync(file).toString('base64')
  const t0 = Date.now()
  await evaluate(`window.postMessage(${JSON.stringify({
    type: 'load', fileType: 'pptx', content, encoding: 'base64', filename: path.basename(file), sizeBytes: fs.statSync(file).size, features: {},
  })}, '*'); true`)
  let status = 'ok'
  let firstSlideMs = null
  try {
    await waitFor(`!!document.querySelector('.pptx-slide > div') || ${ERROR_TEXT}.test(document.body.innerText)`, 120000)
    firstSlideMs = Date.now() - t0 // message posted -> first slide drawn (50 ms polling)
  } catch {
    status = 'timeout'
  }
  const error = await evaluate(`(${ERROR_TEXT}.exec(document.body.innerText) || [null])[0]`)
  if (error) status = 'error: ' + error
  const count = await evaluate(`document.querySelectorAll('.pptx-slide').length`)
  let drawnAtOnce = await evaluate(`document.querySelectorAll('.pptx-slide > div').length`)
  for (let i = 0; i < count && status === 'ok'; i++) {
    await evaluate(`document.querySelectorAll('.pptx-slide')[${i}].scrollIntoView({ block: 'center' }); true`)
    await waitFor(`!!document.querySelectorAll('.pptx-slide')[${i}].firstElementChild`, 20000)
    await evaluate(`document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => true)`)
    await sleep(150) // images decode
    const rect = await evaluate(`(() => { const r = document.querySelectorAll('.pptx-slide')[${i}].getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } })()`)
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 1 } })
    fs.writeFileSync(path.join(outDir, `${name}-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'))
    drawnAtOnce = Math.max(drawnAtOnce, await evaluate(`document.querySelectorAll('.pptx-slide > div').length`))
  }
  const info = await evaluate(`(() => ({
    zoom: document.querySelector('[aria-label^="Zoom: "]')?.getAttribute('aria-label') ?? null,
    notes: document.querySelectorAll('.pptx-notes').length,
    notice: document.querySelector('[role=status]')?.innerText ?? null,
    domNodes: document.querySelectorAll('*').length,
    heap: performance.memory ? performance.memory.usedJSHeapSize : null,
  }))()`)
  results.push({ name, status, slides: count, firstSlideMs, mostDrawnAtOnce: drawnAtOnce, ...info })
  console.log(`${name}: ${status}, ${count} slide(s), first slide ${firstSlideMs} ms, at most ${drawnAtOnce} drawn, ${info.zoom}`)
}

fs.writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify({ bundle: path.basename(bundle), results }, null, 2))
ws.close()
const exited = new Promise((r) => chrome.once('exit', r))
chrome.kill()
await exited
fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

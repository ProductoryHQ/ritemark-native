// Sprint 161 spike, second pass: visual truth (markers + screenshots) for transform vs zoom, the bubble menu, and a
// sharper fit test. node drive2.mjs <port> <harness.js> <outDir>
import fs from 'node:fs'
import path from 'node:path'

const [port, bundlePath, outDir] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const bundle = fs.readFileSync(bundlePath, 'utf8')
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()

function session(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const events = []
  ws.onmessage = msg => {
    const data = JSON.parse(msg.data)
    if (data.id && pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id) } else events.push(data)
  }
  const ready = new Promise(r => { ws.onopen = r })
  const send = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
  return { ready, send, events, close: () => ws.close() }
}

let found = null
for (const t of targets.filter(t => t.type === 'iframe' && t.url.startsWith('vscode-webview://') && !t.url.includes('purpose='))) {
  const s = session(t.webSocketDebuggerUrl)
  await s.ready
  await s.send('Runtime.enable')
  await new Promise(r => setTimeout(r, 300))
  const tree = await s.send('Page.getFrameTree')
  const child = tree.result?.frameTree?.childFrames?.[0]
  const ctx = s.events.filter(e => e.method === 'Runtime.executionContextCreated').map(e => e.params.context).find(c => child && c.auxData?.frameId === child.frame.id && c.auxData?.isDefault)
  if (!ctx) { s.close(); continue }
  const probe = await s.send('Runtime.evaluate', { contextId: ctx.id, expression: 'document.querySelector(".ProseMirror") ? "editor" : "other"', returnByValue: true })
  if (probe.result?.result?.value === 'editor') { found = { s, ctx }; break }
  s.close()
}
if (!found) { console.error('no editor webview'); process.exit(1) }
const { s, ctx } = found
const page = session(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
await page.ready
const evaluate = async (expression, awaitPromise = true) => {
  const r = await s.send('Runtime.evaluate', { contextId: ctx.id, expression, awaitPromise, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800))
  return r.result?.result?.value
}
const shot = async name => {
  const r = await page.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(r.result.data, 'base64'))
}
const wait = ms => new Promise(r => setTimeout(r, ms))

await evaluate(bundle, false)
// Focus the window's webview, so ProseMirror draws its selection and the bubble menu shows.
await page.send('Page.bringToFront')
await s.send('Emulation.setFocusEmulationEnabled', { enabled: true })
await page.send('Emulation.setFocusEmulationEnabled', { enabled: true })

const SLIDE = `# What the pilot taught us
## Six weeks, two teams

:::: columns

::: column
### Copilot
- People trusted the drafts more after a week of checking them
- The shared inbox took 40 minutes instead of two hours
:::

::: column
### Cursor
- Answers were best when the question was one sentence
- The weekly review took 15 minutes and caught most mistakes
:::

::::`

const results = { focus: null }
for (const mode of ['transform', 'zoom']) {
  const r = {}
  await evaluate(`window.__spike161.mount(${JSON.stringify(SLIDE)}, '${mode}', 698)`)
  await evaluate('document.fonts.ready.then(() => true)')
  results.focus = await evaluate('window.__spike161.hasFocus()')
  r.caret = await evaluate(`['pilot taught', 'one sentence', 'two hours'].map(t => window.__spike161.caretCheck(t))`)
  r.frame = await evaluate(`(() => { const f = window.__spike161.frame().getBoundingClientRect(); return { left: f.left, top: f.top, right: f.right, bottom: f.bottom } })()`)
  r.markers = await evaluate(`['pilot taught', 'one sentence', 'two hours'].map(t => window.__spike161.markCaret(t))`)
  // The slash menu, left open for the screenshot.
  await evaluate(`(() => { const e = window.__spike161.editor(); e.commands.focus(); let f=-1; e.state.doc.descendants((n,pos)=>{ if(f<0&&n.isText){const i=n.text.indexOf('two hours');if(i>=0)f=pos+i+9}}); e.commands.setTextSelection(f); e.commands.insertContent(' /'); return f })()`)
  await wait(400)
  r.slash = await evaluate(`(() => { const v = window.__spike161.editor().view; const c = v.coordsAtPos(v.state.selection.from); const p = Array.from(document.querySelectorAll('[data-tippy-root]')).map(el => el.getBoundingClientRect()).find(x => x.height > 0); return { caret: { left: c.left, bottom: c.bottom }, popup: p ? { left: p.left, top: p.top, right: p.right } : null } })()`)
  await shot(`${mode}-slash`)
  await evaluate(`(() => { const e = window.__spike161.editor(); e.commands.undo(); return true })()`)
  await wait(200)
  r.bubble = await evaluate(`window.__spike161.bubbleCheck('weekly')`)
  await shot(`${mode}-bubble`)
  await evaluate('window.__spike161.clearMarkers()')
  results[mode] = r
}

// Fit: wrapping paragraphs (so the font's width matters), grown one at a time, at the stage's and a thumbnail's width.
const para = n => `Paragraph ${n}: the shared inbox took forty minutes instead of two hours once the files were current.`
const doc = n => `# A full slide\n\n${Array.from({ length: n }, (_, i) => para(i + 1)).join('\n\n')}`
const fit = {}
for (const mode of ['transform', 'zoom']) {
  for (const width of [698, 160]) {
    await evaluate(`window.__spike161.mount('# A full slide', '${mode}', ${width})`)
    let current = 0
    const seq = []
    for (let n = 1; n <= 9; n += 1) {
      await evaluate(`window.__spike161.setMarkdown(${JSON.stringify(doc(n))})`)
      current = (await evaluate(`window.__spike161.fitStep(${current})`)).step
      seq.push(current)
    }
    fit[`${mode}@${width}`] = seq.join('')
  }
}
// Hysteresis: content going back and forth over a step boundary, typed one word at a time.
await evaluate(`window.__spike161.mount('# A full slide', 'transform', 698)`)
{
  const base = doc(4)
  const seq = []
  let current = 0
  for (let words = 0; words <= 60; words += 4) {
    const md = `${base} ${'more '.repeat(words)}`.trim()
    await evaluate(`window.__spike161.setMarkdown(${JSON.stringify(md)})`)
    current = (await evaluate(`window.__spike161.fitStep(${current})`)).step
    seq.push(current)
  }
  for (let words = 60; words >= 0; words -= 4) {
    const md = `${base} ${'more '.repeat(words)}`.trim()
    await evaluate(`window.__spike161.setMarkdown(${JSON.stringify(md)})`)
    current = (await evaluate(`window.__spike161.fitStep(${current})`)).step
    seq.push(current)
  }
  fit.growThenShrink = seq.join('')
}
// Fonts: the same paragraphs in Sofia Sans and in the fallback a swap starts from (font-display: swap).
for (const family of ["'Sofia Sans', sans-serif", 'sans-serif']) {
  await evaluate(`window.__spike161.mount('# A full slide', 'transform', 698)`)
  await evaluate(`document.querySelector('#spike161 .ProseMirror').style.fontFamily = ${JSON.stringify(family)}`)
  const seq = []
  for (let n = 1; n <= 9; n += 1) {
    await evaluate(`window.__spike161.setMarkdown(${JSON.stringify(doc(n))})`)
    seq.push((await evaluate('window.__spike161.fitStep(0)')).step)
  }
  fit[family] = seq.join('')
}
results.fit = fit
await evaluate(`document.getElementById('spike161')?.remove()`)
fs.writeFileSync(path.join(outDir, 'results2.json'), JSON.stringify(results, null, 1))
console.log(JSON.stringify(results, null, 1))
s.close(); page.close()

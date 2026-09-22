// Phase 0 canary: does the Word exporter keep a local image when the HTML puts
// <img> at block level (as TipTap does) versus inside a <p> (as marked does)?
import fs from 'node:fs'
const EXT = '/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.claude/worktrees/sprint-119-google-docs-publishing/extensions/ritemark'
const C = '/private/tmp/claude-501/-Users-jarmotuisk-Projects-ritemark-dev-ritemark-native/e7902e31-bf71-4af8-97b3-6b164e10d37d/scratchpad/canary'
const vscodeMod: any = await import(`${EXT}/node_modules/vscode/index.js`)
const vscode = vscodeMod.default ?? vscodeMod
const { exportToWordV2 } = await import(`${EXT}/src/export/v2/wordHtmlExporter.ts`)

const cases: [string, string][] = [
  ['wrapped in a paragraph', '<h1>Local image</h1><p>Before</p><p><img src="./red.png" alt="Red"></p><p>After</p>'],
  ['bare block-level img', '<h1>Local image</h1><p>Before</p><img src="./red.png" alt="Red"><p>After</p>'],
]

for (const [label, html] of cases) {
  const out = `${C}/img-${label.replace(/\W+/g, '-')}.docx`
  vscode._setSaveTarget(out)
  await exportToWordV2(
    { html, markdownFallback: '', properties: { title: '', author: '', date: '' }, templateId: 'default' } as never,
    vscode.Uri.file(`${C}/fixtures/local-image.md`) as never,
  )
  const buf = fs.readFileSync(out)
  // The word/media/ entry only exists when an image was embedded.
  const embedded = buf.includes(Buffer.from('word/media/'))
  console.log(label.padEnd(26), embedded ? 'image embedded' : 'image dropped', `(${buf.length} bytes)`)
}

// Phase 0 canary: does Ritemark's Word exporter decode HTML entities?
const EXT = '/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.claude/worktrees/sprint-119-google-docs-publishing/extensions/ritemark'
const vscodeMod: any = await import(`${EXT}/node_modules/vscode/index.js`)
const vscode = vscodeMod.default ?? vscodeMod
const { exportToWordV2 } = await import(`${EXT}/src/export/v2/wordHtmlExporter.ts`)

const out = process.argv[2]
vscode._setSaveTarget(out)

// Entities exactly as an HTML serializer emits them for & < > and quotes.
const html = '<p>Ampersand &amp; less-than &lt;tag&gt; quote &quot;q&quot; apostrophe &#39;a&#39;</p>'
await exportToWordV2(
  { html, markdownFallback: '', properties: { title: '', author: '', date: '' }, templateId: 'default' } as never,
  vscode.Uri.file('/tmp/entity.md') as never,
)
console.log('written', out)

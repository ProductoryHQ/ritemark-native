// Sprint 119 Phase 0 canary: run Ritemark's real Word exporter over the fixture
// corpus and write a .docx, so the DOCX -> Google Docs path can be measured.
// Research only. Product code is imported read-only; nothing here ships.
import fs from 'node:fs'
import path from 'node:path'
import * as vscode from './vscode-stub.mjs'

const EXT = '/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.claude/worktrees/sprint-119-google-docs-publishing/extensions/ritemark'
const { marked } = await import(`${EXT}/node_modules/marked/lib/marked.esm.js`)
const { exportToWordV2 } = await import(`${EXT}/src/export/v2/wordHtmlExporter.ts`)

const mdPath = process.argv[2]
const outPath = process.argv[3] || '/tmp/canary.docx'
const md = fs.readFileSync(mdPath, 'utf8')
const html = await marked.parse(md, { async: true })

vscode._setSaveTarget(outPath)
await exportToWordV2(
  {
    html,
    markdownFallback: md,
    properties: { title: 'Sprint 119 fidelity corpus', author: 'Ritemark canary', date: '2026-09-20' },
    templateId: 'default',
  } as never,
  vscode.Uri.file(path.resolve(mdPath)) as never,
)

const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0
console.log('DOCX written:', outPath, size, 'bytes')

// Phase 0 canary: does Ritemark's image loader pick up a local PNG next to the document?
const EXT = '/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/.claude/worktrees/sprint-119-google-docs-publishing/extensions/ritemark'
const C = '/private/tmp/claude-501/-Users-jarmotuisk-Projects-ritemark-dev-ritemark-native/e7902e31-bf71-4af8-97b3-6b164e10d37d/scratchpad/canary'
const { tryLoadImageSource } = await import(`${EXT}/src/export/v2/imageSource.ts`)

for (const [label, src, doc] of [
  ['relative next to the document', './red.png', `${C}/fixtures/local-image.md`],
  ['bare filename', 'red.png', `${C}/fixtures/local-image.md`],
  ['absolute path', `${C}/fixtures/red.png`, `${C}/fixtures/local-image.md`],
] as const) {
  const buf = tryLoadImageSource(src, { fsPath: doc })
  console.log(label.padEnd(32), buf ? `${buf.length} bytes` : 'null')
}

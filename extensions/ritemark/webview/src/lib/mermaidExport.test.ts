import assert from 'node:assert/strict'
import { inlineMermaidDiagramsForExport } from './mermaidExport'

async function run() {
  let renderedSource = ''

  const html = [
    '<h2>Doc</h2>',
    '<pre><code class="language-mermaid">flowchart TD\nA --&gt; B</code></pre>',
    '<pre><code class="language-ts">const x = 1;</code></pre>',
  ].join('')

  const result = await inlineMermaidDiagramsForExport(html, async (source) => {
    renderedSource = source
    return 'data:image/png;base64,ZmFrZQ=='
  })

  assert.equal(renderedSource, 'flowchart TD\nA --> B')
  assert.match(result, /<img[^>]+src="data:image\/png;base64,ZmFrZQ=="/)
  assert.doesNotMatch(result, /language-mermaid/)
  assert.match(result, /language-ts/)

  let highlightedSource = ''
  const highlightedHtml = '<pre><code class="language-mermaid"><span class="hljs-keyword">flowchart</span> TD\nA --&gt; B</code></pre>'
  await inlineMermaidDiagramsForExport(highlightedHtml, async (source) => {
    highlightedSource = source
    return 'data:image/png;base64,ZmFrZTI='
  })
  assert.equal(highlightedSource, 'flowchart TD\nA --> B')
}

void run()

/**
 * Tests for Sprint 90 SVG export rasterization pre-pass (#127 R5).
 *
 * The canvas rasterizer and fetch are injected, so these exercise the HTML
 * scan/rewrite logic without a DOM. Run: npx tsx webview/src/lib/svgRasterExport.test.ts
 */

import { strict as assert } from 'node:assert'
import { inlineSvgImagesForExport } from './svgRasterExport'

const PNG = 'data:image/png;base64,UE5H'

function deps(fetchImpl?: (url: string) => Promise<string>) {
  const fetched: string[] = []
  return {
    fetched,
    rasterize: async (_svg: string) => PNG,
    fetchText: async (url: string) => {
      fetched.push(url)
      return fetchImpl ? fetchImpl(url) : '<svg width="10" height="10"><rect/></svg>'
    },
  }
}

async function run() {
  // ── inline data:image/svg+xml → rasterized in place ──────────────────────
  {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect/></svg>'
    const b64 = Buffer.from(svg).toString('base64')
    const html = `<p>x</p><img src="data:image/svg+xml;base64,${b64}" alt="a" />`
    const out = await inlineSvgImagesForExport(html, deps())
    assert.ok(out.includes(`src="${PNG}"`), 'inline SVG src should be rewritten to PNG')
    assert.ok(!out.includes('svg+xml'), 'original svg data-url should be gone')
    assert.ok(out.includes('alt="a"'), 'alt should be preserved')
  }

  // ── file-referenced .drawio.svg → fetched via src, title stripped ─────────
  {
    const html =
      '<img src="vscode-webview://abc/images/d.drawio.svg?v=1" title="./images/d.drawio.svg" alt="d" />'
    const d = deps()
    const out = await inlineSvgImagesForExport(html, d)
    assert.equal(d.fetched.length, 1, 'file SVG should be fetched once')
    assert.equal(d.fetched[0], 'vscode-webview://abc/images/d.drawio.svg?v=1', 'fetch uses the src URI')
    assert.ok(out.includes(`src="${PNG}"`), 'src should be rewritten to PNG')
    assert.ok(!/\btitle=/.test(out), 'title must be removed so host uses the PNG src')
  }

  // ── non-SVG image is left untouched, not fetched ──────────────────────────
  {
    const html = '<img src="vscode-webview://abc/images/pic.png" title="./images/pic.png" />'
    const d = deps()
    const out = await inlineSvgImagesForExport(html, d)
    assert.equal(d.fetched.length, 0, 'non-SVG should not be fetched')
    assert.equal(out, html, 'non-SVG tag should be byte-identical')
  }

  // ── rasterize failure leaves the tag untouched (graceful degrade) ─────────
  {
    const html = '<img src="vscode-webview://abc/x.svg" title="./x.svg" />'
    const failing = {
      rasterize: async () => {
        throw new Error('tainted canvas')
      },
      fetchText: async () => '<svg/>',
    }
    const out = await inlineSvgImagesForExport(html, failing)
    assert.equal(out, html, 'failed rasterization should leave the original tag')
  }

  // ── no images → returned unchanged ────────────────────────────────────────
  {
    const html = '<h1>hello</h1><p>no images</p>'
    assert.equal(await inlineSvgImagesForExport(html, deps()), html)
  }

  console.log('svgRasterExport.test.ts: all assertions passed')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDocument } from '@mixmark-io/domino'
import { copyChart } from './chartCopy'

for (const failure of [undefined, 'clipboard', 'image'] as const) {
  test(failure ? `a chart ${failure} failure revokes the URL and warns once` : 'chart Copy writes a self-contained PNG at 2×', async (t) => {
    const doc = createDocument(`
      <div><svg viewBox="0 0 120 75">
        <defs><clipPath id="plot"><rect width="120" height="75"/></clipPath></defs>
        <g clip-path="url(#plot)">
          <text style="font-family:Carlito">Sales</text>
          <text style="font-family: &quot;http://example.com/font&quot;">Costs</text>
        </g>
      </svg></div>
    `)
    const target = doc.querySelector('div') as unknown as HTMLDivElement
    const svg = target.querySelector('svg')!
    Object.defineProperty(svg, 'viewBox', { value: { baseVal: { width: 120, height: 75 } } })
    class FontFaceStub {
      constructor(readonly family: string, readonly src: string) {}
      style = { getPropertyValue: (name: string) => name === 'src' ? this.src : this.family }
      get cssText() { return `@font-face { font-family: ${this.family}; src: ${this.src}; }` }
    }
    Object.defineProperty(doc, 'styleSheets', { value: [{ cssRules: [
      new FontFaceStub('Carlito', 'url("data:font/woff2;base64,AA==") format("woff2")'),
      new FontFaceStub('Carlito', 'url("https://example.com/remote.woff2")'),
      new FontFaceStub('Unused', 'url("data:font/woff2;base64,AAAA")'),
    ] }] })
    const png = new Blob(['png'], { type: 'image/png' })
    const drawCalls: number[][] = []
    let decoded = false
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, drawImage: (_image: ImageStub, ...bounds: number[]) => {
        assert.ok(decoded)
        drawCalls.push(bounds)
      } }),
      toBlob(callback: (blob: Blob) => void, type: string) {
        assert.equal(type, 'image/png')
        callback(png)
      },
    }
    const url = 'blob:chart'
    class ImageStub {
      onload?: () => void
      onerror?: () => void
      async decode() { decoded = true }
      set src(value: string) {
        assert.equal(value, url)
        queueMicrotask(() => failure === 'image' ? this.onerror?.() : this.onload?.())
      }
    }
    class ClipboardItemStub {
      constructor(readonly data: Record<string, Promise<Blob>>) {}
    }
    let svgBlob: Blob | undefined
    const revoke = t.mock.method(URL, 'revokeObjectURL', () => {})
    t.mock.method(URL, 'createObjectURL', (blob: Blob) => {
      svgBlob = blob
      return url
    })
    const warn = t.mock.method(console, 'warn', () => {})
    const write = t.mock.fn(async ([item]: ClipboardItemStub[]) => {
      if (failure === 'clipboard') throw new Error('Clipboard unavailable')
      assert.equal(await item.data['image/png'], png)
    })
    const globals = {
      document: { createElement: () => canvas },
      Image: ImageStub,
      CSSFontFaceRule: FontFaceStub,
      XMLSerializer: class { serializeToString(node: SVGSVGElement) { return node.outerHTML } },
      ClipboardItem: ClipboardItemStub,
      navigator: { clipboard: { write } },
    }
    for (const [name, value] of Object.entries(globals)) {
      const previous = Object.getOwnPropertyDescriptor(globalThis, name)
      Object.defineProperty(globalThis, name, { configurable: true, value })
      t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous)
        else Reflect.deleteProperty(globalThis, name)
      })
    }

    await assert.doesNotReject(Promise.all([copyChart(target), copyChart(target)]))
    assert.equal(write.mock.callCount(), 1)
    assert.equal(warn.mock.callCount(), failure ? 1 : 0)
    assert.deepEqual(revoke.mock.calls.map(({ arguments: args }) => args), [[url]])
    if (failure === 'image') {
      assert.deepEqual(drawCalls, [])
      return
    }

    assert.equal(svgBlob?.type, 'image/svg+xml')
    const markup = await svgBlob!.text()
    assert.match(markup, /font-family:\s*Carlito/)
    assert.match(markup, /url\(#plot\)/)
    assert.match(markup, /@font-face[^}]+data:font\/woff2;base64,AA==/)
    assert.doesNotMatch(markup.replace('clip-path="url(#plot)"', ''), /url\(\s*(?!["']?data:)|@import|\bhref\s*=|foreignObject|Unused/i)
    assert.equal(canvas.width, 240)
    assert.equal(canvas.height, 150)
    assert.deepEqual(drawCalls, [[0, 0, 240, 150]])
  })
}

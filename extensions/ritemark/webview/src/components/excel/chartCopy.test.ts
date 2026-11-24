import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDocument } from '@mixmark-io/domino'
import { copyChart } from './chartCopy'

for (const refuseWrite of [false, true]) {
  test(refuseWrite ? 'a rejected chart clipboard write logs once and resolves' : 'chart Copy writes a self-contained PNG at 2×', async (t) => {
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
    const png = new Blob(['png'], { type: 'image/png' })
    const drawCalls: number[][] = []
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, drawImage: (_image: ImageStub, ...bounds: number[]) => drawCalls.push(bounds) }),
      toBlob(callback: (blob: Blob) => void, type: string) {
        assert.equal(type, 'image/png')
        callback(png)
      },
    }
    const url = 'blob:chart'
    class ImageStub {
      onload?: () => void
      set src(value: string) {
        assert.equal(value, url)
        queueMicrotask(() => this.onload?.())
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
      if (refuseWrite) throw new Error('Clipboard unavailable')
      assert.equal(await item.data['image/png'], png)
    })
    const globals = {
      document: { createElement: () => canvas },
      Image: ImageStub,
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

    await assert.doesNotReject(copyChart(target))
    assert.equal(write.mock.callCount(), 1)
    assert.equal(warn.mock.callCount(), refuseWrite ? 1 : 0)
    if (refuseWrite) return

    assert.equal(svgBlob?.type, 'image/svg+xml')
    const markup = await svgBlob!.text()
    assert.match(markup, /font-family:\s*Carlito/)
    assert.match(markup, /url\(#plot\)/)
    assert.doesNotMatch(markup, /https?:|@font-face|(?:href|src)=/)
    assert.equal(canvas.width, 240)
    assert.equal(canvas.height, 150)
    assert.deepEqual(drawCalls, [[0, 0, 240, 150]])
    assert.deepEqual(revoke.mock.calls.map(({ arguments: args }) => args), [[url]])
  })
}

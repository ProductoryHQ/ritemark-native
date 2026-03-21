import assert from 'node:assert/strict'
import { tryLoadImageSource } from './imageSource'

function run() {
  const documentUri = { fsPath: '/tmp/example.md' }

  // PNG data URL — accepted
  const buffer = tryLoadImageSource('data:image/png;base64,ZmFrZQ==', documentUri)
  assert.ok(buffer)
  assert.equal(buffer?.toString('utf8'), 'fake')

  // JPEG data URL — accepted
  const jpegBuffer = tryLoadImageSource('data:image/jpeg;base64,ZmFrZQ==', documentUri)
  assert.ok(jpegBuffer)

  // SVG data URL — rejected (not raster, would crash pdfkit/docx)
  const svgBuffer = tryLoadImageSource('data:image/svg+xml;base64,ZmFrZQ==', documentUri)
  assert.equal(svgBuffer, null)

  // WebP data URL — rejected
  const webpBuffer = tryLoadImageSource('data:image/webp;base64,ZmFrZQ==', documentUri)
  assert.equal(webpBuffer, null)
}

run()

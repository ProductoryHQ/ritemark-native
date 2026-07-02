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

  // GIF/BMP/TIFF data URLs — rejected (pass old regex, crash pdfkit) — #127 R3
  for (const fmt of ['gif', 'bmp', 'tiff']) {
    assert.equal(
      tryLoadImageSource(`data:image/${fmt};base64,ZmFrZQ==`, documentUri),
      null,
      `${fmt} data URL should be rejected`,
    )
  }

  // File-referenced .svg / .drawio.svg — rejected without reading the file
  // (would otherwise hand raw XML to pdfkit and abort the export) — #127 R1.
  // Use paths that do not exist: the extension guard must fire BEFORE existsSync.
  assert.equal(tryLoadImageSource('images/diagram.svg', documentUri), null)
  assert.equal(tryLoadImageSource('images/flow.drawio.svg', documentUri), null)
  assert.equal(tryLoadImageSource('/abs/path/pic.tiff', documentUri), null)
}

run()

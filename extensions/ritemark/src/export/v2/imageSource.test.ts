import assert from 'node:assert/strict'
import { tryLoadImageSource } from './imageSource'

function run() {
  const documentUri = { fsPath: '/tmp/example.md' }
  const buffer = tryLoadImageSource('data:image/png;base64,ZmFrZQ==', documentUri)

  assert.ok(buffer)
  assert.equal(buffer?.toString('utf8'), 'fake')
}

run()

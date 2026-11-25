import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('the Excel webview CSP adds only local blob images', () => {
  const source = readFileSync(new URL('../excelEditorProvider.ts', import.meta.url), 'utf8')
  const old = "default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource} data:;"
  const policies = [...source.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/g)]
  assert.deepEqual(policies.map((match) => match[1]), [old + ' img-src blob:;'])
})

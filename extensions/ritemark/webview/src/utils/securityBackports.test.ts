import { strict as assert } from 'node:assert'
import { mergeAttributes } from '@tiptap/core'

const hostile = JSON.parse('{"__proto__":{"src":"x-invalid://canary","onerror":"globalThis.__tiptapXss += 1"}}')
const merged = mergeAttributes(hostile)

assert.equal(
  Object.getPrototypeOf(merged),
  Object.prototype,
  'mergeAttributes must retain the ordinary Object prototype',
)
assert.equal(
  Object.prototype.hasOwnProperty.call(merged, '__proto__'),
  false,
  'the hostile __proto__ key must be rejected',
)
assert.equal('src' in merged, false, 'inherited attacker attributes must not escape')
assert.equal('onerror' in merged, false, 'inherited event handlers must not escape')

const ordinary = mergeAttributes(
  { class: 'alpha', style: 'color: red' },
  { class: 'beta', style: 'font-weight: 700', 'data-safe': 'yes' },
)

assert.deepEqual(ordinary, {
  class: 'alpha beta',
  style: 'color: red; font-weight: 700',
  'data-safe': 'yes',
}, 'the backport must preserve ordinary attribute merging')

console.log('securityBackports.test.ts — TipTap __proto__ backport passed')

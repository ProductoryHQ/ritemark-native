/**
 * Run: npx tsx webview/src/components/sheetSort.test.ts
 */

import * as assert from 'node:assert/strict'
import { cellNumber, compareCells } from './sheetSort'

const sorted = (values: unknown[]) => [...values].sort(compareCells)

assert.deepEqual(
  [cellNumber('12'), cellNumber(' -3.5 '), cellNumber('1e3'), cellNumber('1,200'), cellNumber('.5'), cellNumber('12 apples'), cellNumber('1,2'), cellNumber('')],
  [12, -3.5, 1000, 1200, 0.5, null, null, null],
)

assert.deepEqual(
  [
    sorted(['1200', '300', '850']),
    sorted(['1.5', '1.25', '-5', '-10', '1,200', '300']),
    sorted(['Module 10', 'module 2', 'Module 1']),
    sorted(['Venue', '300', '', 'Catering', '12']),
  ],
  [
    ['300', '850', '1200'],
    ['-10', '-5', '1.25', '1.5', '300', '1,200'],
    ['Module 1', 'module 2', 'Module 10'],
    ['12', '300', 'Catering', 'Venue', ''],
  ],
)

console.log('sheetSort tests passed')

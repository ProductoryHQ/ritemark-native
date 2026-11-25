import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readStyles } from './excelStyles'

const { dxfs } = readStyles(readFileSync(new URL('./fixtures/synthetic-rules/styles.xml', import.meta.url), 'utf8'))
assert.deepEqual(dxfs, [
  { fill: '#FF0000' },
  { font: { bold: true, italic: false, underline: 'double', strike: true, color: '#4472C4' },
    border: { bottom: { width: 1, style: 'solid', color: '#123456' } },
    numberFormat: { id: 165, code: '0.00 "units"' } },
  { font: { bold: false, italic: true, underline: null }, fill: '#FFBF00',
    border: { top: { width: 1, style: 'dashed', color: '#000000' } } },
  { font: { bold: true } },
])
assert.deepEqual(readStyles('').dxfs, [])
console.log('excelStyles: differential font, fill, border and number format passed')

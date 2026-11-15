/**
 * Sprint 158 PR 2 (#711): number formats as Excel draws them, and typed text back into values.
 * Run: npx tsx webview/src/components/excel/numberFormat.test.ts
 */
import assert from 'node:assert/strict'
import { formatCellValue, formatCode, inputText, valueFromInput } from './numberFormat'

const none = new Map<number, string>()
const text = (v: Parameters<typeof formatCellValue>[0], code: string, d1904 = false) => formatCellValue(v, code, d1904).text

// Day-first dates, as Estonian workbooks write them (SheetJS showed 1/3/26 for these)
assert.equal(text(46025, 'dd.mm.yyyy'), '03.01.2026')
assert.equal(text(46025, 'd.m.yyyy'), '3.1.2026')
assert.equal(text(46025, 'dd.mm.yy'), '03.01.26')
assert.equal(text(46025, 'dddd, d. mmmm yyyy'), 'Saturday, 3. January 2026')
// the 1904 date system
assert.equal(text(46025 - 1462, 'dd.mm.yyyy', true), '03.01.2026')
// durations and times
assert.equal(text(0.34375, '[h]:mm'), '8:15')
assert.equal(text(1.5, '[h]:mm'), '36:00')
assert.equal(text(0.75, 'hh:mm'), '18:00')
// money, thousands, percent, negatives in red
assert.equal(text(1450, '#,##0.00 "€"'), '1,450.00 €')
assert.equal(text(0.257, '0.0%'), '25.7%')
assert.deepEqual(formatCellValue(-360, '#,##0.00 "€";[Red]-#,##0.00 "€"'), { text: '-360.00 €', color: '#FF0000' })
// accounting: zero as a dash
assert.match(text(0, '_-* #,##0.00 €_-;-* #,##0.00 €_-;_-* "-"?? €_-;_-@_-'), /^\s*-\s+€\s*$/)
// General keeps up to 11 significant characters, as Excel does
assert.equal(text(0.1 + 0.2, 'General'), '0.3')
assert.equal(text(123456789012, 'General'), '1.23457E+11')
// text, booleans, a text section
assert.equal(text('Booked', '#,##0'), 'Booked')
assert.equal(text(true, 'General'), 'TRUE')
assert.equal(text('x', '0;-0;0;"[" @ "]"'), '[ x ]')
// built-in ids
assert.equal(formatCode(14, none), 'mm-dd-yy')
assert.equal(formatCode(164, new Map([[164, 'dd.mm.yyyy']])), 'dd.mm.yyyy')
assert.equal(formatCode(9999, none), 'General')

// What the formula bar shows and an edit starts with
assert.equal(inputText(1450, '#,##0.00 "€"'), '1450')
assert.equal(inputText(0.25, '0%'), '25%')
assert.equal(inputText(0.1 + 0.2, 'General'), '0.3')
assert.equal(inputText(46025, 'dd.mm.yyyy'), '03.01.2026')
assert.equal(inputText(null, 'General'), '')

// Typed text back into a value
assert.equal(valueFromInput('03.01.2026', 'dd.mm.yyyy'), 46025)
assert.equal(valueFromInput('3.1.26', 'd.m.yy'), 46025)
assert.equal(valueFromInput('1/3/2026', 'm/d/yyyy'), 46025)
assert.equal(valueFromInput('2026-01-03', 'yyyy-mm-dd'), 46025)
assert.equal(valueFromInput('03.01.2026', 'dd.mm.yyyy', true), 46025 - 1462)
assert.equal(valueFromInput('31.02.2026', 'dd.mm.yyyy'), '31.02.2026', 'not a date: kept as text')
assert.equal(valueFromInput('25%', '0%'), 0.25)
assert.equal(valueFromInput('1450', '#,##0.00 "€"'), 1450)
assert.equal(valueFromInput('Booked', 'General'), 'Booked')
assert.equal(valueFromInput('', 'dd.mm.yyyy'), null)
// times and durations typed in a time cell stay times
assert.equal(valueFromInput('8:15', '[h]:mm'), 0.34375)
assert.equal(valueFromInput('36:00', '[h]:mm'), 1.5)
assert.equal(valueFromInput('18:00', 'hh:mm'), 0.75)
assert.equal(valueFromInput('8:15', 'General'), '8:15', 'not a time cell: text, as before')
// before March 1900 Excel's serials count a 29 February that never was (Codex on #724)
assert.equal(valueFromInput('01.01.1900', 'dd.mm.yyyy'), 1)
assert.equal(valueFromInput('28.02.1900', 'dd.mm.yyyy'), 59)
assert.equal(valueFromInput('01.03.1900', 'dd.mm.yyyy'), 61)
assert.equal(text(1, 'dd.mm.yyyy'), '01.01.1900')
// minutes are not months
assert.equal(valueFromInput('03.01.2026', 'dd.mm.yyyy hh:mm'), 46025)

console.log('numberFormat: all passed')

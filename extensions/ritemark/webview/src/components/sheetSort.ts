/**
 * How a sheet's column sorts (the CSV and Excel grid): numbers in number order, text in natural order
 * ("Module 2" before "Module 10"), numbers before text, empty cells last in ascending order.
 */

const PLAIN_NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i
const GROUPED_NUMBER = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/

/** A cell's value as a number, when the whole cell is one: "12", "-3.5", "1e3", "1,200". */
export function cellNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') {
    return null
  }
  const text = value.trim()
  if (PLAIN_NUMBER.test(text)) {
    return Number(text)
  }
  if (GROUPED_NUMBER.test(text)) {
    return Number(text.replace(/,/g, ''))
  }
  return null
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Compares two cells for an ascending sort. */
export function compareCells(a: unknown, b: unknown): number {
  const textA = a === null || a === undefined ? '' : String(a).trim()
  const textB = b === null || b === undefined ? '' : String(b).trim()
  if (textA === '' || textB === '') {
    return textA === textB ? 0 : textA === '' ? 1 : -1
  }
  const numberA = cellNumber(textA)
  const numberB = cellNumber(textB)
  if (numberA !== null && numberB !== null) {
    return numberA - numberB
  }
  if (numberA !== null) {
    return -1
  }
  if (numberB !== null) {
    return 1
  }
  return collator.compare(textA, textB)
}

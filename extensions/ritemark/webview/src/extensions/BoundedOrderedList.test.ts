/**
 * Sprint 120 (#280) — a number only starts a list up to 99.
 *
 * What a user loses if this is wrong: typing a year turns their sentence into
 * a numbered list, and the saved file keeps the list rather than the prose.
 * The bound is LibreOffice Writer's (two digits); above it the paragraph is
 * left alone.
 */
import { strict as assert } from 'node:assert'
import { BoundedOrderedList, boundedOrderedListInputRegex, continuesList, listStartFrom } from './BoundedOrderedList'

type Rule = { find: RegExp }

/** The extension's own addInputRules, with the context TipTap would give it. */
function inputRules(options: { keepMarks?: boolean; keepAttributes?: boolean } = {}): Rule[] {
  const context = {
    options: { keepMarks: false, keepAttributes: false, ...options },
    type: { name: 'orderedList' },
    editor: { getAttributes: () => ({ color: 'red' }) },
  }
  const addInputRules = (BoundedOrderedList.config as { addInputRules: () => Rule[] }).addInputRules
  return addInputRules.call(context as never)
}

const fires = (rule: Rule, text: string): RegExpMatchArray | null => text.match(rule.find)

{
  // --- the marker a person types
  const [rule] = inputRules()

  for (const text of ['1. ', '2. ', '9. ', '10. ', '42. ', '99. ']) {
    assert.ok(fires(rule, text), `${JSON.stringify(text)} still starts a list`)
  }

  for (const text of ['100. ', '101. ', '999. ', '1999. ', '2026. ', '12345. ']) {
    assert.equal(fires(rule, text), null, `${JSON.stringify(text)} stays prose`)
  }

  // Shapes that were never list markers stay untouched either way.
  for (const text of ['0. ', '01. ', '1.', '1 . ', 'a1. ', ' 1. ', '1) ', '-1. ']) {
    assert.equal(fires(rule, text), null, `${JSON.stringify(text)} is not a list marker`)
  }

  // Only at the start of the paragraph's text.
  assert.equal(fires(rule, 'In 2026. '), null, 'a number inside a sentence never converts')

  // The regex is exported for anyone reading the rule; keep it in step.
  assert.equal(rule.find.source, boundedOrderedListInputRegex.source)
}

{
  // --- the list still starts at the number that was typed
  const match = '7. '.match(boundedOrderedListInputRegex)!
  assert.equal(listStartFrom(match), 7)

  // …and joins the list above only when the numbering actually continues into
  // it (TipTap's own predicate, kept as it was).
  assert.equal(continuesList(match, { childCount: 6, attrs: { start: 1 } }), true, '1..6 continues into 7')
  assert.equal(continuesList(match, { childCount: 2, attrs: { start: 1 } }), false, '1..2 does not continue into 7')
  assert.equal(continuesList(match, { childCount: 2, attrs: { start: 5 } }), true, 'a list numbered 5, 6 continues into 7')
  assert.equal(continuesList(match, { childCount: 1, attrs: { start: 2026 } }), false, 'a list numbered 2026 is not continued by 7')
}

{
  // --- the keepMarks/keepAttributes variant is bounded too, and still carries
  // the text style TipTap would apply.
  for (const options of [{ keepMarks: true }, { keepAttributes: true }]) {
    const [rule] = inputRules(options)
    assert.ok(fires(rule, '3. '), `${JSON.stringify(options)}: a small number still converts`)
    assert.equal(fires(rule, '2026. '), null, `${JSON.stringify(options)}: a year stays prose`)
  }
}

{
  // --- it is still TipTap's ordered list: same node, one rule, so commands,
  // keyboard shortcuts and Markdown serialization are untouched.
  assert.equal(BoundedOrderedList.name, 'orderedList')
  assert.equal(inputRules().length, 1)
  assert.equal(inputRules({ keepMarks: true }).length, 1)
}

console.log('BoundedOrderedList.test.ts: all tests passed')

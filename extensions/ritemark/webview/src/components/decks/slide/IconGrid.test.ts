/**
 * Sprint 169 PR 4 (#869): the icon menu opened for a box whose icon names one Ritemark doesn't know starts its search
 * with that name, so the nearest icons show at once; for a known icon or none the search starts empty.
 *
 * Run: npx tsx webview/src/components/decks/slide/IconGrid.test.ts
 */
import assert from 'node:assert/strict'
import * as React from 'react'
import { createDocument } from '@mixmark-io/domino'
import { SLIDE_ICON_NAMES } from './iconSet'
import { searchIcons } from './iconSearch'

// Run from the extension's folder, tsx compiles the webview's JSX to `React.createElement` (the classic runtime).
;(globalThis as unknown as { React: unknown }).React = React
const { createElement } = React
const { renderToStaticMarkup } = await import('react-dom/server')
const Menu = await import('@radix-ui/react-dropdown-menu')
const { IconGridItems } = await import('./IconGrid')

/** The menu as it opens for a box's icon `current`, parsed. */
function open(current: string | null) {
  const html = renderToStaticMarkup(createElement(Menu.Root, { open: true, modal: false },
    createElement(Menu.Trigger), createElement(Menu.Content, null, createElement(IconGridItems, { current, onPick: () => {} }))))
  const doc = createDocument(`<!doctype html><html><body>${html}</body></html>`)
  const field = doc.querySelector('input[placeholder="Search icons"]')
  const choices = Array.from(doc.querySelectorAll('[data-choice]'))
  assert.equal(choices.pop()?.getAttribute('data-choice'), 'none', "No icon is the last item")
  assert.equal(field?.hasAttribute('aria-activedescendant'), false, 'search opens without a highlighted choice')
  return { field: field?.getAttribute('value') ?? null, labels: choices.map(element => element.getAttribute('aria-label')), text: doc.body.textContent ?? '' }
}

const misspelt = open('trukc')
assert.equal(misspelt.field, 'trukc', 'the unknown name, as written, in the field')
assert.equal(searchIcons('trukc')[0].phosphor, 'truck')
assert.equal(misspelt.labels[0], searchIcons('trukc')[0].label, 'the nearest icon first')
assert.ok(!misspelt.text.includes('No icons match'))

const known = open('lightbulb')
assert.equal(known.field, '', 'a known icon: the field empty')
assert.equal(known.labels.length, SLIDE_ICON_NAMES.length, 'the deck (none here) and the 24')

assert.equal(open(null).field, '', 'no icon: the field empty')
assert.ok(open('qqzx-wvvk').text.includes('No icons match'), 'nothing near: No icons match')

console.log('IconGrid: passed (the menu opens with an unknown name searched, the nearest icons first)')

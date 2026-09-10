import { strict as assert } from 'node:assert'
import { DOMParser } from '@xmldom/xmldom'
import { marked } from 'marked'
import { createTurndownService } from './turndownService'
import {
  addTipTapTaskListTurndownRules,
  transformTaskListElements,
} from './taskListRoundTrip'

function parseFixture(html: string): Element {
  return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').documentElement
}

{
  const root = parseFixture('<ul><li><p>Keep this inline <input type="checkbox"/></p></li></ul>')
  transformTaskListElements(root)
  assert.equal(
    root.getElementsByTagName('ul')[0].getAttribute('data-type'),
    '',
    'a non-leading checkbox is not mistaken for persisted task syntax',
  )
}

{
  const root = parseFixture('<ul><li>Leading text<p><input type="checkbox"/> Not a task</p></li></ul>')
  transformTaskListElements(root)
  assert.equal(
    root.getElementsByTagName('ul')[0].getAttribute('data-type'),
    '',
    'a checkbox in a later paragraph is not mistaken for leading task syntax',
  )
}

function directChildren(element: Element, tagName: string): Element[] {
  return Array.from(element.childNodes).filter(
    (node): node is Element => node.nodeType === 1 && node.nodeName.toLowerCase() === tagName,
  )
}

function markedFixture(markdown: string): Element {
  return parseFixture(marked(markdown, { breaks: true, gfm: true }))
}

{
  const root = parseFixture(`
    <ul>
      <li><p><input checked="" disabled="" type="checkbox"/> Alpha</p></li>
      <li><p><input disabled="" type="checkbox"/> Beta</p></li>
    </ul>
  `)

  transformTaskListElements(root)

  const list = root.getElementsByTagName('ul')[0]
  const items = directChildren(list, 'li')
  assert.equal(list.getAttribute('data-type'), 'taskList', 'loose GFM list becomes a TipTap task list')
  assert.deepEqual(
    items.map(item => [item.getAttribute('data-type'), item.getAttribute('data-checked')]),
    [['taskItem', 'true'], ['taskItem', 'false']],
    'checked and unchecked state survives loose-list parsing',
  )
  assert.equal(root.getElementsByTagName('input').length, 0, 'Marked checkboxes are removed')
}

{
  const root = markedFixture('- [x] Tight checked\n- [ ] Tight unchecked')
  transformTaskListElements(root)

  const list = root.getElementsByTagName('ul')[0]
  assert.equal(list.getAttribute('data-type'), 'taskList', 'tight GFM list becomes a TipTap task list')
  assert.deepEqual(
    directChildren(list, 'li').map(item => item.getAttribute('data-checked')),
    ['true', 'false'],
  )
}

{
  const root = markedFixture('- [x] First\n\n- Ordinary\n\n- [ ] Last')
  transformTaskListElements(root)

  const lists = directChildren(root, 'ul')
  assert.deepEqual(
    lists.map(list => list.getAttribute('data-type') || 'bulletList'),
    ['taskList', 'bulletList', 'taskList'],
    'mixed GFM list is split into ordered task and bullet runs',
  )
  assert.deepEqual(
    lists.map(list => directChildren(list, 'li')[0].textContent?.trim()),
    ['First', 'Ordinary', 'Last'],
    'mixed-list item order and text survive the split',
  )
}

{
  const root = markedFixture('- [ ] Parent\n  - [x] Child')
  transformTaskListElements(root)

  const lists = Array.from(root.getElementsByTagName('ul'))
  assert.equal(lists.length, 2, 'nested task list structure is retained')
  assert.ok(lists.every(list => list.getAttribute('data-type') === 'taskList'))
  assert.deepEqual(
    Array.from(root.getElementsByTagName('li')).map(item => item.getAttribute('data-checked')),
    ['false', 'true'],
    'nested checked state survives parsing',
  )
}

{
  const service = createTurndownService()
  addTipTapTaskListTurndownRules(service)
  const markdown = service.turndown(`
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="true"><p>Ship RC</p></li>
      <li data-type="taskItem" data-checked="false"><p>Publish notes</p></li>
    </ul>
  `)

  assert.equal(markdown, '- [x] Ship RC\n- [ ] Publish notes', 'TipTap task nodes serialize to compact GFM')

  const reparsed = markedFixture(markdown)
  transformTaskListElements(reparsed)
  const items = Array.from(reparsed.getElementsByTagName('li'))
  assert.deepEqual(
    items.map(item => [item.getAttribute('data-type'), item.getAttribute('data-checked')]),
    [['taskItem', 'true'], ['taskItem', 'false']],
    'save and reopen preserves task semantics and checked state',
  )
}

{
  const service = createTurndownService()
  addTipTapTaskListTurndownRules(service)
  const markdown = service.turndown(`
    <ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>First</p></li></ul>
    <ul><li><p>Ordinary</p></li></ul>
    <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Last</p></li></ul>
  `)
  const reparsed = markedFixture(markdown)
  transformTaskListElements(reparsed)

  assert.deepEqual(
    directChildren(reparsed, 'ul').map(list => list.getAttribute('data-type') || 'bulletList'),
    ['taskList', 'bulletList', 'taskList'],
    'mixed task and bullet runs survive a complete save and reopen conversion',
  )
}

{
  const service = createTurndownService()
  addTipTapTaskListTurndownRules(service)
  assert.equal(
    service.turndown(`
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false">
          <p>Parent</p>
          <ul data-type="taskList">
            <li data-type="taskItem" data-checked="true"><p>Child</p></li>
          </ul>
        </li>
      </ul>
    `),
    '- [ ] Parent\n  - [x] Child',
    'nested TipTap task nodes serialize with GFM indentation',
  )
}

// LEADING WHITESPACE: `marked` separates the checkbox from the item text with a
// space, and in a loose list with a newline. Once the checkbox is removed that
// whitespace must not survive as item text, or the editor renders the newline
// and the text lands one line below its checkbox.
// `marked` also leaves formatting whitespace *after* `</p>`; that never reaches
// the editor's text node, so only the start of the item text is asserted here.
function itemTextStart(item: Element): string {
  return (item.textContent ?? '').replace(/\s+$/, '')
}

{
  const loose = markedFixture('- [ ] A\n\n- [x] B')
  transformTaskListElements(loose)
  const looseItems = directChildren(loose.getElementsByTagName('ul')[0], 'li')
  assert.deepEqual(looseItems.map(itemTextStart), ['A', 'B'], 'loose GFM items keep no whitespace or newline in front of their text')
  assert.ok(looseItems.every(item => !/^\s/.test(item.getElementsByTagName('p')[0].textContent ?? '')), 'the paragraph text node starts with the item text')

  const tight = markedFixture('- [ ] A\n- [x] B')
  transformTaskListElements(tight)
  assert.deepEqual(
    directChildren(tight.getElementsByTagName('ul')[0], 'li').map(itemTextStart),
    ['A', 'B'],
    'tight GFM items keep no whitespace in front of their text',
  )
}

{
  const root = parseFixture('<ul><li><p><input type="checkbox"/> First line<br/>second line</p></li></ul>')
  transformTaskListElements(root)
  const item = root.getElementsByTagName('li')[0]
  assert.equal(item.getAttribute('data-type'), 'taskItem')
  assert.equal(item.getElementsByTagName('br').length, 1, 'a hard break inside the item text is kept')
  assert.equal(item.textContent, 'First linesecond line', 'only the marker whitespace is removed')
}

// BARE MARKER: an empty task item is persisted as `- [ ]`. GFM parsers only
// recognise a marker followed by text, so `marked` leaves the bare form as the
// literal item text `[ ]`; reading it back must yield an empty task item.
{
  const root = markedFixture('- [ ]\n- [x]')
  transformTaskListElements(root)
  const list = root.getElementsByTagName('ul')[0]
  assert.equal(list.getAttribute('data-type'), 'taskList', 'bare markers make a task list')
  assert.deepEqual(
    directChildren(list, 'li').map(item => [item.getAttribute('data-type'), item.getAttribute('data-checked'), item.textContent]),
    [['taskItem', 'false', ''], ['taskItem', 'true', '']],
    'bare markers read back as empty unchecked and checked task items',
  )
}

{
  const root = markedFixture('- \\[ \\] not a task\n- plain')
  transformTaskListElements(root)
  assert.equal(
    root.getElementsByTagName('ul')[0].getAttribute('data-type'),
    '',
    'a literal marker followed by text is not a task item',
  )
}

{
  const service = createTurndownService()
  addTipTapTaskListTurndownRules(service)
  const markdown = service.turndown(`
    <ul data-type="taskList">
      <li data-type="taskItem" data-checked="false"><label contenteditable="false"><input type="checkbox"/><span></span></label><div><p></p></div></li>
      <li data-type="taskItem" data-checked="true"><label contenteditable="false"><input type="checkbox" checked=""/><span></span></label><div><p>Done</p></div></li>
    </ul>
  `)
  assert.equal(markdown, '- [ ]\n- [x] Done', 'an empty task item serializes as the bare marker, without a trailing space')

  const reparsed = markedFixture(markdown)
  transformTaskListElements(reparsed)
  assert.deepEqual(
    Array.from(reparsed.getElementsByTagName('li')).map(item => [item.getAttribute('data-type'), item.getAttribute('data-checked'), item.textContent]),
    [['taskItem', 'false', ''], ['taskItem', 'true', 'Done']],
    'save and reopen preserves an empty task item next to a filled one',
  )
}

console.log('taskListRoundTrip.test.ts — all assertions passed')

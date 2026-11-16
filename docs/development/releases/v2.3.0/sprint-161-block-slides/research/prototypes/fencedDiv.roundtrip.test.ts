/**
 * Sprint 161 spike: does a slide body with `:::` blocks come back byte for byte through the editor's own pipeline
 * (marked v9 → TipTap schema → getHTML → Turndown)? Run with `npx tsx`. Prints a table; fails on nothing.
 */
import { EditorState } from '@tiptap/pm/state'
import { schema, load, save } from './fencedDiv.roundtrip.harness'

const cases: Array<[string, string]> = [
  ['Quarto columns, blank lines', `# Copilot or Cursor?

:::: columns

::: column
### Copilot
When the work is documents and mail
:::

::: column
### Cursor
- Setting up the intent architecture
- Preparing a sprint
:::

::::`],
  ['tight columns (no blank lines)', `# Copilot or Cursor?
:::: columns
::: column
### Copilot
Text one
:::
::: column
### Cursor
Text two
:::
::::`],
  ['same colon count outside and in', `::: columns
::: column
A
:::
::: column
B
:::
:::`],
  ['no space before attributes', `:::{.columns}
:::{.column}
A
:::
:::{.column}
B
:::
:::`],
  ['Quarto attribute form with width', `:::: {.columns}

::: {.column width="40%"}
Left
:::

::: {.column width="60%"}
Right
:::

::::`],
  ['boxes with icons', `:::: boxes
::: {.box icon="lightbulb"}
### Idea
One line
:::
::: {.box icon="warning"}
### Risk
Another line
:::
::::`],
  ['steps with tag', `# Exercise
::: {.steps tag="Harjutus"}
1. Open the file
2. Ask the question
3. Check the answer
:::`],
  ['steps with empty tag', `::: {.steps tag=""}
1. One
2. Two
:::`],
  ['trailing colons on the open line', `::: column :::
Text
:::`],
  ['single quotes and unquoted values', `::: {.box icon='star' size=big}
Text
:::`],
  ['code fence inside a div holding :::', '::: column\n```\n:::\nnot a fence\n```\n:::'],
  ['blank line after open and before close', `::: column

Text

:::`],
  ['paragraph then close (Pandoc allows)', `::: column
First line
second line
:::`],
  ['text after the close, tight', `::: column
A
:::
After`],
  ['text before the open, tight', `Before
::: column
A
:::`],
  ['three levels', `:::: columns
::: column
:::: {.boxes}
::: box
X
:::
::::
:::
::::`],
  ['unclosed (stays text)', `::: column
Text`],
  ['stray close (stays text)', `Text

:::`],
  ['bare colons as text', `Ratio 3:::4 stays`],
  ['list item ending right before close', `::: column
- one
- two
:::`],
  ['image in a column', `::: column
![](images/x.png)
:::`],
  ['table in a box', `::: box
| A | B |
| --- | --- |
| 1 | 2 |
:::`],
]

let same = 0
const rows: string[] = []
for (const [name, markdown] of cases) {
  const doc = load(markdown)
  const out = save(doc)
  const types: string[] = []
  doc.descendants(node => { if (node.type.name === 'fencedDiv') types.push(String(node.attrs.class)) })
  const ok = out === markdown
  if (ok) same += 1
  rows.push(`${ok ? 'SAME' : 'DIFF'} | ${name} | divs: ${types.join(',') || '-'}${ok ? '' : `\n----- in\n${markdown}\n----- out\n${out}\n-----`}`)
}
console.log(rows.join('\n'))
console.log(`\n${same}/${cases.length} byte for byte`)

// Second save is stable (idempotent) for every case.
let stable = 0
for (const [, markdown] of cases) {
  const once = save(load(markdown))
  if (save(load(once)) === once) stable += 1
}
console.log(`${stable}/${cases.length} stable on a second open and save`)

// A typed paragraph that starts with ::: (the person's words) must not become a fence on the next open.
{
  const doc = load('Placeholder')
  const tr = doc.type.schema.nodes.paragraph.create(null, doc.type.schema.text('::: columns'))
  const typed = doc.copy(doc.content.replaceChild(0, tr))
  const out = save(typed)
  const reopened = load(out)
  let fence = false
  reopened.descendants(node => { if (node.type.name === 'fencedDiv') fence = true })
  console.log(`typed "::: columns" saves as ${JSON.stringify(out)}; reopens as a fence: ${fence}`)
}

// Words the person types that look like fences: a paragraph ":::" inside a column, and two typed lines.
{
  const doc = load('::: column\nA\n:::')
  const div = doc.firstChild!
  const para = schema.nodes.paragraph.create(null, schema.text(':::'))
  const edited = doc.copy(doc.content.replaceChild(0, div.copy(div.content.addToEnd(para))))
  const out = save(edited)
  const back = save(load(out))
  console.log(`a typed ":::" paragraph in a column saves as ${JSON.stringify(out)}; reopened and saved: ${JSON.stringify(back)} (${out === back ? 'stable' : 'CHANGED: the typed line closed the div'})`)
}
{
  const p = (t: string) => schema.nodes.paragraph.create(null, schema.text(t))
  const doc = schema.nodes.doc.create(null, [p('::: columns'), p('Middle'), p(':::')])
  const out = save(doc)
  let fence = false
  load(out).descendants(node => { if (node.type.name === 'fencedDiv') fence = true })
  console.log(`typed lines "::: columns" … ":::" save as ${JSON.stringify(out)}; reopen as a fence: ${fence}`)
}
// An edit inside one column leaves every other byte as written.
{
  const source = `# Copilot or Cursor?
:::: columns
::: column
### Copilot
Text one
:::
::: column
### Cursor
Text two
:::
::::`
  const doc = load(source)
  let target = -1
  doc.descendants((node, pos) => { if (target < 0 && node.isText && node.text === 'Text two') target = pos + node.nodeSize })
  const state = EditorState.create({ doc })
  const next = state.apply(state.tr.insertText(' and more', target))
  const out = save(next.doc)
  console.log(`edit in a column: ${out === source.replace('Text two', 'Text two and more') ? 'only the edit changed' : `OTHER BYTES CHANGED\n${out}`}`)
}
// A new column made in the editor (no recorded lines) writes the attributes' default form.
{
  const doc = load(':::: columns\n::: column\nA\n:::\n::::')
  const columns = doc.firstChild!
  const fresh = schema.nodes.fencedDiv.create({ open: '::: column', close: ':::', class: 'column' }, schema.nodes.paragraph.create(null, schema.text('B')))
  const edited = doc.copy(doc.content.replaceChild(0, columns.copy(columns.content.addToEnd(fresh))))
  console.log(`a column added in the editor writes:\n${save(edited)}`)
}

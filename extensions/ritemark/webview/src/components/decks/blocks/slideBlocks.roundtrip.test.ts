/**
 * Sprint 161: a block slide's `:::` blocks through the slide editor's own pipeline (scoped `marked` → TipTap →
 * Turndown) come back byte for byte: the 22 AI-written variants of the spike (research/prototypes), each stable on a
 * second open, and an edit in one column changes only those bytes. Run with `npx tsx`.
 */
import { strict as assert } from 'node:assert'
import { EditorState } from '@tiptap/pm/state'
import { loadSlide as load, saveSlide as save } from './slideEditorHarness'

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
for (const [name, markdown] of cases) {
  const out = save(load(markdown))
  assert.equal(out, markdown, `byte for byte: ${name}`)
  assert.equal(save(load(out)), out, `stable on a second open: ${name}`)
  same += 1
}

// The divs are read as divs (and a stray or unclosed fence as text).
{
  const kinds = (markdown: string) => {
    const found: string[] = []
    load(markdown).descendants(node => { if (node.type.name === 'slideDiv') found.push(String(node.attrs.class)) })
    return found
  }
  assert.deepEqual(kinds(':::: columns\n::: column\nA\n:::\n::: column\nB\n:::\n::::'), ['columns', 'column', 'column'])
  assert.deepEqual(kinds('::: {.steps tag=""}\n1. One\n:::'), ['steps'])
  assert.deepEqual(kinds('::: column\nText'), [], 'unclosed: text')
  assert.deepEqual(kinds('Text\n\n:::'), [], 'a stray close: text')
}

// An edit inside one column leaves every other byte as written.
{
  const source = '# Copilot or Cursor?\n:::: columns\n::: column\n### Copilot\nText one\n:::\n::: column\n### Cursor\nText two\n:::\n::::'
  const doc = load(source)
  let target = -1
  doc.descendants((node, pos) => { if (target < 0 && node.isText && node.text === 'Text two') target = pos + node.nodeSize })
  const state = EditorState.create({ doc })
  const next = state.apply(state.tr.insertText(' and more', target))
  assert.equal(save(next.doc), source.replace('Text two', 'Text two and more'))
}

console.log(`slideBlocks.roundtrip: ${same}/${cases.length} byte for byte and stable; an edit changes only its bytes`)

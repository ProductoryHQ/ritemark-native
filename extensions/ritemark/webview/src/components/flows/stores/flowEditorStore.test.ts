/**
 * Sprint 145 R4 (#571): selecting or measuring a Flow step writes nothing.
 *
 * React Flow reports a selection (`select`) and a measurement (`dimensions`) as node and edge changes too. The store
 * marked the flow dirty for every change, so opening a flow (its steps are measured once drawn) and clicking a step
 * each started the editor's autosave (`FlowEditor.tsx`, 500 ms after `isDirty`): the file was written on a look.
 * Neither is saved in the flow's file (`toFlow` keeps a step's id, type, position and data, an edge's id and ends),
 * so neither marks the flow dirty now. Moving, adding, removing and replacing a step, and adding or removing an edge,
 * still do.
 *
 * Run: npx tsx webview/src/components/flows/stores/flowEditorStore.test.ts
 */
import assert from 'node:assert/strict'
import type { EdgeChange, NodeChange } from '@xyflow/react'

Object.assign(globalThis, {
  window: { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1440 },
  acquireVsCodeApi: () => ({ postMessage: () => {}, getState: () => undefined, setState: () => {} }),
})

const { useFlowEditorStore } = await import('./flowEditorStore')
type Store = ReturnType<typeof useFlowEditorStore.getState>
type Flow = Parameters<Store['setFlow']>[0]

const flow: Flow = {
  id: 'weekly-brief',
  name: 'Weekly brief',
  description: '',
  version: 1,
  created: '',
  modified: '',
  inputs: [],
  nodes: [
    { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Start', inputs: [] } },
    { id: 'llm-1', type: 'llm-prompt', position: { x: 0, y: 200 }, data: { label: 'Write', provider: 'openai', model: '', systemPrompt: '', userPrompt: 'Hello', temperature: 0.7, maxTokens: 2000 } },
  ],
  edges: [{ id: 'edge-1', source: 'trigger-1', target: 'llm-1' }],
} as Flow

const store = () => useFlowEditorStore.getState()
const load = () => store().setFlow(flow, '/tmp/project')
const file = () => JSON.stringify(store().toFlow())

type StepChange = NodeChange<Store['nodes'][number]>

function nodesChange(changes: StepChange[]): boolean {
  load()
  assert.equal(store().isDirty, false, 'a loaded flow is clean')
  store().onNodesChange(changes)
  return store().isDirty
}

function edgesChange(changes: EdgeChange[]): boolean {
  load()
  store().onEdgesChange(changes)
  return store().isDirty
}

// ── A look: nothing to save ──────────────────────────────────────────────────

// Opening a flow: React Flow measures each step once it is drawn (A9: the save 510 ms after flow:load on main).
load()
const before = file()
assert.equal(
  nodesChange([
    { type: 'dimensions', id: 'trigger-1', dimensions: { width: 240, height: 88 } },
    { type: 'dimensions', id: 'llm-1', dimensions: { width: 240, height: 120 } },
  ]),
  false,
  'measuring the steps does not mark the flow dirty',
)
assert.equal(store().nodes.find((n) => n.id === 'llm-1')?.measured?.height, 120, 'the measurement still reaches the canvas')
assert.equal(file(), before, "a measurement is not in the flow's file")

// Clicking a step: React Flow selects it (and deselects what was selected).
assert.equal(
  nodesChange([
    { type: 'select', id: 'llm-1', selected: true },
    { type: 'select', id: 'trigger-1', selected: false },
  ]),
  false,
  'selecting a step does not mark the flow dirty',
)
assert.equal(store().nodes.find((n) => n.id === 'llm-1')?.selected, true, 'the selection still shows')
assert.equal(file(), before, "a selection is not in the flow's file")

// Clicking an edge is a look too.
assert.equal(edgesChange([{ type: 'select', id: 'edge-1', selected: true }]), false, 'selecting an edge does not mark the flow dirty')
assert.equal(store().edges.find((e) => e.id === 'edge-1')?.selected, true, 'the edge selection still shows')

// A look never clears a change that is waiting to be saved.
load()
store().markDirty()
store().onNodesChange([{ type: 'select', id: 'llm-1', selected: true }])
assert.equal(store().isDirty, true, 'a selection after an edit leaves the flow dirty')
store().onEdgesChange([{ type: 'select', id: 'edge-1', selected: true }])
assert.equal(store().isDirty, true, 'an edge selection after an edit leaves the flow dirty')

// ── An edit: saved, as before ────────────────────────────────────────────────

assert.equal(
  nodesChange([{ type: 'position', id: 'llm-1', position: { x: 40, y: 260 }, dragging: true }]),
  true,
  'dragging a step marks the flow dirty',
)
assert.deepEqual(store().toFlow().nodes.find((n) => n.id === 'llm-1')?.position, { x: 40, y: 260 }, 'the new position is saved')

assert.equal(
  nodesChange([{ type: 'remove', id: 'llm-1' }]),
  true,
  'removing a step marks the flow dirty',
)
assert.equal(store().nodes.some((n) => n.id === 'llm-1'), false, 'the step is gone')

const added = { id: 'save-1', type: 'saveFileNode', position: { x: 0, y: 400 }, data: { label: 'Save File', filename: 'out.md', format: 'markdown', folder: '', sourceNodeId: '' } }
assert.equal(nodesChange([{ type: 'add', item: added } as StepChange]), true, 'adding a step marks the flow dirty')
assert.equal(store().executionOrder.has('save-1'), true, 'the run order follows an added step')

const replaced = { ...store().nodes[1], data: { ...store().nodes[1].data, label: 'Rewrite' } }
assert.equal(nodesChange([{ type: 'replace', id: 'llm-1', item: replaced } as StepChange]), true, 'replacing a step marks the flow dirty')

// A batch with a look and an edit is an edit.
assert.equal(
  nodesChange([
    { type: 'select', id: 'llm-1', selected: false },
    { type: 'remove', id: 'llm-1' },
  ]),
  true,
  'a selection with a removal marks the flow dirty',
)

assert.equal(edgesChange([{ type: 'remove', id: 'edge-1' }]), true, 'removing an edge marks the flow dirty')
assert.equal(
  edgesChange([{ type: 'add', item: { id: 'edge-2', source: 'trigger-1', target: 'llm-1' } }]),
  true,
  'adding an edge marks the flow dirty',
)

// Editing a step's fields still marks it dirty (the panel's path, not a React Flow change).
load()
store().updateNodeData('llm-1', { userPrompt: 'Hello again' })
assert.equal(store().isDirty, true, "editing a step's field marks the flow dirty")

console.log('flowEditorStore.test.ts passed')

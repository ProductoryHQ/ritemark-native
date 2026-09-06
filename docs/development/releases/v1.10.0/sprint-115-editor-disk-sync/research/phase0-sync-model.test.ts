import assert from 'node:assert/strict'
import test from 'node:test'

type LegacyState = {
  disk: string
  model: string
  view: string
  focused: boolean
  dirty: boolean
  lastSent: string
  selfHashes: string[]
  autoReloadPending: boolean
}

function rememberLegacySelf(state: LegacyState, content: string): void {
  state.selfHashes.push(content)
  if (state.selfHashes.length > 20) state.selfHashes.shift()
}

function legacyReconcile(state: LegacyState): void {
  if (state.dirty && state.disk !== state.model) {
    if (!state.selfHashes.includes(state.disk)) state.autoReloadPending = true
    return
  }
  if (state.disk === state.lastSent) return

  // Current host behavior records delivery before the focused editor decides
  // whether it can apply the payload.
  state.lastSent = state.disk
  rememberLegacySelf(state, state.disk)
  if (!state.focused) state.view = state.disk
}

function fireLegacyAutoReload(state: LegacyState): void {
  if (!state.autoReloadPending) return
  state.model = state.disk
  state.view = state.disk
  state.dirty = true
  state.autoReloadPending = false
}

test('legacy clean external write wedges a focused view until reconstruction', () => {
  const state: LegacyState = {
    disk: 'A', model: 'A', view: 'A', focused: true, dirty: false,
    lastSent: 'A', selfHashes: ['A'], autoReloadPending: false,
  }

  state.disk = 'AGENT'
  legacyReconcile(state)
  assert.equal(state.lastSent, 'AGENT')
  assert.equal(state.view, 'A')

  legacyReconcile(state)
  assert.equal(state.view, 'A', 'level poll is suppressed by lastSent even though the view is stale')
})
test('legacy bounded self-history turns normal autosave lag into destructive reload', () => {
  const state: LegacyState = {
    disk: 'BASE', model: 'BASE', view: 'BASE', focused: true, dirty: false,
    lastSent: 'BASE', selfHashes: ['BASE'], autoReloadPending: false,
  }

  for (let index = 1; index <= 20; index += 1) {
    const local = `LOCAL-${index}`
    state.model = local
    state.view = local
    state.lastSent = local
    state.dirty = true
    rememberLegacySelf(state, local)
  }

  assert.equal(state.selfHashes.includes('BASE'), false)
  legacyReconcile(state)
  assert.equal(state.autoReloadPending, true)
  fireLegacyAutoReload(state)
  assert.equal(state.model, 'BASE')
  assert.equal(state.view, 'BASE')
})

test('legacy per-path cleanup lets one split view disable synchronization for another', () => {
  const perPathPoll = new Map<string, string>([['/doc.md', 'view-1']])
  const openViews = new Set(['view-1', 'view-2'])

  openViews.delete('view-1')
  perPathPoll.delete('/doc.md')

  assert.equal(openViews.has('view-2'), true)
  assert.equal(perPathPoll.has('/doc.md'), false)
})

type ReconcileInput = {
  baseDisk: string
  baseModel: string
  disk: string
  model: string
}

type ReconcileClass = 'synced' | 'local-only' | 'external-only' | 'conflict'

function classify(input: ReconcileInput): ReconcileClass {
  if (input.disk === input.model) return 'synced'
  const diskAdvanced = input.disk !== input.baseDisk
  const modelAdvanced = input.model !== input.baseModel
  if (diskAdvanced && modelAdvanced) return 'conflict'
  if (diskAdvanced) return 'external-only'
  if (modelAdvanced) return 'local-only'
  return 'synced'
}

test('proposed three-way classification keeps local-only state quiet', () => {
  assert.equal(classify({ baseDisk: 'A', baseModel: 'A', disk: 'A', model: 'LOCAL' }), 'local-only')
  assert.equal(classify({ baseDisk: 'A', baseModel: 'A', disk: 'AGENT', model: 'A' }), 'external-only')
  assert.equal(classify({ baseDisk: 'A', baseModel: 'A', disk: 'AGENT', model: 'LOCAL' }), 'conflict')
  assert.equal(classify({ baseDisk: 'A', baseModel: 'A', disk: 'SAVED', model: 'SAVED' }), 'synced')
})

type ViewReceipt = {
  epoch: string
  sentRevision: number
  acknowledgedRevision: number
  payloadHash: string
}

function acknowledge(
  view: ViewReceipt,
  message: { epoch: string; revision: number; payloadHash: string },
): boolean {
  if (message.epoch !== view.epoch) return false
  if (message.revision !== view.sentRevision) return false
  if (message.payloadHash !== view.payloadHash) return false
  view.acknowledgedRevision = message.revision
  return true
}

test('only the exact current view receipt proves visible application', () => {
  const view: ViewReceipt = {
    epoch: 'view-b', sentRevision: 4, acknowledgedRevision: 2, payloadHash: 'payload-4',
  }
  assert.equal(acknowledge(view, { epoch: 'view-a', revision: 4, payloadHash: 'payload-4' }), false)
  assert.equal(acknowledge(view, { epoch: 'view-b', revision: 3, payloadHash: 'payload-4' }), false)
  assert.equal(acknowledge(view, { epoch: 'view-b', revision: 4, payloadHash: 'wrong' }), false)
  assert.equal(view.acknowledgedRevision, 2)
  assert.equal(acknowledge(view, { epoch: 'view-b', revision: 4, payloadHash: 'payload-4' }), true)
  assert.equal(view.acknowledgedRevision, 4)
})

test('multiple views acknowledge independently while sharing one URI state', () => {
  const views = new Map<string, ViewReceipt>([
    ['view-1', { epoch: 'a', sentRevision: 7, acknowledgedRevision: 6, payloadHash: 'p7' }],
    ['view-2', { epoch: 'b', sentRevision: 7, acknowledgedRevision: 6, payloadHash: 'p7' }],
  ])

  assert.equal(acknowledge(views.get('view-1')!, { epoch: 'a', revision: 7, payloadHash: 'p7' }), true)
  views.delete('view-1')
  assert.equal(views.get('view-2')?.acknowledgedRevision, 6)
  assert.equal(acknowledge(views.get('view-2')!, { epoch: 'b', revision: 7, payloadHash: 'p7' }), true)
})

test('conflict resolution refuses a stale disk precondition', () => {
  const conflictDiskHash = 'disk-4'
  const currentDiskHash = 'disk-5'
  const mayResolve = conflictDiskHash === currentDiskHash
  assert.equal(mayResolve, false)
})

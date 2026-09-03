import assert from 'node:assert/strict'
import {
  deriveRuntimeAvailabilities,
  listReadyAlternatives,
  resolveAvailableRuntimeModel,
  type RuntimeAvailabilityInput,
} from './runtimeAvailability'

const readyProbe = { phase: 'ready' as const, error: null }
const base: RuntimeAvailabilityInput = {
  runtimeHydration: {
    'claude-code': readyProbe,
    codex: readyProbe,
    opencode: readyProbe,
  },
  setupStatus: {
    cliInstalled: true,
    runnable: true,
    authenticated: true,
    authMethod: 'claude-oauth',
    state: 'ready',
    diagnostics: [],
    repairAction: null,
    error: null,
  },
  codexStatus: {
    enabled: true,
    state: 'ready',
    version: '0.153.0',
    authMethod: 'chatgpt',
    email: 'user@example.com',
    plan: 'Pro',
    error: null,
    diagnostics: [],
    repairCommand: null,
    binaryPath: '/runtime/codex',
    compatibility: null,
  },
  opencodeEnabled: true,
  acpProviders: { google: true, openai: false, anthropic: false, openrouter: false },
  byokProviderModels: {
    google: [{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Test model' }],
  },
}

{
  const availability = deriveRuntimeAvailabilities({
    ...base,
    setupStatus: { ...base.setupStatus!, authenticated: false, state: 'needs-auth' },
  })
  assert.equal(availability['claude-code'].state, 'needs-auth')
  assert.equal(availability['claude-code'].usable, false)
  assert.equal(availability.codex.usable, true)
  assert.deepEqual(listReadyAlternatives(availability, 'claude-code'), ['codex', 'opencode'])
}

{
  const availability = deriveRuntimeAvailabilities({
    ...base,
    codexStatus: { ...base.codexStatus, state: 'needs-auth', authMethod: null, email: null, plan: null },
  })
  assert.equal(availability.codex.state, 'needs-auth')
  assert.equal(availability.codex.usable, false)
  assert.deepEqual(listReadyAlternatives(availability, 'codex'), ['claude-code', 'opencode'])
}

{
  const availability = deriveRuntimeAvailabilities({
    ...base,
    runtimeHydration: { ...base.runtimeHydration, codex: { phase: 'checking', error: null } },
  })
  assert.equal(availability.codex.state, 'checking')
  assert.equal(availability.codex.usable, false)
}

{
  const availability = deriveRuntimeAvailabilities({
    ...base,
    runtimeHydration: { ...base.runtimeHydration, 'claude-code': { phase: 'error', error: 'probe failed' } },
  })
  assert.equal(availability['claude-code'].state, 'error')
  assert.equal(availability['claude-code'].detail, 'probe failed')
}

{
  const availability = deriveRuntimeAvailabilities({
    ...base,
    setupStatus: { ...base.setupStatus!, state: 'not-installed', cliInstalled: false, runnable: false, authenticated: false },
    codexStatus: { ...base.codexStatus, state: 'broken-install', email: null, plan: null },
    opencodeEnabled: true,
    acpProviders: { google: false, openai: false, anthropic: false, openrouter: false },
  })
  assert.equal(availability['claude-code'].state, 'not-installed')
  assert.equal(availability.codex.state, 'broken')
  assert.equal(availability.opencode.state, 'needs-configuration')
  assert.deepEqual(listReadyAlternatives(availability, 'claude-code'), [])
}

{
  const availability = deriveRuntimeAvailabilities({ ...base, opencodeEnabled: false })
  assert.equal(availability.opencode.state, 'disabled')
}

const catalogs = {
  claude: [
    { id: 'claude-opus-5', label: 'Opus 5', description: 'Test', aliases: ['claude-opus-5[1m]'] },
  ],
  codex: [
    { id: 'gpt-5.6-sol', label: 'GPT-5.6-Sol', description: 'Test' },
  ],
  opencode: {
    google: [{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Test' }],
  },
  acpProviders: { google: true, openai: false, anthropic: false, openrouter: false },
}

{
  const selection = { claude: 'claude-opus-5[1m]', codex: 'retired-codex', opencode: 'google/retired' }
  assert.equal(resolveAvailableRuntimeModel('claude-code', selection, catalogs), 'claude-opus-5')
  assert.equal(resolveAvailableRuntimeModel('codex', selection, catalogs), 'gpt-5.6-sol')
  assert.equal(resolveAvailableRuntimeModel('opencode', selection, catalogs), 'google/gemini-2.5-pro')
}

{
  const noConfiguredModel = {
    ...catalogs,
    acpProviders: { google: false, openai: false, anthropic: false, openrouter: false },
  }
  assert.equal(resolveAvailableRuntimeModel(
    'opencode',
    { claude: '', codex: '', opencode: 'google/gemini-2.5-pro' },
    noConfiguredModel,
  ), null)
}

console.log('runtimeAvailability tests passed.')

import assert from 'node:assert/strict'
import { GEMINI_MODEL_IDS, toOpenCodeModelId } from '../../../../src/ai/modelConfig'
import {
  anotherOpenCodeModel,
  deriveRuntimeAvailabilities,
  listReadyAlternatives,
  resolveAvailableRuntimeModel,
  stillLimitedOpenCodeModels,
  type RuntimeAvailabilityInput,
} from './runtimeAvailability'

const GOOGLE_NEON = toOpenCodeModelId('google', GEMINI_MODEL_IDS.NEON_4)
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

// Sprint 160 (#686): the model OpenCode's usage-limit card offers instead of the one at its limit.
{
  const limitCatalogs = {
    opencode: {
      google: [
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', description: 'Test' },
        { id: 'gemini-old', label: 'Gemini Old', description: 'Test', hidden: true },
        { id: 'gemini-3.8-pro', label: 'Gemini 3.8 Pro', description: 'Test' },
      ],
      openai: [{ id: 'gpt-5.6', label: 'GPT-5.6', description: 'Test' }],
    },
    acpProviders: { google: true, openai: true, anthropic: false, openrouter: false },
  }
  assert.equal(anotherOpenCodeModel('google/gemini-3.8-flash', limitCatalogs), 'google/gemini-3.8-pro', "the same provider's next shown model")
  assert.equal(anotherOpenCodeModel('opencode:google/gemini-3.8-flash', limitCatalogs), 'google/gemini-3.8-pro', 'the opencode: prefix is read')
  assert.equal(anotherOpenCodeModel('google/gemini-3.8-pro', limitCatalogs), 'google/gemini-3.8-flash')
  assert.equal(anotherOpenCodeModel('openai/gpt-5.6', limitCatalogs), 'google/gemini-3.8-flash', 'no other model there: another provider with a key')
  const googleOnlyOne = { ...limitCatalogs, opencode: { google: [limitCatalogs.opencode.google[0]] }, acpProviders: { ...limitCatalogs.acpProviders, openai: false } }
  assert.equal(anotherOpenCodeModel('google/gemini-3.8-flash', googleOnlyOne), null, 'nothing else to use')
  const noKey = { ...limitCatalogs, acpProviders: { google: true, openai: false, anthropic: false, openrouter: false } }
  assert.equal(anotherOpenCodeModel('openai/gpt-5.6', noKey), 'google/gemini-3.8-flash', 'never a provider without a key')
  assert.equal(anotherOpenCodeModel(undefined, limitCatalogs), 'google/gemini-3.8-flash', 'the model unknown: the first one')

  // Review finding 2: two models at their limit are never offered in turn.
  assert.equal(
    anotherOpenCodeModel('google/gemini-3.8-pro', limitCatalogs, ['google/gemini-3.8-flash']),
    'openai/gpt-5.6',
    'Flash is still at its limit: another provider instead',
  )
  assert.equal(anotherOpenCodeModel('google/gemini-3.8-pro', limitCatalogs, ['opencode:google/gemini-3.8-flash', 'openai/gpt-5.6']), null, 'nothing left')

  const now = Date.parse('2026-11-16T13:00:00.000Z')
  const turn = (model: string, extra: { retryAt?: string } = {}, runtime = 'opencode') => ({
    runtime,
    timestamp: now - 60_000,
    result: { errorKind: 'limit', errorDetail: { limit: 'plan' as const, model, ...extra } },
  })
  assert.deepEqual(stillLimitedOpenCodeModels([
    turn('google/gemini-3.8-flash', { retryAt: '2026-11-16T13:00:41.000Z' }),
    turn('google/gemini-3.8-pro', { retryAt: '2026-11-16T12:59:00.000Z' }),
    turn(GOOGLE_NEON),
    turn('openai/gpt-5.6', {}, 'codex'),
    { runtime: 'opencode', timestamp: now, result: { errorKind: 'limit', errorDetail: { billing: 'google', limit: 'quota' } } },
    { runtime: 'opencode', timestamp: now - 2 * 24 * 3600_000, result: { errorKind: 'limit', errorDetail: { limit: 'plan', model: 'google/gemini-old' } } },
    { runtime: 'opencode', timestamp: now },
  ], now), ['google/gemini-3.8-flash', GOOGLE_NEON],
  'a time still ahead, or no time and less than a day old; never a passed time, another AI, a quota, or an old turn')
}

console.log('runtimeAvailability tests passed.')

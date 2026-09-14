import assert from 'node:assert/strict';
import {
  deriveRuntimeAvailabilities,
  listReadyAlternatives,
  messageForRuntimeAvailability,
  recoveryForRuntimeAvailability,
  RUNTIME_LABELS,
  type RuntimeAvailabilityInput,
} from './availability';

function input(overrides: Partial<RuntimeAvailabilityInput> = {}): RuntimeAvailabilityInput {
  return {
    runtimeHydration: {
      'claude-code': { phase: 'ready', error: null },
      codex: { phase: 'ready', error: null },
      opencode: { phase: 'ready', error: null },
    },
    setupStatus: { state: 'ready', error: null },
    codexStatus: { state: 'ready', error: null },
    opencodeEnabled: true,
    acpProviders: { google: true, openai: false, anthropic: false, openrouter: false },
    byokProviderModels: { google: [{ id: 'gemini-2.5-pro' }] },
    ...overrides,
  };
}

// ── Claude ───────────────────────────────────────────────────────────────────

assert.equal(deriveRuntimeAvailabilities(input())['claude-code'].state, 'ready');
assert.equal(deriveRuntimeAvailabilities(input())['claude-code'].usable, true);

assert.equal(
  deriveRuntimeAvailabilities(input({ setupStatus: null }))['claude-code'].state,
  'checking',
  'no setup status yet means checking, never ready',
);

const signedOut = deriveRuntimeAvailabilities(
  input({ setupStatus: { state: 'needs-auth', error: 'Session expired' } }),
)['claude-code'];
assert.equal(signedOut.state, 'needs-auth');
assert.equal(signedOut.usable, false);
assert.equal(signedOut.detail, 'Session expired');

assert.equal(
  deriveRuntimeAvailabilities(
    input({ setupStatus: { state: 'not-installed', error: null } }),
  )['claude-code'].state,
  'not-installed',
);
assert.equal(
  deriveRuntimeAvailabilities(
    input({ setupStatus: { state: 'broken-install', error: 'bad binary' } }),
  )['claude-code'].state,
  'broken',
);

// A probe that has not finished outranks an otherwise ready status: a completed
// probe is never treated as authentication by itself.
assert.equal(
  deriveRuntimeAvailabilities(input({
    runtimeHydration: {
      'claude-code': { phase: 'checking', error: null },
      codex: { phase: 'ready', error: null },
      opencode: { phase: 'ready', error: null },
    },
  }))['claude-code'].state,
  'checking',
);
assert.equal(
  deriveRuntimeAvailabilities(input({
    runtimeHydration: {
      'claude-code': { phase: 'error', error: 'probe blew up' },
      codex: { phase: 'ready', error: null },
      opencode: { phase: 'ready', error: null },
    },
  }))['claude-code'].detail,
  'probe blew up',
);

// ── Codex ────────────────────────────────────────────────────────────────────

assert.equal(deriveRuntimeAvailabilities(input()).codex.state, 'ready');
assert.equal(
  deriveRuntimeAvailabilities(input({ codexStatus: { state: 'disabled', error: null } })).codex.state,
  'disabled',
);
assert.equal(
  deriveRuntimeAvailabilities(input({ codexStatus: { state: 'checking', error: null } })).codex.state,
  'checking',
);
assert.equal(
  deriveRuntimeAvailabilities(
    input({ codexStatus: { state: 'auth-in-progress', error: null } }),
  ).codex.state,
  'auth-in-progress',
);

// ── OpenCode ─────────────────────────────────────────────────────────────────

assert.equal(
  deriveRuntimeAvailabilities(input({ opencodeEnabled: false })).opencode.state,
  'disabled',
  'the flag is checked before any probe',
);
assert.equal(
  deriveRuntimeAvailabilities(input({
    acpProviders: { google: false, openai: false, anthropic: false, openrouter: false },
  })).opencode.state,
  'needs-configuration',
  'no provider key means nothing to run',
);
assert.equal(
  deriveRuntimeAvailabilities(input({ byokProviderModels: { google: [] } })).opencode.state,
  'needs-configuration',
  'a configured provider with no model is still not runnable',
);
assert.equal(
  deriveRuntimeAvailabilities(input({
    acpProviders: { google: false, openai: true, anthropic: false, openrouter: false },
    byokProviderModels: { google: [{ id: 'gemini-2.5-pro' }] },
  })).opencode.state,
  'needs-configuration',
  'models must belong to a provider that is actually configured',
);
assert.equal(deriveRuntimeAvailabilities(input()).opencode.state, 'ready');

// ── Alternatives ─────────────────────────────────────────────────────────────

assert.deepEqual(
  listReadyAlternatives(deriveRuntimeAvailabilities(input()), 'claude-code'),
  ['codex', 'opencode'],
);
assert.deepEqual(
  listReadyAlternatives(
    deriveRuntimeAvailabilities(input({ codexStatus: { state: 'needs-auth', error: null } })),
    'claude-code',
  ),
  ['opencode'],
);

// ── Recovery mapping (the comment-task gate reads this) ──────────────────────

assert.equal(recoveryForRuntimeAvailability('needs-auth'), 'sign-in');
assert.equal(recoveryForRuntimeAvailability('needs-configuration'), 'configure');
assert.equal(recoveryForRuntimeAvailability('not-installed'), 'install');
assert.equal(recoveryForRuntimeAvailability('checking'), 'retry');
assert.equal(recoveryForRuntimeAvailability('auth-in-progress'), 'retry');
assert.equal(recoveryForRuntimeAvailability('broken'), 'none');
assert.equal(recoveryForRuntimeAvailability('disabled'), 'none');
assert.equal(recoveryForRuntimeAvailability('error'), 'none');
assert.equal(recoveryForRuntimeAvailability('ready'), 'none');

// ── Messages name the runtime and never invent a cause ───────────────────────

assert.equal(RUNTIME_LABELS['claude-code'], 'Claude');
assert.ok(
  messageForRuntimeAvailability('codex', { state: 'needs-auth', usable: false, detail: null })
    .startsWith('Codex is signed out'),
);
assert.equal(
  messageForRuntimeAvailability('claude-code', { state: 'broken', usable: false, detail: 'bad binary' }),
  'bad binary',
  'a normalized provider detail is preferred over our own wording',
);
assert.equal(
  messageForRuntimeAvailability('claude-code', { state: 'broken', usable: false, detail: null }),
  'Claude is installed but cannot run.',
);
assert.ok(
  messageForRuntimeAvailability('opencode', { state: 'needs-configuration', usable: false, detail: null })
    .includes('OpenCode'),
);

console.log('runtime/availability: all assertions passed');

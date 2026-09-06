/**
 * Executable pre-implementation model for the v1.10.0 Agent Chat bootstrap
 * correction. This is deliberately independent of production modules: it
 * validates the proposed state/ordering contract before implementation.
 *
 * Run from extensions/ritemark:
 *   npx tsx ../../docs/development/releases/v1.10.0/research/rc-agent-bootstrap-model.test.ts
 */

import assert from 'node:assert/strict';

type RuntimeId = 'claude-code' | 'codex' | 'opencode';
type Phase = 'waiting' | 'configured' | 'error';
type RuntimePhase = 'checking' | 'ready' | 'error';

interface ModelRow {
  id: string;
  aliases?: string[];
}

interface Conversation {
  runtimeId: RuntimeId;
  modelId: string;
}

interface State {
  generation: number;
  phase: Phase;
  bootstrapError: string | null;
  readyRequests: number;
  hydrationStarts: number;
  models: Record<RuntimeId, ModelRow[]>;
  defaultModels: Record<RuntimeId, string>;
  selectedModel: Record<RuntimeId, string>;
  conversation: Conversation;
  runtimeStatus: Record<RuntimeId, RuntimePhase>;
  apiKeyKnown: boolean;
  discoveryCount: number | null;
  latestRevision: Record<'claude' | 'codex' | 'opencode' | 'discovery', number>;
}

interface Bootstrap {
  generation: number;
  models: Record<RuntimeId, ModelRow[]>;
  defaultModels: Record<RuntimeId, string>;
  selectedModel: Record<RuntimeId, string>;
}

function initialState(generation = 1): State {
  return {
    generation,
    phase: 'waiting',
    bootstrapError: null,
    readyRequests: 0,
    hydrationStarts: 0,
    models: { 'claude-code': [], codex: [], opencode: [] },
    defaultModels: { 'claude-code': '', codex: '', opencode: '' },
    selectedModel: { 'claude-code': '', codex: '', opencode: '' },
    conversation: { runtimeId: 'claude-code', modelId: '' },
    runtimeStatus: { 'claude-code': 'checking', codex: 'checking', opencode: 'checking' },
    apiKeyKnown: false,
    discoveryCount: null,
    latestRevision: { claude: 0, codex: 0, opencode: 0, discovery: 0 },
  };
}

function resolveModel(rows: ModelRow[], candidate: string, fallback: string): string {
  const hit = rows.find((row) => row.id === candidate || row.aliases?.includes(candidate));
  if (hit) return hit.id;
  const fallbackHit = rows.find((row) => row.id === fallback || row.aliases?.includes(fallback));
  return fallbackHit?.id ?? rows[0]?.id ?? '';
}

function requestReady(state: State): State {
  const first = state.readyRequests === 0;
  return {
    ...state,
    readyRequests: state.readyRequests + 1,
    hydrationStarts: state.hydrationStarts + (first ? 1 : 0),
  };
}

function applyBootstrap(state: State, message: Bootstrap): State {
  if (message.generation !== state.generation) return state;
  if (message.models['claude-code'].length === 0 || message.models.codex.length === 0) {
    return { ...state, phase: 'error', bootstrapError: 'Required model catalog is empty.' };
  }

  const selectedModel = {
    'claude-code': resolveModel(
      message.models['claude-code'],
      message.selectedModel['claude-code'],
      message.defaultModels['claude-code'],
    ),
    codex: resolveModel(message.models.codex, message.selectedModel.codex, message.defaultModels.codex),
    opencode: resolveModel(
      message.models.opencode,
      message.selectedModel.opencode,
      message.defaultModels.opencode,
    ),
  };
  const runtimeId = state.conversation.runtimeId;
  const conversationModel = resolveModel(
    message.models[runtimeId],
    state.conversation.modelId || selectedModel[runtimeId],
    message.defaultModels[runtimeId],
  );

  return {
    ...state,
    phase: 'configured',
    bootstrapError: null,
    models: message.models,
    defaultModels: message.defaultModels,
    selectedModel,
    conversation: { ...state.conversation, modelId: conversationModel },
  };
}

function restoreConversation(state: State, conversation: Conversation): State {
  const rows = state.models[conversation.runtimeId];
  const modelId = state.phase === 'configured'
    ? resolveModel(
        rows,
        conversation.modelId || state.selectedModel[conversation.runtimeId],
        state.defaultModels[conversation.runtimeId],
      )
    : conversation.modelId;
  return { ...state, conversation: { ...conversation, modelId } };
}

function applyOperationalStatus(
  state: State,
  domain: keyof State['latestRevision'],
  revision: number,
  status: RuntimePhase | number,
): State {
  if (revision < state.latestRevision[domain]) return state;
  const latestRevision = { ...state.latestRevision, [domain]: revision };
  if (domain === 'discovery') {
    return { ...state, latestRevision, discoveryCount: status as number };
  }
  const runtimeId: RuntimeId = domain === 'claude' ? 'claude-code' : domain;
  return {
    ...state,
    latestRevision,
    runtimeStatus: { ...state.runtimeStatus, [runtimeId]: status as RuntimePhase },
  };
}

function applyApiKeyStatus(state: State): State {
  return { ...state, apiKeyKnown: true };
}

function replaceView(state: State, generation: number): State {
  return initialState(generation);
}

const bootstrap: Bootstrap = {
  generation: 1,
  models: {
    'claude-code': [
      { id: 'claude-opus-5[1m]', aliases: ['default', 'opus[1m]'] },
      { id: 'claude-sonnet-5' },
    ],
    codex: [{ id: 'gpt-5.6-sol' }],
    opencode: [{ id: 'anthropic/claude-sonnet-5' }],
  },
  defaultModels: {
    'claude-code': 'default',
    codex: 'gpt-5.6-sol',
    opencode: 'anthropic/claude-sonnet-5',
  },
  selectedModel: {
    'claude-code': 'opus[1m]',
    codex: 'gpt-5.6-sol',
    opencode: '',
  },
};

function canonicalResult(state: State): Pick<State, 'phase' | 'models' | 'selectedModel' | 'conversation'> {
  return {
    phase: state.phase,
    models: state.models,
    selectedModel: state.selectedModel,
    conversation: state.conversation,
  };
}

function testApiKeyCannotDeclareBootstrapReady(): void {
  const state = applyApiKeyStatus(requestReady(initialState()));
  assert.equal(state.apiKeyKnown, true);
  assert.equal(state.phase, 'waiting');
  assert.equal(state.models['claude-code'].length, 0);
}

function testBootstrapReconcilesAliasAtomically(): void {
  const state = applyBootstrap(requestReady(initialState()), bootstrap);
  assert.equal(state.phase, 'configured');
  assert.equal(state.selectedModel['claude-code'], 'claude-opus-5[1m]');
  assert.equal(state.conversation.modelId, 'claude-opus-5[1m]');
  assert.equal(state.models['claude-code'].length, 2);
}

function testRestoreAndBootstrapCommute(): void {
  const restored: Conversation = { runtimeId: 'claude-code', modelId: 'opus[1m]' };
  const bootstrapThenRestore = restoreConversation(applyBootstrap(initialState(), bootstrap), restored);
  const restoreThenBootstrap = applyBootstrap(restoreConversation(initialState(), restored), bootstrap);
  assert.deepEqual(canonicalResult(bootstrapThenRestore), canonicalResult(restoreThenBootstrap));
}

function testOperationalFailuresCannotEraseCatalog(): void {
  let state = applyBootstrap(initialState(), bootstrap);
  const before = canonicalResult(state);
  state = applyOperationalStatus(state, 'claude', 1, 'error');
  state = applyOperationalStatus(state, 'codex', 1, 'error');
  state = applyOperationalStatus(state, 'opencode', 1, 'error');
  state = applyOperationalStatus(state, 'discovery', 1, 0);
  assert.deepEqual(canonicalResult(state), before);
  assert.deepEqual(state.runtimeStatus, { 'claude-code': 'error', codex: 'error', opencode: 'error' });
}

function testLatestOperationalRevisionWins(): void {
  let state = applyBootstrap(initialState(), bootstrap);
  state = applyOperationalStatus(state, 'claude', 2, 'ready');
  state = applyOperationalStatus(state, 'claude', 1, 'error');
  assert.equal(state.runtimeStatus['claude-code'], 'ready');
}

function testOldViewCannotHydrateReplacement(): void {
  let state = replaceView(initialState(), 2);
  state = applyBootstrap(state, bootstrap); // generation 1
  assert.equal(state.phase, 'waiting');
  state = applyBootstrap(state, { ...bootstrap, generation: 2 });
  assert.equal(state.phase, 'configured');
}

function testDuplicateReadyIsIdempotent(): void {
  let state = requestReady(initialState());
  state = requestReady(state);
  assert.equal(state.readyRequests, 2);
  assert.equal(state.hydrationStarts, 1);
}

function testBrokenBootstrapIsExplicit(): void {
  const state = applyBootstrap(initialState(), {
    ...bootstrap,
    models: { ...bootstrap.models, 'claude-code': [] },
  });
  assert.equal(state.phase, 'error');
  assert.match(state.bootstrapError ?? '', /catalog is empty/i);
}

type HydrationDomain = 'claude' | 'codex' | 'opencode' | 'discovery';

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error('domain timeout')), timeoutMs);
    }),
  ]);
}

async function hydrateIndependently(
  state: State,
  tasks: Record<HydrationDomain, Promise<RuntimePhase | number>>,
  timeoutMs = 10,
): Promise<State> {
  let next = state;
  await Promise.all((Object.entries(tasks) as [HydrationDomain, Promise<RuntimePhase | number>][]).map(
    async ([domain, task], index) => {
      try {
        const result = await withDeadline(task, timeoutMs);
        next = applyOperationalStatus(next, domain, index + 1, result);
      } catch {
        next = applyOperationalStatus(next, domain, index + 1, domain === 'discovery' ? 0 : 'error');
      }
    },
  ));
  return next;
}

async function testHydrationFailuresAreIsolated(): Promise<void> {
  const never = new Promise<RuntimePhase>(() => undefined);
  const configured = applyBootstrap(initialState(), bootstrap);
  const before = canonicalResult(configured);
  const hydrated = await hydrateIndependently(configured, {
    claude: Promise.resolve('ready'),
    codex: never,
    opencode: Promise.reject(new Error('SecretStorage unavailable')),
    discovery: Promise.reject(new Error('workspace scan failed')),
  });

  assert.deepEqual(canonicalResult(hydrated), before, 'operational failures cannot mutate bootstrap state');
  assert.equal(hydrated.runtimeStatus['claude-code'], 'ready');
  assert.equal(hydrated.runtimeStatus.codex, 'error');
  assert.equal(hydrated.runtimeStatus.opencode, 'error');
  assert.equal(hydrated.discoveryCount, 0);
}

async function testBootstrapDeliveryPrecedesHydration(): Promise<void> {
  const order: string[] = [];
  const deliverBootstrap = async () => {
    await Promise.resolve();
    order.push('bootstrap-delivered');
  };
  const startHydration = () => order.push('hydration-started');

  await deliverBootstrap();
  startHydration();
  assert.deepEqual(order, ['bootstrap-delivered', 'hydration-started']);
}

async function main(): Promise<void> {
  testApiKeyCannotDeclareBootstrapReady();
  testBootstrapReconcilesAliasAtomically();
  testRestoreAndBootstrapCommute();
  testOperationalFailuresCannotEraseCatalog();
  testLatestOperationalRevisionWins();
  testOldViewCannotHydrateReplacement();
  testDuplicateReadyIsIdempotent();
  testBrokenBootstrapIsExplicit();
  await testHydrationFailuresAreIsolated();
  await testBootstrapDeliveryPrecedesHydration();
  console.log('Agent Chat bootstrap architecture model: 10/10 passed.');
}

void main();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canaryWithQuery } from './canary.mjs';

const MODEL = 'claude-opus-6';

/**
 * A stand-in for the SDK's query(): it lists models, reads one prompt from the
 * streaming input, and then emits `messages`. `hang` makes it wait for close().
 */
function fakeQuery({ listed = [MODEL], messages = successTurn(), listError, hang = false } = {}) {
  const seen = { options: undefined, prompts: [], closed: false };
  const query = ({ prompt, options }) => {
    seen.options = options;
    let closeStream;
    const closed = new Promise((resolve) => { closeStream = resolve; });
    async function* run() {
      for await (const message of prompt) {
        seen.prompts.push(message);
        if (hang) {
          await closed;
          return;
        }
        yield* messages;
        return;
      }
    }
    const iterator = run();
    return {
      supportedModels: async () => {
        if (listError) throw listError;
        return listed.map((value) => ({ value, displayName: value }));
      },
      close: () => { seen.closed = true; closeStream(); },
      [Symbol.asyncIterator]: () => iterator,
    };
  };
  return { query, seen };
}

function successTurn({ initModel = MODEL, servedModel = MODEL, result = 'OK', subtype = 'success' } = {}) {
  return [
    { type: 'system', subtype: 'init', model: initModel },
    { type: 'assistant', message: { model: servedModel, content: [{ type: 'text', text: result }] } },
    { type: 'result', subtype, is_error: subtype !== 'success', result, total_cost_usd: 0.0012 },
  ];
}

const run = (query, extra = {}) => canaryWithQuery({ query, cliPath: '/opt/claude', modelId: MODEL, label: 'Opus 6', maxOutputTokens: 64000, apiKey: 'test-key', ...extra });

test('a model that is listed, initialised, served and answers passes', async () => {
  const { query, seen } = fakeQuery();
  const outcome = await run(query);
  assert.equal(outcome.ok, true, outcome.reason);
  assert.equal(outcome.costUsd, 0.0012);
  assert.ok(Number.isFinite(outcome.durationMs));
  assert.equal(seen.prompts.length, 1);
  assert.equal(seen.closed, true);
});

test('the canary declares the model like the client and runs isolated and tool-less', async () => {
  process.env.MODEL_CATALOG_CANARY_LEAK_CHECK = 'must-not-leak';
  try {
    const { query, seen } = fakeQuery();
    await run(query);
    const { options } = seen;
    assert.equal(options.model, MODEL);
    assert.equal(options.pathToClaudeCodeExecutable, '/opt/claude');
    assert.deepEqual(options.settings, { modelPicker: { options: [{ model: MODEL, label: 'Opus 6' }] } });
    assert.deepEqual(options.tools, []);
    assert.equal(options.maxTurns, 1);
    assert.deepEqual(options.settingSources, []);
    assert.deepEqual(Object.keys(options.env).sort(), [
      'ANTHROPIC_API_KEY', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'CLAUDE_CONFIG_DIR', 'HOME', 'PATH',
    ]);
    assert.equal(options.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, '64000');
    assert.equal(options.env.ANTHROPIC_API_KEY, 'test-key');
    assert.notEqual(options.env.HOME, process.env.HOME);
    assert.equal(options.cwd, options.env.HOME);
    assert.equal((await options.canUseTool('Bash', {}, {})).behavior, 'deny');
  } finally {
    delete process.env.MODEL_CATALOG_CANARY_LEAK_CHECK;
  }
});

test('no output budget means no budget variable', async () => {
  const { query, seen } = fakeQuery();
  await run(query, { maxOutputTokens: undefined });
  assert.equal('CLAUDE_CODE_MAX_OUTPUT_TOKENS' in seen.options.env, false);
});

test('a model the CLI does not list after injection fails before any turn', async () => {
  const { query, seen } = fakeQuery({ listed: ['claude-opus-5'] });
  const outcome = await run(query);
  assert.equal(outcome.ok, false);
  assert.match(outcome.reason, /did not list/);
  assert.equal(seen.prompts.length, 0);
});

test('a session that starts on another model fails', async () => {
  const { query } = fakeQuery({ messages: successTurn({ initModel: 'claude-opus-5' }) });
  assert.match((await run(query)).reason, /session init reported claude-opus-5/);
});

test('an answer from another model fails; a dated snapshot of the model passes', async () => {
  assert.match((await run(fakeQuery({ messages: successTurn({ servedModel: 'claude-opus-5' }) }).query)).reason, /answered as claude-opus-5/);
  assert.equal((await run(fakeQuery({ messages: successTurn({ servedModel: `${MODEL}-20261001` }) }).query)).ok, true);
});

test('a failed or empty turn fails', async () => {
  assert.match((await run(fakeQuery({ messages: successTurn({ subtype: 'error_during_execution', result: '' }) }).query)).reason, /did not complete/);
  assert.match((await run(fakeQuery({ messages: successTurn({ result: '  ' }) }).query)).reason, /did not complete/);
  assert.match((await run(fakeQuery({ messages: [{ type: 'system', subtype: 'init', model: MODEL }] }).query)).reason, /no result/);
});

test('an SDK error fails the canary instead of crashing the run', async () => {
  const outcome = await run(fakeQuery({ listError: new Error('CLI exited with code 1') }).query);
  assert.equal(outcome.ok, false);
  assert.match(outcome.reason, /exception: CLI exited with code 1/);
});

test('a turn that never finishes times out', async () => {
  const { query, seen } = fakeQuery({ hang: true });
  const outcome = await run(query, { timeoutMs: 50 });
  assert.equal(outcome.ok, false);
  assert.match(outcome.reason, /did not finish within 50 ms/);
  assert.equal(seen.closed, true);
});

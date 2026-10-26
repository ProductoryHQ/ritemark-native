/**
 * Sprint 139 (R7, R8; #479): agent_used, first_message_sent and first_reply.
 *
 * Run: npx tsx src/analytics/turnCounts.test.ts
 */

import assert from 'node:assert/strict';
import { agentFamily, TurnCounter } from './turnCounts';
import { turnOutcome } from '../runtime/turnFailureCopy';

function harness(options: { maySend?: boolean; counted?: boolean } = {}) {
  const sent: Array<{ name: string; properties: Record<string, unknown> }> = [];
  let counted = options.counted ?? false;
  let maySend = options.maySend ?? true;
  const counter = new TurnCounter({
    maySend: () => maySend,
    firstMessageCounted: () => counted,
    markFirstMessageCounted: async () => { counted = true; },
    track: async (name, properties) => {
      if (!maySend) return false;
      sent.push({ name, properties: properties as Record<string, unknown> });
      return true;
    },
  });
  return { counter, sent, isCounted: () => counted, setMaySend: (value: boolean) => { maySend = value; } };
}

async function run(): Promise<void> {
  assert.equal(agentFamily('claude-code'), 'claude');
  assert.equal(agentFamily('codex'), 'chatgpt', "the welcome's names: never codex");
  assert.equal(agentFamily('opencode'), 'opencode');
  assert.equal(agentFamily('ritemark-agent'), null);

  // S43: the first message, then its reply, with no text.
  {
    const { counter, sent } = harness();
    await counter.accepted('c1:t1', 'codex', false);
    assert.deepEqual(sent, [{ name: 'first_message_sent', properties: { provider: 'chatgpt' } }]);
    await counter.ended('c1:t1', 'codex', 'chat', 'arrived');
    assert.deepEqual(sent.slice(1), [
      { name: 'agent_used', properties: { agent: 'chatgpt', source: 'chat', outcome: 'arrived' } },
      { name: 'first_reply', properties: { provider: 'chatgpt', outcome: 'arrived' } },
    ]);
    // Only once per profile.
    await counter.accepted('c1:t2', 'claude-code', false);
    await counter.ended('c1:t2', 'claude-code', 'chat', 'network');
    assert.deepEqual(sent.slice(3), [{ name: 'agent_used', properties: { agent: 'claude', source: 'chat', outcome: 'network' } }]);
  }

  // S44: the first reply is an error.
  {
    const { counter, sent } = harness();
    await counter.accepted('c:t', 'claude-code', false);
    await counter.ended('c:t', 'claude-code', 'chat', turnOutcome('failed', 'sign-in'));
    assert.deepEqual(sent.at(-1), { name: 'first_reply', properties: { provider: 'claude', outcome: 'sign_in' } });
  }

  // S45: a turn that never ends sends no first_reply; another turn's end is not it.
  {
    const { counter, sent } = harness();
    await counter.accepted('c:first', 'opencode', false);
    await counter.ended('c:other', 'opencode', 'chat', 'arrived');
    assert.equal(sent.some((event) => event.name === 'first_reply'), false);
    assert.equal(counter.pendingFirstReply(), 'c:first');
  }

  // A first turn that ends while the marker is still being written still sends first_reply.
  {
    let release: () => void = () => {};
    const sent: string[] = [];
    const counter = new TurnCounter({
      maySend: () => true,
      firstMessageCounted: () => false,
      markFirstMessageCounted: () => new Promise<void>((resolve) => { release = resolve; }),
      track: async (name) => { sent.push(name); return true; },
    });
    const accepting = counter.accepted('c:fast', 'codex', false);
    const ending = counter.ended('c:fast', 'codex', 'chat', 'stopped');
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(sent.includes('first_reply'), false, 'first_reply waits for first_message_sent');
    release();
    await Promise.all([accepting, ending]);
    assert.deepEqual(sent.slice().sort(), ['agent_used', 'first_message_sent', 'first_reply'].sort());
    assert.ok(sent.indexOf('first_message_sent') < sent.indexOf('first_reply'), `in order: ${sent.join(', ')}`);
  }

  // S42: a continuation (an approval, a plan review) is the same turn: counted once.
  {
    const { counter, sent } = harness({ counted: true });
    await counter.accepted('c:plan', 'codex', false);
    await counter.ended('c:plan', 'codex', 'chat', 'arrived');
    await counter.accepted('c:plan', 'codex', true);
    await counter.ended('c:plan', 'codex', 'chat', 'arrived');
    assert.equal(sent.filter((event) => event.name === 'agent_used').length, 1);
  }

  // S46: a message that failed to save is never accepted, so the next saved one is the first.
  {
    const { counter, sent } = harness();
    // (the failed save never calls accepted())
    await counter.accepted('c:saved', 'claude-code', false);
    assert.deepEqual(sent, [{ name: 'first_message_sent', properties: { provider: 'claude' } }]);
  }

  // S47: usage data off: nothing is sent and no marker is written.
  {
    const { counter, sent, isCounted } = harness({ maySend: false });
    await counter.accepted('c:t', 'codex', false);
    await counter.ended('c:t', 'codex', 'chat', 'arrived');
    assert.deepEqual(sent, []);
    assert.equal(isCounted(), false, 'no marker before a yes');
  }

  // Flows count their own steps, with source flow.
  {
    const { counter, sent } = harness({ counted: true });
    await counter.ended('flow:1', 'claude-code', 'flow', 'arrived');
    await counter.ended('flow:2', 'codex', 'flow', 'provider_error');
    assert.deepEqual(sent, [
      { name: 'agent_used', properties: { agent: 'claude', source: 'flow', outcome: 'arrived' } },
      { name: 'agent_used', properties: { agent: 'chatgpt', source: 'flow', outcome: 'provider_error' } },
    ]);
  }

  console.log('turnCounts.test.ts: all tests passed');
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});

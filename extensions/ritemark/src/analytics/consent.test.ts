/**
 * Sprint 133 (E1): the one consent gate. No send before an answer, none after
 * a no; the welcome's held events sent once at a yes and dropped at a no;
 * build_channel on every event; the kill switch winning over a yes; Ritemark
 * 1's answers carried over as decided (Jarmo, 18 October).
 *
 * Run: npx tsx src/analytics/consent.test.ts
 */

import assert from 'node:assert/strict';
import { ConsentGate, buildChannel, readOneXAnswer, usageAnswer, type CaptureClient, type ConsentDeps } from './consent';

interface Sent { event: string; properties: Record<string, unknown>; distinctId: string }

function harness(start: { setting?: boolean; allowed?: boolean; hasKey?: boolean } = {}) {
  const state = { setting: start.setting, allowed: start.allowed ?? true, hasKey: start.hasKey ?? true };
  const sent: Sent[] = [];
  let clientsCreated = 0;
  let idsRead = 0;
  let shutdowns = 0;
  const clientOptions: Array<{ oneOff?: boolean } | undefined> = [];
  const deps: ConsentDeps = {
    readSetting: () => state.setting,
    analyticsAllowed: () => state.allowed,
    createClient: (options?: { oneOff?: boolean }): CaptureClient | null => {
      if (!state.hasKey) return null;
      clientsCreated += 1;
      clientOptions.push(options);
      return {
        captureImmediate: async (payload) => { sent.push(payload as Sent); },
        shutdown: async () => { shutdowns += 1; },
      };
    },
    anonymousId: () => { idsRead += 1; return 'anon-1'; },
    oneOffId: () => 'one-off-1',
    sharedProperties: () => ({ product_area: 'app', app_version: '2.0.0-0', build_channel: 'prod' }),
    sessionProperties: () => ({ version: '2.0.0-0', platform: 'darwin' }),
  };
  const gate = new ConsentGate(deps);
  return {
    gate,
    state,
    sent,
    get clientsCreated() { return clientsCreated; },
    get idsRead() { return idsRead; },
    get shutdowns() { return shutdowns; },
    clientOptions,
  };
}

async function main(): Promise<void> {
  // ── No answer: nothing leaves the computer, no client, no id ──
  {
    const h = harness();
    await h.gate.refresh();
    assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), false);
    assert.equal(await h.gate.track('project_opened', { source: 'existing_folder', has_ai: true }), false);
    assert.equal(h.sent.length, 0, 'nothing is sent before an answer');
    assert.equal(h.clientsCreated, 0, 'no PostHog client before a yes');
    assert.equal(h.idsRead, 0, 'no anonymous id is read or written before a yes');
    assert.equal(h.gate.answer(), 'unknown');
  }

  // ── The welcome's events are held, then sent once at a yes ──
  {
    const h = harness();
    await h.gate.refresh();
    assert.equal(await h.gate.trackWelcome('welcome_shown', { kind: 'fresh' }), 'held');
    assert.equal(await h.gate.trackWelcome('ai_signed_in', { provider: 'claude', method: 'account' }), 'held');
    assert.equal(h.gate.heldCount(), 2);
    assert.equal(h.sent.length, 0, 'held events stay in memory');

    h.state.setting = true; // the switch on step 2
    await h.gate.refresh();
    assert.deepEqual(h.sent.map((s) => s.event), ['app_session_start', 'welcome_shown', 'ai_signed_in']);
    assert.equal(h.gate.heldCount(), 0);
    await h.gate.refresh();
    assert.equal(h.sent.length, 3, 'a second refresh sends nothing again: each event once');

    for (const s of h.sent) {
      assert.equal(s.properties.build_channel, 'prod', `${s.event} carries build_channel`);
      assert.equal(s.properties.$process_person_profile, false);
      assert.equal(s.distinctId, 'anon-1');
    }
    assert.deepEqual(h.sent[1].properties.kind, 'fresh');
    assert.deepEqual(h.sent[2].properties.provider, 'claude');
  }

  // ── A no drops the held events, and nothing is sent after it ──
  {
    const h = harness();
    await h.gate.trackWelcome('welcome_shown', { kind: 'fresh' });
    h.state.setting = false;
    await h.gate.refresh();
    assert.equal(h.gate.heldCount(), 0, 'a no drops the held events');
    assert.equal(await h.gate.trackWelcome('ai_signed_in', { provider: 'chatgpt', method: 'account' }), 'dropped');
    assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), false);
    h.state.setting = true;
    await h.gate.refresh();
    assert.deepEqual(h.sent.map((s) => s.event), ['app_session_start'], 'events dropped at the no never come back');
  }

  // ── Turning it off stops sending at once, and closes the client ──
  {
    const h = harness({ setting: true });
    await h.gate.refresh();
    assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), true);
    h.state.setting = false;
    await h.gate.refresh();
    assert.equal(h.shutdowns, 1, 'the client is closed at the no');
    assert.equal(await h.gate.track('feature_used', { feature: 'pdf_preview' }), false);
    assert.deepEqual(h.sent.map((s) => s.event), ['app_session_start', 'feature_used']);
  }

  // ── The kill switch wins over a yes ──
  {
    const h = harness({ setting: true, allowed: false });
    await h.gate.refresh();
    assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), false);
    assert.equal(await h.gate.trackWelcome('welcome_shown', { kind: 'update' }), 'dropped');
    assert.equal(h.sent.length, 0);
    assert.equal(h.clientsCreated, 0);
  }

  // ── A build with no PostHog key sends nothing, even after a yes ──
  {
    const h = harness({ setting: true, hasKey: false });
    await h.gate.refresh();
    assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), false);
    assert.equal(h.idsRead, 0);
  }

  // ── A yes from the first start (an OK carried over from 1.x): sent as it happens ──
  {
    const h = harness({ setting: true });
    await h.gate.refresh();
    assert.equal(await h.gate.trackWelcome('welcome_shown', { kind: 'update' }), 'sent');
    assert.deepEqual(h.sent.map((s) => s.event), ['app_session_start', 'welcome_shown']);
  }

  // ── Ritemark 1's answers ──
  assert.deepEqual(readOneXAnswer(false, true), { answer: 'no', carryOver: false }, 'Opt Out stays off');
  assert.deepEqual(readOneXAnswer(undefined, true), { answer: 'yes', carryOver: true }, 'OK (or a notice closed without Opt Out) carries over as a yes');
  assert.deepEqual(readOneXAnswer(undefined, undefined), { answer: 'unknown', carryOver: false }, 'no answer starts off');
  assert.deepEqual(readOneXAnswer(true, undefined), { answer: 'yes', carryOver: false }, 'a yes the person set themselves');
  assert.deepEqual(readOneXAnswer(true, true), { answer: 'yes', carryOver: false });

  assert.equal(usageAnswer(undefined), 'unknown');
  assert.equal(usageAnswer(true), 'yes');
  assert.equal(usageAnswer(false), 'no');

  // ── build_channel (#338) ──
  // ── G3: feedback the person sends goes with usage data off, and only it ──
  {
    const feedback = [
      { name: 'reaction_submitted' as const, properties: { reaction: 'good', message: 'Nice' } },
      { name: 'feedback_sent' as const, properties: { message: 'Nice', reaction: 'good' } },
    ];
    // Usage data off (a no)
    const off = harness({ setting: false });
    await off.gate.refresh();
    assert.equal(await off.gate.sendFeedback(feedback), true);
    assert.deepEqual(off.sent.map((s) => s.event), ['reaction_submitted', 'feedback_sent'], 'only the feedback: no session start');
    for (const s of off.sent) {
      assert.equal(s.distinctId, 'one-off-1', 'a one-off id');
      assert.equal(s.properties.build_channel, undefined, 'none of the shared properties');
      assert.equal(s.properties.app_version, undefined);
      assert.equal(s.properties.$process_person_profile, false);
    }
    assert.equal(off.idsRead, 0, 'the stored anonymous id is neither read nor written');
    assert.deepEqual(off.clientOptions, [{ oneOff: true }], 'a client made for this send, with no location');
    assert.equal(off.shutdowns, 1, 'and closed after it');
    assert.equal(off.gate.answer(), 'no', 'usage data stays off');
    assert.equal(await off.gate.track('feature_used', { feature: 'editor' }), false, 'and nothing else is sent');

    // No answer yet, with the welcome's events held: they stay held
    const unknown = harness();
    await unknown.gate.refresh();
    await unknown.gate.trackWelcome('welcome_shown', { kind: 'fresh' });
    assert.equal(await unknown.gate.sendFeedback(feedback.slice(0, 1)), true);
    assert.deepEqual(unknown.sent.map((s) => s.event), ['reaction_submitted'], 'never the held welcome events');
    assert.equal(unknown.gate.heldCount(), 1);
    assert.equal(unknown.gate.answer(), 'unknown');

    // With a yes: sent as any event, with the stored id and the shared properties
    const on = harness({ setting: true });
    await on.gate.refresh();
    assert.equal(await on.gate.sendFeedback(feedback), true);
    const sentOn = on.sent.filter((s) => s.event !== 'app_session_start');
    assert.deepEqual(sentOn.map((s) => s.distinctId), ['anon-1', 'anon-1']);
    assert.equal(sentOn[0].properties.build_channel, 'prod');

    // The kill switch still stops it; a build with no key sends nothing
    const killed = harness({ setting: false, allowed: false });
    assert.equal(await killed.gate.sendFeedback(feedback), false);
    assert.equal(killed.sent.length, 0);
    const noKey = harness({ setting: false, hasKey: false });
    assert.equal(await noKey.gate.sendFeedback(feedback), false);
  }

  // ── On by default (Jarmo, 19 October): the welcome answers on leaving; until then nothing leaves ──
  {
    // The welcome shows its switch on, and the person has not left it yet: the answer is still none
    const h = harness();
    await h.gate.refresh();
    assert.equal(await h.gate.trackWelcome('welcome_shown', { kind: 'fresh' }), 'held');
    assert.equal(await h.gate.trackWelcome('ai_signed_in', { provider: 'claude', method: 'account' }), 'held');
    assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), false);
    assert.equal(h.sent.length, 0, 'nothing leaves before the welcome is finished');
    assert.equal(h.clientsCreated, 0);
    // Leaving step 2 with the switch on is the yes: the session start and the held events go, each with no location
    h.state.setting = true;
    await h.gate.refresh();
    assert.deepEqual(h.sent.map((s) => s.event), ['app_session_start', 'welcome_shown', 'ai_signed_in']);
    assert.ok(h.sent.every((s) => s.properties.$geoip_disable === true), 'no event carries a location');
    assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), true);
    assert.equal(h.sent[h.sent.length - 1].properties.$geoip_disable, true);
  }
  {
    // Turning the switch off on step 2 answers no at once: the held events are dropped and nothing is sent
    const h = harness();
    await h.gate.refresh();
    await h.gate.trackWelcome('welcome_shown', { kind: 'fresh' });
    h.state.setting = false;
    await h.gate.refresh();
    assert.equal(h.gate.heldCount(), 0, 'off drops the held events');
    assert.equal(h.sent.length, 0);
    assert.equal(h.clientsCreated, 0, 'no client was ever made');
    assert.equal(await h.gate.trackWelcome('ai_signed_in', { provider: 'claude', method: 'account' }), 'dropped');
  }
  {
    // A first window opened with a file never shows the welcome: no answer, nothing sent, however long it runs
    const h = harness();
    await h.gate.refresh();
    for (let i = 0; i < 3; i++) assert.equal(await h.gate.track('feature_used', { feature: 'editor' }), false);
    assert.equal(h.sent.length, 0);
    // The welcome closed without a project (the window closed): its held events go with it, and the answer stays none
    await h.gate.trackWelcome('welcome_shown', { kind: 'fresh' });
    h.gate.dropHeld();
    assert.equal(h.gate.answer(), 'unknown');
    assert.equal(h.sent.length, 0);
  }
  {
    // Ritemark 1's answers as now: an Opt Out stays off, an OK carries over as on
    assert.deepEqual(readOneXAnswer(false, true), { answer: 'no', carryOver: false });
    assert.deepEqual(readOneXAnswer(undefined, true), { answer: 'yes', carryOver: true });
    // Feedback sent with usage data off carries no location either
    const off = harness({ setting: false });
    assert.equal(await off.gate.sendFeedback([{ name: 'feedback_sent', properties: { kind: 'reaction', has_text: false } as never }]), true);
    assert.ok(off.sent.every((s) => s.properties.$geoip_disable === true));
  }

  assert.equal(buildChannel('2.0.0-0', false), 'prod', 'the bundled, floored version');
  assert.equal(buildChannel('2.0.0-ext.3', false), 'prod', 'an extension update');
  assert.equal(buildChannel('1.14.0', false), 'dev', 'a run from source');
  assert.equal(buildChannel('2.0.0-0', true), 'dev', 'an extension launched for development');

  console.log('✓ consent gate tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

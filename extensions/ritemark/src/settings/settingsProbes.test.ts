/**
 * Sprint 147, PR 3 (R10, R11): the probe scheduler (parallel, once per open, a failure isolated, the newest answer
 * wins), the summary line, A2's listeners, and the key allowlist.
 *
 * Run: npx tsx src/settings/settingsProbes.test.ts
 */
import assert from 'node:assert/strict';
import {
  ALL_PARTS,
  RECHECK_MIN_GAP_MS,
  SettingsProbeScheduler,
  claudeEventParts,
  codexEventParts,
  configChangeAction,
  PAGE_CONFIG_KEYS,
  PAGE_SETTING_KEYS,
  pageSettingAllowed,
  secretChangeAction,
  settingsSummaryLine,
  shouldRecheckOnView,
  type SettingsPartName,
  type SettingsProbe,
} from './settingsProbes';
import { SETTINGS_KEY_NAMES, isSettingsKeyName, settingsKeyAllowed } from './settingsKeys';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function main(): Promise<void> {
  // --- Parallel: every probe starts before any ends, and each delivers on its own --------------------------------
  {
    const started: SettingsPartName[] = [];
    const delivered: Array<[SettingsPartName, unknown]> = [];
    const gates = new Map<SettingsPartName, ReturnType<typeof deferred<string>>>();
    const probes: SettingsProbe[] = ALL_PARTS.map((part) => {
      const gate = deferred<string>();
      gates.set(part, gate);
      return {
        part,
        run: () => { started.push(part); return gate.promise; },
        fallback: () => 'failed',
        deliver: (value) => delivered.push([part, value]),
      };
    });
    const scheduler = new SettingsProbeScheduler(0);
    const run = scheduler.runOnce(probes);
    assert.ok(run, 'the open\'s first run starts');
    await tick();
    assert.deepEqual(started, [...ALL_PARTS], 'every probe starts at once, none waits for another');
    assert.equal(scheduler.busy, true);
    // The slowest (Claude) holds nothing: the others answer first and draw at once
    gates.get('codex')!.resolve('codex-answer');
    await tick();
    assert.deepEqual(delivered, [['codex', 'codex-answer']], 'ChatGPT draws while Claude is still out');
    for (const part of ALL_PARTS) if (part !== 'codex' && part !== 'claudeCode') gates.get(part)!.resolve(`${part}-answer`);
    await tick();
    assert.equal(delivered.length, ALL_PARTS.length - 1);
    gates.get('claudeCode')!.resolve('claude-answer');
    const timings = await run!;
    assert.equal(delivered.length, ALL_PARTS.length, 'each part delivered once');
    assert.equal(timings.length, ALL_PARTS.length);
    assert.equal(scheduler.busy, false);

    // --- Once per open: `ready` again starts nothing -------------------------------------------------------------
    let again = 0;
    const second = scheduler.runOnce([{ part: 'claudeCode', run: async () => { again += 1; return 'x'; }, fallback: () => 'f', deliver: () => {} }]);
    assert.equal(second, null, 'a second ready starts no second run');
    assert.equal(again, 0, 'no probe ran again');
    assert.equal(scheduler.started, true);
  }

  // --- A failing probe posts its fallback and never holds the others -------------------------------------------
  {
    const delivered = new Map<SettingsPartName, unknown>();
    const scheduler = new SettingsProbeScheduler(0);
    const timings = await scheduler.runOnce([
      { part: 'claudeCode', run: async () => { throw new Error('spawn failed'); }, fallback: (error) => `fallback: ${(error as Error).message}`, deliver: (value) => delivered.set('claudeCode', value) },
      { part: 'environment', run: async () => 'git and node', fallback: () => null, deliver: (value) => delivered.set('environment', value) },
      { part: 'codex', run: async () => 'ok', fallback: () => 'f', deliver: () => { throw new Error('panel closed'); } },
    ])!;
    assert.equal(delivered.get('claudeCode'), 'fallback: spawn failed', 'a failed probe draws its fallback, so its row stops checking');
    assert.equal(delivered.get('environment'), 'git and node', 'the others still draw');
    assert.deepEqual(timings.map((timing) => [timing.part, timing.ok]), [['claudeCode', false], ['environment', true], ['codex', true]]);
  }

  // --- A probe that never answers draws its fallback in the end ----------------------------------------------
  {
    const delivered: unknown[] = [];
    const scheduler = new SettingsProbeScheduler(0, Date.now, 20);
    const timings = await scheduler.run([
      { part: 'codex', run: () => new Promise(() => {}), fallback: (error) => `fallback: ${(error as Error).message}`, deliver: (value) => delivered.push(value) },
    ]);
    assert.deepEqual(delivered, ['fallback: No answer in time'], 'a hung probe stops saying Checking…');
    assert.equal(timings[0].ok, false);
  }

  // --- The newest answer wins: an older run ending later is dropped ---------------------------------------------
  {
    const delivered: unknown[] = [];
    const scheduler = new SettingsProbeScheduler(0);
    const older = deferred<string>();
    const newer = deferred<string>();
    const first = scheduler.run([{ part: 'claudeCode', run: () => older.promise, fallback: () => 'f', deliver: (value) => delivered.push(value) }]);
    const second = scheduler.run([{ part: 'claudeCode', run: () => newer.promise, fallback: () => 'f', deliver: (value) => delivered.push(value) }]);
    newer.resolve('signed in');
    await second;
    older.resolve('signed out (stale)');
    await first;
    assert.deepEqual(delivered, ['signed in'], 'a slow, older probe never draws over a newer answer');
  }

  // --- R10's one line: no words, names or paths -----------------------------------------------------------------
  {
    let clock = 1000;
    const scheduler = new SettingsProbeScheduler(1000, () => clock);
    const slow = deferred<string>();
    const run = scheduler.run([
      { part: 'claudeCode', run: () => slow.promise, fallback: () => '', deliver: () => {} },
      { part: 'environment', run: async () => 'x', fallback: () => '', deliver: () => {} },
    ]);
    clock = 1050;
    await tick();
    clock = 2100;
    slow.resolve('done');
    const timings = await run;
    assert.equal(settingsSummaryLine(40, timings), 'settings: drawn 40, filled 1100, slowest claudeCode 1100');
    assert.equal(settingsSummaryLine(40, []), 'settings: drawn 40, filled 40, slowest none 0');
    assert.match(settingsSummaryLine(40, timings), /^settings: drawn \d+, filled \d+, slowest \w+ \d+$/);
  }

  // --- A2's listeners -------------------------------------------------------------------------------------------
  {
    const affects = (...keys: string[]) => (section: string) => keys.includes(section);
    // A setting the page shows, changed in All settings or settings.json: settings again, no probe
    for (const key of ['ritemark.ai.agentTimeout', 'ritemark.ai.debugTrace', 'ritemark.chat.fontSize', 'ritemark.codex.approvalPolicy',
      'ritemark.codex.sandboxMode', 'ritemark.opencode.autoApprove', 'ritemark.updates.enabled', 'ritemark.analytics.enabled',
      'workbench.colorTheme', 'window.autoDetectColorScheme']) {
      assert.deepEqual(configChangeAction(affects(key)), { base: true, parts: [], runtimeChanged: false }, `${key} redraws without a probe`);
    }
    // The runtime choice: settings again, and Claude's, ChatGPT's and the tools line's parts
    assert.deepEqual(configChangeAction(affects('ritemark.agentRuntime.preference')), { base: true, parts: ['claudeCode', 'codex', 'environment'], runtimeChanged: true });
    // Something the page doesn't show: nothing
    assert.deepEqual(configChangeAction(affects('editor.fontSize')), { base: false, parts: [], runtimeChanged: false });
    // A key saved or removed elsewhere: which keys are saved again; the Anthropic key moves Claude's row too
    assert.deepEqual(secretChangeAction('openai-api-key', isSettingsKeyName), { base: true, parts: [], runtimeChanged: false });
    assert.deepEqual(secretChangeAction('anthropic-api-key', isSettingsKeyName), { base: true, parts: ['claudeCode'], runtimeChanged: false });
    assert.deepEqual(secretChangeAction('google-docs-oauth-token', isSettingsKeyName), { base: false, parts: [], runtimeChanged: false }, 'another secret redraws nothing');
    // Sign-ins and sign-outs anywhere: only that AI's parts
    assert.deepEqual(claudeEventParts(), ['claudeCode', 'environment']);
    assert.deepEqual(codexEventParts(), ['codex']);
    // The tab back in view: checked again, once the open's run is in, not while it fills, not on a flick
    const view = { visible: true, wasVisible: false, started: true, busy: false, lastEndedAt: 0, now: RECHECK_MIN_GAP_MS };
    assert.equal(shouldRecheckOnView(view), true, 'shown again: checked again');
    assert.equal(shouldRecheckOnView({ ...view, wasVisible: true }), false, 'a tab that stayed in view is not');
    assert.equal(shouldRecheckOnView({ ...view, visible: false }), false, 'a tab going out of view is not');
    assert.equal(shouldRecheckOnView({ ...view, started: false }), false, 'before the open\'s run');
    assert.equal(shouldRecheckOnView({ ...view, busy: true }), false, 'while it still fills in');
    assert.equal(shouldRecheckOnView({ ...view, lastEndedAt: 1, now: RECHECK_MIN_GAP_MS }), false, 'a flick back within the gap');
  }

  // --- setSetting's allowlist (the review of #657): the eight settings the page writes, nothing else ---------------
  {
    assert.equal(PAGE_SETTING_KEYS.length, 8);
    for (const key of PAGE_SETTING_KEYS) {
      assert.equal(pageSettingAllowed(key), true, `${key} is written by the page`);
      assert.ok((PAGE_CONFIG_KEYS as readonly string[]).includes(`ritemark.${key}`), `${key} is followed too`);
    }
    for (const key of ['analytics.enabled', 'features.overrides', 'ritemark.ai.agentTimeout', 'agentRuntime', '', undefined, 7, 'codex.approvalPolicy.x']) {
      assert.equal(pageSettingAllowed(key), false, `${String(key)} is not written through setSetting`);
    }
    assert.equal(RECHECK_MIN_GAP_MS, 30_000, 'the check on view waits 30 s between runs');
  }

  // --- The setter's allowlist (Sprint 149's audit) --------------------------------------------------------------
  {
    const on = { opencode: true, transcription: true };
    for (const name of SETTINGS_KEY_NAMES) assert.equal(settingsKeyAllowed(name, on), true, `${name} is one of the five`);
    for (const name of ['google-docs-oauth-token', 'ritemark.browser.token', '', 'OPENAI-API-KEY', 'openai-api-key ', undefined, 42, null]) {
      assert.equal(settingsKeyAllowed(name, on), false, `${String(name)} is off the list`);
    }
    assert.equal(settingsKeyAllowed('openrouter-api-key', { opencode: false, transcription: true }), false, 'OpenRouter waits for its flag');
    assert.equal(settingsKeyAllowed('elevenlabs-api-key', { opencode: true, transcription: false }), false, 'ElevenLabs waits for its flag');
    assert.equal(isSettingsKeyName('openrouter-api-key'), true, 'a change to a flagged key still redraws');
  }

  console.log('settingsProbes.test.ts: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

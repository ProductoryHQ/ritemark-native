import assert from 'node:assert/strict';
import Module from 'node:module';
import { test } from 'node:test';
import type { ExtensionContext } from 'vscode';
import type { PublishUi } from './PublishController';

test('Publish warnings keep recovery first and quote only safe visible words', async () => {
  const warnings: unknown[][] = [];
  const commands: unknown[][] = [];
  let selection = 'Tell us about this';
  const stub = {
    EventEmitter: class { event() {} fire() {} },
    window: { showWarningMessage: async (...args: unknown[]) => { warnings.push(args); return selection; } },
    commands: {
      executeCommand: async (...args: unknown[]) => { commands.push(args); },
      registerCommand: () => ({}),
      getCommands: async () => [],
    },
  };
  const loader = Module as unknown as { _load: (name: string, ...args: unknown[]) => unknown };
  const load = loader._load;
  loader._load = (name, ...args) => name === 'vscode' ? stub : load(name, ...args);
  try {
    const { createPublishFeature } = await import('./vscodePublish');
    const context = {
      globalStorageUri: { fsPath: '/unused' },
      secrets: { get: async () => undefined, onDidChange: () => ({}) },
      subscriptions: [],
    } as unknown as ExtensionContext;
    const feature = createPublishFeature(context, () => true, () => {});
    const ui = (feature.controller as unknown as { ui: PublishUi }).ui;
    const feedback = () => commands.filter(([name]) => name === 'ritemark.feedback.open').at(-1);
    let retries = 0;
    const retry = () => { retries++; };
    const title = "Publish didn't go";

    ui.showFailure('Try   publishing (again).', retry);
    await Promise.resolve();
    assert.deepEqual(warnings.at(-1), ['Try publishing again .', 'Try again', 'Tell us about this']);
    assert.deepEqual(feedback(), ['ritemark.feedback.open', { from: 'failure_card', quote: { title, line: warnings.at(-1)![0] } }]);
    assert.equal(retries, 0);

    ui.showConnect('Connect Cloudflare first.');
    await Promise.resolve();
    assert.deepEqual(warnings.at(-1), ['Connect Cloudflare first.', 'Open Settings', 'Tell us about this']);
    assert.deepEqual(feedback(), ['ritemark.feedback.open', { from: 'failure_card', quote: { title, line: 'Connect Cloudflare first.' } }]);

    for (const line of [
      'Could not read project/Private notes.docx',
      'Could not reach https://user:password@example.test',
      'Request failed with Bearer sample-value',
      '["raw provider response"]',
      'Error: fetch failed',
    ]) {
      ui.showFailure(line, retry);
      await Promise.resolve();
      assert.deepEqual(feedback(), ['ritemark.feedback.open', { from: 'failure_card' }], line);
    }

    selection = 'Try again';
    ui.showFailure('Check your connection.', retry);
    await Promise.resolve();
    assert.equal(retries, 1);
    selection = 'Open Settings';
    ui.showConnect('Connect Cloudflare first.');
    await Promise.resolve();
    assert.deepEqual(commands.at(-1), ['ritemark.aiSettings', 'web-pages']);
  } finally {
    loader._load = load;
  }
});

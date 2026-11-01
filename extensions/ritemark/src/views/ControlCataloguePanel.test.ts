/**
 * Sprint 146 (R2, S9, decision 5): the control catalogue opens only when the launch sets RITEMARK_CONTROL_CATALOGUE=1
 * and its flag is on, and then as one webview tab drawn by the shared bundle; with no setting, or the flag killed,
 * nothing is created. The flag is in the registry, ON (Codex on #621).
 *
 * Run: npx tsx src/views/ControlCataloguePanel.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

const created: Array<{ viewType: string; title: string; options: { enableScripts?: boolean } }> = [];
const panels: Array<{ webview: { html: string } }> = [];
const vscodeStub = {
  Uri: { joinPath: (base: { path: string }, ...parts: string[]) => ({ path: [base.path, ...parts].join('/') }) },
  ViewColumn: { One: 1 },
  window: {
    createWebviewPanel: (viewType: string, title: string, _column: unknown, options: { enableScripts?: boolean }) => {
      created.push({ viewType, title, options });
      const panel = {
        webview: { html: '', cspSource: 'vscode-resource:', asWebviewUri: (uri: { path: string }) => `webview:${uri.path}` },
        dispose() {},
      };
      panels.push(panel);
      return panel;
    },
  },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

async function main(): Promise<void> {
  const { controlCatalogueAsked, openControlCatalogueIfAsked, CONTROL_CATALOGUE_VIEW_TYPE } = await import('./ControlCataloguePanel');
  const { FLAGS, isEnabled } = await import('../features');

  // The flag: in the registry, ON on every platform (HARD RULE #2); the launch setting is what opens the page
  assert.equal(FLAGS['control-catalogue'].status, 'stable', 'ON: a code-level kill switch, not a Settings toggle');
  assert.deepEqual(FLAGS['control-catalogue'].platforms, ['darwin', 'win32', 'linux']);
  assert.equal(isEnabled('control-catalogue'), true);

  // The gate: exactly "1"
  assert.equal(controlCatalogueAsked({}), false, 'no setting: no catalogue');
  for (const value of ['', '0', 'true', 'yes', ' 1']) {
    assert.equal(controlCatalogueAsked({ RITEMARK_CONTROL_CATALOGUE: value }), false, `${JSON.stringify(value)} is not the setting`);
  }
  assert.equal(controlCatalogueAsked({ RITEMARK_CONTROL_CATALOGUE: '1' }), true);

  // Without the setting, activation creates nothing
  const context = { extensionUri: { path: '/ext' }, subscriptions: [] as unknown[] };
  openControlCatalogueIfAsked(context as never, {});
  assert.equal(created.length, 0, 'no setting: no panel, no tab');
  assert.equal(context.subscriptions.length, 0);

  // The setting with the flag killed ('disabled'): still nothing
  openControlCatalogueIfAsked(context as never, { RITEMARK_CONTROL_CATALOGUE: '1' }, () => false);
  assert.equal(created.length, 0, 'the flag killed: no panel, whatever the launch asks');
  assert.equal(context.subscriptions.length, 0);

  // With it and the flag on (the registry's own answer), one tab of the shared bundle as the catalogue
  openControlCatalogueIfAsked(context as never, { RITEMARK_CONTROL_CATALOGUE: '1' });
  assert.equal(created.length, 1, 'the setting: one panel');
  assert.equal(created[0].viewType, CONTROL_CATALOGUE_VIEW_TYPE);
  assert.equal(created[0].options.enableScripts, true);
  assert.match(panels[0].webview.html, /data-editor-type="control-catalogue"/, 'the shared bundle draws it as the catalogue');
  assert.match(panels[0].webview.html, /webview:\/ext\/media\/webview\.js/, 'the one bundle, from media/');
  assert.match(panels[0].webview.html, /script-src 'nonce-/, 'scripts only by nonce, as Home');
  assert.equal(context.subscriptions.length, 1, 'the panel goes with the extension');

  console.log('ControlCataloguePanel.test.ts: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

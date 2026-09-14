// Actual-source boundary experiments; synthetic directories only, no network.
require('../../../../../extensions/ritemark/node_modules/tsx/dist/cjs/index.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../../..');
const vscode = { env: { appRoot: '' }, extensions: { getExtension: () => undefined } };
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return vscode;
  return originalLoad.call(this, request, parent, isMain);
};
const { validateManifest } = require(path.join(root, 'extensions/ritemark/src/update/updateManifest.ts'));
const { UserExtensionInstaller } = require(path.join(root, 'extensions/ritemark/src/update/userExtensionInstaller.ts'));

async function updateProbe(temp) {
  const app = path.join(temp, 'app');
  const bundled = path.join(app, 'extensions/ritemark');
  const userData = path.join(temp, 'synthetic-userdata');
  const victim = path.join(userData, 'synthetic-sibling');
  await fs.mkdir(bundled, { recursive: true });
  await fs.writeFile(path.join(bundled, 'package.json'), '{"name":"ritemark","version":"1.0.0"}');
  await fs.mkdir(victim, { recursive: true });
  await fs.writeFile(path.join(victim, 'sentinel.txt'), 'Synthetic data to preserve');
  vscode.env.appRoot = app;
  const manifest = {
    version: '1.0.0-ext.1', appVersion: '1.0.0', extensionVersion: '1.0.0-ext.1',
    type: 'extension', extensionDirName: '../synthetic-sibling',
    releaseDate: '2026-09-13', releaseNotes: 'Synthetic audit only',
    files: [{ path: 'obsolete.txt', op: 'delete' }],
  };
  // Both joined targets remain inside this mkdtemp root; never use live userdata.
  for (const parent of ['extensions', 'staging']) {
    assert.ok(path.resolve(userData, parent, manifest.extensionDirName).startsWith(temp + path.sep));
  }
  const validation = validateManifest(manifest);
  const installer = new UserExtensionInstaller(userData);
  installer.downloadFile = async () => { throw new Error('Network forbidden in audit probe'); };
  const result = await installer.applyUpdate(manifest);
  const sentinelPreserved = await fs.access(path.join(victim, 'sentinel.txt')).then(() => true, () => false);
  return { manifestAccepted: validation.valid, validationErrors: validation.errors, result, escapedIntendedExtensionsRoot: true, siblingSentinelPreserved: sentinelPreserved };
}

async function markdownProbe() {
  // Server rendering proves what actual component inserts, not CSP execution or requests.
  global.React = require(path.join(root, 'extensions/ritemark/webview/node_modules/react'));
  const { renderToStaticMarkup } = require(path.join(root, 'extensions/ritemark/webview/node_modules/react-dom/server'));
  const { RenderedMarkdown } = require(path.join(root, 'extensions/ritemark/webview/src/components/ai-sidebar/RenderedMarkdown.tsx'));
  const input = '<style>.audit-placeholder{position:fixed;inset:0}</style>\n<img src="https://audit.invalid/pixel" alt="synthetic" />';
  const rendered = renderToStaticMarkup(React.createElement(RenderedMarkdown, { content: input }));
  return { rendered, rawStylePreserved: rendered.includes('<style>'), externalImagePreserved: rendered.includes('https://audit.invalid/pixel'), limitation: 'No browser was opened and no external request was made. CSP/style/image consequences are source analysis, not browser reproduction.' };
}

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ritemark-audit-boundaries-'));
  try {
    const report = { node: process.version, platform: process.platform, method: 'Actual manifest validator and installer with fake vscode appRoot and test-only userData override; real local filesystem under mkdtemp. Actual React component rendered on server.', updater: await updateProbe(temp), markdown: await markdownProbe() };
    await fs.writeFile(path.join(__dirname, 'boundary-probes.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { Module._load = originalLoad; await fs.rm(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

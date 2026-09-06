import assert from 'node:assert/strict';
import { versionedWebviewAssetUri } from './webviewAssetUri';

assert.equal(
  versionedWebviewAssetUri('vscode-webview://asset/webview.js', '/bundle/webview.js', () => 1234.6),
  'vscode-webview://asset/webview.js?v=1235',
);
assert.equal(
  versionedWebviewAssetUri('vscode-webview://asset/webview.js', '/bundle/webview.js', () => { throw new Error('stat unavailable'); }),
  'vscode-webview://asset/webview.js',
);
assert.equal(
  versionedWebviewAssetUri('vscode-webview://asset/webview.js?authority=local#bundle', '/bundle/webview.js', () => 42),
  'vscode-webview://asset/webview.js?authority=local&v=42#bundle',
  'cache key must preserve an existing query and fragment',
);

console.log('Versioned webview asset URI tests passed.');

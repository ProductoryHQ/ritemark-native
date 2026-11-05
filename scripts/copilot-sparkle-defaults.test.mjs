// Sprint 154 PR 2 (#665): Copilot's inline-chat sparkle leaves the text editor's margin.
// Run: node --test scripts/copilot-sparkle-defaults.test.mjs
//
// The amber sparkle by a selection is the code-action light bulb, lit by Copilot's AI code actions (Modify, Review,
// and Fix/Explain on a problem). The Ritemark extension's configurationDefaults had turned them on
// (`github.copilot.editor.enableCodeActions: true`); they are off now. Copilot offers them only while
// `inlineChat.affordance` is "off"; at "editor" core's own sparkle shows instead, with Add Selection to Chat in its
// menu, so that setting is pinned "off" beside it. The shell ships no `tasConfig`, so no experiment can move it.
// The extension's defaults register after product.json's, so they are the one place for both.
// The settings are upstream's: when VS Code renames or drops one, this test fails, so the default is never silently dead.
// The commands stay: ⌘I and All commands still open Inline Chat (patch 003's ritemarkChatMenus.test.ts).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const product = JSON.parse(readFileSync(path.join(root, 'branding', 'product.json'), 'utf8'));
const extension = JSON.parse(readFileSync(path.join(root, 'extensions', 'ritemark', 'package.json'), 'utf8'));
const read = file => readFileSync(path.join(root, 'vscode', file), 'utf8');
const vscodePresent = (() => { try { read('package.json'); return true; } catch { return false; } })();

test('the extension turns off Copilot\'s code actions and pins the inline-chat affordance off', () => {
	const defaults = extension.contributes.configurationDefaults;
	assert.equal(defaults['github.copilot.editor.enableCodeActions'], false);
	assert.equal(defaults['inlineChat.affordance'], 'off');
	// product.json registers first, so a value there would lose to the extension's: keep the two in one place.
	assert.equal(product.configurationDefaults['github.copilot.editor.enableCodeActions'], undefined);
	assert.equal(product.configurationDefaults['inlineChat.affordance'], undefined);
	assert.equal(product.tasConfig, undefined, 'no experiment service: a setting\'s experiment value never applies');
});

test('both settings still exist upstream, with the values the defaults use', { skip: !vscodePresent && 'vscode/ is empty (light worktree)' }, () => {
	const copilot = JSON.parse(read('extensions/copilot/package.json'));
	const props = Object.assign({}, ...[copilot.contributes.configuration].flat().map(section => section.properties ?? {}));
	assert.equal(props['github.copilot.editor.enableCodeActions']?.type, 'boolean');
	const inlineChat = read('src/vs/workbench/contrib/inlineChat/common/inlineChat.ts');
	assert.match(inlineChat, /Affordance = 'inlineChat\.affordance'/);
	assert.match(inlineChat, /enum: \['off', 'editor'\]/);
	// Copilot gives its Modify and Review only while the affordance is off: the two defaults cover both sparkles.
	const codeActions = read('extensions/copilot/src/extension/inlineChat/vscode-node/inlineChatCodeActions.ts');
	assert.match(codeActions, /getConfig\(ConfigKey\.EnableCodeActions\)/);
	assert.match(codeActions, /getConfiguration\('inlineChat'\)\.get\('affordance'\) !== 'off'/);
});

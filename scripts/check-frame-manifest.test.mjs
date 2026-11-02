// Sprint 152 (R7): the frame manifest check, on this repository and on fixtures made from it: a renamed head command,
// a renamed permanent tab, a place the manifest doesn't name, a frame-shaping default that differs, and a shell from
// before the manifest. Run: node --test scripts/check-frame-manifest.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { frameMismatches, readFrameIdentifiers } from './check-frame-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts', 'check-frame-manifest.mjs');
const product = JSON.parse(fs.readFileSync(path.join(root, 'branding', 'product.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'extensions', 'ritemark', 'package.json'), 'utf8'));
const identifiersSource = fs.readFileSync(path.join(root, 'extensions', 'ritemark', 'src', 'frameIdentifiers.ts'), 'utf8');
const identifiers = readFrameIdentifiers(identifiersSource);
const clone = value => JSON.parse(JSON.stringify(value));

/** An extension folder with this package.json and frameIdentifiers.ts, changed by `change`, and the CLI's answer. */
function runOnFixture(change = (fixture) => fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-frame-check-'));
  try {
    const fixture = change({ pkg: clone(pkg), identifiers: identifiersSource });
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(fixture.pkg));
    fs.writeFileSync(path.join(dir, 'src', 'frameIdentifiers.ts'), fixture.identifiers);
    const run = spawnSync(process.execPath, [cli, '--product', path.join(root, 'branding', 'product.json'), '--extension', dir], { encoding: 'utf8' });
    return { status: run.status, out: run.stdout.trim().split('\n').filter(Boolean) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('this repository\'s extension fills its shell\'s frame', () => {
  assert.deepEqual(frameMismatches(product, pkg, identifiers), []);
  assert.deepEqual(runOnFixture(), { status: 0, out: [] });
});

test('the identifiers are read from the module the extension compiles, however it is written', () => {
  assert.equal(identifiers.HOME_TAB_VIEW_TYPE, 'ritemark.home');
  const restyled = readFrameIdentifiers(identifiersSource
    .replace(`HOME_TAB_VIEW_TYPE = 'ritemark.home'`, `HOME_TAB_VIEW_TYPE: string = "ritemark.home"`)
    .replace(`WELCOME_VIEW_TYPE = 'ritemark.welcome'`, `WELCOME_VIEW_TYPE = 'ritemark.welcome' as const`));
  assert.deepEqual(restyled, identifiers);
  assert.deepEqual(readFrameIdentifiers(`export const LIST: readonly string[] = ['a', "b"] as const;`), { LIST: ['a', 'b'] });
  assert.deepEqual(readFrameIdentifiers(`export const JOINED = 'ritemark.' + 'home';`), {}, 'an expression is not read as a value');
});

test('an identifier the check can\'t read is a mismatch, not a skip', () => {
  const result = runOnFixture(({ pkg: same, identifiers: source }) => ({ pkg: same, identifiers: source.replace(`export const HOME_PLACE_ID = 'workbench.view.extension.ritemark-home';`, `export const HOME_PLACE_ID = \`workbench.view.extension.ritemark-home\`;`) }));
  assert.deepEqual(result, { status: 1, out: ['could not read HOME_PLACE_ID from src/frameIdentifiers.ts', 'Home\'s place is workbench.view.extension.ritemark-home in the manifest, undefined in src/frameIdentifiers.ts'] });
});

test('a renamed head command is refused, with its name', () => {
  const result = runOnFixture(({ pkg: changed, identifiers: source }) => {
    changed.contributes.commands = changed.contributes.commands.map(command => command.command === 'ritemark.tasks.newTask' ? { ...command, command: 'ritemark.tasks.addTask' } : command);
    return { pkg: changed, identifiers: source };
  });
  assert.deepEqual(result, { status: 1, out: ['head row on workbench.view.extension.ritemark-tasks: no command ritemark.tasks.newTask in package.json'] });
});

test('a renamed permanent tab is refused, with its name', () => {
  const result = runOnFixture(({ pkg: same, identifiers: source }) => ({ pkg: same, identifiers: source.replace(`BOARD_TAB_VIEW_TYPE = 'ritemark.taskBoard'`, `BOARD_TAB_VIEW_TYPE = 'ritemark.board'`) }));
  assert.deepEqual(result, { status: 1, out: ['the permanent tabs are mainThreadWebview-ritemark.home, mainThreadWebview-ritemark.taskBoard in the manifest, mainThreadWebview-ritemark.home, mainThreadWebview-ritemark.board in src/frameIdentifiers.ts'] });
});

test('a frame-shaping setting the shell lists is compared even when the extension no longer sets it', () => {
  const changed = clone(pkg);
  delete changed.contributes.configurationDefaults['workbench.editor.tabSizing'];
  assert.deepEqual(frameMismatches(product, changed, identifiers), ['setting workbench.editor.tabSizing: undefined in package.json, "fixed" in the shell\'s product.json']);
});

test('a place the manifest doesn\'t name, a place gone, and a default that differs are refused', () => {
  const changed = clone(pkg);
  changed.contributes.viewsContainers.activitybar = [...changed.contributes.viewsContainers.activitybar.filter(container => container.id !== 'ritemark-transcribe'), { id: 'ritemark-notes', title: 'Notes', icon: 'media/notes.svg' }];
  changed.contributes.views['ritemark-notes'] = [{ id: 'ritemark.notesView', name: 'Notes' }];
  changed.contributes.configurationDefaults['workbench.activityBar.location'] = 'default';
  assert.deepEqual(frameMismatches(product, changed, identifiers), [
    'place workbench.view.extension.ritemark-transcribe: no view container ritemark-transcribe in package.json',
    'place workbench.view.extension.ritemark-notes: not in the manifest (it would arrive after the first frame)',
    'setting workbench.activityBar.location: "default" in package.json, "top" in the shell\'s product.json',
  ]);
});

test('a manifest that lists no frame-shaping settings is refused', () => {
  const { settings: _settings, ...frame } = product.ritemarkFrame;
  assert.deepEqual(frameMismatches({ ...product, ritemarkFrame: frame }, pkg, identifiers), ['the manifest lists no frame-shaping settings (ritemarkFrame.settings)']);
});

test('the check runs when it is reached through a symlink', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-frame-link-'));
  try {
    const link = path.join(dir, 'check-frame-manifest.mjs');
    fs.symlinkSync(cli, link);
    const run = spawnSync(process.execPath, [link, '--product', path.join(root, 'branding', 'product.json'), '--extension', path.join(root, 'extensions', 'ritemark')], { encoding: 'utf8' });
    const broken = spawnSync(process.execPath, [link, '--product', path.join(dir, 'missing.json')], { encoding: 'utf8' });
    assert.deepEqual({ status: run.status, failsLoudly: broken.status !== 0 }, { status: 0, failsLoudly: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a shell from before the manifest draws no slots: nothing to fill', () => {
  const { ritemarkFrame: _frame, ...older } = product;
  assert.deepEqual(frameMismatches(older, pkg, identifiers), []);
});

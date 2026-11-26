// Sprint 152 (R7): the frame manifest check, on this repository and on fixtures made from it: a renamed head command,
// a renamed permanent tab, a place the manifest doesn't name, a frame-shaping default that differs, and a shell from
// before the manifest. Sprint 159: a place with a setting (a feature flag), and one off by default that an older
// shell's manifest doesn't name (decision 2). Run: node --test scripts/check-frame-manifest.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { frameMismatches, offByDefaultPlacesMissing, readFrameIdentifiers } from './check-frame-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts', 'check-frame-manifest.mjs');
const product = JSON.parse(fs.readFileSync(path.join(root, 'branding', 'product.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'extensions', 'ritemark', 'package.json'), 'utf8'));
const identifiersSource = fs.readFileSync(path.join(root, 'extensions', 'ritemark', 'src', 'frameIdentifiers.ts'), 'utf8');
const identifiers = readFrameIdentifiers(identifiersSource);
const clone = value => JSON.parse(JSON.stringify(value));

/** An extension folder with this package.json and frameIdentifiers.ts, changed by `change`, and the CLI's answer. */
function runOnFixture(change = (fixture) => fixture, productFile = path.join(root, 'branding', 'product.json')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-frame-check-'));
  try {
    const fixture = change({ pkg: clone(pkg), identifiers: identifiersSource });
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(fixture.pkg));
    fs.writeFileSync(path.join(dir, 'src', 'frameIdentifiers.ts'), fixture.identifiers);
    const run = spawnSync(process.execPath, [cli, '--product', productFile, '--extension', dir], { encoding: 'utf8' });
    return { status: run.status, out: run.stdout.trim().split('\n').filter(Boolean), err: run.stderr.trim().split('\n').filter(Boolean) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('this repository\'s extension fills its shell\'s frame', () => {
  assert.deepEqual(frameMismatches(product, pkg, identifiers), []);
  assert.deepEqual(runOnFixture(), { status: 0, out: [], err: [] });
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
  assert.deepEqual(result, { status: 1, out: ['could not read HOME_PLACE_ID from src/frameIdentifiers.ts', 'Home\'s place is workbench.view.extension.ritemark-home in the manifest, undefined in src/frameIdentifiers.ts'], err: [] });
});

test('a renamed head command is refused, with its name', () => {
  const result = runOnFixture(({ pkg: changed, identifiers: source }) => {
    changed.contributes.commands = changed.contributes.commands.map(command => command.command === 'ritemark.tasks.newTask' ? { ...command, command: 'ritemark.tasks.addTask' } : command);
    return { pkg: changed, identifiers: source };
  });
  assert.deepEqual(result, { status: 1, out: ['head row on workbench.view.extension.ritemark-tasks: no command ritemark.tasks.newTask in package.json'], err: [] });
});

test('a renamed permanent tab is refused, with its name', () => {
  const result = runOnFixture(({ pkg: same, identifiers: source }) => ({ pkg: same, identifiers: source.replace(`BOARD_TAB_VIEW_TYPE = 'ritemark.taskBoard'`, `BOARD_TAB_VIEW_TYPE = 'ritemark.board'`) }));
  assert.deepEqual(result, { status: 1, out: ['the permanent tabs are mainThreadWebview-ritemark.home, mainThreadWebview-ritemark.taskBoard in the manifest, mainThreadWebview-ritemark.home, mainThreadWebview-ritemark.board in src/frameIdentifiers.ts'], err: [] });
});

test('a permanent tab\'s title, icons or gating setting that differ from the manifest\'s are refused, naming the tab and the field', () => {
  const source = (from, to) => identifiersSource.replace(from, to);
  const check = changed => frameMismatches(product, pkg, readFrameIdentifiers(changed));
  assert.deepEqual(check(source(`HOME_TAB_TITLE = 'Home'`, `HOME_TAB_TITLE = 'Start'`)), ['permanent tab Home: its title is "Home" in the manifest, "Start" in src/frameIdentifiers.ts']);
  assert.deepEqual(check(source(`BOARD_TAB_ICON_DARK = 'media/tasks-tab-dark.svg'`, `BOARD_TAB_ICON_DARK = 'media/board-dark.svg'`)), ['permanent tab Task board: its dark icon is "media/tasks-tab-dark.svg" in the manifest, "media/board-dark.svg" in src/frameIdentifiers.ts']);
  assert.deepEqual(check(source(`HOME_TAB_ICON_LIGHT = 'media/home/home-tab-light.svg'`, `HOME_TAB_ICON_LIGHT = 'media/home.svg'`)), ['permanent tab Home: its light icon is "media/home/home-tab-light.svg" in the manifest, "media/home.svg" in src/frameIdentifiers.ts']);
  assert.deepEqual(check(source(`BOARD_TAB_SETTING = 'ritemark.features.task-board'`, `BOARD_TAB_SETTING = 'ritemark.features.board'`)), ['permanent tab Task board: its setting is "ritemark.features.task-board" in the manifest, "ritemark.features.board" in src/frameIdentifiers.ts']);
  const result = runOnFixture(({ pkg: same, identifiers: text }) => ({ pkg: same, identifiers: text.replace(`BOARD_TAB_TITLE = 'Task board'`, `BOARD_TAB_TITLE = 'Tasks'`) }));
  assert.deepEqual(result, { status: 1, out: ['permanent tab Task board: its title is "Task board" in the manifest, "Tasks" in src/frameIdentifiers.ts'], err: [] });
  assert.deepEqual(frameMismatches(product, pkg, identifiers), [], 'the values that match pass');
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

// --- Sprint 159: a place with a setting -------------------------------------------------------------------------

const DECKS = 'ritemark.features.decks';
const SLIDES = 'workbench.view.extension.ritemark-slide-library';
const slidesPlace = { id: SLIDES, title: 'Slide library', order: 0.55, icon: 'media/slide-library-icon.svg', setting: DECKS, settingDefault: false };

/**
 * This package.json with a Slide library place behind the `decks` flag, as the Decks branch has it, changed by
 * `change`: whatever this repository's own package.json already has of it is replaced, so the fixture is the same
 * before and after Decks is on main.
 */
function withSlides(change = () => {}) {
  const changed = clone(pkg);
  const activitybar = changed.contributes.viewsContainers.activitybar.filter(container => container.id !== 'ritemark-slide-library');
  activitybar.splice(activitybar.findIndex(container => container.id === 'ritemark-tasks') + 1, 0, { id: 'ritemark-slide-library', title: 'Slide library', icon: 'media/slide-library-icon.svg' });
  changed.contributes.viewsContainers.activitybar = activitybar;
  changed.contributes.views['ritemark-slide-library'] = [{ type: 'webview', id: 'ritemark.slideLibraryView', name: 'Slide library', when: `config.${DECKS}` }];
  for (const section of changed.contributes.configuration) {
    delete section.properties?.[DECKS];
  }
  const section = changed.contributes.configuration.find(entry => entry.properties) ?? changed.contributes.configuration[0];
  section.properties[DECKS] = { type: 'boolean', default: false, description: 'Decks' };
  change(changed);
  return changed;
}

/** This product.json with the Slide library place in its manifest (after Tasks), changed by `place`. */
function productWithSlides(place = slidesPlace) {
  const changed = clone(product);
  const places = changed.ritemarkFrame.places.filter(entry => entry.id !== SLIDES);
  places.splice(places.findIndex(entry => entry.id === 'workbench.view.extension.ritemark-tasks') + 1, 0, place);
  changed.ritemarkFrame.places = places;
  return changed;
}

test('a place with a setting accepts matching boolean defaults and views shown on config.<setting>', () => {
  assert.deepEqual(frameMismatches(productWithSlides(), withSlides(), identifiers), []);
  assert.deepEqual(frameMismatches(productWithSlides({ ...slidesPlace, settingDefault: true }), pkg, identifiers), []);
});

test('a place\'s setting that isn\'t a boolean of the extension\'s, or has a different default, or a view shown on anything else, is refused', () => {
  assert.deepEqual({
    notASetting: frameMismatches(productWithSlides({ ...slidesPlace, setting: 'ritemark.features.slides' }), withSlides(), identifiers),
    notABoolean: frameMismatches(productWithSlides(), withSlides(changed => { changed.contributes.configuration.find(entry => entry.properties?.[DECKS]).properties[DECKS] = { type: 'string', default: 'off' }; }), identifiers),
    onByDefault: frameMismatches(productWithSlides(), withSlides(changed => { changed.contributes.configuration.find(entry => entry.properties?.[DECKS]).properties[DECKS].default = true; }), identifiers),
    anotherWhen: frameMismatches(productWithSlides(), withSlides(changed => { changed.contributes.views['ritemark-slide-library'].push({ id: 'ritemark.slideLibraryHelp', name: 'Help', when: `config.${DECKS} && workspaceFolderCount > 0` }, { id: 'ritemark.slideLibraryAlways', name: 'Always' }); }), identifiers),
  }, {
    notASetting: [
      `place ${SLIDES}: its setting "ritemark.features.slides" is not a boolean setting in package.json`,
      `place ${SLIDES}: its view ritemark.slideLibraryView is shown on "config.${DECKS}", the manifest seeds it on "config.ritemark.features.slides"`,
    ],
    notABoolean: [
      `place ${SLIDES}: its setting "${DECKS}" is not a boolean setting in package.json`,
    ],
    onByDefault: [
      `place ${SLIDES}: settingDefault must be a boolean matching ${DECKS} in package.json (manifest: false, package.json: true)`,
    ],
    anotherWhen: [
      `place ${SLIDES}: its view ritemark.slideLibraryHelp is shown on "config.${DECKS} && workspaceFolderCount > 0", the manifest seeds it on "config.${DECKS}"`,
      `place ${SLIDES}: its view ritemark.slideLibraryAlways is shown on undefined, the manifest seeds it on "config.${DECKS}"`,
    ],
  });
});

test('settingDefault must be boolean and paired with a setting', () => {
  for (const settingDefault of [undefined, 'false']) {
    assert.deepEqual(frameMismatches(productWithSlides({ ...slidesPlace, settingDefault }), withSlides(), identifiers), [
      `place ${SLIDES}: settingDefault must be a boolean matching ${DECKS} in package.json (manifest: ${JSON.stringify(settingDefault)}, package.json: false)`,
    ]);
  }
  assert.deepEqual(frameMismatches(productWithSlides({ ...slidesPlace, setting: undefined, settingDefault: true }), pkg, identifiers), [
    `place ${SLIDES}: settingDefault requires a setting`,
  ]);
});

test('a setting on VS Code\'s own place (Documents) is refused: only an extension\'s place is shown on one', () => {
  const product159 = productWithSlides();
  product159.ritemarkFrame.places = product159.ritemarkFrame.places.map(place => place.id === 'workbench.view.explorer' ? { ...place, setting: DECKS } : place);
  assert.deepEqual(frameMismatches(product159, withSlides(), identifiers), [
    'place workbench.view.explorer: VS Code\'s own place can\'t carry a setting (only an extension\'s place is shown on one)',
  ]);
});

test('two places off by default missing from an older manifest: each is accepted and named on its own line', () => {
  const older = clone(product);
  older.ritemarkFrame.places = older.ritemarkFrame.places.filter(entry => entry.id !== SLIDES);
  const twoPlaces = withSlides(changed => {
    changed.contributes.viewsContainers.activitybar.push({ id: 'ritemark-handouts', title: 'Handouts', icon: 'media/handouts.svg' });
    changed.contributes.views['ritemark-handouts'] = [{ id: 'ritemark.handoutsView', name: 'Handouts', when: 'config.ritemark.features.handouts' }];
    changed.contributes.configuration.find(entry => entry.properties?.[DECKS]).properties['ritemark.features.handouts'] = { type: 'boolean', default: false };
  });
  assert.deepEqual({ problems: frameMismatches(older, twoPlaces, identifiers), accepted: offByDefaultPlacesMissing(older, twoPlaces) }, {
    problems: [],
    accepted: [{ id: SLIDES, setting: DECKS }, { id: 'workbench.view.extension.ritemark-handouts', setting: 'ritemark.features.handouts' }],
  });
});

test('a place off by default that the manifest draws always (no setting) is refused, naming the setting it needs', () => {
  const { setting: _setting, settingDefault: _settingDefault, ...always } = slidesPlace;
  assert.deepEqual(frameMismatches(productWithSlides(always), withSlides(), identifiers), [
    `place ${SLIDES}: off by default in package.json (config.${DECKS}), but the manifest draws it always: give it "setting": "${DECKS}", "settingDefault": false`,
  ]);
});

test('decision 2: an older shell\'s manifest without a place that is off by default passes, and the CLI says why on stderr', () => {
  const older = clone(product);
  older.ritemarkFrame.places = older.ritemarkFrame.places.filter(entry => entry.id !== SLIDES);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-frame-older-'));
  try {
    const productFile = path.join(dir, 'product.json');
    fs.writeFileSync(productFile, JSON.stringify(older));
    const accepted = runOnFixture(({ identifiers: source }) => ({ pkg: withSlides(), identifiers: source }), productFile);
    // Not off by default: on by default, or one of its views shown always, or on two flags
    const onByDefault = runOnFixture(({ identifiers: source }) => ({ pkg: withSlides(changed => { changed.contributes.configuration.find(entry => entry.properties?.[DECKS]).properties[DECKS].default = true; }), identifiers: source }), productFile);
    const shownAlways = frameMismatches(older, withSlides(changed => { changed.contributes.views['ritemark-slide-library'].push({ id: 'ritemark.slideLibraryAlways', name: 'Always' }); }), identifiers);
    const twoFlags = frameMismatches(older, withSlides(changed => {
      changed.contributes.views['ritemark-slide-library'].push({ id: 'ritemark.slideLibraryOther', name: 'Other', when: 'config.ritemark.features.other' });
      changed.contributes.configuration.find(entry => entry.properties?.[DECKS]).properties['ritemark.features.other'] = { type: 'boolean', default: false };
    }), identifiers);
    const missing = `place ${SLIDES}: not in the manifest (it would arrive after the first frame)`;
    assert.deepEqual({ accepted, onByDefault, shownAlways, twoFlags, listed: offByDefaultPlacesMissing(older, withSlides()), listedOnNewer: offByDefaultPlacesMissing(productWithSlides(), withSlides()) }, {
      accepted: { status: 0, out: [], err: [`place ${SLIDES} is off by default (${DECKS}) and not in this shell's manifest: it shows only once the setting is on, after the first frame and in More`] },
      onByDefault: { status: 1, out: [missing], err: [] },
      shownAlways: [missing],
      twoFlags: [missing],
      listed: [{ id: SLIDES, setting: DECKS }],
      listedOnNewer: [],
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

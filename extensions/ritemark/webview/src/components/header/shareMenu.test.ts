/**
 * Share on the document's bar (Sprint 134, R12, R14): experience 26's frame 1
 * order and words, and every item 1.x's Export menu had, in each Google Docs
 * state, still reachable with the same handler and the same message to the host.
 *
 * The messages are posted by App.tsx's handlers (and lib/clipboard.ts); the
 * last block checks that wiring in the source, as composerMenus.test.ts does.
 *
 * Run: npx tsx webview/src/components/header/shareMenu.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { GoogleDocsAction, GoogleDocsDocumentState, GoogleDocsProjection } from './googleDocsMenu';
import { SHARE_BUTTON_ATTRIBUTE, SHARE_FOOT, runShareItem, shareMenuModel, type ShareMenuModel, type ShareRun } from './shareMenu';

const projection = (state: GoogleDocsDocumentState): GoogleDocsProjection => ({
  state,
  docUrl: state === 'bound' || state === 'account-mismatch' ? 'https://docs.google.com/document/d/x/edit' : null,
  title: state === 'bound' || state === 'account-mismatch' ? 'Course outline' : null,
  lastSyncedAt: state === 'bound' ? '2026-10-19T10:00:00.000Z' : null,
  boundAccountEmail: state === 'bound' || state === 'account-mismatch' ? 'jarmo@productory.eu' : null,
  stage: state === 'busy' ? 'writing' : null,
});
const now = new Date('2026-10-19T10:05:00.000Z');

// --- The message each handler posts (App.tsx's wiring, checked at the end) ---
const GOOGLE_DOCS_MESSAGE: Record<GoogleDocsAction, string> = {
  publish: 'google-docs/publish',
  open: 'google-docs/open',
  unlink: 'google-docs/unlink',
  settings: 'google-docs/open-settings',
};

/** Runs an item through runShareItem and returns the message the host receives. */
function messageFor(run: ShareRun): { message: string; templateId?: string } {
  const calls: Array<{ message: string; templateId?: string }> = [];
  runShareItem(run, {
    onExportPDF: (templateId) => { calls.push({ message: 'exportPDF', templateId }); },
    onExportWord: (templateId) => { calls.push({ message: 'exportWord', templateId }); },
    onCopyAsMarkdown: () => { calls.push({ message: 'copyToClipboard' }); },
    onGoogleDocsAction: (action) => { calls.push({ message: GOOGLE_DOCS_MESSAGE[action] }); },
  });
  assert.equal(calls.length, 1, `one handler runs for ${JSON.stringify(run)}`);
  return calls[0];
}

const enabledMessages = (model: ShareMenuModel) => model.groups
  .flatMap((g) => g.items)
  .filter((i) => i.run && !i.disabled)
  .map((i) => messageFor(i.run as ShareRun).message);

// --- Frame 1: the order, the group titles, the words and the second lines ---
const unbound = shareMenuModel(projection('unbound'), { googleDocs: true, now });
assert.deepEqual(unbound.groups.map((g) => g.title), ['Send a copy', 'Google Docs', null]);
assert.deepEqual(
  unbound.groups.flatMap((g) => g.items.map((i) => [i.label, i.detail])),
  [
    ['PDF', 'For reading and printing'],
    ['Word document', 'For people who edit in Word'],
    ['Publish to Google Docs', 'One Google Doc you update from here'],
    ['Copy as Markdown', 'For email and chat'],
  ],
);
assert.equal(unbound.groups[2].items[0].detailBeside, true, "Copy as Markdown's words sit at the row's end");
assert.equal(unbound.foot, 'The document stays on this computer. Sharing sends a copy.');
assert.equal(SHARE_FOOT, unbound.foot);

// PDF and Word keep 1.x's "clean" template.
assert.deepEqual(messageFor({ kind: 'pdf' }), { message: 'exportPDF', templateId: 'clean' });
assert.deepEqual(messageFor({ kind: 'word' }), { message: 'exportWord', templateId: 'clean' });

// --- Each Google Docs state: what Share holds and what each item posts ---
const SEND_AND_COPY = ['exportPDF', 'exportWord', 'copyToClipboard'];
type StateKey = GoogleDocsDocumentState | 'none';
const cases: Record<StateKey, { googleDocs: Array<[string, string | null]>; oneX: string[] }> = {
  // null projection: the host has not answered yet.
  none: { googleDocs: [], oneX: [] },
  hidden: { googleDocs: [], oneX: [] },
  unavailable: { googleDocs: [], oneX: [] },
  'not-connected': {
    googleDocs: [['Publish to Google Docs', 'google-docs/open-settings']],
    oneX: ['google-docs/open-settings'], // Connect Google Docs…
  },
  unbound: {
    googleDocs: [['Publish to Google Docs', 'google-docs/publish']],
    oneX: ['google-docs/publish'], // Create Google Doc
  },
  bound: {
    googleDocs: [
      ['Update the Google Doc', 'google-docs/publish'],
      ['Open in Google Docs', 'google-docs/open'],
      ['Remove the link…', 'google-docs/unlink'],
    ],
    oneX: ['google-docs/publish', 'google-docs/open', 'google-docs/unlink'], // Sync, Open, Remove Google Docs link…
  },
  'account-mismatch': {
    googleDocs: [['Reconnect your Google account', 'google-docs/open-settings']],
    oneX: ['google-docs/open-settings'], // Reconnect Google account…
  },
  busy: {
    googleDocs: [['Writing to Google Docs…', null]],
    oneX: [], // one disabled line naming the stage
  },
};

for (const [key, expected] of Object.entries(cases) as Array<[StateKey, (typeof cases)[StateKey]]>) {
  const model = shareMenuModel(key === 'none' ? null : projection(key), { googleDocs: true, now });
  const group = model.groups.find((g) => g.id === 'google-docs');

  // Send a copy first and Copy as Markdown last, in every state.
  assert.equal(model.groups[0].title, 'Send a copy', key);
  assert.deepEqual(model.groups[model.groups.length - 1].items.map((i) => i.label), ['Copy as Markdown'], key);

  assert.deepEqual(
    (group?.items ?? []).map((i) => [i.label, i.run && !i.disabled ? messageFor(i.run).message : null]),
    expected.googleDocs,
    `${key}: the Google Docs group`,
  );
  assert.equal(Boolean(group), expected.googleDocs.length > 0, `${key}: the group shows only with something in it`);

  // Every 1.x Export action in this state is reachable from Share, with the same message, and nothing else is added.
  assert.deepEqual(enabledMessages(model).sort(), [...SEND_AND_COPY, ...expected.oneX].sort(), `${key}: 1.x actions`);
}

// Busy: the stage line is disabled and runs nothing.
const busyItem = shareMenuModel(projection('busy'), { googleDocs: true }).groups[1].items[0];
assert.equal(busyItem.disabled, true);
assert.equal(busyItem.busy, true);
assert.equal(busyItem.run, null);

// Without App's Google Docs handler there is no Google Docs group, as Export did.
assert.deepEqual(
  shareMenuModel(projection('bound'), { googleDocs: false }).groups.map((g) => g.id),
  ['send-a-copy', 'copy'],
);

// Every label and second line stays on one line.
for (const state of Object.keys(cases) as StateKey[]) {
  for (const item of shareMenuModel(state === 'none' ? null : projection(state), { googleDocs: true, now }).groups.flatMap((g) => g.items)) {
    assert.ok(!item.label.includes('\n') && !(item.detail ?? '').includes('\n'), item.label);
  }
}

// --- The wiring: App.tsx's handlers post the messages above ---
const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const app = read('../../App.tsx');
const clipboard = read('../../lib/clipboard.ts');
const header = read('./DocumentHeader.tsx');

/** The body of one of App's useCallback handlers, up to its dependency list. */
function handler(name: string): string {
  const start = app.indexOf(`const ${name} = useCallback(`);
  assert.ok(start >= 0, `App.tsx defines ${name}`);
  const end = app.indexOf('\n  }, [', start);
  assert.ok(end > start, `${name} ends`);
  return app.slice(start, end);
}

assert.match(app, /onExportPDF=\{handleExportPDF\}/);
assert.match(app, /onExportWord=\{handleExportWord\}/);
assert.match(app, /onCopyAsMarkdown=\{handleCopyAsMarkdown\}/);
assert.match(app, /onGoogleDocsAction=\{handleGoogleDocsAction\}/);
assert.match(handler('handleExportPDF'), /sendToExtension\('exportPDF'/);
assert.match(handler('handleExportWord'), /sendToExtension\('exportWord'/);
assert.match(handler('handleCopyAsMarkdown'), /writeClipboard\(/);
assert.match(clipboard, /export function writeClipboard[\s\S]*?sendToExtension\('copyToClipboard'/);
const googleDocs = handler('handleGoogleDocsAction');
assert.match(googleDocs, /case 'publish': void handlePublishGoogleDocs\(\)/);
assert.match(handler('handlePublishGoogleDocs'), /sendToExtension\('google-docs\/publish'/);
for (const action of ['open', 'unlink', 'settings'] as const) {
  assert.match(googleDocs, new RegExp(`case '${action}': sendToExtension\\('${GOOGLE_DOCS_MESSAGE[action]}'`), action);
}

// The host still takes each message.
const host = read('../../../../src/ritemarkEditor.ts');
for (const message of SEND_AND_COPY) assert.match(host, new RegExp(`case '${message}':`), message);
const hostProtocol = read('../../../../src/googleDocs/protocol.ts');
for (const message of Object.values(GOOGLE_DOCS_MESSAGE)) assert.match(hostProtocol, new RegExp(`case '${message}'`), message);

// The Share button carries the attribute the menu finds it by.
assert.match(header, /SHARE_BUTTON_ATTRIBUTE/);
assert.equal(SHARE_BUTTON_ATTRIBUTE, 'data-share-button');

console.log('webview/shareMenu: all assertions passed');

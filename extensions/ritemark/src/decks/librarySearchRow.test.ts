/**
 * #887: the Slide library's Search row is the search field in its own place (patch 018 draws it). The row's command
 * reads what the shell's field sends, and the manifest, the keybinding and the context key agree with the shell.
 * Run with `npx tsx src/decks/librarySearchRow.test.ts`.
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LIBRARY_FIELD_CONTEXT_KEY, LIBRARY_SEARCH_COMMAND, MAX_LIBRARY_SEARCH_CHARS, SHELL_FIELD_COMMAND, librarySearchRow } from './librarySearchRow';

// What the shell's field sends: its words, ↓ and Enter with words; the command with nothing (⌘F, an older shell's row)
assert.deepEqual(
  {
    words: librarySearchRow({ text: 'agenda' }),
    cleared: librarySearchRow({ text: '' }),
    long: librarySearchRow({ text: 'x'.repeat(500) }),
    down: librarySearchRow({ key: 'down' }),
    enter: librarySearchRow({ key: 'enter' }),
    nothing: librarySearchRow(undefined),
    otherKey: librarySearchRow({ key: 'escape' }),
    notText: librarySearchRow({ text: 12 }),
  },
  {
    words: { kind: 'text', text: 'agenda' },
    cleared: { kind: 'text', text: '' },
    long: { kind: 'text', text: 'x'.repeat(MAX_LIBRARY_SEARCH_CHARS) },
    down: { kind: 'results' },
    enter: { kind: 'results' },
    nothing: { kind: 'focus' },
    otherKey: { kind: 'focus' },
    notText: { kind: 'focus' },
  },
);

// The names the shell reads (ritemarkProjectHead.ts: `_ritemark.projectHead.field`, `<command>.field`)
assert.equal(SHELL_FIELD_COMMAND, '_ritemark.projectHead.field');
assert.equal(LIBRARY_FIELD_CONTEXT_KEY, 'ritemark.slideLibrary.search.field');

// The frame's manifest marks the place's Search row as a field
const root = path.join(__dirname, '..', '..', '..', '..');
const product = JSON.parse(fs.readFileSync(path.join(root, 'branding', 'product.json'), 'utf8')) as {
  ritemarkFrame: { places: Array<{ id: string; head?: { rows: Array<{ command: string; field?: boolean }> } }> };
};
const library = product.ritemarkFrame.places.find((place) => place.id === 'workbench.view.extension.ritemark-slide-library');
assert.deepEqual(library?.head?.rows, [{ command: LIBRARY_SEARCH_COMMAND, field: true }]);

// ⌘F (Ctrl+F) in the place runs the row's command, which puts the caret in the shell's field
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
  contributes: { keybindings: Array<{ command: string; key: string; mac?: string; when?: string; args?: unknown }> };
};
const binding = pkg.contributes.keybindings.find((entry) => entry.command === LIBRARY_SEARCH_COMMAND);
assert.deepEqual(binding && { key: binding.key, mac: binding.mac, args: binding.args }, { key: 'ctrl+f', mac: 'cmd+f', args: undefined });
// On the place's rows; in its page (a webview, whose keys reach no view's `when`) the page sends `library/find` itself
assert.equal(binding?.when, 'sideBarFocus && activeViewlet == workbench.view.extension.ritemark-slide-library');

console.log('librarySearchRow: all tests passed');

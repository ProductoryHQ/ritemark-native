import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Keybinding { key: string; mac?: string; command: string; when?: string }

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  contributes: { keybindings: Keybinding[] };
};
const keybindings = manifest.contributes.keybindings;
const when = 'activeCustomEditorId == ritemark.editor && !inputFocus';

// VS Code's webview host forwards every keydown to the workbench, where the
// built-in `undo`/`redo` commands reach the custom editor's text-document undo
// stack. The webview's ProseMirror history already handled the keystroke, so
// without this override one Cmd+Z ran two undos that fought through the sync
// coordinator. A removal rule (`-undo`) does not reach the built-in binding.
test('the Ritemark editor shadows built-in undo/redo while a document editor is active', () => {
  const undo = keybindings.filter(k => k.command === 'ritemark.editor.undoHandledByEditor');
  const redo = keybindings.filter(k => k.command === 'ritemark.editor.redoHandledByEditor');
  assert.deepEqual(undo.map(k => [k.key, k.mac, k.when]), [['ctrl+z', 'cmd+z', when]]);
  assert.deepEqual(
    redo.map(k => [k.key, k.mac ?? null, k.when]).sort(),
    [['ctrl+shift+z', 'cmd+shift+z', when], ['ctrl+y', null, when]].sort(),
  );
  assert.ok(
    !keybindings.some(k => k.command === '-undo' || k.command === '-redo'),
    'removal rules are ineffective for the built-in undo binding; keep the positive override',
  );
});

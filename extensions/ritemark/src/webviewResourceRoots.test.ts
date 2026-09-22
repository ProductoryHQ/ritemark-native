import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import {
  isTooBroadResourceRoot,
  resolveDocumentResourceRoots,
  resolveDocumentRoot,
  toMarkdownRelativePath,
} from './webviewResourceRoots';

const media = path.join(path.sep, 'ext', 'media');
const home = path.join(path.sep, 'Users', 'me');
const workspace = path.join(home, 'clients', 'harbor-logistics');
const document = path.join(workspace, '04-deliverable', 'findings-draft.md');
const docDir = path.dirname(document);

// ── The bug: an image outside the document's own directory ─────────────────
// `04-deliverable/findings-draft.md` referencing `../images/operating-model.drawio.svg`
// resolved to a real file, was mapped to a webview URI, and then came back 401
// because the workspace folder was not a resource root.
const roots = resolveDocumentResourceRoots({
  mediaPath: media,
  documentPath: document,
  workspaceFolderPath: workspace,
  homeDir: home,
});
assert.deepStrictEqual(roots, [media, docDir, workspace]);
const image = path.join(workspace, 'images', 'operating-model.drawio.svg');
assert.ok(
  roots.some(root => image.startsWith(root + path.sep)),
  '../images/*.svg must fall under a resource root, or the webview refuses it with 401',
);

// The extension's own assets and the document's directory are always present.
assert.ok(roots.includes(media));
assert.ok(roots.includes(docDir));

// ── A document outside every workspace folder keeps the old behaviour ──────
assert.deepStrictEqual(
  resolveDocumentResourceRoots({
    mediaPath: media,
    documentPath: path.join(path.sep, 'tmp', 'scratch', 'note.md'),
    workspaceFolderPath: null,
    homeDir: home,
  }),
  [media, path.join(path.sep, 'tmp', 'scratch')],
);

// ── The workspace folder IS the document's folder: no duplicate root ───────
assert.deepStrictEqual(
  resolveDocumentResourceRoots({
    mediaPath: media,
    documentPath: path.join(workspace, 'README.md'),
    workspaceFolderPath: workspace,
    homeDir: home,
  }),
  [media, workspace],
);

// ── Security: never widen to the home directory or the filesystem root ─────
assert.strictEqual(isTooBroadResourceRoot(home, home), true);
assert.strictEqual(isTooBroadResourceRoot(path.parse(process.cwd()).root, home), true);
assert.strictEqual(isTooBroadResourceRoot(workspace, home), false);
// A folder *inside* home is a normal project folder and stays allowed.
assert.strictEqual(isTooBroadResourceRoot(path.join(home, 'notes'), home), false);

for (const tooBroad of [home, path.parse(process.cwd()).root]) {
  const guarded = resolveDocumentResourceRoots({
    mediaPath: media,
    documentPath: path.join(tooBroad, 'notes', 'a.md'),
    workspaceFolderPath: tooBroad,
    homeDir: home,
  });
  assert.deepStrictEqual(
    guarded,
    [media, path.join(tooBroad, 'notes')],
    `opening ${tooBroad} as a workspace must not expose it to the webview`,
  );
}

// `homeDir` is read from the OS in production; make sure the real value is
// rejected too (a trailing separator or a symlinked /home must not slip past).
assert.strictEqual(isTooBroadResourceRoot(os.homedir() + path.sep, os.homedir()), true);

// ── The watch root matches the widest root the webview may load from ──────
assert.strictEqual(
  resolveDocumentRoot({ documentPath: document, workspaceFolderPath: workspace, homeDir: home }),
  workspace,
);
assert.strictEqual(
  resolveDocumentRoot({ documentPath: document, workspaceFolderPath: null, homeDir: home }),
  docDir,
);
// A rejected (too broad) folder falls back to the document's directory, so the
// watcher never recurses over the whole home directory either.
assert.strictEqual(
  resolveDocumentRoot({ documentPath: path.join(home, 'notes', 'a.md'), workspaceFolderPath: home, homeDir: home }),
  path.join(home, 'notes'),
);

// ── Markdown-relative paths for the live image-refresh watcher ─────────────
assert.strictEqual(toMarkdownRelativePath(docDir, path.join(docDir, 'a.png')), './a.png');
assert.strictEqual(
  toMarkdownRelativePath(docDir, path.join(docDir, 'images', 'a.png')),
  './images/a.png',
);
// The regression this guards: `./` + `../images/a.svg` = `.././images/a.svg`,
// which never matches the document's own `../images/a.svg` reference.
assert.strictEqual(
  toMarkdownRelativePath(docDir, path.join(workspace, 'images', 'operating-model.drawio.svg')),
  '../images/operating-model.drawio.svg',
);
assert.strictEqual(
  toMarkdownRelativePath(docDir, path.join(workspace, 'cover.png')),
  '../cover.png',
);

console.log('webviewResourceRoots: all assertions passed');

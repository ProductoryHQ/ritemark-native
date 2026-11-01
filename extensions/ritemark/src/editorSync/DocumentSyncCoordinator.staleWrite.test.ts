/**
 * Sprint 145 R1 (#588): a writer's older copy over words Ritemark just saved.
 *
 * Drives the real DocumentSyncCoordinator with `vscode` stubbed, real temp files and a fake text document that
 * behaves as VS Code's text-file model does where it matters here (measured in `research/stale-write-repro.md`):
 * - an edit makes the document dirty; a save writes it, cleans it and carries patch 014's receipt;
 * - a clean document reloads its file when the file changes ("VS Code's reload"); a dirty one does not;
 * - a save is refused as newer when the file changed since the document last read it, and the refusal goes to
 *   `_ritemark.editorSync.answerSaveConflict` (patch 014); after a refusal Ritemark answered, auto-save stops.
 *
 * S1 runs in both orders the Mac run saw: VS Code's reload before Ritemark looks (`converged`, 8 of 10), and
 * Ritemark's watcher before the reload (`external-only`, 2 of 10).
 *
 * Run: npx tsx src/editorSync/DocumentSyncCoordinator.staleWrite.test.ts
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';

type Listener<T> = (event: T) => void;
const listeners = {
  save: [] as Listener<FakeDocument>[],
  change: [] as Listener<{ document: FakeDocument; contentChanges: unknown[] }>[],
};
const commands = new Map<string, (...args: unknown[]) => unknown>();
const executed: Array<{ id: string; args: unknown[] }> = [];
const warnings: string[] = [];
const watchers: Array<{ change?: () => void }> = [];
let activeDocument: FakeDocument | undefined;
let saveOrder: 'receipt-first' | 'reconcile-first' = 'receipt-first';

class Uri {
  constructor(readonly fsPath: string, readonly scheme = 'file') {}
  toString(): string { return this.scheme === 'file' ? `file://${this.fsPath}` : `${this.scheme}:${this.fsPath}`; }
  static file(fsPath: string): Uri { return new Uri(fsPath); }
  static parse(value: string): Uri { return new Uri(value, 'parsed'); }
}

const EndOfLine = { LF: 1, CRLF: 2 } as const;
const disposable = { dispose() {} };

const sha256 = (value: string) => crypto.createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
const logical = (text: string) => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const logicalHash = (text: string) => sha256(logical(text));
const RECEIPT = Symbol.for('ritemark.savedLogicalHash');

/** The parts of VS Code's TextDocument and text-file model this coordinator uses. */
class FakeDocument {
  readonly uri: Uri;
  readonly isUntitled = false;
  version = 1;
  isDirty = false;
  eol: number;
  hasBom: boolean;
  text: string;
  /** The file's bytes as the document last read or wrote them (VS Code's etag). */
  resolved: string;
  /** After a refused save that Ritemark answered, auto-save stops (VS Code's conflict mode). */
  conflictMode = false;
  receipt?: string;

  constructor(readonly file: string) {
    this.uri = Uri.file(file);
    const raw = fs.readFileSync(file, 'utf8');
    this.resolved = raw;
    this.hasBom = raw.startsWith('﻿');
    this.text = raw.replace(/^﻿/, '');
    this.eol = this.text.includes('\r\n') ? EndOfLine.CRLF : EndOfLine.LF;
  }

  get [RECEIPT](): string | undefined { return this.receipt; }
  getText(): string { return this.text; }
  positionAt(offset: number): number { return offset; }

  edit(next: string): void {
    const normalized = logical(next);
    this.text = this.eol === EndOfLine.CRLF ? normalized.replace(/\n/g, '\r\n') : normalized;
    this.version += 1;
    this.isDirty = true;
    for (const listener of listeners.change) listener({ document: this, contentChanges: [{}] });
  }

  private bytes(): string { return `${this.hasBom ? '﻿' : ''}${this.text}`; }

  /** VS Code's auto-save (or a save the person asks for). */
  async save(): Promise<'saved' | 'refused' | 'skipped'> {
    if (!this.isDirty || this.conflictMode) return 'skipped';
    if (fs.readFileSync(this.file, 'utf8') !== this.resolved) {
      const answer = await commands.get('_ritemark.editorSync.answerSaveConflict')!(this.uri);
      if (answer !== 'overwrite') {
        this.conflictMode = true;
        return 'refused';
      }
    }
    fs.writeFileSync(this.file, this.bytes());
    this.resolved = this.bytes();
    this.isDirty = false;
    // VS Code tells the extension host the document is clean (a change event with no content change) before
    // it fires the save with its receipt. On the Mac run the sync's reconcile of the first often finished
    // before the second arrived (`model-change:converged` after a save); `saveOrder` plays both.
    for (const listener of listeners.change) listener({ document: this, contentChanges: [] });
    if (saveOrder === 'reconcile-first') await sleep(50);
    this.receipt = logicalHash(this.text);
    for (const listener of listeners.save) listener(this);
    return 'saved';
  }

  /** VS Code's own reload of a clean document whose file changed. */
  reload(): boolean {
    if (this.isDirty) return false;
    const raw = fs.readFileSync(this.file, 'utf8');
    if (raw === this.resolved) return false;
    this.load(raw);
    return true;
  }

  /** `workbench.action.files.revert`. */
  revert(): void {
    this.load(fs.readFileSync(this.file, 'utf8'));
    this.isDirty = false;
    this.conflictMode = false;
  }

  private load(raw: string): void {
    this.resolved = raw;
    this.hasBom = raw.startsWith('﻿');
    this.text = raw.replace(/^﻿/, '');
    this.eol = this.text.includes('\r\n') ? EndOfLine.CRLF : EndOfLine.LF;
    this.version += 1;
    for (const listener of listeners.change) listener({ document: this, contentChanges: [{}] });
  }
}

const vscodeStub = {
  Uri,
  EndOfLine,
  Range: class { constructor(readonly start: unknown, readonly end: unknown) {} },
  RelativePattern: class { constructor(readonly base: unknown, readonly pattern: string) {} },
  WorkspaceEdit: class {
    readonly edits: Array<{ uri: Uri; text: string }> = [];
    replace(uri: Uri, _range: unknown, text: string): void { this.edits.push({ uri, text }); }
  },
  workspace: {
    onDidSaveTextDocument: (listener: Listener<FakeDocument>) => { listeners.save.push(listener); return disposable; },
    onDidChangeTextDocument: (listener: Listener<{ document: FakeDocument; contentChanges: unknown[] }>) => { listeners.change.push(listener); return disposable; },
    registerTextDocumentContentProvider: () => disposable,
    createFileSystemWatcher: () => {
      const watcher: { change?: () => void } = {};
      watchers.push(watcher);
      return {
        onDidChange: (listener: () => void) => { watcher.change = listener; return disposable; },
        onDidDelete: () => disposable,
        dispose() {},
      };
    },
    applyEdit: async (edit: { edits: Array<{ uri: Uri; text: string }> }) => {
      for (const change of edit.edits) {
        if (activeDocument && change.uri.toString() === activeDocument.uri.toString()) activeDocument.edit(change.text);
      }
      return true;
    },
    fs: {
      writeFile: async (uri: Uri, bytes: Uint8Array) => { fs.writeFileSync(uri.fsPath, Buffer.from(bytes)); },
    },
  },
  commands: {
    registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => { commands.set(id, handler); return disposable; },
    executeCommand: async (id: string, ...args: unknown[]) => {
      executed.push({ id, args });
      if (id === 'workbench.action.files.revert') activeDocument?.revert();
      return undefined;
    },
  },
  window: {
    showWarningMessage: async (text: string) => { warnings.push(text); return undefined; },
  },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? vscodeStub : load(request, ...rest));

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-stale-write-'));

interface Message { type: string; [key: string]: unknown }

async function main(): Promise<void> {
  const { DocumentSyncCoordinator } = await import('./DocumentSyncCoordinator');

  let fileCount = 0;
  async function open(name: string, content: string, options: { visible?: boolean } = {}) {
    const file = path.join(ROOT, `${++fileCount}-${name}`);
    fs.writeFileSync(file, content);
    const document = new FakeDocument(file);
    activeDocument = document;
    listeners.save.length = 0;
    listeners.change.length = 0;
    watchers.length = 0;
    warnings.length = 0;
    executed.length = 0;
    const messages: Message[] = [];
    const coordinator = new DocumentSyncCoordinator({ subscriptions: [] } as never, {
      buildPayload: (doc: FakeDocument) => ({
        fileType: 'markdown',
        filename: path.basename(doc.file),
        content: doc.getText(),
        properties: {},
        hasProperties: false,
        imageMappings: {},
        features: { voiceDictation: false, markdownExport: false },
      }),
      serializeEdit: (_doc: FakeDocument, payload: { content: string }) => payload.content,
    } as never);
    const webview = {
      postMessage: async (message: Message) => {
        messages.push(message);
        // The view applies every update and says so, as Ritemark's editor does.
        if (message.type === 'document:update') {
          setTimeout(() => coordinator.handle(document as never, webview as never, {
            type: 'document:applied', uri: message.uri, documentSessionId: message.documentSessionId,
            viewEpoch: message.viewEpoch, revision: message.revision, payloadHash: message.payloadHash,
          }), 0);
        }
        return true;
      },
    };
    const panel = { webview, visible: options.visible ?? true, viewColumn: 1, reveal() {}, onDidChangeViewState: () => disposable };
    const bootstrap = coordinator.prepareView(document as never, panel as never)!;
    const identity = { uri: bootstrap.uri, documentSessionId: bootstrap.documentSessionId, viewEpoch: 'view-1' };
    coordinator.handle(document as never, webview as never, { type: 'document:ready', ...identity });
    const record = () => (coordinator as unknown as { records: Map<string, { queue: Promise<void>; revision: number; conflict?: { reason?: string } }> }).records.get(bootstrap.uri);
    /** Until the record's queue has been idle twice in a row (its tasks hold their own timers). */
    async function settle(): Promise<void> {
      let idle = 0;
      for (let round = 0; round < 60 && idle < 2; round += 1) {
        const queue = record()?.queue;
        if (queue) await queue;
        await sleep(5);
        idle = record()?.queue === queue ? idle + 1 : 0;
      }
    }
    let clientSequence = 0;
    const env = {
      document,
      messages,
      coordinator,
      record,
      settle,
      /** The person types: the view sends its whole text, as Ritemark's editor does. */
      async type(next: string): Promise<void> {
        coordinator.handle(document as never, webview as never, {
          type: 'document:edit', ...identity, basedOnRevision: record()!.revision, clientSequence: ++clientSequence,
          payload: { fileType: 'markdown', content: next, properties: {} },
        });
        await settle();
      },
      async autoSave(): Promise<string> {
        const result = await document.save();
        await settle();
        return result;
      },
      /** The file changed; `order` says who sees it first. */
      async fileChanged(order: 'reload-first' | 'watcher-first'): Promise<void> {
        if (order === 'reload-first') {
          document.reload();
          await settle();
          watchers[0]?.change?.();
        } else {
          watchers[0]?.change?.();
          await settle();
          document.reload();
        }
        await settle();
      },
      conflicts: () => messages.filter(message => message.type === 'document:conflict'),
      async answer(action: 'keep-local' | 'use-disk' | 'compare'): Promise<void> {
        const last = env.conflicts().pop()!;
        coordinator.handle(document as never, webview as never, {
          type: 'document:conflict-action', ...identity, conflictRevision: last.conflictRevision, diskHash: last.diskHash, action,
        });
        await settle();
      },
      disk: () => fs.readFileSync(document.file, 'utf8'),
      dispose: () => coordinator.dispose(),
    };
    await settle();
    return env;
  }

  const md = (title: string) => `# ${title}\n\nThe second line.\n\nThe third line.\n`;
  const A = ' Alpha words typed first.';
  const B = ' Bravo words typed second.';
  const addToEnd = (text: string, words: string) => text.replace(/\n$/, `${words}\n`);

  /** S1's steps up to the stale write: type A, auto-save, the writer reads, type B, auto-save. */
  async function s1(name: string, content: string, writerEdit: (read: string) => string, order: 'reload-first' | 'watcher-first', options: { visible?: boolean } = {}) {
    const env = await open(name, content, options);
    await env.type(addToEnd(env.document.getText(), A));
    assert.equal(await env.autoSave(), 'saved');
    const read = env.disk();
    const withB = addToEnd(env.document.getText(), B);
    await env.type(withB);
    assert.equal(await env.autoSave(), 'saved');
    const updatesBefore = env.messages.filter(message => message.type === 'document:update').length;
    fs.writeFileSync(env.document.file, writerEdit(read));
    await env.fileChanged(order);
    return { env, read, withB, updatesBefore };
  }
  const editTitle = (read: string) => read.replace('# Stale', '# Stale, edited by the writer');

  let failures = 0;
  /** Every scenario runs with the save's receipt arriving before the sync's reconcile, and after it. */
  async function scenario(name: string, body: () => Promise<void>): Promise<void> {
    for (const order of ['receipt-first', 'reconcile-first'] as const) {
      saveOrder = order;
      try {
        await body();
        console.log(`ok - ${name} [save: ${order}]`);
      } catch (error) {
        failures += 1;
        console.log(`not ok - ${name} [save: ${order}]\n  ${(error as Error).message.split('\n').join('\n  ')}`);
      }
    }
    saveOrder = 'receipt-first';
  }

  for (const order of ['reload-first', 'watcher-first'] as const) {
    await scenario(`S1 (${order}): the writer's older copy is held, the person's words stay, Review changes asks`, async () => {
      const { env, updatesBefore } = await s1('s1.md', md('Stale write'), editTitle, order);
      const conflict = env.conflicts().pop();
      assert.ok(conflict, 'Review changes was sent to the view');
      assert.equal(conflict.reason, 'held-import');
      assert.ok(env.document.getText().includes(B.trim()), 'the document holds the second sentence');
      assert.ok(env.document.getText().includes(A.trim()), 'the document holds the first sentence');
      assert.ok(!env.document.getText().includes('edited by the writer'), 'the writer\'s copy is not in the document');
      const updates = env.messages.filter(message => message.type === 'document:update').slice(updatesBefore);
      assert.ok(updates.every(update => String((update.payload as { content: string }).content).includes(B.trim())), 'the view never received the writer\'s copy');
      assert.equal(env.record()!.conflict?.reason, 'held-import');
      assert.equal(warnings.length, 0, 'no notification while the view is visible');
      // VS Code saves the document a second later: after its own reload it writes the person's words back;
      // when Ritemark saw the file first, the save is refused as newer and the writer's copy stays (#454).
      const saved = await env.autoSave();
      assert.equal(saved, order === 'reload-first' ? 'saved' : 'refused');
      assert.equal(env.disk().includes(B.trim()), order === 'reload-first');
      assert.ok(env.record()!.conflict, 'the question still waits');
      env.dispose();
    });

    await scenario(`S1 (${order}): Keep my version puts both sentences on disk`, async () => {
      const { env } = await s1('s1-keep.md', md('Stale write'), editTitle, order);
      await env.autoSave();
      await env.answer('keep-local');
      assert.ok(env.disk().includes(A.trim()) && env.disk().includes(B.trim()), 'both sentences on disk');
      assert.equal(logical(env.disk()), logical(env.document.getText()));
      assert.equal(env.document.isDirty, false);
      assert.equal(env.record()!.conflict, undefined, 'the question is answered');
      env.dispose();
    });

    await scenario(`S1 (${order}): Use disk version puts the writer's copy on disk and in the editor`, async () => {
      const { env, read } = await s1('s1-disk.md', md('Stale write'), editTitle, order);
      await env.autoSave();
      await env.answer('use-disk');
      assert.equal(env.disk(), editTitle(read), 'the file is the writer\'s copy, byte for byte');
      assert.equal(logical(env.document.getText()), logical(editTitle(read)));
      assert.equal(env.document.isDirty, false);
      assert.equal(env.record()!.conflict, undefined, 'the question is answered');
      // The person chose the writer's copy: a later write without their sentence is not held again.
      fs.writeFileSync(env.document.file, editTitle(read).replace('second line', 'second line, again'));
      await env.fileChanged('reload-first');
      assert.equal(env.conflicts().filter(message => message.reason === 'held-import').length, 1);
      env.dispose();
    });
  }

  await scenario('S1: Compare shows the person\'s words and the writer\'s copy', async () => {
    const { env, read } = await s1('s1-compare.md', md('Stale write'), editTitle, 'reload-first');
    await env.answer('compare');
    const diff = executed.find(entry => entry.id === 'vscode.diff');
    assert.ok(diff, 'the diff opened');
    const virtual = (env.coordinator as unknown as { virtualDocuments: Map<string, string> }).virtualDocuments;
    const [local, disk] = [...virtual.values()];
    assert.ok(local.includes(B.trim()), 'my version has the second sentence');
    assert.equal(disk, editTitle(read), 'the disk version is the writer\'s copy');
    env.dispose();
  });

  await scenario('S1: with no view visible, one notification in the Experience lead\'s words', async () => {
    const { env } = await s1('Module 3.md', md('Stale write'), editTitle, 'reload-first', { visible: false });
    assert.equal(env.record()!.conflict?.reason, 'held-import');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^Something else saved ".*Module 3\.md" just after you did, without words you had just written\.$/);
    env.dispose();
  });

  await scenario('S1: a second stale write while the question waits is held too', async () => {
    const { env, read } = await s1('s1-twice.md', md('Stale write'), editTitle, 'reload-first');
    assert.equal(await env.autoSave(), 'saved');
    const second = read.replace('second line', 'second line, from another writer');
    fs.writeFileSync(env.document.file, second);
    await env.fileChanged('reload-first');
    assert.ok(env.document.getText().includes(B.trim()), 'the person\'s words are put back again');
    const last = env.conflicts().pop()!;
    assert.equal(last.reason, 'held-import');
    await env.answer('use-disk');
    assert.equal(env.disk(), second, 'Use disk version takes the newest writer\'s copy');
    env.dispose();
  });

  for (const order of ['reload-first', 'watcher-first'] as const) {
    await scenario(`S2 (${order}): a writer that read the latest save is imported silently`, async () => {
      const env = await open('s2.md', md('Stale write'));
      await env.type(addToEnd(env.document.getText(), A));
      await env.autoSave();
      fs.writeFileSync(env.document.file, editTitle(env.disk()));
      await env.fileChanged(order);
      assert.equal(env.conflicts().length, 0, 'no question');
      assert.ok(env.document.getText().includes('edited by the writer') && env.document.getText().includes(A.trim()));
      assert.equal(env.record()!.conflict, undefined);
      env.dispose();
    });
  }

  await scenario('S3: a writer that writes while the document is dirty gets the usual question (#454)', async () => {
    const env = await open('s3.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const read = env.disk();
    await env.type(addToEnd(env.document.getText(), B));
    fs.writeFileSync(env.document.file, editTitle(read));
    await env.fileChanged('reload-first');
    const conflict = env.conflicts().pop();
    assert.ok(conflict, 'Review changes');
    assert.equal(conflict.reason, undefined, 'the usual words');
    assert.ok(env.document.getText().includes(B.trim()));
    env.dispose();
  });

  await scenario('S4: a writer that rewrites the sentence just typed is asked about (decision 1)', async () => {
    const env = await open('s4.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    fs.writeFileSync(env.document.file, env.disk().replace(A.trim(), 'The writer\'s own words.'));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().pop()?.reason, 'held-import');
    assert.ok(env.document.getText().includes(A.trim()));
    env.dispose();
  });

  for (const [label, rewrite] of [
    ['CRLF endings', (text: string) => logical(text).replace(/\n/g, '\r\n')],
    ['a byte order mark', (text: string) => `﻿${logical(text)}`],
  ] as const) {
    await scenario(`S5: the same words with ${label} are not a question`, async () => {
      const env = await open('s5.md', md('Stale write'));
      await env.type(addToEnd(env.document.getText(), A));
      await env.autoSave();
      fs.writeFileSync(env.document.file, rewrite(env.disk()));
      await env.fileChanged('reload-first');
      assert.equal(env.conflicts().length, 0);
      assert.ok(env.document.getText().includes(A.trim()));
      env.dispose();
    });
  }

  await scenario('S6: a touched file is not a question', async () => {
    const env = await open('s6.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const later = new Date(Date.now() + 5_000);
    fs.utimesSync(env.document.file, later, later);
    await env.fileChanged('watcher-first');
    assert.equal(env.conflicts().length, 0);
    env.dispose();
  });

  const s7Files: Array<[string, string, (read: string) => string]> = [
    ['s7.csv', 'name,amount\nTea,3\nCoffee,4\n', (read: string) => read.replace('Coffee,4', 'Coffee,9')],
    ['s7-front-matter.md', `---\ntitle: Run\ntags: [check]\n---\n\n${md('Stale write')}`, editTitle],
    ['s7-crlf.md', md('Stale write').replace(/\n/g, '\r\n'), editTitle],
  ];
  for (const [name, content, writerEdit] of s7Files) {
    await scenario(`S7 ${name}: S1 is held, S2 is silent`, async () => {
      const csv = name.endsWith('.csv');
      const first = csv ? 'Cake,5' : A.trim();
      const second = csv ? 'Bread,6' : B.trim();
      const add = (text: string, words: string) => (csv ? `${logical(text)}${words}\n` : addToEnd(logical(text), ` ${words}`));
      {
        const env = await open(name, content);
        await env.type(add(env.document.getText(), first));
        await env.autoSave();
        const read = env.disk();
        await env.type(add(env.document.getText(), second));
        await env.autoSave();
        fs.writeFileSync(env.document.file, writerEdit(read));
        await env.fileChanged('reload-first');
        assert.equal(env.conflicts().pop()?.reason, 'held-import', 'S1 held');
        assert.ok(env.document.getText().includes(second), 'the second words stay');
        env.dispose();
      }
      {
        const env = await open(name, content);
        await env.type(add(env.document.getText(), first));
        await env.autoSave();
        fs.writeFileSync(env.document.file, writerEdit(env.disk()));
        await env.fileChanged('reload-first');
        assert.equal(env.conflicts().length, 0, 'S2 silent');
        env.dispose();
      }
    });
  }

  await scenario('Round 1: fixing a typo in the sentence just saved is not a question', async () => {
    const env = await open('own-typo.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), ' Alpha wrods typed first.'));
    await env.autoSave();
    await env.type(env.document.getText().replace('wrods', 'words'));
    await env.autoSave();
    assert.equal(env.conflicts().length, 0, 'no question');
    assert.ok(env.document.getText().includes('Alpha words typed first.'), 'the fix stays');
    assert.ok(env.disk().includes('Alpha words typed first.'));
    env.dispose();
  });

  await scenario('Round 1: undoing the sentence just saved is not a question', async () => {
    const env = await open('own-undo.md', md('Stale write'));
    const before = env.document.getText();
    await env.type(addToEnd(before, A));
    await env.autoSave();
    await env.type(before);
    await env.autoSave();
    assert.equal(env.conflicts().length, 0, 'no question');
    assert.ok(!env.document.getText().includes(A.trim()) && !env.disk().includes(A.trim()));
    env.dispose();
  });

  await scenario('Round 1: a save that changed two places, then a writer that read it and changed a third', async () => {
    const env = await open('two-places.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText().replace('# Stale write', '# Stale write X'), ' Y words here.'));
    await env.autoSave();
    fs.writeFileSync(env.document.file, env.disk().replace('The second line.', 'The second line, rewritten by the writer.'));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0, 'imported silently');
    assert.ok(env.document.getText().includes('rewritten by the writer'));
    env.dispose();
  });

  await scenario('Round 1: Use disk version on the usual question disarms the person\'s earlier saves', async () => {
    const env = await open('usual-use-disk.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const read = md('Stale write');
    await env.type(addToEnd(env.document.getText(), B));
    fs.writeFileSync(env.document.file, editTitle(read));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().pop()?.reason, undefined, 'the usual question');
    await env.answer('use-disk');
    assert.equal(env.record()!.conflict, undefined);
    fs.writeFileSync(env.document.file, editTitle(read).replace('second line', 'second line, again'));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().filter(message => message.reason === 'held-import').length, 0, 'not held');
    assert.ok(env.document.getText().includes('second line, again'));
    env.dispose();
  });

  await scenario('Round 1: a hold keeps what an earlier writer brought in after the save', async () => {
    const env = await open('earlier-import.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const stale = env.disk().replace(A.trim(), '');
    fs.writeFileSync(env.document.file, env.disk().replace('The second line.', 'The second line, from the first writer.'));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0, 'the first writer read the save: silent');
    fs.writeFileSync(env.document.file, stale);
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().pop()?.reason, 'held-import');
    const text = env.document.getText();
    assert.ok(text.includes(A.trim()) && text.includes('from the first writer'), 'both the person\'s words and the first writer\'s change');
    const lastUpdate = env.messages.filter(message => message.type === 'document:update').pop()!;
    assert.equal(logical(String((lastUpdate.payload as { content: string }).content)), logical(text), 'the views show what the document holds');
    env.dispose();
  });

  await scenario('Round 1: a writer that writes back an older save\'s text twice gets the words put back twice', async () => {
    const { env, read } = await s1('older-save.md', md('Stale write'), (text: string) => text, 'reload-first');
    assert.equal(env.record()!.conflict?.reason, 'held-import');
    assert.equal(await env.autoSave(), 'saved');
    fs.writeFileSync(env.document.file, read);
    await env.fileChanged('reload-first');
    assert.ok(env.document.getText().includes(B.trim()), 'the second sentence is back in the document');
    assert.equal(env.document.isDirty, true, 'and VS Code will save it');
    env.dispose();
  });

  await scenario('Round 1: a newer writer\'s copy behind a hidden tab gets its own notification', async () => {
    const { env, read } = await s1('Module 4.md', md('Stale write'), editTitle, 'reload-first', { visible: false });
    assert.equal(warnings.length, 1);
    assert.equal(await env.autoSave(), 'saved');
    fs.writeFileSync(env.document.file, read.replace('second line', 'second line, from another writer'));
    await env.fileChanged('reload-first');
    assert.equal(warnings.length, 2, 'a notification for the newer copy');
    env.dispose();
  });

  await scenario('Round 2: an edit made outside Ritemark\'s view and saved at once is not held', async () => {
    const env = await open('text-editor-edit.md', md('Stale write'));
    const before = env.document.getText();
    await env.type(addToEnd(before, A));
    await env.autoSave();
    // A text editor of the same file deletes the sentence and saves straight away.
    env.document.edit(before);
    await env.autoSave();
    assert.equal(env.conflicts().length, 0, 'no question');
    assert.ok(!env.document.getText().includes(A.trim()) && !env.disk().includes(A.trim()), 'the deletion stays');
    env.dispose();
  });

  await scenario('Round 2: many saves inside the window keep the first one\'s words guarded', async () => {
    const env = await open('many-saves.md', md('Stale write'));
    const read = env.disk();
    await env.type(addToEnd(env.document.getText(), ' Alpha words typed first and then trimmed a little more each time.'));
    await env.autoSave();
    for (const word of [' more each time', ' a little', ' then trimmed', ' and', ' first', ' typed']) {
      await env.type(env.document.getText().replace(word, ''));
      await env.autoSave();
    }
    fs.writeFileSync(env.document.file, editTitle(read));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().pop()?.reason, 'held-import');
    assert.ok(env.document.getText().includes('Alpha words'));
    env.dispose();
  });

  await scenario('Round 2: the views get the text put back as a new revision', async () => {
    const { env } = await s1('broadcast.md', md('Stale write'), editTitle, 'reload-first');
    const conflict = env.conflicts().pop()!;
    const update = env.messages.filter(message => message.type === 'document:update').pop()!;
    assert.ok(String((update.payload as { content: string }).content).includes(B.trim()));
    assert.equal(update.revision, conflict.revision, 'the update and the question share the new revision');
    env.dispose();
  });

  await scenario('Round 2: Use disk version writes back a writer\'s copy that is not UTF-8, byte for byte', async () => {
    const env = await open('latin1.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const writer = Buffer.concat([Buffer.from('# Stale write, edited by the writer caf', 'latin1'), Buffer.from([0xe9]), Buffer.from('\n\nThe second line.\n\nThe third line.\n', 'latin1')]);
    fs.writeFileSync(env.document.file, writer);
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().pop()?.reason, 'held-import');
    await env.autoSave();
    await env.answer('use-disk');
    assert.ok(fs.readFileSync(env.document.file).equals(writer), 'the file is the writer\'s bytes');
    env.dispose();
  });

  await scenario('S8: a stale write more than 30 s after the save still wins, as in 2.1', async () => {
    const realNow = Date.now;
    try {
      const env = await open('s8.md', md('Stale write'));
      await env.type(addToEnd(env.document.getText(), A));
      await env.autoSave();
      const read = env.disk();
      await env.type(addToEnd(env.document.getText(), B));
      await env.autoSave();
      Date.now = () => realNow() + 31_000;
      fs.writeFileSync(env.document.file, editTitle(read));
      await env.fileChanged('reload-first');
      assert.equal(env.conflicts().length, 0, 'no question');
      assert.ok(!env.document.getText().includes(B.trim()), 'the writer\'s copy is taken');
      env.dispose();
    } finally {
      Date.now = realNow;
    }
  });

  fs.rmSync(ROOT, { recursive: true, force: true });
  console.log(failures ? `\n${failures} scenario(s) failed` : '\nall scenarios passed');
  process.exit(failures ? 1 : 0);
}

void main();

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
 * Revised for R1 as revised on 1 November: a writer's copy with a base is merged by block (both changes stay), a
 * place both changed keeps the person's text and waits for Review changes, and the whole-document question is only
 * the fallback (no base). S1 runs with the shell's reload participant (patch 014) and without it, each in both
 * orders the Mac run saw: VS Code's reload before Ritemark looks, and Ritemark's watcher before the reload.
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
/** Ritemark's information notifications (a paragraph both changed, behind a hidden tab). */
const notes: string[] = [];
const watchers: Array<{ change?: () => void }> = [];
let activeDocument: FakeDocument | undefined;
let saveOrder: 'receipt-first' | 'reconcile-first' = 'receipt-first';
/** Patch 014's reload participant: VS Code asks Ritemark before it reloads a clean document its editor holds. */
let shellAsks = true;

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

  /**
   * VS Code's own reload of a clean document whose file changed. With the shell's participant, Ritemark is asked
   * first with the text read; a different answer is resolved dirty with the read's stat (patch 014).
   */
  async reload(): Promise<boolean> {
    if (this.isDirty) return false;
    const raw = fs.readFileSync(this.file, 'utf8');
    if (raw === this.resolved) return false;
    const answerReload = commands.get('_ritemark.editorSync.answerReload');
    if (shellAsks && answerReload) {
      const version = this.version;
      const diskText = raw.replace(/^\uFEFF/, '');
      const answer = await answerReload(this.uri, diskText);
      if (this.version !== version || this.isDirty) return false; // the document changed while Ritemark answered
      if (typeof answer === 'string' && answer !== diskText) {
        const changed = logical(answer) !== logical(this.text);
        this.resolved = raw;
        this.hasBom = raw.startsWith('\uFEFF');
        this.text = answer;
        this.version += 1;
        this.isDirty = true;
        for (const listener of listeners.change) listener({ document: this, contentChanges: changed ? [{}] : [] });
        return true;
      }
    }
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
    showInformationMessage: async (text: string) => { notes.push(text); return undefined; },
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
    notes.length = 0;
    executed.length = 0;
    const messages: Message[] = [];
    let holdAcks = false;
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
        if (message.type === 'document:update' && !holdAcks) {
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
      /**
       * The file changed; `order` says who sees it first. `together`: VS Code reads the file and asks Ritemark while
       * Ritemark's watcher is already merging it (the in-app S1 of 1 November): the question waits behind the merge.
       */
      async fileChanged(order: 'reload-first' | 'watcher-first' | 'together'): Promise<void> {
        if (order === 'reload-first') {
          await document.reload();
          await settle();
          watchers[0]?.change?.();
        } else if (order === 'together') {
          watchers[0]?.change?.();
          await document.reload();
        } else {
          watchers[0]?.change?.();
          await settle();
          await document.reload();
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
      /** The view is busy typing: it doesn't apply (or acknowledge) the host's updates, as Ritemark's editor doesn't. */
      holdAcks(value: boolean): void { holdAcks = value; },
      /** An edit the view sends based on an older revision (what it last showed). */
      async typeAt(revision: number, next: string): Promise<void> {
        coordinator.handle(document as never, webview as never, {
          type: 'document:edit', ...identity, basedOnRevision: revision, clientSequence: ++clientSequence,
          payload: { fileType: 'markdown', content: next, properties: {} },
        });
        await settle();
      },
      async paragraph(id: number, action: 'keep-mine' | 'use-theirs'): Promise<void> {
        coordinator.handle(document as never, webview as never, { type: 'document:paragraph-action', ...identity, id, action });
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
  async function s1(name: string, content: string, writerEdit: (read: string) => string, order: 'reload-first' | 'watcher-first' | 'together', options: { visible?: boolean } = {}) {
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

  const merged = (env: { document: FakeDocument }) => env.document.getText();
  const has = (text: string, ...parts: string[]) => parts.every(part => text.includes(part.trim()));
  const paragraphs = (env: { messages: Message[] }) => (env.messages.filter(message => message.type === 'document:paragraphs').pop()?.items ?? []) as Array<{ id: number; mine: string; theirs: string }>;
  /** A copy that shares no block with anything remembered: no base, so the fallback decides. */
  const rewriteAll = () => '# Something else entirely\n\nRewritten from scratch.\n\nNothing in common.\n';

  for (const shell of [true, false]) {
    for (const order of ['reload-first', 'watcher-first', 'together'] as const) {
      const how = `${shell ? 'the shell asks' : 'no shell answer'}, ${order}`;
      await scenario(`S1 (${how}): the stale copy is merged: the writer's line 1 and both sentences, no question`, async () => {
        shellAsks = shell;
        const { env, updatesBefore } = await s1('s1.md', md('Stale write'), editTitle, order);
        assert.equal(env.conflicts().length, 0, 'no question');
        assert.ok(has(merged(env), 'edited by the writer', A, B), 'the document holds both changes');
        assert.deepEqual(paragraphs(env), [], 'nothing both changed');
        const updates = env.messages.filter(message => message.type === 'document:update').slice(updatesBefore);
        assert.ok(updates.every(update => has(String((update.payload as { content: string }).content), B)), 'the view never received the writer\'s copy alone');
        assert.equal(updates.pop()?.reason, 'merge', 'the merge reaches the view as one undo step');
        await env.autoSave();
        assert.ok(has(env.disk(), 'edited by the writer', A, B), 'and the file, after the save');
        env.dispose();
      });
    }
  }
  shellAsks = true;

  await scenario('S2: a writer that read the latest save is taken as written', async () => {
    const env = await open('s2.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    fs.writeFileSync(env.document.file, editTitle(env.disk()));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0);
    assert.equal(merged(env), env.disk());
    assert.equal(env.document.isDirty, false, 'VS Code\'s own reload');
    env.dispose();
  });

  await scenario('S3: a writer that writes while the document has unsaved text is merged, and the merge is saved', async () => {
    const env = await open('s3.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const read = env.disk();
    await env.type(addToEnd(env.document.getText(), B));
    fs.writeFileSync(env.document.file, editTitle(read));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0, 'no question');
    assert.ok(has(merged(env), 'edited by the writer', A, B));
    assert.equal(await env.autoSave(), 'saved', 'the refused save goes through: the disk is the copy Ritemark merged');
    assert.ok(has(env.disk(), 'edited by the writer', A, B));
    env.dispose();
  });

  await scenario('Typing while the merge lands: the keystrokes go on top of the merge, nothing is rejected or lost', async () => {
    const env = await open('typing.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const read = env.disk();
    const withB = addToEnd(env.document.getText(), B);
    await env.type(withB);
    const before = env.record()!.revision;
    env.holdAcks(true);
    fs.writeFileSync(env.document.file, editTitle(read));
    await env.fileChanged('reload-first');
    await env.typeAt(before, addToEnd(withB, ' Charlie typed meanwhile.'));
    const results = env.messages.filter(message => message.type === 'document:edit-result');
    assert.equal(results.pop()?.status, 'accepted', 'not rejected');
    assert.ok(has(merged(env), 'edited by the writer', A, B, 'Charlie typed meanwhile.'), 'both changes and the keystrokes');
    env.holdAcks(false);
    env.dispose();
  });

  await scenario('S4: a writer rewrote the sentence just typed: Ritemark can\'t tell whether it saw it, so the person\'s stays and the writer\'s waits', async () => {
    const env = await open('s4.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    fs.writeFileSync(env.document.file, env.disk().replace(A.trim(), 'The writer\'s own words.'));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0, 'no whole-document question');
    assert.ok(merged(env).includes(A.trim()), 'the person\'s sentence stays');
    assert.equal(paragraphs(env).length, 1);
    assert.ok(paragraphs(env)[0].theirs.includes('The writer\'s own words.'), 'the writer\'s version waits for Review changes');
    env.dispose();
  });

  for (const [label, rewrite] of [
    ['CRLF endings', (text: string) => logical(text).replace(/\n/g, '\r\n')],
    ['a byte order mark', (text: string) => `﻿${logical(text)}`],
  ] as const) {
    await scenario(`S5: the same words with ${label} change nothing`, async () => {
      const env = await open('s5.md', md('Stale write'));
      await env.type(addToEnd(env.document.getText(), A));
      await env.autoSave();
      fs.writeFileSync(env.document.file, rewrite(env.disk()));
      await env.fileChanged('reload-first');
      assert.equal(env.conflicts().length, 0);
      assert.ok(merged(env).includes(A.trim()));
      env.dispose();
    });
  }

  await scenario('S6: a touched file changes nothing', async () => {
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
    await scenario(`S7 ${name}: S1 is merged, S2 is taken as written`, async () => {
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
        assert.equal(env.conflicts().length, 0, 'S1 no question');
        assert.ok(has(logical(merged(env)), first, second, csv ? 'Coffee,9' : 'edited by the writer'), 'S1 merged');
        env.dispose();
      }
      {
        const env = await open(name, content);
        await env.type(add(env.document.getText(), first));
        await env.autoSave();
        fs.writeFileSync(env.document.file, writerEdit(env.disk()));
        await env.fileChanged('reload-first');
        assert.equal(env.conflicts().length, 0, 'S2 no question');
        env.dispose();
      }
    });
  }

  await scenario('S56/S57: both changed one paragraph: the person\'s stays, Review changes waits; Use the writer\'s is one step', async () => {
    const { env } = await s1('s56.md', md('Stale write'), (read: string) => read
      .replace('The second line.', 'The second line, shorter.')
      .replace('The third line. Alpha words typed first.', 'The third line, tightened by the writer.'), 'reload-first');
    assert.equal(env.conflicts().length, 0, 'no whole-document question');
    assert.ok(has(merged(env), 'The second line, shorter.', A, B), 'the writer\'s other paragraph lands; the person\'s stays');
    const items = paragraphs(env);
    assert.equal(items.length, 1);
    assert.ok(items[0].mine.includes(B.trim()) && items[0].theirs === 'The third line, tightened by the writer.');
    await env.paragraph(items[0].id, 'use-theirs');
    assert.ok(merged(env).includes('The third line, tightened by the writer.') && !merged(env).includes(B.trim()));
    assert.equal(env.messages.filter(message => message.type === 'document:update').pop()?.reason, 'merge');
    assert.deepEqual(paragraphs(env), [], 'the button goes');
    env.dispose();
  });

  await scenario('S57: Keep mine closes the place; S60: typing the writer\'s version closes it too', async () => {
    const edit = (read: string) => read.replace('The third line. Alpha words typed first.', 'The third line, tightened by the writer.');
    {
      const { env } = await s1('s57.md', md('Stale write'), edit, 'reload-first');
      const [item] = paragraphs(env);
      await env.paragraph(item.id, 'keep-mine');
      assert.deepEqual(paragraphs(env), []);
      assert.ok(merged(env).includes(B.trim()));
      env.dispose();
    }
    {
      const { env } = await s1('s60.md', md('Stale write'), edit, 'reload-first');
      assert.equal(paragraphs(env).length, 1);
      await env.type(merged(env).replace(/The third line\. Alpha words typed first\. Bravo words typed second\./, 'The third line, tightened by the writer.'));
      assert.deepEqual(paragraphs(env), [], 'the two versions are the same');
      env.dispose();
    }
  });

  await scenario('S59: behind a hidden tab, one notification in experience 44\'s words', async () => {
    const { env } = await s1('Module 3.md', md('Stale write'), (read: string) => read.replace('The third line. Alpha words typed first.', 'The third line, by the writer.'), 'reload-first', { visible: false });
    assert.equal(notes.length, 1);
    assert.equal(warnings.length, 0, 'not a warning');
    assert.match(notes[0], /^Another app saved a copy of ".*Module 3\.md" that changes a paragraph you were writing in\. Yours is kept\.$/);
    env.dispose();
  });

  await scenario('S8: no base: the fallback question within 30 s; Keep my version, Use disk version (byte for byte) and Compare', async () => {
    for (const action of ['keep-local', 'use-disk', 'compare'] as const) {
      const { env } = await s1('s8.md', md('Stale write'), rewriteAll, 'reload-first');
      assert.equal(env.conflicts().pop()?.reason, 'held-import', 'the fallback question');
      assert.ok(has(merged(env), A, B), 'the person\'s words stay');
      await env.autoSave();
      await env.answer(action);
      if (action === 'keep-local') assert.ok(has(env.disk(), A, B) && env.record()!.conflict === undefined);
      if (action === 'use-disk') assert.ok(env.disk() === rewriteAll() && env.record()!.conflict === undefined);
      if (action === 'compare') assert.ok(executed.some(entry => entry.id === 'vscode.diff'));
      env.dispose();
    }
  });

  await scenario('S8: a copy that is exactly an earlier save (a Discard) asks within 30 s, and a second one keeps the words', async () => {
    const { env, read } = await s1('discard.md', md('Stale write'), (text: string) => text, 'reload-first');
    assert.equal(env.conflicts().pop()?.reason, 'held-import');
    assert.equal(await env.autoSave(), 'saved');
    fs.writeFileSync(env.document.file, read);
    await env.fileChanged('reload-first');
    assert.ok(merged(env).includes(B.trim()), 'the person\'s words are kept while the question waits');
    await env.answer('use-disk');
    assert.equal(env.disk(), read, 'Use disk version finishes the Discard');
    env.dispose();
  });

  await scenario('S8: after 30 s, a copy with no base still replaces the words, as in 2.1', async () => {
    const realNow = Date.now;
    try {
      const env = await open('s8-late.md', md('Stale write'));
      await env.type(addToEnd(env.document.getText(), A));
      await env.autoSave();
      Date.now = () => realNow() + 31_000;
      fs.writeFileSync(env.document.file, rewriteAll());
      await env.fileChanged('reload-first');
      assert.equal(env.conflicts().length, 0, 'no question');
      assert.equal(merged(env), rewriteAll());
      env.dispose();
    } finally {
      Date.now = realNow;
    }
  });

  await scenario('S63: a base older than the newest save is found; every sentence stays', async () => {
    const env = await open('s63.md', '# Title\n');
    let second = '';
    for (let n = 1; n <= 5; n += 1) {
      await env.type(`${logical(env.document.getText()).replace(/\n$/, '')}\n\nSentence ${n}.\n`);
      await env.autoSave();
      if (n === 2) second = env.disk();
    }
    fs.writeFileSync(env.document.file, second.replace('# Title', '# Title, edited'));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0);
    assert.ok(has(merged(env), '# Title, edited', 'Sentence 1.', 'Sentence 5.'));
    env.dispose();
  });

  await scenario('Own edits are never a writer: a typo fix, an undo, an edit outside Ritemark\'s view saved at once', async () => {
    const env = await open('own.md', md('Stale write'));
    const before = env.document.getText();
    await env.type(addToEnd(before, ' Alpha wrods typed first.'));
    await env.autoSave();
    await env.type(env.document.getText().replace('wrods', 'words'));
    await env.autoSave();
    await env.type(before);
    await env.autoSave();
    env.document.edit(addToEnd(before, ' From a text editor.'));
    await env.autoSave();
    assert.equal(env.conflicts().length, 0);
    assert.deepEqual(paragraphs(env), []);
    assert.ok(merged(env).includes('From a text editor.') && env.disk().includes('From a text editor.'));
    env.dispose();
  });

  await scenario('A merge keeps what an earlier writer brought in, and the person\'s words', async () => {
    const env = await open('earlier.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const stale = env.disk().replace(` ${A.trim()}`, '').replace('The third line.', 'The third line, from a stale writer.');
    fs.writeFileSync(env.document.file, env.disk().replace('The second line.', 'The second line, from the first writer.'));
    await env.fileChanged('reload-first');
    fs.writeFileSync(env.document.file, stale);
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0);
    assert.ok(has(merged(env), 'from the first writer', A), 'nothing either brought in is lost');
    env.dispose();
  });

  await scenario('Use disk version writes back a writer\'s copy that is not UTF-8, byte for byte (the fallback)', async () => {
    const env = await open('latin1.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const writer = Buffer.concat([Buffer.from('# Caf', 'latin1'), Buffer.from([0xe9]), Buffer.from('\n\nAll new.\n\nNothing shared.\n', 'latin1')]);
    fs.writeFileSync(env.document.file, writer);
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().pop()?.reason, 'held-import');
    await env.autoSave();
    await env.answer('use-disk');
    assert.ok(fs.readFileSync(env.document.file).equals(writer), 'the file is the writer\'s bytes');
    env.dispose();
  });

  // ── Review round 1 (#605) ───────────────────────────────────────────────

  await scenario('Round 1, finding 1: unsaved text and a copy with no base ask (#454), never replace the words', async () => {
    const env = await open('r1-unsaved.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    assert.ok(env.document.isDirty, 'typed, never saved');
    fs.writeFileSync(env.document.file, rewriteAll());
    await env.fileChanged('watcher-first');
    assert.ok(merged(env).includes(A.trim()), 'the typed words stay');
    assert.equal(env.conflicts().length, 1, '#454\'s question');
    env.dispose();
  });

  await scenario('Round 1, finding 2: a writer that rewrote the paragraph the person just added replaces it once', async () => {
    const env = await open('r1-added.md', md('Stale write'));
    await env.type(`${env.document.getText()}\nA brand new paragraph.\n`);
    await env.autoSave();
    fs.writeFileSync(env.document.file, env.disk().replace('A brand new paragraph.', 'A brand-new paragraph, tightened.'));
    await env.fileChanged('reload-first');
    assert.equal(env.conflicts().length, 0);
    assert.ok(merged(env).includes('A brand-new paragraph, tightened.'));
    assert.ok(!merged(env).includes('A brand new paragraph.'), 'no second copy');
    assert.deepEqual(paragraphs(env), []);
    env.dispose();
  });

  await scenario('Round 1, finding 4: a view\'s edit to a block the document changed meanwhile shows Review changes', async () => {
    const env = await open('r1-rebase.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const before = env.record()!.revision;
    const viewText = env.document.getText();
    env.holdAcks(true);
    fs.writeFileSync(env.document.file, env.disk().replace('The third line.', 'The third line, by the writer.'));
    await env.fileChanged('reload-first');
    await env.typeAt(before, viewText.replace('The third line.', 'The third line, by the person.'));
    env.holdAcks(false);
    assert.ok(merged(env).includes('by the person'), 'the view\'s block stays');
    const items = paragraphs(env);
    assert.equal(items.length, 1, 'and the other version waits for Review changes');
    assert.ok(items[0].theirs.includes('by the writer'));
    env.dispose();
  });

  await scenario('Round 1, findings 5 and 6: a place stays until it is answered; Use the other copy puts back a block the person removed', async () => {
    const env = await open('r1-places.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const read = env.disk();
    // The person removes the third paragraph; the writer, from the save it read, trims it.
    await env.type(env.document.getText().replace(/\n\nThe third line\. Alpha words typed first\./, ''));
    await env.autoSave();
    fs.writeFileSync(env.document.file, read.replace('The third line. Alpha words typed first.', 'The third'));
    await env.fileChanged('reload-first');
    let items = paragraphs(env);
    assert.equal(items.length, 1);
    assert.equal(items[0].mine, '');
    // Typing elsewhere doesn't settle it, though the writer's text is part of other words in the document.
    await env.type(env.document.getText().replace('The second line.', 'The second line. The third'));
    items = paragraphs(env);
    assert.equal(items.length, 1, 'still waiting');
    await env.paragraph(items[0].id, 'use-theirs');
    assert.match(merged(env), /The second line\. The third\n\nThe third\n/, `the writer's paragraph is back, after the second: ${JSON.stringify(merged(env))}`);
    assert.deepEqual(paragraphs(env), []);
    env.dispose();
  });

  await scenario('Round 1, finding 8: a writer that read the latest save and dropped the final newline is taken as written', async () => {
    const env = await open('r1-newline.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const copy = env.disk().replace('# Stale write', '# Stale write, edited').replace(/\n$/, '');
    fs.writeFileSync(env.document.file, copy);
    await env.fileChanged('watcher-first');
    assert.equal(env.document.getText(), copy, 'the writer\'s copy, as written: not a merge with the person\'s final newline');
    env.dispose();
  });

  await scenario('Round 1, finding 9: an edit from a text editor of the same file, saved at once, is never a writer', async () => {
    const env = await open('r1-texteditor.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    await env.type(addToEnd(env.document.getText(), B));
    // A text editor of the same file changes the same paragraph, and its save lands before the sync looks.
    env.document.edit(env.document.getText().replace('The third line.', 'The third line (from the text editor).'));
    await env.document.save();
    await env.settle();
    assert.ok(merged(env).includes('(from the text editor)'), 'the text editor\'s edit stays');
    assert.ok(merged(env).includes(B.trim()));
    assert.deepEqual(paragraphs(env), [], 'no Review changes for the person\'s own edit');
    assert.equal(env.conflicts().length, 0);
    env.dispose();
  });

  await scenario('Round 1, finding 11: the merge saved before the sync looks keeps its places both changed', async () => {
    const env = await open('r1-saved-merge.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const read = env.disk();
    await env.type(addToEnd(env.document.getText(), B));
    await env.autoSave();
    fs.writeFileSync(env.document.file, read.replace('The third line. Alpha words typed first.', 'The third line, tightened by the writer.'));
    await env.document.reload();
    // The auto-save writes the merge before the queued reconcile reads the disk.
    await env.document.save();
    await env.settle();
    watchers[0]?.change?.();
    await env.settle();
    const items = paragraphs(env);
    assert.equal(items.length, 1, 'the place both changed still waits');
    assert.ok(merged(env).includes(B.trim()));
    env.dispose();
  });

  // ── Review round 2 (#605) ───────────────────────────────────────────────

  await scenario('Round 2, finding 1: the auto-save refused before the sync looks: the merge is saved, no question', async () => {
    const env = await open('r2-refused.md', md('Stale write'));
    await env.type(addToEnd(env.document.getText(), A));
    await env.autoSave();
    const read = env.disk();
    await env.type(addToEnd(env.document.getText(), B));
    fs.writeFileSync(env.document.file, editTitle(read));
    // VS Code's auto-save runs first and is refused as newer: patch 014 asks Ritemark.
    assert.equal(await env.autoSave(), 'saved', 'Ritemark answers overwrite: the save goes through');
    assert.equal(env.conflicts().length, 0, 'no question, Ritemark\'s or VS Code\'s');
    assert.ok(has(env.disk(), 'edited by the writer', A, B), 'the file holds the merge');
    env.dispose();
  });

  await scenario('Round 2, finding 7: a CRLF document keeps its line endings when a writer saves an LF copy', async () => {
    const crlf = md('Stale write').replace(/\n/g, '\r\n');
    const { env } = await s1('r2-crlf.md', crlf, read => editTitle(read).replace(/\r\n/g, '\n'), 'reload-first');
    assert.ok(has(merged(env), 'edited by the writer', A, B));
    assert.ok(merged(env).includes('\r\n') && !/[^\r]\n/.test(merged(env)), 'CRLF throughout');
    env.dispose();
  });

  fs.rmSync(ROOT, { recursive: true, force: true });
  console.log(failures ? `\n${failures} scenario(s) failed` : '\nall scenarios passed');
  process.exit(failures ? 1 : 0);
}

void main();

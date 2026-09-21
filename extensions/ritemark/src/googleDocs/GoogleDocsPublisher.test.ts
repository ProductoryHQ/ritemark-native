import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import type { GoogleAccountService } from './GoogleAccountService';
import type { DocsDocument, DriveFileMeta } from './GoogleApiClient';
import type { GoogleDocsBindingStore } from './GoogleDocsBindingStore';
import { GoogleDocsPublisher, type PublishPrompts } from './GoogleDocsPublisher';
import { GOOGLE_DOC_MIME, GoogleDocsError, RITEMARK_APP_PROPERTY, type GoogleDocsBindingV1, type GoogleTemplateChoice } from './types';

// ── A small, honest fake of the parts of Drive and Docs the publisher uses ─────

interface FakeDoc { id: string; name: string; mimeType: string; trashed: boolean; revision: number; text: string; appProperties: Record<string, string> }

class FakeGoogle {
  docs = new Map<string, FakeDoc>();
  images = new Map<string, { shared: boolean }>();
  writes: { docId: string; requiredRevisionId?: string; requests: unknown[] }[] = [];
  seq = 0;
  failCreateAfterStoring = false;
  failCreateBeforeStoring = false;

  add(doc: Partial<FakeDoc> & { id: string }): FakeDoc {
    const full: FakeDoc = { name: doc.id, mimeType: GOOGLE_DOC_MIME, trashed: false, revision: 1, text: '', appProperties: {}, ...doc };
    this.docs.set(doc.id, full);
    return full;
  }
  editRemotely(id: string, text: string): void {
    const doc = this.docs.get(id)!;
    doc.text = `${text}${doc.text}`;
    doc.revision++;
  }
  private must(id: string): FakeDoc {
    const doc = this.docs.get(id);
    if (!doc) throw new GoogleDocsError('target-not-found', `404 ${id}`, { status: 404 });
    return doc;
  }

  readonly client = {
    getFile: async (id: string): Promise<DriveFileMeta> => {
      const d = this.must(id);
      return { id: d.id, name: d.name, mimeType: d.mimeType, trashed: d.trashed, appProperties: d.appProperties };
    },
    createDocument: async (name: string, operationId: string): Promise<DriveFileMeta> => {
      if (this.failCreateBeforeStoring) throw new GoogleDocsError('offline', 'network down');
      const doc = this.add({ id: `doc-${++this.seq}`, name, appProperties: { [RITEMARK_APP_PROPERTY]: operationId } });
      if (this.failCreateAfterStoring) throw new GoogleDocsError('offline', 'answer lost');
      return { id: doc.id, name, mimeType: GOOGLE_DOC_MIME, trashed: false };
    },
    copyDocument: async (sourceId: string, name: string, operationId: string): Promise<DriveFileMeta> => {
      const source = this.must(sourceId);
      const doc = this.add({ id: `doc-${++this.seq}`, name, text: source.text, appProperties: { [RITEMARK_APP_PROPERTY]: operationId } });
      return { id: doc.id, name, mimeType: GOOGLE_DOC_MIME, trashed: false };
    },
    findByOperation: async (operationId: string): Promise<DriveFileMeta | null> => {
      const found = [...this.docs.values()].find((d) => d.appProperties[RITEMARK_APP_PROPERTY] === operationId && !d.trashed);
      return found ? { id: found.id, name: found.name, mimeType: found.mimeType, trashed: false } : null;
    },
    getDocument: async (id: string): Promise<DocsDocument> => {
      const d = this.must(id);
      const content = `${d.text}\n`;
      return {
        documentId: d.id, revisionId: `rev-${d.revision}`, title: d.name,
        body: { content: [
          { endIndex: 1, sectionBreak: {} },
          { startIndex: 1, endIndex: 1 + content.length, paragraph: { elements: [{ startIndex: 1, endIndex: 1 + content.length, textRun: { content } }] } },
        ] },
      };
    },
    batchUpdate: async (docId: string, requests: unknown[], requiredRevisionId?: string) => {
      const d = this.must(docId);
      if (requiredRevisionId && requiredRevisionId !== `rev-${d.revision}`) {
        throw new GoogleDocsError('verification-required', 'required revision is stale', { status: 400 });
      }
      this.writes.push({ docId, requiredRevisionId, requests });
      for (const raw of requests as Record<string, any>[]) {
        if (raw.deleteContentRange) {
          const { startIndex, endIndex } = raw.deleteContentRange.range;
          d.text = d.text.slice(0, startIndex - 1) + d.text.slice(endIndex - 1);
        } else if (raw.insertText) {
          const at = raw.insertText.location.index - 1;
          d.text = d.text.slice(0, at) + raw.insertText.text + d.text.slice(at);
        } else if (raw.insertInlineImage) {
          const at = raw.insertInlineImage.location.index - 1;
          const id = new URL(raw.insertInlineImage.uri).searchParams.get('id');
          if (id && !this.images.get(id)?.shared) throw new GoogleDocsError('unexpected', 'image not fetchable');
          d.text = `${d.text.slice(0, at)}[img]${d.text.slice(at)}`;
        }
      }
      d.text = d.text.replace(/\n$/, '');
      d.revision++;
      return {};
    },
    uploadImage: async () => { const id = `img-${++this.seq}`; this.images.set(id, { shared: false }); return id; },
    shareByLink: async (id: string) => { this.images.get(id)!.shared = true; return `perm-${id}`; },
    unshare: async (id: string) => { const img = this.images.get(id); if (img) img.shared = false; },
    deleteFile: async (id: string) => { this.images.delete(id); this.docs.delete(id); },
  };
}

function fakeAccount(google: FakeGoogle, accountId = 'acct-1', template: GoogleTemplateChoice | null = null): GoogleAccountService {
  const identity = { accountId, email: `${accountId}@example.com`, displayName: accountId };
  return {
    client: google.client,
    identity: () => identity,
    snapshot: () => ({ status: 'connected', identity, template, choosingTemplate: false }),
  } as unknown as GoogleAccountService;
}

function memoryStore(options: { failPut?: boolean } = {}): GoogleDocsBindingStore & { data: Map<string, GoogleDocsBindingV1> } {
  const data = new Map<string, GoogleDocsBindingV1>();
  return {
    data,
    get: async (uri: string) => data.get(uri) ?? null,
    put: async (b: GoogleDocsBindingV1) => { if (options.failPut) throw new Error('disk full'); data.set(b.documentUri, b); },
    remove: async (uri: string) => data.delete(uri),
    rename: async () => 'none',
  } as unknown as GoogleDocsBindingStore & { data: Map<string, GoogleDocsBindingV1> };
}

const prompts = (answers: { first?: boolean; remote?: boolean; onRemote?: () => void } = {}) => {
  const calls: string[] = [];
  const p: PublishPrompts = {
    confirmFirstSync: async () => { calls.push('first'); return answers.first ?? true; },
    confirmRemoteChanged: async () => { calls.push('remote'); answers.onRemote?.(); return answers.remote ?? true; },
  };
  return { p, calls };
};

const DOC_URI = 'file:///notes/course.md';
const input = (html: string) => ({ documentUri: DOC_URI, documentPath: '/notes/course.md', html, title: 'Course' });
const stages: string[] = [];
const onStage = (s: string) => stages.push(s);

async function main(): Promise<void> {
  // ── Create binds only after Google confirms ─────────────────────────────────
  {
    const google = new FakeGoogle();
    const store = memoryStore();
    const publisher = new GoogleDocsPublisher({ account: fakeAccount(google), store, randomId: () => 'op-1' });
    const html = '<h1>Course</h1><p>Welcome &amp; hello.</p><p>Note<!-- {id:c1} private reviewer note --></p>';
    const out = await publisher.publish(input(html), prompts().p, onStage);
    assert.equal(out.kind, 'created');
    const doc = google.docs.get('doc-1')!;
    assert.ok(doc.text.includes('Welcome & hello.'), 'entities are published as characters');
    assert.ok(!doc.text.includes('private reviewer note'), 'Ritemark comments never reach Google (normalizer chokepoint)');
    assert.equal(doc.appProperties[RITEMARK_APP_PROPERTY], 'op-1', 'the create carries its recovery tag');
    const binding = store.data.get(DOC_URI)!;
    assert.equal(binding.fileId, 'doc-1');
    assert.equal(binding.lastRevisionId, `rev-${doc.revision}`, 'the recorded revision is the one after our own write');
    assert.equal(binding.overwriteAcknowledged, false);
    assert.ok(stages.includes('writing') && stages.includes('verifying'));
  }

  // ── Create from a template: the copy's body is replaced, the copy is bound ──
  {
    const google = new FakeGoogle();
    google.add({ id: 'tpl', name: 'Course handout', text: 'TEMPLATE BODY' });
    const store = memoryStore();
    const publisher = new GoogleDocsPublisher({ account: fakeAccount(google, 'acct-1', { fileId: 'tpl', name: 'Course handout', accountId: 'acct-1' }), store });
    const out = await publisher.publish(input('<p>Fresh text</p>'), prompts().p, onStage);
    assert.equal(out.kind, 'created');
    const created = store.data.get(DOC_URI)!;
    assert.equal(created.templateFileId, 'tpl');
    const doc = google.docs.get(created.fileId)!;
    assert.ok(!doc.text.includes('TEMPLATE BODY'), 'the template body is cleared');
    assert.ok(doc.text.includes('Fresh text'));
    assert.equal(google.docs.get('tpl')!.text, 'TEMPLATE BODY', 'the template itself is untouched');
  }
  {
    const google = new FakeGoogle();
    google.add({ id: 'tpl', trashed: true });
    const publisher = new GoogleDocsPublisher({ account: fakeAccount(google, 'acct-1', { fileId: 'tpl', name: 'x', accountId: 'acct-1' }), store: memoryStore() });
    await assert.rejects(publisher.publish(input('<p>x</p>'), prompts().p, onStage), (e: GoogleDocsError) => e.code === 'template-unavailable');
    assert.equal(google.docs.size, 1, 'nothing is created from an unavailable template');
  }

  // ── An indeterminate create is recovered by its tag, never duplicated ───────
  {
    const google = new FakeGoogle();
    google.failCreateAfterStoring = true;
    const store = memoryStore();
    const publisher = new GoogleDocsPublisher({ account: fakeAccount(google), store, randomId: () => 'op-lost' });
    const out = await publisher.publish(input('<p>Recovered</p>'), prompts().p, onStage);
    assert.equal(out.kind, 'created');
    assert.equal(google.docs.size, 1, 'exactly one Google Doc exists');
    assert.equal(store.data.get(DOC_URI)?.fileId, 'doc-1');
  }
  {
    const google = new FakeGoogle();
    google.failCreateBeforeStoring = true;
    const store = memoryStore();
    const publisher = new GoogleDocsPublisher({ account: fakeAccount(google), store });
    await assert.rejects(publisher.publish(input('<p>x</p>'), prompts().p, onStage), (e: GoogleDocsError) => e.code === 'offline');
    assert.equal(store.data.size, 0, 'no link without a Doc');
  }

  // ── A link that cannot be saved hands the Doc back instead of orphaning it ──
  {
    const google = new FakeGoogle();
    const publisher = new GoogleDocsPublisher({ account: fakeAccount(google), store: memoryStore({ failPut: true }) });
    await assert.rejects(publisher.publish(input('<p>x</p>'), prompts().p, onStage),
      (e: GoogleDocsError) => e.code === 'local-binding-failed' && e.details.docUrl === 'https://docs.google.com/document/d/doc-1/edit');
  }

  // ── Sync: first-time warning, then same-ID replacement ────────────────────
  const google = new FakeGoogle();
  const store = memoryStore();
  const publisher = new GoogleDocsPublisher({ account: fakeAccount(google), store });
  await publisher.publish(input('<p>Version one</p>'), prompts().p, onStage);
  const fileId = store.data.get(DOC_URI)!.fileId;

  {
    const declined = prompts({ first: false });
    const before = google.docs.get(fileId)!.revision;
    const out = await publisher.publish(input('<p>Version two</p>'), declined.p, onStage);
    assert.equal(out.kind, 'cancelled');
    assert.deepEqual(declined.calls, ['first'], 'the first Sync asks before overwriting');
    assert.equal(google.docs.get(fileId)!.revision, before, 'declining writes nothing');
  }
  {
    const accepted = prompts();
    const out = await publisher.publish(input('<p>Version two</p>'), accepted.p, onStage);
    assert.equal(out.kind, 'synced');
    assert.equal(google.docs.size, 1, 'Sync never creates a replacement');
    assert.ok(google.docs.get(fileId)!.text.includes('Version two'));
    assert.ok(!google.docs.get(fileId)!.text.includes('Version one'), 'the body is replaced, not appended');
    const b = store.data.get(DOC_URI)!;
    assert.equal(b.fileId, fileId, 'same file id');
    assert.equal(b.overwriteAcknowledged, true);
    const lastWrite = google.writes.filter((w) => w.docId === fileId && w.requiredRevisionId).pop()!;
    assert.ok(lastWrite.requiredRevisionId, 'the rewrite is guarded by requiredRevisionId');
  }
  {
    const quiet = prompts();
    const writes = google.writes.length;
    const out = await publisher.publish(input('<p>Version two</p>'), quiet.p, onStage);
    assert.equal(out.kind, 'up-to-date');
    assert.deepEqual(quiet.calls, [], 'no prompt when nothing changed');
    assert.equal(google.writes.length, writes, 'no write when nothing changed');
  }
  {
    const next = prompts();
    const out = await publisher.publish(input('<p>Version three</p>'), next.p, onStage);
    assert.equal(out.kind, 'synced');
    assert.deepEqual(next.calls, [], 'after the first Sync, an unchanged Doc is synced without asking again');
  }

  // ── Someone edited the Doc in Google Docs ──────────────────────────────────
  {
    google.editRemotely(fileId, 'COLLEAGUE EDIT ');
    const declined = prompts({ remote: false });
    const out = await publisher.publish(input('<p>Version four</p>'), declined.p, onStage);
    assert.equal(out.kind, 'cancelled');
    assert.deepEqual(declined.calls, ['remote'], 'a Google-side edit gets the stronger warning');
    assert.ok(google.docs.get(fileId)!.text.includes('COLLEAGUE EDIT'), 'declining keeps the colleague\'s edit');

    const accepted = prompts({ remote: true });
    const again = await publisher.publish(input('<p>Version four</p>'), accepted.p, onStage);
    assert.equal(again.kind, 'synced');
    assert.ok(!google.docs.get(fileId)!.text.includes('COLLEAGUE EDIT'));
  }
  {
    // An edit that lands while the user is looking at the dialog is not overwritten.
    google.editRemotely(fileId, 'FIRST EDIT ');
    const racing = prompts({ remote: true, onRemote: () => google.editRemotely(fileId, 'SECOND EDIT ') });
    await assert.rejects(publisher.publish(input('<p>Version five</p>'), racing.p, onStage),
      (e: GoogleDocsError) => e.code === 'verification-required');
    assert.ok(google.docs.get(fileId)!.text.includes('SECOND EDIT'), 'the newer edit survives');
  }

  // ── Trash, mismatch, busy, untitled ─────────────────────────────────────────
  {
    google.docs.get(fileId)!.trashed = true;
    const writes = google.writes.length;
    await assert.rejects(publisher.publish(input('<p>x</p>'), prompts().p, onStage), (e: GoogleDocsError) => e.code === 'target-trashed');
    assert.equal(google.writes.length, writes, 'Drive would accept a write into the trash; Ritemark does not send one');
    google.docs.get(fileId)!.trashed = false;
  }
  {
    const other = new GoogleDocsPublisher({ account: fakeAccount(google, 'acct-2'), store });
    await assert.rejects(other.publish(input('<p>x</p>'), prompts().p, onStage), (e: GoogleDocsError) => e.code === 'account-mismatch');
  }
  {
    google.docs.delete(fileId);
    await assert.rejects(publisher.publish(input('<p>x</p>'), prompts().p, onStage), (e: GoogleDocsError) => e.code === 'target-not-found');
    assert.equal(store.data.get(DOC_URI)?.fileId, fileId, 'a missing target never triggers an automatic re-create');
  }
  {
    const g = new FakeGoogle();
    const p = new GoogleDocsPublisher({ account: fakeAccount(g), store: memoryStore() });
    const first = p.publish(input('<p>a</p>'), prompts().p, onStage);
    await assert.rejects(p.publish(input('<p>b</p>'), prompts().p, onStage), (e: GoogleDocsError) => e.code === 'busy');
    await first;
    assert.equal(g.docs.size, 1, 'a double click creates one Doc');
    await assert.rejects(p.publish({ ...input('<p>a</p>'), documentUri: 'untitled:Untitled-1' }, prompts().p, onStage),
      (e: GoogleDocsError) => e.code === 'untitled-document');
  }

  // ── Images: staged, inserted, then unshared and deleted ─────────────────────
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-gdocs-'));
    const png = (() => {
      const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
      const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.alloc(14))), chunk('IEND', Buffer.alloc(0))]);
    })();
    fs.writeFileSync(path.join(dir, 'shot.png'), png);
    const g = new FakeGoogle();
    const p = new GoogleDocsPublisher({ account: fakeAccount(g), store: memoryStore() });
    const out = await p.publish({
      documentUri: 'file:///notes/with-images.md',
      documentPath: path.join(dir, 'with-images.md'),
      html: '<p>Before</p><p><img src="https://file+.vscode-resource.vscode-cdn.net/x/shot.png" title="./shot.png" alt="Shot"></p><p><img src="./missing.png" alt="Gone"></p><p>After</p>',
      title: 'With images',
    }, prompts().p, onStage);
    assert.equal(out.kind, 'created');
    const doc = [...g.docs.values()][0];
    assert.equal((doc.text.match(/\[img\]/g) ?? []).length, 1, 'the local image is in the document');
    assert.equal(g.images.size, 0, 'the temporary copy is deleted afterwards');
    assert.ok(out.kind === 'created' && out.skippedImages.length === 1 && /missing\.png/.test(out.skippedImages[0].source),
      'the missing image is named, not silently dropped');
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('googleDocs/GoogleDocsPublisher: all assertions passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

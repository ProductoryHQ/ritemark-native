import assert from 'node:assert/strict';
import type { GoogleAccountService } from './GoogleAccountService';
import type { GoogleDocsBindingStore } from './GoogleDocsBindingStore';
import { GoogleDocsController, type GoogleDocsDocumentContext, type GoogleDocsUi } from './GoogleDocsController';
import type { GoogleDocsPublisher, PublishInput, PublishOutcome, PublishPrompts } from './GoogleDocsPublisher';
import {
  GOOGLE_DOCS_ERROR_COPY,
  GoogleDocsError,
  type GoogleAccountIdentity,
  type GoogleDocsBindingV1,
  type GoogleDocsDocumentProjection,
  type GoogleDocsSettingsProjection,
  type PublishStage,
} from './types';

// ── Fakes ────────────────────────────────────────────────────────────────────

const ME: GoogleAccountIdentity = { accountId: 'acct-1', email: 'jarmo@productory.eu', displayName: 'Jarmo' };

class FakeAccount {
  status: 'disconnected' | 'connecting' | 'connected' | 'reauthorize' = 'connected';
  who: GoogleAccountIdentity | null = ME;
  template: { fileId: string; name: string } | null = null;
  choosingTemplate = false;
  calls: string[] = [];
  failNext: GoogleDocsError | null = null;
  private listeners: Array<() => void> = [];
  onDidChange(listener: () => void) { this.listeners.push(listener); return () => {}; }
  fire() { for (const l of this.listeners) l(); }
  async load() {}
  identity() { return this.who; }
  snapshot() { return { status: this.status, identity: this.who, template: this.template, choosingTemplate: this.choosingTemplate }; }
  private async act(name: string) {
    this.calls.push(name);
    const failure = this.failNext;
    this.failNext = null;
    if (failure) throw failure;
  }
  connect() { return this.act('connect'); }
  cancel() { this.calls.push('cancel'); }
  disconnect() { return this.act('disconnect'); }
  chooseTemplate() { return this.act('chooseTemplate'); }
  clearTemplate() { return this.act('clearTemplate'); }
}

class FakeStore {
  readonly map = new Map<string, GoogleDocsBindingV1>();
  async get(uri: string) { return this.map.get(uri) ?? null; }
  async put(b: GoogleDocsBindingV1) { this.map.set(b.documentUri, b); }
  async remove(uri: string) { return this.map.delete(uri); }
  async rename(from: string, to: string): Promise<'moved' | 'collision' | 'none'> {
    const b = this.map.get(from);
    if (!b) return 'none';
    if (this.map.has(to)) return 'collision';
    this.map.delete(from);
    this.map.set(to, { ...b, documentUri: to });
    return 'moved';
  }
}

type Script = (input: PublishInput, prompts: PublishPrompts, onStage: (s: PublishStage) => void) => Promise<PublishOutcome>;
class FakePublisher {
  busy = new Set<string>();
  inputs: PublishInput[] = [];
  script: Script = async () => ({ kind: 'cancelled' });
  isBusy(uri: string) { return this.busy.has(uri); }
  async publish(input: PublishInput, prompts: PublishPrompts, onStage: (s: PublishStage) => void) {
    this.inputs.push(input);
    return this.script(input, prompts, onStage);
  }
}

interface UiCall { kind: string; message: string; detail?: string; actions?: string[] }
class FakeUi implements GoogleDocsUi {
  calls: UiCall[] = [];
  answers: Array<string | undefined> = [];
  progressTitles: string[] = [];
  progressReports: string[] = [];
  opened: string[] = [];
  settingsOpened = 0;
  private next() { return this.answers.shift(); }
  async withProgress<T>(title: string, task: (report: (m: string) => void) => Promise<T>) {
    this.progressTitles.push(title);
    return task((m) => this.progressReports.push(m));
  }
  async confirm(message: string, detail: string, actions: string[]) { this.calls.push({ kind: 'confirm', message, detail, actions }); return this.next(); }
  async info(message: string, actions?: string[]) { this.calls.push({ kind: 'info', message, actions }); return this.next(); }
  async warn(message: string, actions?: string[]) { this.calls.push({ kind: 'warn', message, actions }); return this.next(); }
  async error(message: string, actions?: string[]) { this.calls.push({ kind: 'error', message, actions }); return this.next(); }
  async openExternal(url: string) { this.opened.push(url); return true; }
  openSettings() { this.settingsOpened++; }
}

const DOC: GoogleDocsDocumentContext = { uri: 'file:///notes/course.md', path: '/notes/course.md', baseName: 'course' };
const binding = (over: Partial<GoogleDocsBindingV1> = {}): GoogleDocsBindingV1 => ({
  schemaVersion: 1, documentUri: DOC.uri, accountId: ME.accountId, accountEmail: ME.email, fileId: 'doc-1',
  title: 'Course outline', templateFileId: null, createdAt: '2026-09-21T10:00:00.000Z',
  lastSyncedAt: '2026-09-21T10:00:00.000Z', lastRevisionId: 'rev-1', lastSourceHash: 'h', overwriteAcknowledged: true,
  ...over,
});
const DOC_URL = 'https://docs.google.com/document/d/doc-1/edit';

function setup(opts: { config?: boolean; enabled?: boolean } = {}) {
  const account = new FakeAccount();
  const store = new FakeStore();
  const publisher = new FakePublisher();
  const ui = new FakeUi();
  const posted: Array<{ uri: string; projection: GoogleDocsDocumentProjection }> = [];
  const settings: GoogleDocsSettingsProjection[] = [];
  let enabled = opts.enabled ?? true;
  const controller = new GoogleDocsController({
    config: opts.config === false ? null : { clientId: 'x.apps.googleusercontent.com', clientSecret: 's' },
    account: account as unknown as GoogleAccountService,
    store: store as unknown as GoogleDocsBindingStore,
    publisher: publisher as unknown as GoogleDocsPublisher,
    ui,
    isFeatureEnabled: () => enabled,
    postToDocument: (uri, projection) => posted.push({ uri, projection }),
    postSettings: (p) => settings.push(p),
    openDocuments: () => [DOC.uri, 'file:///other.md'],
  });
  return { controller, account, store, publisher, ui, posted, settings, setEnabled: (v: boolean) => { enabled = v; } };
}
const lastState = (posted: Array<{ projection: GoogleDocsDocumentProjection }>) => posted[posted.length - 1]?.projection.state;

async function main(): Promise<void> {
  // ── Document projections ──────────────────────────────────────────────────
  {
    const t = setup();
    assert.equal((await t.controller.documentProjection(DOC.uri)).state, 'unbound');
    assert.equal((await t.controller.documentProjection('untitled:Untitled-1')).state, 'hidden', 'only saved files can be published');
    t.setEnabled(false);
    assert.equal((await t.controller.documentProjection(DOC.uri)).state, 'hidden', 'the feature flag hides everything');
    t.setEnabled(true);

    t.account.who = null;
    assert.equal((await t.controller.documentProjection(DOC.uri)).state, 'not-connected');
    t.account.who = ME;

    await t.store.put(binding());
    const bound = await t.controller.documentProjection(DOC.uri);
    assert.equal(bound.state, 'bound');
    assert.equal(bound.docUrl, DOC_URL);
    assert.equal(bound.title, 'Course outline');
    assert.deepEqual(Object.keys(bound).sort(), ['boundAccountEmail', 'docUrl', 'lastSyncedAt', 'stage', 'state', 'title'],
      'no file id, account id, revision or token reaches a webview');

    t.account.who = { ...ME, accountId: 'acct-2', email: 'other@example.com' };
    const mismatch = await t.controller.documentProjection(DOC.uri);
    assert.equal(mismatch.state, 'account-mismatch');
    assert.equal(mismatch.boundAccountEmail, ME.email);
    t.account.who = ME;

    t.publisher.busy.add(DOC.uri);
    assert.equal((await t.controller.documentProjection(DOC.uri)).state, 'busy');

    assert.equal((await setup({ config: false }).controller.documentProjection(DOC.uri)).state, 'unavailable');
  }

  // ── Settings projection ───────────────────────────────────────────────────
  {
    const t = setup();
    t.account.template = { fileId: 'tpl-1', name: 'Productory template' };
    const p = t.controller.settingsProjection();
    assert.equal(p.state, 'connected');
    assert.equal(p.email, ME.email);
    assert.deepEqual(p.template, { name: 'Productory template' }, 'the template file id stays on the host');
    assert.deepEqual(Object.keys(p).sort(), ['choosingTemplate', 'displayName', 'email', 'enabled', 'message', 'state', 'template']);
    assert.equal(setup({ config: false }).controller.settingsProjection().state, 'unavailable');
  }

  // ── Editor messages are decoded strictly ─────────────────────────────────
  {
    const t = setup();
    assert.equal(await t.controller.handleEditorMessage(DOC, { type: 'google-docs/request-projection' }), true);
    assert.equal(t.posted.length, 1);
    assert.equal(t.posted[0].uri, DOC.uri);
    assert.equal(await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '', fileId: 'x' }), false);
    assert.equal(await t.controller.handleEditorMessage(DOC, { type: 'exportWord' }), false);
    assert.equal(t.publisher.inputs.length, 0);

    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/open-settings' });
    assert.equal(t.ui.settingsOpened, 1);
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/open' });
    assert.deepEqual(t.ui.opened, [], 'nothing to open without a link');
    await t.store.put(binding());
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/open' });
    assert.deepEqual(t.ui.opened, [DOC_URL]);
  }

  // ── Publish preconditions ─────────────────────────────────────────────────
  {
    const t = setup();
    t.account.who = null;
    t.ui.answers = ['Open Settings'];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '<p>x</p>' });
    assert.equal(t.ui.calls[0].kind, 'warn');
    assert.equal(t.ui.settingsOpened, 1);
    assert.equal(t.publisher.inputs.length, 0);
  }
  {
    const t = setup();
    t.account.status = 'reauthorize';
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '<p>x</p>' });
    assert.equal(t.ui.calls[0].message, GOOGLE_DOCS_ERROR_COPY['reauthorization-required']);
    assert.equal(t.publisher.inputs.length, 0);
  }
  {
    const t = setup({ config: false });
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '<p>x</p>' });
    assert.deepEqual(t.ui.calls.map((c) => c.message), [GOOGLE_DOCS_ERROR_COPY['configuration-unavailable']]);
  }
  {
    const t = setup();
    await t.controller.handleEditorMessage({ ...DOC, uri: 'untitled:Untitled-1' }, { type: 'google-docs/publish', html: '<p>x</p>' });
    assert.deepEqual(t.ui.calls.map((c) => c.message), [GOOGLE_DOCS_ERROR_COPY['untitled-document']]);
  }

  // ── Create: progress, busy projection, result notification ───────────────
  {
    const t = setup();
    const statesDuringRun: Array<string | undefined> = [];
    t.publisher.script = async (input, _prompts, onStage) => {
      onStage('preparing');
      onStage('writing');
      await new Promise((r) => setImmediate(r));
      statesDuringRun.push(lastState(t.posted));
      const b = binding({ title: input.title });
      await t.store.put(b);
      return { kind: 'created', binding: b, skippedImages: [] };
    };
    t.ui.answers = ['Open Google Doc'];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '<p>x</p>', title: null });
    assert.equal(t.publisher.inputs[0].title, 'course', 'a missing title falls back to the file name');
    assert.equal(t.publisher.inputs[0].documentPath, DOC.path);
    assert.deepEqual(t.ui.progressTitles, ['Creating Google Doc']);
    assert.deepEqual(t.ui.progressReports, ['Preparing document', 'Writing to Google Docs']);
    assert.deepEqual(statesDuringRun, ['busy'], 'the menu shows the run while it is in flight');
    assert.equal(lastState(t.posted), 'bound', 'and the finished link afterwards');
    const done = t.ui.calls[t.ui.calls.length - 1];
    assert.equal(done.kind, 'info');
    assert.match(done.message, /Google Doc created: "course"/);
    assert.deepEqual(t.ui.opened, [DOC_URL]);
  }

  // ── Sync with skipped images warns and names them ─────────────────────────
  {
    const t = setup();
    await t.store.put(binding());
    t.publisher.script = async () => ({
      kind: 'synced', binding: binding(),
      skippedImages: [{ source: '/notes/img/diagram.webp', reason: 'unsupported format' }],
    });
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '<p>x</p>', title: 'Course outline' });
    assert.deepEqual(t.ui.progressTitles, ['Syncing Google Doc']);
    const done = t.ui.calls[t.ui.calls.length - 1];
    assert.equal(done.kind, 'warn');
    assert.match(done.message, /One image was not published: diagram\.webp \(unsupported format\)/);
  }

  // ── The two overwrite prompts ─────────────────────────────────────────────
  {
    const t = setup();
    await t.store.put(binding({ overwriteAcknowledged: false }));
    let answers: boolean[] = [];
    t.publisher.script = async (_i, prompts) => {
      answers.push(await prompts.confirmFirstSync(binding()));
      answers.push(await prompts.confirmFirstSync(binding()));
      return { kind: 'cancelled' };
    };
    t.ui.answers = ['Sync', undefined];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.deepEqual(answers, [true, false], 'Cancel means no write');
    assert.match(t.ui.calls[0].detail ?? '', /Edits made directly in Google Docs will be overwritten/);
    assert.equal(t.ui.calls.length, 2, 'a cancelled run reports nothing further');

    answers = [];
    t.ui.calls = [];
    t.publisher.script = async (_i, prompts) => {
      answers.push(await prompts.confirmRemoteChanged(binding()));
      answers.push(await prompts.confirmRemoteChanged(binding()));
      return { kind: 'cancelled' };
    };
    t.ui.answers = ['Open Google Doc', 'Overwrite with Ritemark'];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.deepEqual(answers, [false, true], 'opening the Doc to look does not overwrite it');
    assert.deepEqual(t.ui.calls[0].actions, ['Overwrite with Ritemark', 'Open Google Doc']);
    assert.deepEqual(t.ui.opened, [DOC_URL]);
  }

  // ── Errors map to one message with the right way out ─────────────────────
  {
    const t = setup();
    await t.store.put(binding());
    t.publisher.script = async () => { throw new GoogleDocsError('target-trashed', 'trashed', { docUrl: DOC_URL }); };
    t.ui.answers = ['Remove publishing link', 'Remove link'];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.deepEqual(t.ui.calls[0].actions, ['Open Google Doc', 'Remove publishing link']);
    assert.equal(t.ui.calls[1].kind, 'confirm');
    assert.equal(await t.store.get(DOC.uri), null, 'the link is removed only after its own confirmation');
    assert.equal(lastState(t.posted), 'unbound');
  }
  {
    const t = setup();
    await t.store.put(binding());
    t.publisher.script = async () => { throw new GoogleDocsError('target-not-found', 'gone'); };
    t.ui.answers = ['Remove publishing link', undefined];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.deepEqual(t.ui.calls[0].actions, ['Remove publishing link']);
    assert.ok(await t.store.get(DOC.uri), 'declining the confirmation keeps the link');
  }
  {
    const t = setup();
    t.publisher.script = async () => { throw new GoogleDocsError('rate-limited', '429', { retryAfterSeconds: 30 }); };
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.match(t.ui.calls[0].message, /about 30 seconds/);
  }
  {
    const t = setup();
    t.publisher.script = async () => { throw new GoogleDocsError('reauthorization-required', 'invalid_grant'); };
    t.ui.answers = ['Open Settings'];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.equal(t.ui.settingsOpened, 1);
  }
  {
    const t = setup();
    t.publisher.script = async () => { throw new GoogleDocsError('cancelled', 'user closed'); };
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.equal(t.ui.calls.length, 0, 'a cancellation is not an error');
    assert.equal(lastState(t.posted), 'unbound', 'and the busy state clears');
  }
  {
    const t = setup();
    t.publisher.script = async () => { throw new TypeError('boom'); };
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/publish', html: '' });
    assert.equal(t.ui.calls[0].message, GOOGLE_DOCS_ERROR_COPY.unexpected, 'raw exception text never reaches the user');
  }

  // ── Unlink asks first ─────────────────────────────────────────────────────
  {
    const t = setup();
    await t.store.put(binding());
    t.ui.answers = [undefined];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/unlink' });
    assert.ok(await t.store.get(DOC.uri));
    assert.match(t.ui.calls[0].detail ?? '', /The Google Doc is not deleted/);
    t.ui.answers = ['Remove link'];
    await t.controller.handleEditorMessage(DOC, { type: 'google-docs/unlink' });
    assert.equal(await t.store.get(DOC.uri), null);
  }

  // ── Settings actions ──────────────────────────────────────────────────────
  {
    const t = setup();
    assert.equal(await t.controller.handleSettingsMessage({ type: 'google-docs/connect' }), true);
    assert.deepEqual(t.account.calls, ['connect']);
    assert.equal(t.settings.length, 1);

    t.account.failNext = new GoogleDocsError('offline', 'ENOTFOUND');
    await t.controller.handleSettingsMessage({ type: 'google-docs/connect' });
    assert.equal(t.settings[t.settings.length - 1].message, GOOGLE_DOCS_ERROR_COPY.offline);

    await t.controller.handleSettingsMessage({ type: 'google-docs/cancel' });
    assert.equal(t.settings[t.settings.length - 1].message, null, 'the next action clears an old message');

    t.account.failNext = new GoogleDocsError('account-mismatch', 'other account');
    await t.controller.handleSettingsMessage({ type: 'google-docs/choose-template' });
    assert.match(t.settings[t.settings.length - 1].message ?? '', /different Google account/);

    t.account.failNext = new GoogleDocsError('cancelled', 'closed picker');
    await t.controller.handleSettingsMessage({ type: 'google-docs/choose-template' });
    assert.equal(t.settings[t.settings.length - 1].message, null);

    await t.controller.handleSettingsMessage({ type: 'google-docs/clear-template' });
    await t.controller.handleSettingsMessage({ type: 'google-docs/disconnect' });
    assert.deepEqual(t.account.calls.slice(-2), ['clearTemplate', 'disconnect']);
    assert.equal(await t.controller.handleSettingsMessage({ type: 'google-docs/publish', html: '' }), false);
  }
  {
    const t = setup({ config: false });
    await t.controller.handleSettingsMessage({ type: 'google-docs/connect' });
    assert.deepEqual(t.account.calls, [], 'an unconfigured build never starts OAuth');
    assert.equal(t.settings[0].state, 'unavailable');
  }

  // ── Account changes refresh every open editor ─────────────────────────────
  {
    const t = setup();
    t.account.fire();
    await new Promise((r) => setImmediate(r));
    assert.equal(t.settings.length, 1);
    assert.deepEqual(t.posted.map((p) => p.uri).sort(), ['file:///notes/course.md', 'file:///other.md']);
  }

  // ── Renames ───────────────────────────────────────────────────────────────
  {
    const t = setup();
    await t.store.put(binding());
    await t.controller.documentRenamed(DOC.uri, 'file:///notes/renamed.md');
    assert.equal((await t.store.get('file:///notes/renamed.md'))?.fileId, 'doc-1');
    assert.equal(t.posted[t.posted.length - 1].uri, 'file:///notes/renamed.md');

    await t.store.put(binding({ documentUri: 'file:///a.md', fileId: 'doc-a' }));
    await t.store.put(binding({ documentUri: 'file:///b.md', fileId: 'doc-b' }));
    await t.controller.documentRenamed('file:///a.md', 'file:///b.md');
    assert.equal(t.ui.calls[0].kind, 'warn');
    assert.equal((await t.store.get('file:///b.md'))?.fileId, 'doc-b');

    const before = t.posted.length;
    await t.controller.documentRenamed('file:///nobody.md', 'file:///x.md');
    assert.equal(t.posted.length, before, 'an unlinked rename pushes nothing');
  }

  console.log('googleDocs/GoogleDocsController: all assertions passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

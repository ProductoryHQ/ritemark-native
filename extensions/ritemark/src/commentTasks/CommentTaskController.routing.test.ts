/**
 * Sprint 155: a comment's task goes to its document's chat, through the real
 * controller and store — preview and send agree, two comments in a row and a
 * batch make one chat, retry keeps its chat, the toast, the no-room case and a
 * new chat's name.
 *
 * Run: npx tsx src/commentTasks/CommentTaskController.routing.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CommentTaskController,
  type CommentTaskControllerDependencies,
  type CommentTaskDestination,
  type CommentTaskDocument,
} from './CommentTaskController';
import { CommentTaskStore, commentTaskStoreDir } from './CommentTaskStore';
import { resolveProjectScope } from '../conversations/projectScope';
import type { CommentTaskEnqueueMessage, CommentTaskEnqueueOutcome, CommentTaskResultMessage } from './protocol';
import type { DestinationChatFacts } from './commentTaskDestination';

const scope = resolveProjectScope({ folderUris: ['file:///p'], platform: 'darwin' });
const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';
const C3 = '33333333-3333-4333-8333-333333333333';
const DOC_URI = 'file:///p/docs/Module 2.md';
const DOC = '/p/docs/Module 2.md';
const OTHER = '/p/docs/Advokatuur.md';

function doc(): CommentTaskDocument {
  return {
    uri: DOC_URI,
    scopeId: scope.scopeId,
    scope: scope.descriptor,
    displayPath: 'docs/Module 2.md',
    version: 3,
    text: [C1, C2, C3].map((id) => `<mark data-comment-id="${id}">x</mark>`).join('\n'),
  };
}

function accept(requestId: string, comments: Array<[string, string]>, alias = 'claude'): Record<string, unknown> {
  return {
    type: 'comment-task/accept',
    requestId,
    batchId: null,
    surface: 'rail',
    alias,
    documentVersion: 3,
    comments: comments.map(([commentId, instruction]) => ({ commentId, kind: 'mark', note: `@${alias} ${instruction}`, instruction })),
  };
}

interface World {
  chats: DestinationChatFacts[];
  records: Map<string, CommentTaskDestination>;
  open: CommentTaskDestination | null;
  existing: Set<string>;
  canAttach: boolean;
  enqueueAnswers: CommentTaskEnqueueOutcome[];
  /** The sheet gave no verdict (timeout, not ready): the host says so. */
  unreachable?: boolean;
}

function harness(world: Partial<World> = {}, overrides: Partial<CommentTaskControllerDependencies> = {}) {
  const w: World = {
    chats: [],
    records: new Map(),
    open: { conversationId: 'conv-open', bindingGeneration: 1, title: 'Shorten the Bar proposal', created: false, runtimeId: 'claude-code' },
    existing: new Set([DOC, OTHER]),
    canAttach: true,
    enqueueAnswers: [],
    ...world,
  };
  const enqueued: CommentTaskEnqueueMessage[] = [];
  const toasts: string[] = [];
  const titled: Array<[string, string]> = [];
  const attachAsked: Array<string | null> = [];
  let counter = 0;
  let clock = Date.parse('2026-11-07T12:00:00.000Z');
  /** Move the clock on, so a later comment is accepted later. */
  const tick = (ms = 1000) => { clock += ms; };
  const store = new CommentTaskStore(commentTaskStoreDir(fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-route-'))), {
    now: () => new Date(clock),
  });
  const dependencies: CommentTaskControllerDependencies = {
    store,
    isFeatureEnabled: () => true,
    areDurableConversationsEnabled: async () => true,
    resolveOpenConversation: async () => w.open,
    openConversationId: () => w.open?.conversationId ?? null,
    routingFacts: async () => ({
      documentPath: DOC,
      chats: w.chats,
      pathOfUri: (uri) => decodeURIComponent(uri.replace(/^file:\/\//, '')),
      exists: (file) => w.existing.has(file),
    }),
    conversationDestination: async (conversationId) => w.records.get(conversationId) ?? null,
    canAttach: async (conversationId) => { attachAsked.push(conversationId); return w.canAttach; },
    notifySent: (text) => { toasts.push(text); },
    setConversationTitle: async (conversationId, title) => { titled.push([conversationId, title]); },
    checkAvailability: async () => ({ usable: true }),
    runtimeSettings: () => ({ modelId: 'model-x', approvalMode: 'auto', thinkingEffort: 'auto' }),
    buildPrompt: (_document, comments) => `${comments.length} comment(s)`,
    enqueue: async (message) => {
      enqueued.push(message);
      const outcome = w.enqueueAnswers.shift() ?? 'queued';
      return {
        outcome,
        ...(outcome === 'queued' ? { conversationId: message.conversationId } : {}),
        ...(outcome === 'no-conversation' && w.unreachable ? { unreachable: true as const } : {}),
      };
    },
    revealConversation: async () => undefined,
    publishProjection: () => undefined,
    now: () => new Date(clock),
    randomId: () => `00000000-0000-4000-8000-${(counter += 1).toString().padStart(12, '0')}`,
    ...overrides,
  };
  return { controller: new CommentTaskController(dependencies), store, world: w, enqueued, toasts, titled, attachAsked, tick };
}

type Ok = Extract<CommentTaskResultMessage, { ok: true }>;
function ok(result: CommentTaskResultMessage, label: string): Ok {
  assert.ok(result.ok, `${label}: expected success, got ${result.ok ? '' : `${result.error.code} ${result.error.message}`}`);
  return result as Ok;
}
function destinationOf(result: CommentTaskResultMessage): { conversationId: string; title: string; created: boolean } {
  return (ok(result, 'accept').data as { destination: { conversationId: string; title: string; created: boolean } }).destination;
}
async function preview(h: ReturnType<typeof harness>) {
  return ok(await h.controller.handleRequest({ type: 'comment-task/destination-preview', requestId: `p-${Math.random()}` }, doc()), 'preview')
    .data as { conversationId: string | null; title: string | null; runtimeId: string | null };
}

const DRAFT: CommentTaskDestination = { conversationId: 'conv-draft', bindingGeneration: 2, title: 'Draft Module 2 and 3', created: false, runtimeId: 'claude-code' };

const failures: string[] = [];
/** Each check runs on its own, so one failure does not hide the others. */
async function check(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  // ── Rule 1: the chat that changed the document, while another chat is open ──
  {
    const h = harness({
      chats: [
        { conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] },
        { conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] },
      ],
      records: new Map([['conv-draft', DRAFT]]),
    });
    const p = await preview(h);
    assert.equal(p.conversationId, 'conv-draft', 'the caption names the document’s chat');
    assert.equal(p.title, 'Draft Module 2 and 3');
    const dest = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
    assert.equal(dest.conversationId, p.conversationId, 'preview and send pick the same chat');
    assert.equal(h.enqueued[0].conversationId, 'conv-draft');
    assert.equal(h.enqueued[0].newConversation, undefined);
    assert.deepEqual(h.toasts, ['Sent to “Draft Module 2 and 3”'], 'the toast, because it is not the open chat');
    assert.deepEqual(h.attachAsked, ['conv-draft'], 'room is checked for a chat that isn’t open');
    console.log('✓ rule 1: the document’s chat, preview = send, toast');
  }

  // ── Rule 2: the open chat that changed nothing — the old path, no toast ──
  {
    const h = harness({ chats: [{ conversationId: 'conv-open' }] });
    const p = await preview(h);
    const dest = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
    assert.equal(p.conversationId, 'conv-open');
    assert.equal(dest.conversationId, 'conv-open', 'an old chat with no record routes as today');
    assert.deepEqual(h.toasts, [], 'no toast for the open chat');
    assert.deepEqual(h.attachAsked, [], 'the open chat is not checked for room');
    console.log('✓ rule 2: the open chat (an old chat, no record)');
  }

  // ── A gone file: the open chat's only change was deleted ──
  {
    const h = harness({ chats: [{ conversationId: 'conv-open', changedFiles: [{ path: '/p/docs/Deleted.md', changedAt: '2026-11-07T09:00:00Z' }] }] });
    const dest = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
    assert.equal(dest.conversationId, 'conv-open', 'a deleted file is not another document');
    console.log('✓ a gone file does not count');
  }

  // ── Rule 3, then a second comment in a row joins the new chat ──
  {
    const h = harness({ chats: [{ conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }] });
    const p = await preview(h);
    assert.equal(p.conversationId, null, 'the caption says “→ New conversation”');
    assert.equal(p.title, null);
    const first = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, '@claude shorter please']]), doc()));
    assert.equal(first.created, true);
    assert.equal(first.title, 'Shorter please', 'named from the comment, without @claude');
    assert.ok(first.conversationId, 'the host chose the new chat’s id');
    assert.deepEqual(h.enqueued[0].newConversation, { title: 'Shorter please', conversationId: first.conversationId });
    assert.deepEqual(h.attachAsked, [null], 'room is checked for a new chat');

    // The second comment's caption and send both name the first one's chat.
    const p2 = await preview(h);
    assert.equal(p2.conversationId, first.conversationId, 'a waiting task counts as its chat’s change');
    const second = destinationOf(await h.controller.handleRequest(accept('r2', [[C2, 'And add a table']]), doc()));
    assert.equal(second.conversationId, first.conversationId, 'two comments in a row make one chat');
    assert.equal(second.created, false);
    assert.equal(h.enqueued[1].newConversation, undefined, 'the second one does not make another chat');
    assert.deepEqual(h.toasts, ['Sent to a new chat, “Shorter please”', 'Sent to “Shorter please”']);

    // The new chat gets the comment's name when its first turn starts.
    await h.controller.applyTurnStarted(first.conversationId, h.enqueued[0].conversationTurnId);
    assert.deepEqual(h.titled, [[first.conversationId, 'Shorter please']]);
    await h.controller.applyTurnStarted(first.conversationId, h.enqueued[1].conversationTurnId);
    assert.equal(h.titled.length, 1, 'only the chat’s own first task names it');
    console.log('✓ rule 3: a new chat named from the comment; a second comment joins it');
  }

  // ── A batch: one request with several comments makes one chat ──
  {
    const h = harness({ chats: [{ conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }] });
    const dest = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please'], [C2, 'Add a table'], [C3, 'Fix the title']]), doc()));
    assert.equal(h.enqueued.length, 1, 'one task, one queue item');
    assert.equal(dest.title, 'Shorter please Add a table Fix', 'named from the comments’ words, six at most');
    // A batch sent as separate requests joins too.
    const h2 = harness({ chats: [{ conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }] });
    const ids = [];
    for (const [index, id] of [C1, C2, C3].entries()) {
      ids.push(destinationOf(await h2.controller.handleRequest(accept(`b${index}`, [[id, `Comment ${index}`]]), doc())).conversationId);
    }
    assert.equal(new Set(ids).size, 1, 'a batch makes one chat');
    assert.equal(h2.enqueued.filter((m) => m.newConversation).length, 1);
    console.log('✓ a batch makes one chat');
  }

  // ── Another AI: still the document's chat, and the caption can say so ──
  {
    const h = harness({
      chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
      records: new Map([['conv-draft', DRAFT]]),
    });
    const p = await preview(h);
    assert.equal(p.runtimeId, 'claude-code', 'the caption knows the chat’s AI (→ … · Codex takes over)');
    const dest = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']], 'codex'), doc()));
    assert.equal(dest.conversationId, 'conv-draft');
    assert.equal(h.enqueued[0].runtimeId, 'codex');
    console.log('✓ a comment for another AI lands in the document’s chat');
  }

  await check("No room for one more working chat: it waits, as a card's task does, and starts when there is room", async () => {
    const h = harness({
      chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
      records: new Map([['conv-draft', DRAFT]]),
      canAttach: false,
    });
    const result = await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc());
    assert.ok(result.ok, `accepted, not refused (got ${result.ok ? '' : result.error.code})`);
    assert.equal(h.enqueued.length, 0, 'nothing handed to the sidebar yet');
    const [waiting] = await h.store.listForDocument(DOC_URI);
    assert.equal(waiting?.lifecycle.state, 'accepting');
    assert.equal((waiting?.lifecycle as { waitFor?: string } | undefined)?.waitFor, 'capacity', 'it waits for room, with the card’s words');
    assert.deepEqual(h.toasts, [], 'no “Sent to” until it is handed over');
    // Another chat's turn ends: now there is room.
    h.world.canAttach = true;
    await h.controller.applyTurnTerminal('conv-other', '99999999-9999-4999-8999-999999999999', { status: 'completed', text: 'Done' });
    assert.equal(h.enqueued.length, 1, 'it starts when there is room');
    assert.equal(h.enqueued[0].conversationId, 'conv-draft');
    const [started] = await h.store.listForDocument(DOC_URI);
    assert.equal(started?.lifecycle.state, 'queued');
    assert.equal((started?.lifecycle as { waitFor?: string }).waitFor, undefined);
    assert.deepEqual(h.toasts, ['Sent to “Draft Module 2 and 3”']);
    });

  await check('Finding 1: the permanent id is minted between the second and the third comment', async () => {
    const h = harness({ chats: [{ conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }] });
    const a = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
    h.tick();
    const b = destinationOf(await h.controller.handleRequest(accept('r2', [[C2, 'Add a table']]), doc()));
    assert.equal(b.conversationId, a.conversationId, 'B joins A’s new chat');
    // A's turn starts: the store mints the permanent id and the sidebar is told.
    const permanent = 'conv-permanent';
    await (h.controller as unknown as { applyConversationCanonicalId?(from: string, to: string): Promise<void> })
      .applyConversationCanonicalId?.(a.conversationId, permanent);
    await h.controller.applyTurnStarted(permanent, h.enqueued[0].conversationTurnId);
    h.world.records.set(permanent, { conversationId: permanent, bindingGeneration: 1, title: 'Shorter please', created: false, runtimeId: 'claude-code' });
    h.tick();
    const c = destinationOf(await h.controller.handleRequest(accept('r3', [[C3, 'Fix the title']]), doc()));
    assert.equal(c.conversationId, permanent, 'the third comment goes to the permanent id');
    assert.equal(h.enqueued[2].conversationId, permanent);
    const ids = new Set((await h.store.listForDocument(DOC_URI)).map((task) => task.destination.conversationId));
    assert.deepEqual([...ids], [permanent], 'all three tasks name one chat');
    });

  await check('Finding 2: two comments sent at once make one chat', async () => {
    const h = harness({ chats: [{ conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }] });
    const [first, second] = await Promise.all([
      h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()),
      h.controller.handleRequest(accept('r2', [[C2, 'Add a table']]), doc()),
    ]);
    assert.equal(destinationOf(first).conversationId, destinationOf(second).conversationId, 'one chat');
    assert.equal(h.enqueued.filter((m) => m.newConversation).length, 1, 'only one new chat is made');
    });

  await check("Finding 8: another project's pending task is ignored", async () => {
    const other = resolveProjectScope({ folderUris: ['file:///q'], platform: 'darwin' });
    const h = harness({ chats: [{ conversationId: 'conv-open' }] });
    // A task in another project, for a file at the same path, waiting in that project's chat.
    h.world.open = { conversationId: 'conv-elsewhere', bindingGeneration: 1, title: 'Elsewhere', created: false, runtimeId: 'claude-code' };
    destinationOf(await h.controller.handleRequest(accept('x1', [[C1, 'Elsewhere']]), { ...doc(), scopeId: other.scopeId, scope: other.descriptor }));
    h.world.open = { conversationId: 'conv-open', bindingGeneration: 1, title: 'Shorten the Bar proposal', created: false, runtimeId: 'claude-code' };
    const dest = destinationOf(await h.controller.handleRequest(accept('r1', [[C2, 'Shorter please']]), doc()));
    assert.equal(dest.conversationId, 'conv-open', 'the other project’s task is not this document’s chat');
    });

  // ── Retry keeps the card's chat, even when the rules would now pick another ──
  {
    const h = harness({
      chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
      records: new Map([['conv-draft', DRAFT]]),
    });
    const first = destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
    const taskId = (await h.store.listForDocument(DOC_URI))[0].taskId;
    await h.controller.applyTurnStarted('conv-draft', h.enqueued[0].conversationTurnId);
    await h.controller.applyTurnTerminal('conv-draft', h.enqueued[0].conversationTurnId, { status: 'failed', error: 'Network' });
    // Another chat changed the document since.
    h.world.chats.push({ conversationId: 'conv-later', changedFiles: [{ path: DOC, changedAt: '2026-11-07T11:00:00Z' }] });
    h.world.records.set('conv-later', { conversationId: 'conv-later', bindingGeneration: 1, title: 'Later', created: false });
    ok(await h.controller.handleRequest({ type: 'comment-task/retry', requestId: 'rt1', taskId }, doc()), 'retry');
    assert.equal(h.enqueued[1].conversationId, first.conversationId, 'retry goes to the card’s own chat');
    console.log('✓ retry keeps the card’s chat');
  }

  // ── Retry when the card's chat is gone: the rules pick again ──
  {
    const h = harness({
      chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
      records: new Map([['conv-draft', DRAFT]]),
    });
    destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
    const taskId = (await h.store.listForDocument(DOC_URI))[0].taskId;
    await h.controller.applyTurnStarted('conv-draft', h.enqueued[0].conversationTurnId);
    await h.controller.applyTurnTerminal('conv-draft', h.enqueued[0].conversationTurnId, { status: 'failed', error: 'Network' });
    // The chat was deleted: the index no longer has it.
    h.world.chats = [{ conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }];
    h.world.records.delete('conv-draft');
    h.world.enqueueAnswers = ['no-conversation', 'queued'];
    h.toasts.length = 0;
    ok(await h.controller.handleRequest({ type: 'comment-task/retry', requestId: 'rt1', taskId }, doc()), 'retry');
    assert.equal(h.enqueued[1].conversationId, 'conv-draft', 'first the card’s own chat');
    assert.ok(h.enqueued[2].newConversation, 'then a new chat, as the rules say (the open chat changed another document)');
    assert.equal(h.enqueued[2].newConversation?.title, 'Shorter please');
    const record = await h.store.get(taskId);
    assert.equal(record?.destination.conversationId, h.enqueued[2].conversationId, 'the card now names the new chat');
    assert.deepEqual(h.toasts, ['Sent to a new chat, “Shorter please”']);
    console.log('✓ retry picks again only when the chat is gone');
  }

  await check("Finding 5a: retry to the card's own chat that isn't open: room check and toast", async () => {
    const h = harness({
      chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
      records: new Map([['conv-draft', DRAFT]]),
    });
    destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
    const taskId = (await h.store.listForDocument(DOC_URI))[0].taskId;
    await h.controller.applyTurnStarted('conv-draft', h.enqueued[0].conversationTurnId);
    await h.controller.applyTurnTerminal('conv-draft', h.enqueued[0].conversationTurnId, { status: 'failed', error: 'Network' });
    h.toasts.length = 0;
    h.attachAsked.length = 0;
    ok(await h.controller.handleRequest({ type: 'comment-task/retry', requestId: 'rt1', taskId }, doc()), 'retry');
    assert.deepEqual(h.attachAsked, ['conv-draft'], 'room is checked for the card’s chat that isn’t open');
    assert.deepEqual(h.toasts, ['Sent to “Draft Module 2 and 3”'], 'and the toast says where it went');
    });

  await check('Finding 5b: an unreachable sheet, or a chat that still exists, is not a gone chat', async () => {
    for (const unreachable of [true, false]) {
      const h = harness({
        chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
        records: new Map([['conv-draft', DRAFT]]),
      });
      destinationOf(await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()));
      const taskId = (await h.store.listForDocument(DOC_URI))[0].taskId;
      await h.controller.applyTurnStarted('conv-draft', h.enqueued[0].conversationTurnId);
      await h.controller.applyTurnTerminal('conv-draft', h.enqueued[0].conversationTurnId, { status: 'failed', error: 'Network' });
      // The rules would now pick a new chat (the open chat changed another document).
      h.world.chats = [{ conversationId: 'conv-open', changedFiles: [{ path: OTHER, changedAt: '2026-11-07T09:00:00Z' }] }];
      // unreachable: the sheet timed out. Otherwise: "no-conversation", but the chat's record still exists.
      h.world.unreachable = unreachable;
      h.world.enqueueAnswers = ['no-conversation', 'queued'];
      const result = await h.controller.handleRequest({ type: 'comment-task/retry', requestId: 'rt1', taskId }, doc());
      assert.ok(!result.ok, 'the retry fails honestly');
      assert.equal(h.enqueued.length, 2, 'no second dispatch');
      assert.ok(!h.enqueued.some((m) => m.newConversation), 'no new chat while the original exists');
      assert.equal((await h.store.get(taskId))?.destination.conversationId, 'conv-draft', 'the card keeps its chat');
    }
  });

  await check('Review 2, finding 1: room frees between the room check and the stored waiting task, and the task still starts', async () => {
    let h!: ReturnType<typeof harness>;
    let checked = false;
    h = harness({
      chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
      records: new Map([['conv-draft', DRAFT]]),
      canAttach: false,
    }, {
      canAttach: async () => {
        if (checked) return h.world.canAttach;
        checked = true;
        // The turn holding the last slot ends right after this check says
        // "no room" and before the waiting task is stored: its pass finds nothing.
        h.world.canAttach = true;
        await h.controller.applyTurnTerminal('conv-other', '99999999-9999-4999-8999-999999999999', { status: 'completed', text: 'Done' });
        return false;
      },
    });
    const result = await h.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc());
    assert.ok(result.ok, 'accepted');
    for (let i = 0; i < 100 && h.enqueued.length === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(h.enqueued.length, 1, 'the waiting task starts: room was free by the time it was stored');
    for (let i = 0; i < 100 && (await h.store.listForDocument(DOC_URI))[0]?.lifecycle.state !== 'queued'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const [started] = await h.store.listForDocument(DOC_URI);
    assert.equal(started?.lifecycle.state, 'queued');
  });

  await check("Review 2, finding 2: the task is dispatched with its frozen runtime settings, not asked again", async () => {
    // The sidebar's one-entry cache empties when it is read, so a second read
    // answers "auto" (UnifiedViewProvider._commentTaskRuntimeSettings).
    const settings = (reads: { n: number }) => () => {
      reads.n += 1;
      return { modelId: 'model-x', approvalMode: 'ask' as const, thinkingEffort: reads.n === 1 ? 'high' : 'auto' };
    };
    const now = harness({}, { runtimeSettings: settings({ n: 0 }) });
    ok(await now.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()), 'accept');
    assert.equal(now.enqueued[0]?.thinkingEffort, 'high', 'first dispatch keeps the saved effort');
    assert.equal(now.enqueued[0]?.autonomy, 'ask');
    const taskId = (await now.store.listForDocument(DOC_URI))[0].taskId;
    await now.controller.applyTurnStarted(now.enqueued[0].conversationId, now.enqueued[0].conversationTurnId);
    await now.controller.applyTurnTerminal(now.enqueued[0].conversationId, now.enqueued[0].conversationTurnId, { status: 'failed', error: 'Network' });
    ok(await now.controller.handleRequest({ type: 'comment-task/retry', requestId: 'rt1', taskId }, doc()), 'retry');
    assert.equal(now.enqueued[1]?.thinkingEffort, 'high', 'a retry keeps the saved effort');
    const later = harness({
      chats: [{ conversationId: 'conv-draft', changedFiles: [{ path: DOC, changedAt: '2026-11-07T08:00:00Z' }] }],
      records: new Map([['conv-draft', DRAFT]]),
      canAttach: false,
    }, { runtimeSettings: settings({ n: 0 }) });
    ok(await later.controller.handleRequest(accept('r1', [[C1, 'Shorter please']]), doc()), 'accept');
    later.world.canAttach = true;
    await later.controller.applyTurnTerminal('conv-other', '99999999-9999-4999-8999-999999999999', { status: 'completed', text: 'Done' });
    assert.equal(later.enqueued[0]?.thinkingEffort, 'high', 'a waiting task starts with the saved effort');
  });

  if (failures.length) {
    console.error(`CommentTaskController routing tests: ${failures.length} FAILED: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('CommentTaskController routing tests: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

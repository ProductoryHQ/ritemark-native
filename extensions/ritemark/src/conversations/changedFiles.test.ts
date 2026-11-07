/**
 * Sprint 155: the conversation record keeps each finished turn's changed
 * files; the summary (and so the index) answers "which chat last changed this
 * file, and when"; an old record without them still reads.
 *
 * Run: npx tsx src/conversations/changedFiles.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConversationController } from './ConversationController';
import { ConversationStore } from './ConversationStore';
import { resolveProjectScope } from './projectScope';
import { changedFilesOf, decodeConversationRecordV1, summarizeConversationRecord } from './types';

function uuid(value: number): string {
  return `20000000-0000-4000-8000-${value.toString().padStart(12, '0')}`;
}

async function run(): Promise<void> {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-changed-files-'));
  const scope = resolveProjectScope({ folderUris: ['file:///p'], platform: 'darwin' });
  let nextId = 1;
  let clock = Date.parse('2026-11-07T08:00:00.000Z');
  const now = () => new Date(clock);
  const randomId = () => uuid(nextId++);
  const store = new ConversationStore(temp, { randomId, now });
  const controller = new ConversationController({ store, currentScope: () => scope, randomId, now });

  async function turn(conversationId: string | undefined, runtimeId: 'claude-code' | 'codex' | 'opencode', files: string[], status: 'completed' | 'failed' = 'completed') {
    const accepted = await controller.acceptRuntimeTurn({ conversationId, agentId: runtimeId, text: 'Change it' });
    clock += 60_000;
    return controller.completeRuntimeTurn({
      conversationId: accepted.conversationId,
      bindingGeneration: accepted.bindingGeneration,
      runtimeId,
      text: status === 'completed' ? 'Done.' : '',
      status,
      ...(status === 'failed' ? { error: 'It stopped.' } : {}),
      filesModified: files,
    });
  }

  // ── A finished turn's changed files are stored and read back ──
  const draft = await turn(undefined, 'claude-code', ['/p/Advokatuur.md', '/p/Module 3.md']);
  const draftAgain = await turn(draft.conversationId, 'codex', ['/p/Module 2.md', '/p/Module 2.md']);
  const last = draftAgain.events.at(-1);
  assert.equal(last?.kind, 'assistant-message');
  assert.deepEqual(last?.kind === 'assistant-message' ? last.filesModified : null, ['/p/Module 2.md'], 'stored once per turn');

  const reread = await store.get(draft.conversationId);
  assert.ok(reread);
  assert.deepEqual(
    reread.events.flatMap((event) => (event.kind === 'assistant-message' ? event.filesModified ?? [] : [])),
    ['/p/Advokatuur.md', '/p/Module 3.md', '/p/Module 2.md'],
    'round-trip through the store',
  );

  // A failed turn's changes count too (it may have changed files before it failed).
  const shorten = await turn(undefined, 'opencode', ['/p/Advokatuur.md'], 'failed');
  const boundary = shorten.events.at(-1);
  assert.equal(boundary?.kind, 'boundary');
  assert.deepEqual(boundary?.kind === 'boundary' ? boundary.filesModified : null, ['/p/Advokatuur.md']);

  // A turn's list is capped, as the summary is (Sprint 155 review, finding 6).
  const many = Array.from({ length: 80 }, (_, index) => `/p/generated/file-${index}.md`);
  const big = await turn(undefined, 'codex', many);
  const bigEvent = big.events.at(-1);
  assert.equal(bigEvent?.kind === 'assistant-message' ? bigEvent.filesModified?.length : null, 50, 'one turn keeps at most 50 changed files');
  const oversized = JSON.parse(JSON.stringify(big)) as Record<string, unknown> & { events: Array<Record<string, unknown>> };
  (oversized.events.at(-1) as Record<string, unknown>).filesModified = many;
  const readBig = decodeConversationRecordV1(oversized).events.at(-1);
  assert.equal(readBig?.kind === 'assistant-message' ? readBig.filesModified?.length : null, 50, 'and reads back at most 50');

  // A turn that changed nothing writes no field.
  const cases = await turn(undefined, 'claude-code', []);
  assert.equal(cases.events.at(-1)?.kind === 'assistant-message' && 'filesModified' in cases.events.at(-1)!, false);

  // ── The summary, newest change first; the index carries it ──
  assert.deepEqual(
    summarizeConversationRecord(reread, 'now').changedFiles?.map((entry) => entry.path),
    ['/p/Module 2.md', '/p/Advokatuur.md', '/p/Module 3.md'],
  );
  const freshStore = new ConversationStore(temp, { randomId, now });
  const freshController = new ConversationController({ store: freshStore, currentScope: () => scope, randomId, now });
  const byChat = await freshController.changedFilesByChat();
  assert.equal(byChat.find((chat) => chat.conversationId === draft.conversationId)?.changedFiles?.[0].path, '/p/Module 2.md', 'read from the index');
  assert.equal(byChat.find((chat) => chat.conversationId === cases.conversationId)?.changedFiles, undefined, 'a chat that changed nothing has none');

  // ── Which chat last changed a file, and when ──
  const lastAdvokatuur = await freshController.lastChatToChange('/p/Advokatuur.md');
  assert.equal(lastAdvokatuur?.conversationId, shorten.conversationId, 'the newest change wins');
  assert.equal(await freshController.lastChatToChange('/p/Nobody.md'), null);

  // ── Back-compatibility: an old record without the field still reads ──
  const raw = JSON.parse(JSON.stringify(reread)) as Record<string, unknown> & { events: Array<Record<string, unknown>> };
  for (const event of raw.events) delete event.filesModified;
  const old = decodeConversationRecordV1(raw);
  assert.equal(old.events.length, reread.events.length, 'an old record parses');
  assert.deepEqual(changedFilesOf(old.events), [], 'and changed nothing');
  assert.equal(summarizeConversationRecord(old, 'now').changedFiles, undefined);

  // A malformed value is dropped, never a reason to quarantine the chat.
  const odd = JSON.parse(JSON.stringify(reread)) as typeof raw;
  const replies = odd.events.filter((event) => event.kind === 'assistant-message');
  replies[0].filesModified = [42, '', '/p/ok.md'];
  replies[1].filesModified = 'not a list';
  const decoded = decodeConversationRecordV1(odd);
  assert.deepEqual(changedFilesOf(decoded.events).map((entry) => entry.path), ['/p/ok.md']);

  // An index entry from before Sprint 155 has no changed files and still reads.
  const indexFile = path.join(temp, 'index.json');
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { entries: Array<Record<string, unknown>> };
  for (const entry of index.entries) delete entry.changedFiles;
  fs.writeFileSync(indexFile, JSON.stringify(index));
  const olderIndexStore = new ConversationStore(temp, { randomId, now });
  const listed = await olderIndexStore.list(scope.scopeId);
  assert.equal(listed.length, 4, 'every chat is still listed');
  assert.ok(listed.every((entry) => entry.integrity === 'verified'), 'and none is quarantined');

  console.log('changedFiles tests: all assertions passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Sprint 148 (R4, R5): the host's side of the worker, with a fake worker: a newer
 * query replaces an older one, a stopped worker restarts once with half the
 * limits, and a second stop makes search not available.
 * Run: npx tsx src/search/searchWorkerClient.test.ts
 */
import assert from 'node:assert/strict';
import { DEFAULT_SEARCH_LIMITS, DEFAULT_SEARCH_OPTIONS, type HostToWorkerMessage, type IndexStatus, type WorkerConfig, type WorkerToHostMessage } from './protocol';
import { SearchWorkerClient, halfLimits, type WorkerLike } from './searchWorkerClient';

class FakeWorker implements WorkerLike {
  readonly sent: HostToWorkerMessage[] = [];
  private readonly listeners: Record<string, ((value: never) => void)[]> = { message: [], error: [], exit: [] };
  terminated = false;

  postMessage(message: HostToWorkerMessage): void {
    this.sent.push(message);
  }

  on(event: 'message' | 'error' | 'exit', listener: (value: never) => void): unknown {
    this.listeners[event].push(listener);
    return this;
  }

  emit(event: 'message' | 'error' | 'exit', value: unknown): void {
    for (const listener of this.listeners[event]) listener(value as never);
  }

  reply(message: WorkerToHostMessage): void {
    this.emit('message', message);
  }

  queries() {
    return this.sent.filter((m): m is Extract<HostToWorkerMessage, { type: 'query' }> => m.type === 'query');
  }

  async terminate(): Promise<number> {
    this.terminated = true;
    return 0;
  }
}

const config: WorkerConfig = {
  roots: [{ path: '/p', name: 'p' }],
  filesExclude: {},
  platform: 'darwin',
  oneDriveRoots: [],
  cacheDir: null,
  cacheBytes: 0,
  chats: null,
  limits: DEFAULT_SEARCH_LIMITS,
};

const answerFor = (request: Extract<HostToWorkerMessage, { type: 'query' }>): WorkerToHostMessage => ({
  type: 'answer',
  requestId: request.requestId,
  answer: { queryId: request.queryId, layer: 'words', tooShort: false, groups: [], reading: null, limited: false, tooLarge: 0, tookMs: 1 },
});

async function main() {
  const workers: FakeWorker[] = [];
  const client = new SearchWorkerClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  }, config);
  const statuses: IndexStatus[] = [];
  client.onStatus((status) => statuses.push(status));

  // Nothing starts until asked.
  assert.equal(client.started, false);
  client.post({ type: 'tasks', sources: [{ key: 'task:1', kind: 'task', name: 'T', where: null, changedAt: 0, passages: [] }] });
  assert.equal(workers.length, 0);

  // A query starts the worker with its config; the board's last snapshot follows.
  const first = client.query('ha', DEFAULT_SEARCH_OPTIONS, 5);
  assert.equal(workers.length, 1);
  assert.deepEqual(workers[0].sent.map((m) => m.type), ['init', 'tasks', 'query']);
  // Typing on: "har" waits while "ha" is in the worker; "harb" replaces "har".
  const second = client.query('har', DEFAULT_SEARCH_OPTIONS, 5);
  const third = client.query('harb', DEFAULT_SEARCH_OPTIONS, 5);
  assert.equal(await second, null, 'a replaced query answers nothing');
  assert.equal(workers[0].queries().length, 1, 'one query in the worker at a time');
  workers[0].reply(answerFor(workers[0].queries()[0]));
  assert.equal((await first)?.queryId, 1);
  assert.deepEqual(workers[0].queries().map((q) => q.text), ['ha', 'harb'], 'the newest follows, the skipped one never runs');
  workers[0].reply(answerFor(workers[0].queries()[1]));
  assert.equal((await third)?.queryId, 3, 'query ids grow with each key, so an older answer is never drawn over a newer one');

  // A crash: one restart, with half the limits; open questions answer nothing.
  const pending = client.query('crash', DEFAULT_SEARCH_OPTIONS, 5);
  workers[0].emit('exit', 1);
  assert.equal(await pending, null);
  assert.equal(workers.length, 2);
  const init = workers[1].sent[0] as Extract<HostToWorkerMessage, { type: 'init' }>;
  assert.equal(init.type, 'init');
  assert.deepEqual(init.config.limits, halfLimits(DEFAULT_SEARCH_LIMITS));
  assert.equal(init.config.limits.maxDocuments, 10_000);
  assert.equal(workers[1].sent[1].type, 'tasks', 'the board\'s set is sent again');

  // Messages the worker follows reach the new one.
  client.post({ type: 'chats-changed' });
  assert.equal(workers[1].sent.at(-1)?.type, 'chats-changed');
  client.post({ type: 'rules', filesExclude: { '/p': ['drafts'] } });

  // A second stop: search isn't available in this project.
  workers[1].emit('error', new Error('heap'));
  assert.equal(workers.length, 2, 'no third start');
  assert.equal(client.unavailable, true);
  assert.equal(statuses.at(-1)?.state, 'unavailable');
  assert.equal(await client.query('anything', DEFAULT_SEARCH_OPTIONS, 5), null);
  assert.ok(workers.every((w) => w.terminated));

  // Dispose stops the worker and answers what waits.
  const other = new SearchWorkerClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  }, config);
  const waiting = other.query('ab', DEFAULT_SEARCH_OPTIONS, 5);
  other.dispose();
  assert.equal(await waiting, null);
  assert.equal(workers.at(-1)!.terminated, true);
  workers.at(-1)!.emit('exit', 1);
  assert.equal(workers.length, 3, 'a disposed client never restarts');

  console.log('searchWorkerClient.test.ts: all passed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

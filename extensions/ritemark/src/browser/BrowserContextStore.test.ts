/**
 * Sprint 134 (R20, S55–S57): the browser's share question waits on the AI's
 * sheet. The workbench (patch 009) is faked: it answers `needsAnswer` for an
 * unshared page unless the person chose to share pages without asking.
 * Run: npx tsx src/browser/BrowserContextStore.test.ts
 */

import assert from 'node:assert/strict';
import Module from 'node:module';

interface Page { pageId: string; url: string; title?: string; shared: boolean }

const workbench = {
  /** Milliseconds the workbench takes to answer ensureActiveBrowserShared (an ask in flight). */
  askDelay: 0,
  front: null as Page | null,
  withoutAsking: false,
  calls: [] as unknown[][],
  /** An older shell (patch 009 before Sprint 134): the request opens its own modal and answers when the person does. */
  olderShell: false,
  modals: [] as ((shared: boolean) => void)[],
};

function dto(page: Page) {
  return { pageId: page.pageId, url: page.url, title: page.title, sharedWithAgent: page.shared };
}

const commands = {
  executeCommand: async (id: string, ...args: unknown[]): Promise<unknown> => {
    workbench.calls.push([id, ...args]);
    const page = workbench.front;
    if (!page) return { error: 'No active integrated browser tab.' };
    switch (id) {
      case 'workbench.action.browser.getActiveContext':
        return dto(page);
      case 'workbench.action.browser.getActiveSummary':
        return { ...dto(page), summary: `The text of ${page.url}` };
      case 'workbench.action.browser.ensureActiveBrowserShared': {
        if (workbench.askDelay) await new Promise((resolve) => setTimeout(resolve, workbench.askDelay));
        if (workbench.olderShell) {
          return new Promise((resolve) => workbench.modals.push((shared) => {
            page.shared = shared;
            resolve(dto(page));
          }));
        }
        const answer = args[0] as { pageId: string; answer: 'share' | 'notNow'; withoutAsking: boolean } | undefined;
        if (answer) {
          if (answer.pageId !== page.pageId) return { ...dto(page), stale: true };
          if (answer.answer === 'share') {
            page.shared = true;
            if (answer.withoutAsking) workbench.withoutAsking = true;
          }
          return dto(page);
        }
        if (!page.shared) {
          if (!workbench.withoutAsking) return { ...dto(page), needsAnswer: true };
          page.shared = true;
        }
        return dto(page);
      }
    }
    throw new Error(`unexpected command ${id}`);
  },
};

const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? { commands } : load(request, ...rest));

let failures = 0;
async function test(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  ✗ ${name}\n`, error);
  }
}

async function main(): Promise<void> {
  const { BrowserContextStore } = await import('./BrowserContextStore');
  const fresh = () => {
    workbench.front = null;
    workbench.askDelay = 0;
    workbench.withoutAsking = false;
    workbench.calls = [];
    workbench.olderShell = false;
    workbench.modals = [];
    return new BrowserContextStore();
  };
  const poll = async (store: InstanceType<typeof BrowserContextStore>) => {
    await store.refreshMetadata();
    return store.ensureSharedForActiveTab();
  };
  const site = (): Page => ({ pageId: 'p1', url: 'https://ritemark.app/', title: 'Ritemark', shared: false });

  await test('an unshared page is asked about on the sheet, once while it waits', async () => {
    const store = fresh();
    workbench.front = site();
    assert.deepEqual(await poll(store), { kind: 'show', question: { pageId: 'p1', title: 'Ritemark' } });
    assert.deepEqual(await poll(store), { kind: 'unchanged' });
    assert.equal(workbench.front.shared, false);
  });

  await test('a page with no title is named by its host', async () => {
    const store = fresh();
    workbench.front = { pageId: 'p2', url: 'https://example.org/a/b', shared: false };
    assert.deepEqual(await poll(store), { kind: 'show', question: { pageId: 'p2', title: 'example.org' } });
  });

  await test('S57: nothing about the page reaches the AI before Share', async () => {
    const store = fresh();
    workbench.front = site();
    await poll(store);
    assert.equal(await store.buildTurnContext(), null);
    assert.ok(!workbench.calls.some(([id]) => id === 'workbench.action.browser.getActiveSummary'));
  });

  await test('S55: Share this page shares it, and the turn then carries it', async () => {
    const store = fresh();
    workbench.front = site();
    await poll(store);
    assert.equal(await store.answerShareQuestion('p1', 'share', false), true);
    assert.equal(workbench.front.shared, true);
    assert.equal(workbench.withoutAsking, false);
    assert.deepEqual(await poll(store), { kind: 'unchanged' });
    const turn = await store.buildTurnContext();
    assert.match(turn?.promptBlock ?? '', /URL: https:\/\/ritemark\.app\//);
  });

  await test('S56: Not now shares nothing and is not asked again this session', async () => {
    const store = fresh();
    workbench.front = site();
    await poll(store);
    assert.equal(await store.answerShareQuestion('p1', 'notNow', true), true);
    assert.equal(workbench.front.shared, false);
    assert.equal(workbench.withoutAsking, false, 'the box counts only with Share');
    assert.deepEqual(await poll(store), { kind: 'unchanged' });
    assert.equal(await store.buildTurnContext(), null);
  });

  await test('S56: Share with the box: later pages are shared without asking', async () => {
    const store = fresh();
    workbench.front = site();
    await poll(store);
    await store.answerShareQuestion('p1', 'share', true);
    workbench.front = { pageId: 'p3', url: 'https://example.org/', title: 'Example', shared: false };
    assert.deepEqual(await poll(store), { kind: 'unchanged' });
    assert.equal(workbench.front.shared, true);
  });

  await test('S57: another page in front: the question moves to it, and the page left is asked again when it comes back', async () => {
    const store = fresh();
    const first = site();
    const second: Page = { pageId: 'p4', url: 'https://example.org/', title: 'Example', shared: false };
    workbench.front = first;
    await poll(store);
    workbench.front = second;
    assert.deepEqual(await poll(store), { kind: 'show', question: { pageId: 'p4', title: 'Example' } });
    workbench.front = null;
    assert.deepEqual(await poll(store), { kind: 'clear' });
    workbench.front = first;
    assert.deepEqual(await poll(store), { kind: 'show', question: { pageId: 'p1', title: 'Ritemark' } });
    assert.equal(first.shared, false);
  });

  await test('an answer about a page no longer in front shares nothing and leaves it unasked', async () => {
    const store = fresh();
    const first = site();
    workbench.front = first;
    await poll(store);
    workbench.front = { pageId: 'p5', url: 'https://example.org/', title: 'Example', shared: false };
    assert.equal(await store.answerShareQuestion('p1', 'share', false), false);
    assert.equal(first.shared, false);
    assert.equal(workbench.front.shared, false);
    workbench.front = first;
    assert.equal((await poll(store)).kind, 'show');
  });

  await test('with sharing chosen earlier, nothing is asked', async () => {
    const store = fresh();
    workbench.withoutAsking = true;
    workbench.front = site();
    assert.deepEqual(await poll(store), { kind: 'unchanged' });
    assert.equal(workbench.front.shared, true);
  });

  /** A poll that waits on a second dialog would hang: here it fails instead. */
  const settles = <T,>(promise: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('the poll waited on another dialog')), 1000); });
    return Promise.race([promise, late]).finally(() => clearTimeout(timer));
  };

  await test('an older shell asks in its own dialog: one dialog for the page, never one per poll', async () => {
    const store = fresh();
    workbench.olderShell = true;
    workbench.front = site();
    const ensures = () => workbench.calls.filter(([id]) => id === 'workbench.action.browser.ensureActiveBrowserShared').length;
    // The sheet polls every 1.5 s while the dialog waits for the person
    const first = poll(store);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(await settles(poll(store)), { kind: 'unchanged' });
    assert.deepEqual(await settles(poll(store)), { kind: 'unchanged' });
    assert.equal(ensures(), 1, 'one request, so one dialog');
    // The person answers Deny: the page is settled for the window
    workbench.modals.shift()!(false);
    assert.deepEqual(await first, { kind: 'unchanged' });
    for (let i = 0; i < 3; i++) assert.deepEqual(await poll(store), { kind: 'unchanged' });
    assert.equal(ensures(), 1, 'never asked again after Deny');
    assert.equal(workbench.modals.length, 0);
  });

  await test('an older shell: Allow shares the page and nothing more is asked', async () => {
    const store = fresh();
    workbench.olderShell = true;
    workbench.front = site();
    const first = poll(store);
    await new Promise((resolve) => setTimeout(resolve, 0));
    workbench.modals.shift()!(true);
    await first;
    assert.deepEqual(await poll(store), { kind: 'unchanged' });
    assert.equal(workbench.calls.filter(([id]) => id === 'workbench.action.browser.ensureActiveBrowserShared').length, 1);
    assert.equal(workbench.front.shared, true);
  });

  // Sprint 136 (Windows round 5): a message sent while the question waits waits for it to settle.
  await test('a waiting turn is told once Share has shared the page, so it reads the page', async () => {
    const store = fresh();
    workbench.front = site();
    await poll(store);
    assert.deepEqual(store.waitingQuestion(), { pageId: 'p1', title: 'Ritemark' });
    let sharedWhenTold: boolean | null = null;
    const subscription = store.onQuestionSettled(() => { sharedWhenTold = workbench.front?.shared ?? null; });
    await store.answerShareQuestion('p1', 'share', false);
    subscription.dispose();
    assert.equal(sharedWhenTold, true, 'told after the workbench shared the page');
    assert.equal(store.waitingQuestion(), null);
    assert.match((await store.buildTurnContext())?.promptBlock ?? '', /URL: https:\/\/ritemark\.app\//);
  });

  await test('Not now, another page in front, or a reloaded sheet also settle the question; a poll alone does not', async () => {
    const store = fresh();
    let told = 0;
    store.onQuestionSettled(() => { told += 1; });
    workbench.front = site();
    await poll(store);
    await poll(store);
    assert.equal(told, 0, 'still waiting');
    await store.answerShareQuestion('p1', 'notNow', false);
    assert.equal(told, 1);

    workbench.front = { pageId: 'p4', url: 'https://example.org/', title: 'Example', shared: false };
    await poll(store);
    workbench.front = null;
    await poll(store);
    assert.equal(told, 2, 'withdrawn when no page is in front');

    workbench.front = { pageId: 'p5', url: 'https://example.com/', title: 'Example com', shared: false };
    await poll(store);
    store.sheetReloaded();
    assert.equal(told, 3, 'dropped with the sheet');
    store.sheetReloaded();
    assert.equal(told, 3, 'nothing waiting, nothing told');
  });

  // Sprint 136: the turn's wait itself (UnifiedViewProvider's agent-execute uses it).
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  await test('the wait ends with Share, on the page asked about, and leaves no listener', async () => {
    const store = fresh();
    workbench.front = site();
    await poll(store);
    const wait = store.waitForAnswer(async () => { await poll(store); });
    await tick();
    assert.equal(store.settledListenerCount(), 1, 'waiting');
    await store.answerShareQuestion('p1', 'share', false);
    assert.deepEqual(await wait.done, { outcome: 'answered', pageId: 'p1' });
    assert.equal(store.settledListenerCount(), 0);
  });

  await test('with nothing asked, nothing waits', async () => {
    const store = fresh();
    workbench.front = { ...site(), shared: true };
    const wait = store.waitForAnswer(async () => { await poll(store); });
    assert.deepEqual(await wait.done, { outcome: 'answered' });
  });

  await test('Stop ends the wait, also before the question is brought up to date', async () => {
    const store = fresh();
    workbench.front = site();
    const early = store.waitForAnswer(async () => { await poll(store); });
    early.stop();
    assert.equal((await early.done).outcome, 'stopped', 'a stop before the refresh is kept');
    const during = store.waitForAnswer(async () => { await poll(store); });
    await tick();
    during.stop();
    during.stop();
    assert.deepEqual(await during.done, { outcome: 'stopped', pageId: 'p1' });
    assert.equal(store.settledListenerCount(), 0);
  });

  await test("another page's answer does not end the wait; the page asked about leaving the front does", async () => {
    const store = fresh();
    workbench.front = site();
    await poll(store);
    const wait = store.waitForAnswer(async () => { await poll(store); });
    await tick();
    await store.answerShareQuestion('p9', 'notNow', false);
    await tick();
    assert.equal(store.settledListenerCount(), 1, 'still waiting for p1');
    workbench.front = { pageId: 'p6', url: 'https://example.net/', title: 'Example net', shared: false };
    assert.deepEqual(await poll(store), { kind: 'show', question: { pageId: 'p6', title: 'Example net' } });
    assert.deepEqual(await wait.done, { outcome: 'answered', pageId: 'p1' }, 'replaced: p1 is settled unanswered');
    assert.equal(await store.buildTurnContext(), null, 'and nothing about p6 is shared');
  });

  await test('an ask in flight is waited for, so its question holds the turn', async () => {
    const store = fresh();
    workbench.front = site();
    workbench.askDelay = 30;
    const firstPoll = poll(store);
    await tick();
    const wait = store.waitForAnswer(async () => { await poll(store); });
    await firstPoll;
    await tick();
    assert.equal(store.settledListenerCount(), 1, 'the question the ask brought holds the turn');
    workbench.askDelay = 0;
    await store.answerShareQuestion('p1', 'share', false);
    assert.deepEqual(await wait.done, { outcome: 'answered', pageId: 'p1' });
  });

  if (failures) {
    console.error(`\n${failures} failed`);
    process.exit(1);
  }
  console.log('\nAll passed');
}

void main();

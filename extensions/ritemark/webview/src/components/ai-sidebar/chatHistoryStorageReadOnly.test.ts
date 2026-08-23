import assert from 'node:assert/strict';

class FakeStorage {
  private readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

(globalThis as unknown as { localStorage: Storage }).localStorage = new FakeStorage() as unknown as Storage;

async function run(): Promise<void> {
  const storage = await import('./chatHistoryStorage');
  const first = {
    id: 'legacy-1',
    title: 'Legacy conversation',
    agentId: 'codex' as const,
    createdAt: 1,
    updatedAt: 2,
    agentConversation: [],
    codexConversation: [],
    chatMessages: [],
    conversationHistory: [],
  };
  storage.saveConversation(first);
  assert.equal(storage.listConversations().length, 1);

  storage.setLegacyStorageReadOnly(true);
  storage.saveConversation({ ...first, id: 'legacy-2', title: 'Must not write' });
  storage.deleteConversation(first.id);
  assert.deepEqual(storage.listConversations().map((item) => item.id), [first.id]);

  // The guard is monotonic inside one webview lifetime.
  storage.setLegacyStorageReadOnly(false);
  storage.deleteConversation(first.id);
  assert.equal(storage.listConversations().length, 1);

  console.log('chatHistoryStorageReadOnly.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

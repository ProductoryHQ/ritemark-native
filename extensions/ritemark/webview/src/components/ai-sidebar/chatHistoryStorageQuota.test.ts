import assert from 'node:assert/strict';

class QuotaStorage implements Storage {
  private readonly data = new Map<string, string>([
    ['ritemark-chat-metadata', JSON.stringify([
      {
        id: 'legacy-corrupt',
        title: 'Corrupt legacy conversation',
        agentId: 'claude-code',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'legacy-large',
        title: 'Large legacy conversation',
        agentId: 'claude-code',
        createdAt: 1,
        updatedAt: 2,
      },
    ])],
    ['ritemark-chat-legacy-corrupt', '{not-json'],
    ['ritemark-chat-legacy-large', JSON.stringify({
      id: 'legacy-large',
      title: 'Large legacy conversation',
      agentId: 'claude-code',
      createdAt: 1,
      updatedAt: 2,
      agentConversation: [{ userPrompt: 'x'.repeat(1024) }],
      chatMessages: [],
      conversationHistory: [],
    })],
  ]);

  writes = 0;
  removals = 0;

  get length(): number { return this.data.size; }
  clear(): void { throw new Error('bootstrap must not clear legacy storage'); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(_key: string): void {
    this.removals += 1;
    throw new Error('bootstrap must not remove legacy storage');
  }
  setItem(_key: string, _value: string): void {
    this.writes += 1;
    throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
  }
}

async function main(): Promise<void> {
  const quotaStorage = new QuotaStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = quotaStorage;
  const storage = await import('./chatHistoryStorage');

  assert.doesNotThrow(
    () => storage.setWorkspaceContext('/tmp/quota-workspace'),
    'choosing a workspace must be a side-effect-free in-memory operation',
  );
  assert.equal(quotaStorage.writes, 0, 'workspace bootstrap must not duplicate or mark legacy records');
  assert.equal(quotaStorage.removals, 0, 'workspace bootstrap must preserve original legacy records');
  assert.equal(
    storage.selectLegacyStorageScope(),
    'global',
    'pre-cutover rollback reads an existing global archive without copying it',
  );
  assert.deepEqual(
    storage.listConversations().map((item) => item.id),
    ['legacy-large', 'legacy-corrupt'],
    'legacy metadata remains readable without eagerly parsing full records',
  );
  assert.equal(quotaStorage.writes, 0, 'legacy fallback selection remains read-only');

  const candidates = storage.discoverLegacyConversationCandidates();
  assert.equal(candidates.length, 1, 'one malformed record must not hide later valid host-import candidates');
  assert.equal(candidates[0].sourceKey, 'ritemark-chat-legacy-large');

  console.log('chatHistoryStorageQuota.test.ts: storage-full bootstrap isolation passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

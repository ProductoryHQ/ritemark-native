import assert from 'node:assert/strict';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
  key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null; }
  get length(): number { return this.data.size; }
}

(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const { useAISidebarStore } = await import('./store');
const { createConversationState } = await import('./conversationState');

const conversations = Object.fromEntries(Array.from({ length: 5 }, (_, index) => {
  const id = `conversation-${index}`;
  return [id, createConversationState(id, {
    createdAt: index,
    agentConversation: [{
      id: `turn-${index}`,
      conversationId: id,
      userPrompt: `Prompt ${index}`,
      activities: [],
      isRunning: false,
      isPlan: false,
      planHandled: false,
      timestamp: index,
    }],
  })];
}));
useAISidebarStore.setState({ conversations, activeConversationId: 'conversation-0' });
useAISidebarStore.setState({ showHistoryPanel: true });
useAISidebarStore.getState().switchConversation('conversation-0');
assert.equal(
  useAISidebarStore.getState().showHistoryPanel,
  false,
  'Selecting the already-current conversation closes the panel instead of leaving focus trapped in it',
);

useAISidebarStore.getState().requestNewThread();

assert.equal(Object.keys(useAISidebarStore.getState().conversations).length, 6, 'New is never limited by runtime attachment capacity');
assert.notEqual(useAISidebarStore.getState().activeConversationId, 'conversation-0');

console.log('threadRail.test.ts: all assertions passed');

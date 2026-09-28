/**
 * Sprint 102 disclosure state and runtime/provider mapping tests.
 * Run with: npx tsx webview/src/components/ai-sidebar/aiDisclosure.test.ts
 */
import assert from 'node:assert/strict';
import {
  AI_DISCLOSURE_STORAGE_KEY,
  acknowledgeFirstUseDisclosure,
  buildDisclosureContextRows,
  includesBrowserContext,
  resolveAIIdentity,
  shouldShowFirstUseDisclosure,
  type DisclosureStorage,
} from './aiDisclosure';

class MemoryStorage implements DisclosureStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function testFirstUseDisclosureState() {
  const storage = new MemoryStorage();
  assert.equal(shouldShowFirstUseDisclosure(storage), true, 'fresh profiles must see the disclosure');
  acknowledgeFirstUseDisclosure(storage);
  assert.equal(storage.getItem(AI_DISCLOSURE_STORAGE_KEY), '1');
  assert.equal(shouldShowFirstUseDisclosure(storage), false, 'acknowledged disclosure must not repeat');
}

function testClaudeIdentity() {
  assert.deepEqual(
    resolveAIIdentity({
      runtimeId: 'claude-code',
      claudeModelId: 'claude-sonnet-5',
      claudeModels: [{ id: 'claude-sonnet-5', label: 'Sonnet 5', description: '' }],
    }),
    {
      runtimeId: 'claude-code',
      runtimeLabel: 'Claude Code',
      providerId: 'anthropic',
      providerLabel: 'Anthropic',
      modelId: 'claude-sonnet-5',
      modelLabel: 'Sonnet 5',
      providerInformationUrl: 'https://www.anthropic.com/legal/privacy',
    },
  );
}

function testCodexIdentityUsesPendingSelection() {
  const identity = resolveAIIdentity({
    runtimeId: 'codex',
    pendingModelId: 'gpt-5.6-sol',
    codexModelId: 'gpt-5.4',
    codexModels: [
      { id: 'gpt-5.4', label: 'GPT-5.4', description: '' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', description: '' },
    ],
  });
  assert.equal(identity.providerLabel, 'OpenAI');
  assert.equal(identity.modelLabel, 'GPT-5.6 Sol');
}

function testRuntimeSwitchIgnoresStalePendingModel() {
  const codexIdentity = resolveAIIdentity({
    runtimeId: 'codex',
    pendingModelId: 'claude-sonnet-5',
    codexModelId: 'gpt-5.6-sol',
    codexModels: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', description: '' }],
  });
  assert.equal(codexIdentity.modelLabel, 'GPT-5.6 Sol');

  const claudeIdentity = resolveAIIdentity({
    runtimeId: 'claude-code',
    pendingModelId: 'gpt-5.6-sol',
    claudeModelId: 'claude-sonnet-5',
    claudeModels: [{ id: 'claude-sonnet-5', label: 'Sonnet 5', description: '' }],
  });
  assert.equal(claudeIdentity.modelLabel, 'Sonnet 5');
}

function testOpenCodeIdentity() {
  const identity = resolveAIIdentity({
    runtimeId: 'opencode',
    openCodeModelValue: 'opencode:openrouter/anthropic/claude-sonnet-5',
    byokProviderModels: {
      openrouter: [{ id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', description: '' }],
    },
  });
  assert.equal(identity.runtimeLabel, 'OpenCode');
  assert.equal(identity.providerLabel, 'OpenRouter');
  assert.equal(identity.modelId, 'anthropic/claude-sonnet-5');
  assert.equal(identity.modelLabel, 'Claude Sonnet 5');
}

function testContextState() {
  const rows = buildDisclosureContextRows({
    hasPrompt: true,
    hasActiveFile: true,
    hasSelection: false,
    attachmentCount: 2,
    hasBrowserContext: false,
    hasConversationContext: false,
  });
  assert.equal(rows.find((row) => row.id === 'prompt')?.activeNow, true);
  assert.equal(rows.find((row) => row.id === 'active-file')?.activeNow, true);
  assert.equal(rows.find((row) => row.id === 'selection')?.activeNow, false);
  assert.equal(rows.find((row) => row.id === 'attachments')?.activeNow, true);
  assert.equal(rows.find((row) => row.id === 'browser')?.activeNow, false);
  assert.equal(rows.find((row) => row.id === 'tool-results')?.activeNow, false);
}

function testBrowserContextFollowsShareConsent() {
  const tab = { url: 'https://example.com/pricing', sharedWithAgent: true };
  const included = (overrides: Partial<Parameters<typeof includesBrowserContext>[0]>) => includesBrowserContext({
    context: tab,
    runtimeTakesBrowserContext: true,
    removedForTurn: false,
    ...overrides,
  });

  assert.equal(included({}), true, 'a shared tab goes with the turn');
  assert.equal(
    included({ context: { ...tab, sharedWithAgent: false } }),
    false,
    'a tab declined in "Share with Agent?" (or still waiting for an answer) shows no chip',
  );
  assert.equal(
    included({ context: { url: tab.url } }),
    false,
    'a tab without a share answer is not shared',
  );
  assert.equal(included({ context: null }), false, 'no browser tab, no chip');
  assert.equal(included({ context: { url: '', sharedWithAgent: true } }), false, 'a tab without a URL is not sent');
  assert.equal(
    included({ runtimeTakesBrowserContext: false }),
    false,
    'a runtime that is never sent browser context (OpenCode) shows no chip',
  );
  assert.equal(included({ removedForTurn: true }), false, 'the × removes the page from this turn');
}

function main() {
  testFirstUseDisclosureState();
  testClaudeIdentity();
  testCodexIdentityUsesPendingSelection();
  testRuntimeSwitchIgnoresStalePendingModel();
  testOpenCodeIdentity();
  testContextState();
  testBrowserContextFollowsShareConsent();
  console.log('AI disclosure tests passed.');
}

main();

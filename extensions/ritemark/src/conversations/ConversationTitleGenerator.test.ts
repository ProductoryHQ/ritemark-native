import assert from 'node:assert/strict';
import { ConversationTitleGenerator } from './ConversationTitleGenerator';
import type {
  AgentRuntime,
  RuntimeSession,
  RuntimeSessionConfig,
  RuntimeStatus,
  RuntimeTurnConfig,
} from '../runtime/AgentRuntime';

class FakeRuntime implements AgentRuntime {
  readonly id = 'codex' as const;
  disposed = false;
  config?: RuntimeSessionConfig;

  async createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession> {
    this.config = config;
    return {
      conversationId,
      agentId: this.id,
      prompt: async (_turn: RuntimeTurnConfig) => {
        config.onProgress({ type: 'text', message: 'Durable conversation title', timestamp: Date.now() });
        config.onCodexComplete?.({ status: 'completed' });
      },
      cancel: async () => undefined,
      respondToApproval: () => undefined,
      dispose: () => undefined,
    };
  }

  async getStatus(): Promise<RuntimeStatus> {
    return { ready: true, authState: 'authenticated', diagnostics: [] };
  }

  dispose(): void {
    this.disposed = true;
  }
}

async function run(): Promise<void> {
  const runtime = new FakeRuntime();
  const generator = new ConversationTitleGenerator(() => runtime);
  const title = await generator.generate({
    runtimeId: 'codex',
    workspacePath: '/fixtures/project',
    model: 'fixture-model',
    userPrompt: 'Build durable history',
    assistantResponse: 'Done',
  });

  assert.equal(title, 'Durable conversation title');
  assert.deepEqual(runtime.config?.allowedTools, []);
  assert.equal(runtime.config?.codexSandboxMode, 'read-only');
  assert.equal(runtime.disposed, true, 'the one-shot runtime is always released');
  console.log('ConversationTitleGenerator.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

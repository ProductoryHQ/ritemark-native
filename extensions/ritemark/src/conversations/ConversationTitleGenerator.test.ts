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
  turn?: RuntimeTurnConfig;

  async createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession> {
    this.config = config;
    return {
      conversationId,
      agentId: this.id,
      prompt: async (turn: RuntimeTurnConfig) => {
        this.turn = turn;
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

  // The title's language is the language of the prompt, not of "the user".
  // The Claude session behind this loads the person's own settings and skills;
  // "the user's language" let the model take the language from that context
  // (an English prompt titled in Estonian 4/8 times in the 2026-09-23 harness,
  // 0/16 with this wording, and an Estonian prompt still titled in Estonian 8/8).
  const system = runtime.config?.extraSystemPrompt ?? '';
  assert.match(system, /same language as the USER MESSAGE/, 'the system prompt names the USER MESSAGE as the language source');
  assert.match(system, /not the language of any other context/, 'and rules out every other source');
  assert.doesNotMatch(system, /user's language/i, 'never the ambiguous "user\'s language"');

  const prompt = runtime.turn?.prompt ?? '';
  assert.match(prompt, /same language as the USER MESSAGE/, 'the turn repeats the rule next to the text it refers to');
  const userAt = prompt.indexOf('USER MESSAGE:\nBuild durable history');
  const responseAt = prompt.indexOf('FIRST RESPONSE:\nDone');
  assert.ok(userAt > 0 && responseAt > userAt, 'the USER MESSAGE the rule points at is in the prompt, before the response');

  console.log('ConversationTitleGenerator.test.ts: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

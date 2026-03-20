import assert from 'node:assert/strict';
import {
  AgentSession,
  buildClaudeSystemAppend,
  buildClaudeTurnPrompt,
  DEFAULT_SETTING_SOURCES,
} from './AgentRunner';

async function testSynchronousPlanApprovalAnswer() {
  const session = new AgentSession({
    workspacePath: process.cwd(),
  }) as AgentSession & Record<string, unknown>;

  session._emitPlanApproval = (request: { toolUseId: string }) => {
    const answered = session.answerPlanApproval(request.toolUseId, true);
    assert.equal(answered, true, 'synchronous plan approval answer should be accepted');
  };

  const result = await session._handleCanUseTool(
    'ExitPlanMode',
    { allowedPrompts: [] },
    { signal: new AbortController().signal, toolUseID: 'plan-tool-1' }
  );

  assert.equal(result.behavior, 'allow');
  if (result.behavior === 'allow') {
    assert.deepEqual(result.updatedInput, { allowedPrompts: [] });
  }
}

async function testSynchronousQuestionAnswer() {
  const session = new AgentSession({
    workspacePath: process.cwd(),
  }) as AgentSession & Record<string, unknown>;

  const questionInput = {
    questions: [
      {
        header: 'Choice',
        question: 'Pick one',
        options: [
          { label: 'A', description: 'first' },
          { label: 'B', description: 'second' },
        ],
      },
    ],
  };

  session._emitQuestion = (question: { toolUseId: string; questions: Array<{ question: string }> }) => {
    const answered = session.answerQuestion(question.toolUseId, {
      [question.questions[0].question]: 'A',
    });
    assert.equal(answered, true, 'synchronous question answer should be accepted');
  };

  const result = await session._handleCanUseTool(
    'AskUserQuestion',
    questionInput,
    { signal: new AbortController().signal, toolUseID: 'question-tool-1' }
  );

  assert.equal(result.behavior, 'allow');
  if (result.behavior === 'allow') {
    assert.deepEqual(result.updatedInput, {
      ...questionInput,
      answers: {
        'Pick one': 'A',
      },
    });
  }
}

function testDefaultSettingSources() {
  const session = new AgentSession({
    workspacePath: process.cwd(),
  }) as AgentSession & Record<string, unknown>;

  assert.deepEqual(
    session._settingSources,
    DEFAULT_SETTING_SOURCES,
    'default setting sources should load user, project, and local Claude settings'
  );

  const customSession = new AgentSession({
    workspacePath: process.cwd(),
    settingSources: ['project'],
  }) as AgentSession & Record<string, unknown>;

  assert.deepEqual(
    customSession._settingSources,
    ['project'],
    'custom setting sources should be preserved'
  );
}

function testDefaultToolsIncludePlanAndQuestionLifecycle() {
  const session = new AgentSession({
    workspacePath: process.cwd(),
  }) as AgentSession & Record<string, unknown>;

  assert.ok(
    Array.isArray(session._allowedTools) && session._allowedTools.includes('AskUserQuestion'),
    'default tools should include AskUserQuestion'
  );
  assert.ok(
    Array.isArray(session._allowedTools) && session._allowedTools.includes('ExitPlanMode'),
    'default tools should include ExitPlanMode'
  );
}

function testClaudeLifecycleInstructionsAreIncluded() {
  const systemAppend = buildClaudeSystemAppend('/tmp/workspace', ['node_modules']);
  assert.match(systemAppend, /AskUserQuestion/, 'system append should mention AskUserQuestion');
  assert.match(systemAppend, /ExitPlanMode/, 'system append should mention ExitPlanMode');

  const turnPrompt = buildClaudeTurnPrompt('User prompt');
  assert.match(turnPrompt, /Ritemark lifecycle contract/, 'turn prompt should include lifecycle reminder');
  assert.match(turnPrompt, /User prompt$/, 'turn prompt should preserve original prompt');
}

async function main() {
  testDefaultSettingSources();
  testDefaultToolsIncludePlanAndQuestionLifecycle();
  testClaudeLifecycleInstructionsAreIncluded();
  await testSynchronousPlanApprovalAnswer();
  await testSynchronousQuestionAnswer();
  console.log('AgentRunner lifecycle tests passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

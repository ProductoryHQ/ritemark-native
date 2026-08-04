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

  const planMarkdown = '## Plan\n\n1. First step\n2. Second step';

  session._emitPlanApproval = (request: { toolUseId: string; plan?: string }) => {
    assert.equal(
      request.plan,
      planMarkdown,
      'approval request should carry the plan markdown from ExitPlanMode input.plan'
    );
    const answered = session.answerPlanApproval(request.toolUseId, true);
    assert.equal(answered, true, 'synchronous plan approval answer should be accepted');
  };

  const result = await session._handleCanUseTool(
    'ExitPlanMode',
    { allowedPrompts: [], plan: planMarkdown },
    { signal: new AbortController().signal, toolUseID: 'plan-tool-1' }
  );

  assert.equal(result.behavior, 'allow');
  if (result.behavior === 'allow') {
    assert.deepEqual(result.updatedInput, { allowedPrompts: [], plan: planMarkdown });
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
  // Sprint 103 R2/R4 (audit F4): NO ExitPlanMode nudges outside native plan
  // mode — the always-on reminder made Claude plan autonomously in Auto mode.
  assert.doesNotMatch(systemAppend, /ExitPlanMode/, 'system append must NOT nudge ExitPlanMode');
  assert.doesNotMatch(systemAppend, /plan mode/i, 'system append must NOT mention plan mode');

  const turnPrompt = buildClaudeTurnPrompt('User prompt');
  assert.match(turnPrompt, /Ritemark lifecycle contract/, 'turn prompt should include lifecycle reminder');
  assert.doesNotMatch(turnPrompt, /ExitPlanMode/, 'turn reminder must NOT nudge ExitPlanMode');
  assert.match(turnPrompt, /User prompt$/, 'turn prompt should preserve original prompt');
}

/**
 * Regression: the model can emit several tool_use blocks in ONE assistant message
 * (two Writes in Ask mode, say), so canUseTool is invoked concurrently. When the
 * three pending-decision slots were scalars, the second invocation overwrote the
 * first, leaving that promise with no resolver — the tool call hung until the
 * 15-minute inactivity timeout. Both must now resolve independently.
 */
async function testConcurrentToolApprovalsBothResolve() {
  const session = new AgentSession({
    workspacePath: process.cwd(),
    approvalMode: 'ask',
  }) as AgentSession & Record<string, unknown>;

  const seen: string[] = [];
  session._emitToolApproval = (request: { toolUseId: string }) => {
    seen.push(request.toolUseId);
  };

  // Two approvals in flight at once — neither answered yet.
  const first = session._handleCanUseTool(
    'Write',
    { file_path: '/tmp/a.md', content: 'a' },
    { signal: new AbortController().signal, toolUseID: 'tool-a' }
  );
  const second = session._handleCanUseTool(
    'Write',
    { file_path: '/tmp/b.md', content: 'b' },
    { signal: new AbortController().signal, toolUseID: 'tool-b' }
  );

  await new Promise((r) => setImmediate(r));
  assert.deepEqual(seen, ['tool-a', 'tool-b'], 'both approvals should have been emitted');

  // Answer out of order — the second request must not have displaced the first.
  assert.equal(session.answerToolApproval('tool-b', true), true, 'second approval still pending');
  assert.equal(session.answerToolApproval('tool-a', false), true, 'first approval still pending');

  const firstResult = await first;
  const secondResult = await second;

  assert.equal(firstResult.behavior, 'deny', 'tool-a was denied');
  assert.equal(secondResult.behavior, 'allow', 'tool-b was allowed');
}

// ── Sprint 103 (R1/R2/R3) — two-axis policy + native plan mode ──────────────

function testSprint103ModeMapping() {
  // Legacy 'plan' normalizes to auto + planFirst (R1/R8 migration).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = new AgentSession({ workspacePath: process.cwd(), approvalMode: 'plan' }) as any;
  assert.equal(legacy._approvalMode, 'auto', "legacy 'plan' → autonomy auto");
  assert.equal(legacy._planFirst, true, "legacy 'plan' → planFirst on");
  assert.equal(legacy._sdkModeFor(), 'plan', 'planFirst → SDK plan mode');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = new AgentSession({ workspacePath: process.cwd() }) as any;
  assert.equal(s._sdkModeFor(), 'acceptEdits', "auto → SDK acceptEdits (NEVER bypassPermissions — audit F6)");
  s.setApprovalMode('ask');
  assert.equal(s._sdkModeFor(), 'default', 'ask → SDK default');
  s.setApprovalMode('auto', true);
  assert.equal(s._sdkModeFor(), 'plan', 'auto + planFirst → SDK plan');
}

async function testSprint103PlanPhaseMutatingDenied() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = new AgentSession({ workspacePath: process.cwd(), approvalMode: 'auto', planFirst: true }) as any;
  const res = await s._handleCanUseTool(
    'Write',
    { file_path: '/tmp/x.md' },
    { signal: new AbortController().signal, toolUseID: 'toolu_plan_write' },
  );
  assert.equal(res.behavior, 'deny', 'R2: mutating tool denied during plan phase');
  assert.match(res.message, /plan/i, 'denial explains the plan phase');
}

async function testSprint103AutoModeAllowsFallthrough() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = new AgentSession({ workspacePath: process.cwd(), approvalMode: 'auto' }) as any;
  const res = await s._handleCanUseTool(
    'Bash',
    { command: 'echo hi' },
    { signal: new AbortController().signal, toolUseID: 'toolu_auto_bash' },
  );
  assert.equal(res.behavior, 'allow', 'auto keeps acting without prompts via canUseTool auto-allow');
}

async function testSprint103ExitPlanModeApprovalCarriesModeSwitch() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = new AgentSession({ workspacePath: process.cwd(), approvalMode: 'auto', planFirst: true }) as any;
  s._emitPlanApproval = (req: { toolUseId: string }) => {
    setTimeout(() => s.answerPlanApproval(req.toolUseId, true), 5);
  };
  const res = await s._handleCanUseTool(
    'ExitPlanMode',
    { plan: '# Plan' },
    { signal: new AbortController().signal, toolUseID: 'toolu_epm' },
  );
  assert.equal(res.behavior, 'allow');
  assert.deepEqual(
    res.updatedPermissions,
    [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }],
    'R2: approval moves the session into the autonomy mode in the same response',
  );
  assert.equal(s._planFirst, false, 'plan-first clears on approval (D2)');
  assert.ok(typeof s._turnWaitedMs === 'number' && s._turnWaitedMs >= 0, 'R7: wait time tracked');
}

async function testSprint103KeepPlanningFeedbackDeny() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = new AgentSession({ workspacePath: process.cwd(), approvalMode: 'auto', planFirst: true }) as any;
  s._emitPlanApproval = (req: { toolUseId: string }) => {
    setTimeout(() => s.answerPlanApproval(req.toolUseId, false, 'two files, not three'), 5);
  };
  const res = await s._handleCanUseTool(
    'ExitPlanMode',
    { plan: '# Plan' },
    { signal: new AbortController().signal, toolUseID: 'toolu_epm2' },
  );
  assert.equal(res.behavior, 'deny');
  assert.equal(res.message, 'two files, not three', 'feedback rides the deny message');
  assert.equal(s._planFirst, true, 'plan-first STAYS on after Keep planning (D2)');
}

async function main() {
  testDefaultSettingSources();
  testDefaultToolsIncludePlanAndQuestionLifecycle();
  testClaudeLifecycleInstructionsAreIncluded();
  await testSynchronousPlanApprovalAnswer();
  await testSynchronousQuestionAnswer();
  await testConcurrentToolApprovalsBothResolve();
  testSprint103ModeMapping();
  await testSprint103PlanPhaseMutatingDenied();
  await testSprint103AutoModeAllowsFallthrough();
  await testSprint103ExitPlanModeApprovalCarriesModeSwitch();
  await testSprint103KeepPlanningFeedbackDeny();
  console.log('AgentRunner lifecycle tests passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Sprint 103 Phase 0 spike — verify native plan-mode behavior of the bundled
 * Claude Agent SDK (0.3.217 / CLI 2.1.217) before implementation (R2, R3).
 *
 * Asserts:
 *  A. permissionMode:'plan' → ExitPlanMode reaches canUseTool on the FIRST call
 *  B. Mutating tools (Write/Edit/Bash-write) reach canUseTool during planning
 *     and a deny does not kill the turn
 *  C. Approving ExitPlanMode with updatedPermissions [{type:'setMode',
 *     mode:'acceptEdits', destination:'session'}] lets execution continue in
 *     the same turn WITHOUT further write prompts
 *  D. (follow-up turn) conversation memory survives; setPermissionMode works
 *
 * Run from repo root:
 *   node docs/development/releases/v1.8.6/sprint-103-agent-truth/research/spikes/sdk-plan-mode-spike.mjs
 */
import { mkdtempSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXT = resolve(import.meta.dirname, '../../../../../../..', 'extensions/ritemark');
const { query } = await import(join(EXT, 'node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs'));

// Bundled CLI (same resolution the app uses: binaries/agents manifest)
const cliCandidates = [
  join(EXT, 'binaries/agents/claude/claude'),
  join(EXT, 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js'),
];
const pathToClaudeCodeExecutable = cliCandidates.find(p => existsSync(p));

const ws = mkdtempSync(join(tmpdir(), 's103-spike-'));
writeFileSync(join(ws, 'notes.md'), '# Notes\n\nSpike fixture.\n');

const log = (...a) => console.log('[spike]', ...a);
const results = { A: null, B: null, C: null, D: null };
const canUseToolCalls = [];
let planApproved = false;
let denyCount = 0;

async function canUseTool(toolName, input, { toolUseID }) {
  canUseToolCalls.push(toolName);
  log('canUseTool:', toolName, toolUseID);
  if (toolName === 'ExitPlanMode') {
    results.A = 'PASS — ExitPlanMode reached canUseTool';
    planApproved = true;
    return {
      behavior: 'allow',
      updatedInput: input,
      updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }],
    };
  }
  const mutating = ['Write', 'Edit', 'NotebookEdit'].includes(toolName)
    || (toolName === 'Bash' && /touch|rm |mv |cp |>|tee/.test(String(input?.command ?? '')));
  if (mutating && !planApproved) {
    denyCount++;
    results.B = `PASS — mutating ${toolName} reached canUseTool during planning; denied`;
    return { behavior: 'deny', message: 'Spike: plan phase, no writes before approval.' };
  }
  return { behavior: 'allow', updatedInput: input };
}

let releaseTurn2;
const turn2Gate = new Promise(r => { releaseTurn2 = r; });

const q = query({
  prompt: (async function* () {
    yield { type: 'user', message: { role: 'user', content: [{ type: 'text', text:
      'First try to create a file called sneaky.md with content "early write test" using the Write tool RIGHT NOW before planning. Then plan: add a "## Summary" section to notes.md. Present the plan for approval, and after approval actually make the notes.md change.' }] },
      parent_tool_use_id: null };
    await turn2Gate;
    yield { type: 'user', message: { role: 'user', content: [{ type: 'text', text:
      'Without using any tools: what section heading did your approved plan add to notes.md? One sentence.' }] },
      parent_tool_use_id: null };
  })(),
  options: {
    cwd: ws,
    ...(pathToClaudeCodeExecutable ? { pathToClaudeCodeExecutable } : {}),
    permissionMode: 'plan',
    planModeInstructions: 'Spike plan voice: plan the markdown change briefly, then request plan approval.',
    allowedTools: ['Read', 'Glob', 'Grep'],   // NOTE: no ExitPlanMode, no mutating tools
    canUseTool,
    settingSources: [],
    systemPrompt: { type: 'preset', preset: 'claude_code' },
  },
});

let resultCount = 0;
const timer = setTimeout(() => { log('TIMEOUT'); process.exit(2); }, 300000);

for await (const msg of q) {
  if (msg.type === 'system' && msg.subtype === 'init') log('init model:', msg.model);
  if (msg.type === 'assistant') {
    const blocks = (msg.message?.content ?? []).map(b => b.type === 'tool_use' ? `tool:${b.name}` : b.type);
    log('assistant:', blocks.join(','));
  }
  if (msg.type === 'result') {
    resultCount++;
    log('result', resultCount, msg.subtype, `${msg.duration_ms}ms`);
    if (resultCount === 1) {
      // Verify turn-1 outcomes
      const files = readdirSync(ws);
      const sneakyBlocked = !files.includes('sneaky.md') || denyCount > 0;
      const summaryWritten = files.includes('notes.md');
      results.C = planApproved
        ? `after-approval continuation: files=${JSON.stringify(files)}, denies=${denyCount}, sneakyBlocked=${sneakyBlocked}`
        : 'FAIL — plan never approved';
      // Turn 2: memory + setPermissionMode check
      await q.setPermissionMode('default');
      releaseTurn2();
    } else {
      results.D = `turn-2 answer (memory check): ${String(msg.result).slice(0, 200)}`;
      break;
    }
  }
}
clearTimeout(timer);

log('=== RESULTS ===');
for (const [k, v] of Object.entries(results)) log(k, '→', v);
log('canUseTool sequence:', canUseToolCalls.join(' → '));
log('workspace:', ws, readdirSync(ws));

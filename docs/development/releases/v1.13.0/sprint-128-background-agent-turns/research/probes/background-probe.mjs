// Sprint 128 Phase 0 probe: what does the bundled Claude Code (SDK streaming-input mode) emit when
// Claude runs a subagent in the background? Records every SDK message with a timestamp to JSONL.
//
//   node background-probe.mjs --mode p1|p3|p6|p6stop --out <file.jsonl> [--model sonnet]
//
// p1      launch one background subagent, keep the input open, record until idle after the follow-up.
// p3      as p1, and send a human prompt (origin: human) as soon as the follow-up turn starts.
// p6      perTaskStopAffordance: true; interrupt() while the background task runs: does it survive?
// p6stop  perTaskStopAffordance: true; stopTask(taskId) on the running task.
//
// Uses the caller's own Claude login (real credentials) and the CLI/SDK Ritemark bundles. Runs in a
// throwaway working directory with bypassPermissions; the only command the prompt asks for is sleep/echo.
// Run from extensions/ritemark so the SDK resolves from its node_modules.

import { mkdtempSync, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const mode = args.mode ?? 'p1';
const out = resolve(args.out ?? `probe-${mode}.jsonl`);
const root = resolve(args.root ?? '.');
const sdk = await import(pathToFileURL(join(root, 'node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs')).href);
const cli = join(root, 'binaries/agents/darwin-arm64/claude');
const cwd = mkdtempSync(join(tmpdir(), 's128-probe-'));
writeFileSync(out, '');

const t0 = Date.now();
const log = (kind, data) => appendFileSync(out, JSON.stringify({ t: Date.now() - t0, kind, ...data }) + '\n');

// Input queue that stays open until we end it.
const queue = [];
let wake = null;
let ended = false;
const push = (msg) => { queue.push(msg); wake?.(); };
async function* input() {
  while (!ended) {
    if (queue.length) { const m = queue.shift(); log('sent', { message: m }); yield m; continue; }
    await new Promise((r) => (wake = r));
    wake = null;
  }
}
const userMessage = (text, extra = {}) => ({
  type: 'user', session_id: '', parent_tool_use_id: null,
  message: { role: 'user', content: [{ type: 'text', text }] }, origin: { kind: 'human' }, ...extra,
});

const prompt =
  'Launch exactly one general-purpose subagent with the Agent tool and run_in_background: true. ' +
  'Its only job: run the Bash command `sleep 25; echo BG-DONE` and report the output. ' +
  'After launching it, reply exactly "launched" and end your turn without waiting. ' +
  'When it later finishes, reply "final: " followed by its output.';

const q = sdk.query({
  prompt: input(),
  options: {
    cwd,
    pathToClaudeCodeExecutable: cli,
    model: args.model ?? 'sonnet',
    settingSources: [],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    ...(mode.startsWith('p6') ? { perTaskStopAffordance: true } : {}),
  },
});

push(userMessage(prompt));

let results = 0;
let backgroundTaskId = null;
let sentDuringFollowUp = false;
let followUpStarted = false;
let taskSettled = false;
let liveCount = -1;
const deadline = setTimeout(() => finish('deadline'), 180_000);

function finish(reason) {
  log('finish', { reason });
  ended = true; wake?.();
  clearTimeout(deadline);
  setTimeout(() => { q.close(); process.exit(0); }, 500);
}

for await (const message of q) {
  const summary = { type: message.type, subtype: message.subtype, origin: message.origin };
  log('msg', { summary, message });

  if (message.type === 'system' && message.subtype === 'task_started' && !backgroundTaskId) {
    backgroundTaskId = message.task_id;
    if (mode === 'p6') setTimeout(async () => { log('action', { interrupt: true }); await q.interrupt(); }, 4000);
    if (mode === 'p6stop') setTimeout(async () => { log('action', { stopTask: backgroundTaskId }); await q.stopTask(backgroundTaskId); }, 4000);
  }
  // A follow-up turn opened by the runtime: either a user message with that origin, or the first
  // assistant message after the first result.
  // Phase 0 (P1): no user message carries the origin; the runtime's turn opens with a fresh
  // `system:init` after a result. A subagent's own messages (parent_tool_use_id set) never count.
  const startsFollowUp =
    (message.type === 'user' && message.origin && message.origin.kind !== 'human') ||
    (results >= 1 && message.type === 'system' && message.subtype === 'init') ||
    (results >= 1 && message.type === 'assistant' && !message.parent_tool_use_id);
  if (startsFollowUp && !followUpStarted) {
    followUpStarted = true;
    log('mark', { followUpStart: true, via: message.type });
    if (mode === 'p3' && !sentDuringFollowUp) {
      sentDuringFollowUp = true;
      push(userMessage('Reply exactly "human-reply".'));
    }
  }
  if (message.type === 'result') results += 1;
  if (message.type === 'system' && message.subtype === 'background_tasks_changed') liveCount = message.tasks.length;
  // session_state_changed is not emitted by default (Phase 0 P1), so "all finished" is a result with
  // an empty live set after the background task settled.
  if (message.type === 'result' && liveCount === 0 && taskSettled && results >= (mode === 'p3' ? 3 : 2)) finish('result-with-empty-live-set');
  if (mode.startsWith('p6') && taskSettled && liveCount === 0 && message.type === 'result') finish('p6-settled');
  if (message.type === 'system' && message.subtype === 'task_notification' && message.task_id === backgroundTaskId) taskSettled = true;
  if (message.type === 'system' && message.subtype === 'session_state_changed' && message.state === 'idle') {
    const needed = mode === 'p3' ? 3 : 2;
    if (results >= needed && taskSettled) finish('idle');
  }
}
finish('stream-ended');

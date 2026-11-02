/**
 * Sprint 152 (R5, #624): the AI view's own turning mark, timed from the column's first frame.
 * Run: npx tsx src/views/aiStartingMark.test.ts
 */

import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import {
  AI_STARTING_MARK_ID,
  AI_STARTING_WORDS,
  aiColumnShownSince,
  aiStartingMarkBody,
  aiStartingMarkHead,
  SHELL_LOOK_SINCE_COMMAND,
  SHELL_LOOK_SINCE_WAIT_MS,
  shellLookSince,
} from './aiStartingMark';

// The column's first frame: a view resolved as part of the start counts from the extension host's start; one resolved
// later (the person opened the column) counts from its own resolve.
assert.equal(aiColumnShownSince({ extensionHostStartedAt: 1_000, activatedAt: 1_600, resolvedAt: 1_700 }), 1_000);
assert.equal(aiColumnShownSince({ extensionHostStartedAt: 1_000, activatedAt: 11_000, resolvedAt: 11_100 }), 1_000, 'a held extension host: the shell\'s mark has shown for ten seconds');
assert.equal(aiColumnShownSince({ extensionHostStartedAt: 1_000, activatedAt: 1_600, resolvedAt: 30_000 }), 30_000, 'a column opened half a minute later starts its own second');
assert.equal(aiColumnShownSince({ extensionHostStartedAt: 5_000, activatedAt: 4_000, resolvedAt: 4_100 }), 4_100, 'never later than the resolve');

/** Runs the head's script against a stand-in page at `now`, and returns the two times it sets. */
function timing(columnShownSince: number, now: number): { wait: string; turn: string } {
  const head = aiStartingMarkHead('n0nce', columnShownSince);
  const script = head.match(/<script nonce="n0nce">([\s\S]*)<\/script>/)?.[1];
  assert.ok(script, 'the head carries one script, with the page\'s nonce');
  const set: Record<string, string> = {};
  runInNewContext(script, {
    Date: { now: () => now },
    Math,
    document: { documentElement: { style: { setProperty: (name: string, value: string) => { set[name] = value; } } } },
  });
  return { wait: set['--rm-ai-starting-wait'], turn: set['--rm-ai-starting-turn'] };
}

// The shell's mark had not shown yet: the view's waits for the rest of the second, and starts turning when it shows.
assert.deepEqual(timing(10_000, 10_300), { wait: '700ms', turn: '700ms' });
// The shell's mark was showing: the view's shows at once, turned to where the shell's is (it started at 11 000).
assert.deepEqual(timing(10_000, 13_250), { wait: '0ms', turn: '-250ms' });
assert.deepEqual(timing(10_000, 11_000), { wait: '0ms', turn: '0ms' });

// The same ring as patch 018's, with the same words, and nothing that turns under Reduce motion.
const head = aiStartingMarkHead('n0nce', 0);
for (const rule of ['width: 16px', 'height: 16px', 'margin: -8px 0 0 -8px', 'border: 1.5px solid var(--vscode-input-border)', 'border-top-color: var(--vscode-foreground)', 'top: 50%', 'left: 50%']) {
  assert.ok(head.includes(rule), `the mark has ${rule}`);
}
assert.match(head, /body\.vscode-reduce-motion \.rm-ai-starting \{\s*animation: rm-ai-starting-show [^;]*forwards;\s*\}/);
assert.equal(aiStartingMarkBody(), `<div id="${AI_STARTING_MARK_ID}" class="rm-ai-starting" role="status" aria-label="${AI_STARTING_WORDS}"></div>`);
assert.equal(AI_STARTING_WORDS, 'The AI is starting');

// W5: the shell hands over when the column's slot began to wait; anything else leaves the host's estimate standing.
void (async () => {
  const asked: unknown[][] = [];
  assert.equal(await shellLookSince(async (...args) => { asked.push(args); return 12_345; }, 'ritemark.unifiedView'), 12_345);
  assert.deepEqual(asked, [[SHELL_LOOK_SINCE_COMMAND, 'ritemark.unifiedView']]);
  assert.equal(SHELL_LOOK_SINCE_COMMAND, '_ritemark.loadingLook.since', 'the command patch 002 registers');
  assert.equal(await shellLookSince(async () => { throw new Error('command \'_ritemark.loadingLook.since\' not found'); }, 'v'), undefined, 'an older shell');
  for (const answer of [undefined, null, '12', Number.NaN, 0, -5]) {
    assert.equal(await shellLookSince(async () => answer, 'v'), undefined, `no moment in ${String(answer)}`);
  }
  const startedAt = Date.now();
  assert.equal(await shellLookSince(() => new Promise(() => undefined), 'v'), undefined, 'a shell that doesn\'t answer');
  assert.ok(Date.now() - startedAt >= SHELL_LOOK_SINCE_WAIT_MS - 5, 'it waits for the shell a moment before the estimate stands in');

  console.log('views/aiStartingMark: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

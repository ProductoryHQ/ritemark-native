/**
 * Two ways a colour silently disappears from the webview:
 *
 *  1. `var(--r-something)` that no stylesheet defines. The property falls back to
 *     nothing: the Agent Chat "Try again" buttons used `--r-indigo-600`, drew no
 *     background, and left white text on a light card.
 *  2. A Tailwind opacity modifier on a CSS-variable colour, `bg-[var(--x)]/60`.
 *     Tailwind 3 cannot apply an alpha to a variable and emits no rule at all, so
 *     the element has no background. Use
 *     `bg-[color:color-mix(in_srgb,var(--x)_60%,transparent)]` instead.
 *
 * Run: npx tsx webview/src/theme/cssTokens.test.ts
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function* sources(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(full);
    else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield full;
  }
}

const defined = new Set<string>();
const used = new Map<string, Set<string>>();
const opacityOnVariables: string[] = [];

for (const file of sources(root)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  for (const m of text.matchAll(/(--r-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  for (const m of text.matchAll(/['"](--r-[a-z0-9-]+)['"]\s*[,:]/g)) defined.add(m[1]);
  for (const m of text.matchAll(/var\((--r-[a-z0-9-]+)/g)) {
    // A name built at runtime (`--r-conversation-${n}`) ends in a dash here.
    if (m[1].endsWith('-')) continue;
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1])!.add(rel);
  }
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    for (const m of text.matchAll(/[a-z-]+-\[var\(--[a-z0-9-]+\)\]\/\d+/g)) opacityOnVariables.push(`${rel}: ${m[0]}`);
  }
}

const undefinedTokens = [...used].filter(([name]) => !defined.has(name)).map(([name, files]) => `${name} (${[...files].join(', ')})`);
assert.deepEqual(undefinedTokens, [], `colour tokens used but never defined:\n  ${undefinedTokens.join('\n  ')}`);
assert.deepEqual(opacityOnVariables, [], `Tailwind emits nothing for an opacity modifier on a variable:\n  ${opacityOnVariables.join('\n  ')}`);
assert.ok(used.size > 20 && defined.size > 20, 'the scan found the webview sources');

console.log(`cssTokens.test.ts: all passed (${used.size} tokens used, all defined)`);

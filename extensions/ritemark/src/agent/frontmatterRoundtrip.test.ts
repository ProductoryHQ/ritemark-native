/**
 * Regression test: nested-object frontmatter (e.g. `schedule:`) must survive a
 * full serialize → daemon-parse → editor-reparse → re-serialize round-trip.
 * Run: npx tsx src/agent/frontmatterRoundtrip.test.ts
 */
import * as assert from 'assert';
import { serializeFrontmatter, parseFrontmatterFromText } from './discovery';
import { parseScheduleFromFrontmatter } from '../daemon/scheduleParser';

const fm: Record<string, unknown> = {
  description: 'a test agent',
  tools: ['Read', 'Write'],
  schedule: { cron: '0 9 * * 1-5', label: 'Daily brief', enabled: true },
};

const yaml = serializeFrontmatter(fm as never);
const doc = yaml + '\n\nAgent body.';

// 1. Serializer must NOT collapse the object to "[object Object]".
assert.ok(!yaml.includes('[object Object]'), 'object must not stringify to [object Object]');

// 2. The daemon's dedicated parser must find the schedule block.
assert.deepStrictEqual(
  parseScheduleFromFrontmatter(doc),
  { cron: '0 9 * * 1-5', label: 'Daily brief', enabled: true },
  'daemon parse'
);

// 3. The editor's general reader must reconstruct the nested object.
const back = parseFrontmatterFromText(doc);
assert.deepStrictEqual(
  back.schedule,
  { cron: '0 9 * * 1-5', label: 'Daily brief', enabled: true },
  'editor round-trip'
);
assert.deepStrictEqual(back.tools, ['Read', 'Write'], 'array preserved');
assert.strictEqual(back.description, 'a test agent', 'scalar preserved');

// 4. Re-serializing the read-back value must be byte-stable (no 2nd-save corruption).
assert.strictEqual(serializeFrontmatter(back), yaml, 'stable on re-save');

// 5. A schedule with enabled:false round-trips too.
const yaml2 = serializeFrontmatter({ schedule: { cron: '0 0 * * *', label: '', enabled: false } } as never);
assert.strictEqual(parseFrontmatterFromText(yaml2 + '\n\nx').schedule
  ? (parseFrontmatterFromText(yaml2 + '\n\nx').schedule as Record<string, unknown>).enabled
  : undefined, false, 'enabled:false preserved');

console.log('✅ All frontmatter round-trip tests passed!');

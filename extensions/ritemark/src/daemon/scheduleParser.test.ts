/**
 * Unit tests for parseScheduleFromFrontmatter.
 * Run: npx tsx src/daemon/scheduleParser.test.ts
 */
import * as assert from 'assert';
import { parseScheduleFromFrontmatter } from './scheduleParser';

function fm(body: string): string {
  return `---\n${body}\n---\n\nAgent prompt body here.`;
}

// No frontmatter at all → undefined
assert.strictEqual(parseScheduleFromFrontmatter('no frontmatter'), undefined);

// Frontmatter without a schedule block → undefined
assert.strictEqual(
  parseScheduleFromFrontmatter(fm('description: a test agent')),
  undefined
);

// Full block-style schedule
{
  const result = parseScheduleFromFrontmatter(
    fm('schedule:\n  cron: "0 9 * * 1-5"\n  label: "Daily brief"\n  enabled: true')
  );
  assert.deepStrictEqual(result, { cron: '0 9 * * 1-5', label: 'Daily brief', enabled: true });
}

// enabled defaults to true when omitted
{
  const result = parseScheduleFromFrontmatter(fm('schedule:\n  cron: "*/5 * * * *"'));
  assert.deepStrictEqual(result, { cron: '*/5 * * * *', label: '', enabled: true });
}

// enabled: false is respected
{
  const result = parseScheduleFromFrontmatter(
    fm('schedule:\n  cron: "0 0 * * *"\n  enabled: false')
  );
  assert.strictEqual(result?.enabled, false);
}

// Missing cron → undefined (cron is required)
assert.strictEqual(
  parseScheduleFromFrontmatter(fm('schedule:\n  label: "no cron"\n  enabled: true')),
  undefined
);

// Invalid cron (wrong field count) → undefined
assert.strictEqual(
  parseScheduleFromFrontmatter(fm('schedule:\n  cron: "0 9 * *"')),
  undefined
);

// Unquoted cron value is accepted
{
  const result = parseScheduleFromFrontmatter(fm('schedule:\n  cron: 30 14 * * *'));
  assert.strictEqual(result?.cron, '30 14 * * *');
}

// CRLF line endings are handled
{
  const result = parseScheduleFromFrontmatter(
    '---\r\nschedule:\r\n  cron: "0 9 * * *"\r\n---\r\nbody'
  );
  assert.strictEqual(result?.cron, '0 9 * * *');
}

console.log('✅ All scheduleParser tests passed!');

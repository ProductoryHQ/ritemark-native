import { strict as assert } from 'node:assert';
import { isKeyPreview, matchesKeyPreview, previewKey } from './keyPreview';

for (const prefix of ['sk-ant-', 'sk-proj-', 'sk-', 'ghp_', 'github_pat_', 'AKIA', 'AIza', 'xoxb-', 'abc']) {
  const fixture = prefix + 'fixture-only-' + '7f3a';
  const preview = `${prefix}…7f3a`;
  assert.equal(previewKey(fixture), preview);
  assert.equal(isKeyPreview(preview), true);
  assert.equal(matchesKeyPreview(fixture, preview), true, 'Show it accepts the current scan location');
  assert.equal(matchesKeyPreview(fixture.slice(0, -1) + 'b', preview), false, 'Show it rejects a changed location');
}
assert.equal(previewKey('abc12345678'), undefined);
assert.equal(previewKey('abc123456789'), undefined, 'a 12-character password would show 7 of its 12 characters');
assert.equal(previewKey('abc1234567890123456'), undefined, 'a key of no known kind needs 20 characters');
assert.equal(previewKey('abc12345678901236789'), 'abc…6789');
assert.equal(previewKey('sk-ant-123456789012345'), undefined, 'a known kind needs 16 characters after its prefix');
assert.equal(previewKey('sk-ant-1234567890127f3a'), 'sk-ant-…7f3a');
assert.equal(previewKey('github_pat_1234'), undefined, 'the shown pieces must leave a hidden middle');
assert.equal(matchesKeyPreview('abc123456789', 'a…9'), true, 'an already-stored pause still works');
assert.equal(isKeyPreview('longer…preview'), false);
console.log('keyPreview: all passed');

/**
 * Sprint 118 R8 — the direct-recording flag.
 *
 * Experimental with a default-true setting (HARD RULE #2: on by default, a
 * real kill switch), on every platform Transcribe runs on — Windows included.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { FLAGS } from '../../features/flags';

function run(): void {
  const flag = FLAGS['transcribe-direct-recording'];
  assert.ok(flag, 'the flag is registered');
  assert.equal(flag.id, 'transcribe-direct-recording');
  assert.equal(flag.status, 'experimental', 'a user-visible kill switch');
  assert.deepEqual([...flag.platforms].sort(), [...FLAGS['transcription-workbench'].platforms].sort(), 'wherever Transcribe runs');
  assert.ok(flag.description.trim().length > 0);

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'));
  const setting = (manifest.contributes.configuration as Array<{ properties?: Record<string, { default?: unknown }> }>)
    .flatMap((section) => Object.entries(section.properties ?? {}))
    .find(([key]) => key === 'ritemark.features.transcribe-direct-recording');
  assert.ok(setting, 'the kill switch is a real setting');
  assert.equal(setting[1].default, true, 'on by default');

  console.log('recordingFlag.test.ts: all tests passed');
}

run();

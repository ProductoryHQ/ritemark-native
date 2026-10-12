/**
 * Sprint 108 R13 — the transcription feature flag.
 *
 * The point of this test is the platform list. `voice-dictation` runs where the
 * Whisper binary ships (macOS and Windows since Sprint 129); Transcribe also runs
 * on Linux, because ElevenLabs works everywhere and the engine registry reports
 * the on-device gap honestly (D4). Copying `voice-dictation`'s platform list here
 * would silently remove the whole feature from Linux.
 */
import assert from 'node:assert/strict';
import { FLAGS } from '../features/flags';

async function run(): Promise<void> {
  const flag = FLAGS['transcription-workbench'];

  assert.ok(flag, 'the flag is registered');
  assert.equal(flag.id, 'transcription-workbench', 'id matches its registry key');

  assert.deepEqual(
    [...flag.platforms].sort(),
    ['darwin', 'linux', 'win32'],
    'every platform: only the ON-DEVICE engine is missing on Linux, and the manifest claims audio extensions unconditionally',
  );

  assert.notDeepEqual(
    [...flag.platforms].sort(),
    [...FLAGS['voice-dictation'].platforms].sort(),
    'deliberately broader than voice-dictation; if these ever match, Linux lost the feature',
  );

  // Sprint 129 (#133): dictation ships on Windows, on by default.
  const dictation = FLAGS['voice-dictation'];
  assert.deepEqual([...dictation.platforms].sort(), ['darwin', 'win32'], 'dictation runs where the whisper binary ships');
  assert.equal(dictation.status, 'stable', 'dictation is on by default (HARD RULE #2)');
  assert.ok(!/macOS only/i.test(dictation.description), 'the description no longer says macOS only');

  // HARD RULE #2: features are ON by default. `stable` is hardcoded-true in the
  // gate, which is what "on by default, code-level kill-switch" means here.
  assert.equal(flag.status, 'stable', 'shipped on by default');

  assert.ok(flag.label.trim().length > 0, 'has a label');
  assert.ok(flag.description.trim().length > 0, 'has a description');
  assert.ok(
    /ElevenLabs|on-device|Whisper/i.test(flag.description),
    'the description names the engines, since the flag list is a real audit surface',
  );

  console.log('transcriptionFlag.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

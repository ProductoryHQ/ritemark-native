/**
 * Sprint 108 R13 — the transcription feature flag.
 *
 * The point of this test is the platform list. `voice-dictation` is macOS-only
 * because the Whisper binary is; Transcribe is NOT, because ElevenLabs works
 * everywhere and the engine registry reports the on-device gap honestly (D4).
 * Copying `voice-dictation`'s platform list here would silently remove the
 * whole feature from Windows.
 */
import assert from 'node:assert/strict';
import { FLAGS } from '../features/flags';

async function run(): Promise<void> {
  const flag = FLAGS['transcription-workbench'];

  assert.ok(flag, 'the flag is registered');
  assert.equal(flag.id, 'transcription-workbench', 'id matches its registry key');

  assert.deepEqual(
    [...flag.platforms].sort(),
    ['darwin', 'win32'],
    'Transcribe ships on Windows — only the on-device engine is macOS-only (#133)',
  );

  assert.notDeepEqual(
    [...flag.platforms].sort(),
    [...FLAGS['voice-dictation'].platforms].sort(),
    'deliberately broader than voice-dictation; if these ever match, Windows lost the feature',
  );

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

#!/usr/bin/env node
// Sprint 129 (Windows test, bug C): run dictation's two silence checks over real
// speech, to show that quiet speech never counts as a muted microphone.
//
//   live: dictationLevel.ts reachesLiveLevel() on the first 3 s (the webview stops
//         a recording that stays below -80 dBFS that long)
//   host: controller.ts audioLevel() on the whole file and on 6 s pieces (fewer
//         than 3 frames above -65 dBFS = silence, never sent to whisper)
//
// Run with tsx: npx --yes tsx@4.21.0 scripts/qa/dictation-level-check.mjs <dir with .wav files> [more .wav files]
// The FLEURS clip pack comes from scripts/qa/fleurs-clip-pack.mjs (or the
// whisper-bench-audio-et CI artifact). Files must be 16 kHz mono 16-bit WAV.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { audioLevel, parsePcmWav } = await import(path.join(root, 'extensions/ritemark/src/voiceDictation/controller.ts'));
const { reachesLiveLevel, MUTED_SECONDS } = await import(path.join(root, 'extensions/ritemark/webview/src/hooks/dictationLevel.ts'));

const files = process.argv.slice(2).flatMap(arg => fs.statSync(arg).isDirectory()
  ? fs.readdirSync(arg).filter(f => f.endsWith('.wav')).sort().map(f => path.join(arg, f))
  : [arg]);
if (files.length === 0) throw new Error('usage: dictation-level-check.mjs <dir or .wav files>');

const failures = [];
let pieces = 0;
let silentPieces = 0;
for (const file of files) {
  const pcm = parsePcmWav(fs.readFileSync(file));
  if (!pcm) throw new Error(`${file}: not 16 kHz mono 16-bit WAV`);
  const first = pcm.subarray(0, MUTED_SECONDS * 32000);
  const floats = Float32Array.from({ length: first.length / 2 }, (_, i) => first.readInt16LE(i * 2) / 32768);
  const live = reachesLiveLevel(floats);
  const level = audioLevel(pcm);
  if (!live) failures.push(`${path.basename(file)}: live check would stop it`);
  if (level.audible < 3) failures.push(`${path.basename(file)}: host check calls it silence`);
  for (let offset = 0; offset < pcm.length; offset += 6 * 32000) {
    pieces += 1;
    if (audioLevel(pcm.subarray(offset, offset + 6 * 32000)).audible < 3) silentPieces += 1;
  }
}
console.log(`${files.length} files: ${failures.length} flagged as silence. 6 s pieces skipped as silent: ${silentPieces} of ${pieces}.`);
for (const failure of failures) console.log(`  ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);

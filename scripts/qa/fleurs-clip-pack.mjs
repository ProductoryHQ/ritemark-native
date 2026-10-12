#!/usr/bin/env node
// Sprint 129 W11: an Estonian clip pack with reference text, for scoring speech
// engines by word error rate (scripts/qa/asr-wer.mjs).
//
// Source: FLEURS (Conneau et al., 2022), Google, CC BY 4.0 — the et_ee test split,
// pinned to a dataset revision. One clip per sentence (the first recording of
// it), up to 25 s, ordered by sentence id, converted from 32-bit float to the
// 16 kHz mono 16-bit PCM WAV that Ritemark itself sends to the engine.
//
// Usage:
//   node scripts/qa/fleurs-clip-pack.mjs --tsv test.tsv --audio-dir <extracted test/> --out <dir>
//     [--count 100] [--stride 1]     (--count 20 --stride 5 = every 5th of the first 100)

import fs from 'node:fs';
import path from 'node:path';

const MAX_SECONDS = 25;

function parseArgs(argv) {
  const options = { count: '100', stride: '1' };
  for (let i = 0; i < argv.length; i += 2) options[argv[i].replace(/^--/, '')] = argv[i + 1];
  for (const key of ['tsv', 'audio-dir', 'out']) if (!options[key]) throw new Error(`--${key} is required`);
  return options;
}

/** 16-bit PCM from a 16 kHz mono WAV in 32-bit float or 16-bit PCM. */
export function toPcm16(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let offset = 12;
  let format = null;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = { tag: wav.readUInt16LE(body), channels: wav.readUInt16LE(body + 2), rate: wav.readUInt32LE(body + 4), bits: wav.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (!format || format.channels !== 1 || format.rate !== 16000) throw new Error(`unexpected format ${JSON.stringify(format)}`);
      const data = wav.subarray(body, Math.min(body + size, wav.length));
      if (format.tag === 1 && format.bits === 16) return Buffer.from(data);
      if (format.tag === 3 && format.bits === 32) {
        const out = Buffer.alloc((data.length / 4) * 2);
        for (let i = 0; i < data.length / 4; i += 1) {
          const v = Math.max(-1, Math.min(1, data.readFloatLE(i * 4)));
          out.writeInt16LE(Math.round(v * 32767), i * 2);
        }
        return out;
      }
      throw new Error(`unsupported sample format ${format.tag}/${format.bits}`);
    }
    offset = body + size + (size % 2);
  }
  throw new Error('no data chunk');
}

export function pcmWav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = fs.readFileSync(options.tsv, 'utf8').split('\n').filter(Boolean).map(line => {
    const [sentence, file, raw, normalized, , samples] = line.split('\t');
    return { sentence: Number(sentence), file, raw, normalized, seconds: Number(samples) / 16000 };
  });

  const firstPerSentence = new Map();
  for (const row of rows) {
    if (row.seconds <= MAX_SECONDS && !firstPerSentence.has(row.sentence)) firstPerSentence.set(row.sentence, row);
  }
  const picked = [...firstPerSentence.values()]
    .sort((a, b) => a.sentence - b.sentence)
    .slice(0, Number(options.count) * Number(options.stride))
    .filter((_, index) => index % Number(options.stride) === 0)
    .slice(0, Number(options.count));

  fs.mkdirSync(options.out, { recursive: true });
  const refs = [];
  let seconds = 0;
  for (const row of picked) {
    const name = `fleurs-et-${row.sentence}.wav`;
    fs.writeFileSync(path.join(options.out, name), pcmWav(toPcm16(fs.readFileSync(path.join(options['audio-dir'], row.file)))));
    refs.push(`${name}\t${row.normalized}\t${row.raw}`);
    seconds += row.seconds;
  }
  fs.writeFileSync(path.join(options.out, 'refs.tsv'), `${refs.join('\n')}\n`);
  fs.writeFileSync(path.join(options.out, 'NOTICE.md'), [
    '# Estonian test clips',
    '',
    'From FLEURS (Conneau et al., 2022, "FLEURS: Few-shot Learning Evaluation of Universal Representations of Speech"),',
    'Google, licensed CC BY 4.0: https://huggingface.co/datasets/google/fleurs (et_ee test split,',
    'revision 70bb2e84b976b7e960aa89f1c648e09c59f894dd). Converted to 16 kHz mono 16-bit PCM; text unchanged.',
    'Used only to measure speech-recognition accuracy; not part of Ritemark.',
    '',
  ].join('\n'));
  console.log(`${picked.length} clips, ${Math.round(seconds)} s of audio -> ${options.out}`);
}

main();

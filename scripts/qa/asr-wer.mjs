#!/usr/bin/env node
// Sprint 129 W11: score a speech engine on a clip pack (scripts/qa/fleurs-clip-pack.mjs)
// by word error rate, and time it.
//
// whisper: one whisper-cli process per clip with dictation's own flags (imported
//          from the extension, so this tests what Ritemark sends), as dictation runs today.
// sherpa:  one sherpa-onnx process for all clips (model loaded once); everything after
//          `--` is passed to it (tokens, encoder, decoder, joiner, model type, threads).
//
// Run with tsx:
//   npx --yes tsx@4.21.0 scripts/qa/asr-wer.mjs --clips <dir> --label "whisper q8_0" \
//     --engine whisper --binary <whisper-cli> --model <ggml.bin> [--language et] [--threads N] [--timestamps on] [--report out.json]
//   (--timestamps on: TalTech's fine-tuned Whisper only stops decoding with timestamps on.)
//   [--audio-ctx-margin N]: shorten Whisper's 30 s window to each clip's length plus N frames
//   (50 frames per second), to test that speed-up's accuracy. [--audio-ctx N]: a fixed window.
//   [--chunk-seconds N]: cut each clip into fixed N-second chunks, as dictation's timer does,
//   and score the joined text. [--resident on]: one whisper-cli process for every chunk/clip,
//   so the model loads once (what a model kept in memory would cost).
//   npx --yes tsx@4.21.0 scripts/qa/asr-wer.mjs --clips <dir> --label "parakeet v3 int8" \
//     --engine sherpa --binary <sherpa-onnx-offline> [--report out.json] -- --tokens=... --encoder=... ...

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Lowercase, letters and digits only: punctuation and casing are not errors here. */
export function normalizeForWer(text) {
  return text.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Word-level edit distance. */
export function wordErrors(reference, hypothesis) {
  const r = reference ? reference.split(' ') : [];
  const h = hypothesis ? hypothesis.split(' ') : [];
  let previous = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= h.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return { errors: previous[h.length], words: r.length };
}

function parseArgs(argv) {
  const dash = argv.indexOf('--');
  const own = dash >= 0 ? argv.slice(0, dash) : argv;
  const options = { language: 'et', passthrough: dash >= 0 ? argv.slice(dash + 1) : [] };
  for (let i = 0; i < own.length; i += 2) options[own[i].replace(/^--/, '')] = own[i + 1];
  for (const key of ['clips', 'engine', 'binary', 'label']) if (!options[key]) throw new Error(`--${key} is required`);
  return options;
}

function readClips(dir) {
  return fs.readFileSync(path.join(dir, 'refs.tsv'), 'utf8').split('\n').filter(Boolean).map(line => {
    const [file, normalized] = line.split('\t');
    return { file: path.join(dir, file), name: file, reference: normalizeForWer(normalized) };
  });
}

function seconds(wav) {
  return (fs.statSync(wav).size - 44) / 32000;
}

/** Fixed-length chunks of a 16 kHz mono 16-bit WAV (dictation's timer has no VAD). */
function chunkWav(file, chunkSeconds, dir) {
  const pcm = fs.readFileSync(file).subarray(44);
  const size = chunkSeconds * 32000;
  const out = [];
  for (let offset = 0, i = 0; offset < pcm.length; offset += size, i += 1) {
    const data = pcm.subarray(offset, Math.min(pcm.length, offset + size));
    if (data.length < 1000) break; // what DictationController skips as near-empty
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
    const target = path.join(dir, `${path.basename(file, '.wav')}-c${i}.wav`);
    fs.writeFileSync(target, Buffer.concat([header, data]));
    out.push(target);
  }
  return out;
}

async function runWhisper(clips, options) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { dictationArgs, parseDictationStdout } = await import(
    pathToFileURL(path.join(repoRoot, 'extensions/ritemark/src/voiceDictation/whisperCpp.ts')).href);

  const baseArgs = (audioPath) => {
    const args = dictationArgs({
      modelPath: options.model, audioPath, language: options.language,
      threads: options.threads ? Number(options.threads) : undefined,
    }).filter(arg => !(options.timestamps === 'on' && arg === '--no-timestamps'));
    args.pop(); // the audio path: callers add the file(s)
    if (options['audio-ctx']) args.push('--audio-ctx', String(options['audio-ctx']));
    return args;
  };
  const env = { ...process.env, DYLD_LIBRARY_PATH: path.dirname(options.binary) };
  const clean = (text) => parseDictationStdout(options.timestamps === 'on' ? text.replace(/^\[[^\]]*\]\s*/gm, '') : text);

  // Every unit of audio whisper-cli is given: whole clips, or their fixed chunks.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'asr-wer-'));
  const units = clips.map(clip => (options['chunk-seconds']
    ? chunkWav(clip.file, Number(options['chunk-seconds']), work)
    : [clip.file]));
  const textOf = (file) => {
    const txt = `${file}.txt`; // --output-txt writes beside the input
    if (!fs.existsSync(txt)) return '';
    const text = fs.readFileSync(txt, 'utf8');
    fs.rmSync(txt, { force: true });
    return clean(text);
  };
  const perFileArgs = (file) => {
    const args = baseArgs(file);
    if (options['audio-ctx-margin']) {
      const frames = Math.min(1500, Math.ceil(seconds(file) * 50) + Number(options['audio-ctx-margin']));
      args.push('--audio-ctx', String(frames));
    }
    return [...args, file];
  };

  let rows;
  if (options.resident === 'on') {
    const all = units.flat();
    const started = Date.now();
    const result = spawnSync(options.binary, [...baseArgs(all[0]), ...all], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env });
    const wall = Date.now() - started;
    const load = /load time\s*=\s*([\d.]+) ms/.exec(result.stderr ?? '');
    rows = clips.map((clip, i) => ({
      ...clip,
      hypothesis: units[i].map(textOf).filter(Boolean).join(' '),
      wallMs: Math.round(wall / clips.length),
      loadMs: i === 0 && load ? Number(load[1]) : 0,
      exit: result.status,
    }));
  } else {
    rows = clips.map((clip, i) => {
      let wall = 0;
      let loadMs = 0;
      let exit = 0;
      for (const file of units[i]) {
        const started = Date.now();
        const result = spawnSync(options.binary, perFileArgs(file), { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env });
        wall += Date.now() - started;
        const load = /load time\s*=\s*([\d.]+) ms/.exec(result.stderr ?? '');
        loadMs += load ? Number(load[1]) : 0;
        if (result.status !== 0) exit = result.status;
      }
      return { ...clip, hypothesis: units[i].map(textOf).filter(Boolean).join(' '), wallMs: wall, loadMs, exit };
    });
  }
  fs.rmSync(work, { recursive: true, force: true });
  return rows;
}

function runSherpa(clips, options) {
  const started = Date.now();
  const result = spawnSync(options.binary, [...options.passthrough, ...clips.map(clip => clip.file)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  // One JSON line per file, in input order: `{"lang": …}` (offline) or `{ "text": …}` (streaming).
  const texts = out.split(/\r?\n/).filter(line => /^\{\s*"(lang|text)"/.test(line)).map(line => JSON.parse(line).text ?? '');
  if (texts.length !== clips.length) {
    throw new Error(`sherpa-onnx returned ${texts.length} results for ${clips.length} clips (exit ${result.status}):\n${out.slice(-2000)}`);
  }
  const created = /recognizer created in ([\d.]+) s/i.exec(out);
  // Offline prints one total. Streaming decodes every file at once and prints, per
  // file, the time until that file finished, so the longest is the total.
  const elapsedValues = [...out.matchAll(/Elapsed seconds: ([\d.]+)/g)].map(match => Number(match[1]));
  const elapsed = elapsedValues.length ? [null, String(Math.max(...elapsedValues))] : null;
  const wallMs = Date.now() - started;
  return {
    rows: clips.map((clip, i) => ({ ...clip, hypothesis: texts[i], exit: result.status })),
    loadMs: created ? Number(created[1]) * 1000 : null,
    decodeMs: elapsed ? Number(elapsed[1]) * 1000 : null,
    wallMs,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const clips = readClips(options.clips);
  const audioSeconds = clips.reduce((sum, clip) => sum + seconds(clip.file), 0);

  let rows;
  let timing;
  if (options.engine === 'whisper') {
    rows = await runWhisper(clips, options);
    const wall = rows.reduce((sum, row) => sum + row.wallMs, 0);
    const load = rows.reduce((sum, row) => sum + (row.loadMs ?? 0), 0);
    timing = { wallMs: wall, loadMsTotal: load, perClipMs: Math.round(wall / rows.length), realTimeFactor: +(wall / 1000 / audioSeconds).toFixed(3) };
  } else if (options.engine === 'sherpa') {
    const result = runSherpa(clips, options);
    rows = result.rows;
    timing = { wallMs: result.wallMs, loadMs: result.loadMs, decodeMs: result.decodeMs,
      realTimeFactor: result.decodeMs !== null ? +(result.decodeMs / 1000 / audioSeconds).toFixed(3) : null };
  } else {
    throw new Error(`unknown engine ${options.engine}`);
  }

  let errors = 0;
  let words = 0;
  for (const row of rows) {
    const score = wordErrors(row.reference, normalizeForWer(row.hypothesis));
    row.errors = score.errors;
    row.words = score.words;
    errors += score.errors;
    words += score.words;
  }
  const report = {
    label: options.label, engine: options.engine, clips: rows.length, audioSeconds: Math.round(audioSeconds),
    words, errors, wer: +(100 * errors / words).toFixed(2), timing,
    failedClips: rows.filter(row => row.exit !== 0).length,
    rows: rows.map(({ name, reference, hypothesis, errors: e, words: w, wallMs }) => ({ name, reference, hypothesis, errors: e, words: w, wallMs })),
  };
  if (options.report) fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`${options.label}: WER ${report.wer}% (${errors}/${words} words, ${rows.length} clips, ${report.audioSeconds} s audio) · ${JSON.stringify(timing)}`);
  for (const row of [...rows].sort((a, b) => b.errors / b.words - a.errors / a.words).slice(0, 3)) {
    console.log(`  worst ${row.name}: ${row.errors}/${row.words}\n    ref: ${row.reference}\n    hyp: ${normalizeForWer(row.hypothesis)}`);
  }
}

main().catch(error => {
  console.error(`ASR-WER ERROR: ${error.message}`);
  process.exit(1);
});

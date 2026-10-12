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
//   npx --yes tsx@4.21.0 scripts/qa/asr-wer.mjs --clips <dir> --label "parakeet v3 int8" \
//     --engine sherpa --binary <sherpa-onnx-offline> [--report out.json] -- --tokens=... --encoder=... ...

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
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

async function runWhisper(clips, options) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { dictationArgs, parseDictationStdout } = await import(
    pathToFileURL(path.join(repoRoot, 'extensions/ritemark/src/voiceDictation/whisperCpp.ts')).href);
  return clips.map(clip => {
    const args = dictationArgs({
      modelPath: options.model, audioPath: clip.file, language: options.language,
      threads: options.threads ? Number(options.threads) : undefined,
    }).filter(arg => arg !== '--output-txt' && !(options.timestamps === 'on' && arg === '--no-timestamps'));
    const started = Date.now();
    const result = spawnSync(options.binary, args, {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, DYLD_LIBRARY_PATH: path.dirname(options.binary) },
    });
    const load = /load time\s*=\s*([\d.]+) ms/.exec(result.stderr ?? '');
    const stdout = options.timestamps === 'on'
      ? (result.stdout ?? '').replace(/^\[[^\]]*\]\s*/gm, '')
      : (result.stdout ?? '');
    return {
      ...clip,
      hypothesis: parseDictationStdout(stdout),
      wallMs: Date.now() - started,
      loadMs: load ? Number(load[1]) : null,
      exit: result.status,
    };
  });
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

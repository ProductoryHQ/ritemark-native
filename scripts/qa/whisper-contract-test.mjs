#!/usr/bin/env node
// Sprint 129 (#133, #203): the contract every bundled whisper-cli must keep.
//
// Runs one binary the way Ritemark runs it — the argument builders are imported
// from the extension source, so a flag change there is tested here — and checks
// what the app relies on: the transcript, the JSON sidecar, exit codes 2 and 3,
// Unicode paths, architecture, the minimum macOS version, and that nothing
// outside the operating system or the binary's own folder is needed.
//
// Run with tsx (it imports TypeScript):
//   npx --yes tsx@4.21.0 scripts/qa/whisper-contract-test.mjs \
//     --binary <dir>/whisper-cli[.exe] --sample <jfk.wav> --model-cache <dir> \
//     [--arch x64|arm64] [--min-macos 12.0] [--dumpbin <dumpbin.exe>] [--report <file.json>]

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODEL = {
  name: 'ggml-tiny.bin',
  // Pinned Hugging Face revision of ggerganov/whisper.cpp; the hash is the LFS oid.
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny.bin',
  sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
};
const EXPECTED_PHRASE = /ask not what your country/i;
const UNICODE_FOLDER = 'Tõõ-äöü Тест';

/** Visual C++ redistributable DLLs. Present on the CI runner, absent on a clean Windows. */
const VC_REDIST = /^(vcruntime|msvcp|vcomp|concrt|vccorlib|mfc)\d*.*\.dll$/i;

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`);
    options[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  for (const required of ['binary', 'sample', 'model-cache']) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  return options;
}

async function ensureModel(cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const target = path.join(cacheDir, MODEL.name);
  if (fs.existsSync(target) && sha256(target) === MODEL.sha256) return target;

  const response = await fetch(MODEL.url);
  if (!response.ok) throw new Error(`model download failed: HTTP ${response.status}`);
  const partial = `${target}.partial`;
  fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
  const actual = sha256(partial);
  if (actual !== MODEL.sha256) throw new Error(`model checksum mismatch: ${actual}`);
  fs.renameSync(partial, target);
  return target;
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Same environment the app gives the binary (whisperCpp.ts, whisperLocalEngine.ts). */
function run(binary, args) {
  const started = Date.now();
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
    env: { ...process.env, DYLD_LIBRARY_PATH: path.dirname(binary) },
  });
  return {
    status: result.status,
    signal: result.signal,
    error: result.error?.code,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ms: Date.now() - started,
  };
}

/** PE machine type or Mach-O CPU type of one file, or null when it is neither. */
function binaryArch(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(4096);
    const read = fs.readSync(fd, head, 0, head.length, 0);
    if (read >= 64 && head.readUInt16LE(0) === 0x5a4d) {
      const peOffset = head.readUInt32LE(0x3c);
      const pe = Buffer.alloc(6);
      fs.readSync(fd, pe, 0, 6, peOffset);
      if (pe.readUInt32LE(0) !== 0x00004550) return null;
      return { 0x8664: 'x64', 0xaa64: 'arm64', 0x014c: 'x86' }[pe.readUInt16LE(4)] ?? 'unknown';
    }
    if (read >= 8 && head.readUInt32LE(0) === 0xfeedfacf) {
      return { 0x01000007: 'x64', 0x0100000c: 'arm64' }[head.readUInt32LE(4)] ?? 'unknown';
    }
    if (read >= 8 && head.readUInt32BE(0) === 0xcafebabe) return 'universal';
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function nativeFilesBeside(binary) {
  const dir = path.dirname(binary);
  return fs.readdirSync(dir)
    .map(name => path.join(dir, name))
    .filter(file => fs.lstatSync(file).isFile() && binaryArch(file) !== null);
}

/** Dependencies outside the OS and the binary's folder, per platform. */
function foreignDependencies(binary, options) {
  const dir = path.dirname(binary);
  const besides = new Set(fs.readdirSync(dir).map(name => name.toLowerCase()));
  const problems = [];

  for (const file of nativeFilesBeside(binary)) {
    if (process.platform === 'win32') {
      if (!options.dumpbin) throw new Error('--dumpbin is required on Windows');
      const out = spawnSync(options.dumpbin, ['/nologo', '/dependents', file], { encoding: 'utf8' }).stdout ?? '';
      const deps = out.split(/\r?\n/).map(line => line.trim()).filter(line => /\.dll$/i.test(line));
      for (const dep of deps) {
        const lower = dep.toLowerCase();
        if (besides.has(lower)) continue;
        if (/^(api|ext)-ms-/.test(lower)) continue; // API sets: resolved by the Windows loader
        if (VC_REDIST.test(dep)) problems.push(`${path.basename(file)} needs ${dep}, which a clean Windows does not have`);
        else if (!fs.existsSync(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', dep))) {
          problems.push(`${path.basename(file)} needs ${dep}, found neither beside it nor in System32`);
        }
      }
    } else if (process.platform === 'darwin') {
      const out = spawnSync('otool', ['-L', file], { encoding: 'utf8' }).stdout ?? '';
      const deps = out.split('\n').slice(1).map(line => line.trim().split(' (')[0]).filter(Boolean);
      for (const dep of deps) {
        if (dep.startsWith('/usr/lib/') || dep.startsWith('/System/Library/')) continue;
        const local = dep.replace(/^@(rpath|loader_path|executable_path)\//, '');
        if (local !== dep && besides.has(path.basename(local).toLowerCase())) continue;
        if (path.basename(dep) === path.basename(file)) continue; // its own install name
        problems.push(`${path.basename(file)} needs ${dep}`);
      }
    }
  }
  return problems;
}

/** Highest LC_BUILD_VERSION / LC_VERSION_MIN_MACOSX minos among the Mach-O files. */
function macosMinimums(binary) {
  const result = {};
  for (const file of nativeFilesBeside(binary)) {
    const out = spawnSync('otool', ['-l', file], { encoding: 'utf8' }).stdout ?? '';
    const start = out.search(/LC_BUILD_VERSION|LC_VERSION_MIN_MACOSX/);
    if (start < 0) continue;
    const match = /(?:minos|version)\s+(\d+(?:\.\d+)*)/.exec(out.slice(start));
    if (match) result[path.basename(file)] = match[1];
  }
  return result;
}

function versionAtMost(actual, limit) {
  const a = actual.split('.').map(Number);
  const b = limit.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return true;
}

/** whisper's own timing lines, for the report. */
function timings(stderr) {
  const pick = name => {
    const match = new RegExp(`${name} time\\s*=\\s*([\\d.]+) ms`).exec(stderr);
    return match ? Number(match[1]) : null;
  };
  return { load: pick('load'), encode: pick('encode'), decode: pick('decode'), batchd: pick('batchd'), total: pick('total') };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const binary = path.resolve(options.binary);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const engine = await import(pathToFileURL(path.join(repoRoot, 'extensions/ritemark/src/speech/engines/whisperLocalEngine.ts')).href);
  const dictation = await import(pathToFileURL(path.join(repoRoot, 'extensions/ritemark/src/voiceDictation/whisperCpp.ts')).href);

  const model = await ensureModel(path.resolve(options['model-cache']));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-contract-'));
  // A copy, because dictation's --output-txt writes a .txt beside its input.
  const sample = path.join(work, 'sample.wav');
  fs.copyFileSync(path.resolve(options.sample), sample);
  const checks = [];
  const check = (name, ok, detail = '') => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  };

  // Architecture of every native file in the folder.
  if (options.arch) {
    const archs = nativeFilesBeside(binary).map(file => [path.basename(file), binaryArch(file)]);
    const wrong = archs.filter(([, arch]) => arch !== options.arch);
    check(`architecture is ${options.arch}`, wrong.length === 0, wrong.map(([f, a]) => `${f}: ${a}`).join(', '));
  }

  // Minimum macOS the binaries ask for.
  if (process.platform === 'darwin' && options['min-macos']) {
    const mins = macosMinimums(binary);
    const tooNew = Object.entries(mins).filter(([, v]) => !versionAtMost(v, options['min-macos']));
    check(`runs on macOS ${options['min-macos']}+`, tooNew.length === 0,
      Object.entries(mins).map(([f, v]) => `${f} minos ${v}`).join(', '));
  }

  const deps = foreignDependencies(binary, options);
  check('needs only the OS and files in its own folder', deps.length === 0, deps.join('; '));

  const help = run(binary, ['--help']);
  check('--help starts (readiness probe)', help.status === 0 || help.status === 1,
    `exit ${help.status}${help.signal ? ` signal ${help.signal}` : ''}${help.error ? ` ${help.error}` : ''}`);

  // Transcribe: the exact engine arguments, then the engine's own parser.
  const outBase = path.join(work, 'transcribe');
  const transcribe = run(binary, engine.transcribeArgs({ modelPath: model, audioPath: sample, outBase, language: 'en' }));
  let transcript = '';
  let words = 0;
  if (transcribe.status === 0 && fs.existsSync(`${outBase}.json`)) {
    const parsed = engine.parseWhisperJson(fs.readFileSync(`${outBase}.json`, 'utf8'));
    transcript = parsed.segments.map(segment => segment.text).join(' ');
    words = parsed.segments.reduce((sum, segment) => sum + (segment.words?.length ?? 0), 0);
  }
  check('transcribe flags: JSON transcript', EXPECTED_PHRASE.test(transcript), `exit ${transcribe.status}, ${transcribe.ms} ms: "${transcript.trim()}"`);
  check('transcribe flags: per-word confidence', words > 0, `${words} words`);
  check('transcribe flags: progress on stderr', /progress\s*=\s*\d+%/.test(transcribe.stderr));

  // Dictation: the exact dictation arguments; the text arrives on stdout.
  const dictate = run(binary, dictation.dictationArgs({ modelPath: model, audioPath: sample, language: 'en' }));
  check('dictation flags: text on stdout', dictate.status === 0 && EXPECTED_PHRASE.test(dictate.stdout),
    `exit ${dictate.status}, ${dictate.ms} ms`);

  // Exit codes the engine maps to messages.
  const missing = run(binary, engine.transcribeArgs({ modelPath: model, audioPath: path.join(work, 'nope.wav'), outBase }));
  check('missing audio exits 2', missing.status === 2, `exit ${missing.status}`);
  const corrupt = path.join(work, 'corrupt.bin');
  fs.writeFileSync(corrupt, Buffer.alloc(4096, 7));
  const badModel = run(binary, engine.transcribeArgs({ modelPath: corrupt, audioPath: sample, outBase }));
  check('unloadable model exits 3', badModel.status === 3, `exit ${badModel.status}`);

  // Unicode: model, audio and output all under a folder no single code page covers.
  const uni = path.join(work, UNICODE_FOLDER);
  fs.mkdirSync(uni);
  fs.copyFileSync(model, path.join(uni, 'mudel õ.bin'));
  fs.copyFileSync(sample, path.join(uni, 'heli ä.wav'));
  const uniBase = path.join(uni, 'väljund');
  const unicode = run(binary, engine.transcribeArgs({
    modelPath: path.join(uni, 'mudel õ.bin'), audioPath: path.join(uni, 'heli ä.wav'), outBase: uniBase, language: 'en',
  }));
  const uniText = fs.existsSync(`${uniBase}.json`)
    ? engine.parseWhisperJson(fs.readFileSync(`${uniBase}.json`, 'utf8')).segments.map(s => s.text).join(' ')
    : '';
  check(`Unicode paths (${UNICODE_FOLDER})`, EXPECTED_PHRASE.test(uniText), `exit ${unicode.status}`);

  const systemInfo = /system_info:.*$/m.exec(transcribe.stderr)?.[0] ?? '';
  const report = {
    binary,
    platform: `${process.platform}-${process.arch}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    logicalCpus: os.cpus().length,
    systemInfo,
    timings: { transcribe: timings(transcribe.stderr), dictation: timings(dictate.stderr) },
    files: nativeFilesBeside(binary).map(file => ({ name: path.basename(file), bytes: fs.statSync(file).size, sha256: sha256(file) })),
    checks,
  };
  console.log(systemInfo);
  if (options.report) fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  fs.rmSync(work, { recursive: true, force: true });

  const failed = checks.filter(c => !c.ok);
  console.log(failed.length ? `\n${failed.length} check(s) failed.` : `\nAll ${checks.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(error => {
  console.error(`CONTRACT TEST ERROR: ${error.message}`);
  process.exit(2);
});

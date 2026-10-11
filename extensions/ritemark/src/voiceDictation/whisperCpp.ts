/**
 * whisper.cpp binary wrapper
 * Transcribes WAV audio files using whisper-cli
 *
 * Sprint 129: also the one place that finds the bundled binary, tests whether it
 * can run here, and names its failures — for dictation and for Transcribe's
 * on-device engine alike. Keep this file free of `vscode` imports: the CI
 * contract test and the unit tests load it under plain Node.
 */

import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface WhisperOptions {
  modelPath: string;
  language?: string;
  threads?: number;
  binaryPath: string;
}

export interface TranscriptionResult {
  text: string;
  success: boolean;
  error?: string;
  /** Sprint 129 R6: why the engine could not run, when it could not. */
  failure?: Exclude<WhisperReadiness, 'ready'>;
}

/** Sprint 129 R3/R6: whether the bundled engine can run on this computer. */
export type WhisperReadiness = 'ready' | 'missing' | 'blocked' | 'cpu-unsupported' | 'failed';

/** Platform-arch pairs Ritemark ships a whisper-cli for (binaries/<target>/). */
export const WHISPER_TARGETS = ['darwin-arm64', 'darwin-x64', 'win32-x64'];

/** The model dictation and Transcribe share. */
export const DEFAULT_MODEL_FILE = 'ggml-large-v3-turbo.bin';

/** A dictation call never runs longer than this; a 28 s chunk on a slow CPU fits. */
const DICTATION_TIMEOUT_MS = 120_000;

/** `--help` answers in well under a second; this only catches a hung process. */
const PROBE_TIMEOUT_MS = 10_000;

/** Windows reports a crash as its NTSTATUS code in the exit code. */
const STATUS_ILLEGAL_INSTRUCTION = 0xc000001d;

/**
 * Filter out hallucination patterns from transcription
 * Detects repetitive phrases that indicate model confusion
 */
function filterHallucinations(text: string): string {
  if (!text) return text;

  // Detect repeated words/phrases (3+ consecutive repetitions)
  // Pattern: word or short phrase repeated 3+ times
  const repetitionPattern = /(\b[\wäöüõ]+\b[.,!?]?\s*)\1{2,}/gi;
  let filtered = text.replace(repetitionPattern, '$1');

  // Detect patterns like "Oo. Oo. Oo." or "Tervist. Tervist."
  const dotRepetition = /(\b[\wäöüõ]+\.\s*)\1{2,}/gi;
  filtered = filtered.replace(dotRepetition, '$1');

  // If the result is mostly just repeated short words, return empty
  const words = filtered.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 0) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[.,!?]/g, '')));
    const repetitionRatio = uniqueWords.size / words.length;
    // If less than 20% unique words and more than 10 words, likely hallucination
    if (repetitionRatio < 0.2 && words.length > 10) {
      return '';
    }
  }

  return filtered.trim();
}

/**
 * The dictated text in whisper-cli's stdout.
 *
 * Status lines are dropped by their prefix only. An earlier filter also dropped
 * every line containing "processing", which threw away dictated sentences that
 * used the word.
 */
export function parseDictationStdout(stdout: string): string {
  const lines = stdout.split('\n').filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('whisper_')) return false;
    if (trimmed.startsWith('system_info:')) return false;
    if (trimmed.startsWith('main:')) return false;
    if (/^\[\d+:\d+:\d+/.test(trimmed)) return false; // timestamps
    return true;
  });

  return filterHallucinations(lines.map(line => line.trim()).join(' ').trim());
}

/**
 * How many CPU threads whisper-cli gets.
 *
 * Sprint 129 R9 (A2, Ryzen 7 5825U, 8 cores / 16 threads): without a GPU the
 * encoder is the whole cost, and all logical threads were fastest (46 s at 4
 * threads, 29 s at 8, 23 s at 16 per call). Apple silicon runs the model on
 * Metal, where the thread count barely matters; it keeps 4.
 */
export function whisperThreads(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
  logicalCpus: number = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length
): number {
  if (platform === 'darwin' && arch === 'arm64') return 4;
  return Math.max(1, logicalCpus);
}

/**
 * The whisper-cli arguments for one dictation chunk, with anti-hallucination settings.
 *
 * Sprint 129: exported so the CI contract test (`scripts/qa/whisper-contract-test.mjs`)
 * runs every bundled binary with exactly what dictation sends.
 */
export function dictationArgs(options: {
  modelPath: string;
  audioPath: string;
  language?: string;
  threads?: number;
}): string[] {
  const args = [
    '--model', options.modelPath,
    '--threads', String(options.threads || whisperThreads()),
    '--no-timestamps',
    '--no-fallback',        // Prevent temperature fallback loops
    '--beam-size', '8',     // Larger beam = more accurate
    '--entropy-thold', '2.4', // Detect hallucination via entropy
    '--logprob-thold', '-1.0', // Log probability threshold
    '--max-len', '0',       // No max segment length limit
    '--output-txt',
    options.audioPath
  ];

  // Only specify language if explicitly provided, otherwise let Whisper auto-detect
  if (options.language) {
    args.splice(2, 0, '--language', options.language);
  }

  return args;
}

/**
 * Transcribe a WAV audio buffer using whisper-cli
 *
 * @param wavBuffer - WAV audio data (16kHz, mono, 16-bit PCM)
 * @param options - Whisper configuration options
 * @returns Transcription result
 */
export async function transcribeWav(
  wavBuffer: Buffer,
  options: WhisperOptions
): Promise<TranscriptionResult> {
  // Verify binary exists
  if (!fs.existsSync(options.binaryPath)) {
    return {
      text: '',
      success: false,
      error: `Whisper binary not found at ${options.binaryPath}`,
      failure: 'missing'
    };
  }

  // Verify model exists
  if (!fs.existsSync(options.modelPath)) {
    return {
      text: '',
      success: false,
      error: `Model not found at ${options.modelPath}`
    };
  }

  // Write WAV to temp file
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `ritemark-audio-${Date.now()}.wav`);

  try {
    fs.writeFileSync(tempFile, wavBuffer);

    const args = dictationArgs({
      modelPath: options.modelPath,
      audioPath: tempFile,
      language: options.language,
      threads: options.threads
    });

    // Resolves only once the process is gone: Windows cannot delete the temp
    // file while whisper-cli still holds it open.
    return await new Promise<TranscriptionResult>((resolve) => {
      const whisperProc = child_process.spawn(options.binaryPath, args, {
        env: {
          ...process.env,
          // The macOS 1.8.3 build loads dylibs beside the binary; harmless elsewhere.
          DYLD_LIBRARY_PATH: path.dirname(options.binaryPath)
        }
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        whisperProc.kill();
      }, DICTATION_TIMEOUT_MS);

      whisperProc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      whisperProc.stderr?.on('data', (data: Buffer) => {
        stderr = (stderr + data.toString('utf-8')).slice(-4000);
      });

      whisperProc.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        console.error('[Whisper] Process error:', error);
        resolve({
          text: '',
          success: false,
          error: error.message,
          failure: describeWhisperFailure({ spawnErrorCode: error.code })
        });
      });

      whisperProc.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ text: parseDictationStdout(stdout), success: true });
          return;
        }
        resolve({
          text: '',
          success: false,
          error: timedOut ? 'Transcription timeout' : `Whisper exited with code ${code}${signal ? ` (${signal})` : ''}: ${stderr}`,
          failure: timedOut ? 'failed' : describeWhisperFailure({ exitCode: code, signal })
        });
      });
    });

  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      // Also delete any .txt output file whisper might create
      const txtFile = tempFile + '.txt';
      if (fs.existsSync(txtFile)) {
        fs.unlinkSync(txtFile);
      }
    } catch (err) {
      console.warn('[Whisper] Failed to delete temp file:', err);
    }
  }
}

/**
 * Where the bundled whisper-cli lives for a platform and CPU.
 *
 * Sprint 129 R3: never throws. Whether it can run is `probeWhisper()`'s call,
 * so a computer without a build gets an explanation rather than an exception.
 * `.exe` on Windows: spawn would find the binary without it, `fs.existsSync`
 * would not.
 */
export function getWhisperBinaryPath(
  context: { extensionPath: string },
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string {
  const name = platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  return path.join(context.extensionPath, 'binaries', `${platform}-${arch}`, name);
}

/** Where downloaded speech models live (`~/.ritemark/models`, on Windows too). */
export function getModelDirectory(): string {
  return path.join(os.homedir(), '.ritemark', 'models');
}

/** The full path to a model file; dictation, Transcribe and Settings share it. */
export function getModelPath(modelName: string = DEFAULT_MODEL_FILE): string {
  return path.join(getModelDirectory(), modelName);
}

const BUSY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/**
 * Sprint 129 R7: run a file operation, retrying while the file is busy.
 *
 * On Windows, antivirus commonly holds a freshly written file for a moment after
 * it is closed, so renaming the downloaded model can fail with EPERM/EBUSY.
 */
export async function withFileRetry<T>(
  operation: () => T,
  options: { totalMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  const totalMs = options.totalMs ?? 10_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  let waited = 0;
  let delay = 100;
  for (;;) {
    try {
      return operation();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!code || !BUSY_CODES.has(code) || waited >= totalMs) throw error;
      await sleep(delay);
      waited += delay;
      delay = Math.min(delay * 2, 2000);
    }
  }
}

/**
 * Sprint 129 R6: name a whisper-cli failure from how it failed.
 *
 * Pure, so every platform's codes are unit-tested on any platform.
 */
export function describeWhisperFailure(input: {
  spawnErrorCode?: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
}): Exclude<WhisperReadiness, 'ready'> {
  if (input.spawnErrorCode === 'ENOENT') return 'missing';
  if (input.spawnErrorCode === 'EACCES' || input.spawnErrorCode === 'EPERM') return 'blocked';
  if (input.spawnErrorCode) return 'failed';
  if (input.signal === 'SIGILL') return 'cpu-unsupported';
  if (typeof input.exitCode === 'number' && (input.exitCode >>> 0) === STATUS_ILLEGAL_INSTRUCTION) {
    return 'cpu-unsupported';
  }
  return 'failed';
}

type SpawnFn = typeof child_process.spawn;

const readyBinaries = new Set<string>();
/** A failed probe is not repeated for a minute, so a panel re-render does not respawn it. */
const FAILURE_MEMORY_MS = 60_000;
const recentFailures = new Map<string, { readiness: WhisperReadiness; at: number }>();

/**
 * Sprint 129 R3: can the bundled whisper-cli run here?
 *
 * Runs `whisper-cli --help` without blocking the extension host. A `ready`
 * answer is remembered for the session; a failure is not, so a fix (a
 * reinstall, an antivirus exception) is picked up on the next try.
 */
export async function probeWhisper(
  binaryPath: string,
  deps: { spawn?: SpawnFn; exists?: (file: string) => boolean } = {}
): Promise<WhisperReadiness> {
  if (readyBinaries.has(binaryPath)) return 'ready';
  const recent = recentFailures.get(binaryPath);
  if (recent && Date.now() - recent.at < FAILURE_MEMORY_MS) return recent.readiness;
  const exists = deps.exists ?? fs.existsSync;
  if (!exists(binaryPath)) {
    recentFailures.set(binaryPath, { readiness: 'missing', at: Date.now() });
    return 'missing';
  }

  const spawn = deps.spawn ?? child_process.spawn;
  const readiness = await new Promise<WhisperReadiness>((resolve) => {
    let settled = false;
    const settle = (value: WhisperReadiness) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    let child: child_process.ChildProcess;
    try {
      child = spawn(binaryPath, ['--help'], {
        env: { ...process.env, DYLD_LIBRARY_PATH: path.dirname(binaryPath) },
        stdio: 'ignore'
      });
    } catch (error) {
      settle(describeWhisperFailure({ spawnErrorCode: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN' }));
      return;
    }

    const timer = setTimeout(() => {
      child.kill();
      settle('failed');
    }, PROBE_TIMEOUT_MS);

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      settle(describeWhisperFailure({ spawnErrorCode: error.code ?? 'UNKNOWN' }));
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      // whisper-cli prints its usage and exits 0; older builds exit 1.
      settle(code === 0 || code === 1 ? 'ready' : describeWhisperFailure({ exitCode: code, signal }));
    });
  });

  if (readiness === 'ready') {
    readyBinaries.add(binaryPath);
    recentFailures.delete(binaryPath);
  } else {
    recentFailures.set(binaryPath, { readiness, at: Date.now() });
    console.warn(`[Whisper] ${binaryPath} is not usable here: ${readiness}`);
  }
  return readiness;
}

/** For tests: forget remembered probe results. */
export function resetWhisperProbeCache(): void {
  readyBinaries.clear();
  recentFailures.clear();
}

/** Sprint 129 R6: what the user is told when the engine cannot run. */
export function whisperProblemMessage(
  readiness: Exclude<WhisperReadiness, 'ready'>,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string {
  if (readiness === 'missing' && !WHISPER_TARGETS.includes(`${platform}-${arch}`)) {
    return 'On-device speech recognition is not available on this computer.';
  }
  switch (readiness) {
    case 'missing':
      return "Ritemark's speech engine is missing from this installation. Reinstall Ritemark to restore it.";
    case 'blocked':
      return "Your computer's security settings stopped Ritemark's speech engine from starting.";
    case 'cpu-unsupported':
      return 'On-device speech recognition needs a newer processor than this computer has.';
    case 'failed':
      return 'On-device speech recognition stopped unexpectedly. Please try again. If it keeps happening, please report the problem.';
  }
}

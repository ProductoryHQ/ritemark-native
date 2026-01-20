/**
 * whisper.cpp binary wrapper
 * Transcribes WAV audio files using whisper-cli
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
}

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
      error: `Whisper binary not found at ${options.binaryPath}`
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

    // Get directory containing the binary (for DYLD_LIBRARY_PATH)
    const binaryDir = path.dirname(options.binaryPath);

    // Build command arguments with anti-hallucination settings
    const args = [
      '--model', options.modelPath,
      '--threads', String(options.threads || 4),
      '--no-timestamps',
      '--no-fallback',        // Prevent temperature fallback loops
      '--beam-size', '8',     // Larger beam = more accurate
      '--entropy-thold', '2.4', // Detect hallucination via entropy
      '--logprob-thold', '-1.0', // Log probability threshold
      '--max-len', '0',       // No max segment length limit
      '--output-txt',
      tempFile
    ];

    // Only specify language if explicitly provided, otherwise let Whisper auto-detect
    if (options.language) {
      args.splice(2, 0, '--language', options.language);
    }

    // Execute whisper-cli
    const result = await new Promise<TranscriptionResult>((resolve) => {
      const whisperProc = child_process.spawn(options.binaryPath, args, {
        env: {
          ...process.env,
          DYLD_LIBRARY_PATH: binaryDir
        }
      });

      let stdout = '';
      let stderr = '';

      whisperProc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      whisperProc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      whisperProc.on('error', (error: Error) => {
        console.error('[Whisper] Process error:', error);
        resolve({
          text: '',
          success: false,
          error: error.message
        });
      });

      whisperProc.on('exit', (code: number | null) => {
        if (code === 0) {
          // whisper-cli outputs transcription to stdout
          // Filter out status/progress lines
          const lines = stdout.split('\n').filter(line => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            // Skip whisper status lines
            if (trimmed.startsWith('whisper_')) return false;
            if (trimmed.startsWith('system_info:')) return false;
            if (trimmed.startsWith('main:')) return false;
            if (trimmed.includes('processing')) return false;
            if (trimmed.match(/^\[\d+:\d+:\d+/)) return false; // timestamps
            return true;
          });

          let text = lines.join(' ').trim();

          // Post-process: detect and remove hallucination patterns
          text = filterHallucinations(text);

          resolve({
            text,
            success: true
          });
        } else {
          resolve({
            text: '',
            success: false,
            error: `Whisper exited with code ${code}: ${stderr}`
          });
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        whisperProc.kill();
        resolve({
          text: '',
          success: false,
          error: 'Transcription timeout'
        });
      }, 30000);
    });

    return result;

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
 * Transcribe audio from file path
 */
export async function transcribeAudio(options: {
  audioPath: string;
  modelPath: string;
  binaryPath: string;
  language?: string;
  threads?: number;
}): Promise<string> {
  const wavBuffer = fs.readFileSync(options.audioPath);
  const result = await transcribeWav(wavBuffer, {
    modelPath: options.modelPath,
    binaryPath: options.binaryPath,
    language: options.language,
    threads: options.threads
  });

  if (!result.success) {
    throw new Error(result.error || 'Transcription failed');
  }

  return result.text;
}

/**
 * Get the path to the whisper binary for the current platform
 */
export function getWhisperBinaryPath(context: { extensionPath: string }): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin' && arch === 'arm64') {
    return path.join(context.extensionPath, 'binaries', 'darwin-arm64', 'whisper-cli');
  }

  // Future: add other platforms
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

/**
 * Get the default model path
 */
export function getModelPath(): string {
  const modelsDir = path.join(os.homedir(), '.ritemark', 'models');
  return path.join(modelsDir, 'ggml-large-v3-turbo.bin');
}

/**
 * Check if whisper binary is available and working
 */
export async function checkWhisperBinary(binaryPath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(binaryPath)) {
      return false;
    }

    const binaryDir = path.dirname(binaryPath);

    const result = child_process.spawnSync(binaryPath, ['--help'], {
      env: {
        ...process.env,
        DYLD_LIBRARY_PATH: binaryDir
      },
      timeout: 5000
    });

    return result.status === 0 || result.status === 1; // --help may return 1
  } catch {
    return false;
  }
}

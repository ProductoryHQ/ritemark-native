/**
 * Sprint 108 R4 — ElevenLabs Scribe.
 *
 * Shapes taken from the shipped integration in `productory-videomark`
 * (research/elevenlabs-prior-art.md): the `xi-api-key` header, `scribe_v2`,
 * word-level timestamps, and majority-vote speaker folding.
 *
 * One decision deliberately DIVERGES from that prior art: videomark cuts audio
 * into 300-second windows to drive a progress bar. We send the whole file in
 * one request, because `speaker_id` is assigned PER REQUEST — windowing a
 * 60-minute meeting returns a dozen independent speaker numbering schemes and
 * makes global rename (R8) impossible. The cost is that processing has no
 * server-side percentage, so we report elapsed time instead of inventing one.
 *
 * The multipart body is streamed by hand rather than handed to `fetch` so that
 * the upload phase can report real byte progress — on a 44 MB meeting that is
 * the part the user actually waits through.
 */

import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import type { Platform } from '../../utils/platform';
import type {
  EngineCapabilities,
  EngineReadiness,
  TranscribeOptions,
  TranscriptionEngine,
} from '../TranscriptionEngine';
import { TranscriptionError } from '../types';
import type { SpeakerSeparation, TranscriptWord, TranscriptionResult } from '../types';
import { foldWordsIntoSegments } from '../segmentFolding';

const API_HOST = 'api.elevenlabs.io';
const API_PATH = '/v1/speech-to-text';
const MODEL_ID = 'scribe_v2';

/**
 * USD per hour, published rate at the time of writing. An estimate shown before
 * upload (N7) — not a billing source of truth.
 */
const USD_PER_HOUR = 0.22;

/** Scribe accepts the original file; nothing is converted before upload. */
const ACCEPTED = ['.m4a', '.mp3', '.wav', '.flac', '.ogg', '.aac'];

const MIME_BY_EXT: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
};

interface ScribeWord {
  text?: string;
  start?: number;
  end?: number;
  type?: string;
  speaker_id?: string;
  logprob?: number;
}

interface ScribeResponse {
  language_code?: string;
  words?: ScribeWord[];
  text?: string;
  /** Scribe reports the true length; on Windows our probe often cannot. */
  audio_duration_secs?: number;
}

/**
 * Map Scribe's word stream onto our word type.
 *
 * `logprob` is a log probability (-inf..0); `exp` puts it on the same 0..1
 * scale as whisper's per-token `p`, so R9 highlighting has one contract.
 * Exported for unit testing.
 */
export function scribeWordsToTranscriptWords(words: ScribeWord[]): TranscriptWord[] {
  const result: TranscriptWord[] = [];

  for (const word of words) {
    // The array also carries `spacing` and `audio_event` entries.
    if (word.type !== 'word') continue;
    const text = (word.text ?? '').trim();
    if (!text) continue;

    result.push({
      text,
      start: typeof word.start === 'number' ? word.start : 0,
      end: typeof word.end === 'number' ? word.end : 0,
      ...(word.speaker_id ? { speaker: word.speaker_id } : {}),
      ...(typeof word.logprob === 'number' ? { confidence: Math.min(1, Math.exp(word.logprob)) } : {}),
    });
  }

  return result;
}

/** ElevenLabs returns `{ detail: string | { message } }` — both forms occur. */
export function extractApiMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: string | { message?: string } };
    if (typeof parsed.detail === 'string') return parsed.detail;
    if (parsed.detail?.message) return parsed.detail.message;
  } catch {
    /* fall through to the raw body */
  }
  return body.slice(0, 200);
}

export function mapHttpError(status: number, body: string): TranscriptionError {
  const detail = extractApiMessage(body);

  if (status === 401 || status === 403) {
    return new TranscriptionError(
      'invalid-api-key',
      'ElevenLabs rejected the API key. Check it in Settings and try again.',
    );
  }
  if (status === 429) {
    return new TranscriptionError('rate-limited', 'ElevenLabs is rate limiting this account. Try again shortly.', true);
  }
  if (status === 402 || /quota|credit/i.test(detail)) {
    return new TranscriptionError('quota-exceeded', 'This ElevenLabs account is out of transcription credit.');
  }
  if (status >= 500) {
    return new TranscriptionError('network', 'ElevenLabs had a server error. Try again in a moment.', true);
  }
  return new TranscriptionError('unknown', detail || `ElevenLabs returned an unexpected error (${status}).`);
}

export interface ElevenLabsEngineDeps {
  /** Reads the key from SecretStorage; null when unset. */
  getApiKey: () => Promise<string | undefined>;
}

export class ElevenLabsEngine implements TranscriptionEngine {
  readonly id = 'elevenlabs';
  readonly label = 'ElevenLabs Scribe';
  readonly isLocal = false;
  readonly platforms: Platform[] = ['darwin', 'win32', 'linux'];
  readonly capabilities: EngineCapabilities = {
    diarization: true,
    confidence: true,
    wordTimestamps: true,
  };
  readonly speakerSeparation: SpeakerSeparation = 'diarized';
  readonly acceptsExtensions = ACCEPTED;

  constructor(private readonly deps: ElevenLabsEngineDeps) {}

  async isReady(): Promise<EngineReadiness> {
    const key = await this.deps.getApiKey();
    if (!key) {
      return { ready: false, reason: 'No API key — needed for speaker separation.', action: 'add-api-key' };
    }
    return { ready: true };
  }

  estimateCostUsd(durationSec: number): number {
    return Math.round(((durationSec / 3600) * USD_PER_HOUR + Number.EPSILON) * 100) / 100;
  }

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    const apiKey = await this.deps.getApiKey();
    if (!apiKey) {
      throw new TranscriptionError('no-api-key', 'Add an ElevenLabs API key in Settings to use this engine.');
    }

    const body = await this.postAudio(apiKey, options);
    const parsed = JSON.parse(body) as ScribeResponse;

    const words = scribeWordsToTranscriptWords(parsed.words ?? []);
    if (words.length === 0) {
      throw new TranscriptionError('unreadable-audio', 'ElevenLabs found no speech in that recording.');
    }

    const segments = foldWordsIntoSegments(words);
    const diarized = words.some((word) => word.speaker);

    // On Windows `probeDurationSec` returns null for every compressed format,
    // so the job carries 0 — which would persist as "0 s" and a $0 cost for a
    // transcription that was actually paid for. Scribe knows the real length;
    // fall back to the last word's end if it did not say.
    const reported =
      typeof parsed.audio_duration_secs === 'number' && parsed.audio_duration_secs > 0
        ? parsed.audio_duration_secs
        : words[words.length - 1]?.end;
    const durationSec = options.durationSec > 0 ? options.durationSec : reported;

    return {
      segments,
      ...(durationSec && durationSec > 0 ? { durationSec } : {}),
      language: parsed.language_code ?? null,
      // Honest: if the response came back without speaker labels, say so rather
      // than presenting a single unnamed speaker as if it were diarized.
      speakerSeparation: diarized ? 'diarized' : 'none',
      costUsd: this.estimateCostUsd(durationSec ?? options.durationSec),
    };
  }

  private postAudio(apiKey: string, options: TranscribeOptions): Promise<string> {
    const filePath = options.sourcePath;
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const boundary = `----ritemark${Date.now().toString(16)}`;

    const fields: Array<[string, string]> = [
      ['model_id', MODEL_ID],
      ['timestamps_granularity', 'word'],
      ['diarize', 'true'],
    ];
    // Omitted entirely when auto-detecting — sending an empty value makes
    // Scribe try to honour it.
    if (options.language) fields.push(['language_code', options.language]);

    const preamble = Buffer.from(
      fields
        .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
        .join('') +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: ${MIME_BY_EXT[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream'}\r\n\r\n`,
      'utf-8',
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const contentLength = preamble.length + fileSize + epilogue.length;

    return new Promise<string>((resolve, reject) => {
      const request = https.request(
        {
          host: API_HOST,
          path: API_PATH,
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': contentLength,
          },
        },
        (response) => {
          // Upload finished; from here Scribe is working and there is no
          // server-side percentage to report (see the file header).
          options.onProgress({ phase: 'transcribing', percent: null });

          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf-8');
            const status = response.statusCode ?? 0;
            if (status >= 200 && status < 300) {
              resolve(text);
            } else {
              reject(mapHttpError(status, text));
            }
          });
        },
      );

      const onAbort = (): void => {
        request.destroy(new TranscriptionError('cancelled', 'Transcription cancelled.'));
      };
      options.signal.addEventListener('abort', onAbort, { once: true });

      request.on('error', (error) => {
        options.signal.removeEventListener('abort', onAbort);
        if (error instanceof TranscriptionError) {
          reject(error);
          return;
        }
        reject(
          new TranscriptionError(
            'network',
            `Could not reach ElevenLabs: ${error.message}. Check your connection and try again.`,
            true,
          ),
        );
      });

      request.write(preamble);

      let uploaded = 0;
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => {
        uploaded += chunk.length;
        options.onProgress({
          phase: 'uploading',
          percent: Math.min(99, Math.round((uploaded / fileSize) * 100)),
        });
      });
      stream.on('error', (error) => {
        request.destroy();
        reject(new TranscriptionError('unreadable-audio', `Could not read the audio file: ${error.message}`));
      });
      stream.on('end', () => {
        request.end(epilogue);
      });
      stream.pipe(request, { end: false });
    });
  }
}

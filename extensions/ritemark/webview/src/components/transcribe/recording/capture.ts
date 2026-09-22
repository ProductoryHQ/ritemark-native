/**
 * Sprint 118 R1–R3/R7 — the pure half of direct recording in the webview.
 *
 * No DOM, no React: turning microphone samples into bounded, ordered PCM
 * chunks, counting what the host confirmed, and naming capture failures.
 * `useTranscribeRecording` wires these to the Web Audio graph.
 *
 * Constants mirror `src/speech/recording/types.ts` (Phase 0 §5 freeze).
 */

export const SAMPLE_RATE = 16_000;
/** One chunk ≈ one second of 16 kHz audio. */
export const CHUNK_SAMPLES = SAMPLE_RATE;
/** More unacknowledged chunks than this means the host cannot keep up. */
export const MAX_UNACKED_CHUNKS = 4;
export const BYTES_PER_SECOND = SAMPLE_RATE * 2;

/**
 * Streaming box-filter resampler for the fallback path, when the audio
 * context could not run at 16 kHz itself. Each output sample is the average
 * of exactly the input it covers, carried across buffer boundaries, so the
 * output count tracks the true duration (no per-buffer rounding drift) and
 * downsampling gets a basic anti-alias filter that linear interpolation lacks.
 */
export class StreamingResampler {
  private readonly ratio: number;
  private acc = 0;
  private filled = 0;

  constructor(fromRate: number, toRate: number = SAMPLE_RATE) {
    if (!(fromRate > 0) || !(toRate > 0)) throw new Error('Invalid sample rate');
    this.ratio = fromRate / toRate;
  }

  get passthrough(): boolean {
    return this.ratio === 1;
  }

  push(input: Float32Array): Float32Array {
    if (this.ratio === 1) return input.slice();
    const out = new Float32Array(Math.ceil((input.length + this.filled) / this.ratio) + 1);
    let n = 0;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      let remaining = 1;
      while (remaining > 1e-12) {
        const take = Math.min(this.ratio - this.filled, remaining);
        this.acc += x * take;
        this.filled += take;
        remaining -= take;
        if (this.filled >= this.ratio - 1e-9) {
          out[n++] = this.acc / this.ratio;
          this.acc = 0;
          this.filled = 0;
        }
      }
    }
    return out.subarray(0, n);
  }
}

/** Float [-1, 1] → signed 16-bit, clamped. */
export function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
  }
  return out;
}

/** Little-endian PCM16 bytes as base64, without a call-stack-sized spread. */
export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return btoa(binary);
}

/** Collects samples into fixed-size chunks; `flush` returns the remainder. */
export class Int16Chunker {
  private buffer: Int16Array;
  private length = 0;

  constructor(private readonly size: number = CHUNK_SAMPLES) {
    this.buffer = new Int16Array(size);
  }

  push(samples: Int16Array): Int16Array[] {
    const full: Int16Array[] = [];
    let offset = 0;
    while (offset < samples.length) {
      const take = Math.min(this.size - this.length, samples.length - offset);
      this.buffer.set(samples.subarray(offset, offset + take), this.length);
      this.length += take;
      offset += take;
      if (this.length === this.size) {
        full.push(this.buffer);
        this.buffer = new Int16Array(this.size);
        this.length = 0;
      }
    }
    return full;
  }

  flush(): Int16Array | null {
    if (this.length === 0) return null;
    const rest = this.buffer.slice(0, this.length);
    this.length = 0;
    return rest;
  }
}

/**
 * What was sent and what the host confirmed. Elapsed time and size come from
 * confirmed samples only (Phase 0 S4: the wall clock lies after a suspension,
 * and nothing unconfirmed is claimed as saved).
 */
export class ChunkLedger {
  private next = 0;
  private readonly unacked = new Map<number, number>();
  private acked = 0;

  /** Record a chunk as sent; returns its sequence number. */
  send(sampleCount: number): number {
    const sequence = this.next++;
    this.unacked.set(sequence, sampleCount);
    return sequence;
  }

  /** Returns true when this acknowledgement confirmed new audio. */
  ack(sequence: number): boolean {
    const samples = this.unacked.get(sequence);
    if (samples === undefined) return false; // duplicate or unknown
    this.unacked.delete(sequence);
    this.acked += samples;
    return true;
  }

  get inFlight(): number {
    return this.unacked.size;
  }

  get overBound(): boolean {
    return this.unacked.size > MAX_UNACKED_CHUNKS;
  }

  /** Sequence of the last chunk sent, -1 before the first. */
  get lastSequence(): number {
    return this.next - 1;
  }

  get ackedSamples(): number {
    return this.acked;
  }

  get ackedSeconds(): number {
    return this.acked / SAMPLE_RATE;
  }
}

export type CaptureFailureCode = 'os-denied' | 'no-device' | 'device-busy' | 'internal-config' | 'unexpected';

/**
 * Name a getUserMedia failure (R2). Same reading as dictation (GH #116):
 * a Permissions-Policy block is our packaging bug, not the user's settings;
 * NotFoundError while devices exist means the OS is refusing access.
 */
export function classifyCaptureError(
  errorName: string | undefined,
  context: { delegated: boolean; audioInputs: number },
): CaptureFailureCode {
  switch (errorName) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return context.delegated ? 'os-denied' : 'internal-config';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return context.audioInputs === 0 ? 'no-device' : 'os-denied';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'device-busy';
    default:
      return 'unexpected';
  }
}

/** `0:07`, `12:34`, `1:02:03`. */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Approximate size of the confirmed audio: `About 24 MB saved`. */
export function formatSavedSize(seconds: number): string {
  const mb = (seconds * BYTES_PER_SECOND) / 1_000_000;
  if (mb < 0.1) return 'Less than 0.1 MB saved';
  return `About ${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB saved`;
}

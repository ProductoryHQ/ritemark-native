/**
 * Sprint 118 R1–R3/R6/R7 — the webview side of one recording.
 *
 * Owns the microphone, the audio graph and the chunk stream; the host owns
 * the file (R4). The audio environment is injected so the whole lifecycle —
 * permission wait, denial, suspension, device loss, backpressure, teardown —
 * runs against fakes in tests.
 *
 * Why the AudioContext is created in `start()`: Chromium only lets a context
 * run when it is created or resumed during a user gesture (Phase 0: `resume()`
 * hung without one). The host may show a folder picker before it answers, so
 * the context is made inside the click and kept until the session begins.
 */

import {
  ChunkLedger,
  Int16Chunker,
  SAMPLE_RATE,
  StreamingResampler,
  classifyCaptureError,
  floatToInt16,
  int16ToBase64,
  type CaptureFailureCode,
} from './capture';

export type CapturePhase = 'idle' | 'requesting' | 'permission' | 'recording' | 'stopping';

export type StopReason = 'user' | 'limit' | 'suspended' | 'device-lost' | 'too-slow';

export interface CaptureView {
  phase: CapturePhase;
  sessionId: string | null;
  /** Seconds of audio the host confirmed as written. */
  savedSeconds: number;
}

// ---------------------------------------------------------------- environment

export interface AudioNodeLike {
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface ProcessorLike extends AudioNodeLike {
  onaudioprocess: ((event: { inputBuffer: { getChannelData(channel: number): Float32Array } }) => void) | null;
}

export interface TrackLike {
  stop(): void;
  addEventListener(type: 'ended', listener: () => void): void;
}

export interface StreamLike {
  getTracks(): TrackLike[];
}

export interface AudioContextLike {
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: unknown;
  onstatechange: (() => void) | null;
  resume(): Promise<void>;
  close(): Promise<void>;
  createMediaStreamSource(stream: StreamLike): AudioNodeLike;
  createScriptProcessor(bufferSize: number, inputs: number, outputs: number): ProcessorLike;
  createGain(): AudioNodeLike & { gain: { value: number } };
}

export interface AudioEnv {
  /** Called inside the Record click. Prefers a 16 kHz context (Phase 0 §5). */
  createContext(): AudioContextLike;
  /** Fallback when the 16 kHz context cannot take a microphone source. */
  createDeviceRateContext(): AudioContextLike;
  getUserMedia(): Promise<StreamLike>;
  microphoneDelegated(): boolean;
  countAudioInputs(): Promise<number>;
}

export type RecordingOutbound =
  | { type: 'transcribe:record/start' }
  | { type: 'transcribe:record/captureStarted'; sessionId: string }
  | { type: 'transcribe:record/chunk'; sessionId: string; sequence: number; sampleCount: number; pcm: string }
  | { type: 'transcribe:record/stop'; sessionId: string; finalSequence: number; reason: StopReason }
  | { type: 'transcribe:record/cancel'; sessionId: string }
  | { type: 'transcribe:record/captureFailed'; sessionId: string; code: CaptureFailureCode };

/** The host projection fields this class reads. */
export interface HostRecordingView {
  phase: 'idle' | 'preparing' | 'recording' | 'finalizing';
  sessionId: string | null;
}

const RESUME_TIMEOUT_MS = 1500;
const PROCESSOR_BUFFER = 4096;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export class CaptureSession {
  private phase: CapturePhase = 'idle';
  private sessionId: string | null = null;
  private ctx: AudioContextLike | null = null;
  private stream: StreamLike | null = null;
  private nodes: AudioNodeLike[] = [];
  private processor: ProcessorLike | null = null;
  private resampler: StreamingResampler | null = null;
  private chunker = new Int16Chunker();
  private ledger = new ChunkLedger();
  private resuming = false;

  constructor(
    private readonly env: AudioEnv,
    private readonly post: (message: RecordingOutbound) => void,
    private readonly onUpdate: (view: CaptureView) => void,
  ) {}

  view(): CaptureView {
    return { phase: this.phase, sessionId: this.sessionId, savedSeconds: this.ledger.ackedSeconds };
  }

  // ---------------------------------------------------------------- user actions

  /** Must run inside the Record click (see file comment). */
  start(): void {
    if (this.phase !== 'idle') return;
    try {
      this.ctx = this.env.createContext();
    } catch {
      this.ctx = null; // reported as a capture failure once the host answers
    }
    this.ledger = new ChunkLedger();
    this.chunker = new Int16Chunker();
    this.setPhase('requesting');
    this.post({ type: 'transcribe:record/start' });
  }

  stop(reason: StopReason = 'user'): void {
    const id = this.sessionId;
    if (this.phase !== 'recording' || !id) return;
    this.phase = 'stopping'; // before flushing, so an over-bound send cannot re-enter
    const rest = this.chunker.flush();
    if (rest) this.sendChunk(id, rest);
    this.post({ type: 'transcribe:record/stop', sessionId: id, finalSequence: this.ledger.lastSequence, reason });
    this.teardown();
    this.emit();
  }

  /** Abandon the capture; the host moves any audio to the trash. */
  cancel(): void {
    const id = this.sessionId;
    if ((this.phase !== 'permission' && this.phase !== 'recording') || !id) return;
    this.post({ type: 'transcribe:record/cancel', sessionId: id });
    this.teardown();
    this.sessionId = null;
    this.setPhase('idle');
  }

  /** The panel is going away: release the microphone. The host keeps the partial. */
  dispose(): void {
    this.teardown();
    this.sessionId = null;
    this.phase = 'idle';
  }

  // ---------------------------------------------------------------- host messages

  /** Returns true when the message was a recording event. */
  handleEvent(message: unknown): boolean {
    if (typeof message !== 'object' || message === null) return false;
    const m = message as { type?: unknown; sessionId?: unknown; sequence?: unknown };
    switch (m.type) {
      case 'transcribe:record/begin':
        if (typeof m.sessionId !== 'string') return true;
        if (this.phase !== 'requesting') {
          // Not ours to capture for (a reload raced the start): release it.
          this.post({ type: 'transcribe:record/cancel', sessionId: m.sessionId });
          return true;
        }
        this.sessionId = m.sessionId;
        this.setPhase('permission');
        void this.openMicrophone(m.sessionId);
        return true;
      case 'transcribe:record/notStarted':
        if (this.phase === 'requesting') {
          this.teardown();
          this.setPhase('idle');
        }
        return true;
      case 'transcribe:record/ack':
        if (m.sessionId === this.sessionId && typeof m.sequence === 'number' && this.ledger.ack(m.sequence)) this.emit();
        return true;
      case 'transcribe:record/ended':
        if (m.sessionId === this.sessionId && (this.phase === 'recording' || this.phase === 'permission')) {
          this.teardown();
          this.setPhase('stopping');
        }
        return true;
      default:
        return false;
    }
  }

  /** Leave "Saving…" once the host no longer holds this session. */
  syncHost(host: HostRecordingView | null): void {
    if (this.phase !== 'stopping' || !host) return;
    if (host.phase === 'idle' || host.sessionId !== this.sessionId) {
      this.sessionId = null;
      this.setPhase('idle');
    }
  }

  // ---------------------------------------------------------------- capture

  private async openMicrophone(id: string): Promise<void> {
    let stream: StreamLike;
    try {
      stream = await this.env.getUserMedia();
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      const inputs = name === 'NotFoundError' || name === 'DevicesNotFoundError' ? await this.env.countAudioInputs() : 1;
      if (!this.owns(id, 'permission')) return; // cancelled while the OS was asking
      this.fail(id, classifyCaptureError(name, { delegated: this.env.microphoneDelegated(), audioInputs: inputs }));
      return;
    }
    if (!this.owns(id, 'permission')) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    try {
      await this.buildGraph(stream);
    } catch {
      if (this.owns(id, 'permission')) this.fail(id, 'unexpected');
      return;
    }
    if (!this.owns(id, 'permission')) return;
    for (const track of stream.getTracks()) track.addEventListener('ended', () => this.stop('device-lost'));
    this.setPhase('recording');
    this.post({ type: 'transcribe:record/captureStarted', sessionId: id });
  }

  private async buildGraph(stream: StreamLike): Promise<void> {
    if (!this.ctx) this.ctx = this.env.createDeviceRateContext();
    let source: AudioNodeLike;
    try {
      source = this.ctx.createMediaStreamSource(stream);
    } catch (error) {
      if (this.ctx.sampleRate === SAMPLE_RATE) {
        // Phase 0 §5 fallback: the device rate plus the JavaScript resampler.
        void this.ctx.close().catch(() => {});
        this.ctx = this.env.createDeviceRateContext();
        source = this.ctx.createMediaStreamSource(stream);
      } else {
        throw error;
      }
    }
    // Tracked as soon as it exists, so a failure below still releases it.
    this.nodes = [source];
    const ctx = this.ctx;
    if (ctx.state !== 'running') await withTimeout(ctx.resume(), RESUME_TIMEOUT_MS);
    this.resampler = new StreamingResampler(ctx.sampleRate);
    const processor = ctx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);
    // Muted output: a ScriptProcessor only runs when connected to the destination.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    this.processor = processor;
    this.nodes.push(processor, mute);
    processor.onaudioprocess = (event) => this.onAudio(event.inputBuffer.getChannelData(0));
    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);
    ctx.onstatechange = () => this.onContextState();
  }

  private onAudio(input: Float32Array): void {
    const id = this.sessionId;
    if (this.phase !== 'recording' || !id || !this.resampler) return;
    const pcm = floatToInt16(this.resampler.push(input));
    for (const chunk of this.chunker.push(pcm)) {
      this.sendChunk(id, chunk);
      if (this.phase !== 'recording') return;
    }
  }

  private sendChunk(id: string, samples: Int16Array): void {
    const sequence = this.ledger.send(samples.length);
    this.post({ type: 'transcribe:record/chunk', sessionId: id, sequence, sampleCount: samples.length, pcm: int16ToBase64(samples) });
    // More than the frozen bound unconfirmed: stop and save rather than buffer without limit (§5).
    if (this.ledger.overBound && this.phase === 'recording') this.stop('too-slow');
  }

  /** Suspension (Phase 0 S4): one resume attempt, then an honest stop. */
  private onContextState(): void {
    const ctx = this.ctx;
    if (!ctx || this.phase !== 'recording' || ctx.state === 'running' || this.resuming) return;
    this.resuming = true;
    withTimeout(ctx.resume(), RESUME_TIMEOUT_MS)
      .then(() => ctx.state === 'running')
      .catch(() => false)
      .then((running) => {
        this.resuming = false;
        if (!running && this.ctx === ctx) this.stop('suspended');
      });
  }

  private fail(id: string, code: CaptureFailureCode): void {
    this.post({ type: 'transcribe:record/captureFailed', sessionId: id, code });
    this.teardown();
    this.sessionId = null;
    this.setPhase('idle');
  }

  private owns(id: string, phase: CapturePhase): boolean {
    return this.sessionId === id && this.phase === phase;
  }

  private teardown(): void {
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor = null;
    for (const node of this.nodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    this.nodes = [];
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.ctx) {
      this.ctx.onstatechange = null;
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.resampler = null;
  }

  private setPhase(phase: CapturePhase): void {
    this.phase = phase;
    this.emit();
  }

  private emit(): void {
    this.onUpdate(this.view());
  }
}

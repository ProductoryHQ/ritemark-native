/**
 * Sprint 118 R1–R3/R6/R7 — the webview recording lifecycle against fakes.
 *
 * Drives a fake AudioContext and MediaStream through every way a capture can
 * end: Stop, Cancel while the OS is asking, a denied or missing microphone,
 * the host stopping it, a suspended context, an unplugged device, and a host
 * that cannot keep up. After each, the microphone must be released.
 */
import assert from 'node:assert/strict';
import { MAX_UNACKED_CHUNKS } from './capture';
import {
  CaptureSession,
  type AudioContextLike,
  type AudioEnv,
  type AudioNodeLike,
  type CaptureView,
  type ProcessorLike,
  type RecordingOutbound,
  type StreamLike,
  type TrackLike,
} from './captureSession';

class FakeTrack implements TrackLike {
  stopped = false;
  private listeners: Array<() => void> = [];
  stop() { this.stopped = true; }
  addEventListener(_type: 'ended', listener: () => void) { this.listeners.push(listener); }
  unplug() { this.listeners.forEach((l) => l()); }
}

class FakeStream implements StreamLike {
  readonly track = new FakeTrack();
  getTracks() { return [this.track]; }
}

class FakeNode implements AudioNodeLike {
  connected: unknown[] = [];
  disconnected = false;
  connect(to: unknown) { this.connected.push(to); return to; }
  disconnect() { this.disconnected = true; }
}

class FakeProcessor extends FakeNode implements ProcessorLike {
  onaudioprocess: ProcessorLike['onaudioprocess'] = null;
  feed(samples: Float32Array) {
    this.onaudioprocess?.({ inputBuffer: { getChannelData: () => samples } });
  }
}

class FakeContext implements AudioContextLike {
  state = 'running';
  readonly destination = { destination: true };
  onstatechange: (() => void) | null = null;
  closed = false;
  resumeWorks = true;
  rejectSource = false;
  processor: FakeProcessor | null = null;
  nodes: FakeNode[] = [];
  constructor(readonly sampleRate: number) {}
  async resume() {
    if (this.resumeWorks) this.state = 'running';
  }
  async close() { this.closed = true; this.state = 'closed'; }
  createMediaStreamSource() {
    if (this.rejectSource) throw new Error('NotSupportedError');
    const n = new FakeNode();
    this.nodes.push(n);
    return n;
  }
  createScriptProcessor() {
    this.processor = new FakeProcessor();
    this.nodes.push(this.processor);
    return this.processor;
  }
  createGain() {
    const n = Object.assign(new FakeNode(), { gain: { value: 1 } });
    this.nodes.push(n);
    return n;
  }
  suspend() {
    this.state = 'suspended';
    this.onstatechange?.();
  }
}

interface Rig {
  session: CaptureSession;
  sent: RecordingOutbound[];
  views: CaptureView[];
  contexts: FakeContext[];
  streams: FakeStream[];
  resolveMic: (stream?: FakeStream) => void;
  rejectMic: (name: string) => void;
  setInputs(n: number): void;
  setDelegated(on: boolean): void;
  ctx(): FakeContext;
  last<T extends RecordingOutbound['type']>(type: T): Extract<RecordingOutbound, { type: T }> | undefined;
  of<T extends RecordingOutbound['type']>(type: T): Array<Extract<RecordingOutbound, { type: T }>>;
}

function rig(opts: { rate?: number; fallbackRate?: number } = {}): Rig {
  const sent: RecordingOutbound[] = [];
  const views: CaptureView[] = [];
  const contexts: FakeContext[] = [];
  const streams: FakeStream[] = [];
  let inputs = 1;
  let delegated = true;
  let pending: { resolve: (s: StreamLike) => void; reject: (e: unknown) => void } | null = null;
  const env: AudioEnv = {
    createContext: () => { const c = new FakeContext(opts.rate ?? 16_000); contexts.push(c); return c; },
    createDeviceRateContext: () => { const c = new FakeContext(opts.fallbackRate ?? 48_000); contexts.push(c); return c; },
    getUserMedia: () => new Promise((resolve, reject) => { pending = { resolve, reject }; }),
    microphoneDelegated: () => delegated,
    countAudioInputs: async () => inputs,
  };
  const session = new CaptureSession(env, (m) => sent.push(m), (v) => views.push(v));
  const r: Rig = {
    session,
    sent,
    views,
    contexts,
    streams,
    resolveMic: (stream = new FakeStream()) => { streams.push(stream); pending?.resolve(stream); },
    rejectMic: (name) => pending?.reject(Object.assign(new Error(name), { name })),
    setInputs: (n) => { inputs = n; },
    setDelegated: (on) => { delegated = on; },
    ctx: () => contexts[contexts.length - 1],
    last: (type) => sent.filter((m) => m.type === type).pop() as never,
    of: (type) => sent.filter((m) => m.type === type) as never,
  };
  return r;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const ID = 'session-0001-abcdef';

async function recording(r: Rig): Promise<void> {
  r.session.start();
  r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
  r.resolveMic();
  await tick();
  assert.equal(r.session.view().phase, 'recording');
}

function assertReleased(r: Rig, what: string): void {
  for (const c of r.contexts) assert.ok(c.closed, `${what}: audio context closed`);
  for (const s of r.streams) assert.ok(s.track.stopped, `${what}: microphone released`);
  for (const c of r.contexts) for (const n of c.nodes) assert.ok(n.disconnected, `${what}: nodes disconnected`);
  for (const c of r.contexts) if (c.processor) assert.equal(c.processor.onaudioprocess, null, `${what}: no audio callback left`);
}

const second = (rate: number) => new Float32Array(rate).fill(0.25);

async function run(): Promise<void> {
  // ------------------------------------------------ happy path at 16 kHz
  {
    const r = rig();
    r.session.start();
    assert.equal(r.contexts.length, 1, 'the context is created inside the click');
    assert.deepEqual(r.sent, [{ type: 'transcribe:record/start' }]);
    assert.equal(r.session.view().phase, 'requesting');

    r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    assert.equal(r.session.view().phase, 'permission', 'waiting for the OS permission');
    r.resolveMic();
    await tick();
    assert.equal(r.session.view().phase, 'recording');
    assert.deepEqual(r.last('transcribe:record/captureStarted'), { type: 'transcribe:record/captureStarted', sessionId: ID });
    const ctx = r.ctx();
    assert.ok(ctx.processor);
    assert.deepEqual(ctx.nodes[2].connected, [ctx.destination], 'processor output goes through the mute gain');
    assert.equal((ctx.nodes[2] as unknown as { gain: { value: number } }).gain.value, 0, 'nothing plays back');

    // 2.5 s in 4096-sample buffers → two full chunks.
    const audio = new Float32Array(40_000).fill(0.5);
    for (let i = 0; i < audio.length; i += 4096) ctx.processor.feed(audio.subarray(i, i + 4096));
    const chunks = r.of('transcribe:record/chunk');
    assert.deepEqual(chunks.map((c) => [c.sequence, c.sampleCount]), [[0, 16_000], [1, 16_000]]);
    assert.equal(Buffer.from(chunks[0].pcm, 'base64').readInt16LE(0), 16384);
    assert.equal(r.session.view().savedSeconds, 0, 'nothing is claimed before the host confirms');

    r.session.handleEvent({ type: 'transcribe:record/ack', sessionId: ID, sequence: 0 });
    r.session.handleEvent({ type: 'transcribe:record/ack', sessionId: ID, sequence: 0 });
    r.session.handleEvent({ type: 'transcribe:record/ack', sessionId: 'other-session-0000', sequence: 1 });
    assert.equal(r.session.view().savedSeconds, 1);

    r.session.stop();
    const all = r.of('transcribe:record/chunk');
    assert.deepEqual(all.map((c) => [c.sequence, c.sampleCount]), [[0, 16_000], [1, 16_000], [2, 8_000]], 'the remainder is sent on Stop');
    assert.deepEqual(r.last('transcribe:record/stop'), { type: 'transcribe:record/stop', sessionId: ID, finalSequence: 2, reason: 'user' });
    assert.equal(r.session.view().phase, 'stopping');
    assertReleased(r, 'stop');

    // Audio arriving after Stop is ignored.
    ctx.processor.feed(new Float32Array(20_000));
    assert.equal(r.of('transcribe:record/chunk').length, 3);

    // "Saving…" until the host lets go of the session.
    r.session.syncHost({ phase: 'recording', sessionId: ID });
    assert.equal(r.session.view().phase, 'stopping');
    r.session.syncHost({ phase: 'finalizing', sessionId: ID });
    assert.equal(r.session.view().phase, 'stopping');
    r.session.syncHost({ phase: 'idle', sessionId: null });
    assert.equal(r.session.view().phase, 'idle');
    assert.equal(r.session.view().sessionId, null);
  }

  // ------------------------------------------------ fallback: device rate + resampler
  {
    const r = rig({ rate: 16_000, fallbackRate: 48_000 });
    r.session.start();
    r.ctx().rejectSource = true;
    r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    r.resolveMic();
    await tick();
    assert.equal(r.session.view().phase, 'recording');
    assert.equal(r.contexts.length, 2);
    assert.ok(r.contexts[0].closed, 'the refused 16 kHz context is closed');
    const ctx = r.ctx();
    assert.equal(ctx.sampleRate, 48_000);
    const audio = second(48_000);
    for (let i = 0; i < audio.length; i += 4096) ctx.processor!.feed(audio.subarray(i, i + 4096));
    assert.deepEqual(r.of('transcribe:record/chunk').map((c) => c.sampleCount), [16_000], 'one second at 48 kHz is one 16 kHz chunk');
    r.session.cancel();
    assertReleased(r, 'fallback cancel');
  }
  {
    // The click could not create a context at all: fall back when the host answers.
    const r = rig();
    const env = (r.session as unknown as { env: AudioEnv }).env;
    const make = env.createContext;
    env.createContext = () => { throw new Error('NotSupportedError'); };
    r.session.start();
    env.createContext = make;
    r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    r.resolveMic();
    await tick();
    assert.equal(r.session.view().phase, 'recording');
    assert.equal(r.ctx().sampleRate, 48_000);
    r.session.cancel();
  }
  {
    // A fallback context that stays suspended outside the click fails honestly.
    const r = rig();
    const env = (r.session as unknown as { env: AudioEnv }).env;
    env.createDeviceRateContext = () => {
      const c = new FakeContext(48_000);
      c.state = 'suspended';
      c.resumeWorks = false;
      c.resume = () => new Promise(() => {}); // hangs, as Phase 0 saw without a gesture
      r.contexts.push(c);
      return c;
    };
    r.session.start();
    r.ctx().rejectSource = true;
    r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    r.resolveMic();
    await new Promise((resolve) => setTimeout(resolve, 1700));
    assert.deepEqual(r.last('transcribe:record/captureFailed'), { type: 'transcribe:record/captureFailed', sessionId: ID, code: 'unexpected' });
    assert.equal(r.session.view().phase, 'idle');
    assertReleased(r, 'hung resume');
  }

  // ------------------------------------------------ the host started nothing
  {
    const r = rig();
    r.session.start();
    r.session.handleEvent({ type: 'transcribe:record/notStarted' });
    assert.equal(r.session.view().phase, 'idle');
    assert.ok(r.ctx().closed, 'the click-time context is released');
    r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    assert.deepEqual(r.last('transcribe:record/cancel'), { type: 'transcribe:record/cancel', sessionId: ID }, 'a begin nobody asked for is released');
    assert.equal(r.session.view().phase, 'idle');
  }

  // ------------------------------------------------ permission: denied, missing, busy, packaging
  for (const [name, inputs, delegated, code] of [
    ['NotAllowedError', 1, true, 'os-denied'],
    ['NotAllowedError', 1, false, 'internal-config'],
    ['NotFoundError', 0, true, 'no-device'],
    ['NotFoundError', 2, true, 'os-denied'],
    ['NotReadableError', 1, true, 'device-busy'],
  ] as const) {
    const r = rig();
    r.setInputs(inputs);
    r.setDelegated(delegated);
    r.session.start();
    r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    r.rejectMic(name);
    await tick();
    assert.deepEqual(r.last('transcribe:record/captureFailed'), { type: 'transcribe:record/captureFailed', sessionId: ID, code }, `${name}/${inputs}/${delegated}`);
    assert.equal(r.session.view().phase, 'idle');
    assert.equal(r.of('transcribe:record/captureStarted').length, 0);
    assertReleased(r, name);
  }

  // ------------------------------------------------ Cancel while the OS is asking
  {
    const r = rig();
    r.session.start();
    r.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    r.session.cancel();
    assert.deepEqual(r.last('transcribe:record/cancel'), { type: 'transcribe:record/cancel', sessionId: ID });
    assert.equal(r.session.view().phase, 'idle');
    r.resolveMic(); // the user answers the OS dialog afterwards
    await tick();
    assert.ok(r.streams[0].track.stopped, 'a late permission grant does not keep the microphone open');
    assert.equal(r.of('transcribe:record/captureStarted').length, 0);
    assertReleased(r, 'cancel during permission');

    const denied = rig();
    denied.session.start();
    denied.session.handleEvent({ type: 'transcribe:record/begin', sessionId: ID });
    denied.session.cancel();
    denied.rejectMic('NotAllowedError');
    await tick();
    assert.equal(denied.of('transcribe:record/captureFailed').length, 0, 'a late denial after Cancel is not reported');
  }

  // ------------------------------------------------ the host ends the session
  {
    const r = rig();
    await recording(r);
    r.session.handleEvent({ type: 'transcribe:record/ended', sessionId: 'other-session-0000' });
    assert.equal(r.session.view().phase, 'recording', 'another session is not ours');
    r.session.handleEvent({ type: 'transcribe:record/ended', sessionId: ID });
    assert.equal(r.session.view().phase, 'stopping');
    assert.equal(r.of('transcribe:record/stop').length, 0, 'the host already stopped it');
    assertReleased(r, 'host ended');
    r.session.syncHost({ phase: 'idle', sessionId: null });
    assert.equal(r.session.view().phase, 'idle');
  }

  // ------------------------------------------------ backpressure: stop and save, never buffer without limit
  {
    const r = rig();
    await recording(r);
    const ctx = r.ctx();
    for (let n = 0; n < MAX_UNACKED_CHUNKS; n++) ctx.processor!.feed(new Float32Array(16_000));
    assert.equal(r.of('transcribe:record/stop').length, 0, `${MAX_UNACKED_CHUNKS} unconfirmed chunks are allowed`);
    ctx.processor!.feed(new Float32Array(16_000));
    assert.deepEqual(r.last('transcribe:record/stop'), { type: 'transcribe:record/stop', sessionId: ID, finalSequence: MAX_UNACKED_CHUNKS, reason: 'too-slow' });
    assert.equal(r.of('transcribe:record/chunk').length, MAX_UNACKED_CHUNKS + 1, 'the chunk that crossed the bound was still sent');
    assertReleased(r, 'too slow');
  }
  {
    // Confirmed chunks free the budget.
    const r = rig();
    await recording(r);
    for (let n = 0; n < 20; n++) {
      r.ctx().processor!.feed(new Float32Array(16_000));
      r.session.handleEvent({ type: 'transcribe:record/ack', sessionId: ID, sequence: n });
    }
    assert.equal(r.of('transcribe:record/stop').length, 0);
    assert.equal(r.session.view().savedSeconds, 20);
    r.session.stop();
  }

  // ------------------------------------------------ suspension: one resume, then an honest stop
  {
    const r = rig();
    await recording(r);
    r.ctx().suspend();
    await tick();
    assert.equal(r.session.view().phase, 'recording', 'a resume that works keeps recording');

    r.ctx().resumeWorks = false;
    r.ctx().processor!.feed(new Float32Array(1000));
    r.ctx().suspend();
    await tick();
    await tick();
    assert.deepEqual(r.last('transcribe:record/stop'), { type: 'transcribe:record/stop', sessionId: ID, finalSequence: 0, reason: 'suspended' });
    assertReleased(r, 'suspended');
  }

  // ------------------------------------------------ device unplugged
  {
    const r = rig();
    await recording(r);
    r.streams[0].track.unplug();
    assert.equal(r.last('transcribe:record/stop')?.reason, 'device-lost');
    assert.equal(r.last('transcribe:record/stop')?.finalSequence, -1, 'no audio yet: nothing to claim');
    assertReleased(r, 'device lost');
  }

  // ------------------------------------------------ one capture at a time, and dispose
  {
    const r = rig();
    await recording(r);
    r.session.start();
    assert.equal(r.of('transcribe:record/start').length, 1, 'Record does nothing while recording');
    r.session.dispose();
    assertReleased(r, 'dispose');
    assert.equal(r.of('transcribe:record/stop').length, 0, 'the host keeps the partial for recovery');
    assert.equal(r.session.view().phase, 'idle');
  }

  assert.equal(new CaptureSession({} as AudioEnv, () => {}, () => {}).handleEvent({ type: 'transcribe:state' }), false, 'other messages pass through');

  console.log('captureSession.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

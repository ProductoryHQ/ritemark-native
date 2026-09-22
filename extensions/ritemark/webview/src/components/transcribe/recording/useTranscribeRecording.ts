/**
 * Sprint 118 R1–R3 — React binding for `CaptureSession` with the real browser
 * audio environment. The Transcribe panel calls `start` from the Record click.
 */

import { useEffect, useRef, useState } from 'react';
import { vscode } from '../../../lib/vscode';
import { SAMPLE_RATE } from './capture';
import { CaptureSession, type AudioContextLike, type AudioEnv, type CaptureView, type HostRecordingView, type StreamLike } from './captureSession';

/**
 * Whether the webview iframe may use the microphone at all (Permissions
 * Policy). Without it getUserMedia fails before macOS is ever asked — a
 * packaging bug, not the user's settings (GH #116, same check as dictation).
 */
function microphoneDelegated(): boolean {
  try {
    const policy = (document as Document & { featurePolicy?: { allowsFeature(feature: string): boolean } }).featurePolicy;
    return policy ? policy.allowsFeature('microphone') : true;
  } catch {
    return true;
  }
}

async function countAudioInputs(): Promise<number> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audioinput').length;
  } catch {
    return -1;
  }
}

export const browserAudioEnv: AudioEnv = {
  createContext: () => new AudioContext({ sampleRate: SAMPLE_RATE }) as unknown as AudioContextLike,
  createDeviceRateContext: () => new AudioContext() as unknown as AudioContextLike,
  // Unprocessed input, like a voice recorder: echo cancellation would remove
  // the other side of a call played through the speakers, and the
  // transcription engines handle noise and level themselves.
  getUserMedia: () =>
    navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    }) as unknown as Promise<StreamLike>,
  microphoneDelegated,
  countAudioInputs,
};

export interface TranscribeRecording {
  view: CaptureView;
  start(): void;
  stop(): void;
  cancel(): void;
}

export function useTranscribeRecording(host: HostRecordingView | null): TranscribeRecording {
  const [view, setView] = useState<CaptureView>({ phase: 'idle', sessionId: null, savedSeconds: 0 });
  const sessionRef = useRef<CaptureSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new CaptureSession(browserAudioEnv, (message) => vscode.postMessage(message), setView);
  }
  const session = sessionRef.current;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      session.handleEvent(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      session.dispose();
    };
  }, [session]);

  useEffect(() => {
    session.syncHost(host);
  }, [session, host]);

  return {
    view,
    start: () => session.start(),
    stop: () => session.stop('user'),
    cancel: () => session.cancel(),
  };
}

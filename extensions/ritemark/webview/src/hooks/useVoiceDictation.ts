import { useState, useCallback, useRef, useEffect } from 'react'
import { sendToExtension, onMessage, emitInternalEvent } from '../bridge'
import { DICTATION_SETTINGS_KEY, DEFAULT_DICTATION_SETTINGS } from '../components/DictationSettingsModal'
import { classifyCaptureError } from '../components/transcribe/recording/capture'
import {
  dictationStateCopy,
  HOST_PROBLEMS,
  problemFromCapture,
  type DictationMode,
  type DictationProblem,
  type ProblemStage,
} from '../components/dictationProblems'
import { MUTED_SECONDS, reachesLiveLevel } from './dictationLevel'

/**
 * preparing: the host checks the engine and model, the microphone starts.
 * listening/processing: recording (processing = live text on its way).
 * finishing: Stop was pressed; the host is still turning speech into text.
 */
export type DictationState = 'idle' | 'preparing' | 'listening' | 'processing' | 'finishing' | 'error'

/** Deferred mode sends audio to the host at this pace; it transcribes 28 s pieces. */
const DEFERRED_SEND_MS = 5000
/** With no estimate yet, "This can take up to a minute" turns into "Still processing" after this. */
const UNMEASURED_WAIT_SECONDS = 60

/**
 * Get chunk duration from localStorage settings
 */
function getChunkDuration(): number {
  try {
    const stored = localStorage.getItem(DICTATION_SETTINGS_KEY)
    if (stored) {
      const settings = JSON.parse(stored)
      return settings.chunkDuration || DEFAULT_DICTATION_SETTINGS.chunkDuration
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_DICTATION_SETTINGS.chunkDuration
}

/** Sprint 129 R5/R6: why dictation stopped, shown by DictationProblemDialog. */
export interface DictationProblemState {
  code: DictationProblem
  /** The host's own text for "generic"; the model size for "model-missing". */
  detail?: string
  stage?: ProblemStage
}

export interface VoiceDictationHook {
  state: DictationState
  /** Sprint 129 R12: live text, or all of it after Stop. */
  mode: DictationMode
  problem: DictationProblemState | null
  /** Close the problem dialog and return to idle. */
  dismissProblem: () => void
  isListening: boolean
  currentLanguage: string | null
  startDictation: (language: string) => Promise<void>
  stopDictation: (options?: { keepProblem?: boolean }) => void
  /** Click while preparing: the microphone will not start. */
  cancelStart: () => void
}

/**
 * Resample audio from source rate to target rate using linear interpolation
 */
function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return samples
  }

  const ratio = fromRate / toRate
  const newLength = Math.round(samples.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1)
    const t = srcIndex - srcIndexFloor

    // Linear interpolation
    result[i] = samples[srcIndexFloor] * (1 - t) + samples[srcIndexCeil] * t
  }

  return result
}

/**
 * Convert Float32Array PCM samples to WAV format
 * Whisper expects: 16kHz, mono, 16-bit PCM
 */
function float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataLength = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // AudioFormat (PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true) // ByteRate
  view.setUint16(32, numChannels * bytesPerSample, true) // BlockAlign
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  // Convert float32 samples to int16
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return buffer
}

/**
 * Convert ArrayBuffer to base64 string without stack overflow
 * Uses chunked approach for large buffers
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

/**
 * Check whether the microphone feature is delegated to this webview iframe
 * via Permissions Policy. When the iframe's allow attribute lacks 'microphone',
 * getUserMedia fails with NotAllowedError before any OS permission is consulted
 * (GH #116) — a Ritemark packaging bug, not something the user can fix.
 */
function isMicrophoneDelegated(): boolean {
  try {
    const fp = (document as Document & {
      featurePolicy?: { allowsFeature(feature: string): boolean }
    }).featurePolicy
    return fp ? fp.allowsFeature('microphone') : true
  } catch {
    return true
  }
}

/**
 * Count audio input devices visible to this context.
 * Returns -1 if enumeration itself fails.
 */
async function countAudioInputs(): Promise<number> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(d => d.kind === 'audioinput').length
  } catch {
    return -1
  }
}

/**
 * Hook for voice dictation using Web Audio API
 *
 * Captures microphone audio as raw PCM and converts to WAV format
 * for whisper.cpp transcription.
 *
 * Audio format: 16kHz, mono, 16-bit PCM (WAV)
 */
export function useVoiceDictation(languageName: (code: string) => string = code => code): VoiceDictationHook {
  const [state, setState] = useState<DictationState>('idle')
  const [mode, setMode] = useState<DictationMode>('live')
  const [problem, setProblem] = useState<DictationProblemState | null>(null)
  const [currentLanguage, setCurrentLanguage] = useState<string | null>(null)
  // undefined until the host says; null when nothing is measured on this computer yet
  const [waitSeconds, setWaitSeconds] = useState<number | null | undefined>(undefined)
  const [overdue, setOverdue] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])
  const sendIntervalRef = useRef<number | null>(null)
  const actualSampleRateRef = useRef<number>(16000)
  const selectedLanguageRef = useRef<string>('en')
  /** True from microphone start to Stop, whatever the button shows meanwhile. */
  const recordingRef = useRef<boolean>(false)
  const startCancelledRef = useRef<boolean>(false)
  /** Samples seen so far, and whether any reached a live microphone's level (dictationLevel.ts). */
  const silenceRef = useRef({ samples: 0, heard: false })
  const stopRef = useRef<() => void>(() => undefined)
  const modeRef = useRef<DictationMode>('live')

  const isListening = state === 'listening'

  // Sprint 129 R12: the host says which way this computer dictates.
  useEffect(() => {
    const unsubscribe = onMessage((message: { type: string; [key: string]: unknown }) => {
      if (message.type === 'dictation:mode' && (message.mode === 'live' || message.mode === 'deferred')) {
        modeRef.current = message.mode
        setMode(message.mode)
      }
    })
    sendToExtension('dictation:getMode', {})
    return unsubscribe
  }, [])

  // The placeholder at the cursor follows the state (App.tsx inserts it).
  useEffect(() => {
    const active = state !== 'idle' && state !== 'error'
    const copy = active ? dictationStateCopy(state, mode, languageName(currentLanguage || 'en'), { seconds: waitSeconds, overdue }) : null
    if (copy?.placeholder) {
      emitInternalEvent('dictation:placeholder', { text: copy.placeholder })
    } else {
      emitInternalEvent('dictation:placeholder-clear')
    }
  }, [state, mode, currentLanguage, waitSeconds, overdue, languageName])

  // "Speak, then text": past 1.5x the estimate, say the computer needs longer.
  useEffect(() => {
    if (state !== 'finishing' || mode !== 'deferred') return
    const timer = window.setTimeout(() => setOverdue(true), (waitSeconds ? waitSeconds * 1.5 : UNMEASURED_WAIT_SECONDS) * 1000)
    return () => window.clearTimeout(timer)
  }, [state, mode, waitSeconds])

  /**
   * Start dictation - first checks model, then starts capture
   */
  const startDictation = useCallback(async (language: string) => {
    try {
      startCancelledRef.current = false
      setState('preparing')
      setProblem(null)
      setCurrentLanguage(language)
      selectedLanguageRef.current = language

      // First, tell extension to prepare (check model, download if needed)
      sendToExtension('dictation:prepare', { language })

      // Wait for 'dictation:ready' message before starting mic capture
    } catch (err) {
      console.error('[Dictation] Failed to prepare dictation:', err)
      setProblem({ code: 'engine-failed' })
      setState('error')
    }
  }, [])

  /**
   * Actually start microphone capture (called after model is ready)
   * Uses Web Audio API to capture raw PCM samples
   */
  const startMicCapture = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      streamRef.current = stream

      // Create AudioContext for raw PCM capture
      // Don't force 16kHz - browsers often ignore it and use native rate (48kHz on macOS)
      // We'll resample to 16kHz before sending to whisper
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      actualSampleRateRef.current = audioContext.sampleRate

      // Resume AudioContext if suspended (required for user gesture policy)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      // Create source from microphone stream
      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Create ScriptProcessor for raw PCM access
      // Buffer size of 4096 samples at 48kHz = ~85ms chunks (will be resampled to 16kHz)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      // Collect audio samples
      silenceRef.current = { samples: 0, heard: false }
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        // Copy the samples (they're reused by the audio system)
        audioBufferRef.current.push(new Float32Array(inputData))
        const silence = silenceRef.current
        if (!silence.heard) {
          silence.heard = reachesLiveLevel(inputData)
          silence.samples += inputData.length
          if (!silence.heard && silence.samples >= actualSampleRateRef.current * MUTED_SECONDS) {
            // Muted or blocked: stop now. The host finds only silence and says so.
            silence.heard = true
            window.setTimeout(() => stopRef.current(), 0)
          }
        }
      }
      // Connect: mic -> processor -> muted gain (prevents echo/feedback)
      // ScriptProcessor needs to be connected to output to process, but we mute it
      const muteNode = audioContext.createGain()
      muteNode.gain.value = 0 // Mute - prevents mic audio from playing through speakers
      source.connect(processor)
      processor.connect(muteNode)
      muteNode.connect(audioContext.destination)

      // Send accumulated audio at configured interval. In deferred mode the
      // setting means nothing to the user (R12); the host cuts 28 s pieces.
      const chunkDuration = modeRef.current === 'deferred' ? DEFERRED_SEND_MS : getChunkDuration()
      sendIntervalRef.current = window.setInterval(() => {
        if (audioBufferRef.current.length > 0) {
          // Concatenate all buffered samples
          const totalLength = audioBufferRef.current.reduce((sum, arr) => sum + arr.length, 0)
          const combined = new Float32Array(totalLength)
          let offset = 0
          for (const chunk of audioBufferRef.current) {
            combined.set(chunk, offset)
            offset += chunk.length
          }

          // Resample to 16kHz (whisper requirement) and convert to WAV
          const resampled = resample(combined, actualSampleRateRef.current, 16000)
          const wavBuffer = float32ToWav(resampled, 16000)
          const base64 = arrayBufferToBase64(wavBuffer)

          // Live: this part of the speech is now being turned into text.
          if (modeRef.current === 'live') {
            setState(current => current === 'listening' ? 'processing' : current)
          }
          sendToExtension('dictation:audioChunk', { audio: base64 })

          // Clear buffer
          audioBufferRef.current = []
        }
      }, chunkDuration)

      // Notify extension that dictation has started with selected language
      sendToExtension('dictation:start', { language: selectedLanguageRef.current })

      recordingRef.current = true
      setState('listening')

    } catch (err) {
      console.error('[Dictation] Failed to start mic capture:', err)
      // Sprint 129 R5: the same reading as Transcribe Record. A Permissions-Policy
      // block is a Ritemark packaging bug (GH #116), not the user's settings; a
      // NotFoundError while devices exist means the OS is refusing access.
      const name = err instanceof Error ? err.name : undefined
      const delegated = isMicrophoneDelegated()
      const audioInputs = name === 'NotFoundError' || name === 'DevicesNotFoundError' ? await countAudioInputs() : 1
      const code = classifyCaptureError(name, { delegated, audioInputs })
      if (code === 'internal-config') {
        console.error('[Dictation] Microphone is not delegated to the webview iframe (Permissions Policy). This is a Ritemark packaging bug — see GH #116.')
      }
      setProblem({ code: problemFromCapture(code) })
      setState('error')
    }
  }, [])

  /**
   * Stop microphone capture and cleanup
   */
  const stopDictation = useCallback((options?: { keepProblem?: boolean }) => {
    // Guard: only do work if we have active audio resources
    const hasActiveResources = streamRef.current || audioContextRef.current || sendIntervalRef.current

    // Stop send interval
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current)
      sendIntervalRef.current = null
    }

    // Send any remaining audio
    if (audioBufferRef.current.length > 0) {
      const totalLength = audioBufferRef.current.reduce((sum, arr) => sum + arr.length, 0)
      const combined = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of audioBufferRef.current) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      const resampled = resample(combined, actualSampleRateRef.current, 16000)
      const wavBuffer = float32ToWav(resampled, 16000)
      const base64 = arrayBufferToBase64(wavBuffer)
      sendToExtension('dictation:audioChunk', { audio: base64 })
      audioBufferRef.current = []
    }

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    // Disconnect source
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop all audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    recordingRef.current = false

    // Only notify extension and emit events if we had active resources
    if (hasActiveResources) {
      sendToExtension('dictation:stop', {})
    }

    // A host-reported problem stops the microphone but keeps its dialog open.
    if (options?.keepProblem) {
      setState('error')
    } else if (hasActiveResources) {
      // R8/R12: the host still turns the last speech into text; it answers
      // with "idle" when the text is in.
      setOverdue(false)
      setWaitSeconds(undefined)
      setState('finishing')
      setProblem(null)
    } else {
      setState('idle')
      setProblem(null)
    }
  }, [])

  const cancelStart = useCallback(() => {
    startCancelledRef.current = true
    setState('idle')
  }, [])

  stopRef.current = stopDictation

  const dismissProblem = useCallback(() => {
    setProblem(null)
    setState('idle')
  }, [])


  /**
   * Listen for messages from extension
   */
  useEffect(() => {
    const handleMessage = (message: { type: string; [key: string]: unknown }) => {
      switch (message.type) {
        case 'dictation:ready':
          // A click while preparing cancelled the start: leave the microphone off.
          if (startCancelledRef.current) {
            startCancelledRef.current = false
            break
          }
          startMicCapture()
          break

        case 'dictation:cancelled':
          setState(current => current === 'preparing' ? 'idle' : current)
          break

        case 'dictation:status': {
          const status = message.status as string
          if (status === 'processing' || status === 'listening') {
            // Only while recording; after Stop the button keeps "finishing".
            if (recordingRef.current) setState(status)
          } else if (status === 'finishing') {
            setWaitSeconds(typeof message.waitSeconds === 'number' ? message.waitSeconds : message.waitSeconds === null ? null : undefined)
            setState(current => current === 'error' ? current : 'finishing')
          } else if (status === 'idle') {
            setOverdue(false)
            setWaitSeconds(undefined)
            setState(current => current === 'error' || recordingRef.current ? current : 'idle')
          }
          break
        }

        case 'dictation:problem': {
          // Sprint 129 R6: the engine cannot run, or the model is missing.
          const code = message.problem as DictationProblem
          const detail = typeof message.detail === 'string' ? message.detail : undefined
          const stage: ProblemStage | undefined = message.stage === 'transcribing' ? 'transcribing' : undefined
          setProblem(HOST_PROBLEMS.includes(code) ? { code, detail, stage } : { code: 'generic' })
          stopDictation({ keepProblem: true })
          break
        }

        case 'dictation:error':
          setProblem({ code: 'generic', detail: (message.error as string) || undefined })
          stopDictation({ keepProblem: true })
          break

        case 'dictation:stop-capture':
          // Sprint 129 R8: the computer could not keep up. The host has already
          // said so in a toast and still inserts what was captured.
          stopDictation()
          break

        case 'dictation:transcription':
          // App.tsx inserts the text where the placeholder is, then puts the
          // current placeholder back after it while dictation goes on.
          break
      }
    }

    const unsubscribe = onMessage(handleMessage)
    return unsubscribe
  }, [stopDictation, startMicCapture])

  /**
   * Cleanup on unmount only
   * NOTE: We use recordingRef instead of state to avoid the cleanup
   * running on every state change (which was causing recording to stop
   * when transitioning from 'listening' to 'processing')
   */
  useEffect(() => {
    return () => {
      // Only cleanup on actual unmount; recording, whatever the button shows
      if (recordingRef.current) {
        stopDictation()
      }
    }
  }, [stopDictation]) // Removed 'state' from deps - only run cleanup on unmount

  return {
    state,
    mode,
    problem,
    dismissProblem,
    isListening,
    currentLanguage,
    startDictation,
    stopDictation,
    cancelStart,
  }
}

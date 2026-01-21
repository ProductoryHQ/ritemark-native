import { useState, useCallback, useRef, useEffect } from 'react'
import { sendToExtension, onMessage, emitInternalEvent } from '../bridge'
import { DICTATION_SETTINGS_KEY, DEFAULT_DICTATION_SETTINGS } from '../components/DictationSettingsModal'

export type DictationState = 'idle' | 'listening' | 'processing' | 'error'

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

export interface VoiceDictationHook {
  state: DictationState
  error: string | null
  isListening: boolean
  currentLanguage: string | null
  startDictation: (language: string) => Promise<void>
  stopDictation: () => void
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
 * Hook for voice dictation using Web Audio API
 *
 * Captures microphone audio as raw PCM and converts to WAV format
 * for whisper.cpp transcription.
 *
 * Audio format: 16kHz, mono, 16-bit PCM (WAV)
 */
export function useVoiceDictation(): VoiceDictationHook {
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [currentLanguage, setCurrentLanguage] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioBufferRef = useRef<Float32Array[]>([])
  const sendIntervalRef = useRef<number | null>(null)
  const actualSampleRateRef = useRef<number>(16000)
  const selectedLanguageRef = useRef<string>('en')
  const isListeningRef = useRef<boolean>(false) // Track listening state for callbacks

  const isListening = state === 'listening'

  // Keep ref in sync with state (for use in callbacks that may have stale closures)
  useEffect(() => {
    isListeningRef.current = state === 'listening'
  }, [state])

  /**
   * Start dictation - first checks model, then starts capture
   */
  const startDictation = useCallback(async (language: string) => {
    try {
      setState('processing')
      setError(null)
      setCurrentLanguage(language)
      selectedLanguageRef.current = language

      // First, tell extension to prepare (check model, download if needed)
      sendToExtension('dictation:prepare', { language })

      // Wait for 'dictation:ready' message before starting mic capture
    } catch (err) {
      console.error('[Dictation] Failed to prepare dictation:', err)
      setError('Failed to start dictation. Please try again.')
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
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        // Copy the samples (they're reused by the audio system)
        audioBufferRef.current.push(new Float32Array(inputData))
      }
      // Connect: mic -> processor -> muted gain (prevents echo/feedback)
      // ScriptProcessor needs to be connected to output to process, but we mute it
      const muteNode = audioContext.createGain()
      muteNode.gain.value = 0 // Mute - prevents mic audio from playing through speakers
      source.connect(processor)
      processor.connect(muteNode)
      muteNode.connect(audioContext.destination)

      // Send accumulated audio at configured interval
      const chunkDuration = getChunkDuration()
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

          // Notify UI that we're processing (changes "Listening..." to "Processing...")
          emitInternalEvent('dictation:processing')
          sendToExtension('dictation:audioChunk', { audio: base64 })

          // Clear buffer
          audioBufferRef.current = []
        }
      }, chunkDuration)

      // Notify extension that dictation has started with selected language
      sendToExtension('dictation:start', { language: selectedLanguageRef.current })

      setState('listening')
      emitInternalEvent('dictation:listening-started')

    } catch (err) {
      console.error('[Dictation] Failed to start mic capture:', err)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please enable microphone permissions.')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone.')
        } else {
          setError(`Failed to start dictation: ${err.message}`)
        }
      } else {
        setError('Failed to start dictation. Please try again.')
      }
      setState('error')
    }
  }, [])

  /**
   * Stop microphone capture and cleanup
   */
  const stopDictation = useCallback(() => {
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

    // Notify extension
    sendToExtension('dictation:stop', {})

    setState('idle')
    emitInternalEvent('dictation:listening-stopped')
    setError(null)
  }, [])


  /**
   * Listen for messages from extension
   */
  useEffect(() => {
    const handleMessage = (message: { type: string; [key: string]: unknown }) => {
      switch (message.type) {
        case 'dictation:ready':
          startMicCapture()
          break

        case 'dictation:cancelled':
          setState('idle')
          break

        case 'dictation:status':
          const status = message.status as string
          if (status === 'processing') {
            setState('processing')
          } else if (status === 'listening') {
            setState('listening')
          } else if (status === 'idle') {
            setState('idle')
          }
          break

        case 'dictation:error':
          const errorMsg = message.error as string
          setError(errorMsg || 'An error occurred during dictation')
          setState('error')
          stopDictation()
          break

        case 'dictation:transcription':
          // Transcription is handled by App.tsx for inserting text
          // But we need to re-show "Listening..." if still recording
          if (isListeningRef.current) {
            emitInternalEvent('dictation:listening-started')
          }
          break
      }
    }

    onMessage(handleMessage)
  }, [stopDictation, startMicCapture])

  /**
   * Cleanup on unmount only
   * NOTE: We use isListeningRef instead of state to avoid the cleanup
   * running on every state change (which was causing recording to stop
   * when transitioning from 'listening' to 'processing')
   */
  useEffect(() => {
    return () => {
      // Only cleanup on actual unmount, check ref for current state
      if (isListeningRef.current) {
        stopDictation()
      }
    }
  }, [stopDictation]) // Removed 'state' from deps - only run cleanup on unmount

  return {
    state,
    error,
    isListening,
    currentLanguage,
    startDictation,
    stopDictation,
  }
}

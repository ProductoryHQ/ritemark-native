# whisper-node Integration Research

**Sprint:** 22 - Voice Dictation
**Date:** 2026-01-17
**Status:** Phase 1 Research

---

## Overview

This document details the technical approach for integrating whisper.cpp into RiteMark via the whisper-node npm package.

## Package: whisper-node

- **npm:** https://www.npmjs.com/package/whisper-node
- **GitHub:** https://github.com/ariym/whisper-node
- **Version:** Latest stable (check npm for current)
- **License:** MIT

### Key Features
- Node.js bindings for whisper.cpp
- Supports all whisper.cpp models (tiny, base, small, medium, large)
- Multi-language support (99 languages including Estonian)
- Voice Activity Detection (VAD) built-in
- Streaming and batch transcription modes
- CPU and GPU (Metal) acceleration on macOS

### Installation Requirements
1. **Node.js** - v16+ (already satisfied by VS Code extension environment)
2. **FFmpeg** - Required for audio format conversion
   - macOS: `brew install ffmpeg` (may need to bundle or document)
3. **Native compilation** - Requires C++ compiler (Xcode Command Line Tools on macOS)

---

## Model Selection

### Tiny Multilingual Model
- **Size:** ~75MB
- **Languages:** 99 languages (including Estonian, English, etc.)
- **Speed:** Fastest (real-time on Apple Silicon)
- **Accuracy:** Good for most use cases (5-10% WER)
- **Memory:** ~500MB RAM during inference
- **Recommendation:** Start here, upgrade to base if accuracy insufficient

### Model Comparison
| Model | Size | Speed | Accuracy | Memory |
|-------|------|-------|----------|--------|
| tiny | ~75MB | 32x realtime | Good | ~500MB |
| base | ~150MB | 16x realtime | Better | ~700MB |
| small | ~500MB | 6x realtime | High | ~1.5GB |

---

## Audio Capture (Webview)

### Web Audio API Approach
```typescript
// In webview: Capture microphone audio
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1, // Mono
    sampleRate: 16000, // 16kHz (whisper.cpp requirement)
    echoCancellation: true,
    noiseSuppression: true
  }
});

const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus' // or audio/wav
});

mediaRecorder.ondataavailable = (event) => {
  const audioChunk = event.data;
  // Convert to format whisper expects (WAV, 16kHz, mono)
  sendToExtension('audioChunk', {
    audio: await audioChunkToBase64(audioChunk)
  });
};

mediaRecorder.start(1000); // Capture chunks every 1 second
```

### Audio Format Conversion
whisper.cpp requires:
- **Format:** WAV or raw PCM
- **Sample Rate:** 16kHz
- **Channels:** Mono (1 channel)
- **Bit Depth:** 16-bit

Options:
1. **FFmpeg (server-side)** - Convert in extension using FFmpeg
2. **AudioContext (client-side)** - Convert in webview before sending
3. **Native format** - Use WAV directly if browser supports

**Recommendation:** AudioContext conversion in webview to reduce extension load.

---

## Extension Integration

### Installation
```bash
cd extensions/ritemark
npm install whisper-node
```

### Basic Usage Example
```typescript
// src/voiceDictation.ts
import { whisper } from 'whisper-node';

// Initialize whisper with tiny multilingual model
const transcriber = whisper('/path/to/tiny.bin', {
  modelName: 'tiny',
  whisperOptions: {
    language: 'auto', // Auto-detect or force 'et' for Estonian
    task: 'transcribe',
    word_timestamps: false,
  }
});

// Transcribe audio file (or audio buffer)
async function transcribeAudio(audioFilePath: string): Promise<string> {
  try {
    const result = await transcriber.transcribe(audioFilePath);
    return result.text.trim();
  } catch (error) {
    console.error('Transcription failed:', error);
    throw error;
  }
}
```

### Streaming Mode
```typescript
// For real-time dictation, use streaming API
const stream = transcriber.stream(audioFilePath);

stream.on('data', (chunk) => {
  // Send partial transcription to webview immediately
  postMessage('transcriptionChunk', { text: chunk.text });
});

stream.on('end', () => {
  postMessage('dictationComplete');
});

stream.on('error', (error) => {
  postMessage('dictationError', { error: error.message });
});
```

---

## Message Protocol (Webview ↔ Extension)

### Webview → Extension
```typescript
// Start dictation
sendToExtension('startDictation', {
  language: 'et' // or 'auto' for auto-detect
});

// Audio chunk (base64 encoded WAV)
sendToExtension('audioChunk', {
  audio: 'base64EncodedWavData...',
  timestamp: Date.now()
});

// Stop dictation
sendToExtension('stopDictation');
```

### Extension → Webview
```typescript
// Transcription result (real-time or batch)
postMessage('transcriptionChunk', {
  text: 'transcribed text here',
  isFinal: false
});

// Dictation state change
postMessage('dictationStatus', {
  state: 'listening' | 'processing' | 'idle' | 'error',
  message?: 'Optional status message'
});

// Error
postMessage('dictationError', {
  error: 'Microphone permission denied',
  code: 'PERMISSION_DENIED'
});
```

---

## Estonian Language Support

### Language Code
- **ISO 639-1:** `et`
- **whisper.cpp:** Supports Estonian in multilingual models

### Testing Strategy
1. **Test phrases:**
   - "Tere, kuidas läheb?" (Hello, how are you?)
   - "See on test" (This is a test)
   - "Markdown dokument" (Markdown document)
2. **Compare accuracy:**
   - Auto-detect vs. forced `language: 'et'`
   - Test with Estonian accent on English words
3. **Benchmark:**
   - Measure Word Error Rate (WER) on sample sentences
   - Target: <10% WER for Estonian

### Potential Issues
- Mixed language dictation (Estonian + English)
  - Solution: Use auto-detect mode, let whisper handle switching
- Technical terms (markdown, Git, etc.)
  - May need post-processing dictionary for common tech words

---

## Platform Detection

### macOS Only (Initially)
```typescript
// src/voiceDictation.ts
export function isDictationSupported(): boolean {
  return process.platform === 'darwin';
}

// src/extension.ts
if (!isDictationSupported()) {
  vscode.window.showInformationMessage(
    'Voice dictation is currently only supported on macOS. Windows support coming soon!'
  );
  return;
}
```

### Future: Windows Support
- whisper.cpp supports Windows
- Requires Windows-specific audio capture testing
- May need different FFmpeg binaries

---

## Performance Considerations

### Target Metrics
- **Latency:** <500ms from speech end to text insertion
- **Memory:** <500MB additional during dictation
- **CPU:** Should not block UI (run transcription in background)

### Optimization Strategies
1. **Chunk size tuning:**
   - Smaller chunks = lower latency, more overhead
   - Larger chunks = higher latency, better accuracy
   - Test 0.5s, 1s, 2s chunk sizes
2. **Voice Activity Detection (VAD):**
   - Only transcribe when speech detected
   - Reduces unnecessary processing
3. **Model caching:**
   - Load model once on first use
   - Keep in memory for subsequent dictations

---

## Error Handling

### Common Errors
| Error | Cause | User Message |
|-------|-------|--------------|
| Model not found | Model not downloaded/bundled | "Loading speech model... (first time)" |
| FFmpeg missing | FFmpeg not installed | "Voice dictation requires FFmpeg. Install via Homebrew." |
| Permission denied | Microphone access denied | "Microphone access required. Allow in System Preferences > Privacy." |
| Unsupported platform | Windows (initial release) | "Voice dictation is currently macOS-only. Windows support coming soon!" |
| Transcription timeout | Audio too long or corrupted | "Could not transcribe audio. Try speaking again." |

### Graceful Degradation
- If dictation fails, do NOT lose user's existing text
- Provide clear error messages with actionable steps
- Allow retry without restarting entire dictation session

---

## Security & Privacy

### Data Handling
- **Audio processing:** 100% local (no cloud)
- **Model storage:** Bundled with extension or downloaded once
- **No telemetry:** Audio/transcriptions never leave the device

### Permissions
- **Microphone access:** Required, requested on first use
- **Storage:** Model files stored in extension directory (~75MB)

---

## Distribution Strategy

### Option 1: Bundle Model in Extension
**Pros:**
- Works offline immediately
- No first-use delay

**Cons:**
- Extension size +75MB
- Larger initial download

### Option 2: Download Model on First Use
**Pros:**
- Smaller extension package
- Users who don't use dictation don't download model

**Cons:**
- First-use delay (1-2 minutes download)
- Requires internet for first setup

**Recommendation:** Option 1 (bundle) - aligns with RiteMark's offline-first philosophy.

---

## Next Steps (Phase 2)

1. **Proof of Concept:**
   - Install whisper-node in test environment
   - Record 5-second audio file → transcribe → verify output
   - Test Estonian transcription accuracy
2. **Architecture Design:**
   - Finalize message protocol
   - Design state management (idle/listening/processing)
   - Plan UI component (mic button placement)
3. **Risk Validation:**
   - Test FFmpeg requirement on clean macOS
   - Measure transcription latency with tiny model
   - Verify whisper-node compiles in VS Code extension context

---

## References

- [whisper-node npm](https://www.npmjs.com/package/whisper-node)
- [whisper.cpp GitHub](https://github.com/ggml-org/whisper.cpp)
- [Whisper Model Card](https://github.com/openai/whisper/blob/main/model-card.md)
- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

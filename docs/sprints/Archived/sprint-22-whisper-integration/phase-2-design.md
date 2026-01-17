# Sprint 22: Phase 2 Technical Design

**Status:** Ready for approval
**Date:** 2026-01-17

---

## Key Decision: Homebrew whisper-cpp (Subprocess)

After evaluating native Node modules, we chose a **subprocess approach** for reliability:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Native Node module | Integrated | Electron compatibility issues | ❌ Risky |
| **Homebrew whisper-cpp** | Stable, Metal GPU, well-tested | Requires brew install | ✅ SELECTED |

**Why Homebrew whisper-cpp:**
- Well-tested, maintained by Homebrew community
- Metal GPU acceleration built-in (5x faster on Apple Silicon)
- No native Node module compilation headaches
- Simple subprocess spawn from extension
- User runs: `brew install whisper-cpp` (one-time)

**Implementation:**
- Extension spawns `whisper-cpp` CLI as subprocess
- Audio saved to temp WAV file, passed to CLI
- Parse JSON/text output from CLI

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RiteMark Webview                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Fixed Toolbar (right side)              [🎤]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TipTap Editor                                       │   │
│  │                                                      │   │
│  │  The meeting notes discussed...▌                    │   │
│  │                              ↑                       │   │
│  │                    Live text insertion               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Audio Capture Module                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  getUserMedia() → MediaRecorder → audio blob        │   │
│  │  Send chunk every ~3 seconds as base64              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
          postMessage('audioChunk', { audio: base64, format: 'webm' })
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              RiteMark Extension (Node.js)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  voiceDictation.ts                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Subprocess: whisper-cpp (Homebrew)                 │   │
│  │                                                      │   │
│  │  1. Receive audio chunk (base64)                    │   │
│  │  2. Save to temp WAV file (16kHz mono)              │   │
│  │  3. Spawn: whisper-cpp --model X -f temp.wav        │   │
│  │  4. Parse output, send text to webview              │   │
│  │  5. Clean up temp file                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Model Manager                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  - Check if model exists locally                    │   │
│  │  - Download from HuggingFace on first use           │   │
│  │  - Store in: ~/.ritemark/models/                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
          postMessage('transcription', { text, isFinal })
                            ▼
                    Insert into editor
```

---

## Message Protocol

### Webview → Extension

| Message | Payload | Description |
|---------|---------|-------------|
| `dictation:start` | `{ language: 'auto' }` | User clicked mic button |
| `dictation:stop` | `{}` | User clicked mic button again |
| `dictation:audioChunk` | `{ pcm: Float32Array, sampleRate: 16000 }` | Audio data chunk |

### Extension → Webview

| Message | Payload | Description |
|---------|---------|-------------|
| `dictation:status` | `{ state: 'idle'|'listening'|'processing'|'error' }` | State change |
| `dictation:transcription` | `{ text: string, isFinal: boolean }` | Transcribed text |
| `dictation:error` | `{ code: string, message: string }` | Error occurred |
| `dictation:modelRequired` | `{ size: '75MB' }` | Show download dialog |
| `dictation:downloadProgress` | `{ percent: number }` | Download progress |

---

## UI Design: Fixed Toolbar

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Editor content...                                    │   │
│  │                                                      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                          ┌───┐      │   │
│  │  [B] [I] [H1] [H2] ["] [•] [1.] [🔗]    │ 🎤 │      │   │
│  │                                          └───┘      │   │
│  │                                            ↑        │   │
│  │                              Mic button (fixed)     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Mic Button States

| State | Visual | CSS |
|-------|--------|-----|
| Idle | 🎤 gray | `opacity: 0.6` |
| Listening | 🎤 red + pulse | `color: red; animation: pulse 1s infinite` |
| Processing | ⏳ spinner | `animation: spin 1s linear infinite` |
| Error | ⚠️ yellow | `color: orange` |
| Disabled (Windows) | 🎤 gray + tooltip | `opacity: 0.3; cursor: not-allowed` |

---

## First-Use Model Download Flow

```
User clicks 🎤
       │
       ▼
┌──────────────────────────────────┐
│  Model exists locally?           │
│  ~/.ritemark/models/ggml-tiny.bin│
└──────────────────────────────────┘
       │
   No  │  Yes
       │    └──→ Start dictation
       ▼
┌──────────────────────────────────────────────────────┐
│                                                      │
│   🎤 Voice Dictation Setup                          │
│                                                      │
│   Voice dictation requires a speech recognition     │
│   model to be downloaded (~75 MB).                  │
│                                                      │
│   The model runs entirely on your device -          │
│   no audio is sent to the cloud.                    │
│                                                      │
│   ┌────────────┐  ┌────────────┐                   │
│   │  Download  │  │   Cancel   │                   │
│   └────────────┘  └────────────┘                   │
│                                                      │
└──────────────────────────────────────────────────────┘
       │
       ▼ (Download clicked)
┌──────────────────────────────────────────────────────┐
│                                                      │
│   Downloading speech model...                        │
│   ████████████░░░░░░░░  52%                         │
│                                                      │
│   ┌────────────┐                                    │
│   │   Cancel   │                                    │
│   └────────────┘                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
       │
       ▼ (Complete)
Start dictation automatically
```

---

## Live Text Preview Approach

Since Whisper doesn't natively stream, we simulate live preview:

1. **Capture audio continuously** (Web Audio API)
2. **Buffer chunks** (~2 seconds each)
3. **Transcribe each chunk** as it arrives
4. **Insert partial text** immediately
5. **Refine on final** (may adjust last few words)

```
Time: 0s      2s       4s       6s
      │       │        │        │
Audio: [chunk1] [chunk2] [chunk3]
             │        │        │
             ▼        ▼        ▼
Text:   "Hello"  "Hello my"  "Hello my name"
        (insert) (update)    (update)
```

**Trade-off:** Slight latency (~2s) but provides live feedback per Jarmo's requirement.

---

## Model Selection

| Model | Size | Languages | Speed | Use Case |
|-------|------|-----------|-------|----------|
| ggml-tiny.bin | 75MB | 99 | Fastest | ✅ Default |
| ggml-base.bin | 142MB | 99 | Fast | Better accuracy |
| ggml-small.bin | 466MB | 99 | Medium | High accuracy |

**Default:** `ggml-tiny.bin` (multilingual, includes Estonian)

Download URL: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin`

---

## Platform Detection

```typescript
// voiceDictation.ts
export function isVoiceDictationSupported(): boolean {
  return process.platform === 'darwin'; // macOS only
}

export function getUnsupportedMessage(): string {
  return 'Voice dictation is currently available on macOS only. Windows support coming soon.';
}
```

---

## File Structure

```
extensions/ritemark/
├── src/
│   ├── voiceDictation/
│   │   ├── index.ts           # Main module, exports
│   │   ├── whisperService.ts  # @kutalia/whisper-node-addon wrapper
│   │   ├── modelManager.ts    # Download, cache, load models
│   │   ├── audioProcessor.ts  # PCM chunk handling
│   │   └── types.ts           # TypeScript interfaces
│   └── extension.ts           # Register dictation handlers
│
├── webview/
│   └── src/
│       ├── components/
│       │   └── MicButton.tsx  # Fixed toolbar mic button
│       ├── hooks/
│       │   └── useVoiceDictation.ts  # Audio capture, state
│       └── services/
│           └── audioCapture.ts  # Web Audio API wrapper
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| whisper-node-addon not compatible | Test in dev first; fallback to whisper-node |
| 2s latency feels slow | Tune chunk size; show "listening" animation |
| Model download fails | Retry logic; clear error message; manual download option |
| Estonian accuracy poor | Test with tiny; upgrade to base if needed |

---

## Implementation Order

1. **Backend first:** Install package, test transcription in isolation
2. **Model manager:** Download flow, caching
3. **Message protocol:** Wire up webview ↔ extension
4. **Audio capture:** Web Audio API in webview
5. **UI:** Mic button in fixed toolbar
6. **Integration:** End-to-end flow
7. **Polish:** Error handling, edge cases

---

## Approval Checklist

- [ ] Architecture approved
- [ ] Package choice approved (@kutalia/whisper-node-addon)
- [ ] UI design approved (fixed toolbar, states)
- [ ] Download dialog approved
- [ ] Ready to proceed to Phase 3 (Implementation)

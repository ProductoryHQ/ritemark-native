# Sprint 23: Estonian STT (Second Attempt)

## Goal
Implement real-time voice dictation in Ritemark using bundled whisper.cpp binary, with Estonian language support and zero user installation required.

## Success Criteria
- [ ] User can click mic button to start/stop dictation
- [ ] Dictated text appears at cursor position in real-time
- [ ] Estonian language transcription works (15-20% WER acceptable for MVP)
- [ ] Works offline (no cloud dependency)
- [ ] Zero installation required (binary bundled with extension)
- [ ] macOS-only initially (Windows gracefully disabled)
- [ ] Model downloads on first use with progress indicator
- [ ] Undo (Cmd+Z) removes dictated text as single action

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| whisper.cpp binary | Pre-compiled darwin-arm64 binary bundled in extension |
| Model download logic | First-use download with progress bar (~244MB small model) |
| Mic toggle button | Button in editor toolbar (fixed position, always visible) |
| Audio capture | Web Audio API capturing microphone in webview |
| Speech recognition | whisper.cpp binary transcribing audio via spawned process |
| Text insertion | Transcribed text inserted at cursor in TipTap editor |
| Visual feedback | UI states (idle, listening, processing, error) |
| Platform detection | macOS-only feature flag (Windows shows "coming soon" message) |
| Estonian testing | Manual testing with Estonian dictation |

## Context: Why This is Sprint 23

This is the **second attempt** at voice dictation. The first attempt (Sprint 22, now archived) failed because:

- ❌ Required `brew install whisper-cpp` (user installation)
- ❌ Violated Ritemark's zero-install philosophy
- ❌ External dependency

**Sprint 23 fixes this by:**
- ✅ Bundling whisper.cpp binary with extension
- ✅ Zero user installation
- ✅ Self-contained distribution

## Implementation Checklist

### Phase 1: Research ✅ (COMPLETE)
- [x] Review ChatGPT deep research on Estonian STT (`docs/analysis/2026-01-17-estonian-stt-solution.md`)
- [x] Review original voice dictation research (`docs/analysis/2026-01-15-voice-dictation-research.md`)
- [x] Analyze failed Sprint 22 (`docs/sprints/Archived/sprint-22-whisper-integration/`)
- [x] Confirm whisper.cpp is correct choice
- [x] Validate zero-install strategy (bundled binary)
- [x] Research TalTech Estonian models (11-14% WER)
- [x] Confirm Jarmo's requirements:
  - Priority: Immediate
  - Platform: macOS initially, Windows later
  - Model: Start with small (~244MB), optional TalTech upgrade
  - UX: Toggle mode (not push-to-talk)
  - Languages: Multi-language, Estonian is MUST
  - UI: Mic toggle button in editor toolbar (non-negotiable)
  - Download: Model downloads on first use with dialog
  - Preview: Show text as you speak (real-time streaming)

### Phase 2: Plan (DECISIONS FINALIZED)
- [ ] Build whisper.cpp binary for darwin-arm64:
  - Clone whisper.cpp repository
  - Compile with Metal GPU support
  - Test binary independently (CLI verification)
  - Document build process for reproducibility
- [ ] Design bundling strategy:
  - **DECISION**: Bundle whisper.cpp binary (~5-10MB) with extension
  - Where to place binary in extension: `binaries/darwin-arm64/whisper`
  - How to mark as executable in VSIX
  - How to verify binary integrity on load
- [ ] Design model management:
  - Storage location: `~/.ritemark/models/`
  - **DECISION**: Default to `ggml-small.bin` (~244MB) - download on first mic click
  - **DECISION**: NO TalTech large model option (keep it simple)
  - Download source: HuggingFace CDN or whisper.cpp releases
  - Progress tracking: Bytes downloaded / total
  - **DECISION**: Model selection available in Settings panel
- [ ] Design architecture:
  - **Webview**: Audio capture (Web Audio API) → send audio chunks to extension
  - **Extension**: spawn whisper.cpp binary → pipe audio to stdin → read text from stdout
  - **Webview**: Insert text at cursor via TipTap editor
- [ ] Design UI components:
  - **DECISION**: Mic button in fixed top toolbar (non-negotiable)
  - **DECISION**: Use Lucide icons (e.g., `Mic` or `Mic2` from lucide-react)
  - State indicators: idle (gray), listening (red pulse), processing (spinner), error (warning)
  - Live preview: Show transcription text as it streams in (below button or inline)
  - **DECISION**: User-friendly error messages (not technical)
- [ ] Design message protocol (webview ↔ extension):
  - `startDictation` (webview → extension): User clicked mic button
  - `stopDictation` (webview → extension): User clicked mic again or pressed ESC
  - `audioChunk` (webview → extension): Base64-encoded audio data
  - `transcriptionChunk` (extension → webview): Partial text from whisper.cpp
  - `transcriptionFinal` (extension → webview): Final text, end of segment
  - `dictationError` (extension → webview): Error message + type
  - `dictationStatus` (extension → webview): State changes (idle/listening/processing)
  - `modelDownloadProgress` (extension → webview): Download % for first-use
- [ ] Design whisper.cpp invocation:
  - Command: `whisper --model ~/.ritemark/models/ggml-small.bin --language et --stream --threads 4 -`
  - Stdin: Audio data (WAV, 16kHz, mono)
  - Stdout: Text transcription (streaming or line-by-line)
  - Stderr: Errors or progress logs
- [ ] Document risks:
  - Binary bundling in VSIX (executable permissions)
  - Metal GPU acceleration not available (fallback to CPU)
  - Model download interrupted (resume/retry logic)
  - Real-time latency >500ms (tune chunk size)
  - Microphone permission denied (clear error message)
  - Estonian accuracy <15% WER (acceptable for MVP)

### Phase 3: Develop (Backend - Extension)
- [ ] Add platform detection utility:
  - `src/utils/platform.ts`:
    - `isMacOS()`: Returns `process.platform === 'darwin'`
    - Show warning dialog on non-macOS platforms
- [ ] Bundle whisper.cpp binary:
  - Copy compiled binary to `extensions/ritemark/binaries/darwin-arm64/whisper`
  - Update `package.json` to include in VSIX build
  - Add post-install script to mark binary as executable (if needed)
- [ ] Create model management module:
  - `src/voiceDictation/modelManager.ts`:
    - `getModelPath(modelName: string)`: Returns `~/.ritemark/models/${modelName}`
    - `downloadModel(modelName: string, onProgress: (percent: number) => void)`: Downloads from HuggingFace
    - `isModelDownloaded(modelName: string)`: Checks if model exists locally
    - `validateModel(modelPath: string)`: Checks file size/integrity
- [ ] Create whisper.cpp wrapper:
  - `src/voiceDictation/whisperCpp.ts`:
    - `class WhisperProcess`:
      - `spawn()`: Spawns whisper binary with args
      - `writeAudio(chunk: Buffer)`: Pipes audio to stdin
      - `onTranscription(callback: (text: string) => void)`: Emits text from stdout
      - `stop()`: Kills process gracefully
      - `cleanup()`: Removes temp files
- [ ] Create dictation controller:
  - `src/voiceDictation/controller.ts`:
    - `startDictation(language: string)`: Checks model, spawns whisper, sends status to webview
    - `stopDictation()`: Stops whisper process, sends final text
    - `handleAudioChunk(chunk: string)`: Decodes base64, writes to whisper stdin
    - `onWhisperOutput(text: string)`: Sends transcription chunk to webview
    - `onError(error: Error)`: Sends error to webview
- [ ] Update `src/extension.ts`:
  - Register dictation commands: `ritemark.startDictation`, `ritemark.stopDictation`
  - Add message handlers for webview audio chunks
  - Initialize dictation controller on extension activation
  - Handle model download dialog on first use
- [ ] Implement first-use model download:
  - Check if `ggml-small.bin` exists on first `startDictation`
  - Show dialog: "Voice dictation requires downloading speech model (~244MB). Download now?"
  - If yes: Download with progress bar (send progress to webview)
  - If no: Cancel, don't start dictation
  - Cache model locally for future use
- [ ] Handle microphone permissions:
  - Detect permission state (browser API in webview handles this)
  - Provide clear error if denied: "Microphone access denied. Enable in System Preferences > Privacy & Security > Microphone."
- [ ] Implement error handling:
  - Binary not found or not executable
  - Model loading failures
  - Whisper process crashes
  - Audio format issues
  - Transcription timeout (no output from whisper)
- [ ] Add dictation state management:
  - Track state: idle, listening, processing
  - Prevent multiple simultaneous dictations
  - Cancel in-progress transcription on stop
  - Clean up resources on extension deactivation

### Phase 4: Develop (Frontend - Webview)
- [ ] Add mic button to editor UI:
  - **Fixed toolbar** (always visible, right side of editor)
  - Position: Absolute or flex layout near formatting toolbar
  - Icon: 🎤 (microphone emoji or SVG icon)
  - States: idle (gray), listening (red pulse), processing (blue spinner)
- [ ] Create mic button component:
  - `webview/src/components/VoiceDictationButton.tsx`:
    - Toggle state on click (idle ↔ listening)
    - Send `startDictation` / `stopDictation` to extension
    - Display current state (icon + color)
    - Show tooltip: "Click to start dictation (Cmd+Option+V)"
- [ ] Implement audio capture:
  - `webview/src/hooks/useAudioCapture.ts`:
    - Request microphone: `navigator.mediaDevices.getUserMedia({ audio: true })`
    - Capture using MediaRecorder or AudioWorklet
    - Convert to WAV format (16kHz, mono, PCM16)
    - Chunk audio into ~1-second segments
    - Encode chunks as base64 and send to extension
- [ ] Create live preview component (optional but recommended):
  - `webview/src/components/TranscriptionPreview.tsx`:
    - Display partial transcription text as it arrives
    - Show below mic button or as floating overlay
    - Clear on dictation stop
- [ ] Implement text insertion:
  - Receive `transcriptionChunk` and `transcriptionFinal` messages
  - Insert text at current cursor position using TipTap:
    - `editor.chain().focus().insertContent(text).run()`
  - Handle edge cases:
    - No cursor position (insert at end of document)
    - Inside code block (insert as plain text)
    - During selection (replace selection or insert after)
  - Support undo as single action:
    - Use TipTap transactions to group insertions
    - Cmd+Z should remove entire dictation segment
- [ ] Add keyboard shortcut:
  - Cmd+Option+V to toggle dictation (VS Code Speech standard)
  - Register in editor keyboard handler
  - Prevent shortcut if not on macOS
- [ ] Create visual feedback:
  - Listening state: Pulsing red animation on mic icon
  - Processing state: Spinner animation
  - Error state: Warning icon with tooltip message
  - Audio level meter (optional): Show mic input volume as visual bar
- [ ] Update bridge.ts:
  - Add message types: `startDictation`, `stopDictation`, `audioChunk`
  - Add listeners: `transcriptionChunk`, `transcriptionFinal`, `dictationError`, `dictationStatus`
  - Handle model download progress messages

### Phase 5: Integration & Polish
- [ ] Test binary bundling in VSIX:
  - Run `vsce package` and verify binary is included
  - Install VSIX and verify binary has execute permissions
  - Test on clean macOS machine (no development environment)
- [ ] Optimize audio chunking:
  - Test various chunk sizes (500ms, 1s, 2s)
  - Balance real-time responsiveness vs. whisper.cpp startup overhead
  - Measure latency: time from speech to text insertion
- [ ] Implement Voice Activity Detection (optional):
  - Detect silence and pause transcription to save CPU
  - Auto-stop after N seconds of silence
  - Reduces unnecessary processing
- [ ] Add user settings (optional):
  - Language preference: Auto-detect, Estonian, English, etc.
  - Model selection: Small (default), TalTech large-et (optional download)
  - Keyboard shortcut customization
  - Auto-punctuation toggle (if implemented)
- [ ] Optimize performance:
  - Test real-time latency (target <500ms speech-to-text)
  - Monitor CPU usage (whisper.cpp should use <50% on M1)
  - Monitor memory usage (should stay <500MB)
  - Test Metal GPU acceleration (check whisper logs for "using Metal")
- [ ] Add documentation:
  - User guide: "How to use voice dictation"
  - Troubleshooting: "Microphone not working", "Model download failed"
  - Supported languages list (emphasize Estonian)
  - FAQ: "Can I use offline?", "What model is used?", "How accurate is Estonian?"

### Phase 6: Testing & Validation
- [ ] Manual testing on macOS:
  - Test English dictation (accuracy, speed)
  - **Test Estonian dictation (CRITICAL - Jarmo requirement)**
  - Test toggle mode (start/stop/start again)
  - Test cursor insertion (at beginning, middle, end of document)
  - Test undo (Cmd+Z removes dictated text as single unit)
  - Test keyboard shortcut (Cmd+Option+V)
- [ ] First-use testing:
  - Test model download flow (first time user clicks mic)
  - Test download cancellation (user clicks "No")
  - Test download interruption (network failure, retry)
  - Test download resume (if supported)
- [ ] Edge case testing:
  - No microphone connected (show error)
  - Microphone permission denied (show instructions)
  - Model file corrupted (re-download)
  - whisper.cpp binary missing (show error, re-install extension)
  - whisper.cpp process crashes (restart, show error)
  - Long dictation sessions (10+ minutes, memory leaks?)
  - Multiple rapid start/stop cycles (resource cleanup)
- [ ] Platform testing:
  - Verify macOS works correctly (M1, M2, M3)
  - Verify Windows shows graceful "coming soon" message (not crash)
  - Verify Intel Macs work (if supporting, or show error)
- [ ] Performance testing:
  - Measure latency: time from speech end to text insertion
  - Target: <500ms for real-time feel
  - Monitor CPU usage during dictation
  - Monitor memory usage during long sessions
  - Verify Metal GPU is used (check whisper logs for "using Metal")
- [ ] Accuracy testing:
  - English: Compare transcription to known text
  - Estonian: Compare transcription to known Estonian text
  - Mixed languages: Test switching between English and Estonian
  - Accents: Test with different Estonian accents (if applicable)
  - Noisy environments: Test with background noise
- [ ] User testing with Jarmo:
  - Test Estonian dictation accuracy (most important!)
  - Test UX (button placement, visual feedback, ease of use)
  - Test real-world use cases (note-taking, document writing)
  - Gather feedback on accuracy, speed, and usability
  - Test optional TalTech large-et model (if implemented)

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Ritemark Webview (React)                 │
├─────────────────────────────────────────────────────────────┤
│  Editor Toolbar (Fixed Position)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [B] [I] [H1] ... [🎤] ← Mic Toggle Button           │   │
│  │  States: idle, listening, processing, error          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Audio Capture (Web Audio API)                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  navigator.mediaDevices.getUserMedia()                │   │
│  │  MediaRecorder → chunks (WAV, 16kHz, mono, PCM16)    │   │
│  │  Base64 encode → send to extension                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▼                                  │
│              sendToExtension('audioChunk', data)            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Ritemark Extension (TypeScript)                │
├─────────────────────────────────────────────────────────────┤
│  voiceDictation/controller.ts                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Receive audio chunk (base64)                         │   │
│  │  Decode to Buffer                                     │   │
│  │  Write to whisper.cpp stdin                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▼                                  │
│  voiceDictation/whisperCpp.ts                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  child_process.spawn('whisper', [...args])            │   │
│  │  Binary: binaries/darwin-arm64/whisper                │   │
│  │  Args: --model ~/.ritemark/models/ggml-small.bin      │   │
│  │        --language et --stream --threads 4 -           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▼                                  │
│              whisper.cpp (bundled binary)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  stdin: Audio data (WAV PCM16)                        │   │
│  │  Process with Metal GPU acceleration                  │   │
│  │  stdout: Transcription text (streaming)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▼                                  │
│  Read stdout line-by-line                                   │
│              postMessage('transcriptionChunk', { text })    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Ritemark Webview (React)                 │
├─────────────────────────────────────────────────────────────┤
│  Text Insertion (TipTap)                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Receive transcription chunk                          │   │
│  │  editor.chain().focus().insertContent(text).run()     │   │
│  │                                                        │   │
│  │  The quick brown fox jumps over the lazy dog... ▌     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## UI States (FINALIZED)

**DECISION**: Use Lucide icons from `lucide-react` package (already in project).

| State | Lucide Icon | Color | Animation | Behavior |
|-------|-------------|-------|-----------|----------|
| Idle | `Mic` or `Mic2` | Gray | None | Click to start dictation |
| Listening | `Mic` or `Mic2` | Red | Pulsing | Recording audio, sending to whisper |
| Processing | `Loader2` | Blue | Spinning | Transcribing audio (brief delay) |
| Error | `AlertTriangle` | Yellow/Red | None | Show user-friendly error message |

**DECISION**: Button placement in fixed top toolbar (non-negotiable).
**DECISION**: Error messages must be user-friendly, not technical.

## Model Strategy (FINALIZED)

### Default Model: ggml-small.bin

| Attribute | Value |
|-----------|-------|
| Size | ~244MB |
| Estonian WER | ~15-20% (estimated) |
| Speed | Fast (real-time on M1) |
| Languages | 99 languages including Estonian |
| Source | https://huggingface.co/ggerganov/whisper.cpp |
| Download timing | **First mic click** (with progress dialog) |

**DECISION**: Keep it simple - only one model option for MVP.

### TalTech Model: NOT INCLUDED

**DECISION**: Do not offer TalTech large-et model as an option (keep it simple for MVP).
- This can be revisited in a future sprint if needed.
- Users get immediate functionality without choice paralysis.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Binary not executable in VSIX** | High | Test VSIX packaging, use post-install script to `chmod +x` |
| **Metal GPU not available** | Medium | whisper.cpp auto-falls back to CPU (slower but works) |
| **Model download fails** | Medium | Retry logic, manual download link, clear error message |
| **Estonian accuracy <15% WER** | High | Test early, offer TalTech upgrade, set expectations |
| **Real-time latency >500ms** | Medium | Tune chunk size, use smaller model, optimize whisper args |
| **Microphone permission denied** | Medium | Clear error with link to System Preferences |
| **whisper.cpp crashes** | Medium | Restart process, log errors, show user-friendly message |
| **Large extension size** | Low | 244MB model + 10MB binary = acceptable, download on first use |

## Comparison to Failed Sprint 22

| Aspect | Sprint 22 (Failed) | Sprint 23 (This Sprint) |
|--------|-------------------|------------------------|
| **Binary distribution** | ❌ Homebrew (`brew install`) | ✅ Bundled in extension |
| **User installation** | ❌ Required | ✅ None (zero-install) |
| **Integration** | nodejs-whisper (npm native module) | whisper.cpp (spawned process) |
| **Dependencies** | FFmpeg, Homebrew, system tools | None (self-contained) |
| **Philosophy alignment** | ❌ Violated zero-install | ✅ Aligned with Ritemark |

## Status
**Current Phase:** 1 (Research - Complete)
**Next Phase:** 2 (Plan - Awaiting Approval)
**Approval Required:** Yes (Jarmo must approve Phase 2→3)

## Key Decisions Summary

All open questions resolved by Jarmo on 2026-01-17:

1. **Binary bundling**: Bundle whisper.cpp binary (~5-10MB) with extension ✅
2. **Model download**: Download model (244MB) on first mic click ✅
3. **Model size**: 244MB is acceptable ✅
4. **TalTech model**: Do NOT offer - keep it simple ✅
5. **Icon choice**: Use Lucide icons (Mic, Mic2, Loader2, AlertTriangle) ✅
6. **Button placement**: Fixed top toolbar (non-negotiable) ✅
7. **Error messages**: User-friendly, not technical ✅
8. **Model selection**: Settings panel ✅

## Approval
- [x] Sprint plan created (2026-01-17)
- [x] All design decisions finalized (2026-01-17)
- [ ] **Jarmo: Please review and approve with "approved" to proceed to Phase 3**

---

## Notes
- This is the **second attempt** at voice dictation (Sprint 22 failed due to Homebrew requirement)
- whisper.cpp is still the right choice, but distribution model is corrected
- Estonian language support is non-negotiable requirement
- macOS-only initially (platform detection prevents Windows activation)
- Toggle mode UX (not push-to-talk) per Jarmo's preference
- Model downloads on first use (~244MB small model)
- Optional TalTech large model for better Estonian accuracy (future enhancement)
- Binary bundling is critical success factor (test early!)

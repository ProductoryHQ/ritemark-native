# Sprint 22: Voice Dictation with whisper.cpp

## Goal
Implement real-time voice dictation in RiteMark using whisper.cpp, enabling users to dictate text directly into the markdown editor with toggle mode and multi-language support (including Estonian).

## Success Criteria
- [ ] User can click mic button in editor toolbar to start/stop dictation
- [ ] Dictated text appears in real-time at cursor position
- [ ] Toggle states (idle/listening/processing) are clearly visible
- [ ] Estonian language transcription works accurately
- [ ] Voice dictation works offline (no cloud dependency)
- [ ] Feature works on macOS (platform detection prevents activation on Windows)
- [ ] User can undo dictated text as a single action (Cmd+Z)

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| whisper.cpp integration | whisper-node package installed and configured |
| Mic toggle button | Button added to TipTap editor toolbar (FormattingBubbleMenu or fixed position) |
| Audio capture | Web Audio API capturing microphone input in webview |
| Speech recognition | whisper.cpp transcribing audio in extension backend |
| Text insertion | Transcribed text inserted at cursor position in editor |
| Visual feedback | UI states for idle, listening, processing, error |
| Platform detection | macOS-only feature flag (graceful disable on Windows) |
| Estonian language test | Manual testing with Estonian dictation |

## Implementation Checklist

### Phase 1: Research & Setup
- [x] Review voice dictation research document (completed)
- [x] Confirm whisper.cpp as primary approach (Jarmo approved)
- [x] Document Jarmo's requirements:
  - Priority: Immediate
  - Platform: macOS initially, Windows later
  - Model: tiny multilingual (~75MB)
  - UX: Toggle mode (not push-to-talk)
  - Languages: Multi-language, Estonian is MUST
  - UI: Mic toggle button in editor toolbar (non-negotiable)

### Phase 2: Technical Design
- [ ] Design architecture:
  - Webview: Audio capture (Web Audio API) → send audio chunks to extension
  - Extension: whisper-node → transcribe → send text back to webview
  - Webview: Insert text at cursor via TipTap editor
- [ ] Design UI components:
  - Mic button placement: FormattingBubbleMenu vs. fixed toolbar
  - State indicators: idle (gray), listening (red pulse), processing (spinner)
  - Error feedback: permission denied, model loading, transcription failed
- [ ] Design message protocol (webview ↔ extension):
  - `startDictation` (webview → extension)
  - `stopDictation` (webview → extension)
  - `audioChunk` (webview → extension, base64 encoded)
  - `transcriptionChunk` (extension → webview, real-time text)
  - `dictationError` (extension → webview, error message)
  - `dictationStatus` (extension → webview, state changes)
- [ ] Research whisper-node npm package:
  - Installation requirements (FFmpeg, native compilation)
  - Model download/bundling strategy
  - Language configuration (multi-language model required)
  - Streaming vs. batch transcription API
- [ ] Create proof-of-concept plan:
  - Minimal test: Record 5 seconds → transcribe → log output
  - Verify Estonian language support
  - Test on macOS before full integration
- [ ] Document risks:
  - Native module compilation issues
  - Model size distribution (~75MB bundled or downloaded on first use)
  - Real-time latency (target <500ms)
  - Microphone permission handling in VS Code environment

### Phase 3: Backend Implementation (Extension)
- [ ] Install nodejs-whisper dependency in `extensions/ritemark/package.json`
- [ ] Add platform detection utility:
  - `process.platform === 'darwin'` for macOS
  - Graceful disable message for non-macOS platforms
- [ ] Create `src/voiceDictation.ts` module:
  - Initialize whisper-node with tiny multilingual model
  - Handle model download/loading on first use
  - Implement audio chunk buffering
  - Transcribe audio using whisper.cpp
  - Handle language detection (or force Estonian/English)
- [ ] Update `src/extension.ts`:
  - Register dictation commands
  - Add message handlers for webview audio chunks
  - Send transcriptions back to webview
- [ ] Handle microphone permissions:
  - Detect permission state
  - Request permission if needed
  - Provide user feedback for denied permission
- [ ] Implement error handling:
  - Model loading failures
  - Transcription errors
  - Audio format issues
- [ ] Add dictation state management:
  - Track active/inactive state
  - Cancel in-progress transcription on stop
  - Clean up resources properly

### Phase 4: Frontend Implementation (Webview)
- [ ] Add mic button to editor UI:
  - **Fixed toolbar** (always visible) - per Jarmo's decision
  - Position: Right side of editor, persistent
- [ ] Implement audio capture:
  - Request microphone access (navigator.mediaDevices.getUserMedia)
  - Capture audio chunks using MediaRecorder or AudioWorklet
  - Convert to format whisper.cpp expects (WAV, 16kHz, mono)
  - Send chunks to extension via bridge
- [ ] Create visual feedback component:
  - Mic button states: idle (gray), listening (red pulse), processing (spinner)
  - **Live transcription preview** (show text as user speaks) - per Jarmo's decision
  - Error messages (permission denied, model loading, etc.)
- [ ] Implement text insertion:
  - Insert transcribed text at current cursor position
  - Use TipTap editor commands (chain().focus().insertContent())
  - Handle edge cases (no cursor, inside code block, etc.)
  - Support undo as single action (transaction-based insertion)
- [ ] Add keyboard shortcut (optional):
  - Cmd+Option+V to toggle dictation (VS Code Speech standard)
  - Register in editor keyboard handler
- [ ] Update bridge.ts:
  - Add `startDictation`, `stopDictation` message types
  - Add `audioChunk` sender
  - Add `transcriptionChunk` receiver

### Phase 5: Integration & Polish
- [ ] Implement model download on first use:
  - Show dialog when user clicks mic for first time: "Voice dictation requires downloading a speech model (~75MB). Download now?"
  - Download tiny multilingual model
  - Show progress indicator during download
  - Cache model locally for future use
- [ ] Add user settings (optional):
  - Language preference (auto-detect, Estonian, English, etc.)
  - Toggle dictation shortcut customization
- [ ] Optimize performance:
  - Test real-time latency (target <500ms)
  - Tune audio chunk size vs. transcription speed
  - Consider Voice Activity Detection (VAD) to reduce noise
- [ ] Cross-browser audio compatibility:
  - Test in VS Code webview (Electron)
  - Handle browser-specific audio APIs
- [ ] Add documentation:
  - User guide: How to use voice dictation
  - Troubleshooting: Microphone permissions, model loading
  - Supported languages list

### Phase 6: Testing & Validation
- [ ] Manual testing on macOS:
  - Test English dictation (accuracy, speed)
  - **Test Estonian dictation (CRITICAL - Jarmo requirement)**
  - Test toggle mode (start/stop/start again)
  - Test cursor insertion (various editor contexts)
  - Test undo (Cmd+Z removes dictated text)
- [ ] Edge case testing:
  - No microphone connected
  - Permission denied
  - Model loading failure
  - Network interruption (should not affect offline model)
  - Long dictation sessions (memory usage)
- [ ] Platform testing:
  - Verify macOS works correctly
  - Verify Windows shows graceful disable message (not crash)
- [ ] Performance testing:
  - Measure latency (speech to text insertion)
  - Memory usage during dictation
  - CPU usage (whisper.cpp inference)
- [ ] User testing with Jarmo:
  - Test Estonian dictation accuracy
  - Test UX (button placement, visual feedback)
  - Test real-world use cases (note-taking, document writing)

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RiteMark Webview                         │
├─────────────────────────────────────────────────────────────┤
│  Editor Toolbar / FormattingBubbleMenu                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [B] [I] [H1] ... [🎤] ← Mic Toggle Button           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Audio Capture (Web Audio API)                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  navigator.mediaDevices.getUserMedia()                │   │
│  │  MediaRecorder → audio chunks (WAV, 16kHz, mono)      │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▼                                  │
│                   sendToExtension('audioChunk', data)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              RiteMark Extension (TypeScript)                │
├─────────────────────────────────────────────────────────────┤
│  voiceDictation.ts                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  whisper-node (npm package)                           │   │
│  │    │                                                   │   │
│  │    ▼                                                   │   │
│  │  whisper.cpp (native Node addon)                      │   │
│  │    │                                                   │   │
│  │    ▼                                                   │   │
│  │  Transcribe audio → text                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▼                                  │
│              postMessage('transcriptionChunk', { text })    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    RiteMark Webview                         │
├─────────────────────────────────────────────────────────────┤
│  Text Insertion (TipTap)                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  editor.chain().focus().insertContent(text).run()     │   │
│  │                                                        │   │
│  │  The quick brown fox... ▌                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## UI States

| State | Icon | Color | Behavior |
|-------|------|-------|----------|
| Idle | 🎤 (static) | Gray | Click to start dictation |
| Listening | 🎤 (pulsing) | Red | Recording audio, sending to transcription |
| Processing | ⏳ (spinner) | Blue | Transcribing audio (brief delay) |
| Error | ⚠️ | Yellow/Red | Show error message in tooltip |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| whisper-node native compilation fails | High | Document FFmpeg requirements, test on clean macOS |
| Model size too large for bundle | Medium | Download on first use with progress indicator |
| Real-time latency >500ms | Medium | Tune chunk size, consider smaller model if needed |
| Estonian language accuracy poor | High | Test thoroughly, may need model tuning/prompting |
| Microphone permission denied | Medium | Clear error message with instructions |
| Conflicts with system dictation | Low | Use different shortcut, test coexistence |

## Jarmo's Decisions (2026-01-17)

| Question | Decision |
|----------|----------|
| Mic button placement | **Fixed toolbar** (always visible) |
| Model download | **Download on first use** with dialog when user clicks mic |
| Live preview | **Show text as you speak** (real-time streaming) |
| Keyboard shortcut | Cmd+Option+V (VS Code standard) - default |

## Status
**Current Phase:** 3 (Backend Implementation)
**Package:** nodejs-whisper (production-ready, 1,153 downloads/week)

## Approval
- [x] Jarmo approved sprint plan (2026-01-17)
- [x] Jarmo approved Phase 2→3 (2026-01-17) - proceed with nodejs-whisper

---

## Notes
- Sprint builds on research from `docs/analysis/2026-01-15-voice-dictation-research.md`
- VS Code Speech extension does NOT support Estonian (confirmed blocker)
- whisper.cpp chosen for multi-language support and offline capability
- Estonian language support is non-negotiable requirement
- macOS-only initially, platform detection prevents Windows activation
- Toggle mode UX (not push-to-talk) per Jarmo's preference

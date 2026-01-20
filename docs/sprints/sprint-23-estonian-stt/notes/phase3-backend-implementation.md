# Phase 3: Backend Implementation Progress

## Date: 2026-01-17

## Completed: Backend Module Structure ✅

Created complete backend infrastructure for voice dictation:

### 1. Platform Detection (`src/utils/platform.ts`)
- `isMacOS()` - Check if running on macOS
- `isWindows()` - Check if running on Windows
- `getBinaryPathSuffix()` - Get platform-specific binary path

### 2. Model Manager (`src/voiceDictation/modelManager.ts`)
- Model definitions (small model: 244MB)
- Model download from HuggingFace with progress tracking
- Model validation (size check with 1% tolerance)
- Local storage at `~/.ritemark/models/`
- Model path utilities

### 3. Whisper.cpp Wrapper (`src/voiceDictation/whisperCpp.ts`)
- `WhisperProcess` class extends EventEmitter
- Spawns whisper binary with arguments
- Writes audio chunks to stdin
- Reads transcription from stdout
- Filters out progress lines
- Graceful shutdown with 2-second timeout
- Resource cleanup

### 4. Dictation Controller (`src/voiceDictation/controller.ts`)
- Platform detection (macOS only for now)
- Model download confirmation dialog
- Progress notification for downloads
- Coordinates between webview and whisper process
- State management (idle, listening, processing, error)
- User-friendly error messages
- Audio chunk handling (base64 decode)

### 5. Extension Integration (`src/extension.ts`)
- Initialize `VoiceDictationController` on activation
- Register voice dictation commands
- Cleanup on deactivation

### 6. Editor Integration (`src/ritemarkEditor.ts`)
- Message handlers for:
  - `startDictation` - Start voice dictation
  - `stopDictation` - Stop voice dictation
  - `audioChunk` - Audio data from webview
- Callbacks for:
  - `dictationStatus` - State changes
  - `transcriptionChunk` - Partial transcription
  - `dictationError` - Error messages

## Next Steps: Binary Acquisition

### Option 1: Build from Source (Recommended for Production)
```bash
# Clone whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Build for macOS with Metal support
make clean
make

# Binary will be at: ./main
# Size: ~5-10MB
```

### Option 2: Download Pre-built Binary
- Check whisper.cpp releases on GitHub
- Verify it's built with Metal support
- Test independently before bundling

### Option 3: Test with System Binary (Development Only)
```bash
# If already installed via Homebrew
which whisper
# /opt/homebrew/bin/whisper
```

## Binary Placement

Once obtained, place binary at:
```
extensions/ritemark/binaries/darwin-arm64/whisper
```

## Next Implementation Phase

After binary is ready:
1. Test binary independently (CLI verification)
2. Test with our `WhisperProcess` class
3. Test model download flow
4. Test end-to-end audio → transcription
5. Move to Phase 4: Frontend (webview UI)

## Technical Notes

### Audio Format Requirements
- Format: WAV PCM16
- Sample rate: 16kHz
- Channels: Mono
- Encoding: Little-endian 16-bit signed integers

### Whisper.cpp Arguments
```bash
whisper \
  --model ~/.ritemark/models/ggml-small.bin \
  --language et \
  --threads 4 \
  --print-progress false \
  --print-realtime true \
  --no-timestamps \
  -  # Read from stdin
```

### Expected Behavior
1. User clicks mic button in webview
2. Webview sends `startDictation` message
3. Extension checks if model exists
4. If not, shows download dialog
5. Downloads model with progress (~244MB)
6. Spawns whisper process
7. Webview captures audio via Web Audio API
8. Webview sends audio chunks as base64
9. Extension decodes and pipes to whisper stdin
10. Whisper outputs text to stdout
11. Extension sends text back to webview
12. Webview inserts text at cursor

## Risk Assessment

### ✅ Mitigated
- **Code structure**: Complete module architecture
- **Error handling**: User-friendly messages
- **Platform detection**: Graceful Windows handling
- **Model management**: Download with progress tracking
- **Resource cleanup**: Proper disposal on deactivation

### ⚠️ Remaining
- **Binary acquisition**: Need to build or obtain whisper.cpp
- **Binary permissions**: Must ensure executable in VSIX
- **Audio format**: Need to implement Web Audio → WAV conversion in webview
- **Real-time performance**: Need to test latency
- **Estonian accuracy**: Need to test with actual dictation

## Files Modified

```
extensions/ritemark/src/
├── utils/
│   └── platform.ts (NEW)
├── voiceDictation/
│   ├── controller.ts (NEW)
│   ├── modelManager.ts (NEW)
│   └── whisperCpp.ts (NEW)
├── extension.ts (MODIFIED - added controller init)
└── ritemarkEditor.ts (MODIFIED - added message handlers)
```

## Commit Checklist (not ready yet)

- [ ] Compile TypeScript (`npm run compile`)
- [ ] Test imports (no circular dependencies)
- [ ] Obtain whisper.cpp binary
- [ ] Test basic transcription
- [ ] Commit backend implementation

## Questions for Jarmo

1. Should I proceed to build whisper.cpp from source?
2. Or would you prefer to provide a pre-built binary?
3. Do you have whisper.cpp already installed via Homebrew for testing?

---

**Status**: Backend code complete, waiting for binary before testing.

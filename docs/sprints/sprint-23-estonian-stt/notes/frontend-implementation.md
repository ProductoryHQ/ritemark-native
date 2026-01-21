# Frontend Implementation - Voice Dictation

**Date:** 2026-01-17
**Phase:** 3/4 (Frontend Development)

## Implemented Components

### 1. Voice Dictation Hook (`webview/src/hooks/useVoiceDictation.ts`)

Custom React hook that manages:
- **Microphone access**: Requests user permission
- **Audio capture**: Uses Web Audio API with MediaRecorder
- **State management**: idle → listening → processing → error
- **Audio streaming**: Sends 1-second chunks to extension as base64
- **Error handling**: User-friendly error messages

**Audio format:**
- Codec: `audio/webm;codecs=opus` (browser native, will be converted by backend)
- Sample rate: 16kHz (requested, but browser may vary)
- Channels: Mono
- Chunk size: 1 second intervals

**States:**
- `idle`: Ready to start
- `listening`: Recording audio, sending to extension
- `processing`: Waiting for transcription
- `error`: Display error message

### 2. Voice Dictation Button (`webview/src/components/VoiceDictationButton.tsx`)

UI component with visual feedback:
- **Idle**: Gray mic icon (Mic)
- **Listening**: Red pulsing mic icon (Mic2)
- **Processing**: Blue spinning loader (Loader2)
- **Error**: Yellow warning icon (AlertTriangle)

Positioned in DocumentHeader (fixed top toolbar).

### 3. Document Header Integration (`webview/src/components/header/DocumentHeader.tsx`)

Added voice dictation button to header toolbar:
- Position: Between Properties and Export buttons
- Uses existing header-btn styling
- Responsive: Text hidden on narrow screens

### 4. Transcription Handling (`webview/src/App.tsx`)

Listens for `dictation:transcription` messages from extension:
- Receives transcribed text
- Inserts at current cursor position
- Adds trailing space for natural flow
- Uses TipTap editor commands: `editor.chain().focus().insertContent(text + ' ').run()`

## Bridge Message Protocol

### Webview → Extension

| Message Type | Payload | Description |
|--------------|---------|-------------|
| `dictation:start` | `{}` | User clicked mic button, start transcription |
| `dictation:stop` | `{}` | User stopped dictation, end transcription |
| `dictation:audioChunk` | `{ audioData: string }` | Base64-encoded audio chunk (1s interval) |

### Extension → Webview

| Message Type | Payload | Description |
|--------------|---------|-------------|
| `dictation:status` | `{ status: 'idle' \| 'listening' \| 'processing' }` | State update from backend |
| `dictation:transcription` | `{ text: string }` | Transcribed text to insert |
| `dictation:error` | `{ error: string }` | User-friendly error message |

## Backend Integration Points

The backend (extension side) needs to handle:

### 1. Message Handlers

Add to `src/ritemarkEditor.ts` or appropriate message handler:

```typescript
case 'dictation:start':
  await dictationController.startDictation('et') // Estonian language
  break

case 'dictation:stop':
  await dictationController.stopDictation()
  break

case 'dictation:audioChunk':
  const audioData = message.audioData as string
  await dictationController.handleAudioChunk(audioData)
  break
```

### 2. Audio Format Conversion

The frontend sends `audio/webm;codecs=opus` format. The backend needs to:
1. Decode base64 to Buffer
2. Convert WebM/Opus to WAV PCM16 16kHz mono
3. Pipe to whisper.cpp stdin

**Note:** whisper.cpp expects WAV format. You may need a conversion library like:
- `fluent-ffmpeg` (if ffmpeg available)
- `wav` (if converting from raw PCM)
- Or handle in whisper.cpp directly (check if it supports opus input)

### 3. Transcription Flow

```
1. Webview sends dictation:start
2. Backend spawns whisper.cpp process
3. Webview sends audio chunks (1s intervals)
4. Backend converts and pipes to whisper stdin
5. Backend reads whisper stdout (transcription text)
6. Backend sends dictation:transcription to webview
7. Webview inserts text at cursor
8. Repeat steps 3-7 until user clicks stop
9. Webview sends dictation:stop
10. Backend kills whisper process
```

### 4. Error Handling

Send user-friendly errors to webview:

```typescript
panel.webview.postMessage({
  type: 'dictation:error',
  error: 'Model not downloaded. Please download the speech model first.'
})
```

Common errors to handle:
- Model not downloaded
- whisper.cpp binary not found
- whisper.cpp process crash
- Audio format conversion failure
- No audio input received

## Testing Checklist

### Frontend (Ready to Test)

- [ ] Mic button appears in DocumentHeader
- [ ] Button states: idle (gray), listening (red pulse), processing (blue spin), error (yellow)
- [ ] Click mic button requests microphone permission
- [ ] Audio capture starts after permission granted
- [ ] Audio chunks sent to extension every 1 second
- [ ] Transcribed text appears at cursor position
- [ ] Click mic again stops recording
- [ ] Error messages display in button tooltip
- [ ] Responsive: Button text hidden on narrow screens

### Integration (Needs Backend)

- [ ] Extension receives `dictation:start` message
- [ ] Extension receives `dictation:audioChunk` messages
- [ ] Extension receives `dictation:stop` message
- [ ] Extension sends `dictation:transcription` with text
- [ ] Extension sends `dictation:status` updates
- [ ] Extension sends `dictation:error` on failure

### End-to-End (Full Stack)

- [ ] Click mic → permission prompt → start recording
- [ ] Speak in English → text appears at cursor
- [ ] Speak in Estonian → text appears at cursor
- [ ] Click mic again → stop recording → final text inserted
- [ ] Multiple start/stop cycles work correctly
- [ ] Undo (Cmd+Z) removes entire dictated segment
- [ ] Long dictation (5+ minutes) works without memory leak

## Known Limitations

1. **Audio Format**: Browser sends WebM/Opus, may need conversion to WAV PCM16 for whisper.cpp
2. **Sample Rate**: Requested 16kHz, but browser may use different rate. Backend should resample if needed.
3. **Real-time Feel**: 1-second chunks may introduce latency. Can be tuned (500ms or 2s) based on testing.
4. **Microphone Permission**: One-time browser prompt. If denied, user must enable in browser settings.
5. **Platform Support**: Frontend works cross-platform, but backend (whisper.cpp) is macOS-only initially.

## Next Steps

1. **Backend Integration**: Implement message handlers in extension
2. **Audio Conversion**: Add WebM → WAV conversion pipeline
3. **Whisper Integration**: Connect audio pipeline to existing whisper.cpp wrapper
4. **Error Flow**: Test and refine error messages
5. **Performance Tuning**: Optimize chunk size for latency vs. overhead
6. **Estonian Testing**: Test with Estonian speech (Jarmo validation)

## Files Modified/Created

### Created:
- `webview/src/hooks/useVoiceDictation.ts` (202 lines)
- `webview/src/components/VoiceDictationButton.tsx` (95 lines)
- `docs/sprints/sprint-23-estonian-stt/notes/frontend-implementation.md` (this file)

### Modified:
- `webview/src/components/header/DocumentHeader.tsx` (added VoiceDictationButton import and component)
- `webview/src/App.tsx` (added dictation:transcription message handler)

Total: ~300 lines of new frontend code

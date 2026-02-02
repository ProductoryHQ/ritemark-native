# Backend Integration Guide - Voice Dictation

**Date:** 2026-01-17
**Status:** Frontend complete, needs backend connection

## Overview

The frontend is ready and sends audio chunks to the extension. Now we need to:
1. Connect message handlers in `ritemarkEditor.ts`
2. Convert WebM audio to WAV format for whisper.cpp
3. Pipe audio to existing whisper.cpp wrapper
4. Send transcriptions back to webview

## Step 1: Add Message Handlers

In `src/ritemarkEditor.ts`, add to the message handler switch:

```typescript
case 'dictation:start':
  if (!this.dictationController) {
    this.dictationController = new DictationController(this._panel)
  }
  await this.dictationController.startDictation('et') // Estonian
  break

case 'dictation:stop':
  if (this.dictationController) {
    await this.dictationController.stopDictation()
  }
  break

case 'dictation:audioChunk':
  if (this.dictationController) {
    const audioData = message.audioData as string
    await this.dictationController.handleAudioChunk(audioData)
  }
  break
```

## Step 2: Audio Format Conversion

The frontend sends `audio/webm;codecs=opus` as base64. We need to convert to WAV PCM16 16kHz mono.

### Option A: Use ffmpeg (if available)

```typescript
import * as child_process from 'child_process'
import * as fs from 'fs'

async function convertWebMToWav(webmBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = child_process.spawn('ffmpeg', [
      '-i', 'pipe:0',           // Input from stdin
      '-ar', '16000',           // Sample rate 16kHz
      '-ac', '1',               // Mono
      '-f', 'wav',              // Output format WAV
      '-acodec', 'pcm_s16le',   // PCM 16-bit little-endian
      'pipe:1'                  // Output to stdout
    ])

    const chunks: Buffer[] = []

    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk))
    ffmpeg.stdout.on('end', () => resolve(Buffer.concat(chunks)))
    ffmpeg.stderr.on('data', (data) => console.error('ffmpeg:', data.toString()))
    ffmpeg.on('error', reject)

    ffmpeg.stdin.write(webmBuffer)
    ffmpeg.stdin.end()
  })
}
```

### Option B: Use whisper.cpp directly with opus support

Check if whisper.cpp can accept opus input directly:
```bash
./binaries/darwin-arm64/whisper-cli --help | grep -i opus
```

If yes, skip conversion and pipe WebM directly.

### Option C: Use node-opus or opus-stream (npm package)

```bash
npm install opus-stream wav-encoder
```

```typescript
import opus from 'opus-stream'
import WavEncoder from 'wav-encoder'

async function convertWebMToWav(webmBuffer: Buffer): Promise<Buffer> {
  // Decode opus to PCM
  const decoder = new opus.Decoder()
  const pcmData = decoder.decode(webmBuffer)

  // Encode to WAV
  const wavBuffer = await WavEncoder.encode({
    sampleRate: 16000,
    channelData: [pcmData] // Mono
  })

  return Buffer.from(wavBuffer)
}
```

## Step 3: Connect to Whisper Controller

Update `src/voiceDictation/controller.ts` to accept streaming audio:

```typescript
export class DictationController {
  private whisperProcess: WhisperProcess | null = null
  private audioBuffer: Buffer[] = []

  async handleAudioChunk(base64Audio: string) {
    // Decode base64 to buffer
    const webmBuffer = Buffer.from(base64Audio, 'base64')

    // Convert to WAV format
    const wavBuffer = await convertWebMToWav(webmBuffer)

    // Write to whisper stdin
    if (this.whisperProcess) {
      this.whisperProcess.writeAudio(wavBuffer)
    }
  }

  private onWhisperOutput(text: string) {
    // Send transcription to webview
    this._panel.webview.postMessage({
      type: 'dictation:transcription',
      text: text.trim()
    })
  }
}
```

## Step 4: Update WhisperProcess for Streaming

In `src/voiceDictation/whisperCpp.ts`, ensure the process can accept streaming input:

```typescript
export class WhisperProcess {
  private process: child_process.ChildProcess | null = null

  spawn(language: string, modelPath: string) {
    this.process = child_process.spawn(this.binaryPath, [
      '--model', modelPath,
      '--language', language,
      '--stream',           // Enable streaming mode
      '--threads', '4',
      '-'                   // Read from stdin
    ])

    // Listen for output
    this.process.stdout?.on('data', (data) => {
      const text = data.toString().trim()
      if (text) {
        this.onTranscriptionCallback?.(text)
      }
    })
  }

  writeAudio(audioBuffer: Buffer) {
    if (this.process && this.process.stdin) {
      this.process.stdin.write(audioBuffer)
    }
  }
}
```

## Step 5: Error Handling

Send user-friendly errors to webview:

```typescript
try {
  // ... whisper processing
} catch (error) {
  this._panel.webview.postMessage({
    type: 'dictation:error',
    error: 'Failed to transcribe audio. Please try again.'
  })
}
```

Common error scenarios:
- Model not downloaded → "Speech model not found. Please download it first."
- Binary not found → "Voice dictation is not available on this platform."
- Process crash → "Transcription failed. Please try again."
- No audio → "No audio detected. Please check your microphone."

## Step 6: Status Updates (Optional)

Send status updates to keep webview in sync:

```typescript
// When whisper starts processing
this._panel.webview.postMessage({
  type: 'dictation:status',
  status: 'processing'
})

// When ready for more audio
this._panel.webview.postMessage({
  type: 'dictation:status',
  status: 'listening'
})
```

## Testing Flow

1. **Start Webview Dev Mode**:
   ```bash
   cd webview
   npm run dev
   ```

2. **Start Extension Dev Mode**:
   ```bash
   cd ../..
   npm run watch
   ```

3. **Test in VS Code**:
   - Open Ritemark Native in dev window (F5)
   - Open a markdown file
   - Click mic button
   - Speak into microphone
   - Verify text appears at cursor

4. **Debug Messages**:
   ```typescript
   console.log('[Dictation] Received audio chunk:', webmBuffer.length, 'bytes')
   console.log('[Dictation] Converted to WAV:', wavBuffer.length, 'bytes')
   console.log('[Dictation] Transcription:', text)
   ```

## Audio Format Reference

| Property | Frontend (Browser) | Backend (whisper.cpp) |
|----------|-------------------|----------------------|
| Container | WebM | WAV |
| Codec | Opus | PCM16 |
| Sample Rate | 16kHz (requested) | 16kHz |
| Channels | Mono | Mono |
| Bit Depth | Variable (opus) | 16-bit |
| Chunk Size | ~1 second | Continuous stream |

## Troubleshooting

### Audio Not Reaching Backend
- Check console logs for message flow
- Verify base64 decoding works
- Test with small audio file first

### Whisper Not Producing Output
- Check whisper.cpp binary exists and is executable
- Test binary manually: `echo "test" | ./whisper-cli -`
- Check whisper stderr for errors
- Verify model path is correct

### Poor Transcription Quality
- Check audio sample rate (should be 16kHz)
- Verify mono channel
- Test with English first (easier to debug)
- Increase chunk size for better context

### High Latency
- Reduce audio chunk size (500ms instead of 1s)
- Use smaller whisper model (tiny or base)
- Enable Metal GPU acceleration
- Profile whisper.cpp processing time

## Next Steps

1. Implement audio conversion (choose option A, B, or C)
2. Connect message handlers in ritemarkEditor.ts
3. Update dictation controller to handle streaming
4. Test with English audio
5. Test with Estonian audio
6. Tune chunk size and latency
7. Add user-friendly error messages
8. Validate with Jarmo's Estonian dictation

## Files to Modify

- `src/ritemarkEditor.ts` - Add message handlers
- `src/voiceDictation/controller.ts` - Add audio conversion and streaming
- `src/voiceDictation/whisperCpp.ts` - Ensure streaming mode works
- `src/utils/audioConversion.ts` - New file for WebM → WAV conversion (if needed)

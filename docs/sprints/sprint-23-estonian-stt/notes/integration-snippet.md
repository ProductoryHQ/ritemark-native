# Quick Integration Snippet

**File**: `/Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/src/ritemarkEditor.ts`

## Step 1: Add Import

At the top of the file (around line 8-9), add:

```typescript
import { DictationController } from './voiceDictation/controller';
```

## Step 2: Add Instance Variable

In the `RitemarkEditorProvider` class (around line 18-28), add:

```typescript
export class RitemarkEditorProvider implements vscode.CustomTextEditorProvider {
  // ... existing static properties ...

  // Add this:
  private dictationControllers = new Map<string, DictationController>();

  // ... rest of class ...
}
```

## Step 3: Add Message Handlers

In the `webview.onDidReceiveMessage` switch statement (around line 248-300), add these cases after the `selectionChanged` case:

```typescript
case 'selectionChanged':
  // Forward selection and document content to AI panel
  if (RitemarkEditorProvider._aiViewProvider) {
    RitemarkEditorProvider._aiViewProvider.sendSelection(
      message.selection,
      document.getText()
    );
  }
  return;

// ===== ADD THESE NEW CASES HERE =====

case 'dictation:start':
  // Start voice dictation
  if (!this.dictationControllers.has(document.uri.fsPath)) {
    this.dictationControllers.set(
      document.uri.fsPath,
      new DictationController(webview, this.context)
    );
  }
  const controller = this.dictationControllers.get(document.uri.fsPath)!;
  controller.startDictation('et'); // Estonian language
  return;

case 'dictation:stop':
  // Stop voice dictation
  const stopController = this.dictationControllers.get(document.uri.fsPath);
  if (stopController) {
    stopController.stopDictation();
  }
  return;

case 'dictation:audioChunk':
  // Handle incoming audio chunk
  const audioController = this.dictationControllers.get(document.uri.fsPath);
  if (audioController) {
    const audioData = message.audioData as string;
    audioController.handleAudioChunk(audioData);
  }
  return;

// ===== END NEW CASES =====

case 'wordCountChanged':
  // Update word count in status bar
  // ... existing code ...
```

## Step 4: Cleanup on Dispose

In the webview disposal handler (find `webviewPanel.onDidDispose`), add:

```typescript
webviewPanel.onDidDispose(() => {
  // ... existing cleanup code ...

  // Add this cleanup:
  const controller = this.dictationControllers.get(document.uri.fsPath);
  if (controller) {
    controller.cleanup();
    this.dictationControllers.delete(document.uri.fsPath);
  }
});
```

## Step 5: Update Controller Constructor

In `/Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/src/voiceDictation/controller.ts`, update the constructor to accept webview:

```typescript
export class DictationController {
  private whisperProcess: WhisperProcess | null = null;
  private audioBuffer: Buffer[] = [];

  constructor(
    private webview: vscode.Webview,
    private context: vscode.ExtensionContext
  ) {}

  async startDictation(language: string) {
    // ... existing code ...

    // Send status update to webview
    this.webview.postMessage({
      type: 'dictation:status',
      status: 'listening'
    });
  }

  private onWhisperOutput(text: string) {
    // Send transcription to webview
    this.webview.postMessage({
      type: 'dictation:transcription',
      text: text.trim()
    });
  }

  private onError(error: Error) {
    // Send error to webview
    this.webview.postMessage({
      type: 'dictation:error',
      error: this.getUserFriendlyError(error)
    });
  }

  private getUserFriendlyError(error: Error): string {
    if (error.message.includes('model not found')) {
      return 'Speech model not downloaded. Please wait while we download it (this happens once).';
    }
    if (error.message.includes('binary not found')) {
      return 'Voice dictation is not available on this system.';
    }
    return 'Dictation failed. Please try again.';
  }
}
```

## Step 6: Add Audio Conversion

Create `/Users/jarmotuisk/Projects/ritemark-native/extensions/ritemark/src/voiceDictation/audioConverter.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Convert WebM audio (base64) to WAV PCM16 16kHz mono
 *
 * Uses ffmpeg if available, otherwise returns error
 */
export async function convertWebMToWav(base64Audio: string): Promise<Buffer> {
  // Decode base64 to buffer
  const webmBuffer = Buffer.from(base64Audio, 'base64');

  // Create temp files
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input-${Date.now()}.webm`);
  const outputPath = path.join(tmpDir, `output-${Date.now()}.wav`);

  try {
    // Write input file
    fs.writeFileSync(inputPath, webmBuffer);

    // Convert using ffmpeg
    await execAsync(`ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -f wav -acodec pcm_s16le "${outputPath}"`);

    // Read output
    const wavBuffer = fs.readFileSync(outputPath);

    // Cleanup
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return wavBuffer;
  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    throw new Error(`Audio conversion failed: ${error}`);
  }
}
```

## Step 7: Use Audio Converter in Controller

In `controller.ts`, add the audio conversion:

```typescript
import { convertWebMToWav } from './audioConverter';

export class DictationController {
  // ...

  async handleAudioChunk(base64Audio: string) {
    try {
      // Convert WebM to WAV
      const wavBuffer = await convertWebMToWav(base64Audio);

      // Write to whisper stdin
      if (this.whisperProcess) {
        this.whisperProcess.writeAudio(wavBuffer);
      }
    } catch (error) {
      console.error('Audio conversion error:', error);
      this.onError(error as Error);
    }
  }
}
```

## Testing

1. Build extension: `npm run compile`
2. Launch dev window: F5
3. Open markdown file
4. Click mic button in header
5. Speak into microphone
6. Verify text appears at cursor

## Troubleshooting

If ffmpeg is not found:
```bash
# Install ffmpeg on macOS
brew install ffmpeg

# Verify installation
which ffmpeg
ffmpeg -version
```

If audio conversion fails:
- Check ffmpeg is in PATH
- Test conversion manually: `ffmpeg -i input.webm -ar 16000 -ac 1 output.wav`
- Add error logging: `console.error('[Audio] Conversion error:', error)`

If no transcription:
- Check whisper.cpp binary is executable: `ls -la binaries/darwin-arm64/whisper-cli`
- Test whisper manually: `echo "test" | ./binaries/darwin-arm64/whisper-cli --model ...`
- Check whisper stdout/stderr logs
- Verify model file exists: `ls -la ~/.ritemark/models/`

---

**After Integration**: Test with English first, then Estonian. Tune chunk size if latency is high.

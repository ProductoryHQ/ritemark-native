// Voice dictation controller
// Manages audio collection and whisper.cpp transcription
//
// UX DESIGN (Option A - Incremental):
// - Audio chunks arrive every 5 seconds from webview
// - Each chunk is transcribed IMMEDIATELY
// - Text appears in editor every 5 seconds while recording
// - User sees progress as they speak

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { transcribeAudio, getWhisperBinaryPath, getModelPath } from './whisperCpp';

export class DictationController {
  private isRecording = false;
  private language = 'en';
  private isProcessing = false; // Prevent overlapping transcriptions

  constructor(
    private webview: vscode.Webview,
    private context: vscode.ExtensionContext
  ) {}

  /**
   * Start recording - just sets up state, audio comes via handleAudioChunk
   */
  startDictation(language: string): void {
    this.language = language || 'en';
    this.isRecording = true;
    this.isProcessing = false;

    this.webview.postMessage({
      type: 'dictation:status',
      status: 'listening'
    });
  }

  /**
   * Handle incoming audio chunk (base64 WAV from webview)
   * PROCESSES IMMEDIATELY for incremental text feedback
   */
  async handleAudioChunk(base64Audio: string): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    // Prevent overlapping transcriptions (if previous chunk still processing)
    if (this.isProcessing) {
      return;
    }

    try {
      const buffer = Buffer.from(base64Audio, 'base64');

      // Skip very small chunks (likely silence or errors)
      if (buffer.length < 1000) {
        return;
      }

      // Process this chunk immediately
      this.isProcessing = true;

      // Notify webview we're processing
      this.webview.postMessage({
        type: 'dictation:status',
        status: 'processing'
      });

      // Write to temp file
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `ritemark-dictation-${Date.now()}.wav`);
      fs.writeFileSync(tempFile, buffer);

      // Get whisper paths
      const binaryPath = getWhisperBinaryPath(this.context);
      const modelPath = getModelPath();

      if (!fs.existsSync(binaryPath)) {
        throw new Error(`Whisper binary not found: ${binaryPath}`);
      }

      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model not found: ${modelPath}`);
      }

      // Transcribe this chunk
      const transcription = await transcribeAudio({
        audioPath: tempFile,
        modelPath: modelPath,
        binaryPath: binaryPath,
        language: this.language
      });

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      // Send result to webview (only if we got actual text)
      if (transcription && transcription.trim().length > 0) {
        this.webview.postMessage({
          type: 'dictation:transcription',
          text: transcription.trim()
        });
      }

      // Back to listening state if still recording
      if (this.isRecording) {
        this.webview.postMessage({
          type: 'dictation:status',
          status: 'listening'
        });
      }

    } catch (error) {
      console.error('[DictationController] Transcription error:', error);

      // Send critical errors to user (binary/model missing should stop dictation)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('binary not found') || errorMessage.includes('Model not found')) {
        this.webview.postMessage({
          type: 'dictation:error',
          error: this.getUserFriendlyError(errorMessage)
        });
        this.isRecording = false;
      }
      // Other errors (transcription failures) - continue recording, next chunk may work
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Stop recording
   * With incremental processing, there's no final batch to process
   */
  async stopDictation(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;

    this.webview.postMessage({
      type: 'dictation:status',
      status: 'idle'
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.isRecording = false;
    this.isProcessing = false;
  }

  /**
   * Check if dictation is currently active (recording or processing)
   */
  isActive(): boolean {
    return this.isRecording || this.isProcessing;
  }

  /**
   * Convert error to user-friendly message
   */
  private getUserFriendlyError(error: string): string {
    if (error.includes('model not found') || error.includes('Model not found')) {
      return 'Speech model not downloaded. Click the mic button to download.';
    }
    if (error.includes('binary not found') || error.includes('Whisper binary not found')) {
      return 'Voice dictation is not available on this system.';
    }
    if (error.includes('No audio')) {
      return 'No audio was recorded. Please try again.';
    }
    return 'Transcription failed. Please try again.';
  }
}

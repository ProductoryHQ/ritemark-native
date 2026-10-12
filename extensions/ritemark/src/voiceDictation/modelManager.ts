/**
 * Model Manager for whisper.cpp models
 * Handles downloading and caching of whisper models
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import { AVAILABLE_MODELS, defaultModelFile, getModelDirectory, getModelPath, withFileRetry, type ModelInfo } from './whisperCpp';

// Sprint 129 R7: one model location for dictation, Transcribe and Settings.
// R13: the model table lives in whisperCpp.ts, which loads without VS Code.
export { AVAILABLE_MODELS, defaultModelFile, getModelDirectory, getModelPath };
export type { ModelInfo };

// Maximum redirects to follow
const MAX_REDIRECTS = 5;

/**
 * Get path for partial download
 */
function getPartialPath(modelName: string): string {
  return getModelPath(modelName) + '.partial';
}

/**
 * Check if a model exists and is valid
 */
export function isModelDownloaded(modelName: string = defaultModelFile()): boolean {
  const modelPath = getModelPath(modelName);
  if (!fs.existsSync(modelPath)) {
    return false;
  }

  const modelInfo = AVAILABLE_MODELS[modelName];
  if (!modelInfo) {
    return false;
  }

  // Sprint 129 R7: the exact size. A file cut short is not a model.
  return fs.statSync(modelPath).size === modelInfo.size;
}

/**
 * Get existing partial download size
 */
function getPartialSize(modelName: string): number {
  const partialPath = getPartialPath(modelName);
  if (fs.existsSync(partialPath)) {
    return fs.statSync(partialPath).size;
  }
  return 0;
}

/**
 * Follow redirects and get final URL
 */
async function resolveRedirects(url: string, maxRedirects: number = MAX_REDIRECTS): Promise<string> {
  return new Promise((resolve, reject) => {
    let redirectCount = 0;

    function followUrl(currentUrl: string) {
      const protocol = currentUrl.startsWith('https') ? https : http;

      const request = protocol.get(currentUrl, {
        headers: { 'User-Agent': 'Ritemark/1.0' },
        timeout: 10000
      }, (response) => {
        // Only the final URL is wanted here: never let a 1.6 GB body start flowing.
        response.destroy();
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            reject(new Error(`Too many redirects (>${maxRedirects})`));
            return;
          }

          const location = response.headers.location;
          if (!location) {
            reject(new Error('Redirect without location header'));
            return;
          }

          // Handle relative URLs
          const nextUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
          followUrl(nextUrl);
        } else if (response.statusCode === 200) {
          resolve(currentUrl);
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout while resolving redirects'));
      });
    }

    followUrl(url);
  });
}

export interface DownloadOptions {
  onProgress?: (downloaded: number, total: number, speed: number) => void;
  onCancel?: () => boolean; // Return true if cancelled
  resume?: boolean;
  /** Waits between attempts after a dropped connection (tests shorten them). */
  retryDelaysMs?: number[];
}

/**
 * Sprint 129 R7: a dropped connection resumes on its own. The Hugging Face CDN
 * closed the connection twice in one 1.6 GB download on a Windows test machine.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000];

/** No bytes for this long counts as a dropped connection. */
const STALL_TIMEOUT_MS = 60_000;

type AttemptResult =
  | { kind: 'complete' }
  | { kind: 'cancelled' }
  | { kind: 'retry'; error: string }
  | { kind: 'fatal'; error: string };

function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/** One request, appending to the partial file from where it ends. */
async function downloadAttempt(modelInfo: ModelInfo, partialPath: string, options: DownloadOptions): Promise<AttemptResult> {
  let startByte = fs.existsSync(partialPath) ? fs.statSync(partialPath).size : 0;
  if (startByte >= modelInfo.size) {
    return { kind: 'complete' };
  }

  let finalUrl: string;
  try {
    finalUrl = await resolveRedirects(modelInfo.url);
  } catch (error) {
    return { kind: 'retry', error: `Connection error: ${error instanceof Error ? error.message : String(error)}.` };
  }

  return new Promise<AttemptResult>((resolve) => {
    let settled = false;
    const headers: Record<string, string> = { 'User-Agent': 'Ritemark/1.0' };
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const protocol = finalUrl.startsWith('https') ? https : http;
    const request = protocol.get(finalUrl, { headers }, (response) => {
      const isPartialContent = response.statusCode === 206;
      const isOk = response.statusCode === 200;

      if (!isOk && !isPartialContent) {
        response.resume();
        const status = response.statusCode ?? 0;
        const transient = status === 408 || status === 429 || status >= 500;
        finish(transient
          ? { kind: 'retry', error: `Server returned HTTP ${status}.` }
          : { kind: 'fatal', error: `Server returned HTTP ${status}` });
        return;
      }

      // A server that ignores Range sends the whole file again: start over.
      if (startByte > 0 && !isPartialContent) {
        startByte = 0;
      }
      const file = fs.createWriteStream(partialPath, { flags: startByte > 0 ? 'a' : 'w' });

      let downloadedBytes = startByte;
      let lastProgressTime = Date.now();
      let lastProgressBytes = startByte;

      response.on('data', (chunk: Buffer) => {
        if (options.onCancel?.()) {
          request.destroy();
          file.end(() => finish({ kind: 'cancelled' }));
          return;
        }

        downloadedBytes += chunk.length;
        file.write(chunk);

        // Calculate speed
        const now = Date.now();
        const timeDelta = (now - lastProgressTime) / 1000;
        let speed = 0;
        if (timeDelta > 0.5) { // Update speed every 0.5s
          speed = (downloadedBytes - lastProgressBytes) / timeDelta;
          lastProgressTime = now;
          lastProgressBytes = downloadedBytes;
        }
        options.onProgress?.(downloadedBytes, modelInfo.size, speed);
      });

      // 'end' on a clean finish; 'aborted'/'error' when the connection drops.
      response.on('end', () => {
        file.end(() => finish(downloadedBytes >= modelInfo.size
          ? { kind: 'complete' }
          : { kind: 'retry', error: `The connection closed at ${Math.round(downloadedBytes / 1024 / 1024)} MB.` }));
      });
      response.on('aborted', () => {
        file.end(() => finish({ kind: 'retry', error: 'The connection was interrupted.' }));
      });
      response.on('error', (error) => {
        console.error('[ModelManager] Response error:', error);
        file.end(() => finish({ kind: 'retry', error: `Network error: ${error.message}.` }));
      });
    });

    request.on('error', (error) => {
      console.error('[ModelManager] Request error:', error);
      finish({ kind: 'retry', error: `Connection error: ${error.message}.` });
    });

    request.setTimeout(STALL_TIMEOUT_MS, () => {
      request.destroy(new Error('no data for 60 seconds'));
    });

    function finish(result: AttemptResult): void {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    }
  });
}

/**
 * Download a model with progress reporting and resume support.
 *
 * Sprint 129 R7: resumes on its own after a dropped connection, and accepts the
 * file only at its exact size and SHA-256 (the old 90%-of-size check accepted a
 * download cut short, which left a model whisper could not load).
 */
export async function downloadModel(
  modelName: string = defaultModelFile(),
  options: DownloadOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const modelInfo = AVAILABLE_MODELS[modelName];
  if (!modelInfo) {
    return { success: false, error: `Unknown model: ${modelName}` };
  }

  if (!modelInfo.url) {
    return { success: false, error: `No download URL for model: ${modelName}` };
  }

  const modelDir = getModelDirectory();
  const modelPath = getModelPath(modelName);
  const partialPath = getPartialPath(modelName);

  // Create directory if it doesn't exist
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  if (options.resume === false && fs.existsSync(partialPath)) {
    fs.unlinkSync(partialPath);
  }

  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt += 1) {
    const result = await downloadAttempt(modelInfo, partialPath, options);
    if (result.kind === 'cancelled') {
      return { success: false, error: 'Download cancelled' };
    }
    if (result.kind === 'fatal') {
      return { success: false, error: result.error };
    }
    if (result.kind === 'complete') {
      break;
    }
    if (attempt >= delays.length) {
      return { success: false, error: `${result.error} Partial download saved, click Download to resume.` };
    }
    console.warn(`[ModelManager] ${result.error} Resuming in ${delays[attempt] / 1000} s.`);
    await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    if (options.onCancel?.()) {
      return { success: false, error: 'Download cancelled' };
    }
  }

  const damaged = 'The download was damaged. Click Download to try again.';
  const size = fs.statSync(partialPath).size;
  if (size !== modelInfo.size) {
    console.error(`[ModelManager] Downloaded ${size} bytes, expected ${modelInfo.size}`);
    fs.rmSync(partialPath, { force: true });
    return { success: false, error: damaged };
  }
  if (modelInfo.sha256) {
    const actual = await sha256File(partialPath);
    if (actual !== modelInfo.sha256) {
      console.error(`[ModelManager] SHA-256 ${actual}, expected ${modelInfo.sha256}`);
      fs.rmSync(partialPath, { force: true });
      return { success: false, error: damaged };
    }
  }

  // Rename partial to final, waiting out an antivirus scan (Windows)
  try {
    await withFileRetry(() => {
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
      }
      fs.renameSync(partialPath, modelPath);
    });
  } catch (error) {
    return { success: false, error: `Could not save the voice model: ${error instanceof Error ? error.message : String(error)}` };
  }
  return { success: true };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

/**
 * Format speed to human readable
 */
function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
}

/**
 * Show download dialog and handle model download
 */
export async function ensureModelDownloaded(
  modelName: string = defaultModelFile()
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (isModelDownloaded(modelName)) {
    return { success: true };
  }

  const modelInfo = AVAILABLE_MODELS[modelName];
  if (!modelInfo) {
    return { success: false, error: `Unknown model: ${modelName}` };
  }

  // Check for partial download
  const partialSize = getPartialSize(modelName);
  const hasPartial = partialSize > 0;

  // Build message (keep short to fit one line)
  let message: string;
  if (hasPartial) {
    const partialMB = Math.round(partialSize / 1024 / 1024);
    const totalMB = Math.round(modelInfo.size / 1024 / 1024);
    message = `Resume download? (${partialMB}/${totalMB}MB done)`;
  } else {
    message = `Download voice model (${modelInfo.sizeDisplay})?`;
  }

  // Ask user to download
  const response = await vscode.window.showInformationMessage(
    message,
    hasPartial ? 'Resume' : 'Download',
    'Cancel'
  );

  if (response !== 'Download' && response !== 'Resume') {
    return { success: false, cancelled: true };
  }

  // Show progress
  let isCancelled = false;

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: hasPartial ? 'Resuming download' : 'Downloading voice model',
      cancellable: true
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        isCancelled = true;
      });

      let lastPercent = 0;

      const downloadResult = await downloadModel(modelName, {
        resume: true,
        onCancel: () => isCancelled,
        onProgress: (downloaded, total, speed) => {
          const percent = Math.round((downloaded / total) * 100);
          if (percent > lastPercent || speed > 0) {
            const speedStr = speed > 0 ? ` • ${formatSpeed(speed)}` : '';
            progress.report({
              increment: percent - lastPercent,
              message: `${percent}% (${formatBytes(downloaded)} / ${formatBytes(total)})${speedStr}`
            });
            lastPercent = percent;
          }
        }
      });

      return downloadResult;
    }
  );

  if (isCancelled) {
    vscode.window.showInformationMessage('Download paused. Click mic to resume.');
    return { success: false, cancelled: true };
  }

  if (result.success) {
    vscode.window.showInformationMessage('Voice model ready! Click mic to start.');
  } else if (result.error) {
    vscode.window.showErrorMessage(`Download failed: ${result.error}`);
  }

  return result;
}

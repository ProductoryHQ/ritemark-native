/**
 * Model Manager for whisper.cpp models
 * Handles downloading and caching of whisper models
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as os from 'os';

export interface ModelInfo {
  name: string;
  url: string;
  size: number; // bytes
  sizeDisplay: string;
}

// Available models
export const AVAILABLE_MODELS: Record<string, ModelInfo> = {
  'ggml-small.bin': {
    name: 'small',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    size: 466_000_000,
    sizeDisplay: '466MB'
  },
  'ggml-large-v3-turbo.bin': {
    name: 'large-v3-turbo',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    size: 1_500_000_000,
    sizeDisplay: '1.5GB'
  }
};

// Use large-v3-turbo for best multilingual support
const DEFAULT_MODEL = 'ggml-large-v3-turbo.bin';

// Maximum redirects to follow
const MAX_REDIRECTS = 5;

// Download timeout (15 minutes for large files)
const DOWNLOAD_TIMEOUT = 15 * 60 * 1000;

/**
 * Get the directory where models are stored
 */
export function getModelDirectory(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.ritemark', 'models');
}

/**
 * Get the full path to a model file
 */
export function getModelPath(modelName: string = DEFAULT_MODEL): string {
  return path.join(getModelDirectory(), modelName);
}

/**
 * Get path for partial download
 */
function getPartialPath(modelName: string): string {
  return getModelPath(modelName) + '.partial';
}

/**
 * Check if a model exists and is valid
 */
export function isModelDownloaded(modelName: string = DEFAULT_MODEL): boolean {
  const modelPath = getModelPath(modelName);
  if (!fs.existsSync(modelPath)) {
    return false;
  }

  const modelInfo = AVAILABLE_MODELS[modelName];
  if (!modelInfo) {
    return false;
  }

  // Check file size is at least 90% of expected (some tolerance)
  const stats = fs.statSync(modelPath);
  const minSize = modelInfo.size * 0.9;
  return stats.size >= minSize;
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
}

/**
 * Download a model with progress reporting and resume support
 */
export async function downloadModel(
  modelName: string = DEFAULT_MODEL,
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

  // Check for existing partial download
  let startByte = 0;
  if (options.resume !== false && fs.existsSync(partialPath)) {
    startByte = fs.statSync(partialPath).size;
  } else if (fs.existsSync(partialPath)) {
    fs.unlinkSync(partialPath);
  }

  try {
    // Resolve redirects first
    const finalUrl = await resolveRedirects(modelInfo.url);

    return new Promise((resolve) => {
      const file = fs.createWriteStream(partialPath, {
        flags: startByte > 0 ? 'a' : 'w'
      });

      let downloadedBytes = startByte;
      let lastProgressTime = Date.now();
      let lastProgressBytes = startByte;

      const headers: Record<string, string> = {
        'User-Agent': 'Ritemark/1.0'
      };

      // Request range if resuming
      if (startByte > 0) {
        headers['Range'] = `bytes=${startByte}-`;
      }

      const protocol = finalUrl.startsWith('https') ? https : http;
      const request = protocol.get(finalUrl, { headers }, (response) => {
        // Check for successful response
        const isPartialContent = response.statusCode === 206;
        const isOk = response.statusCode === 200;

        if (!isOk && !isPartialContent) {
          file.close();
          fs.unlinkSync(partialPath);
          resolve({ success: false, error: `Server returned HTTP ${response.statusCode}` });
          return;
        }

        // If server doesn't support Range, start from beginning
        if (startByte > 0 && !isPartialContent) {
          downloadedBytes = 0;
          // Truncate file
          fs.truncateSync(partialPath, 0);
        }

        // Get total size
        let totalBytes: number;
        if (isPartialContent) {
          // Parse Content-Range: bytes 0-999/1234
          const contentRange = response.headers['content-range'];
          if (contentRange) {
            const match = contentRange.match(/\/(\d+)$/);
            totalBytes = match ? parseInt(match[1], 10) : modelInfo.size;
          } else {
            totalBytes = modelInfo.size;
          }
        } else {
          totalBytes = parseInt(response.headers['content-length'] || '0', 10) || modelInfo.size;
        }

        response.on('data', (chunk: Buffer) => {
          // Check cancellation
          if (options.onCancel?.()) {
            request.destroy();
            file.close();
            resolve({ success: false, error: 'Download cancelled' });
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

          if (options.onProgress) {
            options.onProgress(downloadedBytes, totalBytes, speed);
          }
        });

        response.on('end', () => {
          file.end(() => {
            // Verify download
            if (fs.existsSync(partialPath)) {
              const stats = fs.statSync(partialPath);
              const minExpected = modelInfo.size * 0.9;

              if (stats.size >= minExpected) {
                // Rename partial to final
                if (fs.existsSync(modelPath)) {
                  fs.unlinkSync(modelPath);
                }
                fs.renameSync(partialPath, modelPath);
                resolve({ success: true });
              } else {
                console.error(`[ModelManager] Downloaded file too small: ${stats.size} bytes, expected ~${modelInfo.size}`);
                // Keep partial file for resume
                resolve({
                  success: false,
                  error: `Download incomplete: got ${Math.round(stats.size / 1024 / 1024)}MB, expected ${modelInfo.sizeDisplay}. Click Download to resume.`
                });
              }
            } else {
              resolve({ success: false, error: 'Download failed - file not created' });
            }
          });
        });

        response.on('error', (error) => {
          file.close();
          console.error('[ModelManager] Response error:', error);
          resolve({ success: false, error: `Network error: ${error.message}. Partial download saved, click Download to resume.` });
        });
      });

      request.on('error', (error) => {
        file.close();
        console.error('[ModelManager] Request error:', error);
        resolve({ success: false, error: `Connection error: ${error.message}` });
      });

      request.setTimeout(DOWNLOAD_TIMEOUT, () => {
        request.destroy();
        file.close();
        resolve({ success: false, error: 'Download timeout. Partial download saved, click Download to resume.' });
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to start download: ${message}` };
  }
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
  modelName: string = DEFAULT_MODEL
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

import * as vscode from 'vscode';
import type { FileAttachment } from '../agent';

const GET_ACTIVE_CONTEXT_COMMAND = 'workbench.action.browser.getActiveContext';
const GET_ACTIVE_SUMMARY_COMMAND = 'workbench.action.browser.getActiveSummary';
const CAPTURE_ACTIVE_VIEWPORT_COMMAND = 'workbench.action.browser.captureActiveViewport';
const ENSURE_ACTIVE_BROWSER_SHARED_COMMAND = 'workbench.action.browser.ensureActiveBrowserShared';

const NORMAL_SUMMARY_CHAR_LIMIT = 12_000;
const ANNOTATION_SUMMARY_CHAR_LIMIT = 24_000;

export interface BrowserContextSnapshot {
  pageId?: string;
  url?: string;
  title?: string;
  focused?: boolean;
  visible?: boolean;
  loading?: boolean;
  sharedWithAgent?: boolean;
  annotationMode?: boolean;
  summary?: string;
  summaryTruncated?: boolean;
  screenshot?: { mimeType: 'image/jpeg'; base64: string };
  error?: string;
}

export interface BrowserTurnContext {
  snapshot: BrowserContextSnapshot;
  promptBlock: string;
  claudeAttachments: FileAttachment[];
  codexImageDataUrls: string[];
}

function isUsableSnapshot(value: unknown): value is BrowserContextSnapshot {
  return Boolean(value && typeof value === 'object');
}

function compactText(input: string, limit: number): { text: string; truncated: boolean } {
  const normalized = input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  if (normalized.length <= limit) {
    return { text: normalized, truncated: false };
  }

  return {
    text: normalized.slice(0, limit) + `\n\n[Browser context truncated at ${limit} characters.]`,
    truncated: true,
  };
}

function buildPromptBlock(snapshot: BrowserContextSnapshot): string {
  const lines: string[] = [
    '[Active browser context — user-visible in-app Ritemark Browser]',
    snapshot.title ? `Title: ${snapshot.title}` : undefined,
    snapshot.url ? `URL: ${snapshot.url}` : undefined,
    `Mode: ${snapshot.annotationMode ? 'annotation/high-context' : 'normal'}`,
    snapshot.summaryTruncated ? 'Note: page summary was truncated.' : undefined,
    snapshot.summary ? `Page summary:\n${snapshot.summary}` : undefined,
    snapshot.screenshot ? 'Viewport screenshot is attached for this turn.' : undefined,
    snapshot.error && !snapshot.summary ? `Browser context note: ${snapshot.error}` : undefined,
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

export class BrowserContextStore {
  public static readonly instance = new BrowserContextStore();

  private lastSnapshot: BrowserContextSnapshot | null = null;
  private autoSharedPageIds = new Set<string>();

  public getLastSnapshot(): BrowserContextSnapshot | null {
    return this.lastSnapshot;
  }

  public async refreshMetadata(): Promise<BrowserContextSnapshot | null> {
    try {
      const result = await vscode.commands.executeCommand<unknown>(GET_ACTIVE_CONTEXT_COMMAND);
      if (!isUsableSnapshot(result) || result.error || !result.url) {
        this.lastSnapshot = result && isUsableSnapshot(result) ? result : null;
        return this.lastSnapshot;
      }
      this.lastSnapshot = result;
      return result;
    } catch {
      this.lastSnapshot = null;
      return null;
    }
  }

  /**
   * Trigger the workbench "Share with Agent?" consent for the active browser tab
   * the first time it becomes the active context in this session. Subsequent
   * activations for the same pageId are ignored. The workbench-level
   * `setSharedWithAgent` honors the "Don't ask again" preference, so once the
   * user consents once, future tabs auto-share silently.
   */
  public async ensureSharedForActiveTab(): Promise<void> {
    const snapshot = this.lastSnapshot;
    if (!snapshot?.pageId || !snapshot.url || snapshot.sharedWithAgent) return;
    if (this.autoSharedPageIds.has(snapshot.pageId)) return;

    this.autoSharedPageIds.add(snapshot.pageId);
    try {
      const result = await vscode.commands.executeCommand<unknown>(ENSURE_ACTIVE_BROWSER_SHARED_COMMAND);
      if (isUsableSnapshot(result)) {
        this.lastSnapshot = { ...snapshot, ...result };
      }
    } catch {
      // Workbench may have rejected (consent declined). Keep the pageId
      // marked so we don't re-prompt for this tab in this session.
    }
  }

  public async buildTurnContext(options: { includeScreenshot?: boolean } = {}): Promise<BrowserTurnContext | null> {
    const metadata = await this.refreshMetadata();
    if (!metadata?.url) return null;

    let snapshot: BrowserContextSnapshot = metadata;

    if (metadata.sharedWithAgent) {
      try {
        const summaryResult = await vscode.commands.executeCommand<unknown>(GET_ACTIVE_SUMMARY_COMMAND);
        if (isUsableSnapshot(summaryResult)) {
          snapshot = { ...snapshot, ...summaryResult };
        }
      } catch (err) {
        snapshot = { ...snapshot, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const limit = snapshot.annotationMode ? ANNOTATION_SUMMARY_CHAR_LIMIT : NORMAL_SUMMARY_CHAR_LIMIT;
    if (snapshot.summary) {
      const compacted = compactText(snapshot.summary, limit);
      snapshot = {
        ...snapshot,
        summary: compacted.text,
        summaryTruncated: snapshot.summaryTruncated || compacted.truncated,
      };
    }

    if (options.includeScreenshot && snapshot.annotationMode) {
      try {
        const screenshotResult = await vscode.commands.executeCommand<unknown>(CAPTURE_ACTIVE_VIEWPORT_COMMAND);
        if (isUsableSnapshot(screenshotResult) && screenshotResult.screenshot) {
          snapshot = { ...snapshot, screenshot: screenshotResult.screenshot };
        }
      } catch (err) {
        snapshot = { ...snapshot, error: err instanceof Error ? err.message : String(err) };
      }
    }

    this.lastSnapshot = snapshot;
    const promptBlock = buildPromptBlock(snapshot);
    const claudeAttachments: FileAttachment[] = snapshot.screenshot
      ? [{
          id: `browser-viewport-${Date.now()}`,
          kind: 'image',
          name: 'Browser viewport screenshot',
          data: snapshot.screenshot.base64,
          mediaType: snapshot.screenshot.mimeType,
        }]
      : [];
    const codexImageDataUrls = snapshot.screenshot
      ? [`data:${snapshot.screenshot.mimeType};base64,${snapshot.screenshot.base64}`]
      : [];

    return { snapshot, promptBlock, claudeAttachments, codexImageDataUrls };
  }
}

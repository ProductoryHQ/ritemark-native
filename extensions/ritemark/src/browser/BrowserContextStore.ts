import * as vscode from 'vscode';
import type { FileAttachment } from '../agent';

const GET_ACTIVE_CONTEXT_COMMAND = 'workbench.action.browser.getActiveContext';
const GET_ACTIVE_SUMMARY_COMMAND = 'workbench.action.browser.getActiveSummary';
const CAPTURE_ACTIVE_VIEWPORT_COMMAND = 'workbench.action.browser.captureActiveViewport';
const ENSURE_ACTIVE_BROWSER_SHARED_COMMAND = 'workbench.action.browser.ensureActiveBrowserShared';
const ENSURE_ACTIVE_BROWSER_CONTROL_SHARED_COMMAND = 'workbench.action.browser.ensureActiveBrowserControlShared';

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
  sharedWithAgentForControl?: boolean;
  annotationMode?: boolean;
  summary?: string;
  summaryTruncated?: boolean;
  screenshot?: { mimeType: 'image/jpeg'; base64: string };
  error?: string;
  /** Sprint 134 (R20): the page waits for the share question's answer on the AI's sheet. */
  needsAnswer?: boolean;
  /** Sprint 134 (R20): an answer about a page no longer in front; nothing was shared. */
  stale?: boolean;
}

/** Sprint 134 (R20): the share question on the AI's sheet, about the page in front. */
export interface ShareQuestion {
  pageId: string;
  /** The page's title, or its address's host when it has none. */
  title: string;
}

/** What the AI's sheet does with the share question after a poll. */
export type ShareQuestionChange =
  | { kind: 'show'; question: ShareQuestion }
  | { kind: 'clear' }
  | { kind: 'unchanged' };

export type ShareAnswer = 'share' | 'notNow';

/** How a turn's wait for the share question ended (Sprint 136): the page it waited on, when there was a question. */
export interface ShareWaitResult {
  outcome: 'answered' | 'stopped';
  pageId?: string;
}

function pageTitleOf(snapshot: BrowserContextSnapshot): string {
  if (snapshot.title?.trim()) return snapshot.title.trim();
  try {
    return new URL(snapshot.url ?? '').host || (snapshot.url ?? '');
  } catch {
    return snapshot.url ?? '';
  }
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
  /** Pages answered this session (Share, Not now, or shared without asking): never asked again. */
  private autoSharedPageIds = new Set<string>();
  /** The share question the AI's sheet shows now (Sprint 134, R20). */
  private shownQuestion: ShareQuestion | null = null;
  /**
   * A share request the workbench is still answering. An older shell (patch 009 before Sprint 134) answers it with
   * its own modal dialog, which takes as long as the person does, while the AI's sheet polls every 1.5 s: each poll
   * would queue one more dialog, so answering one brought the next (Windows round, 19 October). One request at a time.
   */
  private asking = false;
  private autoControlSharedPageIds = new Set<string>();
  /** Told, with its page, when a shown question is answered, withdrawn, replaced or dropped (Sprint 136: a turn waits for it). */
  private readonly settledListeners = new Set<(pageId: string) => void>();
  /** The workbench request `asking` waits on, so a turn can wait for the question it may bring. */
  private askInFlight: Promise<unknown> | null = null;

  public getLastSnapshot(): BrowserContextSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Whether the active browser tab has been granted AI control consent.
   * Distinct from `sharedWithAgent` (read consent) — control allows the AI
   * to click, fill, navigate, scroll, and type. Stronger consent.
   */
  public isControlConsented(): boolean {
    return Boolean(this.lastSnapshot?.sharedWithAgentForControl);
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
   * The share question for the page in front, after `refreshMetadata`
   * (Sprint 134, R20; was upstream's modal "Share with Agent?" dialog, #455).
   *
   * A page becomes the AI's context the first time it is in front in this
   * session. Once the person chose to share pages without asking, the
   * workbench shares it at once and nothing is asked. Otherwise the AI's sheet
   * asks, and only an answer marks the page as asked for the session: a page
   * left unanswered is asked about again when it comes back in front. Another
   * page in front, or none, withdraws the question.
   */
  public async ensureSharedForActiveTab(): Promise<ShareQuestionChange> {
    const snapshot = this.lastSnapshot;
    const shown = this.shownQuestion;
    const withdraw = (): ShareQuestionChange => {
      const current = this.shownQuestion;
      this.shownQuestion = null;
      if (current) this.settle(current.pageId);
      return shown ? { kind: 'clear' } : { kind: 'unchanged' };
    };
    if (!snapshot?.pageId || !snapshot.url || snapshot.sharedWithAgent || this.autoSharedPageIds.has(snapshot.pageId)) return withdraw();
    if (shown?.pageId === snapshot.pageId) return { kind: 'unchanged' };
    if (this.asking) return { kind: 'unchanged' };

    let result: unknown;
    this.asking = true;
    const request = Promise.resolve(vscode.commands.executeCommand<unknown>(ENSURE_ACTIVE_BROWSER_SHARED_COMMAND));
    this.askInFlight = request;
    try {
      result = await request;
    } catch {
      return withdraw(); // the workbench failed: nothing shared, asked again on a later poll
    } finally {
      this.asking = false;
      if (this.askInFlight === request) this.askInFlight = null;
    }
    // A reply that needs no answer from the sheet settles the page asked about, even when another page is in front by
    // now: an older shell asked the person in its own dialog, and a page is asked at most once per window.
    if (isUsableSnapshot(result) && !result.error && !result.needsAnswer) this.autoSharedPageIds.add(snapshot.pageId);
    if (!isUsableSnapshot(result) || result.error || result.pageId !== snapshot.pageId) return withdraw();
    this.lastSnapshot = { ...snapshot, ...result };
    if (!result.needsAnswer) {
      // The workbench decided without asking: shared (the person's choice), or not, with the network policy's notice.
      // Either way the page is settled for this session, so the notice shows once.
      this.autoSharedPageIds.add(snapshot.pageId);
      return withdraw();
    }
    // A question about another page is replaced: it is settled, unanswered.
    const replaced = this.shownQuestion;
    this.shownQuestion = { pageId: snapshot.pageId, title: pageTitleOf(this.lastSnapshot) };
    if (replaced && replaced.pageId !== snapshot.pageId) this.settle(replaced.pageId);
    return { kind: 'show', question: this.shownQuestion };
  }

  /** The AI's sheet loaded again: a waiting question is posted again on the next poll. */
  public sheetReloaded(): void {
    const shown = this.shownQuestion;
    this.shownQuestion = null;
    if (shown) this.settle(shown.pageId);
  }

  /** The share question the AI's sheet shows now, if any. */
  public waitingQuestion(): ShareQuestion | null {
    return this.shownQuestion;
  }

  /**
   * Called with its page once a shown question is settled: answered (after the workbench has shared the page, or
   * not), withdrawn or replaced because another page is in front, or dropped when the sheet reloads or closes.
   */
  public onQuestionSettled(listener: (pageId: string) => void): { dispose(): void } {
    this.settledListeners.add(listener);
    return { dispose: () => { this.settledListeners.delete(listener); } };
  }

  /** The number of waiters listening, for tests. */
  public settledListenerCount(): number {
    return this.settledListeners.size;
  }

  private settle(pageId: string): void {
    for (const listener of [...this.settledListeners]) listener(pageId);
  }

  /**
   * Sprint 136 (Windows round 5): a message sent while the share question waits on the AI's sheet waits for it, so
   * a Share reaches its turn. On 1.142 the question shows as soon as a page loads; a message sent then used to start
   * without the page, and Share reached only the next turn. `refresh` brings the question up to date first (a page
   * opened a moment ago may not have been asked about yet, and an ask in flight is waited for). The wait ends when
   * the question about that page settles, or on `stop`, which works from the moment this returns.
   */
  public waitForAnswer(refresh: () => Promise<void>): { stop: () => void; done: Promise<ShareWaitResult> } {
    let stopped = false;
    let endWait: ((outcome: ShareWaitResult['outcome']) => void) | null = null;
    const stop = () => {
      stopped = true;
      endWait?.('stopped');
    };
    const done = (async (): Promise<ShareWaitResult> => {
      await refresh();
      if (this.askInFlight) await this.askInFlight.catch(() => undefined);
      const question = this.shownQuestion;
      if (stopped) return { outcome: 'stopped', pageId: question?.pageId };
      if (!question) return { outcome: 'answered' };
      const outcome = await new Promise<ShareWaitResult['outcome']>((resolve) => {
        let finished = false;
        const finish = (result: ShareWaitResult['outcome']) => {
          if (finished) return;
          finished = true;
          endWait = null;
          subscription.dispose();
          resolve(result);
        };
        const subscription = this.onQuestionSettled((pageId) => {
          if (pageId === question.pageId) finish('answered');
        });
        endWait = finish;
      });
      return { outcome, pageId: question.pageId };
    })();
    return { stop, done };
  }

  /**
   * The person's answer on the AI's sheet. Share shares the page (the box:
   * later pages without asking); Not now shares nothing. Either marks the page
   * as asked for the session. An answer about a page no longer in front
   * changes nothing and returns false.
   */
  public async answerShareQuestion(pageId: string, answer: ShareAnswer, withoutAsking: boolean): Promise<boolean> {
    const answered = this.shownQuestion?.pageId === pageId;
    if (answered) this.shownQuestion = null;
    try {
      let result: unknown;
      try {
        result = await vscode.commands.executeCommand<unknown>(ENSURE_ACTIVE_BROWSER_SHARED_COMMAND, { pageId, answer, withoutAsking: answer === 'share' && withoutAsking });
      } catch {
        return false;
      }
      if (!isUsableSnapshot(result) || result.error || result.stale) return false;
      this.autoSharedPageIds.add(pageId);
      if (this.lastSnapshot?.pageId === pageId) this.lastSnapshot = { ...this.lastSnapshot, ...result };
      return true;
    } finally {
      // Only now: a waiting turn reads the page, so the workbench must have shared it first.
      if (answered) this.settle(pageId);
    }
  }

  /**
   * Trigger the workbench browser-control consent prompt for the active tab
   * the first time control is requested in this session. The prompt is
   * stronger than the read-only "Share with Agent?" prompt because the AI
   * gains write-level access (navigate, click, fill, scroll, type).
   *
   * Returns true if control consent is granted, false otherwise. Once a
   * tab has been prompted and either accepted or declined in this session,
   * the result is cached — we don't re-prompt for the same tab.
   */
  public async ensureControlConsentForActiveTab(): Promise<boolean> {
    const refreshed = await this.refreshMetadata();
    if (refreshed?.sharedWithAgentForControl) {
      return true;
    }
    if (!refreshed?.pageId || !refreshed.url) {
      return false;
    }
    if (this.autoControlSharedPageIds.has(refreshed.pageId)) {
      return Boolean(refreshed.sharedWithAgentForControl);
    }
    this.autoControlSharedPageIds.add(refreshed.pageId);
    try {
      const result = await vscode.commands.executeCommand<unknown>(ENSURE_ACTIVE_BROWSER_CONTROL_SHARED_COMMAND);
      if (isUsableSnapshot(result)) {
        this.lastSnapshot = { ...refreshed, ...result };
      }
    } catch {
      // Consent declined or workbench error — surface as false.
    }
    return this.isControlConsented();
  }

  public async buildTurnContext(options: { includeScreenshot?: boolean } = {}): Promise<BrowserTurnContext | null> {
    const metadata = await this.refreshMetadata();
    if (!metadata?.url) return null;

    // Consent boundary (Sprint 67 D5): no browser context — not even URL/title
    // — flows to the AI runtimes unless the user has accepted the workbench
    // share-with-agent prompt. Auto-share fires the prompt on first activation;
    // if the user declined, this guard keeps URL identity off the wire.
    if (!metadata.sharedWithAgent) return null;

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

import * as vscode from 'vscode';
import { HistorySink, historyKey } from './browserNavigationRecorder';

const STORAGE_KEY = 'ritemark.browser.recentUrls';
const MAX_ENTRIES = 25;

export interface BrowserHistoryEntry {
  url: string;
  visitedAt: number;
  /** Page title when the page had one (Sprint 131); absent on entries saved by earlier versions. */
  title?: string;
  /** Sprint 134 (R18): the site's icon, a small image data URL; absent until the tab reported one. */
  favicon?: string;
}

export class BrowserHistoryStore implements HistorySink {
  private readonly emitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.emitter.event;

  constructor(private readonly globalState: vscode.Memento) {}

  getAll(): BrowserHistoryEntry[] {
    const raw = this.globalState.get<BrowserHistoryEntry[]>(STORAGE_KEY, []);
    return raw.filter((e) => typeof e?.url === 'string' && e.url.length > 0);
  }

  /** Moves the page to the top. Without a title, the entry keeps the title it had. */
  async record(url: string, title?: string): Promise<void> {
    const trimmed = url.trim();
    if (!trimmed) return;
    const key = historyKey(trimmed);
    const existing = this.getAll();
    const previous = existing.find((e) => historyKey(e.url) === key);
    const keptTitle = title ?? previous?.title;
    const entry: BrowserHistoryEntry = { url: trimmed, visitedAt: Date.now() };
    if (keptTitle) entry.title = keptTitle;
    if (previous?.favicon) entry.favicon = previous.favicon;
    const next = [entry, ...existing.filter((e) => historyKey(e.url) !== key)].slice(0, MAX_ENTRIES);
    await this.globalState.update(STORAGE_KEY, next);
    this.emitter.fire();
  }

  /** Sets the page's title in place: no reorder, no write when unchanged. */
  async setTitle(url: string, title: string): Promise<void> {
    const key = historyKey(url);
    const existing = this.getAll();
    const index = existing.findIndex((e) => historyKey(e.url) === key);
    if (index === -1 || existing[index].title === title) return;
    const next = [...existing];
    next[index] = { ...existing[index], title };
    await this.globalState.update(STORAGE_KEY, next);
    this.emitter.fire();
  }

  /** Sprint 134 (R18): sets the page's icon in place: no reorder, no write when unchanged. */
  async setFavicon(url: string, favicon: string): Promise<void> {
    const key = historyKey(url);
    const existing = this.getAll();
    const index = existing.findIndex((e) => historyKey(e.url) === key);
    if (index === -1 || existing[index].favicon === favicon) return;
    const next = [...existing];
    next[index] = { ...existing[index], favicon };
    await this.globalState.update(STORAGE_KEY, next);
    this.emitter.fire();
  }

  /** Removes `file:` entries that `isMissing` reports as gone (R6). One write at most. */
  async pruneMissingFiles(isMissing: (url: string) => Promise<boolean>): Promise<void> {
    const fileUrls = this.getAll().filter((e) => e.url.startsWith('file:')).map((e) => e.url);
    if (fileUrls.length === 0) return;
    const missing = new Set<string>();
    await Promise.all(
      fileUrls.map(async (url) => {
        if (await isMissing(url).catch(() => false)) missing.add(url);
      })
    );
    if (missing.size === 0) return;
    // Re-read: a visit may have been recorded while the files were checked.
    await this.globalState.update(STORAGE_KEY, this.getAll().filter((e) => !missing.has(e.url)));
    this.emitter.fire();
  }

  async remove(url: string): Promise<void> {
    const next = this.getAll().filter((e) => e.url !== url);
    await this.globalState.update(STORAGE_KEY, next);
    this.emitter.fire();
  }

  async clear(): Promise<void> {
    await this.globalState.update(STORAGE_KEY, []);
    this.emitter.fire();
  }

  dispose(): void {
    this.emitter.dispose();
  }
}

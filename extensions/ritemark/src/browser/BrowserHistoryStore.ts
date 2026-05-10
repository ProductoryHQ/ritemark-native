import * as vscode from 'vscode';

const STORAGE_KEY = 'ritemark.browser.recentUrls';
const MAX_ENTRIES = 25;

export interface BrowserHistoryEntry {
  url: string;
  visitedAt: number;
}

export class BrowserHistoryStore {
  private readonly emitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.emitter.event;

  constructor(private readonly globalState: vscode.Memento) {}

  getAll(): BrowserHistoryEntry[] {
    const raw = this.globalState.get<BrowserHistoryEntry[]>(STORAGE_KEY, []);
    return raw.filter((e) => typeof e?.url === 'string' && e.url.length > 0);
  }

  async record(url: string): Promise<void> {
    const trimmed = url.trim();
    if (!trimmed) return;
    const now = Date.now();
    const existing = this.getAll().filter((e) => e.url !== trimmed);
    const next = [{ url: trimmed, visitedAt: now }, ...existing].slice(0, MAX_ENTRIES);
    await this.globalState.update(STORAGE_KEY, next);
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

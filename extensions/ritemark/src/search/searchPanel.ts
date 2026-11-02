/**
 * Sprint 148, PR 2 (R6–R8, E3): the results view's host side, with no `vscode`
 * import, so tests drive it with fakes.
 *
 * - `searchRowAction` decides what the head's Search row does with what the
 *   shell's box sends it (`{ text }`, `{ key }`), with a key binding's
 *   `{ via: 'key' }`, or with nothing (an older shell's row): the words layer,
 *   or VS Code's search when the kill switch is off or the shell has no box.
 * - `SearchPanelController` runs the box's words through the index and posts
 *   each answer to the view: 5 rows per kind, one kind whole after Show all or
 *   when it is the only kind with results (the Experience lead, question 5).
 *   While the index reads, or after a saved change, the shown words run again,
 *   so the results grow and stay fresh (R4, R6). An answer for older words is
 *   never posted over newer ones, and the view's ids keep increasing across
 *   worker restarts.
 * - It keeps M2's and M5's numbers: from the words' arrival to the view's
 *   paint. Counts and timings only, never words (E2).
 */
import {
  DEFAULT_SEARCH_OPTIONS,
  SEARCH_KINDS,
  type IndexStatus,
  type SearchAnswer,
  type SearchHostToViewMessage,
  type SearchKind,
  type SearchOptions,
  type SearchResult,
  type SearchViewSetup,
  type SearchViewToHostMessage,
} from './protocol';

/** Rows per kind before Show all (the Experience lead, question 5). */
export const PER_KIND = 5;
/** While the index reads (or after a change), the shown words run again at most this often. */
export const REFRESH_MS = 400;
/** The box's words are capped here; the worker reads only the first few words anyway. */
export const MAX_TEXT_CHARS = 1000;
const MAX_SAMPLES = 1000;

export type SearchRowAction =
  /** VS Code's search: the row's own (a click) or ⌘⇧F's (a key, which seeds it from the selection as before). */
  | { kind: 'vscode-search'; command: 'workbench.view.search' | 'workbench.action.findInFiles' }
  | { kind: 'query'; text: string }
  | { kind: 'focus-first' }
  | { kind: 'open-top' }
  | { kind: 'focus-box' };

/**
 * What the Search row does (technical plan, Workstream 6). With the kill switch off, VS Code's search, whatever the
 * argument (E3). `{ text }` runs the words; `{ key: 'down' }` moves into the results; `{ key: 'enter' }` opens the
 * chosen (top) row. Nothing, or ⌘⇧F's `{ via: 'key' }`: the box when the shell has one, else VS Code's search, as 2.1.
 */
export function searchRowAction(arg: unknown, state: { enabled: boolean; shellHasBox: boolean }): SearchRowAction {
  const value = arg && typeof arg === 'object' ? (arg as Record<string, unknown>) : {};
  const byKey = value.via === 'key';
  const vscodeSearch: SearchRowAction = { kind: 'vscode-search', command: byKey ? 'workbench.action.findInFiles' : 'workbench.view.search' };
  if (!state.enabled) return vscodeSearch;
  if (typeof value.text === 'string') return { kind: 'query', text: value.text.slice(0, MAX_TEXT_CHARS) };
  if (value.key === 'down') return { kind: 'focus-first' };
  if (value.key === 'enter') return { kind: 'open-top' };
  return state.shellHasBox ? { kind: 'focus-box' } : vscodeSearch;
}

export interface SearchPanelDependencies {
  query(text: string, options: SearchOptions, perKind: number, expand?: SearchKind): Promise<SearchAnswer | null>;
  post(message: SearchHostToViewMessage): void;
  /** The project's name and folders, read when the view loads. */
  setup(): Omit<SearchViewSetup, 'options'>;
  open(result: SearchResult): Promise<void>;
  /** Reveal the results view with the keyboard in it. */
  focusResults(): Promise<void>;
  /** Give the keyboard back to the shell's box (PR 3). */
  focusBox(): Promise<void>;
  now(): number;
  /** Epoch ms, for M6's measurement only. */
  clock?(): number;
  setTimer?(run: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

type ResultsMessage = Extract<SearchHostToViewMessage, { type: 'search/results' }>;

export interface PanelStats {
  /** M2: from the words' arrival at the host to the view's paint, over the keys that painted. */
  keyToPaint: { n: number; p50: number; p95: number; max: number } | null;
  /** M5: from the first words in this window to the first paint. */
  firstPaintMs: number | null;
  /** M6: when the view last drew, and how many results it showed. */
  lastPaint: { at: number; total: number } | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

const round = (value: number) => Math.round(value * 10) / 10;

/** The groups a person sees: the kinds More leaves on. */
export function visibleGroups(answer: Pick<SearchAnswer, 'groups'>, kinds: readonly SearchKind[]) {
  return answer.groups.filter((group) => kinds.includes(group.kind) && group.total > 0);
}

export class SearchPanelController {
  private text = '';
  private options: SearchOptions = { ...DEFAULT_SEARCH_OPTIONS, kinds: [...DEFAULT_SEARCH_OPTIONS.kinds] };
  private expanded: SearchKind | null = null;
  private generation = 0;
  private seq = 0;
  private shown: ResultsMessage | null = null;
  private status: IndexStatus | null = null;
  private byKey = new Map<string, SearchResult>();
  /** seq → when the words of that answer arrived (keys only, not refreshes). */
  private readonly typedAt = new Map<number, number>();
  private refreshHandle: unknown = null;
  private refreshDue = false;
  private firstKeyAt: number | null = null;
  private readonly samples: number[] = [];
  private firstPaintMs: number | null = null;
  private lastPaint: { at: number; total: number } | null = null;

  constructor(private readonly deps: SearchPanelDependencies) {}

  get words(): string {
    return this.text;
  }

  /** The box's words (R5): every key. */
  setText(text: string): Promise<void> {
    this.text = text.slice(0, MAX_TEXT_CHARS);
    this.expanded = null;
    this.generation++;
    const at = this.deps.now();
    if (this.text.trim().length > 0) this.firstKeyAt ??= at;
    return this.run(at);
  }

  private queryOptions(): SearchOptions {
    // Every kind is asked for, so More can count each kind, the ones turned off included (frame 5).
    return { matchCase: this.options.matchCase, wholeWords: this.options.wholeWords, kinds: [...SEARCH_KINDS] };
  }

  private async run(keyAt: number | null): Promise<void> {
    const generation = this.generation;
    const text = this.text;
    const options = this.queryOptions();
    const answer = await this.deps.query(text, options, PER_KIND, this.expanded ?? undefined);
    if (!answer || generation !== this.generation) return;
    if (this.expanded) {
      this.show(answer, { kind: this.expanded, auto: false }, keyAt);
      return;
    }
    // One kind only: all of it at once (the Experience lead, question 5). Its first rows are drawn at once, and the
    // rest follow from a second question, so the key's results don't wait for a long list.
    const visible = answer.tooShort ? [] : visibleGroups(answer, this.options.kinds);
    if (visible.length !== 1) {
      this.show(answer, null, keyAt);
      return;
    }
    const only = visible[0];
    this.show(answer, { kind: only.kind, auto: true }, keyAt);
    if (only.total <= only.results.length) return;
    const whole = await this.deps.query(text, options, PER_KIND, only.kind);
    if (!whole || generation !== this.generation) return;
    this.show(whole, { kind: only.kind, auto: true }, null);
  }

  private show(answer: SearchAnswer, expanded: ResultsMessage['expanded'], keyAt: number | null): void {
    const seq = ++this.seq;
    if (keyAt !== null) {
      this.typedAt.set(seq, keyAt);
      // Only the newest keys can still paint: forget the rest.
      for (const old of this.typedAt.keys()) {
        if (old > seq - 50) break;
        this.typedAt.delete(old);
      }
    }
    this.byKey = new Map(answer.groups.flatMap((group) => group.results.map((result) => [result.key, result] as const)));
    this.shown = { ...answer, type: 'search/results', queryId: seq, expanded };
    this.deps.post(this.shown);
  }

  /** The shown words again (while reading, after a change): at most every REFRESH_MS. */
  private refresh(): void {
    if (!this.shown || this.shown.tooShort) return;
    if (this.refreshHandle !== null) {
      this.refreshDue = true;
      return;
    }
    void this.run(null);
    const setTimer = this.deps.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
    this.refreshHandle = setTimer(() => {
      this.refreshHandle = null;
      if (this.refreshDue) {
        this.refreshDue = false;
        this.refresh();
      }
    }, REFRESH_MS);
  }

  onStatus(status: IndexStatus): void {
    this.status = status;
    this.deps.post({ type: 'search/status', status });
    if (status.state !== 'unavailable') this.refresh();
  }

  /** The first visible row: what Enter in the box opens (the Experience lead, question 6). */
  topResult(): SearchResult | null {
    if (!this.shown || this.shown.tooShort) return null;
    for (const group of visibleGroups(this.shown, this.options.kinds)) {
      if (group.results[0]) return group.results[0];
    }
    return null;
  }

  async key(key: 'down' | 'enter'): Promise<void> {
    if (key === 'enter') {
      const top = this.topResult();
      if (top) await this.deps.open(top);
      return;
    }
    await this.deps.focusResults();
    this.deps.post({ type: 'search/focus-first' });
  }

  async onViewMessage(message: SearchViewToHostMessage): Promise<void> {
    switch (message.type) {
      case 'search/ready':
        // The view (re)loaded: everything it shows comes again.
        this.deps.post({ type: 'search/setup', setup: { ...this.deps.setup(), options: this.options } });
        if (this.status) this.deps.post({ type: 'search/status', status: this.status });
        if (this.shown) this.deps.post(this.shown);
        return;
      case 'search/open': {
        const result = this.byKey.get(message.key);
        if (result) await this.deps.open(result);
        return;
      }
      case 'search/options': {
        const changed = message.matchCase !== this.options.matchCase || message.wholeWords !== this.options.wholeWords || message.kinds.join() !== this.options.kinds.join();
        this.options = { matchCase: message.matchCase, wholeWords: message.wholeWords, kinds: [...message.kinds] };
        if (!changed) return;
        this.expanded = this.expanded && this.options.kinds.includes(this.expanded) ? this.expanded : null;
        this.generation++;
        await this.run(null);
        return;
      }
      case 'search/more':
        this.expanded = message.kind;
        this.generation++;
        await this.run(null);
        return;
      case 'search/fewer':
        this.expanded = null;
        this.generation++;
        await this.run(null);
        return;
      case 'search/back-to-box':
        await this.deps.focusBox();
        return;
      case 'search/painted':
        this.painted(message.queryId);
        return;
    }
  }

  private painted(queryId: number): void {
    const now = this.deps.now();
    if (this.firstPaintMs === null && this.firstKeyAt !== null) this.firstPaintMs = round(now - this.firstKeyAt);
    const at = this.typedAt.get(queryId);
    if (at !== undefined) {
      this.typedAt.delete(queryId);
      this.samples.push(now - at);
      if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    }
    if (this.shown && this.shown.queryId === queryId) {
      const total = visibleGroups(this.shown, this.options.kinds).reduce((sum, group) => sum + group.total, 0);
      this.lastPaint = { at: (this.deps.clock ?? Date.now)(), total };
    }
  }

  stats(): PanelStats {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      keyToPaint: sorted.length
        ? { n: sorted.length, p50: round(percentile(sorted, 50)), p95: round(percentile(sorted, 95)), max: round(sorted[sorted.length - 1]) }
        : null,
      firstPaintMs: this.firstPaintMs,
      lastPaint: this.lastPaint,
    };
  }

  dispose(): void {
    if (this.refreshHandle !== null) (this.deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.refreshHandle);
    this.refreshHandle = null;
    this.generation++;
  }
}

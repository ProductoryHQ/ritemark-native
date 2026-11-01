/**
 * Sprint 148 (#591, the words layer): the search's typed boundaries.
 *
 * - The result model (R10): one model for both layers. Each result says which
 *   layer found it (`words` here, `meaning` in Sprint 150) and has room for a
 *   one-line why and for an answer line above the groups, both unused here.
 * - The host ↔ results view messages (PR 2 draws the view).
 * - The host ↔ worker messages: the index runs in a worker thread
 *   (`out/search/searchWorker.js`), never on the extension host's main thread.
 *
 * No imports: the webview and the worker read these types too.
 */

export type SearchKind = 'document' | 'chat' | 'task';
export type SearchLayer = 'words' | 'meaning';
export type DocumentFormat = 'markdown' | 'csv' | 'docx' | 'pdf';

export const SEARCH_KINDS: readonly SearchKind[] = ['document', 'chat', 'task'];

/** Where a passage is in its source: a block (Markdown, Word), a page (PDF), a row (CSV), a message (chat), a field (task). */
export interface PassageLocation {
  block?: number;
  page?: number;
  row?: number;
  eventId?: string;
  /** A chat's message: who said it, `you` or the AI's runtime id (`claude-code`, `codex`, `opencode`). */
  speaker?: string;
  field?: 'doneWhen' | 'description';
}

/** Why a document is searched by its name only, not inside. */
export type NameOnlyReason =
  /** Past the size limit for its kind. */
  | 'too-large'
  /** Kept only online (iCloud Drive, OneDrive): reading it would download it. */
  | 'online-only'
  /** Password-protected. */
  | 'protected'
  /** A PDF with (almost) no text: a scan. */
  | 'scanned'
  /** Damaged, in an older format, or unreadable for another reason. */
  | 'unreadable'
  /** Past the documents limit or the text budget (R1). */
  | 'limited';

export interface SearchPassage {
  /** About two lines of the passage, around its first hit. */
  text: string;
  /** The matching parts of `text`, as [start, end) offsets. */
  marks: [number, number][];
  at: PassageLocation;
}

export interface SearchResult {
  /** The kind and the source's identity: `document:<path>`, `chat:<id>`, `task:<id>`. */
  key: string;
  kind: SearchKind;
  layer: SearchLayer;
  /** A document's name without its extension; a chat's or a task's title. */
  name: string;
  /** One muted word for where it lives: the folder's name (null at the project's root), a task's state. */
  where: string | null;
  /** ISO time of the last change (a document's file, a chat's last activity, a card's update). */
  changedAt: string | null;
  /** Documents only. */
  path?: string;
  format?: DocumentFormat;
  /** Documents only: why its text isn't searched, when it isn't. */
  nameOnly?: NameOnlyReason;
  /** Documents only: its size in bytes, for "too big to read inside (82 MB)". */
  size?: number;
  /** A CSV's first row, so a matching row can show its column's name. */
  columns?: string[];
  /** The first matching passage; null for a hit in the name alone. */
  passage: SearchPassage | null;
  /**
   * For R9 (PR 4, at the passage): the first hit's word as it stands in the text,
   * and which case-insensitive occurrence of that text in the document it is (0-based).
   */
  match: { text: string; occurrence: number } | null;
  /** Sprint 150: a one-line why from the meaning layer. */
  why?: string;
}

export interface SearchGroup {
  kind: SearchKind;
  /** Every result of this kind for the query, not only those sent. */
  total: number;
  results: SearchResult[];
}

export interface SearchOptions {
  matchCase: boolean;
  wholeWords: boolean;
  kinds: SearchKind[];
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = { matchCase: false, wholeWords: false, kinds: [...SEARCH_KINDS] };

/** Where the index stands. */
export interface IndexStatus {
  state: 'starting' | 'reading' | 'ready' | 'unavailable';
  /** Documents whose text has been read (or settled as name only), of all found. */
  documents: { done: number; total: number };
  /** Past the documents limit or the text budget: some are searched by name only. */
  limited: boolean;
  /** Documents searched by name only because they are too big to read inside. */
  tooLarge: number;
  /** Documents that failed to read (counted, never listed: R2). */
  failed: number;
  chats: number;
  tasks: number;
}

/** The words layer's answer to one query. */
export interface SearchAnswer {
  queryId: number;
  layer: SearchLayer;
  /** Fewer than two characters typed: nothing shows yet, and nothing says nothing was found (R5). */
  tooShort: boolean;
  groups: SearchGroup[];
  /** While the index is still reading: how far it is. */
  reading: { done: number; total: number } | null;
  limited: boolean;
  /** Name-only documents whose name matched because they were too big to read inside. */
  tooLarge: number;
  unavailable?: true;
  /** Sprint 150: the answer line above the groups. */
  answer?: unknown;
  /** The worker's own time for this query, in ms (E1's 15 ms target). */
  tookMs: number;
}

/** Sprint 150's first question: the best passages for a list of words. */
export interface PassageAnswer {
  key: string;
  kind: SearchKind;
  name: string;
  path?: string;
  text: string;
  at: PassageLocation;
  score: number;
}

/** Sprint 150's second question: the project's map. */
export interface MapEntry {
  key: string;
  path: string;
  /** Relative to its project folder, with `/`. */
  relativePath: string;
  name: string;
  format: DocumentFormat;
  /** The first line of its text; empty when it has none or is searched by name only. */
  firstLine: string;
}

// ── Host ↔ results view (PR 2 draws the view) ───────────────────────────────

export type SearchHostToViewMessage =
  | ({ type: 'search/results' } & SearchAnswer)
  | { type: 'search/status'; status: IndexStatus }
  | { type: 'search/focus-first' };

export type SearchViewToHostMessage =
  | { type: 'search/open'; key: string }
  | { type: 'search/options'; matchCase: boolean; wholeWords: boolean; kinds: SearchKind[] }
  | { type: 'search/more'; kind: SearchKind }
  | { type: 'search/back-to-box' };

// ── Host ↔ worker ───────────────────────────────────────────────────────────

/** One source the index holds: a document, a chat or a task, with its passages. */
export interface IndexSource {
  key: string;
  kind: SearchKind;
  name: string;
  where: string | null;
  /** Epoch ms. */
  changedAt: number;
  passages: { text: string; at: PassageLocation }[];
  path?: string;
  relativePath?: string;
  format?: DocumentFormat;
  nameOnly?: NameOnlyReason;
  size?: number;
  columns?: string[];
}

export interface SearchLimits {
  /** Documents read inside, the most recently changed first; the rest by name. */
  maxDocuments: number;
  /** Names kept at all; a walk stops past this (a home folder opened as a project). */
  maxNames: number;
  markdownBytes: number;
  csvBytes: number;
  docxBytes: number;
  pdfBytes: number;
  /** Text kept per document, in characters. */
  textPerDocument: number;
  /** Text kept in all, in characters. */
  textBudget: number;
  /** Message text kept per chat, in characters. */
  textPerChat: number;
}

/**
 * spec.md R1 and R3. M1 changed one: the text kept in all is 80 MB, not 200 MB, because the worker's heap
 * grows about 3.2 MB for each MB of text above ~175 MB, and its cap is 512 MB (research/measurements.md).
 */
export const DEFAULT_SEARCH_LIMITS: SearchLimits = {
  maxDocuments: 20_000,
  maxNames: 100_000,
  markdownBytes: 10 * 1024 * 1024,
  csvBytes: 10 * 1024 * 1024,
  docxBytes: 50 * 1024 * 1024,
  pdfBytes: 50 * 1024 * 1024,
  textPerDocument: 2 * 1024 * 1024,
  textBudget: 80 * 1024 * 1024,
  textPerChat: 1024 * 1024,
};

export interface WorkerConfig {
  roots: { path: string; name: string }[];
  /** The person's `files.exclude` patterns that are on, per root path. */
  filesExclude: Record<string, string[]>;
  /** `process.platform` of the host. */
  platform: string;
  /** Windows: the OneDrive folders (from `OneDrive*` environment variables). Nothing under them is read (R1, A4). */
  oneDriveRoots: string[];
  /** Decision 3's copies of Word and PDF text; null without a project storage folder. */
  cacheDir: string | null;
  cacheBytes: number;
  /** The conversation store's folder and this project's scope; null without chats. */
  chats: { dir: string; scopeId: string } | null;
  limits: SearchLimits;
}

export type HostToWorkerMessage =
  | { type: 'init'; config: WorkerConfig }
  | { type: 'fs-events'; events: { kind: 'created' | 'changed' | 'deleted'; path: string }[] }
  | { type: 'rules'; filesExclude: Record<string, string[]> }
  | { type: 'chats-changed' }
  | { type: 'tasks'; sources: IndexSource[] }
  | { type: 'query'; requestId: number; queryId: number; text: string; options: SearchOptions; perKind: number; expand?: SearchKind }
  | { type: 'passages'; requestId: number; words: string[]; limit: number }
  | { type: 'map'; requestId: number }
  | { type: 'stats'; requestId: number };

export interface WorkerStats {
  documents: number;
  withText: number;
  terms: number;
  textChars: number;
  heapUsedBytes: number;
  /** Cold index timings by phase, ms from `init`. */
  timings: Record<string, number>;
  cache: { entries: number; bytes: number; hits: number; misses: number };
}

export type WorkerToHostMessage =
  | { type: 'status'; status: IndexStatus }
  | { type: 'answer'; requestId: number; answer: SearchAnswer }
  | { type: 'passages'; requestId: number; passages: PassageAnswer[] }
  | { type: 'map'; requestId: number; entries: MapEntry[] }
  | { type: 'stats'; requestId: number; stats: WorkerStats }
  /** Counts and timings only: no words, names or paths (E2). */
  | { type: 'log'; event: string; counts: Record<string, number> };

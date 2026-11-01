export type ThreeWaySyncState = 'synced' | 'local-only' | 'external-only' | 'converged' | 'conflict';

export interface ThreeWaySnapshot {
  baseDiskHash: string;
  baseModelHash: string;
  diskHash: string;
  modelHash: string;
}

export interface InitialThreeWayState {
  baseDiskLogicalHash: string;
  baseModelHash: string;
  state: 'synced' | 'local-only';
}

export interface ViewResolutionReceipt {
  visible: boolean;
  disposed: boolean;
  acknowledgedRevision: number;
}

export type StaleViewEditDisposition = 'already-current' | 'materialize-conflict' | 'reject';

export interface LocalSaveReceipt {
  sequence: number;
  hash: string;
}

export interface LocalSaveReceiptObservation {
  remainingReceipts: LocalSaveReceipt[];
  state?: 'synced' | 'local-only';
}

/**
 * Match a disk snapshot to a confirmed successful local save. The model may
 * already have advanced again by the time those bytes are reconciled; that is
 * save lag, not a two-writer conflict.
 *
 * Use the newest matching occurrence so a collapsed sequence of saves retires
 * every older pending snapshot while preserving any later save still in flight.
 */
export function observeLocalSaveReceipts(
  pendingReceipts: readonly LocalSaveReceipt[],
  diskHash: string,
  modelHash: string,
  observedThroughSequence: number,
): LocalSaveReceiptObservation {
  let matchIndex = -1;
  for (let index = pendingReceipts.length - 1; index >= 0; index -= 1) {
    if (pendingReceipts[index].hash === diskHash) {
      matchIndex = index;
      break;
    }
  }
  const hasLaterObservedReceipt = matchIndex >= 0
    && pendingReceipts.slice(matchIndex + 1).some(receipt => receipt.sequence <= observedThroughSequence);
  if (matchIndex < 0 || hasLaterObservedReceipt) {
    return {
      // A confirmed receipt becomes stale once a later disk observation does
      // not match it, or once the match predates another save already complete
      // when this read began. Preserve only receipts created while this read
      // was in flight; that disk snapshot cannot speak about those newer saves.
      remainingReceipts: pendingReceipts.filter(receipt => receipt.sequence > observedThroughSequence),
    };
  }
  return {
    remainingReceipts: pendingReceipts.slice(matchIndex + 1),
    state: diskHash === modelHash ? 'synced' : 'local-only',
  };
}

/**
 * Decide whether a full-document edit from an older visible revision can be
 * preserved safely. If the current model still equals disk, the stale view and
 * disk are the two independent descendants and can be materialized as a normal
 * conflict. A dirty/current model means a third version exists, so replacing it
 * would lose peer or local work and must be rejected.
 */
export function classifyStaleViewEdit(
  currentModelHash: string,
  currentDiskHash: string | undefined,
  staleViewHash: string,
): StaleViewEditDisposition {
  if (staleViewHash === currentModelHash) return 'already-current';
  if (currentDiskHash !== undefined && currentModelHash === currentDiskHash) return 'materialize-conflict';
  return 'reject';
}

export function normalizeLogicalText(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/**
 * The text a document is written to disk as: its logical text with the
 * document's own line endings, and its UTF-8 byte order mark when it had one
 * (the coordinator's `encodeDocumentBytes`; Sprint 137 R9 drives it from the
 * corpus test).
 */
export function encodeDocumentText(content: string, lineEnding: '\n' | '\r\n', hasUtf8Bom: boolean): string {
  const normalized = normalizeLogicalText(content).replace(/\n/g, lineEnding);
  return `${hasUtf8Bom ? '\uFEFF' : ''}${normalized}`;
}

/**
 * A saved Markdown body always ends in exactly one trailing newline, matching
 * POSIX/Git conventions. `gray-matter`'s `stringify` already guarantees this
 * when front matter is present; documents without front matter bypass it and
 * are written as the editor's Markdown projection verbatim, which never ends
 * in a newline (Turndown trims all trailing whitespace from its output).
 */
export function ensureTrailingNewline(content: string): string {
  return content.length === 0 || content.endsWith('\n') ? content : `${content}\n`;
}

/**
 * The form in which the webview and the host compare Markdown *content*: the
 * editor's own projection. Turndown never emits a leading or trailing newline
 * and always uses LF, while the persisted body carries a trailing newline
 * (`ensureTrailingNewline`, `gray-matter`) and, behind front matter, may start
 * with one. Line endings follow the document's EOL. None of that is content.
 *
 * Every payload the host sends to a view and every equality check a view makes
 * against a host payload must go through this function, otherwise the host's
 * echo of an accepted edit looks like an external change and the view re-parses
 * a document it already owns (v1.10.1 typing regression). The webview keeps a
 * byte-identical twin in `webview/src/editorValueReconciliation.ts`; both test
 * files share the same vector table.
 */
export function canonicalMarkdownProjection(content: string): string {
  return normalizeLogicalText(content).replace(/^\n+/, '').replace(/\n+$/, '');
}

export type RefusedSaveDecision = 'converged' | 'disk-unchanged' | 'conflict';

export interface RefusedSaveSnapshot {
  /** The logical text hash of the disk version the person started from. */
  baseDiskLogicalHash: string;
  /** The logical text hash on disk now. */
  diskLogicalHash: string;
  /** The logical text hash of the person's document. */
  modelLogicalHash: string;
}

/**
 * VS Code refused to save a document Ritemark's editor holds, because the file
 * changed on disk since it was read (Sprint 137, #454: R10, R11). What changed?
 *
 * - `converged`: the disk already holds the person's text. Nothing to ask.
 * - `disk-unchanged`: the disk's text is still the text the person started
 *   from; only its date, size or bytes moved (a sync client, a line-ending
 *   rewrite). Nobody else changed the words, so the person's save may proceed.
 * - `conflict`: someone else changed the text too. Ritemark's Review changes
 *   is the one question.
 *
 * Logical text: the byte order mark and line endings are not content.
 */
export function classifyRefusedSave(snapshot: RefusedSaveSnapshot): RefusedSaveDecision {
  if (snapshot.diskLogicalHash === snapshot.modelLogicalHash) return 'converged';
  if (snapshot.diskLogicalHash === snapshot.baseDiskLogicalHash) return 'disk-unchanged';
  return 'conflict';
}

/**
 * Sprint 145 R1 (#588): one of Ritemark's own saves of a document, as the
 * guard remembers it. `previousText` is the text on disk before this save as
 * far as Ritemark knows (the save before it, or the text it last read or
 * imported), so the words this save added can be told apart from words that
 * were already there.
 */
export interface RecentSave {
  text: string;
  previousText: string;
  savedAt: number;
}

/**
 * How long after one of Ritemark's own saves a disk change that leaves out the
 * words that save added is held as a conflict instead of imported (#588,
 * `research/stale-write-repro.md`). A writer that writes later than this still
 * wins (S8).
 */
export const STALE_WRITE_WINDOW_MS = 30_000;

/**
 * Words, for the guard: runs of characters between white space and the
 * separators of a table or CSV row, so a rewrap, a changed line ending or a
 * cell edit next to the person's words doesn't count as a loss. Markup at a
 * word's edges (emphasis, code, quotes) is dropped, and so are list markers
 * and headings' hashes on their own, so a writer that only reformatted the
 * person's words hasn't lost them.
 */
function guardWords(text: string): string[] {
  const words: string[] = [];
  for (const raw of normalizeLogicalText(text).match(/[^\s,;|]+/g) ?? []) {
    const word = raw.replace(/^[*_~`"'>#]+/, '').replace(/[*_~`"']+$/, '');
    if (word && !/^(?:[-+]|\d+[.)])$/.test(word)) words.push(word);
  }
  return words;
}

/** Words joined for a contiguous search; built once per text. */
function searchable(words: readonly string[]): string {
  return ` ${words.join(' ')} `;
}

function containsRun(haystack: string, run: readonly string[]): boolean {
  return haystack.includes(` ${run.join(' ')} `);
}

/** How many times the run appears in the text; occurrences may share their separating space. */
function countRun(haystack: string, run: readonly string[]): number {
  const needle = ` ${run.join(' ')} `;
  let count = 0;
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length - 1)) count += 1;
  return count;
}

/** Above this many cells the word alignment isn't computed and the changed span counts as one run. */
const MAX_ALIGNMENT_CELLS = 4_000_000;

interface AddedRun {
  words: string[];
  /** The run with the word on each side of it in the save, where there is one. */
  withNeighbours: string[];
}

/**
 * The runs of words `next` added to `previous`: a word alignment (longest
 * common subsequence) of the part between their common start and end, so a
 * save that changed two places gives two runs, not the span between them.
 */
function addedRuns(previous: readonly string[], next: readonly string[]): AddedRun[] {
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start += 1;
  let end = 0;
  while (
    end < previous.length - start
    && end < next.length - start
    && previous[previous.length - 1 - end] === next[next.length - 1 - end]
  ) end += 1;
  const a = previous.slice(start, previous.length - end);
  const b = next.slice(start, next.length - end);
  const run = (from: number, to: number): AddedRun => ({
    words: next.slice(from, to),
    withNeighbours: next.slice(Math.max(0, from - 1), Math.min(next.length, to + 1)),
  });
  if (b.length === 0) return [];
  if (a.length === 0 || a.length * b.length > MAX_ALIGNMENT_CELLS) return [run(start, start + b.length)];
  const width = b.length + 1;
  const common = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      common[i * width + j] = a[i] === b[j]
        ? common[(i + 1) * width + j + 1] + 1
        : Math.max(common[(i + 1) * width + j], common[i * width + j + 1]);
    }
  }
  const runs: AddedRun[] = [];
  let runStart = -1;
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      if (runStart >= 0) runs.push(run(start + runStart, start + j));
      runStart = -1;
      i += 1;
      j += 1;
    } else if (i < a.length && common[(i + 1) * width + j] >= common[i * width + j + 1]) {
      i += 1;
    } else {
      if (runStart < 0) runStart = j;
      j += 1;
    }
  }
  if (runStart >= 0) runs.push(run(start + runStart, start + b.length));
  return runs;
}

/**
 * Sprint 145 R1 (#588): does the text now on disk leave out words that
 * Ritemark's own recent saves added? Returns how many such words are missing,
 * 0 when none are (or when nothing recent is remembered).
 *
 * The words the saves within `windowMs` of `now` added are the runs one word
 * alignment finds, from the text before the oldest of them to the newest save,
 * so every run is in the person's newest text and a later fix inside an earlier
 * run (a typo, a full stop) doesn't hide it. A run counts as lost when the disk
 * text has it fewer times than the newest save, and not
 * with the word on each side of it where the person put it; so a short insert
 * made of words found elsewhere in the file isn't missed, and a writer that
 * removed another copy of the person's word isn't a loss. Word runs, not lines
 * or bytes, so line endings, a byte order mark, a rewrap or a writer that
 * changed another line are not a loss; a writer that kept the person's words
 * wherever it put them is not either.
 */
export function droppedRecentSave(input: {
  saves: readonly RecentSave[];
  diskText: string;
  now: number;
  windowMs: number;
}): number {
  const oldest = input.saves.find(save => input.now - save.savedAt <= input.windowMs);
  const newest = input.saves[input.saves.length - 1];
  if (!newest || !oldest) return 0;
  const newestWords = guardWords(newest.text);
  const runs = addedRuns(guardWords(oldest.previousText), newestWords);
  if (runs.length === 0) return 0;
  const newestText = searchable(newestWords);
  const diskText = searchable(guardWords(input.diskText));
  let lost = 0;
  for (const run of runs) {
    // Kept when the file has the run as often as the person's newest save does, or has it where the
    // person put it (the word on each side; for a short run, where a count can be met by chance).
    if (countRun(diskText, run.words) >= countRun(newestText, run.words)) continue;
    if (containsRun(diskText, run.withNeighbours)) continue;
    lost += run.words.length;
  }
  return lost;
}

export function classifyThreeWay(snapshot: ThreeWaySnapshot): ThreeWaySyncState {
  const diskChanged = snapshot.diskHash !== snapshot.baseDiskHash;
  const modelChanged = snapshot.modelHash !== snapshot.baseModelHash;

  if (!diskChanged && !modelChanged) return 'synced';
  if (!diskChanged && modelChanged) return 'local-only';
  if (diskChanged && !modelChanged) return 'external-only';
  return snapshot.diskHash === snapshot.modelHash ? 'converged' : 'conflict';
}

/**
 * Anchor a newly attached custom editor to the confirmed disk snapshot.
 *
 * A TextDocument can already be dirty when Ritemark attaches (for example,
 * after reopening it with a different editor or adding a split view). Treating
 * that dirty model as its own base would let the next external write look like
 * a clean disk-only change and overwrite the pre-existing local work.
 */
export function initializeThreeWayState(
  diskHash: string,
  modelHash: string,
  modelIsDirty: boolean,
): InitialThreeWayState {
  if (diskHash === modelHash) {
    return { baseDiskLogicalHash: diskHash, baseModelHash: modelHash, state: 'synced' };
  }
  if (modelIsDirty) {
    return { baseDiskLogicalHash: diskHash, baseModelHash: diskHash, state: 'local-only' };
  }
  // A clean model can briefly lag a disk write while VS Code's file service is
  // catching up. Anchor both bases to that clean model so the first immediate
  // reconcile classifies the disk snapshot as external-only and imports it.
  return { baseDiskLogicalHash: modelHash, baseModelHash: modelHash, state: 'synced' };
}

export function classifyAcceptedModelEdit(
  baseModelHash: string,
  modelHash: string,
  conflictActive: boolean,
  resolutionPending: boolean,
): 'synced' | 'local-only' | 'conflict' {
  if (conflictActive && !resolutionPending) return 'conflict';
  return modelHash === baseModelHash ? 'synced' : 'local-only';
}

export function canCompleteViewResolution(
  revision: number,
  views: readonly ViewResolutionReceipt[],
): boolean {
  return views
    .filter(view => view.visible && !view.disposed)
    .every(view => view.acknowledgedRevision >= revision);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

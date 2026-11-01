/**
 * Sprint 148 (R5, R10): the word index and its query.
 *
 * Each source (a document, a chat, a task) is a name and a list of passages. Every
 * word is a term: its written form (NFC), its folded form and its base (text.ts).
 * The term table is keyed by written form; a sorted list of bases finds every
 * term that starts with a query word's base by binary search, and the marks rule
 * decides which of them match (text.ts, `matchWord`).
 *
 * Postings are per term and per source (not per passage): a query keeps the
 * sources that have every query word, in their name or their text. Each source
 * also keeps its words in order as term ids, which finds the first matching
 * passage, the words together as typed, and Sprint 150's best passages without a
 * second walk or a second index.
 *
 * A removed source is a tombstone until a compaction rebuilds the postings.
 */
import type {
  IndexSource,
  MapEntry,
  PassageAnswer,
  PassageLocation,
  SearchGroup,
  SearchKind,
  SearchOptions,
  SearchResult,
} from '../protocol';
import { SEARCH_KINDS } from '../protocol';
import { baseOf, foldCase, forEachWord, matchWord, normalizeText, queryWord, wordsOf, type QueryWord } from './text';

/** About two lines of a passage. */
export const SNIPPET_CHARS = 160;
/** How far before the first hit a passage's cut starts. */
const SNIPPET_LEAD = 40;
/** The words together as typed are looked for in at most this many candidates per kind. */
const PHRASE_CANDIDATES = 500;
/** Query words past this many are ignored (a bit per word in the masks). */
const MAX_QUERY_WORDS = 16;
/** Sprint 150: at most this many passages per answer. */
export const MAX_PASSAGES = 20;
/** A text posting packs the source id and its count: id * 1024 + min(count, 1023). */
const COUNT_BITS = 10;
const COUNT_MASK = (1 << COUNT_BITS) - 1;

interface SourceRecord {
  source: IndexSource;
  /** Term ids of every word of every passage, in order. */
  words: Int32Array;
  /** Where each passage starts in `words`; one more entry than passages. */
  passageStarts: Int32Array;
  nameTerms: Int32Array;
  /** Distinct text terms, for the tombstone count. */
  textTerms: number;
  textChars: number;
}

interface TokenMatch {
  query: QueryWord;
  /** Typed order. */
  order: number;
  terms: number[];
  exact: Set<number>;
  /** 1 at each matching term's id. */
  set: Uint8Array;
  size: number;
}

export interface QueryShape {
  options: SearchOptions;
  /** Results per kind with their passages; the total counts them all. */
  perKind: number;
  /** One kind shown whole ("Show all"): up to `expandLimit` of its results. */
  expand?: SearchKind;
  expandLimit?: number;
}

export interface QueryOutcome {
  tooShort: boolean;
  groups: SearchGroup[];
  /** Name-only results that are too big to read inside, among all matches. */
  tooLarge: number;
}

export class WordIndex {
  private records: (SourceRecord | null)[] = [];
  private readonly byKey = new Map<string, number>();

  // The term table.
  private readonly forms: string[] = [];
  private readonly folded: string[] = [];
  private readonly bases: string[] = [];
  private readonly formIds = new Map<string, number>();
  private readonly baseTerms = new Map<string, number[]>();
  private sortedBases: string[] = [];
  private pendingBases: string[] = [];

  // Postings.
  private textPostings: number[][] = [];
  private namePostings: number[][] = [];
  private livePostings = 0;
  private deadPostings = 0;

  private textCharCount = 0;
  private withTextCount = 0;

  get size(): number {
    return this.byKey.size;
  }

  get textChars(): number {
    return this.textCharCount;
  }

  get withText(): number {
    return this.withTextCount;
  }

  get terms(): number {
    return this.forms.length;
  }

  has(key: string): boolean {
    return this.byKey.has(key);
  }

  get(key: string): IndexSource | undefined {
    const id = this.byKey.get(key);
    return id === undefined ? undefined : this.records[id]?.source;
  }

  keys(kind?: SearchKind): string[] {
    const keys: string[] = [];
    for (const [key, id] of this.byKey) {
      if (!kind || this.records[id]?.source.kind === kind) keys.push(key);
    }
    return keys;
  }

  /** Adds a source, or replaces the one with its key. */
  add(input: IndexSource): void {
    this.remove(input.key);
    const source: IndexSource = {
      ...input,
      name: normalizeText(input.name),
      passages: input.passages.map((passage) => ({ text: normalizeText(passage.text), at: passage.at })),
    };
    const id = this.records.length;
    const nameIds: number[] = [];
    forEachWord(source.name, (word) => nameIds.push(this.termId(word)));
    const words: number[] = [];
    const passageStarts = new Int32Array(source.passages.length + 1);
    let chars = 0;
    source.passages.forEach((passage, index) => {
      passageStarts[index] = words.length;
      chars += passage.text.length;
      forEachWord(passage.text, (word) => words.push(this.termId(word)));
    });
    passageStarts[source.passages.length] = words.length;
    const record: SourceRecord = {
      source,
      words: Int32Array.from(words),
      passageStarts,
      nameTerms: Int32Array.from(nameIds),
      textTerms: 0,
      textChars: chars,
    };
    this.records.push(record);
    this.byKey.set(source.key, id);
    record.textTerms = this.post(id, record);
    this.livePostings += record.textTerms + nameIds.length;
    this.textCharCount += chars;
    if (chars > 0) this.withTextCount++;
  }

  remove(key: string): boolean {
    const id = this.byKey.get(key);
    if (id === undefined) return false;
    const record = this.records[id]!;
    this.byKey.delete(key);
    this.records[id] = null;
    const postings = record.textTerms + record.nameTerms.length;
    this.livePostings -= postings;
    this.deadPostings += postings;
    this.textCharCount -= record.textChars;
    if (record.textChars > 0) this.withTextCount--;
    const tombstones = this.records.length - this.byKey.size;
    if ((this.deadPostings > 100_000 && this.deadPostings > this.livePostings / 4) || tombstones > Math.max(10_000, this.byKey.size)) {
      this.compact();
    }
    return true;
  }

  /** Drops the tombstones: the live sources get new, dense ids and the postings are rebuilt. Term ids don't change. */
  compact(): void {
    const live = this.records.filter((record): record is SourceRecord => record !== null);
    this.records = live;
    this.byKey.clear();
    this.textPostings = this.forms.map(() => []);
    this.namePostings = this.forms.map(() => []);
    let postings = 0;
    live.forEach((record, id) => {
      this.byKey.set(record.source.key, id);
      postings += this.post(id, record) + record.nameTerms.length;
    });
    this.livePostings = postings;
    this.deadPostings = 0;
  }

  /** Posts a source's terms, each once with its count (counted by sorting the ids); returns its distinct text terms. */
  private post(id: number, record: SourceRecord): number {
    const sorted = record.words.slice().sort();
    let distinct = 0;
    for (let i = 0; i < sorted.length; ) {
      const term = sorted[i];
      let j = i + 1;
      while (j < sorted.length && sorted[j] === term) j++;
      this.textPostings[term].push((id << COUNT_BITS) | Math.min(j - i, COUNT_MASK));
      distinct++;
      i = j;
    }
    for (const term of new Set(record.nameTerms)) this.namePostings[term].push(id);
    return distinct;
  }

  private termId(word: string): number {
    const known = this.formIds.get(word);
    if (known !== undefined) return known;
    const id = this.forms.length;
    const folded = foldCase(word);
    const base = baseOf(folded);
    this.forms.push(word);
    this.folded.push(folded);
    this.bases.push(base);
    this.formIds.set(word, id);
    this.textPostings.push([]);
    this.namePostings.push([]);
    const sameBase = this.baseTerms.get(base);
    if (sameBase) sameBase.push(id);
    else {
      this.baseTerms.set(base, [id]);
      this.pendingBases.push(base);
    }
    return id;
  }

  /** Merges the bases added since the last query into the sorted list. */
  private sortBases(): void {
    if (this.pendingBases.length === 0) return;
    const pending = this.pendingBases.sort();
    this.pendingBases = [];
    const merged: string[] = new Array(this.sortedBases.length + pending.length);
    let i = 0;
    let j = 0;
    let k = 0;
    while (i < this.sortedBases.length && j < pending.length) {
      merged[k++] = this.sortedBases[i] < pending[j] ? this.sortedBases[i++] : pending[j++];
    }
    while (i < this.sortedBases.length) merged[k++] = this.sortedBases[i++];
    while (j < pending.length) merged[k++] = pending[j++];
    this.sortedBases = merged;
  }

  /** The terms a query word finds, and which of them have its exact letters. */
  private matchTerms(query: QueryWord, options: SearchOptions): { terms: number[]; exact: Set<number> } {
    this.sortBases();
    const terms: number[] = [];
    const exact = new Set<number>();
    const consider = (term: number) => {
      if (!query.marked && !options.matchCase) {
        // The base decides; letters are exact when the folded form starts the same way.
        if (options.wholeWords && this.bases[term] !== query.base) return;
        terms.push(term);
        if (options.wholeWords ? this.folded[term] === query.folded : this.folded[term].startsWith(query.folded)) exact.add(term);
        return;
      }
      const match = matchWord(query, this.forms[term], options.matchCase, options.wholeWords);
      if (!match) return;
      terms.push(term);
      if (match.exact) exact.add(term);
    };
    if (options.wholeWords) {
      for (const term of this.baseTerms.get(query.base) ?? []) consider(term);
      return { terms, exact };
    }
    const bases = this.sortedBases;
    let lo = 0;
    let hi = bases.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bases[mid] < query.base) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < bases.length && bases[i].startsWith(query.base); i++) {
      for (const term of this.baseTerms.get(bases[i])!) consider(term);
    }
    return { terms, exact };
  }

  private tokens(text: string, options: SearchOptions): TokenMatch[] | null {
    const typed = [...new Set(wordsOf(text))].slice(0, MAX_QUERY_WORDS);
    const letters = typed.reduce((sum, word) => sum + [...word].length, 0);
    if (letters < 2) return null;
    return typed.map((word, order) => {
      const query = queryWord(word, options.matchCase);
      const { terms, exact } = this.matchTerms(query, options);
      let size = 0;
      // A byte per term: the passages' words are looked up here, far faster than in a Set.
      const set = new Uint8Array(this.forms.length);
      for (const term of terms) {
        size += this.textPostings[term].length + this.namePostings[term].length;
        set[term] = 1;
      }
      return { query, order, terms, exact, set, size };
    });
  }

  query(text: string, shape: QueryShape): QueryOutcome {
    const { options } = shape;
    const tokens = this.tokens(text, options);
    if (!tokens) return { tooShort: true, groups: [], tooLarge: 0 };
    const kinds = new Set(options.kinds);
    const count = this.records.length;
    const have = new Uint8Array(count);
    const hits = new Int32Array(count);
    const nameMask = new Uint32Array(count);
    const exactMask = new Uint32Array(count);
    const touched: number[] = [];
    // The rarest word first: only its sources can have them all.
    const byRarity = [...tokens].sort((a, b) => a.size - b.size);
    byRarity.forEach((token, step) => {
      const bit = 1 << token.order;
      const visit = (id: number, textCount: number, inName: boolean, exact: boolean) => {
        const state = have[id];
        if (state < step) return;
        if (state === step) {
          const record = this.records[id];
          if (!record || !kinds.has(record.source.kind)) return;
          have[id] = step + 1;
          if (step === 0) touched.push(id);
        }
        hits[id] += textCount;
        if (inName) nameMask[id] |= bit;
        if (exact) exactMask[id] |= bit;
      };
      for (const term of token.terms) {
        const exact = token.exact.has(term);
        for (const posting of this.textPostings[term]) visit(posting >> COUNT_BITS, posting & COUNT_MASK, false, exact);
        for (const id of this.namePostings[term]) visit(id, 0, true, exact);
      }
    });
    const all = tokens.length;
    const allBits = all === 32 ? 0xffffffff : (1 << all) - 1;
    const found = touched.filter((id) => have[id] === all);

    const byKind = new Map<SearchKind, number[]>();
    for (const id of found) {
      const kind = this.records[id]!.source.kind;
      const list = byKind.get(kind);
      if (list) list.push(id);
      else byKind.set(kind, [id]);
    }

    const popcount = (mask: number) => {
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      return n;
    };
    const ordered = [...tokens].sort((a, b) => a.order - b.order);
    // The order's keys, worked out once per source: the name's words, then the exact letters, then the
    // words together, then more hits, then the most recently changed.
    const tier = new Uint8Array(count);
    const changed = new Float64Array(count);
    for (const id of found) {
      tier[id] = popcount(nameMask[id]) * 2 + (exactMask[id] === allBits ? 1 : 0);
      changed[id] = this.records[id]!.source.changedAt;
    }
    const phrase = new Uint8Array(count);
    const compare = (a: number, b: number) =>
      tier[b] - tier[a] || phrase[b] - phrase[a] || hits[b] - hits[a] || changed[b] - changed[a];

    let tooLarge = 0;
    const groups: SearchGroup[] = [];
    for (const kind of SEARCH_KINDS) {
      const ids = byKind.get(kind);
      if (!ids || ids.length === 0) continue;
      ids.sort(compare);
      if (all > 1) {
        const head = ids.slice(0, PHRASE_CANDIDATES);
        for (const id of head) phrase[id] = this.hasPhrase(this.records[id]!, ordered) ? 1 : 0;
        head.sort(compare);
        ids.splice(0, head.length, ...head);
      }
      for (const id of ids) if (this.records[id]!.source.nameOnly === 'too-large') tooLarge++;
      const limit = kind === shape.expand ? Math.max(shape.perKind, shape.expandLimit ?? 500) : shape.perKind;
      groups.push({
        kind,
        total: ids.length,
        results: ids.slice(0, limit).map((id) => this.result(this.records[id]!, ordered, options, hits[id] > 0)),
      });
    }
    return { tooShort: false, groups, tooLarge };
  }

  /** The query's words together, in the order typed, inside one passage. */
  private hasPhrase(record: SourceRecord, ordered: TokenMatch[]): boolean {
    const { words, passageStarts } = record;
    const n = ordered.length;
    for (let p = 0; p + 1 < passageStarts.length; p++) {
      const end = passageStarts[p + 1];
      for (let i = passageStarts[p]; i + n <= end; i++) {
        let j = 0;
        while (j < n && ordered[j].set[words[i + j]] === 1) j++;
        if (j === n) return true;
      }
    }
    return false;
  }

  private result(record: SourceRecord, ordered: TokenMatch[], options: SearchOptions, textHit: boolean): SearchResult {
    const { source } = record;
    const result: SearchResult = {
      key: source.key,
      kind: source.kind,
      layer: 'words',
      name: source.name,
      where: source.where,
      changedAt: source.changedAt ? new Date(source.changedAt).toISOString() : null,
      passage: null,
      match: null,
    };
    if (source.path !== undefined) result.path = source.path;
    if (source.format !== undefined) result.format = source.format;
    if (source.nameOnly !== undefined) result.nameOnly = source.nameOnly;
    if (source.size !== undefined) result.size = source.size;
    if (source.columns !== undefined) result.columns = source.columns;
    if (!textHit) return result;

    // The first passage with the most of the query's words.
    const { words, passageStarts } = record;
    let best = -1;
    let bestCount = 0;
    for (let p = 0; p + 1 < passageStarts.length && bestCount < ordered.length; p++) {
      let distinct = 0;
      for (const token of ordered) {
        for (let i = passageStarts[p]; i < passageStarts[p + 1]; i++) {
          if (token.set[words[i]] === 1) {
            distinct++;
            break;
          }
        }
      }
      if (distinct > bestCount) {
        best = p;
        bestCount = distinct;
      }
    }
    if (best < 0) return result;
    const passage = source.passages[best];
    const marks: [number, number][] = [];
    let first: { word: string; start: number } | null = null;
    let index = passageStarts[best];
    forEachWord(passage.text, (word, start) => {
      const term = words[index++];
      for (const token of ordered) {
        if (token.set[term] !== 1) continue;
        const match = matchWord(token.query, word, options.matchCase, options.wholeWords);
        if (match) {
          marks.push([start, start + match.length]);
          first ??= { word, start };
          break;
        }
      }
    });
    if (!first) return result;
    const hit: { word: string; start: number } = first;
    result.passage = cutPassage(passage.text, marks, passage.at);
    result.match = { text: hit.word, occurrence: occurrenceOf(source.passages, best, hit.start, hit.word) };
    return result;
  }

  /**
   * Sprint 150's first question: the best passages for a list of words, each word
   * from its start, any of them; a passage scores the rarer words it holds.
   */
  passages(words: string[], limit = MAX_PASSAGES): PassageAnswer[] {
    const options: SearchOptions = { matchCase: false, wholeWords: false, kinds: [...SEARCH_KINDS] };
    const typed = [...new Set(words.flatMap((word) => wordsOf(word)))].filter((word) => [...word].length >= 2).slice(0, MAX_QUERY_WORDS);
    if (typed.length === 0) return [];
    const live = this.byKey.size || 1;
    const tokens = typed.map((word, order) => {
      const query = queryWord(word, false);
      const { terms } = this.matchTerms(query, options);
      const docs = new Set<number>();
      const set = new Uint8Array(this.forms.length);
      for (const term of terms) {
        set[term] = 1;
        for (const posting of this.textPostings[term]) docs.add(posting >> COUNT_BITS);
      }
      return { order, set, docs, weight: Math.log(1 + live / Math.max(1, docs.size)) };
    });
    const docScore = new Map<number, number>();
    for (const token of tokens) {
      for (const id of token.docs) {
        if (this.records[id]) docScore.set(id, (docScore.get(id) ?? 0) + token.weight);
      }
    }
    const candidates = [...docScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200);
    const scored: PassageAnswer[] = [];
    for (const [id] of candidates) {
      const record = this.records[id]!;
      const { words: ids, passageStarts } = record;
      for (let p = 0; p + 1 < passageStarts.length; p++) {
        let score = 0;
        let hitsInPassage = 0;
        for (const token of tokens) {
          let found = 0;
          for (let i = passageStarts[p]; i < passageStarts[p + 1]; i++) if (token.set[ids[i]] === 1) found++;
          if (found) score += token.weight;
          hitsInPassage += found;
        }
        if (score === 0) continue;
        const passage = record.source.passages[p];
        scored.push({
          key: record.source.key,
          kind: record.source.kind,
          name: record.source.name,
          ...(record.source.path !== undefined ? { path: record.source.path } : {}),
          text: passage.text.length > 1000 ? `${passage.text.slice(0, 1000)}…` : passage.text,
          at: passage.at,
          score: score + Math.min(hitsInPassage, 10) * 0.01,
        });
      }
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, Math.min(limit, MAX_PASSAGES));
  }

  /** Sprint 150's second question: each document's path, name and first line. */
  map(): MapEntry[] {
    const entries: MapEntry[] = [];
    for (const id of this.byKey.values()) {
      const { source } = this.records[id]!;
      if (source.kind !== 'document' || !source.path || !source.format) continue;
      const first = source.passages.find((passage) => passage.text.trim().length > 0)?.text.trim() ?? '';
      const line = first.split('\n')[0];
      entries.push({
        key: source.key,
        path: source.path,
        relativePath: source.relativePath ?? source.name,
        name: source.name,
        format: source.format,
        firstLine: line.length > SNIPPET_CHARS ? `${line.slice(0, SNIPPET_CHARS)}…` : line,
      });
    }
    return entries.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0));
  }
}

/** About two lines of a passage around its first mark, the marks moved with it. */
export function cutPassage(text: string, rawMarks: [number, number][], at: PassageLocation): { text: string; marks: [number, number][]; at: PassageLocation } {
  // One space for each run of white space, the marks moved with the text.
  const offsets = new Int32Array(text.length + 1);
  let source = '';
  let inSpace = false;
  for (let i = 0; i < text.length; i++) {
    offsets[i] = source.length;
    if (/\s/.test(text[i])) {
      if (!inSpace && source.length > 0) source += ' ';
      inSpace = true;
    } else {
      source += text[i];
      inSpace = false;
    }
  }
  offsets[text.length] = source.length;
  if (source.endsWith(' ')) source = source.slice(0, -1);
  const moved = (offset: number) => offsets[Math.max(0, Math.min(offset, text.length))];
  const marks = rawMarks.map(([s, e]) => [moved(s), Math.min(moved(e), source.length)] as [number, number]);
  if (source.length <= SNIPPET_CHARS) return { text: source, marks, at };
  const first = marks[0][0];
  let start = Math.max(0, first - SNIPPET_LEAD);
  if (start > 0) {
    const space = source.lastIndexOf(' ', start);
    start = space > first - SNIPPET_LEAD * 2 && space >= 0 ? space + 1 : start;
  }
  let end = Math.min(source.length, start + SNIPPET_CHARS);
  if (end < source.length) {
    const space = source.lastIndexOf(' ', end);
    if (space > first) end = space;
  }
  const lead = start > 0 ? '…' : '';
  const tail = end < source.length ? '…' : '';
  const shift = lead.length - start;
  const kept = marks
    .filter(([s, e]) => s >= start && e <= end)
    .map(([s, e]) => [s + shift, e + shift] as [number, number]);
  return { text: `${lead}${source.slice(start, end)}${tail}`, marks: kept, at };
}

/** Which case-insensitive occurrence of `word` the hit at `offset` of passage `index` is, as a find bar counts them. */
function occurrenceOf(passages: readonly { text: string }[], index: number, offset: number, word: string): number {
  const needle = foldCase(word);
  if (!needle) return 0;
  let count = 0;
  const countIn = (text: string, limit: number) => {
    const haystack = foldCase(text);
    for (let from = 0; ; ) {
      const at = haystack.indexOf(needle, from);
      if (at < 0 || at >= limit) break;
      count++;
      from = at + needle.length;
    }
  };
  for (let p = 0; p < index; p++) countIn(passages[p].text, Infinity);
  countIn(passages[index].text, offset);
  return count;
}

/**
 * cardFile — one task-board card as one Markdown file (Sprint 130, #119).
 *
 * A card lives in `.ritemark/tasks/<id>-<slug>.md`: YAML front matter for the
 * fields the board reads, the description as the ordinary Markdown body. The
 * folder is the user's, so the file must survive hand edits, git, sync tools
 * and other editors:
 *   - a file is a card only with `ritemark: task/1` in its front matter; other
 *     Markdown files in the folder are not ours and are never touched;
 *   - a rewrite keeps front-matter keys this version does not know, in their
 *     original order, and writes the body back byte for byte;
 *   - a file that does not parse is an error the caller shows, never a card
 *     the caller may overwrite.
 *
 * Pure: no `vscode`, no filesystem. `BoardStore` owns reading and writing.
 *
 * Contract: docs/development/releases/v1.14.0/sprint-130-task-board/
 *   research/storage-decision.md and technical-plan.md (W1)
 */

import matter from 'gray-matter';

export * from './cardTypes';
import {
  CARD_FORMAT,
  CARD_LIMITS,
  CARD_STAGES,
  REVIEW_SIZES,
  REVIEW_VERDICTS,
  type Card,
  type CardAsk,
  type CardHistoryEntry,
  type CardResult,
  type CardReview,
} from './cardTypes';

/** What a rewrite needs from the file it replaces: the raw front matter (for
 *  keys this version does not know, and their order). */
export interface CardSource {
  data: Record<string, unknown>;
}

export type ParsedCardFile =
  | { kind: 'card'; card: Card; source: CardSource }
  | { kind: 'not-a-card' }
  | { kind: 'error'; message: string };

/** The front-matter keys this version reads and writes, in the order a new
 *  file gets them. */
const KNOWN_KEYS = [
  'ritemark',
  'id',
  'title',
  'done_when',
  'stage',
  'rank',
  'files',
  'created',
  'updated',
  'result',
  'ask',
  'review',
  'dropped',
  'archived',
  'history',
] as const;

const CARD_ID = /^[a-z0-9]{6}$/;

/** js-yaml through gray-matter: `gray-matter` is the dependency, `js-yaml` only
 *  its transitive one, so the engine is reached through `matter.engines`. */
const yamlEngine = (matter as unknown as {
  engines: { yaml: { stringify(data: unknown, options: Record<string, unknown>): string } };
}).engines.yaml;

const YAML_DUMP_OPTIONS = {
  // Nested lists and maps (history entries, result files, ask options) on one
  // line each, so a card stays short and diffs stay one line per change.
  flowLevel: 2,
  lineWidth: -1,
  noRefs: true,
} as const;

class CardFormatError extends Error {}

function fail(message: string): never {
  throw new CardFormatError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** YAML reads an unquoted ISO time as a Date; the board keeps ISO strings. */
function timeOf(value: unknown, field: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) fail(`${field} is not a valid time.`);
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return fail(`${field} must be a time.`);
}

function optionalTime(value: unknown, field: string): string | undefined {
  return value === undefined || value === null ? undefined : timeOf(value, field);
}

/** Scalars a person might type unquoted (`rank: 5`, `title: 2026 plan`) read as
 *  text. */
function textOf(value: unknown, field: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fail(`${field} must be text.`);
}

function optionalText(value: unknown, field: string): string | undefined {
  return value === undefined || value === null ? undefined : textOf(value, field);
}

function textList(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${field} must be a list.`);
  return value.map((item, index) => textOf(item, `${field}[${index}]`));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const text = typeof value === 'string' ? value.trim() : value;
  if (typeof text === 'string' && (allowed as readonly string[]).includes(text)) return text as T;
  return fail(`${field} must be one of ${allowed.join(', ')}.`);
}

function readResult(value: unknown): CardResult | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) fail('result must be a map.');
  const seconds = value.seconds;
  if (seconds !== undefined && (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0)) {
    fail('result.seconds must be a number of seconds.');
  }
  return {
    by: textOf(value.by, 'result.by'),
    at: timeOf(value.at, 'result.at'),
    ...(seconds !== undefined ? { seconds: seconds as number } : {}),
    summary: textOf(value.summary ?? '', 'result.summary'),
    files: textList(value.files, 'result.files'),
    check: textList(value.check, 'result.check'),
  };
}

function readAsk(value: unknown): CardAsk | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) fail('ask must be a map.');
  return {
    by: textOf(value.by, 'ask.by'),
    at: timeOf(value.at, 'ask.at'),
    question: textOf(value.question, 'ask.question'),
    options: textList(value.options, 'ask.options'),
  };
}

function readReview(value: unknown): CardReview | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) fail('review must be a map.');
  return {
    by: textOf(value.by, 'review.by'),
    at: timeOf(value.at, 'review.at'),
    verdict: oneOf(value.verdict, REVIEW_VERDICTS, 'review.verdict'),
    why: textOf(value.why ?? '', 'review.why'),
    size: oneOf(value.size, REVIEW_SIZES, 'review.size'),
    title: textOf(value.title ?? '', 'review.title'),
    description: textOf(value.description ?? '', 'review.description'),
    ...reviewDoneWhen(optionalText(value.done_when, 'review.done_when')),
  };
}

function reviewDoneWhen(value: string | undefined): { doneWhen?: string } {
  const text = value?.trim();
  return text ? { doneWhen: text } : {};
}

function readHistory(value: unknown): CardHistoryEntry[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail('history must be a list.');
  return value.map((entry, index) => {
    if (!isRecord(entry)) fail(`history[${index}] must be a map.`);
    return {
      at: timeOf(entry.at, `history[${index}].at`),
      by: textOf(entry.by, `history[${index}].by`),
      what: textOf(entry.what, `history[${index}].what`),
    };
  });
}

/**
 * Read one file. `not-a-card` for Markdown without the marker (including files
 * with no front matter); `error` for a card whose front matter is broken, with
 * a sentence the board can show.
 */
export function parseCardFile(text: string): ParsedCardFile {
  let parsed: { data: unknown; content: string };
  try {
    // Options switch off gray-matter's parse cache, which hands out shared
    // objects keyed by file content.
    parsed = matter(text, {});
  } catch (error) {
    // Only a card's broken YAML is our business; anything else in the folder
    // without our marker is not a card.
    if (/^\s*---[\s\S]*?\britemark\s*:\s*['"]?task\//.test(text)) {
      // The parser's first line ends with a colon before its code excerpt.
      const reason = (error instanceof Error ? error.message.split('\n')[0] : String(error)).replace(/:\s*$/, '');
      return { kind: 'error', message: `The front matter is not valid YAML (${reason}).` };
    }
    return { kind: 'not-a-card' };
  }
  const data = parsed.data;
  if (!isRecord(data) || data.ritemark === undefined) return { kind: 'not-a-card' };
  if (data.ritemark !== CARD_FORMAT) {
    if (typeof data.ritemark === 'string' && data.ritemark.startsWith('task/')) {
      return { kind: 'error', message: `This card was written in a newer format (${data.ritemark}).` };
    }
    return { kind: 'not-a-card' };
  }
  try {
    const id = textOf(data.id, 'id').trim();
    if (!CARD_ID.test(id)) fail('id must be six lowercase letters or digits.');
    const title = textOf(data.title, 'title').trim();
    if (title === '') fail('title is empty.');
    const card: Card = {
      id,
      title,
      stage: oneOf(data.stage, CARD_STAGES, 'stage'),
      rank: optionalText(data.rank, 'rank')?.trim() ?? '',
      files: textList(data.files, 'files'),
      history: readHistory(data.history),
      description: parsed.content,
    };
    const doneWhen = optionalText(data.done_when, 'done_when')?.trim();
    if (doneWhen) card.doneWhen = doneWhen;
    const created = optionalTime(data.created, 'created');
    if (created) card.created = created;
    const updated = optionalTime(data.updated, 'updated');
    if (updated) card.updated = updated;
    const result = readResult(data.result);
    if (result) card.result = result;
    const ask = readAsk(data.ask);
    if (ask) card.ask = ask;
    const review = readReview(data.review);
    if (review) card.review = review;
    if (data.dropped !== undefined && data.dropped !== null) {
      if (typeof data.dropped !== 'boolean') fail('dropped must be true or false.');
      if (data.dropped) card.dropped = true;
    }
    if (data.archived !== undefined && data.archived !== null && data.archived !== false) {
      card.archived = data.archived === true ? '' : timeOf(data.archived, 'archived');
    }
    return { kind: 'card', card, source: { data } };
  } catch (error) {
    if (error instanceof CardFormatError) return { kind: 'error', message: error.message };
    throw error;
  }
}

/** An ISO time the board wrote goes out as a YAML time, so the file reads
 *  `at: 2026-10-11T10:31:00.000Z` rather than a quoted string; it reads back
 *  as the same text. Anything else (a hand-written "yesterday") stays text. */
function yamlTime(value: string): string | Date {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value ? date : value;
}

function frontMatterOf(card: Card): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ritemark: CARD_FORMAT,
    id: card.id,
    title: card.title,
  };
  if (card.doneWhen) out.done_when = card.doneWhen;
  out.stage = card.stage;
  out.rank = card.rank;
  if (card.files.length > 0) out.files = [...card.files];
  if (card.created) out.created = yamlTime(card.created);
  if (card.updated) out.updated = yamlTime(card.updated);
  if (card.result) {
    const { by, at, seconds, summary, files, check } = card.result;
    out.result = {
      by,
      at: yamlTime(at),
      ...(seconds !== undefined ? { seconds } : {}),
      summary,
      ...(files.length > 0 ? { files: [...files] } : {}),
      ...(check.length > 0 ? { check: [...check] } : {}),
    };
  }
  if (card.ask) out.ask = { ...card.ask, at: yamlTime(card.ask.at), options: [...card.ask.options] };
  if (card.review) {
    const { doneWhen, ...review } = card.review;
    // `done_when`, as the card's own key.
    out.review = { ...review, at: yamlTime(card.review.at), ...(doneWhen ? { done_when: doneWhen } : {}) };
  }
  if (card.dropped) out.dropped = true;
  if (card.archived !== undefined) out.archived = card.archived ? yamlTime(card.archived) : true;
  out.history = card.history.map((entry) => ({ at: yamlTime(entry.at), by: entry.by, what: entry.what }));
  return out;
}

/**
 * Write a card. With `source` (the file being replaced), keys this version
 * does not know stay, in their original place, and known keys keep their
 * original order; known keys that are now empty are left out.
 */
export function serializeCard(card: Card, source?: CardSource): string {
  const fresh = frontMatterOf(card);
  const data: Record<string, unknown> = {};
  if (source) {
    for (const key of Object.keys(source.data)) {
      if ((KNOWN_KEYS as readonly string[]).includes(key)) {
        if (key in fresh) data[key] = fresh[key];
      } else {
        data[key] = source.data[key];
      }
    }
  }
  for (const key of KNOWN_KEYS) {
    if (key in fresh && !(key in data)) data[key] = fresh[key];
  }
  const yaml = quoteRank(yamlEngine.stringify(data, { ...YAML_DUMP_OPTIONS }));
  return `---\n${yaml.endsWith('\n') ? yaml : `${yaml}\n`}---\n${card.description}`;
}

/**
 * The rank is text that can look like a number (`09`, `5`). js-yaml quotes
 * only what it would misread itself, so it wrote `rank: 09`, which a YAML 1.2
 * reader (another editor, a sync tool) reads as 9, reordering the stage
 * (Windows test, Sprint 130). Always single-quote it.
 */
function quoteRank(yaml: string): string {
  return yaml.replace(/^rank: (?!['"])(.*)$/m, (_line, value: string) => `rank: '${value.replace(/'/g, "''")}'`);
}

// ── Ranks ───────────────────────────────────────────────────────────────────

const RANK_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const RANK_TEXT = /^[0-9a-z]*$/;

/**
 * A rank strictly between `before` and `after` (either may be missing), so a
 * move rewrites only the moved card. Ranks compare as plain text. Generated
 * ranks never end in "0", which keeps room in front of every rank. Returns
 * null when no rank fits (only possible with hand-edited ranks, e.g. between
 * "1" and "10"); the caller then spreads the stage with `spreadRanks`.
 */
export function rankBetween(before?: string, after?: string): string | null {
  const low = before ?? '';
  let high = after;
  if (!RANK_TEXT.test(low) || (high !== undefined && !RANK_TEXT.test(high))) return null;
  if (high !== undefined && low >= high) return null;
  let out = '';
  for (let index = 0; ; index += 1) {
    if (high !== undefined && index >= high.length) return null;
    const lowDigit = index < low.length ? RANK_DIGITS.indexOf(low[index]) : 0;
    const highDigit = high !== undefined ? RANK_DIGITS.indexOf(high[index]) : RANK_DIGITS.length;
    if (lowDigit === highDigit) {
      out += RANK_DIGITS[lowDigit];
      continue;
    }
    const middle = Math.floor((lowDigit + highDigit) / 2);
    if (middle > lowDigit) return out + RANK_DIGITS[middle];
    // Adjacent digits: keep the lower one; from here on only `before` bounds us.
    out += RANK_DIGITS[lowDigit];
    high = undefined;
  }
}

/** `count` evenly spaced ranks, for a stage whose ranks no longer leave room. */
export function spreadRanks(count: number): string[] {
  if (count <= 0) return [];
  let width = 1;
  while (RANK_DIGITS.length ** width < (count + 1) * 2) width += 1;
  const space = RANK_DIGITS.length ** width;
  const step = Math.floor(space / (count + 1));
  return Array.from({ length: count }, (_, index) => {
    let value = step * (index + 1);
    if (value % RANK_DIGITS.length === 0) value += 1;
    return value.toString(36).padStart(width, '0');
  });
}

/** Stage order for display: by rank as plain text, then by id so the order is
 *  total even when a hand edit gave two cards the same rank. */
export function compareCards(a: Card, b: Card): number {
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── Ids, file names, history ────────────────────────────────────────────────

/** Six random lowercase letters and digits, not already on the board.
 *  `random` returns an integer in [0, max). */
export function mintCardId(taken: ReadonlySet<string>, random: (max: number) => number): string {
  for (;;) {
    let id = '';
    for (let index = 0; index < 6; index += 1) id += RANK_DIGITS[random(RANK_DIGITS.length)];
    if (!taken.has(id)) return id;
  }
}

/** File-name part from the title at creation: ASCII, lowercase, hyphens, at
 *  most 40 characters, cut at a word. Windows device names (`con`, `nul`,
 *  `com1`…) are reserved even with an extension, so they get `-task`. The file
 *  is never renamed afterwards; a card's identity is its `id`. */
export function cardSlug(title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  let slug = '';
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > 40) {
      if (!slug) slug = word.slice(0, 40);
      break;
    }
    slug = next;
  }
  if (!slug) return 'task';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(slug) ? `${slug}-task` : slug;
}

/** A new card's file name: the title alone, so the editor tab that shows the
 *  card page reads well (design.md §5). `copy` 2, 3… is added when the name is
 *  taken. Older `<id>-<slug>.md` files keep working: identity is the id in the
 *  front matter. */
/** A card file's title, for its tab and the AI's chip (#477), or null when the text is not a card. */
export function cardTitleOf(text: string): string | null {
  const parsed = parseCardFile(text);
  return parsed.kind === 'card' ? parsed.card.title : null;
}

/**
 * What a card page's tab is given next (#477), or null when it already has it. `shown` is the card title the tab
 * was last given: null for none, undefined before the first time (where the editor starts a file in the card
 * folder). The first time always writes (Sprint 142, #508):
 * a tab restored with a card's title (patch 019) whose file no longer reads as a card goes back to its file's own
 * name. The empty title is VS Code's own default, the file's name on the tab and its path in the tooltip.
 */
export function cardTabWrite(shown: string | null | undefined, cardTitle: string | null): { title: string; card: boolean } | null {
  if (shown !== undefined && shown === cardTitle) return null;
  return { title: cardTitle ?? '', card: cardTitle !== null };
}

export function cardFileName(title: string, copy = 1): string {
  return copy > 1 ? `${cardSlug(title)}-${copy}.md` : `${cardSlug(title)}.md`;
}

/**
 * A card file cut into its front matter (`head`, both `---` lines included) and
 * its body: the body is what gray-matter reads as the content, so
 * `head + body` is the file. Null when the text does not start with front
 * matter.
 */
export function splitCardText(text: string): { head: string; body: string } | null {
  const open = /^---[ \t]*\r?\n/.exec(text);
  if (!open) return null;
  const rest = text.slice(open[0].length);
  const close = /(?:^|\r?\n)---[ \t]*(?:\r?\n|$)/.exec(rest);
  if (!close) return null;
  const end = open[0].length + close.index + close[0].length;
  return { head: text.slice(0, end), body: text.slice(end) };
}

/**
 * The card page saves only the body (design.md §5): the front matter stays
 * byte for byte, so the editor never rewrites the board's part. The body keeps
 * a trailing newline, as every saved document does. Null when `current` has no
 * front matter to keep.
 */
export function spliceCardBody(current: string, body: string): string | null {
  const split = splitCardText(current);
  if (!split) return null;
  return split.head + (body.length === 0 || body.endsWith('\n') ? body : `${body}\n`);
}

/** Append a history line, dropping the oldest beyond the cap. */
export function withHistory(card: Card, entry: CardHistoryEntry): Card {
  const history = [...card.history, entry];
  return { ...card, history: history.slice(Math.max(0, history.length - CARD_LIMITS.history)) };
}

// ── Bounds for what the board writes ────────────────────────────────────────

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** A title from the user or an agent: one line, 1–200 characters. */
export function checkTitle(text: string): Checked<string> {
  const value = oneLine(text);
  if (!value) return { ok: false, message: 'A card needs a title.' };
  if (value.length > CARD_LIMITS.title) {
    return { ok: false, message: `A title can be at most ${CARD_LIMITS.title} characters.` };
  }
  return { ok: true, value };
}

/** Done when: one line, at most 200 characters; empty clears it. */
export function checkDoneWhen(text: string): Checked<string> {
  const value = oneLine(text);
  if (value.length > CARD_LIMITS.doneWhen) {
    return { ok: false, message: `Done when can be at most ${CARD_LIMITS.doneWhen} characters.` };
  }
  return { ok: true, value };
}

/** A card's file list: project-relative paths with forward slashes, no
 *  duplicates, at most 20. Whether a path stays inside the project is checked
 *  where the project root is known. */
export function checkFiles(paths: readonly string[]): Checked<string[]> {
  const value: string[] = [];
  for (const raw of paths) {
    const path = raw.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!path) continue;
    if (path.startsWith('/') || /^[a-zA-Z]:/.test(path) || path.split('/').includes('..')) {
      return { ok: false, message: `"${raw}" is not a path inside the project.` };
    }
    if (!value.includes(path)) value.push(path);
  }
  if (value.length > CARD_LIMITS.files) {
    return { ok: false, message: `A card can name at most ${CARD_LIMITS.files} files.` };
  }
  return { ok: true, value };
}

/** Cut text to `max` characters at a word, with an ellipsis. */
export function clip(text: string, max: number): string {
  const value = oneLine(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

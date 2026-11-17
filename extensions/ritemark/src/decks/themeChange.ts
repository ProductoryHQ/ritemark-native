/**
 * Sprint 162 PR 5 (step-3-themes.md, "Making a theme" and "The AI and themes"; frame 13): the rules behind the AI's
 * theme changes, pure, so the host and the tests read the same ones.
 *
 *   - **A deck's `theme:` line**, read and written as one line of its front matter, so a change and its Undo leave every
 *     other byte as it was (`themeLineOf`, `withThemeLine`).
 *   - **A theme file from the AI's fields**: a new file in Ritemark's format, or an existing one with only the fields that
 *     changed rewritten (`aiThemeText`, through `themeTextWith`).
 *   - **The colour check's five pairs** on Card and Borderless, against 4.5 to 1 for text and 3 to 1 for accents, as the
 *     prototype measures them (`colourPairs`), and the nearest colour that passes for one that fails (`passingColour`).
 *   - **See what changed's two slides**: the deck's first, and the first with Boxes, Steps or Columns, else the second.
 *   - **The change record** and its Undo: what each file held before and after, and what Undo may do now
 *     (`ThemeChangeLedger`, `undoPlan`).
 */
import { contrast, mix, themeVars } from '../../webview/src/components/decks/theme/themeVars';
import { frontMatterField, writeScalar } from './deckFormat';
import { BUILT_IN_THEME_TEXT, DECK_FONT_LIST, deckFont, isThemePath, pathKey, THEMES_FOLDER, type DeckTheme } from './deckTheme';
import { normalColour, themeTextWith, type ThemeChanges } from './themeFile';
import type { WallSlide } from './present/presentProtocol';

// ── A deck's theme line ─────────────────────────────────────────────────────

const FRONT = /^(﻿?)---[ \t]*(\r?\n)([\s\S]*?)(\r?\n)---[ \t]*(?:\r?\n|$)/;
const THEME_LINE = /^theme:.*$/;

/** The deck's `theme:` line as written (`theme: Slide library/Themes/Evening.theme.md`), or null when it has none. */
export function themeLineOf(text: string): string | null {
  const match = FRONT.exec(text);
  if (!match) return null;
  const lines = match[3].split(/\r?\n/);
  // The reader takes the last one, so the last one is the line.
  for (let index = lines.length - 1; index >= 0; index--) if (THEME_LINE.test(lines[index])) return lines[index];
  return null;
}

/** The line that names a theme file. */
export function themeLineFor(themePath: string): string {
  return `theme: ${writeScalar(themePath)}`;
}

/**
 * The deck's text with its `theme:` line as `line` (null: no line). Only that line changes: a deck with the line has it
 * replaced where it is; one without gets it after its `deck:` line (or first); one without front matter gets a front
 * matter holding only it. Every other byte stays, so putting the old line back gives the deck back byte for byte.
 */
export function withThemeLine(text: string, line: string | null): string {
  const match = FRONT.exec(text);
  if (!match) {
    if (line === null) return text;
    const bom = text.startsWith('﻿') ? '﻿' : '';
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    return `${bom}---${eol}${line}${eol}---${eol}${text.slice(bom.length)}`;
  }
  const [, bom, firstEol, inner] = match;
  const eol = firstEol;
  const lines = inner.split(/\r?\n/);
  let at = -1;
  for (let index = lines.length - 1; index >= 0; index--) if (THEME_LINE.test(lines[index])) { at = index; break; }
  if (at >= 0) {
    if (line === null) lines.splice(at, 1);
    else lines[at] = line;
  } else if (line !== null) {
    const deck = lines.findIndex(entry => /^deck:/.test(entry));
    lines.splice(deck >= 0 ? deck + 1 : 0, 0, line);
  } else {
    return text;
  }
  const start = bom.length + 3 + firstEol.length;
  return text.slice(0, start) + lines.join(eol) + text.slice(start + inner.length);
}

/** The theme path a `theme:` line names, as the reader takes it (null for none). */
export function themePathOfLine(line: string | null): string | null {
  if (line === null) return null;
  return frontMatterField(`---\n${line}\n---\n`, 'theme') || null;
}

// ── A theme file from the AI's fields ───────────────────────────────────────

/** What the AI may set in a theme: `ThemeChanges` with the file's own names, every value of its own kind. */
export interface AiThemeFields {
  background?: string;
  headings?: string;
  text?: string;
  accent?: string;
  soft_light?: boolean;
  heading_font?: string;
  text_font?: string;
  corners?: DeckTheme['round'];
  boxes?: DeckTheme['boxes'];
}

/** The fields as the theme's tab names them, or the first one that isn't valid. */
export function themeChangesOf(fields: AiThemeFields): { ok: true; changes: ThemeChanges } | { ok: false; problem: string } {
  const changes: ThemeChanges = {};
  const colours: Array<[keyof AiThemeFields, 'bg' | 'head' | 'text' | 'accent']> = [['background', 'bg'], ['headings', 'head'], ['text', 'text'], ['accent', 'accent']];
  for (const [key, field] of colours) {
    const value = fields[key];
    if (value === undefined) continue;
    const colour = normalColour(String(value));
    if (!colour) return { ok: false, problem: `${key} must be a colour as #RRGGBB, not "${String(value)}".` };
    changes[field] = colour;
  }
  for (const [key, field] of [['heading_font', 'fh'], ['text_font', 'fb']] as const) {
    const value = fields[key];
    if (value === undefined) continue;
    const font = deckFont(value);
    if (font.name.toLowerCase() !== String(value).trim().replace(/\s+/g, ' ').toLowerCase()) {
      return { ok: false, problem: `${key} must be one of the six fonts Ritemark ships: ${DECK_FONT_LIST.map(entry => entry.name).join(', ')}. "${String(value)}" is not; use the closest of the six and tell the user which you chose.` };
    }
    changes[field] = font.name;
  }
  if (fields.soft_light !== undefined) changes.glow = fields.soft_light;
  if (fields.corners !== undefined) changes.round = fields.corners;
  if (fields.boxes !== undefined) changes.boxes = fields.boxes;
  return { ok: true, changes };
}

/**
 * A theme file's text: an existing theme's (`existing`) with only the fields that differ rewritten, or a new theme by
 * this name, from Ritemark's format (Evening's settings for any field the AI leaves out, without Evening's hand-picked
 * shades unless its colours stay Evening's).
 */
export function aiThemeText(existing: string | null, name: string, changes: ThemeChanges): string {
  const base = existing ?? themeTextWith(BUILT_IN_THEME_TEXT, { name: name.trim() });
  return themeTextWith(base, changes);
}

// ── The colour check ────────────────────────────────────────────────────────

/** The usual rule: 4.5 to 1 for text, 3 to 1 for accents (large words and marks). */
export const TEXT_RATIO = 4.5;
export const ACCENT_RATIO = 3;
const WHITE = '#FFFFFF';

export type PairField = 'text' | 'head' | 'accent';

export interface ColourPair {
  label: string;
  look: 'card' | 'borderless';
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  ok: boolean;
  /** The theme colour a fix moves, or null for a shade worked out (or hand-picked) for Borderless. */
  field: PairField | null;
}

/**
 * The five pairs the colour check measures, as the prototype does: on the card, the text, the headings and the accent as
 * words against the background; on Borderless (Ritemark's white), the text and the accent as Ritemark draws them there.
 */
export function colourPairs(theme: DeckTheme): ColourPair[] {
  const card = themeVars(theme, false);
  const open = themeVars(theme, true);
  const pair = (label: string, look: ColourPair['look'], fg: string, bg: string, min: number, field: PairField | null): ColourPair => {
    const ratio = contrast(fg, bg);
    return { label, look, fg, bg, ratio, min, ok: ratio >= min, field };
  };
  return [
    pair('Text', 'card', theme.text, theme.bg, TEXT_RATIO, 'text'),
    pair('Headings', 'card', theme.head, theme.bg, TEXT_RATIO, 'head'),
    pair('Accent, as words', 'card', card.acct, theme.bg, ACCENT_RATIO, 'accent'),
    pair('Text, borderless', 'borderless', open.tx, WHITE, TEXT_RATIO, null),
    pair('Accent, borderless', 'borderless', open.acct, WHITE, ACCENT_RATIO, null),
  ];
}

/**
 * The nearest colour to `colour` that reads on `ground` at `min` to 1, a little past it so a rounding never takes it
 * back under: moved toward white on a dark ground and toward black on a light one, in small steps (the prototype's 3%).
 * Null when even white or black doesn't reach it.
 */
export function passingColour(colour: string, ground: string, min: number): string | null {
  if (contrast(colour, ground) >= min) return colour;
  const target = contrast(WHITE, ground) >= contrast('#000000', ground) ? WHITE : '#000000';
  let value = colour;
  for (let index = 0; index < 200 && contrast(value, ground) < min + 0.1; index++) value = mix(value, target, 0.03);
  if (contrast(value, ground) >= min) return value;
  return contrast(target, ground) >= min ? target : null;
}

/** A ratio in words: one decimal, cut (never rounded up), without a trailing ".0" (as the theme's tab writes it). */
export function ratioWords(ratio: number): string {
  return (Math.floor(ratio * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '');
}

/** For each failing pair a colour can fix: the field, its colour now and the nearest that passes. */
export function suggestedFixes(theme: DeckTheme): Array<{ field: PairField; from: string; to: string; pair: string }> {
  const fixes: Array<{ field: PairField; from: string; to: string; pair: string }> = [];
  for (const pair of colourPairs(theme)) {
    if (pair.ok || !pair.field || fixes.some(fix => fix.field === pair.field)) continue;
    const from = theme[pair.field];
    const to = passingColour(from, theme.bg, pair.min);
    if (to && to !== from) fixes.push({ field: pair.field, from, to, pair: pair.label });
  }
  return fixes;
}

/** The check as the tool answers it: a line per pair, and the fixes. */
export function pairsReport(theme: DeckTheme): string {
  return colourPairs(theme)
    .map(pair => `- ${pair.label}${pair.look === 'card' ? ' (card)' : ''}: ${pair.fg} on ${pair.bg}, ${ratioWords(pair.ratio)} to 1, needs ${pair.min} to 1: ${pair.ok ? 'passes' : 'FAILS'}`)
    .join('\n');
}

export const PAIR_FIELD_NAMES: Record<PairField, string> = { text: 'text', head: 'headings', accent: 'accent' };

// ── See what changed ─────────────────────────────────────────────────────────

/** A slide with Boxes, Steps or Columns: an older slide of those kinds, or a block slide holding such a block. */
export function hasStructure(slide: { kind: string; data: { markdown?: string } }): boolean {
  if (['boxes', 'columns', 'twocol', 'threecol', 'steps', 'exercise', 'compare'].includes(slide.kind)) return true;
  const markdown = slide.data.markdown ?? '';
  return /^:{3,}\s*(?:\{\s*\.)?(?:columns|boxes|steps)\b/m.test(markdown);
}

/** See what changed's two slides (by place): the first, and the first with Boxes, Steps or Columns, else the second. */
export function changeSlideIndexes(slides: ReadonlyArray<{ kind: string; data: { markdown?: string } }>): number[] {
  if (slides.length === 0) return [];
  const structured = slides.findIndex((slide, index) => index > 0 && hasStructure(slide));
  const second = structured > 0 ? structured : slides.length > 1 ? 1 : -1;
  return second > 0 ? [0, second] : [0];
}

// ── The change record ───────────────────────────────────────────────────────

/** One deck a change pointed at the theme: its `theme:` line before and the one written. */
export interface DeckLineChange {
  path: string;
  before: string | null;
  after: string;
  /** The theme the deck drew before (its file's text, or the built-in one's): See what changed's Before. */
  themeBefore: string;
  /** A deck only shown by See what changed (it drew the rewritten theme already): Undo never writes it. */
  shownOnly?: boolean;
}

/** See what changed's sheet, for a deck view or a theme's tab: two slides, each before and after. */
export interface ThemeChangeView {
  id: string;
  before: { name: string; text: string };
  after: { name: string; text: string };
  slides: WallSlide[];
  borderless: boolean;
  assets: Record<string, string>;
  undone: boolean;
}

/** A theme change by an AI, as Undo and See what changed need it. */
export interface ThemeChangeRecord {
  id: string;
  conversationId: string | null;
  /** `theme`: a theme file written and decks pointed at it. `draft`: colours moved in a theme's unsaved draft. */
  kind: 'theme' | 'draft';
  themePath: string;
  themeName: string;
  /** The theme file's text before (null: the change made it) and after. For a draft, the draft's. */
  themeBefore: string | null;
  themeAfter: string;
  decks: DeckLineChange[];
  /** For a draft: each colour moved, from and to. */
  moved: Array<{ field: PairField; from: string; to: string }>;
  undone: boolean;
}

/** What Undo does now, from what the files hold now. Pure: the host reads the files, this decides. */
export interface UndoPlan {
  /** Each deck whose line is still the change's: put back as it was. */
  decks: Array<{ path: string; line: string | null }>;
  /** Decks someone changed since: left as they are. */
  keptDecks: string[];
  /** The theme file: removed (made by the change, no deck uses it, unchanged since), put back, or kept. */
  theme: { action: 'remove' } | { action: 'restore'; text: string } | { action: 'keep'; reason: 'changed' | 'used' } | { action: 'none' };
}

/**
 * Undo's plan (17 November): each deck's `theme:` line goes back as it was, where it still is the change's. A theme file
 * the change made goes only when no deck uses it after that and the person hasn't changed it since; otherwise it stays.
 * A theme file the change rewrote goes back to its old text while it still holds the change's.
 */
export function undoPlan(
  record: ThemeChangeRecord,
  now: { deckLines: Record<string, string | null | undefined>; themeText: string | null; decksUsingAfter: (paths: ReadonlySet<string>) => number },
): UndoPlan {
  const decks: UndoPlan['decks'] = [];
  const keptDecks: string[] = [];
  for (const deck of record.decks) {
    const line = now.deckLines[deck.path];
    if (line === undefined) continue; // the deck is gone
    if (line === deck.after) decks.push({ path: deck.path, line: deck.before });
    else keptDecks.push(deck.path);
  }
  let theme: UndoPlan['theme'] = { action: 'none' };
  if (now.themeText !== null) {
    const unchanged = now.themeText === record.themeAfter;
    if (record.themeBefore === null) {
      const reverted = new Set(decks.map(deck => deck.path));
      if (!unchanged) theme = { action: 'keep', reason: 'changed' };
      else if (now.decksUsingAfter(reverted) > 0) theme = { action: 'keep', reason: 'used' };
      else theme = { action: 'remove' };
    } else if (record.themeBefore !== record.themeAfter) {
      theme = unchanged ? { action: 'restore', text: record.themeBefore } : { action: 'keep', reason: 'changed' };
    }
  }
  return { decks, keptDecks, theme };
}

/** Undo's answer in the chat, in plain words. */
export function undoWords(record: ThemeChangeRecord, plan: UndoPlan, deckName: (path: string) => string): string {
  const parts: string[] = [];
  if (record.kind === 'draft') {
    return plan.theme.action === 'keep'
      ? `Kept the colours in ${record.themeName}'s draft: you changed them after I moved them.`
      : `Put ${record.themeName}'s colours back as they were. The draft is as it was before the check.`;
  }
  if (plan.decks.length === 1) parts.push(`${deckName(plan.decks[0].path)} has its old theme again.`);
  else if (plan.decks.length > 1) parts.push(`${plan.decks.length} decks have their old themes again.`);
  if (plan.keptDecks.length) parts.push(`Left ${plan.keptDecks.map(deckName).join(', ')} as ${plan.keptDecks.length === 1 ? 'it is' : 'they are'}: its theme was changed after mine.`);
  if (plan.theme.action === 'remove') parts.push(`Removed ${record.themeName}.`);
  else if (plan.theme.action === 'restore') parts.push(`${record.themeName} is as it was before.`);
  else if (plan.theme.action === 'keep') {
    parts.push(plan.theme.reason === 'changed'
      ? `Kept ${record.themeName}: you changed it after I made it.`
      : `Kept ${record.themeName}: another deck uses it.`);
  }
  return parts.join(' ') || 'Nothing to undo: it was changed since.';
}

/**
 * The change records of this window, in memory: an Undo or See what changed after a window reload finds none, and says
 * so. A second write of the same theme in the same chat, while the file still holds the first, joins its record, so one
 * Undo takes the whole change back.
 */
export class ThemeChangeLedger {
  private readonly records = new Map<string, ThemeChangeRecord>();
  private next = 1;

  constructor(private readonly max = 50) {}

  get(id: string): ThemeChangeRecord | undefined {
    return this.records.get(id);
  }

  /** The record a new write joins: the newest of this chat, for this theme and kind, not undone, the file as it left it. */
  joinable(conversationId: string | null, kind: ThemeChangeRecord['kind'], themePath: string, themeNow: string | null): ThemeChangeRecord | undefined {
    const newest = [...this.records.values()].reverse().find(record => record.conversationId === conversationId && !record.undone);
    if (!newest || newest.kind !== kind || pathKey(newest.themePath) !== pathKey(themePath) || newest.themeAfter !== themeNow) return undefined;
    return newest;
  }

  add(record: Omit<ThemeChangeRecord, 'id' | 'undone'>): ThemeChangeRecord {
    const made: ThemeChangeRecord = { ...record, id: `theme-change-${this.next++}`, undone: false };
    this.records.set(made.id, made);
    while (this.records.size > this.max) this.records.delete(this.records.keys().next().value!);
    return made;
  }
}

/** Is this a theme path in the project's Themes folder (`Slide library/Themes/<Name>.theme.md`)? */
export function isLibraryThemeFile(value: string): boolean {
  return isThemePath(value) && pathKey(value).startsWith(`${pathKey(THEMES_FOLDER)}/`) && !pathKey(value).slice(pathKey(THEMES_FOLDER).length + 1).includes('/');
}

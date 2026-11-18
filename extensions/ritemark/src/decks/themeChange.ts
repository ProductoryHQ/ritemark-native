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
import type { AgendaEntry } from './blocks/agenda';

// ── A deck's theme line ─────────────────────────────────────────────────────

/** The front matter: its opener (BOM, `---`, trailing blanks), the opener's line end, and its inside (none when empty). */
const FRONT = /^(﻿?---[ \t]*)(\r?\n)(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
const THEME_LINE = /^theme:.*$/;

/** The deck's `theme:` line as written (`theme: Slide library/Themes/Evening.theme.md`), or null when it has none. */
export function themeLineOf(text: string): string | null {
  const match = FRONT.exec(text);
  if (!match || match[3] === undefined) return null;
  const lines = match[3].split(/\r?\n/);
  // The reader takes the last one, so the last one is the line.
  for (let index = lines.length - 1; index >= 0; index--) if (THEME_LINE.test(lines[index])) return lines[index];
  return null;
}

/** The line that names a theme file. */
export function themeLineFor(themePath: string): string {
  return `theme: ${writeScalar(themePath)}`;
}

/** Does the text open with a front matter (an empty one too)? */
export function hasFrontMatter(text: string): boolean {
  return FRONT.test(text);
}

/**
 * The deck's text with its `theme:` line as `line` (null: no line). Only that line changes: a deck with the line has it
 * replaced where it is; one without gets it after its `deck:` line (or first); one without front matter gets a front
 * matter holding only it. `dropEmpty` (Undo of a front matter the change made): a front matter left empty goes too.
 * Every other byte stays, so putting the old line back gives the deck back byte for byte.
 */
export function withThemeLine(text: string, line: string | null, options: { dropEmpty?: boolean } = {}): string {
  const match = FRONT.exec(text);
  if (!match) {
    if (line === null) return text;
    const bom = text.startsWith('﻿') ? '﻿' : '';
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    return `${bom}---${eol}${line}${eol}---${eol}${text.slice(bom.length)}`;
  }
  const [whole, opener, eol, inner] = match;
  const lines = inner === undefined ? [] : inner.split(/\r?\n/);
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
  const rest = text.slice(whole.length);
  if (lines.length === 0 && options.dropEmpty) return (opener.startsWith('﻿') ? '﻿' : '') + rest;
  // The closing fence as written (`---`, its trailing blanks and line end)
  const closing = whole.slice(whole.lastIndexOf('---'));
  const body = lines.length ? `${lines.join(eol)}${eol}` : '';
  return `${opener}${eol}${body}${closing}${rest}`;
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

// ── Fix the colours (the Experience lead, 17 November): Ritemark's own fix, no AI ──

type Hsl = [number, number, number];

function hexToHsl(colour: string): Hsl {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(colour.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue / 6, sat, l];
}

function hslToHex([h, sat, l]: Hsl): string {
  const channel = (t: number) => {
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    const v = x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
    return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  };
  if (sat === 0) {
    const grey = Math.round(l * 255).toString(16).padStart(2, '0');
    return `#${grey}${grey}${grey}`.toUpperCase();
  }
  return `#${channel(h + 1 / 3)}${channel(h)}${channel(h - 1 / 3)}`.toUpperCase();
}

/** A colour's hue, as `hexToHsl` reads it (0 to 1): the fix keeps it. */
export function hueOf(colour: string): number {
  return hexToHsl(colour)[0];
}

/**
 * The colour with its lightness moved by the least amount that reads on `ground` at `min` to 1, its hue and saturation
 * kept: lighter or darker, whichever needs the smaller move (a direction that can't reach the ratio doesn't count).
 * Null when neither reaches it.
 */
export function lightnessFix(colour: string, ground: string, min: number): string | null {
  if (contrast(colour, ground) >= min) return colour;
  const [h, sat, l] = hexToHsl(colour);
  const reach = (towards: 1 | 0): { colour: string; move: number } | null => {
    if (contrast(hslToHex([h, sat, towards]), ground) < min) return null;
    // The least lightness between `l` and the end that reaches the ratio
    let near = l;
    let far: number = towards;
    for (let step = 0; step < 40; step++) {
      const mid = (near + far) / 2;
      if (contrast(hslToHex([h, sat, mid]), ground) >= min) far = mid;
      else near = mid;
    }
    // The hex rounding can land a hair under: step on, one 1/255 at a time, until it reads
    let value = far;
    let hex = hslToHex([h, sat, value]);
    for (let step = 0; step < 255 && contrast(hex, ground) < min; step++) {
      value = towards === 1 ? Math.min(1, value + 1 / 255) : Math.max(0, value - 1 / 255);
      hex = hslToHex([h, sat, value]);
    }
    return contrast(hex, ground) >= min ? { colour: hex, move: Math.abs(value - l) } : null;
  };
  const options = [reach(1), reach(0)].filter((option): option is { colour: string; move: number } => option !== null);
  if (!options.length) return null;
  return options.sort((a, b) => a.move - b.move)[0].colour;
}

/** One pair Fix the colours moved: its label, the colour from and to, and the ratio before and after. */
export interface MovedPair {
  label: string;
  field: PairField;
  from: string;
  to: string;
  fromRatio: number;
  toRatio: number;
}

/**
 * Fix the colours: each failing pair's own colour (text, headings, the accent) moved by the least lightness that passes,
 * its hue kept, measured as the pairs are. A pair no lightness of its colour can fix is left as it is (`unreachable`),
 * and a Borderless pair that fails on the theme's hand-picked shades is named (`shades`): no field of the four moves it.
 * The changes are the theme's own fields, for the draft (`themeTextWith`).
 */
export function colourFixes(theme: DeckTheme): { changes: ThemeChanges; moved: MovedPair[]; unreachable: string[]; shades: string[] } {
  const changes: ThemeChanges = {};
  const moved: MovedPair[] = [];
  const unreachable: string[] = [];
  const shades: string[] = [];
  let current = theme;
  for (const pair of colourPairs(theme)) {
    if (pair.ok) continue;
    if (!pair.field) { shades.push(pair.label); continue; }
    if (moved.some(entry => entry.field === pair.field)) continue;
    // The accent as words is drawn from the accent: the accent itself moves, measured as the pair is
    const from = current[pair.field];
    const fixed = lightnessFix(from, current.bg, pair.min);
    const after = fixed ? { ...current, [pair.field]: fixed } : null;
    const reached = after ? colourPairs(after).find(entry => entry.label === pair.label) : undefined;
    if (!fixed || !after || !reached || !reached.ok) { unreachable.push(pair.label); continue; }
    changes[pair.field] = fixed;
    moved.push({ label: pair.label, field: pair.field, from, to: fixed, fromRatio: pair.ratio, toRatio: reached.ratio });
    current = after;
  }
  return { changes, moved, unreachable, shades };
}

/** The contrast line after a check or a fix, in plain words. */
export function checkWords(theme: DeckTheme, fix: ReturnType<typeof colourFixes> | null): string {
  const failing = colourPairs(theme).filter(pair => !pair.ok);
  const parts: string[] = [];
  if (fix && fix.moved.length) parts.push(`Moved ${fix.moved.map(entry => `${entry.label.toLowerCase()} ${entry.from} → ${entry.to}`).join(', ')}. Not saved yet.`);
  if (!fix && failing.length === 0) parts.push('All five pairs pass, on the card and borderless.');
  if (!fix && failing.length) parts.push(`${failing.length === 1 ? 'One pair fails' : `${failing.length} pairs fail`}: ${failing.map(pair => `${pair.label.toLowerCase()} ${ratioWords(pair.ratio)} to 1`).join(', ')}.`);
  const left = fix ? [...fix.unreachable, ...fix.shades] : [];
  if (left.length) parts.push(`Left as ${left.length === 1 ? 'it is' : 'they are'}: ${left.map(label => label.toLowerCase()).join(', ')}${fix && fix.unreachable.length ? ' (no lightness of that colour reads on this background)' : ''}${fix && fix.shades.length ? ' (the theme\'s own borderless shades; change a colour to have them worked out again)' : ''}.`);
  return parts.join(' ');
}

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
  /** The change gave the deck its front matter: Undo takes it away again when nothing else is in it. */
  madeFrontMatter?: boolean;
}

/** See what changed's sheet, for a deck view or a theme's tab: two slides, each before and after. */
export interface ThemeChangeView {
  id: string;
  before: { name: string; text: string };
  after: { name: string; text: string };
  slides: WallSlide[];
  /** Small details 14: the deck's sections, for an Agenda among the two slides; left out, the view's own deck's. */
  agenda?: AgendaEntry[];
  borderless: boolean;
  assets: Record<string, string>;
  undone: boolean;
  /** A colour fix: each pair that moved, named in the sheet's header with its swatches and ratios. */
  moved?: Array<{ label: string; from: string; to: string; fromRatio: number; toRatio: number }>;
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
  decks: Array<{ path: string; line: string | null; dropEmpty?: boolean }>;
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
    if (line === deck.after) decks.push({ path: deck.path, line: deck.before, ...(deck.madeFrontMatter ? { dropEmpty: true } : {}) });
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
  private readonly session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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
    // Unique across window reloads: a chat keeps its buttons, so an old one must never name a newer change
    const made: ThemeChangeRecord = { ...record, id: `theme-change-${this.session}-${this.next++}`, undone: false };
    this.records.set(made.id, made);
    while (this.records.size > this.max) this.records.delete(this.records.keys().next().value!);
    return made;
  }
}

/** Is this a theme path in the project's Themes folder (`Slide library/Themes/<Name>.theme.md`)? */
export function isLibraryThemeFile(value: string): boolean {
  return isThemePath(value) && pathKey(value).startsWith(`${pathKey(THEMES_FOLDER)}/`) && !pathKey(value).slice(pathKey(THEMES_FOLDER).length + 1).includes('/');
}

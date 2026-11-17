/**
 * A deck's theme (Sprint 157, README "Themes"). A theme is a `.theme.md` file whose front matter holds its name, its
 * four colours, the soft light, the fonts, the corners and the boxes. A deck names its theme in its own front matter
 * (`theme: Slide library/Themes/Evening.theme.md`); a deck whose theme file is missing draws the built-in theme.
 *
 * This cut has one theme, the prototype's Evening, not editable (the Experience lead, 15 November): its text is a
 * constant here, so it ships in the extension's JavaScript, not as a file that only a shell release would carry.
 * `card` and `borderless` keep Evening's hand-picked shades, as the prototype's `x` and `xl` do; a theme without them
 * gets shades worked out from its four colours (`themeVars`).
 *
 * Pure, with no imports beyond the deck format's scalar reader: the host and the webview read themes the same way.
 */
import { readScalar } from './deckFormat';

export interface DeckTheme {
  name: string;
  /** Background, headings, text and accent, as `#RRGGBB`. */
  bg: string;
  head: string;
  text: string;
  accent: string;
  /** The soft light in a corner. */
  glow: boolean;
  /** Heading and text fonts, by name. */
  fh: string;
  fb: string;
  /** Corners: square, soft or round. Boxes: filled or outline. */
  round: 'square' | 'soft' | 'round';
  boxes: 'filled' | 'outline';
  /** Hand-picked shades on the theme's own ground (a card). */
  card?: Record<string, string>;
  /** Hand-picked shades on Ritemark's white surface (borderless). */
  borderless?: Record<string, string>;
}

/** The fonts a slide can use in this cut: Sofia Sans ships with Ritemark. Other names draw in Sofia Sans. */
export const DECK_FONTS: Record<string, string> = {
  'Sofia Sans': "'Sofia Sans', sans-serif",
};

/** Where a project's themes live, and the built-in theme's file name there. */
export const THEMES_FOLDER = 'Slide library/Themes';
export const BUILT_IN_THEME_PATH = `${THEMES_FOLDER}/Evening.theme.md`;

/** The built-in theme, as its file is written: the prototype's Evening with its card and borderless shades. */
export const BUILT_IN_THEME_TEXT = `---
name: Evening
background: "#1C1F4A"
headings: "#FFFFFF"
text: "#E4E6F7"
accent: "#F2B544"
soft-light: true
heading-font: Sofia Sans
text-font: Sofia Sans
corners: soft
boxes: filled
card:
  g1: "#3D428F"
  g3: "#13153A"
  sub: "#C7CAEB"
  fnt: "#AEB2DD"
borderless:
  hd: "#1C1F4A"
  tx: "#33365A"
  sub: "#5B5F86"
  fnt: "#5B5F86"
  acc: "#E0A21F"
  acct: "#B07A12"
  thbg: "#FFF4D6"
  thfg: "#8A5A00"
  box: "#F6F6FB"
  box2: "#F6F6FB"
  pic: "#F6F6FB"
  boxl: "#E7E8F2"
  row: "#ECEDF5"
  odd: "#FAFAFD"
  arw: "#F1F1F8"
  emp: "#E2E3EE"
  empt: "#8A8DAE"
---
`;

const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** Evening's four colours and settings: what a theme file leaves out or writes wrongly. */
const EVENING_DEFAULTS: DeckTheme = {
  name: 'Evening', bg: '#1C1F4A', head: '#FFFFFF', text: '#E4E6F7', accent: '#F2B544', glow: true,
  fh: 'Sofia Sans', fb: 'Sofia Sans', round: 'soft', boxes: 'filled',
};

/** Read a theme file's front matter; any value missing or malformed is Evening's. */
export function parseTheme(text: string, fallback: DeckTheme = EVENING_DEFAULTS): DeckTheme {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  const top: Record<string, string> = {};
  const nested: Record<string, Record<string, string>> = {};
  let section: string | null = null;
  for (const line of match ? match[1].split(/\r?\n/) : []) {
    const inner = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (inner && section) {
      nested[section][inner[1]] = readScalar(inner[2]);
      continue;
    }
    const outer = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!outer) continue;
    if (outer[2].trim() === '') {
      section = outer[1];
      nested[section] = {};
    } else {
      section = null;
      top[outer[1]] = readScalar(outer[2]);
    }
  }
  const colour = (value: string | undefined, fallback: string) => (value && COLOUR.test(value) ? value.toUpperCase() : fallback);
  const shades = (map: Record<string, string> | undefined) => {
    if (!map) return undefined;
    const kept = Object.fromEntries(Object.entries(map).filter(([, value]) => COLOUR.test(value)).map(([key, value]) => [key, value.toUpperCase()]));
    return Object.keys(kept).length ? kept : undefined;
  };
  const round = top.corners === 'square' || top.corners === 'round' || top.corners === 'soft' ? top.corners : fallback.round;
  const boxes = top.boxes === 'outline' || top.boxes === 'filled' ? top.boxes : fallback.boxes;
  return {
    name: top.name?.trim() || fallback.name,
    bg: colour(top.background, fallback.bg),
    head: colour(top.headings, fallback.head),
    text: colour(top.text, fallback.text),
    accent: colour(top.accent, fallback.accent),
    glow: top['soft-light'] === undefined ? fallback.glow : /^(true|yes|on)$/i.test(top['soft-light']),
    fh: top['heading-font']?.trim() || fallback.fh,
    fb: top['text-font']?.trim() || fallback.fb,
    round,
    boxes,
    // A theme's own shades only when its colours are the ones they were picked for: changed colours work them out.
    card: shades(nested.card),
    borderless: shades(nested.borderless),
  };
}

/** The built-in theme, read from its own text. */
export const BUILT_IN_THEME: DeckTheme = parseTheme(BUILT_IN_THEME_TEXT);

/** Is this a theme path a deck may name: project-relative, inside the project, a `.theme.md` file? */
export function isThemePath(value: string | null | undefined): value is string {
  if (!value) return false;
  const path = value.trim();
  if (!/\.theme\.md$/i.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('/') || path.startsWith('\\')) return false;
  return !path.split(/[\\/]/).includes('..');
}

/**
 * One of the project's themes, as the deck's Theme menu lists it (Sprint 162): its path, its file's text (null for the
 * built-in theme when the project has no file for it), and how many of the project's decks draw it.
 */
export interface ThemeEntry {
  path: string;
  text: string | null;
  decks: number;
}

/** At most this many theme files are listed: a project's library, with room to spare. */
export const MAX_THEMES = 200;

/**
 * The theme a deck draws, as a path of the project's list: the file its front matter names when the project has it,
 * else the built-in theme's (a deck with no `theme:` line, or one naming a file that isn't there, draws the built-in
 * theme, so it counts there and the menu ticks it there).
 */
export function themeKeyOf(named: unknown, paths: ReadonlySet<string>): string {
  const path = typeof named === 'string' ? named.trim() : '';
  return isThemePath(path) && paths.has(path) ? path : BUILT_IN_THEME_PATH;
}

/**
 * The project's themes for the Theme menu: every theme file in `Slide library/Themes`, and the built-in theme when the
 * project has no file at its path; each with the number of decks that draw it (`deckThemes`: each deck's `theme:`
 * value, or null), sorted by name.
 */
export function themeEntries(files: ReadonlyArray<{ path: string; text: string }>, deckThemes: ReadonlyArray<string | null>): ThemeEntry[] {
  const entries: ThemeEntry[] = files.filter(file => isThemePath(file.path)).map(file => ({ path: file.path, text: file.text, decks: 0 }));
  if (!entries.some(entry => entry.path === BUILT_IN_THEME_PATH)) entries.push({ path: BUILT_IN_THEME_PATH, text: null, decks: 0 });
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  const paths = new Set(byPath.keys());
  for (const named of deckThemes) byPath.get(themeKeyOf(named, paths))!.decks += 1;
  const nameOf = (entry: ThemeEntry) => themeOfEntry(entry).name;
  return entries.sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || a.path.localeCompare(b.path));
}

/** An entry's theme: its file read, or the built-in theme. */
export function themeOfEntry(entry: Pick<ThemeEntry, 'text'>): DeckTheme {
  return entry.text === null ? BUILT_IN_THEME : parseTheme(entry.text);
}

/** "1 deck", "5 decks", "No decks": a theme's reach in the Theme menu. */
export function deckCountLabel(count: number): string {
  if (count === 0) return 'No decks';
  return count === 1 ? '1 deck' : `${count} decks`;
}

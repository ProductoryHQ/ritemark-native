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

/**
 * Sprint 162 PR 3 (step-3-themes.md, "Fonts"): the six fonts a theme can use, all SIL OFL 1.1 and bundled with the app
 * in `media/fonts/` (their notices: `media/fonts/OFL.txt`), so they draw offline, on the wall and on a published page.
 * Each is a variable woff2 file (weight axis, upright) in a latin and a latin-ext part, so Estonian's õ ä ö ü š ž draw.
 *
 *  - `file`: the files' stem, `<file>-latin.woff2` and `<file>-latin-ext.woff2`.
 *  - `version`: the font's own version (its name table), in the page's file names, so a page made with a newer font
 *    never meets an older file of the same name beside it.
 *  - `generic`: the family the browser falls back to after Sofia Sans.
 *
 * Sofia Sans is Ritemark's own: the webview carries it in its bundle (`webview/src/index.css`) and the page inline.
 * The other five load as files when a slide uses them (the webview: `theme/deckFonts.ts`; the page: `pageFile.ts`).
 */
export interface DeckFont {
  name: string;
  file: string;
  version: string;
  generic: 'sans-serif' | 'serif';
}

export const DEFAULT_DECK_FONT = 'Sofia Sans';

export const DECK_FONT_LIST: readonly DeckFont[] = [
  { name: 'Sofia Sans', file: 'SofiaSans', version: '4.101', generic: 'sans-serif' },
  { name: 'Inter', file: 'Inter', version: '4.001', generic: 'sans-serif' },
  { name: 'IBM Plex Sans', file: 'IBMPlexSans', version: '3.201', generic: 'sans-serif' },
  { name: 'Space Grotesk', file: 'SpaceGrotesk', version: '2.000', generic: 'sans-serif' },
  { name: 'Source Serif 4', file: 'SourceSerif4', version: '4.004', generic: 'serif' },
  { name: 'Fraunces', file: 'Fraunces', version: '1.000', generic: 'serif' },
];

/**
 * The two parts of each font file and the characters each draws, as Google Fonts cuts them (the five fonts'
 * `@fontsource-variable` stylesheets). Sofia Sans keeps its own ranges (`webview/src/index.css`, `PAGE_FONTS`).
 */
export const DECK_FONT_SUBSETS = [
  {
    subset: 'latin',
    unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    subset: 'latin-ext',
    unicodeRange: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
] as const;

/** A font name as a key: one case, single spaces. */
const fontKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const FONTS_BY_KEY = new Map(DECK_FONT_LIST.map(font => [fontKey(font.name), font]));

/**
 * The font a theme's font name draws: one of the six whatever its case and spacing ("inter", "IBM  Plex Sans"), and
 * Sofia Sans for a name that isn't one of them, or none.
 */
export function deckFont(name: unknown): DeckFont {
  const found = typeof name === 'string' ? FONTS_BY_KEY.get(fontKey(name)) : undefined;
  return found ?? FONTS_BY_KEY.get(fontKey(DEFAULT_DECK_FONT))!;
}

/** The CSS font list a slide draws a font name with: the font, Sofia Sans while it loads (or if it can't), its kind. */
export function deckFontStack(name: unknown): string {
  const font = deckFont(name);
  return font.name === DEFAULT_DECK_FONT ? `'${DEFAULT_DECK_FONT}', sans-serif` : `'${font.name}', '${DEFAULT_DECK_FONT}', ${font.generic}`;
}

/** The fonts a theme draws (headings first), each once. */
export function themeFonts(theme: Pick<DeckTheme, 'fh' | 'fb'>): DeckFont[] {
  return [...new Set([deckFont(theme.fh), deckFont(theme.fb)])];
}

/** A font's file in `media/fonts/` for one of its parts: `Inter-latin.woff2`. */
export function deckFontFile(font: DeckFont, subset: (typeof DECK_FONT_SUBSETS)[number]['subset']): string {
  return `${font.file}-${subset}.woff2`;
}

/** The fonts by canonical name, as the CSS font lists their slides draw with (kept for PR 2, built on the map main had). Look a theme's name up with `deckFontStack`, never here. */
export const DECK_FONTS: Record<string, string> = Object.fromEntries(DECK_FONT_LIST.map(font => [font.name, deckFontStack(font.name)]));

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
 * A theme path as a key: `/` separators, no `./` or doubled slashes, and one case (the project folders Ritemark runs
 * on, macOS and Windows, find a file whatever its case), so a hand-written `theme:` line names the file it draws.
 */
function pathKey(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^(\.\/)+/, '').toLowerCase();
}

/**
 * The entry a deck draws, by its `theme:` value: the theme file it names when the project has it; else Evening, which a
 * deck with no line, or one naming a file that isn't there, draws. Evening is the project's own `Evening.theme.md` when
 * it has one (step-3-themes.md: "A project's own file takes a built-in's place"), else the built-in theme. Null only for
 * a list with no Evening at all, which `themeEntries` never makes.
 */
export function themeKeyOf(named: unknown, entries: ReadonlyArray<Pick<ThemeEntry, 'path' | 'text'>>): string | null {
  const path = typeof named === 'string' ? named.trim() : '';
  if (isThemePath(path)) {
    const key = pathKey(path);
    const file = entries.find(entry => entry.text !== null && pathKey(entry.path) === key);
    if (file) return file.path;
  }
  return entries.find(entry => pathKey(entry.path) === pathKey(BUILT_IN_THEME_PATH))?.path ?? null;
}

/**
 * The theme file a deck's view, wall, page and thumbnails read, by its `theme:` value: the file it names, or Evening's
 * path when it names none. The readers fall back to Evening's file, then to the built-in theme (`readDeckTheme`).
 */
export function themePathOf(named: unknown): string {
  const path = typeof named === 'string' ? named.trim() : '';
  return isThemePath(path) ? path : BUILT_IN_THEME_PATH;
}

/**
 * The project's themes for the Theme menu: every theme file in `Slide library/Themes`, and the built-in theme when the
 * project has no file at its path; each with the number of decks that draw it (`deckThemes`: each deck's `theme:`
 * value, or null), sorted by name.
 */
export function themeEntries(files: ReadonlyArray<{ path: string; text: string }>, deckThemes: ReadonlyArray<string | null>): ThemeEntry[] {
  const entries: ThemeEntry[] = files.filter(file => isThemePath(file.path)).map(file => ({ path: file.path, text: file.text, decks: 0 }));
  if (!entries.some(entry => pathKey(entry.path) === pathKey(BUILT_IN_THEME_PATH))) entries.push({ path: BUILT_IN_THEME_PATH, text: null, decks: 0 });
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  for (const named of deckThemes) {
    const key = themeKeyOf(named, entries);
    if (key !== null) byPath.get(key)!.decks += 1;
  }
  // Each name read once, not at every comparison.
  const names = new Map(entries.map(entry => [entry, themeOfEntry(entry).name]));
  return entries.sort((a, b) => names.get(a)!.localeCompare(names.get(b)!) || a.path.localeCompare(b.path));
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

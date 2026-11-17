/**
 * Sprint 162 PR 2 (step-3-themes.md; README "Themes (15 November)" and "Saving a theme"): writing a theme file.
 *
 * The theme's tab changes a theme file's front matter one field at a time: its name, its four colours, the soft light,
 * the heading and text fonts (Sprint 162 PR 3), the corners and the boxes, the fields the engine reads (`parseTheme`). A change rewrites only the lines of the fields
 * that changed, in the quotes they had, so a theme opened and saved without a change stays byte for byte, and a colour
 * change is one line. One more thing goes with a colour change, as the prototype's `setThemeField` has it: the theme's
 * hand-picked shades (`card:` and `borderless:`) were picked for its old colours, so they go and the engine works the
 * shades out from the new ones (`themeVars`).
 *
 * Also here: Ritemark's starting points for a new theme (Paper and Ember, prototype `STARTERS`, frame 14), and the rule
 * for a new theme's name and file. Pure: the host, the webview and the tests read the same rules.
 */
import { writeScalar } from './deckFormat';
import { DECK_FONT_LIST, DEFAULT_LOGO_ON, DEFAULT_LOGO_PLACE, deckFont, isDeckFontName, isLogoPath, LOGO_ONS, LOGO_PLACES, parseTheme, THEMES_FOLDER, type DeckTheme, type LogoOn, type LogoPlace } from './deckTheme';

/** The fields the theme's tab changes, as `DeckTheme` names them. */
export interface ThemeChanges {
  name?: string;
  bg?: string;
  head?: string;
  text?: string;
  accent?: string;
  glow?: boolean;
  /** The heading and text fonts (Sprint 162 PR 3): one of the six, by its own name. */
  fh?: string;
  fb?: string;
  round?: DeckTheme['round'];
  boxes?: DeckTheme['boxes'];
  /**
   * Sprint 162 PR 4: the logo, a picture beside the theme file (its path from the theme's folder), or null to take it
   * out (with its place and where it shows). Only the host names a picture, once it has copied it beside the theme:
   * the tab may only take the logo out (`isThemeChanges`).
   */
  logo?: string | null;
  /** The logo's corner and where it shows; written only while the theme has a logo. */
  logoAt?: LogoPlace;
  logoOn?: LogoOn;
}

export type ThemeField = keyof ThemeChanges;

/** Each field's key in the theme file. */
export const THEME_KEYS: Record<ThemeField, string> = {
  name: 'name',
  bg: 'background',
  head: 'headings',
  text: 'text',
  accent: 'accent',
  glow: 'soft-light',
  fh: 'heading-font',
  fb: 'text-font',
  round: 'corners',
  boxes: 'boxes',
  logo: 'logo',
  logoAt: 'logo-place',
  logoOn: 'logo-on',
};

/** The logo's lines, which go together when the logo is taken out. */
const LOGO_KEYS = [THEME_KEYS.logo, THEME_KEYS.logoAt, THEME_KEYS.logoOn];

const FIELDS = Object.keys(THEME_KEYS) as ThemeField[];
const COLOUR_FIELDS: ThemeField[] = ['bg', 'head', 'text', 'accent'];
/** The hand-picked shades, which go with a colour change. */
const SHADE_SECTIONS = ['card', 'borderless'];
const COLOUR = /^#[0-9A-F]{6}$/;

/** A colour as the tab may write it: `#RRGGBB`, in capitals; `#RGB` and a missing `#` are read too. Null otherwise. */
export function normalColour(value: string): string | null {
  const raw = value.trim().replace(/^#/, '');
  const full = /^[0-9a-f]{3}$/i.test(raw) ? raw.split('').map(char => char + char).join('') : raw;
  return /^[0-9a-f]{6}$/i.test(full) ? `#${full.toUpperCase()}` : null;
}

/**
 * Is this a change the theme's tab may send? Its colours, soft light, fonts (one of the six, by name), corners and boxes, each of its own kind. The name
 * isn't changed in the tab (it is the file's name too): only a new theme is named.
 */
export function isThemeChanges(value: unknown): value is ThemeChanges {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length === 0 || keys.some(key => key === 'name' || !FIELDS.includes(key as ThemeField))) return false;
  return keys.every(key => {
    const field = input[key];
    switch (key as ThemeField) {
      case 'glow': return typeof field === 'boolean';
      case 'round': return field === 'square' || field === 'soft' || field === 'round';
      case 'boxes': return field === 'filled' || field === 'outline';
      case 'fh':
      case 'fb': return typeof field === 'string' && DECK_FONT_LIST.some(font => font.name === field);
      // The tab only takes a logo out; a picture is named by the host, which copied it (`ThemePages.takeLogo`).
      case 'logo': return field === null;
      case 'logoAt': return LOGO_PLACES.includes(field as LogoPlace);
      case 'logoOn': return LOGO_ONS.includes(field as LogoOn);
      default: return typeof field === 'string' && COLOUR.test(field);
    }
  });
}

/** The fields of `changes` that differ from `theme`, colours in capitals. */
export function changedFields(theme: DeckTheme, changes: ThemeChanges): ThemeChanges {
  const out: ThemeChanges = {};
  for (const field of FIELDS) {
    const value = changes[field];
    if (value === undefined) continue;
    if (COLOUR_FIELDS.includes(field)) {
      const colour = normalColour(String(value));
      if (colour && colour !== theme[field as 'bg' | 'head' | 'text' | 'accent']) (out as Record<string, unknown>)[field] = colour;
    } else if (field === 'fh' || field === 'fb') {
      // A font is the one the slide draws: "inter" in the file is Inter already, and needs no new line. A name that
      // isn't one of the six ("Futura", drawn in Sofia Sans) is replaced by any pick, Sofia Sans too.
      const font = deckFont(value);
      if (font.name === String(value) && (font.name !== deckFont(theme[field]).name || !isDeckFontName(theme[field]))) out[field] = font.name;
    } else if (field === 'name') {
      const name = String(value).trim();
      if (name && name !== theme.name) out.name = name;
    } else if (field === 'logo') {
      // A picture the theme can name, or null to take the logo out (only when it has one).
      if (value === null ? theme.logo !== undefined : isLogoPath(String(value)) && String(value).trim() !== theme.logo?.file) out.logo = value === null ? null : String(value).trim();
    } else if (field === 'logoAt' || field === 'logoOn') {
      // A logo's place and where it shows, against what the theme reads (the default when its line is missing).
      const now = field === 'logoAt' ? theme.logo?.place ?? DEFAULT_LOGO_PLACE : theme.logo?.on ?? DEFAULT_LOGO_ON;
      if (value !== now) (out as Record<string, unknown>)[field] = value;
    } else if (value !== theme[field]) {
      (out as Record<string, unknown>)[field] = value;
    }
  }
  return out;
}

const FRONT = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const TOP = /^([A-Za-z0-9_-]+):(\s*)(.*)$/;

/** A value written in the quotes its line had (`"#1C1F4A"`, `'Evening'`, bare). */
function written(field: ThemeField, value: string | boolean | null, quote: string): string {
  if (field === 'glow') return value ? 'true' : 'false';
  const text = String(value);
  if (quote === '"') return JSON.stringify(text);
  if (quote === "'") return `'${text.replace(/'/g, "''")}'`;
  // A colour unquoted would read as a YAML comment: it is always quoted.
  if (COLOUR_FIELDS.includes(field)) return `"${text}"`;
  return writeScalar(text);
}

/** A line's value cut into its quote, and what follows the value (a comment), so the line keeps both. */
function valueParts(raw: string): { quote: string; rest: string } {
  const quote = raw.startsWith('"') ? '"' : raw.startsWith("'") ? "'" : '';
  if (quote === '"') {
    for (let index = 1; index < raw.length; index++) {
      if (raw[index] === '\\') { index++; continue; }
      if (raw[index] === '"') return { quote, rest: raw.slice(index + 1) };
    }
    return { quote, rest: '' };
  }
  if (quote === "'") {
    for (let index = 1; index < raw.length; index++) {
      if (raw[index] === "'" && raw[index + 1] === "'") { index++; continue; }
      if (raw[index] === "'") return { quote, rest: raw.slice(index + 1) };
    }
    return { quote, rest: '' };
  }
  const comment = /\s+#.*$/.exec(raw);
  return { quote, rest: comment ? comment[0] : /\s*$/.exec(raw)?.[0] ?? '' };
}

/**
 * The theme file's text with these fields changed, and every other byte as it was. Only the fields whose value differs
 * from what the file reads as are written: the same text comes back when nothing differs. A key the file names twice is
 * changed where the reader takes it (the last); a key it lacks is added before its shade sections. A colour change also
 * takes the hand-picked shades out (`card:`, `borderless:`). A text without front matter gets one.
 */
export function themeTextWith(text: string, changes: ThemeChanges): string {
  const before = parseTheme(text);
  const changed = changedFields(before, changes);
  // A logo's place and where it shows belong to a logo: with none (or with the logo going), they aren't written.
  const hasLogo = changed.logo === undefined ? before.logo !== undefined : changed.logo !== null;
  if (!hasLogo) {
    delete changed.logoAt;
    delete changed.logoOn;
  }
  const removeLogo = changed.logo === null;
  const fields = FIELDS.filter(field => changed[field] !== undefined && changed[field] !== null);
  if (fields.length === 0 && !removeLogo) return text;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const match = FRONT.exec(text);
  if (!match) {
    const lines = fields.map(field => `${THEME_KEYS[field]}: ${written(field, changed[field]!, '')}`);
    return `---${eol}${lines.join(eol)}${eol}---${eol}${text}`;
  }
  const innerStart = match[0].indexOf('\n') + 1;
  const innerEnd = innerStart + match[1].length;
  const lines = match[1].split(/\r?\n/);
  const isSection = (line: string) => { const top = TOP.exec(line); return !!top && top[3].trim() === ''; };
  // Sprint 162 PR 4: Remove takes out the logo's lines, every one of them (a key written twice too), and nothing else.
  if (removeLogo) {
    for (let index = lines.length - 1; index >= 0; index--) {
      const top = TOP.exec(lines[index]);
      if (top && LOGO_KEYS.includes(top[1]) && top[3].trim() !== '') lines.splice(index, 1);
    }
  }
  for (const field of fields) {
    const key = THEME_KEYS[field];
    let at = -1;
    lines.forEach((line, index) => {
      const top = TOP.exec(line);
      if (top && top[1] === key && top[3].trim() !== '') at = index;
    });
    if (at >= 0) {
      const top = TOP.exec(lines[at])!;
      const { quote, rest } = valueParts(top[3]);
      lines[at] = `${key}:${top[2] || ' '}${written(field, changed[field]!, quote)}${rest}`;
    } else {
      const section = lines.findIndex(isSection);
      lines.splice(section >= 0 ? section : lines.length, 0, `${key}: ${written(field, changed[field]!, '')}`);
    }
  }
  if (fields.some(field => COLOUR_FIELDS.includes(field))) {
    for (let index = 0; index < lines.length;) {
      const top = TOP.exec(lines[index]);
      if (top && top[3].trim() === '' && SHADE_SECTIONS.includes(top[1])) {
        let end = index + 1;
        while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
        lines.splice(index, end - index);
      } else {
        index++;
      }
    }
  }
  return text.slice(0, innerStart) + lines.join(eol) + text.slice(innerEnd);
}

/** A theme's file text, front matter only, in the built-in theme's own format. */
function themeFileText(theme: DeckTheme): string {
  return [
    '---',
    `name: ${writeScalar(theme.name)}`,
    `background: "${theme.bg}"`,
    `headings: "${theme.head}"`,
    `text: "${theme.text}"`,
    `accent: "${theme.accent}"`,
    `soft-light: ${theme.glow ? 'true' : 'false'}`,
    `heading-font: ${writeScalar(theme.fh)}`,
    `text-font: ${writeScalar(theme.fb)}`,
    `corners: ${theme.round}`,
    `boxes: ${theme.boxes}`,
    '---',
    '',
  ].join('\n');
}

/**
 * Ritemark's starting points for a new theme (prototype `STARTERS`; frame 14): Paper, light with a serif for headings,
 * and Ember, dark and warm with round corners. Their fonts are the design's, and ship with Ritemark (`media/fonts/`,
 * Sprint 162 PR 3).
 */
export const PAPER_THEME_TEXT = themeFileText({
  name: 'Paper', bg: '#FFFFFF', head: '#14213D', text: '#3A4660', accent: '#0E7C86', glow: false,
  fh: 'Source Serif 4', fb: 'Sofia Sans', round: 'square', boxes: 'outline',
});
export const EMBER_THEME_TEXT = themeFileText({
  name: 'Ember', bg: '#211B18', head: '#FFFFFF', text: '#EFE7E1', accent: '#FF7A45', glow: true,
  fh: 'Space Grotesk', fb: 'Inter', round: 'round', boxes: 'filled',
});

export type ThemeStart = 'copy' | 'paper' | 'ember';

/** The words under each start in New theme (frame 14). */
export const START_WORDS: Record<Exclude<ThemeStart, 'copy'>, { name: string; note: string }> = {
  paper: { name: 'Paper', note: 'Light, a serif for headings' },
  ember: { name: 'Ember', note: 'Dark, warm, round corners' },
};

/** A start's theme, for its picture in New theme: the deck's own for a copy. */
export function startTheme(start: ThemeStart, deckTheme: DeckTheme): DeckTheme {
  if (start === 'paper') return parseTheme(PAPER_THEME_TEXT);
  if (start === 'ember') return parseTheme(EMBER_THEME_TEXT);
  return deckTheme;
}

/**
 * A new theme's file text: a copy of the deck's theme file (`copyText`, or the built-in theme's text when the deck draws
 * the built-in theme), Paper or Ember, with the new name.
 */
export function newThemeText(name: string, start: ThemeStart, copyText: string): string {
  const source = start === 'paper' ? PAPER_THEME_TEXT : start === 'ember' ? EMBER_THEME_TEXT : copyText;
  return themeTextWith(source, { name: name.trim() });
}

/** A theme's name: at most this many characters. It is also its file's name. */
export const MAX_THEME_NAME = 60;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * What is wrong with a new theme's name, or null. The name is its file's name too (`<Name>.theme.md` in
 * `Slide library/Themes`), so it holds nothing a file name on macOS or Windows can't, and nothing that would make a
 * deck's `theme:` line need quotes: it starts with a letter or a digit, has no / \ : * ? " < > | #, and doesn't end
 * with a full stop.
 */
export function themeNameProblem(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Give the theme a name.';
  if (name.length > MAX_THEME_NAME) return `A theme's name has at most ${MAX_THEME_NAME} characters.`;
  // eslint-disable-next-line no-control-regex
  if (/[\\/:*?"<>|#\u0000-\u001f\u007f]/.test(name)) return 'A theme\'s name has no / \\ : * ? " < > | or #.';
  if (!/^[\p{L}\p{N}]/u.test(name)) return 'A theme\'s name starts with a letter or a digit.';
  if (name.endsWith('.')) return 'A theme\'s name doesn\'t end with a full stop.';
  if (RESERVED.test(name)) return 'That name is kept for the computer. Give the theme another name.';
  return null;
}

/**
 * The problem with a new theme's name in this project, or null: `themeNameProblem`, and no other theme (a file in the
 * folder, or the built-in Evening) has this name or this file name, in any case. One name is one look in a project.
 */
export function newThemeNameProblem(value: string, taken: { names: readonly string[]; files: readonly string[] }): string | null {
  const problem = themeNameProblem(value);
  if (problem) return problem;
  const name = value.trim().toLowerCase();
  const file = `${name}.theme.md`;
  const same = taken.names.find(other => other.trim().toLowerCase() === name);
  if (same !== undefined || taken.files.some(other => other.toLowerCase() === file)) {
    return `There's a theme called ${same?.trim() ?? value.trim()} already. Give this one another name.`;
  }
  return null;
}

/** A new theme's project-relative path, from its name. */
export function themePathFor(name: string): string {
  return `${THEMES_FOLDER}/${name.trim()}.theme.md`;
}

/**
 * "Save as a new theme…"'s first name: the theme's name and the first number that's free ("Evening 2"). A name that is
 * itself a numbered copy of a theme the project has ("Evening 2" beside "Evening") counts on ("Evening 3"); any other
 * name keeps its own digits ("Q3 2026 2"). Characters a name can't hold are left out; with nothing left, "New theme".
 */
export function nextThemeName(name: string, taken: { names: readonly string[]; files: readonly string[] }): string {
  // eslint-disable-next-line no-control-regex
  let base = name.replace(/[\\/:*?"<>|#\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+/u, '').replace(/\.+$/, '').trim();
  const numbered = /^(.*\S)\s+\d+$/.exec(base);
  if (numbered && taken.names.some(other => other.trim().toLowerCase() === numbered[1].toLowerCase())) base = numbered[1];
  base = base.slice(0, MAX_THEME_NAME - 4).trim();
  if (!base || themeNameProblem(`${base} 2`)) base = 'New theme';
  for (let index = 2; index < 1000; index++) {
    const candidate = `${base} ${index}`;
    if (newThemeNameProblem(candidate, taken) === null) return candidate;
  }
  return '';
}

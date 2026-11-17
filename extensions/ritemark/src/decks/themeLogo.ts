/**
 * Sprint 162 PR 4 (step-3-themes.md, "Logo"; README "Themes (15 November)": "the logo as a picture beside the file"):
 * a theme's logo file, the rules the host and the tests read.
 *
 *  - **Where it goes.** A logo dropped on the theme's tab, or chosen, is copied beside the theme file, in the same
 *    folder, as `<theme file's name> logo.svg` (or `.png`): one file next to the theme it belongs to, named after it, with
 *    no folder of its own to make or explain. The theme file names it in one line, `logo: Fernhollow Bank logo.svg`. A
 *    name taken by another picture is never written over: the next free one is used (`… logo 2.svg`); the same picture
 *    already there is used as it is.
 *  - **What it may be.** An SVG or a PNG of at most `MAX_LOGO_BYTES`. A PNG is one by its first bytes. An SVG is drawn
 *    only as an `<img>` (never put into a page as markup), so nothing in it runs or loads there; but the published page
 *    carries the file beside it, where someone could open it as a page of its own, so an SVG with a script, an event
 *    handler, an embedded page or anything it would fetch is no logo (`svgProblem`).
 *
 * Pure: no `vscode`, no file system.
 */
import { isLogoPath } from './deckTheme';

/** A logo is a small picture: anything larger is refused. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const LOGO_TOO_LARGE = `A logo is at most ${MAX_LOGO_BYTES / 1024 / 1024} MB. Make it smaller, or save it as an SVG.`;

export type LogoKind = 'svg' | 'png';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The kind a logo's file name says: `.svg` or `.png`, any case; null for any other. */
export function logoKindOfName(name: string): LogoKind | null {
  const match = /\.(svg|png)$/i.exec(name.trim());
  return match ? (match[1].toLowerCase() as LogoKind) : null;
}

/**
 * What would make this SVG's text unsafe as a file of its own on the published page, or null: a script, an event
 * handler, `javascript:`, an embedded page or object, an entity declaration, or a reference to anything outside the
 * file (an `href` or `url()` that isn't the file's own `#id` or a `data:` picture, a style's `@import` or
 * `image-set()`, an animation that sets an `href`).
 *
 * Read after its character references are decoded (`javascript&#x3a;` is `javascript:`), with any namespace prefix on
 * an element or an `href` counted (`<svg:script>`, `x:href`), and an SVG that declares a namespace prefix other than
 * `xlink` and `svg` is refused outright, so a prefix can't hide an element of another language (the review of #785).
 */
export function svgProblem(raw: string): string | null {
  if (!/<(?:svg:)?svg[\s>]/i.test(raw)) return 'That file isn\'t an SVG picture.';
  const unsafe = 'That SVG has scripts or links to other files in it, so it can\'t be the logo. Save it as a PNG, or as a plain SVG.';
  const text = decodeReferences(raw);
  if (/<!ENTITY/i.test(text)) return unsafe;
  for (const match of text.matchAll(/xmlns:([\w.-]+)\s*=/gi)) {
    if (!['xlink', 'svg'].includes(match[1].toLowerCase())) return unsafe;
  }
  // An element that runs, embeds or animates, with or without a prefix.
  if (/<(?:[\w.-]+:)?(script|foreignObject|iframe|embed|object|audio|video|set|animate|animateMotion|animateTransform|handler|listener)[\s>/]/i.test(text)) return unsafe;
  // An event handler on any element (`onload=`, `onclick =`, `x:onload=`).
  if (/<[^>]*[\s/"':]on[a-z]+\s*=/i.test(text)) return unsafe;
  if (/javascript\s*:/i.test(text)) return unsafe;
  if (/@import|image-set\s*\(|\bsrc\s*\(/i.test(text)) return unsafe;
  // Every reference stays inside the file: `href="#id"`, `url(#id)`, or a picture as `data:image/…`.
  for (const match of text.matchAll(/(?:^|[\s"':])href\s*=\s*["']?\s*([^"'\s>]*)/gi)) {
    if (!/^(#|data:image\/(png|jpe?g|gif|webp);)/i.test(match[1])) return unsafe;
  }
  for (const match of text.matchAll(/url\(\s*["']?\s*([^"')\s]*)/gi)) {
    if (!/^(#|data:image\/(png|jpe?g|gif|webp);)/i.test(match[1])) return unsafe;
  }
  return null;
}

/** The text with its numeric character references (`&#58;`, `&#x3a;`) and the five named ones read as characters. */
function decodeReferences(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', lpar: '(', rpar: ')' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? whole;
    const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
  });
}

/**
 * What is wrong with these bytes as a logo by this name, or null when they are one: an SVG or a PNG (its name and its
 * bytes agree), not empty, at most `MAX_LOGO_BYTES`, and an SVG that is safe on its own (`svgProblem`).
 */
export function logoProblem(name: string, bytes: Uint8Array): string | null {
  const kind = logoKindOfName(name);
  if (!kind) return 'A logo is an SVG or a PNG picture.';
  if (bytes.length === 0) return 'That file is empty.';
  if (bytes.length > MAX_LOGO_BYTES) return LOGO_TOO_LARGE;
  if (kind === 'png') return PNG_MAGIC.every((byte, index) => bytes[index] === byte) ? null : 'That file isn\'t a PNG picture.';
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return 'That file isn\'t an SVG picture.';
  }
  return svgProblem(text);
}

/** The theme file's own name, without `.theme.md`: the start of its logo's name. */
export function themeStem(themeFile: string): string {
  const base = themeFile.split(/[\\/]/).pop() ?? '';
  return base.replace(/\.theme\.md$/i, '').trim() || 'Theme';
}

/**
 * The names a theme's logo may take beside it, in order: `<stem> logo.<kind>`, then `<stem> logo 2.<kind>`, … Each is a
 * name a theme's `logo:` line can hold (`isLogoPath`), within a file name's 255 bytes.
 */
export function* logoNames(themeFile: string, kind: LogoKind): Generator<string> {
  let stem = themeStem(themeFile);
  while (new TextEncoder().encode(stem).length > 200) stem = stem.slice(0, -1);
  for (let index = 1; index < 1000; index++) {
    const name = `${stem} logo${index === 1 ? '' : ` ${index}`}.${kind}`;
    if (isLogoPath(name)) yield name;
  }
}

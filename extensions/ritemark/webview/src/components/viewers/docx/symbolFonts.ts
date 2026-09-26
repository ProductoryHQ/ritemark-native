/**
 * v1.12.0 RC fix — characters from Word's symbol fonts.
 *
 * Word writes a bullet or symbol drawn from Symbol or Wingdings as that font's
 * own code (for the Symbol bullet "•": U+F0B7, the font's private-use slot).
 * Windows Office maps those slots through its own copy of the font; a Mac and a
 * browser do not, so the preview drew an empty box. These fixes turn such
 * characters into the Unicode characters they stand for and drop the symbol
 * font, so any text font draws them.
 *
 * Pure string transforms, like docxXml.ts.
 */

/** Adobe's Symbol encoding (0x20–0xFE) → Unicode, as Word's Symbol font draws it. */
const SYMBOL: Record<number, string> = {
  0x20: ' ', 0x21: '!', 0x22: '∀', 0x23: '#', 0x24: '∃', 0x25: '%', 0x26: '&', 0x27: '∋',
  0x28: '(', 0x29: ')', 0x2a: '∗', 0x2b: '+', 0x2c: ',', 0x2d: '−', 0x2e: '.', 0x2f: '/',
  0x30: '0', 0x31: '1', 0x32: '2', 0x33: '3', 0x34: '4', 0x35: '5', 0x36: '6', 0x37: '7',
  0x38: '8', 0x39: '9', 0x3a: ':', 0x3b: ';', 0x3c: '<', 0x3d: '=', 0x3e: '>', 0x3f: '?',
  0x40: '≅', 0x41: 'Α', 0x42: 'Β', 0x43: 'Χ', 0x44: 'Δ', 0x45: 'Ε', 0x46: 'Φ', 0x47: 'Γ',
  0x48: 'Η', 0x49: 'Ι', 0x4a: 'ϑ', 0x4b: 'Κ', 0x4c: 'Λ', 0x4d: 'Μ', 0x4e: 'Ν', 0x4f: 'Ο',
  0x50: 'Π', 0x51: 'Θ', 0x52: 'Ρ', 0x53: 'Σ', 0x54: 'Τ', 0x55: 'Υ', 0x56: 'ς', 0x57: 'Ω',
  0x58: 'Ξ', 0x59: 'Ψ', 0x5a: 'Ζ', 0x5b: '[', 0x5c: '∴', 0x5d: ']', 0x5e: '⊥', 0x5f: '_',
  0x60: '‾', 0x61: 'α', 0x62: 'β', 0x63: 'χ', 0x64: 'δ', 0x65: 'ε', 0x66: 'φ', 0x67: 'γ',
  0x68: 'η', 0x69: 'ι', 0x6a: 'ϕ', 0x6b: 'κ', 0x6c: 'λ', 0x6d: 'μ', 0x6e: 'ν', 0x6f: 'ο',
  0x70: 'π', 0x71: 'θ', 0x72: 'ρ', 0x73: 'σ', 0x74: 'τ', 0x75: 'υ', 0x76: 'ϖ', 0x77: 'ω',
  0x78: 'ξ', 0x79: 'ψ', 0x7a: 'ζ', 0x7b: '{', 0x7c: '|', 0x7d: '}', 0x7e: '∼',
  0xa0: '€', 0xa1: 'ϒ', 0xa2: '′', 0xa3: '≤', 0xa4: '⁄', 0xa5: '∞', 0xa6: 'ƒ', 0xa7: '♣',
  0xa8: '♦', 0xa9: '♥', 0xaa: '♠', 0xab: '↔', 0xac: '←', 0xad: '↑', 0xae: '→', 0xaf: '↓',
  0xb0: '°', 0xb1: '±', 0xb2: '″', 0xb3: '≥', 0xb4: '×', 0xb5: '∝', 0xb6: '∂', 0xb7: '•',
  0xb8: '÷', 0xb9: '≠', 0xba: '≡', 0xbb: '≈', 0xbc: '…', 0xbd: '⏐', 0xbe: '⎯', 0xbf: '↵',
  0xc0: 'ℵ', 0xc1: 'ℑ', 0xc2: 'ℜ', 0xc3: '℘', 0xc4: '⊗', 0xc5: '⊕', 0xc6: '∅', 0xc7: '∩',
  0xc8: '∪', 0xc9: '⊃', 0xca: '⊇', 0xcb: '⊄', 0xcc: '⊂', 0xcd: '⊆', 0xce: '∈', 0xcf: '∉',
  0xd0: '∠', 0xd1: '∇', 0xd2: '®', 0xd3: '©', 0xd4: '™', 0xd5: '∏', 0xd6: '√', 0xd7: '⋅',
  0xd8: '¬', 0xd9: '∧', 0xda: '∨', 0xdb: '⇔', 0xdc: '⇐', 0xdd: '⇑', 0xde: '⇒', 0xdf: '⇓',
  0xe0: '◊', 0xe1: '〈', 0xe2: '®', 0xe3: '©', 0xe4: '™', 0xe5: '∑', 0xe6: '⎛', 0xe7: '⎜',
  0xe8: '⎝', 0xe9: '⎡', 0xea: '⎢', 0xeb: '⎣', 0xec: '⎧', 0xed: '⎨', 0xee: '⎩', 0xef: '⎪',
  0xf1: '〉', 0xf2: '∫', 0xf3: '⌠', 0xf4: '⎮', 0xf5: '⌡', 0xf6: '⎞', 0xf7: '⎟', 0xf8: '⎠',
  0xf9: '⎤', 0xfa: '⎥', 0xfb: '⎦', 0xfc: '⎫', 0xfd: '⎬', 0xfe: '⎭',
};

/**
 * Wingdings → Unicode, for the characters Word's bullet library and symbol
 * dialog offer most. A Wingdings character not listed here stays as it is.
 */
const WINGDINGS: Record<number, string> = {
  0x4a: '☺', 0x4c: '☹', 0x6c: '●', 0x6e: '■', 0x6f: '□', 0x71: '❑', 0x72: '❒', 0x75: '◆',
  0x76: '❖', 0xa1: '○', 0xa7: '▪', 0xa8: '◻', 0xab: '★', 0xd8: '➢', 0xe8: '➔', 0xfb: '✗',
  0xfc: '✓', 0xfd: '☒', 0xfe: '☑',
};

const FONT_TABLES: Record<string, Record<number, string>> = {
  symbol: SYMBOL,
  wingdings: WINGDINGS,
  // Known symbol fonts without a table here: their characters are still drawn
  // with the font (a bullet falls back to "•").
  'wingdings 2': {},
  'wingdings 3': {},
  webdings: {},
};

function tableFor(font: string | null | undefined): Record<number, string> | null {
  if (!font) return null;
  return FONT_TABLES[font.trim().toLowerCase()] ?? null;
}

export function isSymbolFont(font: string | null | undefined): boolean {
  return tableFor(font) !== null;
}

/**
 * The Unicode character a symbol-font character stands for, or null when it
 * isn't one (or isn't known). Both forms Word writes are accepted: the
 * private-use slot U+F020–U+F0FF and the plain byte 0x20–0xFF.
 */
export function mapSymbolChar(font: string, ch: string): string | null {
  const table = tableFor(font);
  if (!table) return null;
  const code = ch.codePointAt(0) ?? 0;
  const byte = code >= 0xf000 && code <= 0xf0ff ? code - 0xf000 : code;
  if (byte > 0xff) return null;
  return table[byte] ?? null;
}

/** A character a symbol font gives its own meaning to (anything else is already Unicode text). */
function isFontCode(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code <= 0xff || (code >= 0xf000 && code <= 0xf0ff);
}

const ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g;
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(ENTITY, (_m, e: string) => {
    if (e[0] !== '#') return NAMED[e];
    const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

export function encodeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const FONT_ATTRS = ['w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'];

/** The symbol font an `<w:rFonts …/>` element names, if any. */
function symbolFontIn(rFonts: string): string | null {
  for (const attr of FONT_ATTRS) {
    const value = new RegExp(`\\b${attr}="([^"]*)"`).exec(rFonts)?.[1];
    if (value && isSymbolFont(value)) return value;
  }
  return null;
}

/** The same `<w:rFonts …/>` without its symbol-font names; '' when nothing else is left. */
function withoutSymbolFonts(rFonts: string): string {
  let out = rFonts;
  for (const attr of FONT_ATTRS) {
    out = out.replace(new RegExp(`\\s${attr}="([^"]*)"`), (m, value: string) => (isSymbolFont(value) ? '' : m));
  }
  return /\bw:(?:ascii|hAnsi|cs|eastAsia|asciiTheme|hAnsiTheme|cstheme|eastAsiaTheme)=/.test(out) ? out : '';
}

const RFONTS = /<w:rFonts\b[^>]*\/>/;

/**
 * Numbering levels whose marker is drawn in a symbol font get the Unicode
 * marker instead. A symbol-font marker with no known meaning becomes "•", the
 * bullet Word shows for it most often.
 */
export function mapNumberingSymbols(numberingXml: string): string {
  return numberingXml.replace(/<w:lvl\b[^>]*>[\s\S]*?<\/w:lvl>/g, (lvl) => {
    const rFonts = RFONTS.exec(lvl)?.[0];
    const font = rFonts ? symbolFontIn(rFonts) : null;
    if (!rFonts || !font) return lvl;
    const withText = lvl.replace(/(<w:lvlText\b[^>]*\bw:val=")([^"]*)(")/, (_m, open: string, value: string, close: string) => {
      const text = decodeXml(value).replace(/%\d|[\s\S]/gu, (part) => (part.length > 1 && part[0] === '%' ? part : mapSymbolChar(font, part) ?? '•'));
      return `${open}${encodeXml(text)}${close}`;
    });
    return withText.replace(rFonts, withoutSymbolFonts(rFonts));
  });
}

const TEXT = /(<w:t\b[^>]*>)([^<]*)(<\/w:t>)/g;

/**
 * Symbol characters in running text: `<w:sym w:font=… w:char=…/>` elements,
 * and runs set in a symbol font. A run is changed only when every character in
 * it has a known meaning; otherwise it is left as Word wrote it.
 */
export function mapRunSymbols(xml: string): string {
  const withSyms = xml.replace(/<w:sym\b[^>]*\/>/g, (sym) => {
    const font = /\bw:font="([^"]*)"/.exec(sym)?.[1];
    const hex = /\bw:char="([0-9a-fA-F]+)"/.exec(sym)?.[1];
    if (!font || !hex) return sym;
    const mapped = mapSymbolChar(font, String.fromCharCode(parseInt(hex, 16)));
    return mapped ? `<w:t xml:space="preserve">${encodeXml(mapped)}</w:t>` : sym;
  });
  // A run, never spanning into another run's start (runs nest only inside text boxes).
  return withSyms.replace(/<w:r\b(?:(?!<w:r\b)[\s\S])*?<\/w:r>/g, (run) => {
    const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run)?.[0];
    const rFonts = rPr ? RFONTS.exec(rPr)?.[0] : undefined;
    const font = rFonts ? symbolFontIn(rFonts) : null;
    if (!rPr || !rFonts || !font) return run;
    let mappable = true;
    const mapped = run.replace(TEXT, (_m, open: string, value: string, close: string) => {
      const text = [...decodeXml(value)]
        .map((ch) => (isFontCode(ch) ? mapSymbolChar(font, ch) ?? ((mappable = false), ch) : ch))
        .join('');
      return `${open}${encodeXml(text)}${close}`;
    });
    if (!mappable) return run;
    return mapped.replace(rPr, rPr.replace(rFonts, withoutSymbolFonts(rFonts)));
  });
}

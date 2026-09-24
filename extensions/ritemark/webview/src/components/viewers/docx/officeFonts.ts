/**
 * Sprint 124 (#284) R2, defect 6 — Office's own fonts on a machine that lacks them.
 *
 * On a Mac, Calibri, Cambria and Aptos live inside Word's app bundle, so no
 * other app can use them and the preview fell back to Times. Where a family is
 * missing, alias it to a system font of the same kind at 88 % — the size that
 * came closest to Word's page fill in the spike (Jarmo, 2026-09-24). Where the
 * real font is installed (Windows, or a Mac with it installed system-wide) it is
 * left alone: an @font-face for the same name would override it.
 */

export interface FontAlias {
  family: string;
  /** A system font of the same kind, as its full local names by face. */
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
}

const ARIAL = { regular: 'Arial', bold: 'Arial Bold', italic: 'Arial Italic', boldItalic: 'Arial Bold Italic' };
const GEORGIA = { regular: 'Georgia', bold: 'Georgia Bold', italic: 'Georgia Italic', boldItalic: 'Georgia Bold Italic' };

export const OFFICE_FONT_ALIASES: readonly FontAlias[] = [
  { family: 'Calibri', ...ARIAL },
  { family: 'Calibri Light', ...ARIAL },
  { family: 'Aptos', ...ARIAL },
  { family: 'Aptos Display', ...ARIAL },
  { family: 'Aptos Narrow', ...ARIAL },
  { family: 'Cambria', ...GEORGIA },
];

export const OFFICE_FONT_SIZE_ADJUST = 88;

/** @font-face rules aliasing each missing family, all four faces. */
export function aliasCss(missing: readonly FontAlias[], sizeAdjust = OFFICE_FONT_SIZE_ADJUST): string {
  const faces: Array<[keyof Omit<FontAlias, 'family'>, string, string]> = [
    ['regular', 'normal', 'normal'],
    ['bold', 'bold', 'normal'],
    ['italic', 'normal', 'italic'],
    ['boldItalic', 'bold', 'italic'],
  ];
  return missing
    .flatMap((alias) =>
      faces.map(
        ([face, weight, style]) =>
          `@font-face { font-family: '${alias.family}'; font-weight: ${weight}; font-style: ${style}; src: local('${alias[face]}'); size-adjust: ${sizeAdjust}%; }`,
      ),
    )
    .join('\n');
}

/**
 * Whether the browser can draw `family` from an installed font: text set in
 * it measures differently from the generic fallbacks. Canvas measuring, the
 * usual way; `document.fonts.check` answers true for fonts that are absent.
 */
export function isFontInstalled(family: string): boolean {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return true; // cannot tell; do not alias
  const sample = 'mmmmmmmmmmlli WQ@#0123456789';
  return ['monospace', 'serif', 'sans-serif'].some((generic) => {
    ctx.font = `72px ${generic}`;
    const base = ctx.measureText(sample).width;
    ctx.font = `72px '${family}', ${generic}`;
    return ctx.measureText(sample).width !== base;
  });
}

const STYLE_ID = 'ritemark-office-font-aliases';

/** Add the aliases for missing Office fonts to the page, once. Call before rendering a document. */
export function installOfficeFontAliases(): void {
  if (document.getElementById(STYLE_ID)) return;
  const missing = OFFICE_FONT_ALIASES.filter((alias) => !isFontInstalled(alias.family));
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = aliasCss(missing);
  document.head.appendChild(style);
}

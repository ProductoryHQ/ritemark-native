/**
 * Sprint 162 PR 5 (step-3-themes.md, "Making a theme"): a PowerPoint file's own theme, for the AI's
 * `read_pptx_theme` tool. A `.pptx` carries its theme's colours and fonts in `ppt/theme/theme1.xml` (the slide master's
 * theme): the colour scheme's twelve colours and the heading ("major") and body ("minor") Latin fonts. This reads that
 * part and nothing else: no slide, no picture, no macro. Read only, through the same package check the Office previews
 * use (`checkOfficePackage`), so a damaged, encrypted or oversized file is refused, never inflated.
 *
 * Pure but for `node:zlib` (inside `readZipEntry`): the tool and the test read a file's bytes the same way.
 */
import { checkOfficePackage, readZipDirectory, readZipEntry } from '../officePreview/officePackageCheck';

/** The scheme's colours by DrawingML's names, as `#RRGGBB`. A slot the file leaves out is absent. */
export type PptxColourSlot = 'dk1' | 'lt1' | 'dk2' | 'lt2' | 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6' | 'hlink' | 'folHlink';

export const PPTX_COLOUR_SLOTS: readonly PptxColourSlot[] = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

/** What the tool answers: the theme's name, its colours and its two fonts. */
export interface PptxTheme {
  name: string | null;
  colours: Partial<Record<PptxColourSlot, string>>;
  fonts: { headings: string | null; text: string | null };
}

/** A part this large is no theme: refused before it is read. */
const MAX_THEME_PART_BYTES = 2 * 1024 * 1024;

/** A file's theme part: `ppt/theme/theme1.xml`, else the lowest-numbered theme the package has. */
export function themePartName(names: readonly string[]): string | null {
  if (names.includes('ppt/theme/theme1.xml')) return 'ppt/theme/theme1.xml';
  const themes = names
    .map(name => ({ name, number: /^ppt\/theme\/theme(\d+)\.xml$/.exec(name)?.[1] }))
    .filter((entry): entry is { name: string; number: string } => entry.number !== undefined)
    .sort((a, b) => Number(a.number) - Number(b.number));
  return themes[0]?.name ?? null;
}

const unescape = (value: string) => value
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** An attribute's value on the first tag of this name inside `xml` (any namespace prefix), or null. */
function attributeOf(xml: string, tag: string, attribute: string): string | null {
  const element = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}\\b([^>]*)>`).exec(xml);
  if (!element) return null;
  const value = new RegExp(`\\s${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(element[1]);
  return value ? unescape(value[2] ?? value[3] ?? '') : null;
}

/** The inside of the first element of this name (any namespace prefix), or null. */
function innerOf(xml: string, tag: string): string | null {
  const match = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${tag}>)`).exec(xml);
  return match ? match[1] ?? '' : null;
}

/** A colour slot's value: an `srgbClr`'s, else a `sysClr`'s last colour (Windows' text and window colours). */
function slotColour(slotXml: string): string | null {
  const raw = attributeOf(slotXml, 'srgbClr', 'val') ?? attributeOf(slotXml, 'sysClr', 'lastClr');
  return raw && /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toUpperCase()}` : null;
}

/** A theme part's XML read: its name, its colour scheme and its major and minor Latin fonts. */
export function parsePptxThemeXml(xml: string): PptxTheme {
  const colours: PptxTheme['colours'] = {};
  const scheme = innerOf(xml, 'clrScheme') ?? '';
  for (const slot of PPTX_COLOUR_SLOTS) {
    const inner = innerOf(scheme, slot);
    const colour = inner === null ? null : slotColour(inner);
    if (colour) colours[slot] = colour;
  }
  const font = (tag: string) => {
    const inner = innerOf(xml, tag);
    const typeface = inner === null ? null : attributeOf(inner, 'latin', 'typeface');
    return typeface && typeface.trim() ? typeface.trim() : null;
  };
  const name = attributeOf(xml, 'theme', 'name');
  return { name: name && name.trim() ? name.trim() : null, colours, fonts: { headings: font('majorFont'), text: font('minorFont') } };
}

/** A `.pptx` file's theme, or why it can't be read. */
export async function readPptxTheme(bytes: Uint8Array): Promise<{ ok: true; theme: PptxTheme } | { ok: false; problem: string }> {
  const verdict = await checkOfficePackage(bytes, 'ppt/', undefined, { verifyParts: false });
  if (!verdict.ok) {
    const problem = verdict.reason === 'password-protected' ? 'The file is password-protected.'
      : verdict.reason === 'legacy-format' ? 'The file is an older PowerPoint format (.ppt); only .pptx carries a theme this way.'
      : verdict.reason === 'wrong-kind' || verdict.reason === 'not-an-office-file' ? 'The file is not a PowerPoint presentation.'
      : verdict.reason === 'too-large' || verdict.reason === 'too-complex' ? 'The file is too large to read.'
      : 'The file is damaged.';
    return { ok: false, problem };
  }
  const entries = readZipDirectory(bytes) ?? [];
  const partName = themePartName(entries.map(entry => entry.name));
  const entry = partName ? entries.find(candidate => candidate.name === partName) : undefined;
  if (!entry) return { ok: false, problem: 'The presentation has no theme.' };
  if (entry.uncompressedSize > MAX_THEME_PART_BYTES) return { ok: false, problem: 'The presentation\'s theme is too large to read.' };
  const data = await readZipEntry(bytes, entry);
  if (!data) return { ok: false, problem: 'The presentation\'s theme could not be read.' };
  return { ok: true, theme: parsePptxThemeXml(new TextDecoder('utf-8').decode(data)) };
}

/**
 * Sprint 125 (#285) R2, R4, R6 — the parts of a PowerPoint package the renderer
 * gets wrong or leaves out, handled as text before and beside rendering. Pure:
 * strings in, strings out, so the tests run without a DOM.
 * Evidence: docs/development/releases/v1.12.0/sprint-125-powerpoint-preview/research/renderer-spike.md
 */

const NOTES_SLIDE = '/relationships/notesSlide';

/**
 * Spike defects 1 and 2, as PowerPoint draws them (checked against its PDFs of the
 * corpus):
 * - `varyColors` colours a chart by category only when its chart group has one
 *   series. PowerPoint writes `varyColors val="1"` on every bar, line and area chart
 *   it saves, and the renderer applied it to multi-series charts too, colouring
 *   them by category against their own legend.
 * - A chart with a single series and a title that was not deleted shows the series
 *   name as its title, whether the title element is missing or empty. The renderer
 *   drew no title; the name is written in.
 */
export function fixChartXml(xml: string): string {
  let out = xml.replace(
    /<c:(bar|bar3D|line|line3D|area|area3D)Chart>([\s\S]*?)<\/c:\1Chart>/g,
    (group, kind: string, body: string) => {
      if (countSeries(body) < 2) return group;
      return `<c:${kind}Chart>${body.replace(/<c:varyColors val="(1|true)"\/>/, '<c:varyColors val="0"/>')}</c:${kind}Chart>`;
    },
  );

  const plotArea = /<c:plotArea>[\s\S]*<\/c:plotArea>/.exec(out)?.[0] ?? '';
  if (countSeries(plotArea) !== 1) return out;
  if (/<c:autoTitleDeleted val="(1|true)"\/>/.test(out)) return out;
  if (!/xmlns:a="/.test(out)) return out;
  const name = seriesName(plotArea);
  if (!name) return out;
  // 14 pt bold: PowerPoint's size for an automatic title (checked against its PDF of the corpus).
  // The size goes on the paragraph's defaults: given on the run, the renderer drew it far smaller.
  const tx = `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:t>${name}</a:t></a:r></a:p></c:rich></c:tx>`;

  const title = /<c:title>([\s\S]*?)<\/c:title>/.exec(out);
  if (title) {
    if (/<c:tx>/.test(title[1])) return out;
    return out.replace(title[0], `<c:title>${tx}${title[1]}</c:title>`);
  }
  // No title element: PowerPoint shows one anyway. `c:title` is the first child of `c:chart`.
  out = out.replace(/<c:chart>/, `<c:chart><c:title>${tx}<c:overlay val="0"/></c:title>`);
  return out;
}

function countSeries(xml: string): number {
  return (xml.match(/<c:ser>/g) ?? []).length;
}

/** The series name as PowerPoint caches it: the first value inside the series' `c:tx`. Still XML-escaped. */
function seriesName(plotArea: string): string | null {
  const ser = /<c:ser>([\s\S]*?)<\/c:ser>/.exec(plotArea)?.[1] ?? '';
  const tx = /<c:tx>([\s\S]*?)<\/c:tx>/.exec(ser)?.[1] ?? '';
  const value = /<c:v>([^<]*)<\/c:v>/.exec(tx)?.[1];
  return value && value.trim() ? value : null;
}

/**
 * The Latin text fonts a deck names: in its themes (`a:latin` of the major and minor
 * fonts) and on its runs. Theme references such as `+mn-lt` are not family names.
 */
export function deckFontFamilies(xmls: Iterable<string>): string[] {
  const families = new Set<string>();
  for (const xml of xmls) {
    for (const [, typeface] of xml.matchAll(/<a:latin\b[^>]*\btypeface="([^"]*)"/g)) {
      const family = decodeXmlText(typeface).trim();
      if (family && !family.startsWith('+')) families.add(family);
    }
  }
  return [...families];
}

/** Decode the five XML entities and numeric character references. */
export function decodeXmlText(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Spike defect 12: the speaker notes of a notes slide, one string per paragraph.
 * Only the body placeholder holds the notes; the slide image and the slide-number
 * placeholder are skipped. Blank lines at either end are dropped.
 */
export function notesParagraphs(notesXml: string): string[] {
  const paragraphs: string[] = [];
  for (const [, sp] of notesXml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
    if (!/<p:ph\b[^>]*\btype="body"/.test(sp)) continue;
    for (const [, p] of sp.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p\/>/g)) {
      const body = p ?? '';
      const runs = [...body.matchAll(/<a:t>([^<]*)<\/a:t>|<a:t\/>|<a:br\/>/g)].map(([whole, text]) =>
        whole === '<a:br/>' ? '\n' : decodeXmlText(text ?? ''),
      );
      paragraphs.push(runs.join(''));
    }
  }
  while (paragraphs.length && !paragraphs[0].trim()) paragraphs.shift();
  while (paragraphs.length && !paragraphs[paragraphs.length - 1].trim()) paragraphs.pop();
  return paragraphs;
}

/** Resolve a relationship target against the folder of the part that holds it. */
export function resolvePartPath(partPath: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = partPath.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.' && segment !== '') parts.push(segment);
  }
  return parts.join('/');
}

/** The notes slide of a slide, from the slide's relationships; null when it has none. */
export function notesPartFor(slidePath: string, rels: ReadonlyMap<string, { type: string; target: string }>): string | null {
  for (const rel of rels.values()) {
    if (rel.type.endsWith(NOTES_SLIDE)) return resolvePartPath(slidePath, rel.target);
  }
  return null;
}

export type UnsupportedKind = 'video' | 'audio' | 'embedded-objects';

/** R6: what a slide links to that the preview does not play or open. */
export function unsupportedIn(rels: ReadonlyMap<string, { type: string; target: string }>): Set<UnsupportedKind> {
  const found = new Set<UnsupportedKind>();
  for (const rel of rels.values()) {
    if (rel.type.endsWith('/relationships/video')) found.add('video');
    else if (rel.type.endsWith('/relationships/audio')) found.add('audio');
    // PowerPoint 2010+ also writes a `media` relationship next to either.
    else if (rel.type.endsWith('/relationships/media') && /\.(mp3|m4a|wav|wma|aac)$/i.test(rel.target)) found.add('audio');
    else if (rel.type.endsWith('/relationships/media')) found.add('video');
    else if (rel.type.endsWith('/relationships/oleObject') || rel.type.endsWith('/relationships/package')) found.add('embedded-objects');
  }
  return found;
}

/** One line for the notice, or null. */
export function describeUnsupported(kinds: ReadonlySet<UnsupportedKind>): string | null {
  const names: string[] = [];
  if (kinds.has('video')) names.push('video');
  if (kinds.has('audio')) names.push('audio');
  if (kinds.has('embedded-objects')) names.push('embedded objects');
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verbs = kinds.has('embedded-objects') && (kinds.has('video') || kinds.has('audio'))
    ? 'can’t play or open'
    : kinds.has('embedded-objects') ? 'can’t open' : 'can’t play';
  return `This presentation has ${list} that the preview ${verbs}.`;
}

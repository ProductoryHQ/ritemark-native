/**
 * Sprint 124 (#284) R2 — fixes applied to a Word document's XML before
 * docx-preview draws it. Each one answers a defect measured against Word
 * (docs/development/releases/v1.12.0/sprint-124-word-preview-fidelity/research/renderer-spike.md).
 *
 * All pure string transforms: no DOM, no zip, no renderer internals, so they
 * keep working whatever docx-preview does inside.
 */

/** Stand-ins for PAGE / NUMPAGES results; the viewer writes each page's number over them after rendering. */
export const PAGE_FIELD_MARK = '\uE000PAGE\uE001';
export const NUMPAGES_FIELD_MARK = '\uE000NUMPAGES\uE001';

/**
 * Word stores `<w:lastRenderedPageBreak/>` where its own layout started a page.
 * Honouring those gives Word's pages, but only a document Word saved has them —
 * and honouring them in a document without any loses section breaks (defect 1).
 */
export function hasPageMarkers(documentXml: string): boolean {
  return documentXml.includes('<w:lastRenderedPageBreak');
}

// Anything that puts something on the page. A page marker with none of these
// between it and a page break is Word noting the break it already made. A tab
// *in text* is `<w:tab/>`; `<w:tab w:val=… w:pos=…/>` is a tab stop in the
// paragraph's properties and puts nothing on the page.
const CONTENT = String.raw`<w:t[\s>]|<w:drawing\b|<w:pict\b|<w:object\b|<w:sym\b|<w:tab\s*\/>|<w:br\b|<w:cr\b|<m:oMath|<w:tbl\b`;

const BREAK_THEN_MARKER = new RegExp(
  String.raw`(<w:br\b[^>]*\bw:type="page"[^>]*\/>)((?:(?!${CONTENT}).)*?)<w:lastRenderedPageBreak\s*\/>`,
  'gs',
);

// page-break-before set on the paragraph (`w:val` absent, or 1 / true / on), then
// a marker before that paragraph's first content.
const BREAK_BEFORE_THEN_MARKER = new RegExp(
  String.raw`(<w:pageBreakBefore(?:\s+w:val="(?:1|true|on)")?\s*\/>)((?:(?!${CONTENT}|<\/w:p>).)*?)<w:lastRenderedPageBreak\s*\/>`,
  'gs',
);

/**
 * Defect 2: a manual page break followed by Word's marker, with nothing in
 * between, is one page break. docx-preview breaks for both and draws a blank
 * page; drop the marker.
 */
export function dropRedundantPageMarkers(documentXml: string): string {
  return documentXml
    .replace(BREAK_THEN_MARKER, '$1$2')
    .replace(BREAK_BEFORE_THEN_MARKER, '$1$2');
}

type FieldKind = 'PAGE' | 'NUMPAGES';

function fieldKind(instruction: string): FieldKind | null {
  const name = instruction.trim().split(/\s+/)[0]?.toUpperCase();
  return name === 'PAGE' || name === 'NUMPAGES' ? name : null;
}

function markFor(kind: FieldKind): string {
  return kind === 'PAGE' ? PAGE_FIELD_MARK : NUMPAGES_FIELD_MARK;
}

const MARK_RUN = (kind: FieldKind) => `<w:r><w:t>${markFor(kind)}</w:t></w:r>`;
const TEXT_ELEMENT = /(<w:t\b[^>]*>)([^<]*)(<\/w:t>)/g;

/** Put the mark in place of a field result: first text element gets it, the rest go empty. */
function replaceResultText(result: string, kind: FieldKind): string | null {
  let first = true;
  let found = false;
  const out = result.replace(TEXT_ELEMENT, (_m, open: string, _text: string, close: string) => {
    found = true;
    const text = first ? markFor(kind) : '';
    first = false;
    return `${open}${text}${close}`;
  });
  return found ? out : null;
}

/** Start of the `<w:r>` element enclosing `at` (not `<w:rPr>` or `<w:rFonts>`), or -1. */
function runStartBefore(xml: string, at: number): number {
  let i = xml.lastIndexOf('<w:r', at);
  while (i >= 0 && !/^<w:r[\s>]/.test(xml.slice(i, i + 5))) i = xml.lastIndexOf('<w:r', i - 1);
  return i;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * Defect 3: PAGE and NUMPAGES show whatever Word last cached, so every page reads
 * the same number. Replace each field's result with a mark the viewer fills in
 * per rendered page. Handles complex fields (begin / instrText / separate /
 * result / end, possibly with no cached result, as generators write them) and
 * simple fields. Nested fields are left alone.
 */
export function markPageFields(xml: string): string {
  const edits: Edit[] = [];

  // Simple fields.
  const simple = /<w:fldSimple\b([^>]*?)(\/>|>([\s\S]*?)<\/w:fldSimple>)/g;
  for (const m of xml.matchAll(simple)) {
    const instr = /w:instr="([^"]*)"/.exec(m[1])?.[1] ?? '';
    const kind = fieldKind(instr);
    if (!kind) continue;
    const inner = m[3];
    const replacedInner = inner === undefined ? null : replaceResultText(inner, kind);
    const body = replacedInner ?? MARK_RUN(kind);
    edits.push({ start: m.index!, end: m.index! + m[0].length, text: `<w:fldSimple${m[1]}>${body}</w:fldSimple>` });
  }

  // Complex fields: walk the field characters and instruction text in order.
  const token = /<w:fldChar\b[^>]*\bw:fldCharType="(begin|separate|end)"[^>]*\/>|<w:instrText\b[^>]*>([^<]*)<\/w:instrText>/g;
  interface Frame { instr: string; separateEnd: number | null }
  const stack: Frame[] = [];
  for (const m of xml.matchAll(token)) {
    const at = m.index!;
    if (m[2] !== undefined) {
      if (stack.length) stack[stack.length - 1].instr += m[2];
      continue;
    }
    const type = m[1];
    if (type === 'begin') {
      stack.push({ instr: '', separateEnd: null });
    } else if (type === 'separate') {
      if (stack.length) stack[stack.length - 1].separateEnd = at + m[0].length;
    } else {
      const frame = stack.pop();
      if (!frame || stack.length > 0) continue; // unbalanced, or a field inside another
      const kind = fieldKind(frame.instr);
      if (!kind) continue;
      if (frame.separateEnd !== null) {
        const result = xml.slice(frame.separateEnd, at);
        const replaced = replaceResultText(result, kind);
        if (replaced !== null) {
          edits.push({ start: frame.separateEnd, end: at, text: replaced });
        } else {
          // No cached result: add a run right after the run holding `separate`.
          const runClose = result.indexOf('</w:r>');
          if (runClose >= 0) {
            const insertAt = frame.separateEnd + runClose + '</w:r>'.length;
            edits.push({ start: insertAt, end: insertAt, text: MARK_RUN(kind) });
          }
        }
      } else {
        // No `separate` at all: add one and the result before the run holding `end`.
        const runStart = runStartBefore(xml, at);
        if (runStart >= 0) {
          edits.push({ start: runStart, end: runStart, text: `<w:r><w:fldChar w:fldCharType="separate"/></w:r>${MARK_RUN(kind)}` });
        }
      }
    }
  }

  if (!edits.length) return xml;
  edits.sort((a, b) => b.start - a.start);
  let out = xml;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/**
 * Word hyphenates automatically only when the document asks for it
 * (`<w:autoHyphenation/>` in its settings); docx-preview hyphenates always.
 */
export function wantsAutoHyphenation(settingsXml: string | null): boolean {
  if (!settingsXml) return false;
  const m = /<w:autoHyphenation\b([^>]*)\/>/.exec(settingsXml);
  if (!m) return false;
  const val = /w:val="([^"]*)"/.exec(m[1])?.[1];
  return val === undefined || val === '1' || val === 'true' || val === 'on';
}

/** Relationship id -> target, from a `.rels` part. */
export function parseRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]*)"/.exec(m[1])?.[1];
    const target = /\bTarget="([^"]*)"/.exec(m[1])?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

const FONT_EMBED = /<w:embed(?:Regular|Bold|Italic|BoldItalic)\b[^>]*\br:id="([^"]*)"[^>]*\/>/g;

/** Relationship ids of the embedded font faces the font table refers to. */
export function listFontEmbedIds(fontTableXml: string): string[] {
  return [...fontTableXml.matchAll(FONT_EMBED)].map((m) => m[1]);
}

/**
 * Defect 5: Word can embed a face with no data (a 0-byte font part). The browser
 * then fails that face and draws it in its default serif. Drop such references,
 * so the family's other faces are used instead.
 */
export function dropFontEmbeds(fontTableXml: string, ids: ReadonlySet<string>): string {
  if (!ids.size) return fontTableXml;
  return fontTableXml.replace(FONT_EMBED, (element, id: string) => (ids.has(id) ? '' : element));
}

export interface UnsupportedContent {
  charts: boolean;
  smartArt: boolean;
  embeddedObjects: boolean;
  equations: boolean;
}

/** R6: things the preview does not draw, or draws only roughly. */
export function scanUnsupported(xmlParts: readonly string[]): UnsupportedContent {
  const has = (re: RegExp) => xmlParts.some((xml) => re.test(xml));
  return {
    charts: has(/drawingml\/2006\/chart"|<c:chart\b/),
    smartArt: has(/drawingml\/2006\/diagram"|<dgm:relIds\b/),
    embeddedObjects: has(/<w:object\b|<o:OLEObject\b/),
    equations: has(/<m:oMath(?:Para)?\b/),
  };
}

/** A sentence for the notice, or null when there is nothing to say. */
export function describeUnsupported(u: UnsupportedContent): string | null {
  const parts: string[] = [];
  if (u.charts) parts.push('charts');
  if (u.smartArt) parts.push('SmartArt diagrams');
  if (u.embeddedObjects) parts.push('embedded objects');
  if (u.equations) parts.push('equations');
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `This document has ${list} that the preview can’t show exactly.`;
}

/**
 * Sprint 124 (#284) R2 — open a .docx, apply the XML fixes from `docxXml.ts`,
 * and hand docx-preview a package it draws closer to Word.
 */
import JSZip from 'jszip';
import {
  documentFont,
  dropFontEmbeds,
  dropRedundantPageMarkers,
  embeddedFont,
  ensureDefaultLineSpacing,
  ensurePageSetup,
  fixTableGrids,
  fontLineHeightRatio,
  hasWeightAxis,
  impliedFontWeight,
  knownLineHeightRatio,
  lineHeightRatio,
  normalizeLineSpacing,
  hasPageMarkers,
  listFontEmbedIds,
  markPageAnchors,
  markPageFields,
  splitFieldRuns,
  parseRelationships,
  scanUnsupported,
  wantsAutoHyphenation,
  type PageAnchor,
  type Paper,
  type UnsupportedContent,
} from './docxXml';
import { insertPageBreaks, markBodyBlocks, markEmptyParagraphs, paragraphStyles, pinTableGrids, type BlockMarker } from './pagination';
import { mapNumberingSymbols, mapRunSymbols } from './symbolFonts';

export interface PrepareOptions {
  /** Paper for a document that states none. */
  paper: Paper;
}

export interface PreparedDocx {
  /** The package to render: the original bytes when nothing needed changing. */
  data: Uint8Array;
  /** Honour Word's saved page markers (`ignoreLastRenderedPageBreak: false`) — only when the document has them. */
  honourPageMarkers: boolean;
  unsupported: UnsupportedContent;
  /** The document turns automatic hyphenation on (Word's default is off). */
  autoHyphenation: boolean;
  /** Floating pictures set against the page, by marker name, for `positionPageAnchors`. */
  anchors: Map<string, PageAnchor>;
  /** Embedded variable fonts under a family name that picks a weight (lower case), for `weightEmbeddedFonts`. */
  variableFonts: Set<string>;
  /**
   * Block markers for laying out pages (`pagination.ts`). With Word's own page
   * markers they are only used to break a page Word's markers can't (a table
   * running over several pages).
   */
  markers: Map<string, BlockMarker>;
  /**
   * The same package with a page started before each of the named block
   * markers, and the given tables' column widths (px, by first row marker) fixed.
   */
  withPageBreaks(breaks: ReadonlySet<string>, tableWidths?: ReadonlyMap<string, readonly number[]>): Promise<Uint8Array>;
}

const HEADER_OR_FOOTER = /^word\/(?:header|footer)\d*\.xml$/;
const NOTES = /^word\/(?:footnotes|endnotes)\.xml$/;
const OFFICE_DOCUMENT = /\/officeDocument$/;

/** A relationship target resolved against the folder of the part that owns it. */
function resolvePart(baseFolder: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = `${baseFolder}/${target}`.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

async function mainDocumentPath(zip: JSZip): Promise<string> {
  const rels = zip.file('_rels/.rels');
  if (rels) {
    for (const m of (await rels.async('string')).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const type = /\bType="([^"]*)"/.exec(m[1])?.[1] ?? '';
      const target = /\bTarget="([^"]*)"/.exec(m[1])?.[1];
      if (target && OFFICE_DOCUMENT.test(type)) return resolvePart('', target);
    }
  }
  return 'word/document.xml';
}

/** The line height of `font` read from the document's embedded copy of it, or null. */
async function embeddedLineHeightRatio(zip: JSZip, font: string): Promise<number | null> {
  const table = zip.file('word/fontTable.xml');
  const rels = zip.file('word/_rels/fontTable.xml.rels');
  if (!table || !rels) return null;
  const face = embeddedFont(await table.async('string'), font);
  const target = face ? parseRelationships(await rels.async('string')).get(face.id) : undefined;
  const file = target ? zip.file(resolvePart('word', target)) : null;
  return face && file ? fontLineHeightRatio(await file.async('uint8array'), face.key) : null;
}

/** Size of a part without inflating it when JSZip already knows it. */
async function partSize(file: JSZip.JSZipObject): Promise<number> {
  const known = (file as unknown as { _data?: { uncompressedSize?: unknown } })._data?.uncompressedSize;
  if (typeof known === 'number') return known;
  return (await file.async('uint8array')).length;
}

export async function prepareDocx(bytes: Uint8Array, options: PrepareOptions = { paper: 'A4' }): Promise<PreparedDocx> {
  const zip = await JSZip.loadAsync(bytes);
  let changed = false;
  const write = (path: string, before: string, after: string) => {
    if (after !== before) {
      zip.file(path, after);
      changed = true;
    }
  };
  const anchors = new Map<string, PageAnchor>();
  const markAnchors = (xml: string) => {
    const marked = markPageAnchors(xml, anchors.size);
    for (const anchor of marked.anchors) anchors.set(anchor.name, anchor);
    return marked.xml;
  };
  let emptyParagraphs = 0;
  const markEmpty = (xml: string) => {
    const marked = markEmptyParagraphs(xml, flowStyles, emptyParagraphs);
    emptyParagraphs = marked.next;
    return marked.xml;
  };

  const mainPath = await mainDocumentPath(zip);
  const main = zip.file(mainPath);
  if (!main) throw new Error('This file has no Word document inside it.');
  const original = await main.async('string');

  // Line spacing as Word measures it: in the document font's line heights.
  const stylesFile = zip.file('word/styles.xml');
  const stylesXml = stylesFile ? await stylesFile.async('string') : null;
  const flowStyles = paragraphStyles(stylesXml);
  const themeFile = zip.file('word/theme/theme1.xml');
  const font = documentFont(stylesXml, themeFile ? await themeFile.async('string') : null);
  // A font Word's installation may not have (a brand font) is often embedded: its own metrics then.
  const lineRatio = lineHeightRatio(font, knownLineHeightRatio(font) === null ? await embeddedLineHeightRatio(zip, font) : null);
  if (stylesXml !== null) write('word/styles.xml', stylesXml, ensureDefaultLineSpacing(normalizeLineSpacing(stylesXml, lineRatio), lineRatio));

  const honourPageMarkers = hasPageMarkers(original);
  let documentXml = honourPageMarkers ? dropRedundantPageMarkers(original) : original;
  documentXml = markPageFields(splitFieldRuns(documentXml));
  documentXml = fixTableGrids(ensurePageSetup(documentXml, options.paper));
  documentXml = markEmpty(markAnchors(mapRunSymbols(normalizeLineSpacing(documentXml, lineRatio))));

  const scanned = [documentXml];
  for (const path of Object.keys(zip.files).filter((p) => HEADER_OR_FOOTER.test(p))) {
    const xml = await zip.file(path)!.async('string');
    const marked = markEmpty(markAnchors(mapRunSymbols(normalizeLineSpacing(markPageFields(splitFieldRuns(xml)), lineRatio))));
    write(path, xml, marked);
    scanned.push(marked);
  }
  for (const path of Object.keys(zip.files).filter((p) => NOTES.test(p))) {
    const xml = await zip.file(path)!.async('string');
    write(path, xml, markEmpty(mapRunSymbols(normalizeLineSpacing(xml, lineRatio))));
  }
  const numbering = zip.file('word/numbering.xml');
  if (numbering) {
    const xml = await numbering.async('string');
    write('word/numbering.xml', xml, mapNumberingSymbols(normalizeLineSpacing(xml, lineRatio)));
  }

  // Blocks are marked for the viewer to lay out pages: all of them in a document
  // without Word's page markers, and in one with them wherever those fall short.
  const marked = markBodyBlocks(documentXml, flowStyles);
  const markers = marked.markers;
  const markedXml = marked.xml;
  write(mainPath, original, markedXml);

  const fontTable = zip.file('word/fontTable.xml');
  const fontRels = zip.file('word/_rels/fontTable.xml.rels');
  const variableFonts = new Set<string>();
  if (fontTable && fontRels) {
    const tableXml = await fontTable.async('string');
    const targets = parseRelationships(await fontRels.async('string'));
    const empty = new Set<string>();
    for (const id of listFontEmbedIds(tableXml)) {
      const target = targets.get(id);
      const file = target ? zip.file(resolvePart('word', target)) : null;
      if (!file || (await partSize(file)) === 0) empty.add(id);
    }
    write('word/fontTable.xml', tableXml, dropFontEmbeds(tableXml, empty));
    // Only a family named for a weight needs its font file read.
    for (const m of tableXml.matchAll(/<w:font\b[^>]*\bw:name="([^"]*)"[^>]*>([\s\S]*?)<\/w:font>/g)) {
      if (impliedFontWeight(m[1]) === undefined) continue;
      const face = embeddedFont(tableXml, m[1]);
      const target = face && !empty.has(face.id) ? targets.get(face.id) : undefined;
      const file = target ? zip.file(resolvePart('word', target)) : null;
      if (face && file && hasWeightAxis(await file.async('uint8array'), face.key)) variableFonts.add(m[1].toLowerCase());
    }
  }

  const settings = zip.file('word/settings.xml');
  const autoHyphenation = wantsAutoHyphenation(settings ? await settings.async('string') : null);

  const data = changed ? await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }) : bytes;
  const withPageBreaks = async (breaks: ReadonlySet<string>, tableWidths: ReadonlyMap<string, readonly number[]> = new Map()) => {
    zip.file(mainPath, insertPageBreaks(pinTableGrids(markedXml, tableWidths), breaks));
    return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  };
  return { data, honourPageMarkers, unsupported: scanUnsupported(scanned), autoHyphenation, anchors, variableFonts, markers, withPageBreaks };
}

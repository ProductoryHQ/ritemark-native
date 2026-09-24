/**
 * Sprint 124 (#284) R2 — open a .docx, apply the XML fixes from `docxXml.ts`,
 * and hand docx-preview a package it draws closer to Word.
 */
import JSZip from 'jszip';
import {
  dropFontEmbeds,
  dropRedundantPageMarkers,
  hasPageMarkers,
  listFontEmbedIds,
  markPageFields,
  parseRelationships,
  scanUnsupported,
  type UnsupportedContent,
} from './docxXml';

export interface PreparedDocx {
  /** The package to render: the original bytes when nothing needed changing. */
  data: Uint8Array;
  /** Honour Word's saved page markers (`ignoreLastRenderedPageBreak: false`) — only when the document has them. */
  honourPageMarkers: boolean;
  unsupported: UnsupportedContent;
}

const HEADER_OR_FOOTER = /^word\/(?:header|footer)\d*\.xml$/;
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

/** Size of a part without inflating it when JSZip already knows it. */
async function partSize(file: JSZip.JSZipObject): Promise<number> {
  const known = (file as unknown as { _data?: { uncompressedSize?: unknown } })._data?.uncompressedSize;
  if (typeof known === 'number') return known;
  return (await file.async('uint8array')).length;
}

export async function prepareDocx(bytes: Uint8Array): Promise<PreparedDocx> {
  const zip = await JSZip.loadAsync(bytes);
  let changed = false;
  const write = (path: string, before: string, after: string) => {
    if (after !== before) {
      zip.file(path, after);
      changed = true;
    }
  };

  const mainPath = await mainDocumentPath(zip);
  const main = zip.file(mainPath);
  if (!main) throw new Error('This file has no Word document inside it.');
  const original = await main.async('string');
  const honourPageMarkers = hasPageMarkers(original);
  let documentXml = honourPageMarkers ? dropRedundantPageMarkers(original) : original;
  documentXml = markPageFields(documentXml);
  write(mainPath, original, documentXml);

  const scanned = [documentXml];
  for (const path of Object.keys(zip.files).filter((p) => HEADER_OR_FOOTER.test(p))) {
    const xml = await zip.file(path)!.async('string');
    const marked = markPageFields(xml);
    write(path, xml, marked);
    scanned.push(marked);
  }

  const fontTable = zip.file('word/fontTable.xml');
  const fontRels = zip.file('word/_rels/fontTable.xml.rels');
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
  }

  const data = changed ? await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }) : bytes;
  return { data, honourPageMarkers, unsupported: scanUnsupported(scanned) };
}

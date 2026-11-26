import { posix } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { checkOfficePackage, OFFICE_PREVIEW_LIMITS, readZipDirectory, readZipEntry } from '../officePreview/officePackageCheck';

const OOXML = 'http://schemas.openxmlformats.org/';
const OFFICE = OOXML + 'officeDocument/2006/';
const STRICT_OFFICE = 'http://purl.oclc.org/ooxml/officeDocument/';
const PRESENTATION = [OOXML + 'presentationml/2006/main', 'http://purl.oclc.org/ooxml/presentationml/main'];
const DRAWING = [OOXML + 'drawingml/2006/main', 'http://purl.oclc.org/ooxml/drawingml/main'];
const PACKAGE = [OOXML + 'package/2006/relationships'];
const PRESENTATION_PART = 'ppt/presentation.xml';

export class PowerPointXmlTooLarge extends Error {}

function* children(node: Element): Generator<Element> {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) yield child as Element;
  }
}

function is(node: Element, namespaces: readonly string[], name: string): boolean {
  return node.localName === name && namespaces.includes(node.namespaceURI ?? '');
}

function elements(node: Element | undefined, namespaces: readonly string[], name: string): Element[] {
  return node ? [...children(node)].filter((child) => is(child, namespaces, name)) : [];
}

function xml(bytes: Uint8Array, namespaces: readonly string[], name: string): Element {
  const text = new TextDecoder().decode(bytes);
  const invalid = () => { throw new Error('Invalid PowerPoint XML'); };
  if (/<!DOCTYPE/i.test(text)) invalid();
  const doc = new DOMParser({ errorHandler: { warning: invalid, error: invalid, fatalError: invalid } })
    .parseFromString(text, 'application/xml');
  if (!doc.documentElement || !is(doc.documentElement, namespaces, name)) invalid();
  return doc.documentElement;
}

function relationshipPart(part: string): string {
  return posix.join(posix.dirname(part), '_rels', posix.basename(part) + '.rels');
}

function isRelationship(rel: Element, kind: 'slide' | 'notesSlide'): boolean {
  const type = rel.getAttribute('Type');
  return [OFFICE, STRICT_OFFICE].some((prefix) => type === prefix + 'relationships/' + kind);
}

function relationshipTarget(rel: Element, part: string, kind: 'slide' | 'notesSlide'): string {
  const mode = rel.getAttribute('TargetMode');
  const target = decodeURIComponent(rel.getAttribute('Target') ?? '');
  if (!isRelationship(rel, kind)
    || (mode && mode !== 'Internal') || !target || target.startsWith('//') || /[:?#\\\u0000-\u001f]/.test(target)) {
    throw new Error('Invalid PowerPoint relationship');
  }
  // These paths are ZIP entry names. No relationship can open a file or URL.
  const path = target.startsWith('/') ? posix.normalize(target.slice(1)) : posix.join(posix.dirname(part), target);
  if (path === '..' || path.startsWith('../')) throw new Error('PowerPoint relationship leaves the package');
  return path;
}

function paragraph(node: Element): string {
  let text = '';
  for (const run of children(node)) {
    if (is(run, DRAWING, 'br')) text += '\n';
    else if (is(run, DRAWING, 'r') || is(run, DRAWING, 'fld')) {
      text += elements(run, DRAWING, 't')[0]?.textContent ?? '';
    }
  }
  return text.trim().replace(/[\\`*_\[\]<>~]/g, '\\$&')
    .replace(/^(?:[#+\-](?=\s)|\d+[.)](?=\s))/gm, (match) => match.replace(/[^\d]$/, '\\$&'));
}

function paragraphs(body: Element | undefined): string[] {
  return elements(body, DRAWING, 'p').map(paragraph);
}

function tableMarkdown(table: Element): string {
  const rows = elements(table, DRAWING, 'tr').map((row) => elements(row, DRAWING, 'tc').map((cell) =>
    paragraphs(elements(cell, DRAWING, 'txBody')[0]).filter(Boolean).join(' ').replace(/\n/g, ' ').replace(/\|/g, '\\|')));
  const width = rows[0]?.length ?? 0;
  if (!width || !rows.some((row) => row.some(Boolean))) return '';
  const line = (row: string[]) => '| ' + row.join(' | ') + ' |';
  return [line(rows[0]), line(Array<string>(width).fill('---')), ...rows.slice(1).map(line)].join('\n');
}

function* slideBlocks(tree: Element): Generator<string> {
  // Shape-tree order also preserves the position of tables among text shapes.
  for (const shape of children(tree)) {
    if (is(shape, PRESENTATION, 'sp')) {
      yield paragraphs(elements(shape, PRESENTATION, 'txBody')[0]).filter(Boolean).join('\n\n');
    } else if (is(shape, PRESENTATION, 'grpSp')) {
      yield* slideBlocks(shape);
    } else if (is(shape, PRESENTATION, 'graphicFrame')) {
      const graphic = elements(shape, DRAWING, 'graphic')[0];
      const data = elements(graphic, DRAWING, 'graphicData')[0];
      for (const table of elements(data, DRAWING, 'tbl')) yield tableMarkdown(table);
    }
  }
}

function shapeTree(root: Element): Element {
  const tree = elements(elements(root, PRESENTATION, 'cSld')[0], PRESENTATION, 'spTree')[0];
  if (!tree) throw new Error('Missing PowerPoint shape tree');
  return tree;
}

function speakerNotes(root: Element): string {
  // The slide image, page number and other notes-page placeholders aren't speaker notes.
  return elements(shapeTree(root), PRESENTATION, 'sp').flatMap((shape) => {
    const properties = elements(elements(shape, PRESENTATION, 'nvSpPr')[0], PRESENTATION, 'nvPr')[0];
    const placeholder = elements(properties, PRESENTATION, 'ph')[0];
    const type = placeholder?.getAttribute('type');
    return placeholder && (!type || type === 'body') ? paragraphs(elements(shape, PRESENTATION, 'txBody')[0]) : [];
  }).join('\n\n').trim();
}

export async function powerpointMarkdown(bytes: Uint8Array) {
  const verdict = await checkOfficePackage(bytes, 'ppt/', OFFICE_PREVIEW_LIMITS, { verifyParts: false });
  if (!verdict.ok) return verdict;
  const entries = new Map(readZipDirectory(bytes)?.map((entry) => [entry.name, entry]));
  async function part(path: string, namespaces: readonly string[], name: string): Promise<Element> {
    const entry = entries.get(path);
    if (entry && entry.uncompressedSize > OFFICE_PREVIEW_LIMITS.maxFileBytes) throw new PowerPointXmlTooLarge();
    const data = entry && await readZipEntry(bytes, entry);
    if (!data) throw new Error('Cannot read PowerPoint part');
    return xml(data, namespaces, name);
  }

  const presentation = await part(PRESENTATION_PART, PRESENTATION, 'presentation');
  const list = elements(presentation, PRESENTATION, 'sldIdLst')[0];
  const ids = elements(list, PRESENTATION, 'sldId').map((slide) =>
    slide.getAttributeNS(OFFICE + 'relationships', 'id') || slide.getAttributeNS(STRICT_OFFICE + 'relationships', 'id'));
  const paths: string[] = [];
  if (ids.length) {
    const rels = await part(relationshipPart(PRESENTATION_PART), PACKAGE, 'Relationships');
    const byId = new Map(elements(rels, PACKAGE, 'Relationship').map((rel) => [rel.getAttribute('Id'), rel]));
    for (const id of ids) {
      const rel = id && byId.get(id);
      if (!rel) throw new Error('Missing PowerPoint slide relationship');
      paths.push(relationshipTarget(rel, PRESENTATION_PART, 'slide'));
    }
  }

  return {
    ok: true as const,
    total: paths.length,
    async slide(number: number) {
      const path = paths[number - 1];
      const root = await part(path, PRESENTATION, 'sld');
      const hidden = root.getAttribute('show') === '0';
      const body = [...slideBlocks(shapeTree(root))].filter(Boolean).join('\n\n');
      let notes = '';
      const relsPath = relationshipPart(path);
      if (entries.has(relsPath)) {
        const rels = await part(relsPath, PACKAGE, 'Relationships');
        const notesRel = elements(rels, PACKAGE, 'Relationship').find((rel) =>
          isRelationship(rel, 'notesSlide'));
        if (notesRel) notes = speakerNotes(await part(relationshipTarget(notesRel, path, 'notesSlide'), PRESENTATION, 'notes'));
      }
      return { body, notes, hidden };
    },
  };
}

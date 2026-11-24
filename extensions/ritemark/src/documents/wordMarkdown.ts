import { DOMParser } from '@xmldom/xmldom';
import { checkOfficePackage, OFFICE_PREVIEW_LIMITS, readZipDirectory, readZipEntry } from '../officePreview/officePackageCheck';

export class WordXmlTooLarge extends Error {}

const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const STRICT_WORD = 'http://purl.oclc.org/ooxml/wordprocessingml/main';
const FALLBACK = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

function isWord(node: Element): boolean {
  return node.namespaceURI === WORD || node.namespaceURI === STRICT_WORD;
}

function* children(node: Element): Generator<Element> {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) yield child as Element;
  }
}

function first(node: Element | undefined, name: string): Element | undefined {
  return node && [...children(node)].find((child) => isWord(child) && child.localName === name);
}

function attribute(node: Element | undefined, name = 'val'): string | null {
  return node?.getAttributeNS(node.namespaceURI, name) || null;
}

function xml(bytes: Uint8Array): Element {
  const text = new TextDecoder().decode(bytes);
  if (/<!DOCTYPE/i.test(text)) throw new Error('Unexpected document type');
  const invalid = () => { throw new Error('Invalid Word XML'); };
  const doc = new DOMParser({ errorHandler: { warning: invalid, error: invalid, fatalError: invalid } })
    .parseFromString(text, 'application/xml');
  if (!doc.documentElement || !isWord(doc.documentElement)) invalid();
  return doc.documentElement;
}

function skip(node: Element): boolean {
  return (node.namespaceURI === FALLBACK && node.localName === 'Fallback')
    || (isWord(node) && (node.localName === 'del' || node.localName === 'moveFrom'));
}

/** Text runs, including text in drawings/text boxes, in their document order. */
function plainText(node: Element): string {
  let text = '';
  for (const child of children(node)) {
    if (skip(child)) continue;
    if (isWord(child)) {
      if (child.localName === 't') {
        text += child.textContent ?? '';
        continue;
      }
      if (['tab', 'br', 'cr'].includes(child.localName)) {
        text += ' ';
        continue;
      }
      if (child.localName === 'noBreakHyphen') text += '-';
    }
    text += plainText(child);
    if (isWord(child) && child.localName === 'p') text += ' ';
  }
  return text;
}

function escapeInline(text: string): string {
  return text.trim().replace(/[\r\n]+/g, ' ').replace(/[\\`*_\[\]<>~]/g, '\\$&');
}

function* blocks(node: Element, names: readonly string[]): Generator<Element> {
  for (const child of children(node)) {
    if (skip(child)) continue;
    if (isWord(child) && names.includes(child.localName)) yield child;
    else yield* blocks(child, names);
  }
}

function tableMarkdown(table: Element, limit: number): string {
  const rows = [...blocks(table, ['tr'])].map((row) =>
    [...blocks(row, ['tc'])].map((cell) => escapeInline(plainText(cell)).replace(/\|/g, '\\|')));
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (width === 0 || !rows.some((row) => row.some(Boolean))) return '';
  const line = (row: string[]) => '|' + row.map((cell) => ` ${cell} |`).join('') + '  |'.repeat(width - row.length);
  let text = line(rows[0]) + '\n' + line(Array<string>(width).fill('---'));
  for (let i = 1; i < rows.length && text.length <= limit; i++) text += '\n' + line(rows[i]);
  return text.slice(0, limit + 1);
}

interface Numbering {
  format: string;
  start: number;
}

/** Numbering is keyed by list instance and level, so adjacent lists can use different markers. */
function numberingOf(root: Element | undefined): Map<string, Numbering> {
  const result = new Map<string, Numbering>();
  if (!root) return result;
  const definitions = new Map<string | null, Element>();
  for (const part of children(root)) {
    if (isWord(part) && part.localName === 'abstractNum') definitions.set(attribute(part, 'abstractNumId'), part);
  }
  for (const num of children(root)) {
    if (!isWord(num) || num.localName !== 'num') continue;
    const id = attribute(num, 'numId');
    const abstract = definitions.get(attribute(first(num, 'abstractNumId')));
    if (!abstract) continue;
    for (const level of children(abstract)) {
      if (!isWord(level) || level.localName !== 'lvl') continue;
      const depth = attribute(level, 'ilvl');
      const override = [...children(num)].find((child) =>
        isWord(child) && child.localName === 'lvlOverride' && attribute(child, 'ilvl') === depth);
      const definition = first(override, 'lvl') ?? level;
      const start = Number(attribute(first(override, 'startOverride') ?? first(definition, 'start')) ?? '1');
      result.set(`${id}:${depth}`, {
        format: attribute(first(definition, 'numFmt')) ?? 'bullet',
        start: Number.isSafeInteger(start) && start >= 0 && start <= 999_999_999 ? start : 1,
      });
    }
  }
  return result;
}

function* markdownBlocks(body: Element, numbering: Map<string, Numbering>, styles: Element | undefined, limit: number): Generator<{ text: string; list?: true }> {
  const properties = new Map<string | null, Element>();
  if (styles) {
    for (const style of children(styles)) {
      if (isWord(style) && style.localName === 'style') properties.set(attribute(style, 'styleId'), style);
    }
  }
  const counters = new Map<string, number>();
  for (const block of blocks(body, ['p', 'tbl'])) {
    if (block.localName === 'tbl') {
      const table = tableMarkdown(block, limit);
      if (table) yield { text: table };
      continue;
    }

    const text = escapeInline(plainText(block));
    if (!text) continue;
    const props = first(block, 'pPr');
    const styleId = attribute(first(props, 'pStyle'));
    let outline = attribute(first(props, 'outlineLvl'));
    let list = first(props, 'numPr');
    let inherited = styleId;
    const visited = new Set<string>();
    while (inherited && !visited.has(inherited)) {
      visited.add(inherited);
      const style = properties.get(inherited);
      const styleProps = first(style, 'pPr');
      outline ??= attribute(first(styleProps, 'outlineLvl'));
      list ??= first(styleProps, 'numPr');
      inherited = attribute(first(style, 'basedOn'));
    }
    const heading = outline === null ? /^heading\s*([1-6])$/i.exec(styleId ?? '')?.[1] : Number(outline) + 1;
    const level = Number(heading);
    if (Number.isInteger(level) && level >= 1 && level <= 9) {
      yield { text: `${'#'.repeat(Math.min(level, 6))} ${text}` };
      continue;
    }
    const id = attribute(first(list, 'numId'));
    const depth = Number(attribute(first(list, 'ilvl')) ?? '0');
    if (list && id !== '0' && Number.isInteger(depth) && depth >= 0 && depth <= 8) {
      const key = `${id}:${depth}`;
      const format = numbering.get(key);
      let marker = '-';
      if (format && format.format !== 'bullet' && format.format !== 'none') {
        const counter = counters.get(key) ?? format.start;
        marker = `${Math.min(counter, 999_999_999)}.`;
        counters.set(key, counter + 1);
        for (let i = depth + 1; i <= 8; i++) counters.delete(`${id}:${i}`);
      }
      yield { text: `${'    '.repeat(depth)}${marker} ${text}`, list: true };
    } else {
      // Escape paragraph-leading Markdown syntax while keeping actual Word headings and lists above.
      yield { text: text.replace(/^(?:[#>|+-](?=\s)|\d+[.)](?=\s))/, (match) => match.replace(/[^\d]$/, '\\$&')) };
    }
  }
}

export async function wordMarkdown(bytes: Uint8Array, limit: number) {
  const verdict = await checkOfficePackage(bytes, 'word/', OFFICE_PREVIEW_LIMITS, { verifyParts: false });
  if (!verdict.ok) return verdict;
  const entries = readZipDirectory(bytes);
  async function part(name: string, required = false): Promise<Element | undefined> {
    const entry = entries?.find((candidate) => candidate.name === `word/${name}.xml`);
    if (!entry && !required) return undefined;
    if (entry && entry.uncompressedSize > OFFICE_PREVIEW_LIMITS.maxFileBytes) throw new WordXmlTooLarge();
    const data = entry && await readZipEntry(bytes, entry);
    if (!data) throw new Error('Cannot read Word XML');
    return xml(data);
  }
  const body = first(await part('document', true), 'body');
  if (!body) throw new Error('Missing Word body');
  return { ok: true as const, blocks: markdownBlocks(body, numberingOf(await part('numbering')), await part('styles'), limit) };
}

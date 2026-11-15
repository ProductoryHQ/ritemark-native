/**
 * Sprint 158 (#711): the workbook's shared string table (`xl/sharedStrings.xml`), changed only by appending.
 *
 * An edited text cell's string is added at the end and the cell points at it. No item is removed or reordered, so
 * every other cell's index stays right; a string no cell uses any more is harmless to Excel. Pure: no Node imports.
 */
import { attr, escapeCellText, needsPreserve, rootPrefix, setAttr, textOfStringItem } from './sheetXml';

export class SharedStrings {
  private readonly prefix: string;
  private readonly originalCount: number;
  private readonly added: string[] = [];
  private addedReferences = 0;
  private itemStarts: number[] | null = null;

  constructor(private readonly xml: string) {
    this.prefix = rootPrefix(xml, 'sst');
    this.originalCount = this.starts().length;
  }

  /** The start of every `<si>` element, found once. */
  private starts(): number[] {
    if (!this.itemStarts) {
      this.itemStarts = [];
      const re = new RegExp(`<${this.prefix}si(?=[\\s/>])`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(this.xml))) this.itemStarts.push(m.index);
    }
    return this.itemStarts;
  }

  get count(): number {
    return this.originalCount + this.added.length;
  }

  /** Add a string for one more cell; returns its index. */
  append(text: string): number {
    this.added.push(text);
    this.addedReferences++;
    return this.originalCount + this.added.length - 1;
  }

  /** The text at `index`, as Excel reads it; undefined past the end. */
  textAt(index: number): string | undefined {
    if (!Number.isInteger(index) || index < 0) return undefined;
    if (index >= this.originalCount) return this.added[index - this.originalCount];
    const start = this.starts()[index];
    const p = this.prefix;
    const open = this.xml.indexOf('>', start);
    if (this.xml[open - 1] === '/') return '';
    const close = this.xml.indexOf(`</${p}si>`, open);
    return textOfStringItem(this.xml.slice(open + 1, close), p);
  }

  get changed(): boolean {
    return this.added.length > 0;
  }

  /** The part with the added strings at its end and its counts raised; the same text when nothing was added. */
  serialize(): string {
    if (!this.added.length) return this.xml;
    const p = this.prefix;
    const items = this.added
      .map((text) => `<${p}si><${p}t${needsPreserve(text) ? ' xml:space="preserve"' : ''}>${escapeCellText(text)}</${p}t></${p}si>`)
      .join('');
    const open = new RegExp(`<${p}sst(?=[\\s/>])[^>]*?(\\/?)>`).exec(this.xml);
    if (!open) throw new Error('No <sst> element');
    let tag = open[0];
    const unique = attr(tag, 'uniqueCount');
    if (unique !== undefined) tag = setAttr(tag, 'uniqueCount', String(Number(unique) + this.added.length));
    const total = attr(tag, 'count');
    if (total !== undefined) tag = setAttr(tag, 'count', String(Number(total) + this.addedReferences));
    if (open[1] === '/') {
      // an empty table written as <sst .../>
      return this.xml.slice(0, open.index) + tag.replace(/\s*\/>$/, '>') + items + `</${p}sst>` + this.xml.slice(open.index + open[0].length);
    }
    const close = this.xml.lastIndexOf(`</${p}sst>`);
    if (close < 0) throw new Error('No </sst>');
    return this.xml.slice(0, open.index) + tag + this.xml.slice(open.index + open[0].length, close) + items + this.xml.slice(close);
  }
}

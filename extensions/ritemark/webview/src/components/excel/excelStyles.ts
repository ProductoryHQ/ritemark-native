/**
 * Sprint 158 (#711): a workbook's styles part (`xl/styles.xml`), read for the preview.
 *
 * PR 2 reads what values need: each cell style's number format. PR 3 adds fills, fonts, borders and alignment.
 */
import { attr, decodeXmlEntities } from '../../../../src/excel/sheetXml'

export interface WorkbookStyles {
  /** The workbook's own number formats, by numFmtId. */
  numFmts: Map<number, string>
  /** Each cell style's (cellXfs entry's) numFmtId, by the cell's `s`. */
  xfNumFmt: number[]
}

/** The text between an element's start and end tags, any prefix; '' when it isn't there. */
export function section(xml: string, tag: string): string {
  const m = new RegExp(`<(?:\\w+:)?${tag}(?=[\\s>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml)
  return m ? m[1] : ''
}

export function readStyles(xml: string): WorkbookStyles {
  const numFmts = new Map<number, string>()
  for (const m of section(xml, 'numFmts').matchAll(/<(?:\w+:)?numFmt(?=[\s/>])([^>]*?)\/?>/g)) {
    const id = Number(attr(m[1], 'numFmtId'))
    const code = attr(m[1], 'formatCode')
    if (Number.isInteger(id) && code !== undefined) numFmts.set(id, decodeXmlEntities(code))
  }
  const xfNumFmt: number[] = []
  for (const m of section(xml, 'cellXfs').matchAll(/<(?:\w+:)?xf(?=[\s/>])([^>]*?)(?:\/>|>)/g)) {
    xfNumFmt.push(Number(attr(m[1], 'numFmtId') ?? '0') || 0)
  }
  return { numFmts, xfNumFmt }
}

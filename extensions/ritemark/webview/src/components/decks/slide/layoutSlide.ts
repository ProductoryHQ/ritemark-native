/**
 * Sprint 157 (technical plan §1.7): a slide laid out on a fixed 960 × 540 canvas, ported from the prototype's
 * `slideHTML`, `fitSize` and `linesOf` (prototype.html:880-956). Pure: it returns boxes that `SlideCanvas` draws, and a
 * later Publish can write the same layout as static HTML.
 *
 * Every kind fits itself to the slide (Gamma Classic's rule): a long title steps down a size, a long list down a tier,
 * boxes beside a picture go into a grid, and nothing goes below `BOTTOM`. The sizes come from character estimates;
 * `step` asks for each choice that many sizes smaller, which the canvas's measuring pass uses when real font metrics
 * still overflow.
 */
import { EXERCISE_TAG, exerciseTagOf, type SlideData, type SlideItem } from '../../../../../src/decks/deckFormat'

export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 540
/** Nothing on a slide goes below this. */
export const BOTTOM = 504
/** How many sizes smaller the measuring pass may ask for. */
export const MAX_STEP = 3

export type BoxStyle = Record<string, string | number>

/** A piece of the slide's words: edited in place on the stage, by its path in the slide's data. */
export interface TextBox {
  type: 'text'
  key: string
  cls: string
  /** `title`, `subtitle`, `number`, `tag`, `items.2.heading`, `items.2.text`, `rows.1.0`. */
  path: string
  text: string
  placeholder: string
  style?: BoxStyle
  /** Line breaks are part of the words (a column's lines). */
  multiline?: boolean
}

/** A mark drawn by the layout: the accent bar, a number, a dot, an icon. */
export interface MarkBox {
  type: 'mark'
  key: string
  cls: string
  style?: BoxStyle
  text?: string
  /** An icon by its Ritemark name; `iconIndex` makes it the item's icon, chosen from the grid on the stage. */
  icon?: string
  iconIndex?: number
}

export interface GroupBox {
  type: 'group'
  key: string
  cls: string
  style: BoxStyle
  children: SlideBox[]
}

export interface TableBox {
  type: 'table'
  key: string
  style: BoxStyle
  cellPadding: string
  columns: number
  rows: Array<{ key: string; cells: Array<{ path: string; text: string; head: boolean }> }>
}

/** The Points kind's numbered list. */
export interface ListBox {
  type: 'list'
  key: string
  style: BoxStyle
  gap: number
  subStyle: BoxStyle
  items: Array<{ key: string; heading: TextBox; text?: TextBox }>
}

export interface PictureBox {
  type: 'picture'
  key: string
  /** `photo`: beside or behind the words; `picbox`: a Picture slide's picture. */
  cls: 'photo' | 'picbox'
  style: BoxStyle
  /** The picture's path as the slide names it (the canvas maps it to a URI). */
  image?: string
}

export type SlideBox = TextBox | MarkBox | GroupBox | TableBox | ListBox | PictureBox

export interface SlideLayout {
  boxes: SlideBox[]
  /** Kinds this build doesn't know draw their title alone. */
  known: boolean
}

/** How many lines a text takes at a size and width: Sofia Sans runs about half an em a letter (bold a little more). */
export function linesOf(text: string | undefined, size: number, width: number, k = 0.53): number {
  const value = String(text || '')
  if (!value) return 1
  return value.split('\n').reduce((count, part) => count + Math.max(1, Math.ceil(part.length * size * k / width)), 0)
}

/** The largest size from `sizes` at which the text fits in `maxLines`, then `step` sizes smaller. */
export function fitSize(text: string | undefined, sizes: number[], width: number, maxLines: number, k?: number, step = 0): number {
  let index = sizes.findIndex(size => linesOf(text, size, width, k) <= maxLines)
  if (index < 0) index = sizes.length - 1
  return sizes[Math.min(sizes.length - 1, index + step)]
}

/** The first tier that fits, then `step` tiers smaller. */
function pickTier<T>(tiers: T[], fits: (tier: T) => boolean, step: number): T {
  let index = tiers.findIndex(fits)
  if (index < 0) index = tiers.length - 1
  return tiers[Math.min(tiers.length - 1, index + step)]
}

const KNOWN = new Set(['title', 'section', 'points', 'boxes', 'columns', 'statement', 'exercise', 'picture', 'table'])
/** The kinds whose words are a list of items. */
const ITEM_KINDS = new Set(['points', 'boxes', 'columns', 'exercise'])

/** Lay a slide out. `editing` draws the places for words not yet written and for icons not yet chosen. */
export function layoutSlide(kind: string, data: SlideData, options: { editing?: boolean; step?: number } = {}): SlideLayout {
  const editing = options.editing === true
  const step = Math.max(0, Math.min(MAX_STEP, options.step ?? 0))
  const boxes: SlideBox[] = []
  const known = KNOWN.has(kind)
  const title = data.title ?? ''
  const subtitle = data.subtitle ?? ''
  // On the stage an item kind with no items yet offers the first one to type in (two for Columns).
  const placeholderItems = editing && (data.items ?? []).length === 0
    ? kind === 'columns' ? [{ heading: '' }, { heading: '' }] : ITEM_KINDS.has(kind) ? [{ heading: '' }] : []
    : []
  const items: SlideItem[] = data.items?.length ? data.items : placeholderItems
  const n = Math.max(items.length, 1)
  const picture = known && kind !== 'picture' ? data.picture ?? 'none' : 'none'

  // The content box: the whole slide, or the side next to a picture.
  let cx = 64
  let cw = 832
  if (picture === 'left') {
    boxes.push({ type: 'picture', key: 'photo', cls: 'photo', style: { left: 0, width: 384 }, image: data.image })
    cx = 384 + 48
    cw = 960 - cx - 48
  } else if (picture === 'right') {
    boxes.push({ type: 'picture', key: 'photo', cls: 'photo', style: { right: 0, width: 384 }, image: data.image })
    cx = 56
    cw = 960 - 384 - 56 - 40
  } else if (picture === 'behind') {
    boxes.push({ type: 'picture', key: 'photo', cls: 'photo', style: { left: 0, right: 0 }, image: data.image })
    boxes.push({ type: 'mark', key: 'veil', cls: 'veil' })
  }
  const narrow = cw < 700

  const text = (key: string, cls: string, path: string, value: string, placeholder: string, style?: BoxStyle, multiline?: boolean): TextBox =>
    ({ type: 'text', key, cls, path, text: value, placeholder, style, ...(multiline ? { multiline } : {}) })

  /** The title, up to two lines, smaller if it needs to be; returns where the content may start. */
  const heading = (top: number, sizes: number[]) => {
    const z = fitSize(title || 'Title', sizes, cw, 2, 0.6, step)
    const lines = linesOf(title || 'Title', z, cw, 0.6)
    boxes.push(text('title', 'st', 'title', title, 'Title', { left: cx, width: cw, top, fontSize: z, lineHeight: `${z + 8}px` }))
    return top + lines * (z + 8)
  }
  const itemHeading = (index: number, cls: string, placeholder: string, style?: BoxStyle) =>
    text(`items.${index}.heading`, cls, `items.${index}.heading`, items[index]?.heading ?? '', placeholder, style)
  const itemText = (index: number, cls: string, placeholder: string, style?: BoxStyle, multiline?: boolean) =>
    text(`items.${index}.text`, cls, `items.${index}.text`, items[index]?.text ?? '', placeholder, style, multiline)
  const icon = (index: number, style?: BoxStyle, small?: boolean): MarkBox | null => {
    const name = items[index]?.icon
    if (name) return { type: 'mark', key: `icon.${index}`, cls: small ? 'ic sm' : 'ic', icon: name, iconIndex: index, style }
    if (editing) return { type: 'mark', key: `icon.${index}`, cls: small ? 'ic sm noic' : 'ic noic', icon: 'plus', iconIndex: index, style }
    return null
  }

  if (!known) {
    heading(56, [44, 38, 32])
    return { boxes, known }
  }

  if (kind === 'title') {
    const z = fitSize(title || 'Title', narrow ? [46, 40, 34] : [60, 52, 44], cw, 2, 0.6, step)
    const lines = linesOf(title, z, cw, 0.6)
    const subLines = linesOf(subtitle, 24, cw)
    const height = lines * (z + 8) + 16 + subLines * 32
    const top = Math.round((540 - height) / 2) + 10
    boxes.push({ type: 'mark', key: 'bar', cls: 'bar', style: { left: cx, top: top - 20 } })
    boxes.push(text('title', 'st', 'title', title, 'Title', { left: cx, width: cw, top, fontSize: z, lineHeight: `${z + 8}px` }))
    boxes.push(text('subtitle', 'sx', 'subtitle', subtitle, 'A line under the title', { left: cx, width: cw, top: top + lines * (z + 8) + 16 }))
  } else if (kind === 'section') {
    const z = fitSize(title, [60, 52, 44], cw, 2, 0.6, step)
    const lines = linesOf(title, z, cw, 0.6)
    const top = Math.min(296, BOTTOM - lines * (z + 8))
    boxes.push(text('number', 'sn', 'number', data.number ?? '', '1', { left: cx, top: top - 156 }))
    boxes.push(text('title', 'st', 'title', title, 'Title', { left: cx, width: cw, top, fontSize: z, lineHeight: `${z + 8}px` }))
  } else if (kind === 'statement') {
    const w = cw - 48
    const z = fitSize(title || 'Say one thing', narrow ? [44, 38, 32] : [58, 50, 42, 36], w, 3, 0.6, step)
    const lines = linesOf(title, z, w, 0.6)
    const subLines = linesOf(subtitle, 26, cw - 80)
    const height = lines * (z + 8) + 24 + subLines * 36
    const top = Math.max(40, Math.round((540 - height) / 2))
    boxes.push(text('title', 'stc', 'title', title, 'Say one thing', { left: cx + 24, width: w, top, fontSize: z, lineHeight: `${z + 8}px` }))
    boxes.push(text('subtitle', 'sxc', 'subtitle', subtitle, 'And one line under it', { left: cx + 40, width: cw - 80, top: top + lines * (z + 8) + 24 }))
  } else if (kind === 'points') {
    const top = Math.max(150, heading(56, [44, 38, 32]) + 24)
    const avail = BOTTOM - top
    const w = cw - 40
    const tiers = [[28, 40, 20, 26, 12], [24, 32, 18, 22, 8], [20, 27, 16, 20, 6], [17, 23, 14, 18, 4]]
    const need = (t: number[]) => items.reduce((sum, item) => sum + linesOf(item.heading, t[0], w - 40) * t[1] + (item.text ? linesOf(item.text, t[2], w - 40) * t[3] : 0) + t[4], 0)
    const t = pickTier(tiers, tier => need(tier) <= avail, step)
    boxes.push({
      type: 'list',
      key: 'points',
      style: { left: cx, width: w, top, fontSize: t[0], lineHeight: `${t[1]}px` },
      gap: t[4],
      subStyle: { fontSize: t[2], lineHeight: `${t[3]}px` },
      items: items.map((item, index) => ({
        key: `item.${index}`,
        heading: itemHeading(index, '', 'A point'),
        ...(item.text || editing ? { text: itemText(index, 'px', '') } : {}),
      })),
    })
  } else if (kind === 'exercise') {
    // The pill is words like the title's, edited in place (16 November). The rule for it, and for any later fixed word
    // a layout draws: an optional line in the slide's block; the default (`EXERCISE_TAG`) when the line is missing;
    // empty means none. An emptied pill is still drawn on the stage, so the caret can stay in it with the default as
    // its faint placeholder; slide.css hides it once the caret leaves. The other marks (numbers, dots, lines, the bar,
    // icons) carry no words.
    const tag = exerciseTagOf(data)
    if (tag || editing) boxes.push(text('tag', 'tag', 'tag', tag, EXERCISE_TAG, { left: cx }))
    const top = Math.max(196, heading(100, [46, 40, 34]) + 22)
    const gap = Math.min(72, (BOTTOM - top) / n)
    const fz = [27, 23, 20, 17][Math.min(3, (gap < 44 ? 2 : gap < 56 ? 1 : 0) + step)]
    items.forEach((_item, index) => {
      boxes.push({
        type: 'group',
        key: `step.${index}`,
        cls: 'es',
        style: { left: cx, width: cw, top: top + index * gap, fontSize: fz, lineHeight: `${fz + 7}px` },
        children: [
          { type: 'mark', key: 'n', cls: 'esn', text: String(index + 1), style: gap < 50 ? { width: 38, height: 38, fontSize: 18 } : undefined },
          itemHeading(index, '', 'A step'),
        ],
      })
    })
  } else if (kind === 'table') {
    const top = Math.max(128, heading(48, [40, 34, 30]) + 18)
    const rows = data.rows && data.rows.length ? data.rows : [['', ''], ['', '']]
    const columns = Math.max(1, ...rows.map(row => row.length))
    const colWidth = cw / columns - 32
    const rowHeight = (z: number) => rows.reduce((sum, row) => sum + Math.max(...Array.from({ length: columns }, (_, c) => linesOf(row[c], z, colWidth))) * z * 1.3 + (z < 17 ? 15 : 23), 0)
    const fs = pickTier([21, 18, 16, 14, 12], z => rowHeight(z) <= BOTTOM - top, step)
    boxes.push({
      type: 'table',
      key: 'table',
      style: { left: cx, width: cw, top, fontSize: fs },
      cellPadding: `${fs < 17 ? 7 : 11}px 16px`,
      columns,
      rows: rows.map((row, r) => ({
        key: `row.${r}`,
        cells: Array.from({ length: columns }, (_, c) => ({ path: `rows.${r}.${c}`, text: row[c] ?? '', head: r === 0 })),
      })),
    })
  } else if (kind === 'picture') {
    const top = Math.max(124, heading(48, [40, 34, 30]) + 14)
    const captionTop = 452
    boxes.push({ type: 'picture', key: 'picbox', cls: 'picbox', style: { left: cx, top, width: cw, height: captionTop - 14 - top }, image: data.image })
    boxes.push(text('subtitle', 'cap', 'subtitle', subtitle, 'A caption', { left: cx, width: cw, top: captionTop }))
  } else if (kind === 'columns') {
    const top = Math.max(160, heading(56, [44, 38, 32]) + 20)
    const w = (cw - 32) / 2
    const height = BOTTOM - top
    const z = pickTier([[23, 40], [20, 32], [17, 26], [15, 22], [13, 18]], t =>
      Math.max(...items.slice(0, 2).map(item => linesOf(item.text, t[0], w - 64) * t[1] + linesOf(item.heading, 30, w - 64) * 36), 0) + 64 <= height, step)
    items.slice(0, 2).forEach((_item, index) => {
      boxes.push({
        type: 'group',
        key: `column.${index}`,
        cls: 'cl',
        style: { left: cx + index * (w + 32), width: w, top, height, overflow: 'hidden' },
        children: [itemHeading(index, 'ch', 'Heading'), itemText(index, 'cx', 'One line each', { fontSize: z[0], lineHeight: `${z[1]}px` }, true)],
      })
    })
  } else if (kind === 'boxes') {
    const look = data.look || 'boxes'
    const top = Math.max(172, heading(56, narrow ? [38, 34, 30] : [44, 38, 32]) + 22)
    const avail = BOTTOM - top
    // A row when there is room; otherwise a grid of two rows, or of two columns beside a picture.
    const grid = narrow ? n > 2 || look !== 'boxes' : n > (look === 'boxes' ? 4 : 5)
    if (grid) {
      const cols = narrow ? (n > 1 ? 2 : 1) : Math.ceil(n / 2)
      const rows = Math.ceil(n / cols)
      const gap = 14
      const w = (cw - (cols - 1) * gap) / cols
      const rh = (avail - (rows - 1) * gap) / rows
      const hasMark = look !== 'boxes' || items.some(item => item.icon) || editing
      const markHeight = (t: number[]) => Math.max(...items.map(item => linesOf(item.heading, t[0], w - 36) * t[1] + linesOf(item.text, t[2], w - 36) * t[3]), 0)
      const small = 36 + (hasMark ? (look === 'boxes' ? 72 : 44) : 0) + markHeight([25, 31, 19, 26]) > rh || step > 0
      const tz = pickTier([[20, 25, 16, 21], [17, 21, 14, 18], [15, 19, 12, 16]], t => 24 + (hasMark ? 42 : 0) + markHeight(t) <= rh, Math.max(0, step - 1))
      items.forEach((_item, index) => {
        const mark: SlideBox | null = look === 'steps'
          ? { type: 'mark', key: 'gnm', cls: 'gnm', text: String(index + 1) }
          : look === 'line'
            ? { type: 'mark', key: 'gdt', cls: 'gdt' }
            : look === 'arrows'
              ? { type: 'mark', key: 'gar', cls: 'gar', icon: 'arrow-right' }
              : icon(index, small ? { width: 32, height: 32, marginBottom: 8 } : undefined, small)
        boxes.push({
          type: 'group',
          key: `box.${index}`,
          cls: look === 'boxes' ? 'bx' : 'bx alt',
          style: { left: cx + (index % cols) * (w + gap), width: w, top: top + Math.floor(index / cols) * (rh + gap), height: rh, padding: `${small ? 12 : 18}px 18px`, overflow: 'hidden' },
          children: [
            ...(mark ? [mark] : []),
            itemHeading(index, 'bh', 'Heading', small ? { fontSize: tz[0], lineHeight: `${tz[1]}px`, marginBottom: 4 } : undefined),
            itemText(index, 'bt', 'One line', small ? { fontSize: tz[2], lineHeight: `${tz[3]}px` } : undefined),
          ],
        })
      })
    } else {
      const longest = (t: number[]) => Math.max(...items.map(item => linesOf(item.heading, t[0], 140) * t[1] + linesOf(item.text, t[2], 140) * t[3]), 0)
      if (look === 'steps') {
        const w = (cw - (n - 1) * 16) / n
        if (n > 1) boxes.push({ type: 'mark', key: 'ln', cls: 'ln', style: { left: cx + w / 2, width: (n - 1) * (w + 16), top: top + 42 } })
        items.forEach((_item, index) => boxes.push({
          type: 'group', key: `box.${index}`, cls: 'spi', style: { left: cx + index * (w + 16), width: w, top: top + 8 },
          children: [{ type: 'mark', key: 'nm', cls: 'nm', text: String(index + 1) }, itemHeading(index, 'bh', 'Heading', stepped(step)), itemText(index, 'bt', 'One line', steppedText(step))],
        }))
      } else if (look === 'line') {
        const w = (cw - (n - 1) * 20) / n
        boxes.push({ type: 'mark', key: 'ln', cls: 'ln', style: { left: cx, width: cw, top: top + 28 } })
        items.forEach((_item, index) => boxes.push({
          type: 'group', key: `box.${index}`, cls: 'tli', style: { left: cx + index * (w + 20), width: w, top: top + 16 },
          children: [{ type: 'mark', key: 'dt', cls: 'dt' }, itemHeading(index, 'bh', 'Heading', stepped(step)), itemText(index, 'bt', 'One line', steppedText(step))],
        }))
      } else if (look === 'arrows') {
        const w = (cw + (n - 1) * 6) / n
        const height = Math.min(260, avail)
        boxes.push({
          type: 'group', key: 'arrows', cls: 'arws', style: { left: cx, top: top + 10, width: cw, height },
          children: items.map((_item, index) => ({
            type: 'group', key: `box.${index}`, cls: index === 0 ? 'arw first' : 'arw', style: { left: index * (w - 6), width: w, top: 0, height },
            children: [itemHeading(index, 'bh', 'Heading', stepped(step)), itemText(index, 'bt', 'One line', steppedText(step))],
          }) as GroupBox),
        })
      } else {
        const w = (cw - (n - 1) * 20) / n
        const height = Math.min(300, avail)
        const t = pickTier([[25, 31, 19, 26], [21, 27, 16, 22], [18, 23, 14, 19]], tier => longest(tier) + 120 <= height, step)
        items.forEach((_item, index) => {
          const mark = icon(index)
          boxes.push({
            type: 'group', key: `box.${index}`, cls: 'bx', style: { left: cx + index * (w + 20), width: w, top, height, overflow: 'hidden' },
            children: [
              ...(mark ? [mark] : []),
              itemHeading(index, 'bh', 'Heading', { fontSize: t[0], lineHeight: `${t[1]}px` }),
              itemText(index, 'bt', 'One line', { fontSize: t[2], lineHeight: `${t[3]}px` }),
            ],
          })
        })
      }
    }
  }
  return { boxes, known }
}

/** Steps, line and arrows draw their words at the CSS sizes; a measuring step makes them smaller. */
function stepped(step: number): BoxStyle | undefined {
  if (step === 0) return undefined
  const size = [25, 21, 18, 16][step]
  return { fontSize: size, lineHeight: `${size + 6}px` }
}

function steppedText(step: number): BoxStyle | undefined {
  if (step === 0) return undefined
  const size = [19, 16, 14, 13][step]
  return { fontSize: size, lineHeight: `${size + 6}px` }
}

/** Every text box in a layout, in drawing order (for tests and for the stage's keyboard moves). */
export function textBoxes(layout: SlideLayout): TextBox[] {
  const found: TextBox[] = []
  const visit = (box: SlideBox) => {
    if (box.type === 'text') found.push(box)
    else if (box.type === 'group') box.children.forEach(visit)
    else if (box.type === 'list') box.items.forEach(item => { found.push(item.heading); if (item.text) found.push(item.text) })
    // A table's cells, row by row, so the keyboard goes on from the title into the first cell (Codex on PR 2).
    else if (box.type === 'table') {
      box.rows.forEach(row => row.cells.forEach(cell => found.push({ type: 'text', key: cell.path, cls: '', path: cell.path, text: cell.text, placeholder: cell.head ? 'Heading' : '' })))
    }
  }
  layout.boxes.forEach(visit)
  return found
}

/** Where a box ends on the canvas, by its style (for the layout test: nothing below BOTTOM). */
export function estimatedBottom(box: SlideBox): number {
  const style = 'style' in box && box.style ? box.style : {}
  const top = typeof style.top === 'number' ? style.top : 0
  const height = typeof style.height === 'number' ? style.height : 0
  return top + height
}

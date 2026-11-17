/**
 * One picture editor (experience 49): a picture's size, alignment, crop and caption, kept beside its image line as a
 * Pandoc attribute block, the syntax the slide's `:::` blocks already use (`fencedDiv.ts`):
 *
 *   ![Team at work](images/team.jpg){width=50% align=center crop=16:9 zoom=1.25 focus=40,30}
 *
 * The file is never changed, and the Markdown stays readable: an app that doesn't know the block (GitHub, a plain
 * viewer) shows the picture whole, with the block's words after it; Pandoc and Quarto read `width` themselves. A picture
 * nobody touched has no block, and a block nobody touched is written back as it was read, byte for byte.
 *
 *  - `width`: a share of the column (`33%`, `50%`, `75%`, `100%`: S, M, L and Full in a document) or pixels on the
 *    960-wide slide (`180px`, `260px`, `400px`: S, M and L there; Full is `100%`).
 *  - `align`: `left`, `center` or `right`, for a picture narrower than its column.
 *  - `crop`: the frame's shape, `16:9`, `4:3`, `1:1`, `3:4` or a ratio (`1.42`); without it the picture keeps its own.
 *  - `zoom`: how far the frame is drawn into the picture (1 is the whole width or height the shape allows).
 *  - `focus`: what stays in view, as `x,y` in percent of the room left around the frame (50,50 is the middle). The
 *    slide's side places use the same point, from the slide's header (`focus:`).
 *  - `.caption`: the picture's description is shown under it.
 *
 * Crop, zoom and focus draw with CSS alone (`object-fit: cover`, `object-position`, `transform: scale` around the
 * focus), so the static renderers, the published page and the editors draw a crop the same way without knowing the
 * picture's own size. Any other key, class or id in the block is kept as written.
 *
 * Pure: no DOM, no `vscode`. The slide renderer and the page (host) and both editors (webview) import this one file.
 */
import { fenceAttributeValue, parseFenceAttributes, type FenceAttributes } from '../decks/blocks/fencedDiv';

export type PictureAlign = 'left' | 'center' | 'right';

/** What a picture's attribute block says about how it is drawn, read strictly (anything unreadable is left out). */
export interface PictureLook {
  width?: string;
  align?: PictureAlign;
  crop?: string;
  zoom?: number;
  focus?: { x: number; y: number };
  caption?: boolean;
}

/** The longest attribute block read as a picture's (a longer `{…}` after a picture stays words). */
const MAX_BLOCK = 400;

/** The block right after an image: `{`, no line break and no nested brace, `}`. */
export const PICTURE_BLOCK = /^\{[^{}\n\r]{0,398}\}/;

/** A picture's attribute block as its attributes, or null for a block this reader can't read (it stays words). */
export function parsePictureBlock(raw: string | null | undefined): FenceAttributes | null {
  if (!raw || raw.length > MAX_BLOCK || !PICTURE_BLOCK.test(raw) || PICTURE_BLOCK.exec(raw)?.[0] !== raw) return null;
  if (!raw.slice(1, -1).trim()) return null;
  return parseFenceAttributes(raw);
}

const WIDTH = /^(\d{1,4}(?:\.\d{1,2})?)(%|px)$/;
const RATIO = /^(\d{1,4}(?:\.\d{1,4})?)(?::(\d{1,4}(?:\.\d{1,4})?))?$/;
const FOCUS = /^(\d{1,3}(?:\.\d{1,2})?),(\d{1,3}(?:\.\d{1,2})?)$/;

/** A width this reader draws: 1–100 % or 24–4000 px; null otherwise. */
export function readWidth(value: string | undefined): string | null {
  const match = value ? WIDTH.exec(value.trim()) : null;
  if (!match) return null;
  const amount = Number(match[1]);
  if (match[2] === '%' ? amount <= 0 || amount > 100 : amount < 24 || amount > 4000) return null;
  return `${amount}${match[2]}`;
}

/** A frame shape (`16:9`, `1.42`) as width over height, between 1:10 and 10:1; null otherwise. */
export function readRatio(value: string | undefined): number | null {
  const match = value ? RATIO.exec(value.trim()) : null;
  if (!match) return null;
  const ratio = match[2] === undefined ? Number(match[1]) : Number(match[1]) / Number(match[2]);
  return Number.isFinite(ratio) && ratio >= 0.1 && ratio <= 10 ? ratio : null;
}

/** A focus point (`40,30`) in percent, each 0–100; null otherwise. */
export function readFocus(value: string | undefined): { x: number; y: number } | null {
  const match = value ? FOCUS.exec(value.trim().replace(/\s+/g, '')) : null;
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return x <= 100 && y <= 100 ? { x, y } : null;
}

/** A side picture's focus as the slide's header writes it (`focus: 40,30`), or null. */
export const readSideFocus = readFocus;

/** How a picture is drawn, from its attribute block as written (`{width=50%}`), or nothing for none. */
export function lookOf(raw: string | null | undefined): PictureLook {
  const attrs = parsePictureBlock(raw);
  if (!attrs) return {};
  const look: PictureLook = {};
  const width = readWidth(attrs.values.width);
  if (width) look.width = width;
  const align = attrs.values.align;
  if (align === 'left' || align === 'center' || align === 'right') look.align = align;
  if (readRatio(attrs.values.crop) !== null) look.crop = attrs.values.crop.trim();
  const zoom = Number(attrs.values.zoom);
  if (attrs.values.zoom !== undefined && Number.isFinite(zoom) && zoom > 1 && zoom <= 8) look.zoom = zoom;
  const focus = readFocus(attrs.values.focus);
  if (focus) look.focus = focus;
  if (attrs.classes.includes('caption')) look.caption = true;
  return look;
}

/** Is there anything to draw differently from a bare picture? */
export function isPlainLook(look: PictureLook): boolean {
  return !look.width && !look.align && !look.crop && !look.zoom && !look.focus && !look.caption;
}

function sameFocus(a: PictureLook['focus'], b: PictureLook['focus']): boolean {
  return (!a && !b) || (!!a && !!b && a.x === b.x && a.y === b.y);
}

/** Do two looks draw the same? */
export function sameLook(a: PictureLook, b: PictureLook): boolean {
  return (a.width ?? '') === (b.width ?? '') && (a.align ?? '') === (b.align ?? '') && (a.crop ?? '') === (b.crop ?? '')
    && (a.zoom ?? 1) === (b.zoom ?? 1) && sameFocus(a.focus, b.focus) && !!a.caption === !!b.caption;
}

/** A number as the block writes it: at most `digits` decimals, no trailing zeros. */
export function trimNumber(value: number, digits = 2): string {
  return String(Number(value.toFixed(digits)));
}

const PLAIN_VALUE = /^[\w.%:,-]+$/;

/**
 * The attribute block with the look set: the keys this editor owns changed in place, new ones added after the rest,
 * every other key, class and id kept as written. A block that already draws `look` comes back as it was, byte for
 * byte; '' when nothing is left (the picture is a bare image line again).
 */
export function withLook(raw: string | null | undefined, look: PictureLook): string {
  const current = parsePictureBlock(raw);
  if (current && sameLook(lookOf(raw), look)) return raw as string;
  if (!current && isPlainLook(look)) return '';
  const attrs: FenceAttributes = current ?? { classes: [], id: null, values: {} };
  const values: Record<string, string> = { ...attrs.values };
  const set = (key: string, value: string | undefined) => {
    if (value === undefined) delete values[key];
    else values[key] = value;
  };
  set('width', look.width);
  set('align', look.align);
  set('crop', look.crop);
  set('zoom', look.zoom && look.zoom > 1 ? trimNumber(look.zoom, 3) : undefined);
  set('focus', look.focus ? `${trimNumber(look.focus.x, 1)},${trimNumber(look.focus.y, 1)}` : undefined);
  const classes = attrs.classes.filter(name => name !== 'caption');
  if (look.caption) classes.unshift('caption');
  const parts = [
    ...(attrs.id ? [`#${attrs.id}`] : []),
    ...classes.map(name => `.${name}`),
    ...Object.entries(values).map(([key, value]) => `${key}=${PLAIN_VALUE.test(value) ? value : fenceAttributeValue(value)}`),
  ];
  return parts.length ? `{${parts.join(' ')}}` : '';
}

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

export type PictureContext = 'document' | 'slide';
export type PictureSize = 'S' | 'M' | 'L' | 'Full';
export const PICTURE_SIZES: readonly PictureSize[] = ['S', 'M', 'L', 'Full'];

/** S, M, L and Full: a third, a half, three quarters and the whole column in a document; 180, 260, 400 px and the
 *  content's width on the 960-wide slide. */
export const SIZE_WIDTHS: Record<PictureContext, Record<PictureSize, string>> = {
  document: { S: '33%', M: '50%', L: '75%', Full: '100%' },
  slide: { S: '180px', M: '260px', L: '400px', Full: '100%' },
};

/** Which size a width is, or null for a width between them (dragged) or none. */
export function sizeOf(width: string | undefined, context: PictureContext): PictureSize | null {
  if (!width) return null;
  for (const size of PICTURE_SIZES) if (SIZE_WIDTHS[context][size] === width) return size;
  return null;
}

/**
 * A width dragged with a corner handle, in the column's pixels: snapped to a size within a few pixels of it, written
 * as a share of the column in a document and as slide pixels on a slide (the column's own pixels there).
 */
export function draggedWidth(pixels: number, column: number, context: PictureContext): string {
  const clamped = Math.max(Math.min(pixels, column), Math.min(48, column));
  const snap = Math.max(8, column * 0.025);
  for (const size of PICTURE_SIZES) {
    const target = widthPixels(SIZE_WIDTHS[context][size], column);
    if (Math.abs(target - clamped) <= snap) return SIZE_WIDTHS[context][size];
  }
  if (context === 'slide') return `${Math.round(clamped)}px`;
  return `${Math.max(1, Math.min(100, Math.round((clamped / column) * 100)))}%`;
}

/** A width in the column's pixels. */
export function widthPixels(width: string, column: number): number {
  const match = WIDTH.exec(width);
  if (!match) return column;
  return match[2] === '%' ? (Number(match[1]) / 100) * column : Math.min(Number(match[1]), column);
}

// ---------------------------------------------------------------------------
// Crop: the frame as a region of the picture, and back
// ---------------------------------------------------------------------------

/** A part of the picture, each side a share (0–1) of its width or height. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WHOLE: Region = { x: 0, y: 0, w: 1, h: 1 };

/** Crop's shapes, Original first (the picture's own). */
export const CROP_PRESETS: readonly { label: string; ratio: string | null }[] = [
  { label: 'Original', ratio: null },
  { label: '16:9', ratio: '16:9' },
  { label: '4:3', ratio: '4:3' },
  { label: '1:1', ratio: '1:1' },
  { label: '3:4', ratio: '3:4' },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** The region a look shows of a picture whose own shape is `aspect` (width over height). */
export function regionOf(look: PictureLook, aspect: number): Region {
  const ratio = readRatio(look.crop) ?? aspect;
  const coverW = ratio >= aspect ? 1 : ratio / aspect;
  const coverH = ratio >= aspect ? aspect / ratio : 1;
  const zoom = look.zoom && look.zoom > 1 ? look.zoom : 1;
  const w = coverW / zoom;
  const h = coverH / zoom;
  const fx = (look.focus?.x ?? 50) / 100;
  const fy = (look.focus?.y ?? 50) / 100;
  return { x: fx * (1 - w), y: fy * (1 - h), w, h };
}

/** A ratio as the block writes it: a preset's name when it is one, else width over height. */
function ratioText(ratio: number): string {
  for (const preset of CROP_PRESETS) {
    const value = preset.ratio ? readRatio(preset.ratio) : null;
    if (value && Math.abs(value / ratio - 1) < 0.004) return preset.ratio as string;
  }
  return trimNumber(ratio, 3);
}

/**
 * The crop, zoom and focus that show `region` of a picture whose own shape is `aspect`. The whole picture is none of
 * them; the picture's own shape writes no `crop`.
 */
export function cropOfRegion(region: Region, aspect: number): Pick<PictureLook, 'crop' | 'zoom' | 'focus'> {
  const w = Math.max(0.02, Math.min(1, region.w));
  const h = Math.max(0.02, Math.min(1, region.h));
  const x = Math.max(0, Math.min(1 - w, region.x));
  const y = Math.max(0, Math.min(1 - h, region.y));
  let ratio = (w / h) * aspect;
  const own = Math.abs(ratio / aspect - 1) < 0.004;
  if (own) ratio = aspect;
  const coverW = ratio >= aspect ? 1 : ratio / aspect;
  const zoom = Number((coverW / w).toFixed(3));
  const fx = w < 0.999 ? clamp01(x / (1 - w)) : 0.5;
  const fy = h < 0.999 ? clamp01(y / (1 - h)) : 0.5;
  const out: Pick<PictureLook, 'crop' | 'zoom' | 'focus'> = {};
  if (!own) out.crop = ratioText(ratio);
  if (zoom > 1.0005) out.zoom = zoom;
  const focus = { x: Number((fx * 100).toFixed(1)), y: Number((fy * 100).toFixed(1)) };
  if ((out.crop || out.zoom) && (focus.x !== 50 || focus.y !== 50)) out.focus = focus;
  return out;
}

/** The largest region of shape `ratio` (null: the picture's own) inside the picture, centred where `around` was. */
export function presetRegion(ratio: string | null, aspect: number, around: Region = WHOLE): Region {
  const shape = (ratio ? readRatio(ratio) : null) ?? aspect;
  const w = shape >= aspect ? 1 : shape / aspect;
  const h = shape >= aspect ? aspect / shape : 1;
  const cx = around.x + around.w / 2;
  const cy = around.y + around.h / 2;
  return { x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - h, cy - h / 2)), w, h };
}

export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const CROP_HANDLES: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * The region after a crop handle moved by `dx`, `dy` (shares of the picture's width and height). With a shape chosen
 * (`ratio`), the frame keeps it: a corner moves both sides, a side handle grows the other way around the frame's middle.
 */
export function dragRegion(start: Region, handle: CropHandle, dx: number, dy: number, ratio: number | null, aspect: number, min = 0.05): Region {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (handle.includes('w')) left = Math.min(right - min, Math.max(0, left + dx));
  if (handle.includes('e')) right = Math.max(left + min, Math.min(1, right + dx));
  if (handle.includes('n')) top = Math.min(bottom - min, Math.max(0, top + dy));
  if (handle.includes('s')) bottom = Math.max(top + min, Math.min(1, bottom + dy));
  if (ratio === null) return { x: left, y: top, w: right - left, h: bottom - top };
  // The shape held: the frame's height follows its width (in the picture's shares, `ratio / aspect` apart).
  const share = ratio / aspect;
  let w = right - left;
  let h = bottom - top;
  if (handle === 'n' || handle === 's') w = h * share;
  else h = w / share;
  // Never past the picture: the frame shrinks until it fits.
  const anchorX = handle.includes('w') ? start.x + start.w : handle.includes('e') ? start.x : start.x + start.w / 2;
  const anchorY = handle.includes('n') ? start.y + start.h : handle.includes('s') ? start.y : start.y + start.h / 2;
  const roomW = handle.includes('w') ? anchorX : handle.includes('e') ? 1 - anchorX : 2 * Math.min(anchorX, 1 - anchorX);
  const roomH = handle.includes('n') ? anchorY : handle.includes('s') ? 1 - anchorY : 2 * Math.min(anchorY, 1 - anchorY);
  const fit = Math.min(1, roomW / w, roomH / h);
  w *= fit;
  h *= fit;
  const x = handle.includes('w') ? anchorX - w : handle.includes('e') ? anchorX : anchorX - w / 2;
  const y = handle.includes('n') ? anchorY - h : handle.includes('s') ? anchorY : anchorY - h / 2;
  return { x, y, w, h };
}

/** The region moved by `dx`, `dy`, never past the picture's edges (dragging inside the frame). */
export function moveRegion(start: Region, dx: number, dy: number): Region {
  return { ...start, x: Math.max(0, Math.min(1 - start.w, start.x + dx)), y: Math.max(0, Math.min(1 - start.h, start.y + dy)) };
}

// ---------------------------------------------------------------------------
// Drawing: the same CSS everywhere
// ---------------------------------------------------------------------------

/** Styles as CSS text, keys already kebab-case. */
export function cssText(style: Record<string, string>): string {
  return Object.entries(style).map(([key, value]) => `${key}:${value}`).join(';');
}

/** Does this look need a frame around the picture (a crop, a zoom or a caption)? */
export function hasFrame(look: PictureLook): boolean {
  return !!(look.crop || (look.zoom && look.zoom > 1) || look.caption);
}

/** The outer element's style: its width and where it sits (a block's margins, a slide's flex column's `align-self`). */
export function outerStyle(look: PictureLook): Record<string, string> {
  const style: Record<string, string> = {};
  if (look.width) {
    style.width = look.width;
    style['max-width'] = '100%';
  }
  if (look.align === 'center') Object.assign(style, { display: 'block', 'margin-left': 'auto', 'margin-right': 'auto', 'align-self': 'center' });
  else if (look.align === 'right') Object.assign(style, { display: 'block', 'margin-left': 'auto', 'margin-right': '0', 'align-self': 'flex-end' });
  else if (look.align === 'left') Object.assign(style, { 'margin-right': 'auto', 'align-self': 'flex-start' });
  // A picture alone and narrower than its place on a slide letterboxes on its own side as the fit shrinks it.
  if (!hasFrame(look) && look.align) style['object-position'] = `${look.align === 'center' ? 'center' : look.align} center`;
  return style;
}

/** The box that crops: its shape, and nothing outside it shown. */
export function boxStyle(look: PictureLook): Record<string, string> {
  const style: Record<string, string> = { display: 'block', position: 'relative', overflow: 'hidden' };
  const ratio = readRatio(look.crop);
  if (ratio !== null) style['aspect-ratio'] = trimNumber(ratio, 4);
  return style;
}

/** The picture inside the box: covering the box's shape, at its focus, drawn in by its zoom. */
export function innerStyle(look: PictureLook): Record<string, string> {
  const focus = `${trimNumber(look.focus?.x ?? 50, 1)}% ${trimNumber(look.focus?.y ?? 50, 1)}%`;
  const style: Record<string, string> = { display: 'block', width: '100%', 'max-width': 'none', 'max-height': 'none', margin: '0', 'border-radius': '0' };
  if (readRatio(look.crop) !== null) Object.assign(style, { height: '100%', 'max-height': 'none', 'object-fit': 'cover', 'object-position': focus });
  else Object.assign(style, { height: 'auto' });
  if (look.zoom && look.zoom > 1) Object.assign(style, { transform: `scale(${trimNumber(look.zoom, 3)})`, 'transform-origin': focus });
  return style;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

/**
 * A picture's `<img …>` (as a renderer wrote it) drawn with its look: a bare picture comes back as it was; a sized or
 * aligned one gets its style; a cropped, zoomed or captioned one is put in its frame (`span.pic`, the box, the caption).
 * `frameClass` names the frame for its place (`blk-pic` on a slide, so the slide's fit treats it as the picture);
 * `caption` is the description, already escaped as the renderer put it in `alt`.
 */
export function pictureMarkup(img: string, look: PictureLook, options: { frameClass?: string; caption?: string } = {}): string {
  if (isPlainLook(look) || !/^<img\s/i.test(img) || /\sstyle=/i.test(img)) return img;
  if (!hasFrame(look)) return img.replace(/^<img\s/i, `<img style="${cssText(outerStyle(look))}" `);
  const inner = img.replace(/^<img\s/i, `<img style="${cssText(innerStyle(look))}" `);
  const classes = ['pic', options.frameClass, look.caption ? 'has-caption' : ''].filter(Boolean).join(' ');
  const caption = look.caption && options.caption ? `<span class="pic-cap">${options.caption}</span>` : '';
  return `<span class="${escapeHtml(classes)}" style="${cssText({ display: 'block', ...outerStyle(look) })}"><span class="pic-box" style="${cssText(boxStyle(look))}">${inner}</span>${caption}</span>`;
}

// ---------------------------------------------------------------------------
// Reading the block in `marked`
// ---------------------------------------------------------------------------

/** marked's image token, with the block read after it. */
export interface ImageTokenWithLook {
  type: 'image';
  raw: string;
  href: string;
  title: string | null;
  text: string;
  /** The attribute block as written, when one followed the image. */
  picture?: string;
}

/**
 * The inline tokenizer every `marked` that reads pictures registers: a `{…}` straight after an image is the image's,
 * kept on the image token as written (`picture`), and draws nothing itself. A block it can't read stays words.
 */
export const pictureBlockTokenizer = {
  name: 'pictureBlock',
  level: 'inline' as const,
  tokenizer(src: string, tokens: { type: string }[]) {
    if (src[0] !== '{') return undefined;
    const previous = tokens[tokens.length - 1] as ImageTokenWithLook | undefined;
    if (!previous || previous.type !== 'image' || previous.picture !== undefined) return undefined;
    const match = PICTURE_BLOCK.exec(src);
    if (!match || !parsePictureBlock(match[0])) return undefined;
    previous.picture = match[0];
    return { type: 'pictureBlock', raw: match[0] };
  },
  renderer: () => '',
};

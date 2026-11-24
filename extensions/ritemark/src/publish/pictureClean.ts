import { TextDecoder } from 'node:util';

export type PictureCleanResult =
  | { kind: 'clean'; bytes: Buffer }
  | { kind: 'uncleanable' };

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_METADATA = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
const WEBP_IMAGE = new Set(['VP8 ', 'VP8L', 'ALPH']);
const WEBP_DISPLAY = new Set([...WEBP_IMAGE, 'ICCP', 'ANIM']);

/** Recognize raster pictures by their bytes even when the reference has no picture extension. */
export function hasPictureSignature(bytes: Buffer): boolean {
  const header = bytes.toString('latin1', 0, 6);
  return (bytes[0] === 0xff && bytes[1] === 0xd8) ||
    bytes.subarray(0, 8).equals(PNG) || header === 'GIF87a' || header === 'GIF89a' ||
    (bytes.toString('latin1', 8, 12) === 'WEBP' && header.startsWith('RIFF'));
}

/** Strip metadata without re-encoding image data. Unrecognized or unreadable containers fail closed. */
export function cleanPicture(bytes: Buffer): PictureCleanResult {
  let cleaned: Buffer | undefined;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) cleaned = cleanJpeg(bytes);
  else if (bytes.subarray(0, 8).equals(PNG)) cleaned = cleanPng(bytes);
  else if (bytes.toString('latin1', 0, 3) === 'GIF') cleaned = cleanGif(bytes);
  else if (bytes.toString('latin1', 8, 12) === 'WEBP') cleaned = cleanWebp(bytes);
  // BMP and ICO have no metadata container: they go as they are (a favicon.ico kept its place in 2.3).
  else if (isBmp(bytes) || isIco(bytes)) cleaned = bytes;
  else cleaned = cleanSvg(bytes);
  return cleaned ? { kind: 'clean', bytes: cleaned } : { kind: 'uncleanable' };
}

function isBmp(bytes: Buffer): boolean {
  return bytes.length >= 26 && bytes.toString('latin1', 0, 2) === 'BM' && bytes.readUInt32LE(2) === bytes.length;
}

function isIco(bytes: Buffer): boolean {
  return bytes.length >= 22 && bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1 && bytes.readUInt16LE(4) > 0;
}

/** Editors' own data in an SVG: Inkscape and Sodipodi keep local file paths (with the user's name) there. */
const EDITOR_PREFIX = /^(?:sodipodi|inkscape):/;
const EDITOR_ATTRIBUTE = /\s+(?:sodipodi|inkscape):[^\s=<>/"']+\s*=\s*(?:"[^"<]*"|'[^'<]*')/g;

/** Read only IFD0's orientation. No other tag, embedded thumbnail or original offset is copied. */
function exifOrientation(payload: Buffer): number | undefined {
  if (payload.toString('latin1', 0, 6) !== 'Exif\0\0' || payload.length < 14) return;
  const tiff = payload.subarray(6);
  const order = tiff.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') return;
  const u16 = (offset: number) => order === 'II' ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const u32 = (offset: number) => order === 'II' ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  if (u16(2) !== 42) return;
  const start = u32(4);
  if (start < 8 || start + 2 > tiff.length) return;
  const count = u16(start);
  if (start + 2 + count * 12 + 4 > tiff.length) return;
  for (let i = 0; i < count; i++) {
    const entry = start + 2 + i * 12;
    if (u16(entry) === 0x112 && u16(entry + 2) === 3 && u32(entry + 4) === 1) {
      const value = u16(entry + 8);
      if (value >= 1 && value <= 8) return value;
    }
  }
}

function orientationSegment(orientation: number): Buffer {
  // APP1, Exif identifier, big-endian TIFF, one SHORT entry, no next IFD.
  const segment = Buffer.from('ffe100224578696600004d4d002a00000008000101120003000000010000000000000000', 'hex');
  segment.writeUInt16BE(orientation, 28);
  return segment;
}

function jpegAppSegment(marker: number, payload: Buffer): Buffer | undefined {
  if (marker === 0xe0 && payload.length >= 14 && payload.toString('latin1', 0, 5) === 'JFIF\0') {
    // Keep the color-space marker and density, zero the thumbnail dimensions.
    return Buffer.concat([Buffer.from([0xff, marker, 0, 16]), payload.subarray(0, 12), Buffer.alloc(2)]);
  }
  if (marker === 0xee && payload.length >= 12 && payload.toString('latin1', 0, 5) === 'Adobe') {
    return Buffer.concat([Buffer.from([0xff, marker, 0, 14]), payload.subarray(0, 12)]);
  }
  if (marker === 0xe2 && payload.length >= 14 && payload.toString('latin1', 0, 12) === 'ICC_PROFILE\0') {
    return Buffer.concat([Buffer.from([0xff, marker, (payload.length + 2) >>> 8, (payload.length + 2) & 255]), payload]);
  }
}

function cleanJpeg(bytes: Buffer): Buffer | undefined {
  const parts = [bytes.subarray(0, 2)];
  let position = 2;
  let scanned = false;
  let orientationKept = false;
  while (position < bytes.length) {
    const start = position;
    if (bytes[position++] !== 0xff) return;
    while (bytes[position] === 0xff) position++;
    const marker = bytes[position++];
    if (marker === 0xd9) {
      if (!scanned) return;
      parts.push(bytes.subarray(start, position));
      return Buffer.concat(parts);
    }
    if (marker === 0x01) {
      parts.push(bytes.subarray(start, position));
      continue;
    }
    if (marker < 0xc0 || marker >= 0xd0 && marker <= 0xd8 || position + 2 > bytes.length) return;
    const length = bytes.readUInt16BE(position);
    const end = position + length;
    if (length < 2 || end > bytes.length) return;
    if (marker >= 0xe0 && marker <= 0xef) {
      const payload = bytes.subarray(position + 2, end);
      if (marker === 0xe1 && !orientationKept) {
        const orientation = exifOrientation(payload);
        if (orientation !== undefined) {
          parts.push(orientationSegment(orientation));
          orientationKept = true;
        }
      } else {
        const display = jpegAppSegment(marker, payload);
        if (display) parts.push(display);
      }
    } else if (marker !== 0xfe) {
      parts.push(bytes.subarray(start, end));
    }
    position = end;
    if (marker === 0xda) {
      // Progressive JPEGs can carry metadata between scans, too.
      scanned = true;
      while (position < bytes.length) {
        const ff = bytes.indexOf(0xff, position);
        if (ff < 0) return;
        let next = ff + 1;
        while (bytes[next] === 0xff) next++;
        const code = bytes[next];
        if (code !== 0 && !(code >= 0xd0 && code <= 0xd7)) {
          parts.push(bytes.subarray(end, ff));
          position = ff;
          break;
        }
        position = next + 1;
      }
    }
  }
}

function cleanPng(bytes: Buffer): Buffer | undefined {
  const parts = [bytes.subarray(0, 8)];
  let hasImageData = false;
  for (let start = 8; start + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(start);
    const end = start + length + 12;
    if (end > bytes.length) return;
    const type = bytes.toString('latin1', start + 4, start + 8);
    if (start === 8 && (type !== 'IHDR' || length !== 13)) return;
    if (!PNG_METADATA.has(type)) parts.push(bytes.subarray(start, end));
    if (type === 'IDAT') hasImageData = true;
    if (type === 'IEND') return hasImageData && length === 0 ? Buffer.concat(parts) : undefined;
    start = end;
  }
}

function cleanWebp(bytes: Buffer): Buffer | undefined {
  if (bytes.toString('latin1', 0, 4) !== 'RIFF' || bytes.readUInt32LE(4) + 8 > bytes.length) return;
  const end = bytes.readUInt32LE(4) + 8;
  const parts: Buffer[] = [Buffer.from(bytes.subarray(0, 12))];
  let hasImage = false;
  for (let start = 12; start < end;) {
    if (start + 8 > end) return;
    const size = bytes.readUInt32LE(start + 4);
    const next = start + 8 + size + (size & 1);
    if (next > end) return;
    const type = bytes.toString('latin1', start, start + 4);
    if (type === 'VP8X') {
      if (size !== 10) return;
      const header = Buffer.from(bytes.subarray(start, next));
      header[8] &= ~0x0c; // Clear EXIF and XMP presence flags.
      parts.push(header);
    } else if (type === 'ANMF') {
      // Animation frames contain their own chunk stream. Only display chunks belong there.
      if (size < 16) return;
      let frameHasImage = false;
      for (let chunk = start + 24; chunk < start + 8 + size;) {
        if (chunk + 8 > start + 8 + size) return;
        const id = bytes.toString('latin1', chunk, chunk + 4);
        const length = bytes.readUInt32LE(chunk + 4);
        if (!WEBP_IMAGE.has(id)) return;
        if (id !== 'ALPH') frameHasImage = true;
        chunk += 8 + length + (length & 1);
        if (chunk > start + 8 + size) return;
      }
      if (!frameHasImage) return;
      hasImage = true;
      parts.push(bytes.subarray(start, next));
    } else if (WEBP_DISPLAY.has(type)) {
      if (type === 'VP8 ' || type === 'VP8L') hasImage = true;
      parts.push(bytes.subarray(start, start + 8 + size));
      if (size & 1) parts.push(Buffer.alloc(1));
    }
    start = next;
  }
  if (!hasImage) return;
  const cleaned = Buffer.concat(parts);
  cleaned.writeUInt32LE(cleaned.length - 8, 4);
  return cleaned;
}

function gifSubBlocksEnd(bytes: Buffer, start: number): number | undefined {
  while (start < bytes.length) {
    const size = bytes[start++];
    if (size === 0) return start;
    start += size;
  }
}

function cleanGif(bytes: Buffer): Buffer | undefined {
  const version = bytes.toString('latin1', 0, 6);
  if (bytes.length < 13 || version !== 'GIF87a' && version !== 'GIF89a') return;
  const tableSize = (flags: number) => flags & 0x80 ? 3 * (2 << (flags & 7)) : 0;
  let position = 13 + tableSize(bytes[10]);
  const parts = [bytes.subarray(0, position)];
  let hasFrame = false;
  while (position < bytes.length) {
    const start = position;
    const kind = bytes[position++];
    if (kind === 0x3b) return hasFrame ? Buffer.concat([...parts, bytes.subarray(start, position)]) : undefined;
    let keep: boolean;
    if (kind === 0x2c) {
      if (position + 9 > bytes.length) return;
      position += 10 + tableSize(bytes[position + 8]); // Nine descriptor bytes, optional table, LZW code size.
      keep = hasFrame = true;
    } else if (kind === 0x21) {
      const label = bytes[position++];
      const app = bytes.toString('latin1', position + 1, position + 12);
      const loop = label === 0xff && bytes[position] === 11 && (app === 'NETSCAPE2.0' || app === 'ANIMEXTS1.0');
      keep = label === 0xf9 || label === 0x01 || loop;
      if (loop && (bytes[position + 12] !== 3 || bytes[position + 13] !== 1 || bytes[position + 16] !== 0)) return;
      if (label === 0xf9 && (bytes[position] !== 4 || bytes[position + 5] !== 0)) return;
    } else return;
    const end = gifSubBlocksEnd(bytes, position);
    if (end === undefined) return;
    if (keep) parts.push(bytes.subarray(start, end));
    position = end;
  }
}

/** Walk XML markup without changing the drawing, CDATA, attribute values, or namespace declarations. */
function cleanSvg(bytes: Buffer): Buffer | undefined {
  let svg: string;
  try {
    svg = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return;
  }
  if (svg.includes('\0')) return;
  const markup = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(\/?)([\p{L}_:][\p{L}\p{N}_.:\p{M}-]*)((?:\s+[^\s=<>/"']+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/uy;
  const stack: string[] = [];
  const parts: string[] = [];
  let root = false;
  let removedAt = -1;
  let keptFrom = 0;
  for (let position = 0;;) {
    const start = svg.indexOf('<', position);
    const text = svg.slice(position, start === -1 ? undefined : start);
    if (stack.length === 0 && text.trim()) return;
    if (start === -1) break;
    markup.lastIndex = start;
    const match = markup.exec(svg);
    if (!match) return; // Includes DTDs, which can inject markup through entity expansion.
    position = markup.lastIndex;
    const [token, closing, name, attributes, selfClosing] = match;
    if (!name) {
      if (token.startsWith('<![CDATA[') && stack.length === 0) return;
      if (token.startsWith('<!--') && removedAt < 0) {
        // Comments carry authoring notes ("Generator: …"); the drawing never needs them.
        parts.push(svg.slice(keptFrom, start));
        keptFrom = position;
        continue;
      }
      const encoding = /^<\?xml\s[\s\S]*?\bencoding\s*=\s*(['"])([^'"]+)\1/i.exec(token)?.[2];
      if (encoding && !/^utf-8$/i.test(encoding)) return;
      continue;
    }
    const localName = name.slice(name.lastIndexOf(':') + 1);
    if (closing) {
      if (attributes || selfClosing || stack.pop() !== name) return;
    } else {
      if (stack.length === 0) {
        if (root || localName !== 'svg') return;
        root = true;
      }
      if ((localName === 'metadata' || EDITOR_PREFIX.test(name)) && removedAt < 0) {
        removedAt = stack.length;
        parts.push(svg.slice(keptFrom, start));
      }
      if (!selfClosing) stack.push(name);
      if (removedAt < 0 && EDITOR_ATTRIBUTE.test(attributes)) {
        EDITOR_ATTRIBUTE.lastIndex = 0;
        parts.push(svg.slice(keptFrom, start), token.replace(EDITOR_ATTRIBUTE, ''));
        keptFrom = position;
      }
      EDITOR_ATTRIBUTE.lastIndex = 0;
    }
    if (removedAt === stack.length) {
      keptFrom = position;
      removedAt = -1;
    }
  }
  if (!root || stack.length !== 0) return;
  parts.push(svg.slice(keptFrom));
  return Buffer.from(parts.join(''), 'utf8');
}

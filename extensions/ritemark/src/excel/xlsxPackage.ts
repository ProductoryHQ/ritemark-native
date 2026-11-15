/**
 * Sprint 158 (#711): read an .xlsx package's parts, and write it again with only some parts changed.
 *
 * Reading goes through the Office preview's ZIP reader (`officePackageCheck`). Writing copies every part it isn't
 * told to change as it is: its local header, its compressed bytes and its data descriptor, byte for byte. Only a
 * replaced part is deflated again (node:zlib). A removed part is left out. The central directory is rebuilt with the
 * copied entries' records as they were, each pointing at its part's new offset.
 */
import { deflateRaw } from 'node:zlib';
import { readZipDirectory, readZipEntry, type ZipEntry } from '../officePreview/officePackageCheck';

const LOCAL_FILE = 0x04034b50;
const DIRECTORY_ENTRY = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;
const DATA_DESCRIPTOR = 0x08074b50;

export class PackageError extends Error {}

export interface XlsxPackage {
  bytes: Uint8Array;
  entries: ZipEntry[];
  byName: Map<string, ZipEntry>;
}

export function openPackage(bytes: Uint8Array): XlsxPackage {
  const entries = readZipDirectory(bytes);
  if (!entries) throw new PackageError('The file is not a readable workbook');
  if (entries.some((e) => e.flags & 0x1)) throw new PackageError('The workbook is encrypted');
  // The writer below keeps 32-bit offsets; a package that needs ZIP64 is far past what the editor opens.
  if (bytes.length >= 0xffffffff || entries.length >= 0xffff) throw new PackageError('The workbook is too large to save here');
  const byName = new Map<string, ZipEntry>();
  for (const e of entries) {
    if (byName.has(e.name)) throw new PackageError(`The workbook holds two parts named ${e.name}`);
    byName.set(e.name, e);
  }
  return { bytes, entries, byName };
}

/** A part's bytes; null when it isn't there. Throws when it is there but can't be read. */
export async function readPart(pkg: XlsxPackage, name: string): Promise<Uint8Array | null> {
  const entry = pkg.byName.get(name);
  if (!entry) return null;
  const data = await readZipEntry(pkg.bytes, entry);
  if (!data) throw new PackageError(`The part ${name} can't be read`);
  return data;
}

/** A part's text. XML parts in an .xlsx are UTF-8; one declared otherwise is refused rather than rewritten wrong. */
export async function readTextPart(pkg: XlsxPackage, name: string): Promise<string | null> {
  const data = await readPart(pkg, name);
  if (!data) return null;
  if ((data[0] === 0xff && data[1] === 0xfe) || (data[0] === 0xfe && data[1] === 0xff)) {
    throw new PackageError(`The part ${name} is not UTF-8`);
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
  const declared = /^﻿?<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/.exec(text);
  if (declared && !/^utf-?8$/i.test(declared[1])) throw new PackageError(`The part ${name} is not UTF-8`);
  return text;
}

export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function deflate(data: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => deflateRaw(data, { level: 6 }, (error, out) => (error ? reject(error) : resolve(out))));
}

let crcTable: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Where an entry's central-directory record is, and how long it is, found by walking the directory again. */
function directoryRecords(bytes: Uint8Array, count: number): Array<{ start: number; end: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === END_OF_DIRECTORY) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new PackageError('The workbook has no ZIP directory');
  let at = view.getUint32(eocd + 16, true);
  const out: Array<{ start: number; end: number }> = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== DIRECTORY_ENTRY) throw new PackageError('The workbook\'s ZIP directory is damaged');
    const end = at + 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    out.push({ start: at, end });
    at = end;
  }
  return out;
}

/**
 * The package with `replace`'s parts changed (a Uint8Array) or removed (null). Every other part keeps its local
 * header, compressed bytes and data descriptor exactly. Parts keep their order; no part is added.
 */
export async function rewritePackage(pkg: XlsxPackage, replace: ReadonlyMap<string, Uint8Array | null>): Promise<Uint8Array> {
  for (const name of replace.keys()) {
    if (!pkg.byName.has(name)) throw new PackageError(`The part ${name} isn't in the workbook`);
  }
  const { bytes, entries } = pkg;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = directoryRecords(bytes, entries.length);
  const chunks: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (let n = 0; n < entries.length; n++) {
    const entry = entries[n];
    const next = replace.get(entry.name);
    if (next === null) continue;
    const lh = entry.localHeaderOffset;
    if (view.getUint32(lh, true) !== LOCAL_FILE) throw new PackageError(`The part ${entry.name} is damaged`);
    const dataStart = lh + 30 + view.getUint16(lh + 26, true) + view.getUint16(lh + 28, true);

    if (next === undefined) {
      let end = dataStart + entry.compressedSize;
      if (entry.flags & 0x8) {
        // a data descriptor follows the data: CRC, sizes, with or without its signature
        end += end + 4 <= bytes.length && view.getUint32(end, true) === DATA_DESCRIPTOR ? 16 : 12;
      }
      if (end > bytes.length) throw new PackageError(`The part ${entry.name} is damaged`);
      chunks.push(bytes.subarray(lh, end));
      const record = new Uint8Array(bytes.subarray(records[n].start, records[n].end));
      new DataView(record.buffer).setUint32(42, offset, true);
      directory.push(record);
      offset += end - lh;
      continue;
    }

    const compressed = await deflate(next);
    const name = encodeText(entry.name);
    const flags = entry.flags & 0x800; // keep "the name is UTF-8"; no data descriptor
    const time = view.getUint16(lh + 10, true);
    const date = view.getUint16(lh + 12, true);
    const crc = crc32(next);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL_FILE, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, 8, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, next.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const record = new Uint8Array(46 + name.length);
    const rv = new DataView(record.buffer);
    rv.setUint32(0, DIRECTORY_ENTRY, true);
    rv.setUint16(4, 20, true);
    rv.setUint16(6, 20, true);
    rv.setUint16(8, flags, true);
    rv.setUint16(10, 8, true);
    rv.setUint16(12, time, true);
    rv.setUint16(14, date, true);
    rv.setUint32(16, crc, true);
    rv.setUint32(20, compressed.length, true);
    rv.setUint32(24, next.length, true);
    rv.setUint16(28, name.length, true);
    rv.setUint32(42, offset, true);
    record.set(name, 46);

    chunks.push(local, compressed);
    directory.push(record);
    offset += local.length + compressed.length;
  }

  const directorySize = directory.reduce((n, r) => n + r.length, 0);
  if (offset + directorySize >= 0xffffffff) throw new PackageError('The workbook is too large to save here');
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, END_OF_DIRECTORY, true);
  ev.setUint16(8, directory.length, true);
  ev.setUint16(10, directory.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + directorySize + end.length);
  let at = 0;
  for (const c of [...chunks, ...directory, end]) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Each part's stored bytes (local header through data descriptor), to compare two packages part by part. */
export function storedPart(pkg: XlsxPackage, name: string): Uint8Array | null {
  const entry = pkg.byName.get(name);
  if (!entry) return null;
  const view = new DataView(pkg.bytes.buffer, pkg.bytes.byteOffset, pkg.bytes.byteLength);
  const lh = entry.localHeaderOffset;
  let end = lh + 30 + view.getUint16(lh + 26, true) + view.getUint16(lh + 28, true) + entry.compressedSize;
  if (entry.flags & 0x8) end += end + 4 <= pkg.bytes.length && view.getUint32(end, true) === DATA_DESCRIPTOR ? 16 : 12;
  return pkg.bytes.subarray(lh, end);
}

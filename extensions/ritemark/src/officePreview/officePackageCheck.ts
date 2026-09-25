/**
 * Sprint 124 (#284) R5 — look at an Office file before any of it is sent to the
 * preview: its size, its container, and its ZIP directory.
 *
 * Without this the preview showed the ZIP library's raw text ("Can't find end
 * of central directory : is this a zip file ? If it is, see https://…"),
 * called a password-protected file "not a zip", and spent seconds inflating a
 * decompression bomb (renderer spike, defect 9). Bytes in, verdict out.
 *
 * Sprint 125 (#285) R5 — the directory's sizes are only what the file claims. A
 * part that declares 4 KiB and inflates to 512 MiB passed every check above, and
 * the webview's JSZip inflated all of it before noticing. So once the declared
 * sizes pass, each part is inflated here, capped at its declared size plus one
 * byte: a part that yields more (or less) than it declared is refused at once.
 */
import { inflateRaw } from 'node:zlib';

export const OFFICE_PREVIEW_LIMITS = {
  /** Largest file the preview opens. The webview receives it as base64, a third larger. */
  maxFileBytes: 50 * 1024 * 1024,
  maxEntries: 10_000,
  /** Largest total the package may unpack to. */
  maxUnpackedBytes: 400 * 1024 * 1024,
  /** A part this large, compressed more than `maxRatio` times, is a bomb. */
  bombPartBytes: 20 * 1024 * 1024,
  maxRatio: 100,
} as const;

export type PackageProblem =
  | { reason: 'too-large'; bytes: number }
  | { reason: 'password-protected' }
  | { reason: 'legacy-format' }
  | { reason: 'not-an-office-file' }
  | { reason: 'damaged' }
  | { reason: 'too-complex'; unpackedBytes: number }
  | { reason: 'wrong-kind' };

export type PackageVerdict = { ok: true } | ({ ok: false } & PackageProblem);

export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  /** 0 stored, 8 deflated; Office writes nothing else. */
  method: number;
  /** General-purpose flags; bit 0 marks an encrypted entry. */
  flags: number;
  localHeaderOffset: number;
}

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const LOCAL_FILE = 0x04034b50;
const END_OF_DIRECTORY = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_END = 0x06064b50;
const DIRECTORY_ENTRY = 0x02014b50;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

/** "EncryptedPackage" in UTF-16LE: the stream an encrypted Office file stores its package in. */
function hasEncryptedPackageStream(bytes: Uint8Array): boolean {
  const name = 'EncryptedPackage';
  const needle = new Uint8Array(name.length * 2);
  for (let i = 0; i < name.length; i++) needle[i * 2] = name.charCodeAt(i);
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * The ZIP central directory, read from the end of the file. Returns null when
 * there is no valid directory — a truncated or damaged file.
 */
export function readZipDirectory(bytes: Uint8Array): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  const u64 = (at: number) => Number(view.getBigUint64(at, true));

  // End of central directory: 22 bytes plus a comment of up to 65 535.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (u32(i) === END_OF_DIRECTORY) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  let count = u16(eocd + 10);
  let dirSize = u32(eocd + 12);
  let dirOffset = u32(eocd + 16);
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) {
    const locator = eocd - 20;
    if (locator < 0 || u32(locator) !== ZIP64_LOCATOR) return null;
    const end64 = u64(locator + 8);
    if (end64 + 56 > bytes.length || u32(end64) !== ZIP64_END) return null;
    count = u64(end64 + 32);
    dirSize = u64(end64 + 40);
    dirOffset = u64(end64 + 48);
  }
  if (dirOffset + dirSize > bytes.length) return null;

  const entries: ZipEntry[] = [];
  let at = dirOffset;
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || u32(at) !== DIRECTORY_ENTRY) return null;
    const flags = u16(at + 8);
    const method = u16(at + 10);
    let compressedSize = u32(at + 20);
    let uncompressedSize = u32(at + 24);
    const nameLength = u16(at + 28);
    const extraLength = u16(at + 30);
    const commentLength = u16(at + 32);
    let localHeaderOffset = u32(at + 42);
    const nameStart = at + 46;
    if (nameStart + nameLength + extraLength > bytes.length) return null;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      // ZIP64 values live in the extra field (id 0x0001), each only if its field above is
      // 0xffffffff, in this order: uncompressed, compressed, local header offset.
      let extra = nameStart + nameLength;
      const extraEnd = extra + extraLength;
      while (extra + 4 <= extraEnd) {
        const id = u16(extra);
        const size = u16(extra + 2);
        if (id === 0x0001) {
          let field = extra + 4;
          if (uncompressedSize === 0xffffffff) {
            uncompressedSize = u64(field);
            field += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = u64(field);
            field += 8;
          }
          if (localHeaderOffset === 0xffffffff) localHeaderOffset = u64(field);
          break;
        }
        extra += 4 + size;
      }
    }
    entries.push({ name, compressedSize, uncompressedSize, method, flags, localHeaderOffset });
    at = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

function inflateCapped(data: Uint8Array, maxOutputLength: number): Promise<number | null> {
  return new Promise((resolve) => {
    inflateRaw(data, { maxOutputLength }, (error, output) => resolve(error ? null : output.length));
  });
}

/**
 * Does every part hold what the directory says it holds? Each deflated part is
 * inflated in the extension host's thread pool, capped at its declared size plus
 * one byte, one part at a time, and the output is dropped. A part that yields a
 * different size, cannot be inflated, is encrypted or uses another method is a
 * package the webview must not receive.
 */
export async function verifyDeclaredSizes(bytes: Uint8Array, entries: readonly ZipEntry[]): Promise<boolean> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const entry of entries) {
    if (entry.flags & 0x1) return false;
    const at = entry.localHeaderOffset;
    if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL_FILE) return false;
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
    const end = start + entry.compressedSize;
    if (end > bytes.length) return false;
    if (entry.method === 0) {
      if (entry.compressedSize !== entry.uncompressedSize) return false;
    } else if (entry.method === 8) {
      const produced = await inflateCapped(bytes.subarray(start, end), entry.uncompressedSize + 1);
      if (produced !== entry.uncompressedSize) return false;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Is this a package the preview may open? `partPrefix` is the folder the
 * format keeps its parts in: `word/` for .docx, `ppt/` for .pptx.
 */
export async function checkOfficePackage(
  bytes: Uint8Array,
  partPrefix: string,
  limits: typeof OFFICE_PREVIEW_LIMITS = OFFICE_PREVIEW_LIMITS,
): Promise<PackageVerdict> {
  if (bytes.length > limits.maxFileBytes) return { ok: false, reason: 'too-large', bytes: bytes.length };
  if (startsWith(bytes, CFB_SIGNATURE)) {
    return { ok: false, reason: hasEncryptedPackageStream(bytes) ? 'password-protected' : 'legacy-format' };
  }
  if (bytes.length < 4 || new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true) !== LOCAL_FILE) {
    return { ok: false, reason: 'not-an-office-file' };
  }
  const entries = readZipDirectory(bytes);
  if (!entries) return { ok: false, reason: 'damaged' };

  let unpacked = 0;
  for (const entry of entries) {
    unpacked += entry.uncompressedSize;
    const ratio = entry.uncompressedSize / Math.max(1, entry.compressedSize);
    if (entry.uncompressedSize > limits.bombPartBytes && ratio > limits.maxRatio) {
      return { ok: false, reason: 'too-complex', unpackedBytes: entry.uncompressedSize };
    }
  }
  if (entries.length > limits.maxEntries || unpacked > limits.maxUnpackedBytes) {
    return { ok: false, reason: 'too-complex', unpackedBytes: unpacked };
  }
  const names = entries.map((e) => e.name);
  if (!names.includes('[Content_Types].xml')) return { ok: false, reason: 'not-an-office-file' };
  if (!names.some((n) => n.startsWith(partPrefix))) return { ok: false, reason: 'wrong-kind' };
  // Last, and only now that the declared sizes are within the limits: are they true?
  if (!(await verifyDeclaredSizes(bytes, entries))) return { ok: false, reason: 'damaged' };
  return { ok: true };
}

function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** What the preview says, for each problem. `appName` is where the user can open the file instead. */
export function describeProblem(problem: PackageProblem, kind: string, appName: string): { title: string; detail: string } {
  switch (problem.reason) {
    case 'too-large':
      return {
        title: `This ${kind} is too large to preview`,
        detail: `It is ${megabytes(problem.bytes)}; the preview opens files up to ${megabytes(OFFICE_PREVIEW_LIMITS.maxFileBytes)}. Open it in ${appName} to read it.`,
      };
    case 'password-protected':
      return {
        title: `This ${kind} is password-protected`,
        detail: `The preview can’t open protected files. Open it in ${appName} and enter the password there.`,
      };
    case 'legacy-format':
      return {
        title: 'This file is in an older Office format',
        detail: `The preview reads only the current format. Open it in ${appName} to read it, or save it again as a current file.`,
      };
    case 'not-an-office-file':
      return {
        title: `This file isn’t a ${kind}`,
        detail: 'Its name says so, but its contents are something else. Try opening it in the app that made it.',
      };
    case 'wrong-kind':
      return {
        title: `This file isn’t a ${kind}`,
        detail: 'It is an Office file of another kind with the wrong name. Try opening it in the app that made it.',
      };
    case 'damaged':
      return {
        title: `This ${kind} looks damaged`,
        detail: `Parts of it are missing or broken. ${appName} may be able to repair it.`,
      };
    case 'too-complex':
      return {
        title: `This ${kind} is too complex to preview safely`,
        detail: `It unpacks to ${megabytes(problem.unpackedBytes)} or more. Open it in ${appName} to read it.`,
      };
  }
}

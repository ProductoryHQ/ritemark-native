#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function isPortableExecutable(content) {
  if (content.length < 68 || content[0] !== 0x4d || content[1] !== 0x5a) return false;
  const peOffset = content.readInt32LE(0x3c);
  return peOffset >= 0 && peOffset + 4 <= content.length &&
    content[peOffset] === 0x50 && content[peOffset + 1] === 0x45 &&
    content[peOffset + 2] === 0x00 && content[peOffset + 3] === 0x00;
}

export function normalizePortableExecutableForAuthenticode(content) {
  if (!isPortableExecutable(content)) {
    throw new Error('content is not a Portable Executable');
  }

  const peOffset = content.readInt32LE(0x3c);
  const coffHeaderEnd = peOffset + 24;
  if (coffHeaderEnd > content.length) {
    throw new Error('truncated PE COFF header');
  }

  const numberOfSections = content.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = content.readUInt16LE(peOffset + 20);
  const optionalHeaderOffset = coffHeaderEnd;
  const optionalHeaderEnd = optionalHeaderOffset + optionalHeaderSize;
  if (optionalHeaderEnd > content.length) {
    throw new Error('truncated PE optional header');
  }

  const optionalMagic = content.readUInt16LE(optionalHeaderOffset);
  const dataDirectoryOffset = optionalMagic === 0x10b ? 96 : optionalMagic === 0x20b ? 112 : 0;
  const numberOfDirectoriesOffset = optionalMagic === 0x10b ? 92 : optionalMagic === 0x20b ? 108 : 0;
  if (!dataDirectoryOffset) {
    throw new Error(`unsupported PE optional-header magic 0x${optionalMagic.toString(16)}`);
  }

  const checksumOffset = optionalHeaderOffset + 64;
  const sizeOfHeadersOffset = optionalHeaderOffset + 60;
  const numberOfDirectoriesAbsolute = optionalHeaderOffset + numberOfDirectoriesOffset;
  const certificateDirectoryOffset = optionalHeaderOffset + dataDirectoryOffset + (4 * 8);
  if (checksumOffset + 4 > optionalHeaderEnd ||
      sizeOfHeadersOffset + 4 > optionalHeaderEnd ||
      numberOfDirectoriesAbsolute + 4 > optionalHeaderEnd ||
      certificateDirectoryOffset + 8 > optionalHeaderEnd) {
    throw new Error('PE optional header is too small for Authenticode fields');
  }
  if (content.readUInt32LE(numberOfDirectoriesAbsolute) < 5) {
    throw new Error('PE optional header has no Certificate Table directory entry');
  }

  const sectionTableOffset = optionalHeaderEnd;
  const sectionTableEnd = sectionTableOffset + (numberOfSections * 40);
  if (sectionTableEnd > content.length) {
    throw new Error('truncated PE section table');
  }

  let signedContentEnd = content.readUInt32LE(sizeOfHeadersOffset);
  if (signedContentEnd < sectionTableEnd || signedContentEnd > content.length) {
    throw new Error('invalid PE SizeOfHeaders');
  }
  for (let index = 0; index < numberOfSections; index += 1) {
    const sectionOffset = sectionTableOffset + (index * 40);
    const rawSize = content.readUInt32LE(sectionOffset + 16);
    const rawOffset = content.readUInt32LE(sectionOffset + 20);
    if (rawSize > content.length || rawOffset > content.length - rawSize) {
      throw new Error(`PE section ${index + 1} exceeds the file`);
    }
    signedContentEnd = Math.max(signedContentEnd, rawOffset + rawSize);
  }

  const certificateOffset = content.readUInt32LE(certificateDirectoryOffset);
  const certificateSize = content.readUInt32LE(certificateDirectoryOffset + 4);
  if ((certificateOffset === 0) !== (certificateSize === 0)) {
    throw new Error('incomplete PE Certificate Table directory entry');
  }
  if (certificateSize) {
    if (certificateOffset % 8 !== 0) {
      throw new Error('PE Certificate Table is not 8-byte aligned');
    }
    if (certificateOffset < signedContentEnd ||
        certificateOffset > content.length - certificateSize) {
      throw new Error('PE Certificate Table overlaps signed content or exceeds the file');
    }
  }

  // Authenticode may update the checksum and Certificate Table directory, and
  // add/remove only the Certificate Table itself. Retain all other bytes,
  // including PE overlay payloads used by packed or self-extracting runtimes.
  const normalized = Buffer.from(content);
  normalized.fill(0, checksumOffset, checksumOffset + 4);
  normalized.fill(0, certificateDirectoryOffset, certificateDirectoryOffset + 8);
  if (certificateSize) {
    return Buffer.concat([
      normalized.subarray(0, certificateOffset),
      normalized.subarray(certificateOffset + certificateSize),
    ]);
  }

  // SignTool aligns a newly appended WIN_CERTIFICATE to an 8-byte boundary.
  // Model that deterministic padding before signing so the identity remains
  // stable after the actual Certificate Table range is removed.
  const alignedLength = Math.ceil(normalized.length / 8) * 8;
  return alignedLength === normalized.length
    ? normalized
    : Buffer.concat([normalized, Buffer.alloc(alignedLength - normalized.length)]);
}

export function sha256Tree(root, { normalizeAuthenticode = false } = {}) {
  const absoluteRoot = path.resolve(root);
  if (!fs.statSync(absoluteRoot).isDirectory()) {
    throw new Error(`tree root is not a directory: ${root}`);
  }

  const hash = createHash('sha256');
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => (
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    ))) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(absoluteRoot, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);

      if (stat.isDirectory()) {
        hash.update(`directory\0${relative}\0`);
        walk(absolute);
      } else if (stat.isFile()) {
        hash.update(`file\0${relative}\0`);
        const content = fs.readFileSync(absolute);
        if (normalizeAuthenticode && isPortableExecutable(content)) {
          hash.update('authenticode-normalized\0');
          hash.update(normalizePortableExecutableForAuthenticode(content));
        } else {
          hash.update(content);
        }
        hash.update('\0');
      } else if (stat.isSymbolicLink()) {
        hash.update(`symlink\0${relative}\0${fs.readlinkSync(absolute)}\0`);
      } else {
        throw new Error(`unsupported filesystem entry in tree: ${relative}`);
      }
    }
  };

  walk(absoluteRoot);
  return hash.digest('hex');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const cliArgs = process.argv.slice(2);
  const normalizeAuthenticode = cliArgs[0] === '--normalize-authenticode';
  const directory = normalizeAuthenticode ? cliArgs[1] : cliArgs[0];
  if (!directory || cliArgs.length !== (normalizeAuthenticode ? 2 : 1)) {
    console.error('Usage: node scripts/tree-sha256.mjs [--normalize-authenticode] DIRECTORY');
    process.exit(2);
  }

  try {
    process.stdout.write(`${sha256Tree(directory, { normalizeAuthenticode })}\n`);
  } catch (error) {
    console.error(`TREE SHA-256 BLOCKED: ${error.message}`);
    process.exit(1);
  }
}

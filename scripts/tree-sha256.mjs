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

export function sha256Tree(root, { omitPortableExecutableBytes = false } = {}) {
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
        if (omitPortableExecutableBytes && isPortableExecutable(content)) {
          hash.update('portable-executable-bytes-covered-by-authenticode');
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
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/tree-sha256.mjs DIRECTORY');
    process.exit(2);
  }

  try {
    process.stdout.write(`${sha256Tree(process.argv[2])}\n`);
  } catch (error) {
    console.error(`TREE SHA-256 BLOCKED: ${error.message}`);
    process.exit(1);
  }
}

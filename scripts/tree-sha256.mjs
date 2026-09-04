#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function sha256Tree(root) {
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
        hash.update(fs.readFileSync(absolute));
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

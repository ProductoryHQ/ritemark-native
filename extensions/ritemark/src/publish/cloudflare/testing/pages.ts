/**
 * Real project pages for PR 4's tests (never imported by product code): a temporary project folder on disk, gathered
 * and scanned by PR 3's own `gatherPage`, so every publish in the tests goes the one way the product does, from a
 * `GatheredPlan` through `readVerifiedUpload`.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { gatherPage } from '../../gather';
import type { GatheredPlan } from '../../types';

export interface TestProject {
  /** The project folder, by real path. */
  dir: string;
  /** A page in it, by real path. */
  page(name?: string): string;
  write(rel: string, content: string | Uint8Array): Promise<void>;
  gather(name?: string): Promise<GatheredPlan>;
  cleanup(): Promise<void>;
}

/** The page the tests publish: a heading, a picture and a style. */
export const HARBOUR: Record<string, string | Uint8Array> = {
  'Harbour programme.html': '<link rel="stylesheet" href="style.css"><h1>Harbour</h1><img src="img/a.png">',
  'img/a.png': new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
  'style.css': 'body{color:#123}',
};

export async function testProject(files: Record<string, string | Uint8Array> = HARBOUR): Promise<TestProject> {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ritemark-pr4-')));
  const write = async (rel: string, content: string | Uint8Array) => {
    const file = path.join(dir, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };
  for (const [rel, content] of Object.entries(files)) await write(rel, content);
  const first = Object.keys(files).find((f) => f.endsWith('.html')) ?? 'index.html';
  const page = (name = first) => path.join(dir, name);
  return {
    dir,
    page,
    write,
    // No Git in a temporary folder: nothing is ignored
    gather: (name = first) => gatherPage(page(name), dir, { gitIgnored: async () => ({ ignored: new Set(), unchecked: new Set() }) }),
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  };
}

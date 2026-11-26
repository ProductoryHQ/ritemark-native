import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPagePath } from '../browser/localPage';
import { DECK_FONT_LIST, DECK_FONT_SUBSETS, DEFAULT_DECK_FONT, deckFontFile } from '../decks/deckTheme';
import { matchesLegacyDeckPage, PAGE_FONTS, pageFontName, readPageMeta } from '../decks/page/pageFile';
import { normalizeForCompare } from '../utils/pathIdentity';
import type { PublishRecord } from './publishRecords';
import { cssReferences, pageReferences } from './references';
import type { GatheredPlan } from './types';

const fontSources = new Map(PAGE_FONTS.map(({ file }): [string, string] => [file, file]));
for (const font of DECK_FONT_LIST) {
  if (font.name === DEFAULT_DECK_FONT) continue;
  for (const { subset } of DECK_FONT_SUBSETS) {
    fontSources.set(pageFontName(font, subset), deckFontFile(font, subset));
  }
}

function pageFiles(html: string, page: string): string[] {
  const { refs, base, inlineCss } = pageReferences(html);
  const origin = new URL(base ?? '', pathToFileURL(page));
  return [...refs, ...inlineCss.flatMap(cssReferences)].flatMap(({ value }) => {
    try {
      return [fileURLToPath(new URL(value, origin))];
    } catch {
      return [];
    }
  });
}

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

async function readPlainFile(file: string): Promise<Buffer | undefined> {
  if (!(await fs.lstat(file)).isFile()) return undefined;
  return fs.readFile(file);
}

/** Run under both page leases, once deployment and the record move have succeeded. */
export async function trashLegacyDeckFiles(
  record: PublishRecord,
  plan: GatheredPlan,
  currentAddresses: readonly string[],
  { extensionPath, trash, held }: { extensionPath: string; trash: (file: string) => Promise<void>; held?: (file: string) => boolean },
): Promise<void> {
  const page = record.pagePath;
  const folder = path.dirname(page);
  const publishedPage = record.files.find(file => isPagePath(file.path));
  if (!publishedPage) return;
  const publishedFolder = path.posix.dirname(publishedPage.path);
  const recorded = new Map(record.files.map(file => [path.posix.relative(publishedFolder, file.path), file.sha256]));
  const oldHtml = await readPlainFile(page).catch(() => undefined);
  const candidates = new Set(recorded.keys());
  if (oldHtml && readPageMeta(oldHtml.toString('utf8')).ritemark) {
    for (const file of pageFiles(oldHtml.toString('utf8'), page)) {
      candidates.add(path.relative(folder, file).split(path.sep).join('/'));
    }
  }
  // A sibling we cannot read may use any of these files. Check every page before taking anything back.
  const references = new Map<string, string[]>();
  for (const name of await fs.readdir(folder)) {
    if (!isPagePath(name)) continue;
    const sibling = path.join(folder, name);
    const stat = await fs.stat(sibling);
    if (!stat.isFile()) continue;
    const html = await fs.readFile(sibling, 'utf8');
    const files = pageFiles(html, sibling);
    const resolved = await Promise.all(files.map(file => fs.realpath(file).catch(() => file)));
    references.set(sibling, [...files, ...resolved].map(file => normalizeForCompare(file)));
  }
  if (await matchesLegacyDeckPage(page, publishedPage.sha256).catch(() => false)) {
    if (await trash(page).then(() => true, () => false)) references.delete(page);
  }
  const shared = new Set([...references.values()].flat());

  const currentFolder = path.dirname(plan.pagePath);
  const current = new Set(currentAddresses);
  for (const place of ['fonts', 'logos']) {
    const directory = path.join(folder, place);
    if (!(await fs.lstat(directory).catch(() => undefined))?.isDirectory()) continue;
    let removed = false;
    for (const address of candidates) {
      if (path.posix.dirname(address) !== place) continue;
      const name = path.posix.basename(address);
      const source = place === 'fonts' ? fontSources.get(name) : undefined;
      const logo = place === 'logos' ? /^logo-([0-9a-f]{16})\.(svg|png)$/.exec(name) : null;
      if (!source && !logo) continue;
      const file = path.join(directory, name);
      if (shared.has(normalizeForCompare(file))) continue;
      const bytes = await readPlainFile(file).catch(() => undefined);
      if (!bytes) continue;
      const sha = hash(bytes);
      const same = source
        ? (await fs.readFile(path.join(extensionPath, 'media', 'fonts', source)).catch(() => undefined))?.equals(bytes)
        : logo && sha.startsWith(logo[1]) && (sha === recorded.get(address) || (current.has(address)
          && (await readPlainFile(path.join(currentFolder, address)).catch(() => undefined))?.equals(bytes)));
      if (!same || held?.(file)) continue;
      removed = await trash(file).then(() => true, () => removed);
    }
    const entries = removed ? await fs.readdir(directory).catch(() => undefined) : undefined;
    if (entries?.length === 0) await trash(directory).catch(() => undefined);
  }
}

/**
 * Sprint 159: what the handout page carries besides the deck, read on the host.
 *
 *  - The slide's own rules, `slide/slide.css`, the file the deck view draws with: inlined into this bundle by
 *    esbuild's text loader (`esbuild.config.mjs`), so an extension release carries a change to it.
 *  - Sofia Sans, from the app's own `media/fonts/`, found through the extension's folder (bundle-safe: no
 *    `__dirname`). The page carries both files as data URLs, so it needs nothing from the web.
 *
 * Kept apart from `pageFile.ts` and `pageHtml.ts` because Node can't import a `.css` file: their tests read the same
 * two files from disk and pass them in.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import slideCss from '../../../webview/src/components/decks/slide/slide.css';
import type { PageAssets } from './pageHtml';
import { PAGE_FONTS } from './pageFile';

let cached: Promise<PageAssets> | null = null;

/** The page's CSS and fonts, read once per window. */
export function loadPageAssets(extensionPath: string): Promise<PageAssets> {
  cached ??= (async () => ({
    slideCss,
    fonts: await Promise.all(PAGE_FONTS.map(async font => ({
      base64: (await fs.promises.readFile(path.join(extensionPath, 'media', 'fonts', font.file))).toString('base64'),
      unicodeRange: font.unicodeRange,
    }))),
  }))();
  // A failed read is tried again next time, not remembered.
  cached.catch(() => { cached = null; });
  return cached;
}

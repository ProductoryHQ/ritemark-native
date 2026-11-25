import { readdirSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

const fonts = new URL('../../../media/fonts/', import.meta.url);
const fontData = Object.fromEntries(readdirSync(fonts).filter(name => name.endsWith('.woff2')).map(name =>
  [name, 'data:font/woff2;base64,' + readFileSync(new URL(name, fonts)).toString('base64')]));

await build({
  entryPoints: [new URL('./quickLookDeck.ts', import.meta.url).pathname],
  outfile: process.argv[2],
  bundle: true,
  format: 'iife',
  globalName: 'QuickLookDeck',
  target: 'safari15',
  loader: { '.css': 'text' },
  define: { QUICK_LOOK_FONTS: JSON.stringify(fontData) },
  plugins: [{
    name: 'omit-publish-digest',
    setup(api) {
      // PublicDeck parses and draws without the publishing-only digest.
      api.onResolve({ filter: /^node:crypto$/ }, () => ({ path: 'crypto', namespace: 'quick-look' }));
      api.onLoad({ filter: /.*/, namespace: 'quick-look' }, () => ({
        contents: 'export function createHash() { throw new Error("Publishing digests are unavailable in Quick Look"); }',
      }));
    },
  }],
});

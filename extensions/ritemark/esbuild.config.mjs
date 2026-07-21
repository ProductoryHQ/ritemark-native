// Sprint 92 (#105) — extension host bundling.
// Replaces the old `tsc -p ./` emit (which produced ~130 loose out/*.js files, the
// root cause of the Windows EMFILE class, the v1.7.1 0-byte-tsc trap, and DMG bloat)
// with two self-contained esbuild bundles. Type-checking is preserved separately via
// `tsc --noEmit` in the `compile` script — esbuild strips types without checking them.
//
// See docs/development/sprints/sprint-92-esbuild-bundling/ (spec R1-R11) and
// notes/require-audit.md for why the externals below are what they are.
import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const watch = process.argv.includes('--watch');

// Must NOT be inlined into the bundle (see notes/require-audit.md):
// - vscode:   provided by the extension host at runtime.
// - fsevents: native, macOS-only, optional file-watching dep (transitive).
// - the two ESM-only agent SDKs: loaded at runtime via `new Function('return import(...)')`
//   (AgentRunner.ts, acpClient.ts) — esbuild can't see them; they resolve from node_modules.
// - pdfkit:   reads its built-in font `.afm` data files from its own package dir at
//   runtime; bundling its JS breaks that resolution. node_modules stays for the ESM SDKs
//   anyway. Re-evaluate the full inline/external split against export QA (tasks T4-2).
//
// Sprint 98: EXPORTED so publish-side guards can read the real array instead of
// regex-scraping this file. `scripts/check-bundled-extension-complete.sh` asserts
// every entry here (except `vscode`, which the host provides) actually exists in
// the BUNDLED extension's node_modules — the 1.8.3-ext.1 incident was a missing
// `pdfkit` at module load. Importing this file must therefore stay side-effect
// free; the build only runs when the file is the process entry point (below).
export const external = [
  'vscode',
  'fsevents',
  '@anthropic-ai/claude-agent-sdk',
  '@agentclientprotocol/sdk',
  'pdfkit',
];

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: {
    // package.json "main"
    'extension': 'src/extension.ts',
    // Standalone subprocess spawned by BrowserToolsInjector (its own bundle, never
    // inlined — a child process can't require() code loaded in the host process).
    'browser/browserMcpAdapter': 'src/browser/browserMcpAdapter.ts',
  },
  outdir: 'out',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20', // VS Code 1.117 / Electron ships Node 20.x (prod build prerequisite)
  sourcemap: true,
  external,
  logLevel: 'info',
  // CJS format => no code-splitting => each entry is fully self-contained (browserMcpAdapter
  // stays standalone, no shared chunk with extension.js).
};

// Only build when this file is the entry point (`node esbuild.config.mjs`), so that
// `import { external } from './esbuild.config.mjs'` is a pure read.
const isEntryPoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('[esbuild] watching for changes…');
  } else {
    await esbuild.build(options);
    console.log('[esbuild] build complete');
  }
}

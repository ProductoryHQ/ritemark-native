# Phase 0 Audit — dynamic require/import + native deps (R5, T0-1/T0-2)

**Date:** 2026-07-08 · **Branch:** sprint-92-esbuild-bundling · **Status:** complete, no scope change needed.

This is the mandatory audit-first artifact. It determines the esbuild `external` list and answers the Open Question "can esbuild inline all of `node_modules`?".

## T0-1 — dynamic require / import call sites

Method: `grep -rnE` over `extensions/ritemark/src/**` (excluding `*.test.ts`) for `__dirname`/`__filename`, dynamic `import()`, and non-literal `require()`.

### (a) `__dirname`-relative path math → the two known R3 landmines, NO others
- `runtime/BrowserToolsInjector.ts:29` — `path.join(__dirname, '..', 'browser', 'browserMcpAdapter.js')` — R3 landmine #2.
- `utils/bundledAgentRuntime.ts:53` — `extensionRootFrom(__dirname)` (`resolve(dir,'..','..')`) — R3 landmine #1.
- **No other `__dirname`/`__filename` usages exist.** R3's two-landmine scope is confirmed complete.

### (b) Visible dynamic `import()` — esbuild CAN see these → bundled normally
- `ritemarkEditor.ts:1632,1696,1749` — `await import('./voiceDictation/modelManager')` (first-party, relative).
- `settings/RitemarkSettingsProvider.ts:1243` — `await import('../codex/codexManager')` (first-party, relative).
- `settings/RitemarkSettingsProvider.ts:983` — `await import('openai')` (third-party, pure JS).
These are ordinary `await import(...)` — esbuild inlines them into the bundle (single-file, no code-splitting). No action needed beyond confirming they resolve post-bundle.

### (c) `new Function('return import(specifier)')`-wrapped loads — esbuild CANNOT see these → MUST stay external ⚠️
The load-bearing finding. Two **ESM-only** SDKs are loaded at runtime through a `new Function` wrapper specifically to preserve a real `import()` (TypeScript would otherwise transform `import()` → `require()`, which fails on ESM):
- `agent/AgentRunner.ts:39-42` — `dynamicImport('@anthropic-ai/claude-agent-sdk')`.
- `acp/acpClient.ts:38-41` — `dynamicImport('@agentclientprotocol/sdk')`.

Because these specifiers live inside a `new Function` string, esbuild never sees them. It will NOT bundle them, and they will be resolved from `node_modules` at runtime. **Therefore `@anthropic-ai/claude-agent-sdk` and `@agentclientprotocol/sdk` (and their transitive deps) must remain present in the shipped `node_modules`.** (The related `new Function('return require(name)')` comments in `utils/runtimeTrace.ts`, `acp/acpFsProxy.ts`, `acp/acpClient.ts` all resolve `vscode`, which is external regardless.)

## T0-2 — native / binary dependencies

`find extensions/ritemark/node_modules -name "*.node" -o -name "binding.gyp"` → **one** result: `fsevents/fsevents.node` (macOS-only optional file-watching dep, transitive). Mark `fsevents` external; it is never loaded on Windows and is optional on macOS.

## Design decisions this audit settles

1. **esbuild `external` list** (for the `out/extension.js` entry): `['vscode', 'fsevents', '@anthropic-ai/claude-agent-sdk', '@agentclientprotocol/sdk', 'pdfkit']`. The two ESM agent SDKs need no explicit `external` entry to be *reachable* (esbuild can't see their `new Function`-wrapped import) but are listed anyway for clarity, and MUST NOT be deleted from `node_modules`. `pdfkit` is explicitly external — see below.
2. **Open Question RESOLVED — node_modules does NOT fully collapse.** esbuild inlines the pure-JS statically/visibly-imported deps (openai, docx, xlsx, marked, gray-matter, papaparse, turndown(+gfm), zod, cron-parser, node-html-parser, posthog-node, ajv, ajv-formats), but the shipped extension must retain `node_modules/@anthropic-ai/claude-agent-sdk`, `node_modules/@agentclientprotocol/sdk` (+ their transitive deps), `fsevents`, **and `pdfkit`** (it reads its built-in font `.afm` data files from its own package directory at runtime via a path relative to its own module location — bundling its JS would break that resolution, so it stays external same as the ESM SDKs). So the packaging shrinks massively but not to zero.
3. **Impact on R7 / sprint-93 packaging:** the "file list collapses from ~130 to ~3" framing is optimistic. Corrected: the manifest is `out/extension.js` + `out/browser/browserMcpAdapter.js` + `media/webview.js` + `package.json` + **the retained `node_modules` subtree for the two ESM SDKs (+ fsevents)**. Still a huge reduction (the ~130 first-party loose files + most transitive deps collapse), but sprint-93's `release-extension.sh` must enumerate the retained node_modules subtree, not assume 3 files. Flagged for sprint-93.

## T0-3 — scope-change checkpoint

**No scope change needed.** The findings refine the esbuild config (externals) and correct a downstream packaging assumption; they do NOT expand the code-change surface beyond the plan (still: esbuild config + the two R3 `__dirname` fixes + validation/doc/harness updates). Proceed to Phase 1.

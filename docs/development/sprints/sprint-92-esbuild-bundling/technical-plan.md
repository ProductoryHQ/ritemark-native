# Sprint 92: esbuild Extension Host Bundling — Technical Plan

Architecture, file-level changes, and verified current-state findings. Requirement IDs reference `spec.md`.

---

## Current state (verified in-repo)

### Build config
- `extensions/ritemark/package.json`: `"main": "./out/extension.js"`. `scripts.compile` = `"tsc -p ./"`. `scripts.watch` = `"tsc -watch -p ./"`. No `esbuild` devDependency exists today — must be added.
- `extensions/ritemark/tsconfig.json`: `{ module: commonjs, target: ES2020, outDir: out, rootDir: src, lib: [ES2020, DOM], strict: true, esModuleInterop: true, skipLibCheck: true }`, `exclude: [node_modules, out, webview, media, src/**/*.test.ts, scripts]`.
- `extensions/ritemark/out/`: confirmed 260 files matching `out/**` (mix of `.js` + `.js.map`; ~130 `.js` files) across subdirectories `settings/`, `voiceDictation/`, `update/`, `codex/`, `features/`, `runtime/`, `utils/`, `agent/`, `acp/`, `browser/`, `flows/`, `ai/`, `views/`, `export/`, plus flat files in `out/` root (`extension.js`, `ritemarkEditor.js`, `docxEditorProvider.js`, `pdfEditorProvider.js`, `excelEditorProvider.js`, `drawioEditorProvider.js`, `docxDocument.js`, `excelDocument.js`, `pdfDocument.js`, `internalLinkResolver.js`, `workspaceFileLinks.js`).

### Runtime-loaded vs transitive-only dependencies
- `dependencies` in `package.json`: `@agentclientprotocol/sdk`, `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/sdk` (local `file:` stub in `npm-stubs/anthropic-ai-sdk`), `@modelcontextprotocol/sdk` (local `file:` stub in `npm-stubs/modelcontextprotocol-sdk`), `ajv`, `ajv-formats`, `cron-parser`, `docx`, `gray-matter`, `marked`, `node-html-parser`, `openai`, `papaparse`, `pdfkit`, `posthog-node`, `turndown`, `turndown-plugin-gfm`, `xlsx`, `zod`. All appear to be pure-JS packages (no `.node` native binaries) on first inspection — CONFIRM via R5's audit command before finalizing the "inline everything" design decision.
- The `npm-stubs/` packages (`anthropic-ai-sdk`, `modelcontextprotocol-sdk`) are intentional peer-dependency stubs for `@anthropic-ai/claude-agent-sdk` (see project memory: "v1.7.2 dep-tree bloat fixed via `file:` peer stubs"). These are real files on disk under `extensions/ritemark/npm-stubs/`, referenced via `file:` protocol in `package.json` — esbuild will resolve and can inline them like any other dependency; no special handling expected, but verify the stub's `package.json`/`index.js` shape doesn't do anything bundler-hostile (e.g. conditional `require` based on `__dirname`) during R5's audit.
- Bundled agent binaries (`claude`, `codex-app-server`, `opencode`, plus platform variants) ship via `binaries/agents/**`, resolved at runtime by `bundledAgentRuntime.ts` — NOT via `node_modules`, NOT part of the JS dependency graph, unaffected by bundling except for the path-resolution fix in R3.

### Confirmed path-resolution landmines (R3)

**Landmine 1 — `extensions/ritemark/src/utils/bundledAgentRuntime.ts:53`:**
```typescript
const extensionRoot = options?.extensionRoot ?? extensionRootFrom(__dirname);
// extensionRootFrom(startDir) = resolve(startDir, '..', '..')
```
Today: `bundledAgentRuntime.js` compiles to `out/utils/bundledAgentRuntime.js` — two levels below extension root — so `resolve(out/utils, '..', '..')` = extension root. Correct today.

Under R1's bundle: this module's code lives inside `out/extension.js` — ONE level below extension root. If `__dirname` inside the bundle still resolves to `out/` (the expected esbuild/CJS behavior — `__dirname` reflects the OUTPUT file's location, not the original source file's), then `resolve(out/, '..', '..')` walks past the extension root into its PARENT's parent — silently wrong, and `findBundledAgentRuntime()` returns `null` for every kind, breaking Claude Code, Codex, and OpenCode runtime discovery simultaneously.

Confirmed callers with NO `extensionRoot` override (all break if unfixed):
- `agent/setup.ts:152` — `findBundledAgentRuntime('claude', { platform })`
- `codex/codexManager.ts:133,142` — `findBundledAgentRuntime('codex-app-server')`, `findBundledAgentRuntime('codex-cli')`
- `acp/AcpRuntime.ts:74,165` — `findBundledAgentRuntime('opencode')`

**Landmine 2 — `extensions/ritemark/src/runtime/BrowserToolsInjector.ts:29`:**
```typescript
const adapterPath = path.join(__dirname, '..', 'browser', 'browserMcpAdapter.js');
```
Same class of bug. Today `__dirname` = `out/runtime/`, one level below extension root, so `join(out/runtime, '..', 'browser', ...)` = `out/browser/browserMcpAdapter.js` — correct today, and this happens to be the SAME output path R2 targets for the standalone adapter bundle, which is a useful design constraint (see Design below).

### `browserMcpAdapter.ts` — confirmed standalone entry point (R2)

`src/browser/browserMcpAdapter.ts` file header (verified, lines 1-14): "Standalone MCP stdio server subprocess... Zero external dependencies — Node.js built-ins only... NOT imported by any other module — it is the entry point for the subprocess." Spawned via `BrowserToolsInjector.ts`: `{ command: process.execPath, args: [adapterPath] }` — i.e. `node <adapterPath>`, a genuinely separate OS process, not an in-process `require()`. A grep for dynamic `require(\`...\`)`/`import(\`...\`)` patterns across `extensions/ritemark/src/**` found **zero** additional matches beyond these two files — the audit surface is small and already largely mapped.

### Validation script gaps (R6)

`scripts/validate-build-output.sh` line 144:
```bash
check_file_size "$EXT_PATH/out/ritemarkEditor.js" 1000 "ritemarkEditor.js"
```
This assumes `out/ritemarkEditor.js` exists as a standalone file. Under R1's bundling, `ritemarkEditor.ts`'s compiled code lives inside `out/extension.js` — this specific file will not exist. MUST be replaced or removed.

`.claude/hooks/pre-commit-validator.sh` Check 7 (line 79-84) runs `npm run compile --silent` and only checks the exit code — no hardcoded path/file-count assumption. No change needed structurally; re-verify it still passes post-bundling.

### `scripts/create-extension-release.sh` staleness (R7, evidence for the Problem statement)

Confirmed via direct comparison: the script's hardcoded `FILES` variable (lines 117-141) lists `out/excelEditor.js` (real file: `out/excelEditorProvider.js`), `out/aiProvider.js` and `out/commands/index.js` (grep for `aiProvider`/`commands/index` across all `.ts` sources: zero matches — these modules do not exist in the current codebase at all, likely removed in an earlier refactor), and omits ~100 real current `out/**` files (`out/codex/**`, `out/agent/**`, `out/acp/**`, `out/browser/**`, `out/flows/**`, `out/features/**`, `out/runtime/**`, `out/ai/**`, `out/views/**`, `out/settings/**`, `out/voiceDictation/**`, `out/utils/**`, `out/docxDocument.js`, `out/excelDocument.js`, `out/workspaceFileLinks.js`, `out/internalLinkResolver.js`, `out/drawioEditorProvider.js`, `out/docxEditorProvider.js`, `out/pdfEditorProvider.js`, `out/pdfDocument.js`). This script is not invoked by any current CI workflow or `release` skill step (grep confirms) — it is dead-but-present code that would fail badly if run today. R1's bundling is what makes a correct, low-maintenance version of this script tractable (see sprint-93 for the actual fix).

### Extension directory versioning at startup (context for R1, not this sprint's scope)

`branding/product.json`'s `dataFolderName: ".ritemark"` is VS Code core's standard user-data-folder config key — it is the SAME mechanism that (renamed) determines where VS Code's own built-in "user-installed extensions" directory lives. This strongly suggests `~/.ritemark/extensions/ritemark-{version}/` (per `userExtensionInstaller.ts`) is not custom Ritemark loader logic but VS Code core's OWN standard extension-directory scanner, which already knows how to pick the highest-compatible-version directory when multiple installs of the same extension ID coexist (standard VS Code marketplace-extension-update behavior). No patch file references a custom extensions-dir scanner (grep of `patches/**` for `userExtensionsDir`/`scanUserExtensions` returns nothing). This is background confirming R1's bundling doesn't interact with this mechanism — noted here so sprint-93 doesn't have to re-derive it.

---

## Design

### A. Two esbuild entry points, not one

```
extensions/ritemark/esbuild.config.mjs   (new)
  entryPoints:
    - src/extension.ts             → out/extension.js          (R1)
    - src/browser/browserMcpAdapter.ts → out/browser/browserMcpAdapter.js  (R2)
  bundle: true
  platform: 'node'
  format: 'cjs'
  target: 'node20'      // matches the Node v20.x arm64 production build prerequisite — confirm exact minor at implementation time
  sourcemap: true
  external: ['vscode']  // extension.ts entry only; browserMcpAdapter.ts has zero deps, external list is moot for it
  outdir / outfile: per entry point, matching the paths above
```

Two separate bundles (not one with code-splitting) because `browserMcpAdapter.js` must be launchable as `node <path>` in complete isolation — a single shared-chunk bundle would require the adapter to `require()` a shared chunk file, reintroducing exactly the "sibling file must exist and be found" fragility this sprint removes. Since `browserMcpAdapter.ts` already declares zero external dependencies, its bundle is small and this costs nothing.

### B. `package.json` script changes

```json
"scripts": {
  "compile": "tsc --noEmit -p ./ && node esbuild.config.mjs",
  "watch": "node esbuild.config.mjs --watch"
}
```
`tsc --noEmit` satisfies R4 (type-checking preserved, separate from emit) using the SAME `tsconfig.json` (no duplicate type config to drift). The `esbuild.config.mjs` script performs the actual emit for both entry points. `npm run compile` remains the single command both `pre-commit-validator.sh` Check 7 and CI depend on — no caller-side changes needed elsewhere.

### C. Path-resolution fixes (R3)

For `bundledAgentRuntime.ts`'s `extensionRootFrom`, prefer a depth-INDEPENDENT resolution over hand-tuning the `'..'` count for the new bundle depth (which would silently break again if the bundle layout ever changes): when running inside the extension host (i.e. `vscode` is resolvable — already the pattern `readAgentRuntimePreference()` in this same file uses via a lazy `require('vscode')` inside try/catch), resolve via `vscode.extensions.getExtension('ritemark.ritemark')?.extensionPath`. Fall back to the existing `__dirname`-relative walk (now updated to `resolve(startDir, '..')` — one level, matching the new `out/` depth) for contexts where `vscode` isn't available (e.g. the `tsx` unit-test harness, which already passes an explicit `extensionRoot` override per `bundledAgentRuntime.test.ts` and is therefore unaffected either way).

For `BrowserToolsInjector.ts`'s `adapterPath`, since R1 and R2 place BOTH bundle outputs at fixed sibling-ish locations (`out/extension.js` and `out/browser/browserMcpAdapter.js`), the fix is a one-level constant adjustment: `path.join(__dirname, 'browser', 'browserMcpAdapter.js')` (removing one `'..'` — `BrowserToolsInjector.ts`'s code now lives directly in `out/extension.js`, i.e. `__dirname` = `out/`, and the adapter lives at `out/browser/`, a direct child, not a sibling-of-parent). Document this with an inline comment cross-referencing this sprint (`// Sprint 92 R3: __dirname is now out/ directly (bundled), not out/runtime/`) so a future reader doesn't "fix" it back.

### D. Validation script updates (R6)

`scripts/validate-build-output.sh`: replace the `ritemarkEditor.js`-specific `check_file_size` call with (a) a substantially larger minimum size on `out/extension.js` (the bundle now inlines what used to be ~130 files — a reasonable floor is an order of magnitude above today's 1000-byte floor; determine the real post-bundle size at implementation time rather than guessing) and (b) a content-sentinel check (`grep -q` for a stable exported symbol name that only appears if `ritemarkEditor.ts`'s code was actually inlined, e.g. `RitemarkEditorProvider` or the `viewType` string `ritemark.editor`) as a cheap "did the bundle actually include this subsystem" signal, cheaper than parsing the bundle's source map.

`.claude/hooks/pre-commit-validator.sh`: no structural change (Check 7 already just runs `npm run compile`); re-run manually post-bundling to confirm it still passes.

### E. `docs/development/architecture.md` update (R8)

- Build Pipeline section (line ~272-275): replace `tsc → out/  extension host: 105 loose .js files` with the bundled description (two esbuild entry points, `tsc --noEmit` for type-checking).
- Debt table entry for #105 (line ~392): mark resolved, with a one-line "what changed" summary and a pointer to this sprint.
- Add a Version History row (per the doc's own Sprint Architecture Gate rule — a build-pipeline change is a structural change requiring an `architecture.md` update before the sprint closes).

---

## Files touched (indicative — finalize exact paths in tasks.md)

| File | Change |
|---|---|
| `extensions/ritemark/esbuild.config.mjs` | New — two-entry-point bundle config |
| `extensions/ritemark/package.json` | `scripts.compile`/`scripts.watch` rewired; new `esbuild` devDependency |
| `extensions/ritemark/src/utils/bundledAgentRuntime.ts` | `extensionRootFrom` — depth-independent resolution (R3) |
| `extensions/ritemark/src/runtime/BrowserToolsInjector.ts` | `adapterPath` — one-level offset fix (R3) |
| `scripts/validate-build-output.sh` | Replace `ritemarkEditor.js` check with bundle-appropriate checks (R6) |
| `docs/development/architecture.md` | Build Pipeline prose + #105 debt entry + Version History row (R8) |
| `extensions/ritemark/tsconfig.json` | Possibly unchanged (still used for `--noEmit` type-check) — confirm `exclude` list doesn't need adjustment for the new dual-entry-point split |

Not touched: `extensions/ritemark/webview/**`, `media/webview.js`, `patches/**`, `vscode/` submodule, `branding/**`, `binaries/agents/**`.

## Risks

- **R5's audit is the real unknown** — a first-pass grep found zero additional dynamic-require sites, which is a good sign, but a code-verified audit during Phase 3 is the actual gate, not this planning-time grep.
- **R3's two landmines are confirmed but the fix approach (vscode-context resolution + fallback) is a proposed shape, not final code** — per SDD discipline, if the implementation diverges, update this document first.
- **Windows EMFILE closure (a stated benefit) is only verifiable via a real Windows CI run** — functional correctness on macOS is this sprint's bar; the EMFILE-class closure is a qualitative, CI-verified claim, not something unit-testable locally.

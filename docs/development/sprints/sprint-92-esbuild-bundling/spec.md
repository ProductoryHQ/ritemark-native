# Sprint 92: esbuild Extension Host Bundling — Spec

Parent release: [`docs/development/releases/v1.8.2/release-plan.md`](../../releases/v1.8.2/release-plan.md)
Track: SDD (per release-plan.md Sprint Map — designated SDD before this doc was written). Justification: single cohesive workstream but genuinely risky — a `require()`/dynamic-path audit whose outcome is unverified until code is written, two already-confirmed path-resolution landmines (see technical-plan.md), and downstream impact on two other scripts (`validate-build-output.sh`, `scripts/create-extension-release.sh` in sprint-93) that assume today's multi-file `out/` layout. Audit-first spike + explicit droppability match the SDD "risky requirement" pattern.

This is the behaviour contract. Requirements are numbered `R<n>` (flat — this is a single workstream, unlike sprint-91's W-prefixed multi-workstream numbering).

---

## Problem

`extensions/ritemark/out/` ships as ~130 loose `.js` files (tsc-emitted, one per `src/**/*.ts` module) plus their `.map` files, alongside the extension's runtime `node_modules` tree. This is the confirmed root cause of three separate incidents documented in `architecture.md` and the `release` skill: the Windows EMFILE failure class, the v1.7.1 "0-byte incremental tsc trap" (an empty `.js` file silently shipped because tsc's incremental cache didn't see a source change), and DMG/zip bloat. Tracked as GitHub issue [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105).

**This sprint has already found a live instance of the failure class it exists to prevent** (see R7): `scripts/create-extension-release.sh` — an existing, uninvoked extension-packaging script — hardcodes a list of ~19 `out/**/*.js` paths that is stale relative to the current source tree (references non-existent `out/excelEditor.js`, `out/aiProvider.js`, `out/commands/index.js`; omits ~100 real current files: `out/codex/**`, `out/agent/**`, `out/acp/**`, `out/browser/**`, `out/flows/**`, `out/features/**`, `out/runtime/**`, `out/ai/**`, `out/views/**`, `out/settings/**`, `out/voiceDictation/**`, `out/utils/**`, `out/docxDocument.js`, `out/excelDocument.js`, `out/workspaceFileLinks.js`, `out/internalLinkResolver.js`, `out/drawioEditorProvider.js`, `out/docxEditorProvider.js`, `out/pdfEditorProvider.js`, `out/pdfDocument.js`). Running it today would ship an extension that `require()`s missing sibling modules and crashes on activation — the exact multi-file-tree fragility this sprint closes. This is concrete evidence, not a hypothetical.

## Requirements

### R1 — Extension host entry point bundled into a single output

`extensions/ritemark/src/extension.ts` (the `main` entry declared in `package.json`) is bundled by esbuild into a single `out/extension.js`, replacing the current tsc-emitted ~130-file tree for this entry point.

Acceptance criteria:
- `out/extension.js` exists after build and is the ONLY compiled artifact `package.json`'s `main` points to (unchanged path — no `package.json` `main` field edit needed).
- The individual per-module `.js` files (`out/ritemarkEditor.js`, `out/codex/codexManager.js`, etc.) no longer exist as separate build artifacts for the bundled entry point.
- `vscode` stays external (never bundled — host-provided module, standard VS Code extension esbuild pattern).

### R2 — `browserMcpAdapter.ts` stays a standalone spawnable script

`extensions/ritemark/src/browser/browserMcpAdapter.ts` is spawned as an independent Node.js child process (`command: process.execPath, args: [adapterPath]` — see `BrowserToolsInjector.ts:29`) with a source comment declaring "Zero external dependencies... NOT imported by any other module." It CANNOT be inlined into `out/extension.js` (a child process cannot `require()` code living inside a different process's already-loaded module) and must remain independently invokable via `node <path>`.

Acceptance criteria:
- `browserMcpAdapter.ts` becomes its OWN esbuild entry point, bundled to its own single output file (e.g. `out/browser/browserMcpAdapter.js`), not part of the `out/extension.js` bundle.
- `BrowserToolsInjector.ts`'s `adapterPath` resolution still resolves to a real, executable file after bundling (verify the relative path math still holds under the new two-bundle layout — see R3).
- The OpenCode ACP browser-tools MCP flow (spawn → JSON-RPC over stdio → IPC to extension host) still works end-to-end post-bundling.

### R3 — Path-resolution landmines fixed before/with bundling

Two confirmed `__dirname`-relative path computations assume today's multi-level `out/` directory depth and WILL break under a flattened single-bundle layout unless fixed:

1. **`bundledAgentRuntime.ts:53`** — `extensionRootFrom(__dirname)` = `resolve(startDir, '..', '..')`. Today `__dirname` for this module is `out/utils/` (two levels below the extension root), so `resolve(out/utils, '..', '..')` correctly lands on the extension root. Under a single `out/extension.js` bundle, `__dirname` becomes `out/` (one level below extension root) — the same `'..','..'` walk would resolve OUTSIDE the extension directory entirely, silently breaking `findBundledAgentRuntime()` for every caller that doesn't pass an explicit `extensionRoot` override (confirmed callers without an override: `agent/setup.ts:152`, `codex/codexManager.ts:133,142`, `acp/AcpRuntime.ts:74,165`).
2. **`BrowserToolsInjector.ts:29`** — `path.join(__dirname, '..', 'browser', 'browserMcpAdapter.js')`. Same class of bug: depth-relative math tuned for today's tree, must be re-verified/re-derived once R2's second entry point exists.

Acceptance criteria:
- Both call sites resolve to correct real paths after bundling (verified by R1.1/R1.2's launch tests in `scenarios.md`).
- The fix does not require passing a hardcoded absolute path (fragile across install locations); it derives the extension root through a mechanism that holds regardless of bundle depth (e.g. `vscode.extensions.getExtension('ritemark.ritemark')?.extensionPath` where a `vscode` context is available, or a single well-known relative offset documented at both call sites with a cross-reference comment).

### R4 — Type-checking is preserved as a separate, fast-failing step

Bundling emits JavaScript; it does not type-check. `tsc --noEmit` (or equivalent) MUST still run as part of `npm run compile` so a type error fails the build exactly as it does today — esbuild strips types silently and would otherwise let type errors ship undetected.

Acceptance criteria:
- `cd extensions/ritemark && npm run compile` fails with a clear TypeScript error when a deliberately-introduced type error exists in `src/`, exactly as it does pre-sprint.
- `npm run compile` still produces the bundle when there are no type errors (i.e. `noEmit` type-checking and the esbuild emit both run, not either/or).

### R5 — No `require()`/dynamic-import call site is broken by bundling

Beyond R2/R3's two confirmed landmines, a full audit of `extensions/ritemark/src/**` for `require(\`...\`)`-with-template-literal or `require(path....)`-style dynamic requires must find no additional call sites that assume a relative multi-file `out/` layout. (A first-pass grep for `require(\`|require(path\.|import(\`|import(path\.` during sprint planning found zero matches beyond the two above — this requirement re-runs and confirms that finding during implementation, since planning-time greps are not a substitute for a code-verified audit.)

Acceptance criteria:
- The audit is written up (file/line-by-line disposition: "safe under bundling" or "needs rework") in `notes/require-audit.md`, created during Phase 3.
- Zero unresolved "needs rework" items remain before the sprint closes, OR the sprint is scoped down per R9's droppability clause.

### R6 — Build-output validation scripts updated for the new layout

`scripts/validate-build-output.sh` hardcodes a check for `$EXT_PATH/out/ritemarkEditor.js` (a file that will no longer exist standalone once R1 bundles it into `out/extension.js`). This check must be replaced with a check appropriate to the bundled layout (e.g. a substantially larger minimum size on `out/extension.js` reflecting the inlined dependency tree, and/or a content-sentinel `grep` for a symbol/string that only exists if `ritemarkEditor.ts`'s code was actually included in the bundle).

`.claude/hooks/pre-commit-validator.sh` Check 7 (`npm run compile`) is confirmed to have NO hardcoded assumption about `out/` being a multi-file tree — it only checks that the compile command exits 0 — so it needs no structural change, only re-verification that it still passes.

Acceptance criteria:
- `scripts/validate-build-output.sh darwin-arm64` (and `win32-x64`) pass against a bundled build with zero references to now-nonexistent per-module `out/*.js` paths.
- `.claude/hooks/pre-commit-validator.sh` passes unchanged against a bundled build.

### R7 — `scripts/create-extension-release.sh`'s stale file-list problem is closed by construction

Per the Problem section, this uninvoked script's hardcoded `FILES` list is already broken against the current (pre-bundle) source tree. This sprint does not need to fix that script directly (sprint-93 owns it — see release-plan.md dependency note), but R1's single-bundle output is what makes fixing it tractable: the manifest's file list collapses from ~130 hand-maintained entries (a staleness trap that has ALREADY manifested, per the Problem section) to effectively 2-3 (`out/extension.js`, `out/browser/browserMcpAdapter.js`, `media/webview.js`) plus `package.json`.

Acceptance criteria:
- No code change to `create-extension-release.sh` or a `release-extension.sh` in THIS sprint — this requirement exists to make the dependency from sprint-93 explicit and testable: sprint-93's technical-plan.md must reference this requirement number when it fixes the stale-file-list problem.

### R8 — `docs/development/architecture.md` GH #105 entry updated

The existing debt-table entry for [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105) (line ~392) and the Build Pipeline prose (line ~274, "tsc → out/ ... 105 loose .js files") are updated to reflect the bundled state: what changed, why (EMFILE class closure, 0-byte tsc trap closure, size reduction), and any residual risk. Issue #105 is closed at sprint end; the entry notes that #107 (webview bundle size) and #108 (build-integrity gate) are now unblocked but remain out of this sprint's scope.

Acceptance criteria:
- `architecture.md`'s `Last updated` date and Version History table gain a new row for this sprint, per the doc's own Sprint Architecture Gate rule (a build-pipeline change is a structural change).

### R9 — Explicit droppability (scope-change escape hatch)

This is the release plan's own framing (`release-plan.md` line 65: "the release can drop sprint-91's signing... don't need the cert" — analogous framing applies here per the source analysis doc §3 Phase D and the original combined-sprint draft's "W-D... explicitly droppable"). If R5's audit surfaces a large or fragile rework list, or R3's path-fix approach turns out to require a broader refactor than the two known landmines, invoke the Mid-Sprint Scope Change Protocol (`.claude/skills/spec-driven-sprint/SKILL.md`) and drop this sprint's remaining scope to a follow-up. Sprint-91 does not depend on sprint-92. Sprint-93 DOES depend on sprint-92 (packaging assumes a small bundle — R7) — if sprint-92 is dropped/delayed, sprint-93's `release-extension.sh` must still ship correctly against the current multi-file tree (fixing the stale-file-list problem directly, without the bundling collapse); this is a fallback, not a blocker on sprint-93 starting.

### R10 — `vscode-development` skill updated for the bundled world

`.claude/skills/vscode-development/SKILL.md` is Claude's build-knowledge canon and currently describes the pre-bundle reality: the "~105/130 loose `.js` files" framing, the EMFILE failure class, and the v1.7.1 0-byte tsc trap as live gotchas. Once this sprint lands, that framing is stale and would mislead future build work. Update it to describe the bundled build: what `npm run compile` now does (esbuild emit + `tsc --noEmit` typecheck), the two-entry-point layout (`out/extension.js` + `out/browser/browserMcpAdapter.js`), and reframe the EMFILE / 0-byte-trap gotchas as **resolved by bundling** (kept as historical context, not active hazards). Verify the `cp -R out/*` hot-copy pattern (SKILL.md line ~231) and the "dev mode serves from `out/`" note (line ~446) still hold under the bundle and correct them if not.

Acceptance criteria:
- No statement in `vscode-development/SKILL.md` describes the extension host as a multi-file loose-`.js` tree as the *current* state.
- The build-command description matches what `npm run compile` actually does post-sprint (esbuild + tsc-noEmit).
- The `.codex/**` / `AGENTS.md` mirror is NOT hand-edited — the scheduled `harness-equalizer` propagates this skill change to the Codex canon (note this in tasks.md; do not touch Codex files directly).

### R11 — "Bundle-safe extension code" rule added to the harness

Bundling introduces a durable constraint on ALL future extension-host code, and it is currently written down nowhere — the two R3 landmines are exactly what a new contributor (human or agent) would reintroduce. Add a concise "bundle-safe code" rule to `.claude/skills/vscode-development/SKILL.md` (and a one-line pointer in the root `CLAUDE.md` Critical Invariants area) capturing the three constraints this sprint establishes:

1. Do NOT assume `out/` layout / write `__dirname`-relative path math that depends on a module's directory depth (the extension is one flat bundle now) — derive the extension root via a bundle-depth-independent mechanism (e.g. `vscode.extensions.getExtension(...)?.extensionPath`).
2. A new third-party dependency is auto-inlined by esbuild — a **native** (`.node` / `binding.gyp`) or dynamically-`require()`d-by-path package must be added to the esbuild `external` list instead.
3. Code spawned as a **separate OS process** (like `browserMcpAdapter`) needs its own esbuild entry point — it cannot live inside the main bundle.

Acceptance criteria:
- The three constraints exist as an explicit, findable rule in `vscode-development/SKILL.md`.
- `CLAUDE.md` gains a one-line pointer to that rule near the existing Critical Invariants section (so it surfaces during any extension work), consistent with how other invariants point to their owning doc.
- Codex mirror is left to `harness-equalizer` (per R10).

## Non-Requirements

- The webview bundle (`extensions/ritemark/webview/`, built via Vite → `media/webview.js`, ~7.6 MB IIFE) is OUT OF SCOPE. It is already esbuild-based (Vite's underlying bundler) and is tracked separately as GH #107 (webview bundle size), which is unblocked but not built by this sprint.
- `extensions/ritemark/node_modules` (the loose runtime `node_modules` tree shipped in the extension for now) is not removed from the shipped extension by this sprint — that is a packaging-layer optimization sprint-93 may pursue (see sprint-93 spec.md's packaging note), not a bundling-layer requirement here. This sprint's job is bundling the FIRST-PARTY `src/` code; whether third-party deps get inlined by esbuild (making the loose `node_modules` copy redundant) is a design question for R1's implementation (see technical-plan.md), not a shipped-artifact-removal requirement.
- No change to `extensions/ritemark/webview` build tooling, Vite config, or any webview-side code.
- No change to `patches/vscode/**`, the `vscode/` submodule, `branding/`, or `binaries/agents/` — this sprint touches only `extensions/ritemark/` build tooling and two path-resolution call sites in `src/`.

## Resolved Questions

- **Release tier:** see sprint-plan.md — this sprint's OWN file footprint is extension-build-tier (touches only `extensions/ritemark/**` + one validation script), but it ships as part of the v1.8.2 SHELL release per the release plan's own Sprint Map designation (`Tier: shell`), because that is how this release is sequenced, not because the change itself requires shell tooling.
- **Zip vs per-file manifest packaging (carried over from the pre-sprint-93 source material):** the analysis doc and release-plan.md both use the word "zip" when describing extension packaging. The verified runtime mechanism (`userExtensionInstaller.ts`'s `downloadFilesToStaging`) downloads a MANIFEST-DRIVEN LIST OF INDIVIDUAL FILES, not a zip archive — there is no unzip step anywhere in the install path. This sprint's R7 is written against the per-file model (verified in-repo), not the zip framing. Sprint-93's technical-plan.md carries the full correction.

## Open Questions

- Whether esbuild should inline ALL third-party `dependencies` (making the shipped `extensions/ritemark/node_modules` copy droppable) or only first-party `src/` code with `node_modules` staying external-but-present. Package.json's `dependencies` list (`@agentclientprotocol/sdk`, `@anthropic-ai/claude-agent-sdk`, `ajv`, `ajv-formats`, `cron-parser`, `docx`, `gray-matter`, `marked`, `node-html-parser`, `openai`, `papaparse`, `pdfkit`, `posthog-node`, `turndown`, `turndown-plugin-gfm`, `xlsx`, `zod`, plus the two `npm-stubs/` file: packages) contains no confirmed native `.node` modules (all appear to be pure-JS packages per a first-pass read), which suggests full inlining IS feasible, but this must be confirmed by R5's audit (`find extensions/ritemark/node_modules -name "*.node" -o -name "binding.gyp"`) before committing to the design. Resolve during Phase 3; document the decision in `notes/require-audit.md`.
- Exact `target`/`platform` esbuild flags to match the Electron/Node runtime version Ritemark ships (Node v20.x per the production build prerequisite) — confirm at implementation time rather than guessing a version.

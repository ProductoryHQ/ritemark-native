# Sprint 92: esbuild Extension Host Bundling — Tasks

Every task lists concrete file paths, exact commands where applicable, and a binary "done when" criterion. Requirement IDs reference `spec.md`.

---

## Progress (2026-07-08 — implementation on branch `sprint-92-esbuild-bundling`)

**DONE + build-verified:** T0-1/T0-2/T0-3 (audit → `notes/require-audit.md`, no scope change) · T1-1/T1-2/T1-3 (esbuild.config.mjs, `npm run compile` rewired) · T2-1/T2-2 (both `__dirname` landmines fixed) · T3-1 (validate-build-output.sh: content-sentinel + bumped floor) · T3-2 (Check 7 `npm run compile` passes) · T4-1 (type gate fails on error) · T5-1 (architecture.md #105 resolved) · T5-2 (create-extension-release.sh untouched) · T5-3/T5-4 (R10/R11: vscode-development skill + bundle-safe rule + CLAUDE.md pointer).

**Verified build result:** `out/` collapsed ~130 files → **4** (`extension.js` 5.18 MB + `browser/browserMcpAdapter.js` 9 KB + maps). Externals correct (vscode/pdfkit/ESM-SDKs out; openai + pure-JS in). `npm run compile` = ~110 ms.

**T-EXTRA (added — breakage found & fixed):** `scripts/build-prod.sh` lines 297-304 checked `out/ritemarkEditor.js` (now gone → would FAIL every prod build). Replaced with the bundled-extension floor (1 MB) + a `resolveCustomTextEditor` content-sentinel + a `browserMcpAdapter.js` check. Same class as T3-1.

**T2-3 + T4-2 — DONE 2026-07-11 (macOS session, runtime QA):**
- T2-3: dev mode relaunched against a clean rebuild (`rm -rf out && npm run compile`). Claude Code, Codex, and OpenCode all verified via CDP automation. Claude Code and Codex each completed a real round-trip ("bundle test ok" / "codex bundle test ok") — proving `bundledAgentRuntime.ts`'s `extensionRootFrom` resolves correctly against the new one-level bundle depth for both. OpenCode's session itself needs a BYOK API key not available in this environment (Settings showed "Add API keys to use OpenCode") — verified instead by code-path equivalence (`kind === 'opencode'` goes through the identical `extensionRootFrom` function, confirmed in source) plus binary presence (`extensions/ritemark/binaries/agents/darwin-arm64/opencode` exists on disk). Noted as the one piece verified by inspection rather than a live session.
- T4-2: full `./scripts/build-prod.sh` run end-to-end (arm64 Node 20, ~2.5 min gulp + packaging). All `Step 6/8` post-build checks passed, including the three bundled agent runtimes verified as valid arm64 Mach-O executables. Manually launched the packaged `Ritemark.app` (isolated user-data-dir + `--remote-debugging-port`, `ELECTRON_RUN_AS_NODE` unset) via CDP: editor loads and renders markdown correctly, AI sidebar shows "Claude is ready", Ritemark Settings page loads fully including the Agent Runtime section correctly reporting "Claude — Bundled with app" / "Codex — Bundled with app". Zero activation errors in the console log. PDF/DOCX export not separately re-tested this session (unrelated to the bundling change's externals — `pdfkit` stays external per the T0-2 audit, same as before bundling).

**Found in passing (out of scope):** duplicate `case 'refresh':` in `ritemarkEditor.ts:791` (dead-duplicates line 720, pre-existing since Jan 2026) — flagged, not fixed here.

---

## Phase 0 — Audit spike (mandatory first, before any esbuild config is written)

- [x] **T0-1 (spike).** Re-run and formally record the dynamic-require audit (R5): `grep -rn "require(\`\|require(path\.\|import(\`\|import(path\." extensions/ritemark/src/`. Cross-check against the two known landmines. Write findings to `notes/require-audit.md` (create the file — this is the sprint's first artifact under `docs/development/sprints/sprint-92-esbuild-bundling/notes/`).
  Done when: every match is triaged as "safe under bundling" or "needs rework" in `notes/require-audit.md`, with the two known landmines (`bundledAgentRuntime.ts:53`, `BrowserToolsInjector.ts:29`) explicitly cross-referenced to R3.

- [x] **T0-2 (spike).** Audit native/binary dependencies: `find extensions/ritemark/node_modules -name "*.node" -o -name "binding.gyp"`. Resolve the Open Question in spec.md about whether third-party `dependencies` can be fully inlined.
  Done when: the result (empty or a concrete list) is recorded in `notes/require-audit.md`, and the "inline everything vs. keep node_modules external" design decision is stated with a one-paragraph rationale.

- [x] **T0-3 (scope-change checkpoint).** If T0-1/T0-2 surface a large or fragile rework list beyond the two known landmines, invoke the Mid-Sprint Scope Change Protocol (R9) before proceeding to Phase 1.
  Done when: either "no scope change needed" is recorded, or a scope-change addendum is added to `sprint-plan.md`'s Product Decisions with today's date.

## Phase 1 — esbuild config (R1, R2)

- [x] **T1-1.** Add `esbuild` as a devDependency in `extensions/ritemark/package.json`.
  Done when: `cd extensions/ritemark && npm ls esbuild` shows it installed.

- [x] **T1-2.** Create `extensions/ritemark/esbuild.config.mjs` with two entry points: `src/extension.ts` → `out/extension.js`, `src/browser/browserMcpAdapter.ts` → `out/browser/browserMcpAdapter.js`. `bundle: true`, `platform: 'node'`, `format: 'cjs'`, `external: ['vscode']` (extension.ts entry), `sourcemap: true`.
  Done when: `node extensions/ritemark/esbuild.config.mjs` runs and produces both output files without error.

- [x] **T1-3.** Rewire `package.json` scripts: `"compile": "tsc --noEmit -p ./ && node esbuild.config.mjs"`, `"watch": "node esbuild.config.mjs --watch"` (or the esbuild watch-mode equivalent).
  Done when: `cd extensions/ritemark && npm run compile` produces both bundles AND surfaces TS type errors (verified by T4-1 below).

## Phase 2 — Fix path-resolution landmines (R3)

- [x] **T2-1.** Fix `bundledAgentRuntime.ts`'s `extensionRootFrom` per technical-plan.md Design C: prefer `vscode.extensions.getExtension('ritemark.ritemark')?.extensionPath` when available, fall back to an updated `__dirname`-relative walk matching the new one-level-deep bundle location.
  Done when: `npx tsx src/utils/bundledAgentRuntime.test.ts` passes unmodified (the test always passes an explicit `extensionRoot` override, so this task's fix only changes the no-override default path — confirm the test still exercises that default path or add a case that does).

- [x] **T2-2.** Fix `BrowserToolsInjector.ts`'s `adapterPath` computation to match the new one-level `out/` depth (`path.join(__dirname, 'browser', 'browserMcpAdapter.js')`), with an inline comment cross-referencing this sprint.
  Done when: `grep -n "Sprint 92 R3" extensions/ritemark/src/runtime/BrowserToolsInjector.ts` shows the comment, and a manual dev-mode test confirms the OpenCode browser-tools MCP subprocess still launches (scenario in `scenarios.md` R2).

- [x] **T2-3. DONE 2026-07-11.** Claude Code and Codex both completed real round-trip sessions via CDP automation against a freshly rebuilt bundle. OpenCode verified by code-path equivalence + binary presence (session itself needs a BYOK key not available in this environment — see Progress note above).
  Done when: all three runtimes launch successfully in one dev-mode session.

## Phase 3 — Validation scripts (R6)

- [x] **T3-1.** Edit `scripts/validate-build-output.sh`: replace the `check_file_size "$EXT_PATH/out/ritemarkEditor.js" 1000 "ritemarkEditor.js"` line with an updated `out/extension.js` size floor (determine the real post-bundle size first, then set a floor with margin) plus a content-sentinel `grep -q` for a stable symbol confirming `ritemarkEditor.ts`'s code was inlined.
  Done when: `./scripts/validate-build-output.sh darwin-arm64` passes against a freshly bundled local build with zero references to nonexistent per-module paths.

- [x] **T3-2.** Re-run `.claude/hooks/pre-commit-validator.sh` manually against the bundled build to confirm Check 7 still passes with no hook changes.
  Done when: the hook exits 0 on a commit attempt with the bundled `out/` tree staged.

## Phase 4 — Type-check regression + full QA (R4)

- [x] **T4-1. DONE 2026-07-11.** Injected a deliberate type error in `extension.ts`, ran `npm run compile` — `tsc --noEmit` failed with `error TS2693`, esbuild never ran (confirmed `out/extension.js` timestamp unchanged), reverted cleanly (`git diff` empty).
  Done when: the failure is observed and the revert is confirmed clean (`git diff` empty for that file).

- [x] **T4-2. DONE 2026-07-11.** Full `./scripts/build-prod.sh` run (arm64 Node 20) succeeded end-to-end; all Step 6/8 post-build checks passed including all three bundled runtime binaries. Launched the packaged app via CDP: editor renders correctly, AI sidebar ready, Ritemark Settings loads fully (Agent Runtime section correctly shows both Claude and Codex as "Bundled with app"). Zero activation errors in console.
  Done when: all three surfaces confirmed working, zero activation errors observed.

## Phase 5 — Docs + harness (R7, R8, R10, R11)

- [x] **T5-1.** Update `docs/development/architecture.md`: Build Pipeline section (replace "105 loose .js files" prose with the bundled description), debt table #105 entry (mark resolved with a one-line summary), new Version History row.
  Done when: `grep -n "Sprint 92" docs/development/architecture.md` shows the Version History entry, and the #105 debt-table row no longer reads as open debt.

- [x] **T5-2.** No code change to `scripts/create-extension-release.sh` in this sprint (R7 is descriptive/evidentiary only — the actual fix is sprint-93's). Confirm via `git diff main...sprint-92-esbuild-bundling -- scripts/create-extension-release.sh` returning empty before closing the sprint.
  Done when: the diff is confirmed empty.

- [x] **T5-3 (R10).** Update `.claude/skills/vscode-development/SKILL.md` for the bundled world: (a) replace any "loose `.js` tree / ~105-130 files" current-state framing with the two-entry-point bundle description; (b) update the `npm run compile` description to "esbuild emit + `tsc --noEmit` typecheck"; (c) reframe the EMFILE and 0-byte-tsc-trap gotchas as **resolved by bundling** (historical, not active); (d) re-verify the `cp -R out/*` hot-copy (line ~231) and "dev mode serves from `out/`" (line ~446) notes still hold and correct if not.
  Done when: `grep -niE "105 loose|130 loose|loose .js|per-module out" .claude/skills/vscode-development/SKILL.md` returns nothing describing it as the current state, and the compile-command description matches the new `npm run compile`. Do NOT edit `.codex/**`/`AGENTS.md` (harness-equalizer syncs them) — note this in the commit.

- [x] **T5-4 (R11).** Add the "bundle-safe extension code" rule (the three constraints in spec.md R11) as an explicit, findable section in `.claude/skills/vscode-development/SKILL.md`, and add a one-line pointer in the root `CLAUDE.md` near the Critical Invariants section.
  Done when: `grep -niE "bundle-safe" .claude/skills/vscode-development/SKILL.md CLAUDE.md` matches in both files; the three constraints (no `__dirname`-depth path math; native/dynamic deps → esbuild `external`; separate-process code → own entry point) are all present in the skill.

## Sprint close

- [ ] `qa-validator` sign-off (surface routing recommendation to the user at Phase 4→5).
- [ ] Jarmo local test pass covering the `scenarios.md` matrix (or the subset still in scope if R9's droppability clause was invoked).
- [ ] Close GitHub issue #105, noting #107/#108 are now unblocked (not built here).
- [x] Confirm `docs/development/architecture.md` update landed (T5-1) per the Sprint Architecture Gate.

## Sequencing summary

- **Independent of sprint-91** — no shared files, can run in parallel per the release plan's "independent domains" framing.
- **Blocks sprint-93's optimal path** (R7 — the packaging simplification) but does NOT hard-block sprint-93 from starting; sprint-93 falls back to fixing `create-extension-release.sh` against the current multi-file tree if this sprint is dropped or delayed (R9).
- **Scope-change checkpoint at T0-3** — the earliest and cheapest point to drop scope if the audit surfaces more than the two known landmines.

# Sprint 92: esbuild Extension Host Bundling

Track: SDD (per `docs/development/releases/v1.8.2/release-plan.md` Sprint Map, which already designates this sprint "SDD not written" before this doc existed. Retrospective justification against the standard signals: this is nominally a single-domain build-tooling change, BUT it carries a genuinely risky, audit-first requirement (dynamic-require/path-resolution sweep across the whole extension host, R5) with two ALREADY-CONFIRMED landmines whose fix approach is a proposed shape pending Phase 3 verification, plus explicit mid-sprint droppability (R9) and a downstream dependency from sprint-93. That risk profile — not requirement count — is why this stays SDD rather than lightweight/plain-full-track.)
Override with: "use plain full track" — not recommended given the confirmed landmines; already SDD per the release plan.

Branch: `sprint-92-esbuild-bundling` (NOT YET CREATED — awaiting Jarmo's approval of this plan, per the HARD gate below)

Status: Phase 2 (PLAN) — awaiting Jarmo approval

Parent release: [`docs/development/releases/v1.8.2/release-plan.md`](../../releases/v1.8.2/release-plan.md) — v1.8.2 "Sturdy & Seamless Delivery (Windows-first)", sprint #2 of 3.

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (R1-R9, source of truth)
- [scenarios.md](scenarios.md) — BDD examples / manual QA matrix
- [technical-plan.md](technical-plan.md) — architecture, verified current-state findings, file-level design
- [tasks.md](tasks.md) — implementation tracker, phased, spike-first
- [sprint-plan.md](sprint-plan.md) — this file (intent + status + product decisions)

## Goal

Bundle the extension host (`extensions/ritemark/src/extension.ts`) into a single esbuild output, closing the root cause of three documented incidents (Windows EMFILE, the v1.7.1 0-byte tsc trap, DMG/zip bloat) and — as a load-bearing side effect — making the extension-release packaging problem sprint-93 depends on tractable (file-list collapses from ~130 hand-maintained entries to ~3).

## Linked Issues

- [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105) — Extension host esbuild bundling (headline)
- Unblocks (not built here): [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107) (webview bundle size), [#108](https://github.com/ProductoryHQ/ritemark-native/issues/108) (build-integrity gate)

## Release-Tier Justification

**Ships as part of the v1.8.2 SHELL release** (per `release-plan.md` Sprint Map: sprint-92 → Tier: shell), because that is how this release is sequenced — v1.8.2 ships as one coherent full app release (`Release type: Full app release`), not because this sprint's own changes require shell tooling.

Judged against the extension-vs-shell decision rule (`docs/development/analysis/2026-07-07-seamless-update-delivery-plan.md` §2: a release is shell-tier only if it touches `patches/vscode/*`, the `vscode/` submodule, native/build tooling affecting the SHIPPED APP LAYOUT, `branding/product.json`, or bundled agent binaries), this sprint's OWN file footprint does NOT meet that bar — it touches only:
- `extensions/ritemark/**` (esbuild config, package.json scripts, two `src/` path-resolution fixes)
- `scripts/validate-build-output.sh` (a validation script referenced by CI, not itself part of the shipped app layout)
- `docs/development/architecture.md` (docs)

None of `patches/`, `vscode/`, `branding/product.json`, or `binaries/agents/` are touched. **Conclusion: extension-build-tier work by its own file footprint; shell-tier only because of this release's sequencing.** This distinction matters for sprint-93's future releases — a similar bundling-tooling change AFTER v1.8.2 ships (once sprint-93's `release-extension.sh` exists) could plausibly ship as a fast-lane extension release on its own merits, if not bundled into a shell release train.

## MVP Scope

Single workstream (full detail in spec.md R1-R9):
- **R1** — bundle `src/extension.ts` into one `out/extension.js` via esbuild.
- **R2** — keep `src/browser/browserMcpAdapter.ts` as its own standalone bundled entry point (it is spawned as a separate OS process and cannot be inlined).
- **R3** — fix two confirmed `__dirname`-relative path-resolution landmines (`bundledAgentRuntime.ts`, `BrowserToolsInjector.ts`) that break under the new bundle depth.
- **R4** — preserve `tsc --noEmit` type-checking as a separate step from esbuild's emit.
- **R5** — audit-first: confirm no other dynamic-require call site breaks under bundling (spike, Phase 0).
- **R6** — update `scripts/validate-build-output.sh`'s hardcoded per-module file check.
- **R7** — no code change this sprint, but documents (with concrete evidence) why `scripts/create-extension-release.sh`'s stale file-list problem becomes tractable once bundled — feeds directly into sprint-93.
- **R8** — update `docs/development/architecture.md` (Build Pipeline section + #105 debt entry + Version History), per the doc's own Sprint Architecture Gate.
- **R9** — explicit droppability via the Mid-Sprint Scope Change Protocol if the audit surfaces large rework.
- **R10 (added 2026-07-08 at Jarmo's request)** — update the `vscode-development` skill for the bundled world (retire the stale loose-files / EMFILE / 0-byte-trap framing; document the new `npm run compile` + two-entry-point layout).
- **R11 (added 2026-07-08 at Jarmo's request)** — add a "bundle-safe extension code" rule (no `__dirname`-depth path math; native/dynamic deps → esbuild `external`; separate-process code → own entry point) to the `vscode-development` skill + a pointer in `CLAUDE.md`, so future extension work (human or agent, incl. the Codex mirror via `harness-equalizer`) doesn't reintroduce the R3 landmines.

## Product Decisions

- **2026-07-10 (this plan):** This sprint does NOT modify `scripts/create-extension-release.sh` directly (R7) — that fix belongs to sprint-93, which depends on this sprint's output. This sprint only produces the evidence (the stale-file-list finding) and the bundled artifact sprint-93 packages. *Jarmo may override and pull that fix forward into this sprint if preferred, but the release plan's own dependency direction (sprint-93 depends on sprint-92) argues against it.*
- **2026-07-10 (this plan):** Whether third-party `node_modules` can be fully inlined by esbuild (dropping the shipped loose `node_modules` copy entirely) is left as an Open Question for Phase 3's audit (T0-2), not decided here — package.json's dependency list looks all-pure-JS on inspection but this needs code-verified confirmation, not a planning-time guess.
- **2026-07-10 (this plan):** The two confirmed path-resolution landmines (`bundledAgentRuntime.ts:53`, `BrowserToolsInjector.ts:29`) are treated as IN-SCOPE fixes (R3), not deferred — they are load-bearing for R1 to work at all (agent runtime discovery and browser-tools MCP would both silently break without them). This is not optional scope.

## Success Criteria

Mirrors `spec.md`'s Acceptance criteria at a high level:
- [ ] `out/extension.js` is a single bundled output; per-module `out/*.js` files no longer exist for the bundled entry (R1).
- [ ] `browserMcpAdapter.ts` bundles to its own standalone `out/browser/browserMcpAdapter.js`, still launchable via `node <path>` with zero sibling-file dependencies (R2).
- [ ] `findBundledAgentRuntime()` resolves correctly with no `extensionRoot` override post-bundling; all three agent runtimes (Claude Code, Codex, OpenCode) launch in a bundled dev build (R3).
- [ ] `npm run compile` still fails loudly on a deliberate type error (R4).
- [ ] Phase 3 audit confirms zero unresolved dynamic-require landmines beyond the two fixed in R3, or the scope-change protocol was invoked (R5).
- [ ] `scripts/validate-build-output.sh` passes against a bundled build with no reference to nonexistent per-module paths (R6).
- [ ] `docs/development/architecture.md` updated per the Sprint Architecture Gate (R8).
- [ ] `vscode-development` skill no longer describes the extension host as a loose-file tree; compile-command description matches reality (R10).
- [ ] "Bundle-safe extension code" rule present in the skill + pointed to from `CLAUDE.md` (R11).
- [ ] Full prod build boots cleanly: editor, AI sidebar, Settings all load with zero activation errors.

## Pre-Implementation Gate

Phase 0 (Audit spike, tasks.md T0-1/T0-2) runs BEFORE any esbuild config is written — this is the audit-first pattern for a risky requirement (`.claude/skills/spec-driven-sprint/SKILL.md`). The two known landmines are already documented in `technical-plan.md`; Phase 0 exists to confirm there are no OTHERS, not to discover these two from scratch.

## Approval Gate (HARD — read before touching code)

Per repo CLAUDE.md and the user's global instruction ("never start sprint coding before me (user) actually approves sprint plan"):

1. **No implementation code until Jarmo approves this plan.** Release phrases: "approved", "Jarmo approved", "proceed".
2. **Immediately after approval, before any code edit:** create the sprint branch.
   ```bash
   git checkout -b sprint-92-esbuild-bundling   # base: sprint-91-windows-foundation
   git branch --show-current   # must print sprint-92-esbuild-bundling
   ```
   **Branch base: `sprint-91-windows-foundation` (decided 2026-07-08), NOT `main`.** Rationale: the v1.8.2 release-level docs (release-plan, analysis, all three sprint SDDs) were committed on the `sprint-91` branch, which is the de-facto v1.8.2 planning trunk. Basing the code branches on it keeps cross-references intact and everything synced (Windows machine pulls the full picture). The sprints touch disjoint files (91 = installer/signing/CI, 92 = extension build tooling, 93 = src/update + process), so there is no code conflict; all three merge to `main` together at release time. sprint-93 in turn branches off sprint-92 (its dependency).
3. Sprint code never lands on `main` directly.
4. Standard commit gate: pre-commit hook (`.claude/hooks/pre-commit-validator.sh`) must pass on every commit.
5. Sprint-end gate: recommend invoking `qa-validator` for Phase 4 sign-off (build/standards validation) before merge. This sprint most likely lands as part of the full v1.8.2 shell release build (Gate 1/Gate 2), per the release plan's process — a standalone Phase 6 prod-build sign-off is not expected unless Jarmo requests an isolated validation build.

## Approval

- [ ] Jarmo approved this sprint plan

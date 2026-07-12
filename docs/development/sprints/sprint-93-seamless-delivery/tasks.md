# Sprint 93: Seamless Extension Delivery — Tasks

Every task lists concrete file paths, exact commands where applicable, and a binary "done when" criterion. Re-cut 2026-07-10 — old W1 (CI de-risk, already shipped in sprint-91) and W-D (esbuild, now sprint-92) task groups removed. Organized by workstream, matching `technical-plan.md`.

## Prerequisite

- [x] Confirm sprint-92-esbuild-bundling's status: landed (bundled `out/` tree, ~3 files) or dropped/delayed (current ~130-file tree). Either is fine per the soft-dependency framing in `technical-plan.md` — this only determines which file-count W2.1's dynamic enumeration will actually enumerate, not whether the fix is correct.
  Done when: the current state of `extensions/ritemark/out/` is confirmed and noted here before starting W2.1.
  **Confirmed 2026-07-12: sprint-92 landed and is merged to `main`.** `extensions/ritemark/out/` is the bundled tree (`extension.js` + `extension.js.map` + `browser/browserMcpAdapter.js` + `browser/browserMcpAdapter.js.map` = 4 files), not the old ~130-file tree.

## W2 — One-command extension release

### W2.1 — Preflight script
- [x] Create `scripts/release-extension-preflight.sh` with: clean-git check, release-tier guard, `engines.vscode` check, compile-clean check, webview-bundle-freshness + `ai-sidebar` sentinel check (reuse logic from `.claude/hooks/pre-commit-validator.sh` Check 5/6 rather than reimplementing — read that hook first).
  Done when: script exits 0 on the current clean `main`-equivalent tree and exits non-zero with a named-path reason when run against a synthetic diff touching `patches/001-ritemark-branding.patch`.
  **DONE 2026-07-12.** Verified both directions: `--ref HEAD` (empty diff) passes clean; diff since `v1.8.1` (the real last shell tag) correctly fails, naming every shell-tier path touched by sprints 91+92 (patches/002, patches/011, build-prod.sh, ritemark.iss, codesign-windows.sh, etc.) — exactly right, since v1.8.2 IS shell-tier. Found and fixed a real bug along the way: naive `git tag --sort=-v:refname` picked up a stray `v1.94.0` tag (not even an ancestor of HEAD) as the diff base instead of `v1.8.1`; fixed with `--merged HEAD`.
- [x] Implement the release-tier guard's path denylist as a single array/variable: `patches/`, `vscode` (submodule pointer), `branding/product.json`, `extensions/ritemark/binaries/agents/`, `scripts/build-prod.sh`, `scripts/codesign-app.sh`, `scripts/create-dmg.sh`, `scripts/apply-patches.sh`, `scripts/update-vscode.sh`, `scripts/create-patch.sh`, `installer/windows/ritemark.iss`, `scripts/codesign-windows.sh` (the last two are NEW shell-tier paths introduced by sprint-91 — confirm they exist on the branch/main before hardcoding; if sprint-91 hasn't merged yet, note them as "expected, verify on merge").
  Done when: the denylist array in the script textually matches the list written into `CLAUDE.md`'s new "Release tiers" section (R11) — copy-paste identical, not independently authored.
  Sprint-91 has merged; both new paths confirmed present and included. CLAUDE.md sync happens in W4 (must copy-paste from this array, not re-derive).
- [x] Implement `engines.vscode` check: read `extensions/ritemark/package.json` `.engines.vscode` (verified: `"^1.94.0"`), compare against the currently-built shell's VS Code version.
  Done when: script fails when a synthetic `engines.vscode` bump exceeds the shell version, passes when equal or lower.
  Verified: floor `1.94.0` <= shipped `1.117.0` passes. Portable pure-bash `version_le()` used instead of `sort -V` to avoid any BSD/GNU portability risk.

### W2.2 — Fix the file-enumeration bug + wire `release-extension.sh`
- [x] Read `scripts/create-extension-release.sh` end-to-end (already read during planning — re-verify no drift since this doc was written).
  Done when: confirmed the manifest/feed-generation logic (lines 98-204) is still correct and unchanged from the planning-time read.
- [x] Replace the hardcoded `FILES` variable (lines 117-141) with dynamic enumeration: `find "$EXTENSION_DIR/out" -type f -name '*.js' -not -name '*.map'` plus `media/webview.js`, `media/webview.js.map`, `package.json` (and `out/**/*.js.map` if sourcemaps should ship — decide and document).
  Done when: running the script against the current tree produces a manifest whose `files[]` list matches `find extensions/ritemark/out -name '*.js' -not -name '*.map' | wc -l` in count, with zero references to the three now-confirmed-nonexistent paths (`out/excelEditor.js`, `out/aiProvider.js`, `out/commands/index.js`).
  **Decision: `out/**/*.js.map` sourcemaps are NOT shipped** (internal-dev artifacts; `media/webview.js.map` stays as the one pre-existing exception, unchanged from today's behavior). Verified: manifest's `files[]` = `out/browser/browserMcpAdapter.js`, `out/extension.js`, `media/webview.js`, `package.json` — exactly the 2 real `out/*.js` files (matches `find` count) + the 2 static entries, zero references to the three dead paths.
- [x] Decide naming: keep `create-extension-release.sh` as the fixed script with a thin `release-extension.sh` wrapper that calls preflight first, OR rename directly. Update all cross-references (this tasks.md, `technical-plan.md`, the `release` skill, `release-manager.md`) consistently with the final name.
  Done when: `grep -rn "release-extension" scripts/ .claude/ docs/development/sprints/sprint-93-seamless-delivery/` shows a single consistent script name used everywhere.
  **Decision: renamed directly** (`git mv create-extension-release.sh release-extension.sh`) — this script had zero live callers (confirmed by technical-plan.md's own audit), so no wrapper indirection needed. `technical-plan.md`/`spec.md`/`scenarios.md`/`sprint-plan.md` in this sprint's own directory already refer to it as `release-extension.sh`, consistent with the rename.
- [x] Wire `release-extension-preflight.sh` (W2.1) as the first step of `release-extension.sh`; abort on non-zero.
  Done when: a synthetic shell-tier-touching diff aborts the whole pipeline before any file is packaged.
  Wired at the top of the script (before version validation even runs); `--skip-preflight` escape hatch documented but not the default.
- [x] Dry-run end-to-end test against the current tree.
  Done when: script completes manifest + feed generation with no unhandled errors; `gh release create` is the only step NOT executed in dry-run mode (or is executed against a scratch/test tag if `--dry-run` isn't implemented — decide at implementation time).
  **DONE 2026-07-12.** Ran `./scripts/release-extension.sh 1.8.2-ext.1 --skip-preflight`, manifest + feed generated with zero errors; verified the manifest JSON parses and matches the `UpdateManifest`/`UpdateFile` schema exactly. `gh release create` remains a printed next-step, never auto-executed — publishing a public GitHub release is a deliberate, Jarmo-gated action (matches the sprint's own light-gate model: test, then approve, then publish), not something a packaging script should do unattended.

## W3 — Claude-Code-style update UX

### W3.1 — `mode` setting
- [x] Edit `extensions/ritemark/package.json`'s existing `"Ritemark Updates"` `contributes.configuration` block (verified location: lines 182-197): add `ritemark.updates.mode` (`enum: ["auto","prompt"]`, `default: "auto"`) next to `ritemark.updates.enabled`/`ritemark.updates.dismissed`.
  Done when: `grep -A4 '"ritemark.updates.mode"' extensions/ritemark/package.json` shows the enum + default exactly as specified.

### W3.2 — Background download + stage
- [x] In `extensions/ritemark/src/update/updateService.ts`'s `notifyIfNeeded()` (private method), branch on `vscode.workspace.getConfiguration('ritemark.updates').get<string>('mode', 'auto')` — for `action === 'extension'` AND `mode === 'auto'`, call `this.installer.applyUpdate(manifest)` directly (bypassing `installExtensionUpdateWithProgress`'s `withProgress` wrapper) instead of calling `showExtensionUpdateNotification`.
  Done when: with `mode: 'auto'` and a mocked compatible extension release, no `vscode.window.showInformationMessage` call fires during the check, but `applyUpdate` is invoked (verify via a unit test or manual trace).
- [x] On successful silent `applyUpdate`, set `pendingRestartVersion` (reuse existing `storage.setPendingRestartVersion`) and trigger the status-bar item (W3.3) instead of `promptReloadWindow`'s dialog.
  Done when: after a successful silent stage, `storage.getPendingRestartVersion()` returns the new version AND the status-bar item is visible (manual QA, scenario S6).
  Wired via a constructor callback (`onUpdateStagedSilently`), not a direct import, to avoid a circular dependency between `updateService.ts` and `updateStatusBar.ts`; `extension.ts` connects the two (`new UpdateService(updateStorage, (v) => updateStatusBar.show(v))`).
- [x] On `applyUpdate` failure (checksum mismatch or any other throw), catch, log via `console.warn`, do NOT set `pendingRestartVersion`, do NOT show the status-bar item.
  Done when: a test/manual run with a deliberately-mismatched sha256 fixture confirms `pendingRestartVersion` remains unset after the call (scenario S8).
- [x] New/updated unit test file `extensions/ritemark/src/update/updateService.test.ts` (verify existence first — create if missing): cases for `mode: 'auto'` silent-success, `mode: 'auto'` checksum-failure (no state change), `mode: 'prompt'` unchanged notification path, `action: 'full'` unaffected by `mode`.
  Done when: `cd extensions/ritemark && npx tsx src/update/updateService.test.ts` passes all four cases, and this test is added to `package.json`'s `scripts.test` chain.
  **DONE 2026-07-12.** All 4 cases pass; also added to `scripts.test:update`. Vscode-stub pattern matches `BrowserToolsInjector.test.ts`'s precedent exactly — had to switch from static `import` to runtime `require()` for the vscode-dependent modules, since tsx's ESM-aware resolver bypasses a `Module._resolveFilename` stub for statically-imported modules but not for runtime `require()` calls.

### W3.3 — Status-bar item
- [x] Create `extensions/ritemark/src/update/updateStatusBar.ts`: exports a function/class managing a single `vscode.StatusBarItem` (hidden by default), `show(version: string)` sets text `"$(sync) Ritemark ${version} ready"` + tooltip + `command: 'ritemark.updates.relaunch'`, `hide()` reverses it.
  Done when: file compiles (`npm run compile` in `extensions/ritemark`) with no new TS errors.
- [x] Register command `ritemark.updates.relaunch` in `extensions/ritemark/src/extension.ts`: handler calls `vscode.commands.executeCommand('workbench.action.reloadWindow')`.
  Done when: `grep -n "ritemark.updates.relaunch" extensions/ritemark/src/extension.ts` shows the registration, and `package.json`'s `contributes.commands` lists it (check an existing internal-only command, if any, for the palette-visibility pattern first).
  **Decision: NOT added to `contributes.commands`.** Checked the existing internal-only command precedent (`ritemark.pinAgent` — zero `contributes.commands` entry, and no `menus.commandPalette`/`when:false` pattern exists anywhere in this codebase). The status-bar item's own `.command` binding works regardless of a `contributes.commands` declaration; omitting it matches the established convention for commands that aren't meant to be user-discoverable via the palette.
- [x] Wire `updateStatusBar.show()`/`hide()` into `extension.ts`'s activation + disposal (`context.subscriptions.push(...)`).
  Done when: status-bar item disposes cleanly on extension deactivation (verify via existing disposal pattern used elsewhere in the codebase, or standard VS Code pattern if this is the first status-bar item).
  `UpdateStatusBar` implements `dispose()`; pushed directly to `context.subscriptions` (same pattern as every other disposable in `extension.ts`).

### W3.4 — Apply-on-next-start verification (confirm hypothesis, minimal new code expected)
- [x] Read the actual VS Code core mechanism (under the `vscode/` submodule) by which the extension host resolves which `~/.ritemark/extensions/ritemark-*` directory is active on startup, confirming or correcting the `dataFolderName`-driven hypothesis in `technical-plan.md`.
  Done when: the exact file/mechanism is identified and documented in a one-paragraph note appended below this line, confirming (or correcting) that it picks the highest-compatible-version directory with no extra Ritemark code needed for R8.

  **CONFIRMED 2026-07-12.** `vscode/src/vs/platform/extensionManagement/common/extensionsScannerService.ts`. `ExtensionsScannerService.scanUserExtensions()` (line ~246) calls `applyScanOptions(..., { pickLatest: true })` unconditionally for user-installed extensions. `applyScanOptions` (line 353) calls `dedupExtensions()` (line 373) whenever `pickLatest` is set, which groups scanned extensions by `identifier.id` (e.g. `ritemark.ritemark` — the SAME id for every `ritemark-{version}` directory, since they all share the same `package.json` publisher+name) and keeps only the semver-highest version via `semver.gt(existing.manifest.version, extension.manifest.version)` (line 387). This is a completely generic mechanism — it has nothing to do with `dataFolderName` specifically (that config just controls WHERE `~/.ritemark/` lives; the version-picking logic is identical to how vanilla VS Code dedups any marketplace extension with multiple installed versions). **Hypothesis confirmed: zero new Ritemark code needed for R8** — every `ritemark-{version}` directory under `~/.ritemark/extensions/` is scanned as a normal user extension, and core's own scanner always wins with the highest semver, matching apply-on-next-start's required behavior exactly.
- [x] Regression-verify `updateService.ts`'s `reconcilePendingRestartVersion()` still correctly clears `pendingRestartVersion` once `getCurrentVersion()` matches or exceeds it, under the NEW silent-stage path from W3.2.
  Done when: existing/extended unit test confirms `pendingRestartVersion` clears after a simulated restart where `getCurrentVersion()` returns the staged version.

  **DONE 2026-07-12.** Added Test 5 to `updateService.test.ts`: sets `pendingRestartVersion` (simulating a completed silent stage), simulates a restart by making the mocked `vscode.extensions.getExtension()` report the staged version as current, then confirms `getStatusSnapshot()` (which calls `prepareState()` → `reconcilePendingRestartVersion()`) clears it and the status no longer reports `restart-required`. All 5 tests pass.

### W3.5 — Rollback safety
- [x] Confirm `cleanupOldVersions()` has zero call sites today: `grep -rn "cleanupOldVersions" extensions/ritemark/src/`.
  Done when: confirmed only the method's own definition matches (already verified during planning — re-confirm on the active branch before adding a call site).
  Reconfirmed clean before adding the new call site.
- [x] Add a call site: after a NEW version has successfully activated at least once (not merely staged), call `cleanupOldVersions` in a way that keeps N−1, not just the current version (this REQUIRES either changing `cleanupOldVersions`'s signature to accept a "keep these N versions" list, or calling it with awareness that it currently deletes everything except ONE version — pick one, document the choice).
  Done when: after a successful update + restart + confirmed activation, exactly TWO `ritemark-*` directories remain under `~/.ritemark/extensions/` (scenario S11).
  **Decision: changed the signature** to `cleanupOldVersions(keepVersions: string[])` (was a single `keepVersion: string`) — the only call site was this sprint's own new one, so no existing behavior to preserve. Verified with a fixture test (3 directories in, `cleanupOldVersions(['1.0.1','1.0.2'])` → exactly those 2 remain, the third is removed).
- [x] Implement the chosen activation-integrity signal (marker file or VS Code activation-failure hook — pick per `technical-plan.md` W3.5's two candidate approaches; document the choice with a one-paragraph rationale appended below this line before implementing).
  Done when: a fixture with a deliberately-broken staged `out/extension.js` (syntactically invalid, per the v1.7.1 "Invalid or unexpected token" precedent) results in the app successfully falling back to N−1 on next start, verified manually (scenario S10 — boot-time failure mode, difficult to unit test).

  **Decision: new `activationIntegrity.ts` module, a variant of candidate (a) using `context.globalState` (not a marker file — simpler, already the right mechanism: it's keyed by extension ID, not by directory path, so it survives a version swap for free).** `activate()` records "attempting version X" at its very start; only a clean synchronous return from `activate()` (no throw) promotes that to "confirmed X" and triggers `cleanupOldVersions([current, previousConfirmed])`. If the NEXT launch of the SAME version finds an "attempted" record with no matching "confirmed" one, that's a repeat crash-during-activation — the module quarantines (deletes) that version's own directory and prompts a reload, so VS Code's own scanner (W3.4) falls through to the kept N-1. Verified with 6 unit tests (`activationIntegrity.test.ts`): fresh state, dangling-attempt detection, confirmed-version safety, and no false-positive across different versions.

  **Honest limitation, NOT solved here (matches scenario S10's literal fixture exactly):** a *syntactically invalid* `out/extension.js` — the v1.7.1 precedent — throws at `require()`/module-load time, before a single line of `activationIntegrity.ts`'s own code (which lives inside that same broken module) can run. This mechanism only catches RUNTIME failures (an exception thrown during `activate()`'s body after the module loads successfully) — a real and probably more common bug class, but not the specific load-time fixture scenario S10 describes. Verified (by reading VS Code core, not by assertion) that this residual case is still soft-landed by VS Code itself: `extHostExtensionService.ts`'s `ExtensionsActivator` catches a module-load rejection and routes it through `onExtensionActivationError` → `$onExtensionActivationError` on the main thread (a notification/Output-panel entry), never crashing the extension host or the rest of the app — only Ritemark's own features go dark until the user manually reloads or a later good version supersedes it. A true fix for the load-time case needs a check BEFORE the extension host attempts to load the module at all, which is out of reach without a VS Code core patch (see the go/no-go note immediately below).
- [x] If the marker-file approach touches `product.json` or any bootstrap script under `scripts/`, run it back through W2.1's release-tier denylist mentally — confirm this sprint's OWN shell-tier guard wouldn't have blocked shipping this exact change as an extension release. If it would, flag to Jarmo before proceeding.
  Done when: an explicit go/no-go note is recorded in `sprint-plan.md`'s Product Decisions.
  **No tension found — recorded in sprint-plan.md.** The chosen approach (`context.globalState`, entirely within `extensions/ritemark/src/`) touches neither `product.json` nor any `scripts/` bootstrap file, so W2.1's own shell-tier guard would never have blocked shipping it as a fast-lane extension release. No escalation needed. The load-time-failure gap above is a genuinely separate, harder problem (would need a VS Code core patch) — recorded as an explicit follow-up decision, not silently absorbed into this sprint's scope.

## W4 — Process & harness

- [x] `CLAUDE.md` (repo root): add a "Release tiers" section — state the shell-vs-extension decision rule verbatim matching W2.1's denylist (including the two new sprint-91 paths).
  Done when: `grep -A20 "## Release [Tt]iers" CLAUDE.md` shows the rule with the same path list as `scripts/release-extension-preflight.sh`.
  Verified byte-identical via diff between the two files' path lists.
- [x] `.claude/skills/release/SKILL.md`: replace the stale "Workflow — Extension-only release" section (lines 187-195, describing `vsce package` — a mechanism this codebase does not use) with the real procedure (`./scripts/release-extension.sh <version>`, per-file manifest model), and state explicitly which gates DON'T apply (no notarization, no 60-min hardening, no Windows CI, no repo-visibility toggle). Do NOT touch Step 5 (CI dispatch) — already updated by sprint-91.
  Done when: `grep -n "vsce package" .claude/skills/release/SKILL.md` returns nothing, and the new section reads as a complete, accurate replacement.
  Confirmed zero matches. Step 5 (Full release workflow, a different section) untouched.
- [x] `.claude/agents/sprint-manager.md`: add a rule that every generated `sprint-plan.md` (both lightweight and full-track templates) must declare `Release tier: extension` or `Release tier: shell`, extension is default, shell requires naming the specific shell-tier path.
  Done when: both the lightweight and full-track sprint-plan templates in this file show a `Release tier:` line in their template body.
- [x] `.claude/agents/release-manager.md`: EXTEND the existing "Release Types" table / Workflow Overview (do not duplicate) with the asymmetric gate model — extension release = light gate (Jarmo tests via the in-app "Relaunch to update" flow or a local dev path, approval phrase), shell release = existing Gate 1 + Gate 2 + hardening + notarization, unchanged.
  Done when: the "Extension-only release" section (currently lines 115-124) explicitly states no notarization/hardening/Windows-CI/repo-toggle apply, without altering the full-release table above it.
  Rewrote as a single-step light-gate table (steps 0-3), explicitly listing what does NOT apply. Full-release table above is untouched.
- [x] `.claude/agents/qa-validator.md`: add a reference to a slim extension-tier QA checklist distinct from full `docs/releases/vX.Y.Z/TEST-CHECKLIST.md`. Define the slim checklist's shape (scoped to changed surfaces only) either inline or as a new template file `docs/releases/TEMPLATE-EXTENSION-QA.md` (decide at implementation time; note the choice here).
  Done when: qa-validator's doc references the slim checklist by name/path and states when it applies (extension-tier) vs. when the full checklist applies (shell-tier).
  **Decision: inline**, matching this document's own established style (the existing "Production Build Validation" section is already inline numbered checks, not a separate template file) — a 4-item slim checklist doesn't earn its own template file.
- [x] New `docs/development/RELEASING.md`: one-page guide for Jarmo — what an extension release is, what he does (test via the in-app "Relaunch to update" flow or a local dev install, test, say the approval phrase), what a shell release is and when it happens (~monthly, batched per the seamless-delivery analysis doc), FAQ, zero-jargon where possible.
  Done when: file exists, is under 1 printed page (~500-700 words), and a person with no engineering background could follow it to test a release.
  589 words.
- [x] Explicit no-op note: confirm no edits were made to `.codex/**` or `AGENTS.md` as part of this sprint — `harness-equalizer` syncs those automatically post-merge.
  Done when: `git diff --stat sprint-92-esbuild-bundling...sprint-93-seamless-delivery -- .codex AGENTS.md` (once the branch exists) returns empty output.
  Confirmed empty (checked against `main`, which is this branch's actual base since sprint-92 already merged there).

## Sprint close

- [ ] `qa-validator` sign-off (surface routing recommendation to the user at Phase 4→5).
- [ ] Jarmo local test pass covering the `scenarios.md` matrix (S1-S16).
- [x] Update `docs/development/architecture.md` if any subsystem shape changed beyond what sprint-92 already logged (new status-bar affordance, update-platform behavior change) — cross-check against the doc's Sprint Architecture Gate rule.
  Added a Version History row + bumped `Last updated`, covering the two new `src/update/` modules and the release-tier rule.
- [x] File the Phase E (native shell auto-update) GitHub `enhancement` issue on `ProductoryHQ/ritemark-native`, referencing this sprint and the source analysis doc, before closing.
  Filed as [#139](https://github.com/ProductoryHQ/ritemark-native/issues/139).

## Sequencing summary

- **Soft dependency on sprint-92** (see technical-plan.md) — W2.2's dynamic-enumeration fix is correct either way; sprint-92 only affects the RESULT SIZE, not correctness.
- **Independently completable within this sprint:** W2 and W3 have no cross-dependency on each other; W4 (docs) can be written in parallel with either.
- **Riskiest single item:** W3.5's activation-integrity signal (rollback) — flagged for a short implementation-time research note before coding, per `technical-plan.md`.

# Sprint 91 — Tasks

Every task lists concrete file paths, exact commands where applicable, and a binary "done when"
criterion. Organized by workstream, matching `technical-plan.md`.

## Prerequisite (BLOCKS this sprint's W1 tasks, not W2/W3/W4)

- [ ] Confirm v1.8.1 Windows CI is fully green end-to-end.
  Command: `gh run list --workflow=build-windows.yml --limit 3`
  Done when: latest run against `v1.8.1` (or its resolving commit) shows `success`, not `failure`/`in_progress`.
  Reference: `docs/releases/v1.8.1/WINDOWS-CI-HANDOVER.md`.

## W1 — CI / pipeline de-risk

### W1.1 — `workflow_dispatch` trigger swap
- [ ] Read `.github/workflows/build-windows.yml` and `.github/workflows/build-macos-x64.yml` end-to-end
  (CI-editing pre-audit rule, `release` skill).
  Done when: both files' full step lists are enumerated in your working notes before any edit.
- [ ] Edit `.github/workflows/build-windows.yml`: replace `on: push: tags: ['v*']` with
  `workflow_dispatch` + required `ref` input (default `main`).
  Done when: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-windows.yml'))"` exits 0.
- [ ] Edit `.github/workflows/build-macos-x64.yml` identically.
  Done when: same yaml-load check passes for this file.
- [ ] Update any step in both files that reads `github.ref_name` assuming a tag to instead read
  `github.event.inputs.ref` (or `inputs.ref` in the `workflow_dispatch` context).
  Done when: `grep -n "ref_name" .github/workflows/build-windows.yml .github/workflows/build-macos-x64.yml`
  shows zero remaining tag-assuming usages, OR each remaining usage is confirmed still correct under
  `workflow_dispatch` and documented inline.
- [ ] Update `.claude/skills/release/SKILL.md` Step 5 ("Tag + push (triggers CI)") to trigger builds
  explicitly: `gh workflow run build-windows.yml -f ref=vX.Y.Z` and
  `gh workflow run build-macos-x64.yml -f ref=vX.Y.Z`, run AFTER the tag push (tag push still happens
  for the release itself, just no longer drives CI as a side effect).
  Done when: Step 5's prose no longer implies the tag push alone triggers CI.
- [ ] Manual verification: push a test tag on a throwaway branch/tag, confirm `gh run list
  --workflow=build-windows.yml --limit 5` shows NO new run triggered by the tag push.
  Done when: confirmed no run started; clean up the throwaway tag afterward.
- [ ] Manual verification: `gh workflow run build-windows.yml -f ref=main`, confirm a run starts.
  Done when: `gh run list --workflow=build-windows.yml --limit 1` shows a new `in_progress`/`queued` run.

### W1.2 — Weekly Windows canary
- [ ] Create `.github/workflows/windows-canary.yml`: `schedule: cron: '0 6 * * 1'` +
  `workflow_dispatch: {}`, `runs-on: windows-latest`, steps = checkout (with submodules) → Node setup
  (same `NODE_VERSION` pin as `build-windows.yml`) → the same "Patch bundled node-gyp for VS2026
  detection" step logic as `build-windows.yml` → `npm ci` at repo root only.
  Done when: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/windows-canary.yml'))"` exits 0.
- [ ] Decide and implement: shared step (single source, referenced by both `build-windows.yml` and
  `windows-canary.yml`) vs. duplicated inline block. If duplicated, add an explicit code comment in
  both files cross-referencing the other, per the CI single-source-of-truth rule.
  Done when: node-gyp patch logic is either factored into one shared script both workflows call, or
  both files carry a `# KEEP IN SYNC WITH <other file>` comment at the step.
- [ ] Manual verification: `gh workflow run windows-canary.yml`, confirm the job completes (pass or a
  clear, actionable fail — not a silent skip).
  Done when: `gh run view <run-id> --log` shows the node-gyp / `npm ci` step actually executed.
- [ ] Confirm no repo-visibility toggle occurs for this workflow (grep for `gh repo edit` in the new
  file — must be absent).
  Done when: `grep -c "repo edit" .github/workflows/windows-canary.yml` returns `0`.

## W2 — One-command extension release

### W2.1 — Preflight script
- [ ] Create `scripts/release-extension-preflight.sh` with: clean-git check, release-tier guard,
  `engines.vscode` check, compile-clean check, webview-bundle-freshness + `ai-sidebar` sentinel check
  (reuse logic from `.claude/hooks/pre-commit-validator.sh` rather than reimplementing — read that
  hook first).
  Done when: script exits 0 on the current clean `main` tree and exits non-zero with a named-path
  reason when run against a synthetic diff touching `patches/001-ritemark-branding.patch`.
- [ ] Implement the release-tier guard's path denylist as a single array/variable in the script:
  `patches/`, `vscode` (submodule pointer), `branding/product.json`,
  `extensions/ritemark/binaries/agents/`, and the exact app-layout script list: `scripts/build-prod.sh`,
  `scripts/codesign-app.sh`, `scripts/create-dmg.sh`, `scripts/apply-patches.sh`,
  `scripts/update-vscode.sh`, `scripts/create-patch.sh` (confirm this list against
  `docs/development/architecture.md`/CLAUDE.md's own script inventory before finalizing).
  Done when: the denylist array in the script textually matches the list written into `CLAUDE.md`'s
  new "Release tiers" section (R11) — copy-paste identical, not independently authored.
- [ ] Implement `engines.vscode` check: read `extensions/ritemark/package.json` `.engines.vscode`
  (VERIFIED 2026-07-07: field exists, value `"^1.94.0"` — read it, don't add it), compare against
  the currently-built shell's VS Code version.
  Done when: script fails when a synthetic `engines.vscode` bump exceeds the shell version, passes
  when equal or lower.

### W2.2 — `scripts/release-extension.sh`
- [ ] Create `scripts/release-extension.sh` mirroring `scripts/release-dmg.sh`'s structure (colors,
  step numbering, `set -e`, `--dry-run` flag, version-format validation regex
  `^[0-9]+\.[0-9]+\.[0-9]+-ext\.[0-9]+$` — VERIFIED 2026-07-07: the `-ext.N` scheme is the update
  platform's native extension-release format (`versionComparison.ts:24` parses `1.2.3-ext.5` with
  `extBuild` as a fourth comparison component), so extension releases are versioned
  `<shellVersion>-ext.<N>`, e.g. `1.8.1-ext.1`).
  Done when: `bash -n scripts/release-extension.sh` exits 0.
- [ ] Step: call `scripts/release-extension-preflight.sh`; abort on non-zero.
- [ ] Step: build — `cd extensions/ritemark && npm run compile && cd webview && npm run build && cd ..`.
- [ ] Step: package zip excluding `binaries/agents/`, `webview/node_modules`, `webview/src` (keep
  `extensions/ritemark/node_modules` — runtime deps, per the v1.0.1 post-mortem in the `release` skill).
  Done when: `unzip -l <output>.zip | grep -c "binaries/agents/"` returns `0` and
  `unzip -l <output>.zip | grep -c "node_modules"` shows only the extension's own runtime deps present
  (not `webview/node_modules`).
- [ ] Step: sha256 + byte size — `shasum -a 256 <zip>` and `stat -f%z <zip>` (or `wc -c`).
- [ ] Step: generate `update-manifest.json` during packaging (schema: `src/update/updateManifest.ts`;
  supplies `installType: "user-extension"`, `extensionId: "ritemark"`, `extensionDirName`), then
  `node scripts/generate-update-feed.mjs --mode extension --version <v> --output <feed> --manifest
  <update-manifest.json>` (VERIFIED 2026-07-07 against the script, lines 168–258: extension mode
  requires `--manifest`, not `--asset`; the script merges into the existing feed and de-duplicates
  by version).
  Done when: the feed JSON output includes the new zip's entry with correct `sha256`/`size` matching
  the actual built artifact.
- [ ] Step: upload — `gh release create` (or edit existing) on `jarmo-productory/ritemark-public` with
  the zip + regenerated feed; set `minAppVersion` = current shell version (read from
  `branding/product.json`).
  Done when: `gh release view <tag> --repo jarmo-productory/ritemark-public` lists the zip asset and
  the feed JSON's `extensionReleases[].minimumAppVersion` matches the current shell version.
- [ ] Dry-run end-to-end test: `./scripts/release-extension.sh <test-version> --dry-run` against the
  current tree.
  Done when: script completes all steps up to (not including) the actual `gh release create`/upload,
  with no unhandled errors.

## W3 — Claude-Code-style update UX

### W3.1 — `mode` setting
- [ ] Edit `extensions/ritemark/package.json` `contributes.configuration` block: add
  `ritemark.updates.mode` (`enum: ["auto","prompt"]`, `default: "auto"`) next to the existing
  `ritemark.updates.enabled`/`ritemark.updates.dismissed` entries (around line 186).
  Done when: `grep -A4 '"ritemark.updates.mode"' extensions/ritemark/package.json` shows the enum +
  default exactly as specified.

### W3.2 — Background download + stage
- [ ] In `extensions/ritemark/src/update/updateService.ts`'s `notifyIfNeeded()`, branch on
  `vscode.workspace.getConfiguration('ritemark.updates').get<string>('mode', 'auto')` — for
  `action === 'extension'` AND `mode === 'auto'`, call the installer directly
  (`this.installer.applyUpdate(manifest)`) without the `withProgress` foreground wrapper, instead of
  calling `showExtensionUpdateNotification`.
  Done when: with `mode: 'auto'` and a mocked compatible extension release, no
  `vscode.window.showInformationMessage` call fires during the check, but `applyUpdate` is invoked.
- [ ] On successful silent `applyUpdate`, set `pendingRestartVersion` (reuse existing
  `storage.setPendingRestartVersion`) and trigger the status-bar item (W3.3) instead of
  `promptReloadWindow`'s dialog.
  Done when: after a successful silent stage, `storage.getPendingRestartVersion()` returns the new
  version AND the status-bar item is visible (verify via extension test harness or manual QA S8).
- [ ] On `applyUpdate` failure (checksum mismatch or any other throw), catch, log via `console.warn`,
  do NOT set `pendingRestartVersion`, do NOT show the status-bar item.
  Done when: unit test with a deliberately-mismatched sha256 fixture asserts `pendingRestartVersion`
  remains unset after the call.
- [ ] New/updated unit test file `extensions/ritemark/src/update/updateService.test.ts` (create if it
  doesn't exist — verify first): cases for `mode: 'auto'` silent-success,
  `mode: 'auto'` checksum-failure (no state change), `mode: 'prompt'` unchanged notification path,
  `action: 'full'` unaffected by `mode`.
  Done when: `cd extensions/ritemark && npm test -- updateService` passes all four cases.

### W3.3 — Status-bar item
- [ ] Create `extensions/ritemark/src/update/updateStatusBar.ts`: exports a function/class managing a
  single `vscode.StatusBarItem` (hidden by default), `show(version: string)` sets text
  `"$(sync) Ritemark ${version} ready"` + tooltip + `command: 'ritemark.updates.relaunch'`, `hide()`
  reverses it.
  Done when: file compiles (`npm run compile` in `extensions/ritemark`) with no new TS errors.
- [ ] Register command `ritemark.updates.relaunch` in `extensions/ritemark/src/extension.ts`: handler
  calls `vscode.commands.executeCommand('workbench.action.reloadWindow')`.
  Done when: `grep -n "ritemark.updates.relaunch" extensions/ritemark/src/extension.ts` shows the
  registration, and `extensions/ritemark/package.json`'s `contributes.commands` lists it (even if not
  surfaced in the command palette — set appropriate `when`/visibility if the codebase pattern requires
  explicit palette hiding for internal commands; check an existing internal-only command for the
  pattern first).
- [ ] Wire `updateStatusBar.show()`/`hide()` into `extension.ts`'s activation + disposal
  (`context.subscriptions.push(...)`).
  Done when: status-bar item disposes cleanly on extension deactivation (no leaked
  `vscode.StatusBarItem` — verify via existing disposal pattern used by other status-bar items or
  view providers in the codebase).

### W3.4 — Apply-on-next-start verification (no new code expected, but must confirm)
- [ ] Read the actual mechanism by which VS Code / the Ritemark bootstrap resolves which
  `~/.ritemark/extensions/ritemark-*` directory is active on startup (built in Sprint 42 — locate the
  relevant code, likely in `product.json`'s `extensionsGallery`/`builtInExtensions` wiring or a custom
  resolver).
  Done when: the exact file/mechanism is identified and documented in a one-paragraph note in this
  tasks.md (append below this line once found), confirming it picks the highest-versioned directory
  with no extra work needed for R8.
- [ ] Regression-verify `updateService.ts`'s `reconcilePendingRestartVersion()` still correctly clears
  `pendingRestartVersion` once `getCurrentVersion()` matches or exceeds it, under the NEW silent-stage
  path from W3.2 (not just the old notification path).
  Done when: existing/extended unit test confirms `pendingRestartVersion` clears after a simulated
  restart where `getCurrentVersion()` returns the staged version.

### W3.5 — Rollback safety
- [ ] Audit ALL current call sites of `UserExtensionInstaller.cleanupOldVersions()`.
  Command: `grep -rn "cleanupOldVersions" extensions/ritemark/src/`
  Done when: every call site is listed with file:line in this tasks.md (append below this line).
- [ ] Change cleanup timing so N−1 is retained until the current version has activated successfully at
  least once (exact mechanism per the two candidate approaches in `technical-plan.md` W3.5 — pick one,
  document the choice with a one-paragraph rationale appended to this tasks.md before implementing).
  Done when: after a successful update + restart + confirmed activation, exactly TWO `ritemark-*`
  directories remain under `~/.ritemark/extensions/` (current + N−1), not one, not three+.
- [ ] Implement the chosen activation-integrity signal (marker file or VS Code activation-failure
  hook — per technical-plan.md).
  Done when: a fixture with a deliberately-broken staged `extension.js` (syntactically invalid, per
  the v1.7.1 "Invalid or unexpected token" precedent) results in the app successfully falling back to
  N−1 on next start, verified manually (S12) since this is a boot-time failure mode difficult to unit
  test.
- [ ] If the marker-file approach touches `product.json` or any bootstrap script under `scripts/`,
  run it back through the W2.1 release-tier denylist mentally — confirm this sprint's OWN shell-tier
  guard wouldn't have blocked shipping this exact change as an extension release. If it would, flag to
  Jarmo before proceeding (this is a genuine tension the sprint's own rule should catch, not paper
  over).
  Done when: an explicit go/no-go note is recorded in `sprint-plan.md`'s Product Decisions.

## W4 — Process & harness

- [ ] `CLAUDE.md` (repo root): add "Release tiers" section after the existing "VS Code Patch System"
  section (or wherever fits the doc's existing flow) — state the shell-vs-extension decision rule
  verbatim matching W2.1's denylist.
  Done when: `grep -A20 "## Release [Tt]iers" CLAUDE.md` shows the rule with the same path list as
  `scripts/release-extension-preflight.sh`.
- [ ] `.claude/skills/release/SKILL.md`: add an "Extension Release — one-command procedure" section
  documenting `./scripts/release-extension.sh <version>` and stating explicitly which gates DON'T
  apply (no notarization, no 60-min hardening, no Windows CI, no repo-visibility toggle). Also fold in
  the W1.1 Step-5 trigger update here (may already be done in W1.1 — cross-check, don't duplicate).
  Done when: the skill's Table of Contents / section list includes the new extension-release
  procedure and it reads as a complete replacement for the old "Workflow — Extension-only release"
  manual-steps section (lines 180–188) — update or remove that stale section rather than leaving both.
- [ ] `.claude/agents/sprint-manager.md`: add a rule that every generated `sprint-plan.md` (both
  lightweight and full-track templates) must declare `Release tier: extension` or `Release tier:
  shell`, extension is default, shell requires naming the specific shell-tier path.
  Done when: both the lightweight and full-track sprint-plan templates in this file show a `Release
  tier:` line in their template body.
- [ ] `.claude/agents/release-manager.md`: document the two-tier gate model explicitly — extension
  release = light gate (Jarmo installs zip in-app or via local dev path, tests changed surfaces,
  approval phrase), shell release = existing Gate 1 + Gate 2 + hardening + notarization (unchanged;
  do not weaken the shell-tier rules while adding this).
  Done when: the "Release Types" / "Workflow Overview" tables in this file show both tiers with their
  correct (asymmetric) gate requirements.
- [ ] `.claude/agents/qa-validator.md`: add a reference to a slim extension-tier QA checklist distinct
  from full `TEST-CHECKLIST.md`. Define the slim checklist's shape (scoped to changed surfaces only,
  no full regression sweep) either inline or as a new template file
  `docs/releases/TEMPLATE-EXTENSION-QA.md` (decide which at implementation time; note the choice here).
  Done when: qa-validator's doc references the slim checklist by name/path and states when it applies
  (extension-tier releases) vs. when the full checklist applies (shell-tier releases).
- [ ] New `docs/development/RELEASING.md`: one-page guide for Jarmo — what an extension release is,
  what he does (install zip in-app / via a local dev install path, test, say the approval phrase),
  what a shell release is and when it happens (~monthly, batched), FAQ (why did I get two kinds of
  updates? what if I skip an update? etc.), zero-jargon where possible.
  Done when: file exists, is under 1 printed page (~500-700 words), and a person with no engineering
  background could follow it to test a release.
- [ ] Explicit no-op note: confirm no edits were made to `.codex/**` or `AGENTS.md` as part of this
  sprint — `harness-equalizer` syncs those automatically post-merge.
  Done when: `git diff --stat main...sprint-91-seamless-updates -- .codex AGENTS.md` (once the branch
  exists) returns empty output.

## W-D — GH #105 esbuild bundling (droppable — see Mid-Sprint Scope Change Protocol)

- [ ] Audit `extensions/ritemark/src/**` for dynamic `require()`/`import()` calls that assume a
  relative `out/` multi-file layout.
  Command: `grep -rn "require(\`\|require(path\.\|import(\`" extensions/ritemark/src/`
  Done when: every match is triaged as "safe under bundling" or "needs rework", listed in this
  tasks.md.
- [ ] Audit native/binary dependencies that must stay external.
  Command: `find extensions/ritemark/node_modules -name "*.node" -o -name "binding.gyp"`
  Done when: full list recorded; cross-check against `binaries/agents/` (already excluded from the
  extension zip per W2.2, but must ALSO be excluded from the esbuild bundle, not physically bundled).
- [ ] Write esbuild config (new `extensions/ritemark/esbuild.config.js` or equivalent) with
  `entryPoints: ['src/extension.ts']`, `bundle: true`, `platform: 'node'`, `external: ['vscode',
  ...nativeDeps]`, `outfile: 'out/extension.js'`.
  Done when: `node extensions/ritemark/esbuild.config.js` (or equivalent npm script) produces a single
  `out/extension.js` and the extension activates in a dev-mode launch with no `Cannot find module`
  errors (manual QA, dev instance).
- [ ] Update `package.json` build scripts (`npm run compile` or a new `npm run bundle`) to invoke
  esbuild instead of / in addition to `tsc` (tsc may still be needed for type-checking only, with
  `noEmit`, if the codebase wants to keep type errors surfaced separately from bundling — decide and
  document).
  Done when: `cd extensions/ritemark && npm run compile` produces the bundle AND surfaces TS type
  errors (verify by deliberately introducing a type error and confirming the command fails).
- [ ] Audit `.claude/hooks/pre-commit-validator.sh` and `scripts/validate-build-output.sh` for any
  hardcoded expectation of a multi-file `out/` tree; update if found.
  Done when: both scripts pass against the newly-bundled `out/` structure.
- [ ] Full prod build + manual QA (S17): `./scripts/build-prod.sh`, launch the app, verify editor
  loads, AI sidebar loads, Settings loads, no activation errors in the dev console / logs.
  Done when: all three surfaces confirmed working, zero activation errors observed.
- [ ] `docs/development/architecture.md`: add the ARCH debt entry (confirm the actual next-available
  ARCH number — do not hardcode 105) documenting what was bundled and why.
  Done when: the entry exists and is cross-referenced from this sprint's `sprint-plan.md`.
- [ ] **Scope-change checkpoint:** if the two audit tasks above surface a large/fragile rework list,
  invoke Mid-Sprint Scope Change Protocol and drop W-D to a follow-on sprint (`sprint-92` or later).
  Record the decision (ship or defer) in `sprint-plan.md`'s Product Decisions either way.

## Sprint close

- [ ] `qa-validator` sign-off (surface routing recommendation to the user at Phase 4→5).
- [ ] Jarmo local test pass covering S1–S18 (or the subset still in scope if W-D was dropped).
- [ ] Update `docs/development/architecture.md` beyond the W-D entry if any other subsystem shape
  changed (update platform behaviour change, new status-bar affordance) — cross-check against the
  doc's existing "update at end of every sprint that changes extension structure" rule (CLAUDE.md).
- [ ] File the Phase E (native shell auto-update) GitHub `enhancement` issue on
  `ProductoryHQ/ritemark-native`, referencing this sprint and the source analysis doc, before closing.

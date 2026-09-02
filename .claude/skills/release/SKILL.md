---
name: release
description: Procedural commands and gotchas for Ritemark Native releases — version bump, signing, DMG creation, notarization, GitHub Actions toggling, update feed publication. Use when the release-manager agent needs concrete commands or when the user is performing release steps directly.
allowed-tools: Read, Bash, Glob, Grep
metadata:
  version: 1.0.0
---

# Release Skill — Procedural Reference

Companion skill to `release-manager` agent. The agent owns workflow + gate enforcement; this skill owns the concrete commands.

## When to use

- A release-manager run reaches a step that needs exact bash commands.
- The user is doing release steps without invoking the agent.
- Notarization, signing, or GitHub Release commands need to be looked up.
- GitHub Actions Windows build needs the public/private repo toggle.

## Release Types

| Type | Trigger | Version Format |
|---|---|---|
| Full release | VS Code core / patches / branding changed | `X.Y.Z` (e.g. `1.7.0`) |
| Extension-only | Changes confined to `extensions/ritemark/` | `X.Y.Z-ext.N` (e.g. `1.7.0-ext.1`) |


## DLC Planning Precheck

Before Step 0 for any full or extension-only release, check the parent release plan and milestone:

```bash
test -f docs/development/releases/vX.Y.Z/release-plan.md
gh api repos/ProductoryHQ/ritemark-native/milestones --paginate --jq '.[].title' | grep -qx 'vX.Y.Z'
```

Do not start version bumps, tags, packaging, or GitHub release work until the release plan says the release is feature complete or a release candidate.

## Workflow — Full release (DMG)

### ⛔⛔ TWO HARD RULES THAT GOVERN NOTARIZATION ORDER ⛔⛔

These override the convenience of doing sign+DMG+notarize in one shot. Notarization is a limited Apple resource (a team-eligibility hold once cost weeks — case 102892219755). Never spend a submission on an untested or unsettled build.

1. **Jarmo tests the UN-notarized build, never the notarized one.** Gate 1 (arm64) and Gate 2 (x64/Windows) happen on the signed-but-not-notarized DMG. Notarization is the LAST step before publish, run only after the relevant gate has passed. By the time anything is notarized, it is already approved — so Jarmo never tests a notarized app.
2. **60-minute hardening period between DMG build and notarization.** After a DMG is built, wait ≥60 min before notarizing it — even if Gate approval comes sooner. This settling window is to let late bugs surface. If a bug surfaces in the window, rebuild and reset both the clock and the gate. The build timestamp starts the clock; Gate-approval time does not.

Sequence: **build DMG → Jarmo tests un-notarized → ≥60 min hardening (no new bugs) → notarize → publish.**

### Step 0 — Pre-flight

```bash
node ./scripts/worktree-hygiene.mjs --check
./scripts/create-release-worktree.sh
# cd to the new path printed by the command
./scripts/release-preflight.sh
```

Review the hygiene report before `--clean`. The release worktree must be new,
detached at the exact `origin/main` commit, and contain a physical pristine VS
Code submodule. Preflight hard-blocks local patches, shared dependencies, old
output, and any source drift. If the release source gate fails, discard the RC
worktree and recreate it; do not repair it in place.

### Step 1 — Version bump (no tag yet)

1. Make the version changes on a dedicated release-prep branch.
2. Edit `branding/product.json` — bump `version`.
3. Edit `extensions/ritemark/package.json` — bump `version`.
4. Commit, push, and merge through the normal protected-main workflow.
5. Fetch `origin/main`; the previous preflight worktree is now invalid.

**Do NOT create the tag yet** — tag push triggers CI; we wait until Gate 1 passes.

### Step 2 — Build macOS arm64 (local)

```bash
node ./scripts/worktree-hygiene.mjs --check
./scripts/create-release-worktree.sh
# cd to the new path, then:
./scripts/release-preflight.sh
arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use "$(cat vscode/.nvmrc)" && ./scripts/build-prod.sh 2>&1'
```

This second fresh worktree is mandatory because the version commit changed
`origin/main`. `build-prod.sh` uses `npm ci`, applies canonical patches itself,
requires empty output, and embeds `ritemark-build-provenance.json`. Run as a
background task with `timeout: 600000` (10 min cap). Never pipe through
`tail`/`head` — buffering hangs background mode.

Generate test checklist in `docs/releases/vX.Y.Z/TEST-CHECKLIST.md`.

### Step 3 — Sign + DMG arm64 (NO notarization yet)

```bash
./scripts/codesign-app.sh
./scripts/create-dmg.sh
```

Output: `dist/Ritemark-X.Y.Z-darwin-arm64.dmg` (signed Developer ID, **NOT notarized, NOT stapled**).

⛔ **DO NOT run `notarize-dmg.sh` here.** Notarization happens only AFTER Gate 1 passes (see HARD RULE below). Record the DMG build timestamp — the 60-min hardening clock starts now.

### ⛔ Gate 1 — Jarmo tests the UNNOTARIZED signed DMG

**Jarmo always tests the un-notarized build.** Notarized binaries are never the thing Jarmo tests — by the time we notarize, the build is already approved.

Surface to user: "Signed (un-notarized) arm64 DMG ready at `dist/Ritemark-X.Y.Z-darwin-arm64.dmg`. Please install and test. Because it isn't notarized yet, Gatekeeper will warn — right-click the app → **Open**, or run `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'` after copying it in."

Wait for: "approved", "DMG approved", "GATE 1 passed".

### Step 4 — Hardening period + notarize arm64

⛔ **HARD RULE — hardening period (min 60 min between DMG build and notarization).** After the DMG is built (Step 3), wait **at least 60 minutes** before notarizing — even after Gate 1 approval. This window lets late-surfacing bugs appear before we spend an Apple notarization submission. If Gate 1 takes longer than 60 min, the window is already satisfied; if Jarmo approves fast, **still wait out the remainder of the hour.** If ANY bug surfaces during the window → rebuild, and the clock + Gate 1 reset.

Why: Apple notarization submissions are a limited/rate-sensitive resource and a long team-eligibility hold (case 102892219755, lifted 2026-05-29) cost weeks. Never burn a submission on a build that hasn't been tested and allowed to settle.

Only once **(a)** Gate 1 has passed AND **(b)** ≥60 min have elapsed since the DMG build with no new bugs:

```bash
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
```

This notarizes AND staples. Verify staple + Gatekeeper acceptance before proceeding.

### Step 5 — Dispatch CI builds (Windows + macOS x64)

> **Changed in v1.8.2:** CI no longer auto-triggers on tag push. `build-windows.yml` and `build-macos-x64.yml` are `workflow_dispatch`-only. Dispatch them explicitly against the release ref. The build version is read from `branding/product.json`, **not** the git ref, so any ref (branch, tag, or commit) works — you do NOT need to create the tag to build. Create the tag later, at publish time (Step 8).

**Toggle repo to private first** — public repos cannot use larger Windows runners:

```bash
gh repo edit ProductoryHQ/ritemark-native --visibility private --accept-visibility-change-consequences
```

Dispatch both builds against the release ref (e.g. `main`, or the release branch/commit):

```bash
gh workflow run build-macos-x64.yml --ref <ref>
gh workflow run build-windows.yml  --ref <ref>
```

`<ref>` must resolve to the exact already-approved `origin/main` source commit.
Both workflows independently initialize the recorded VS Code gitlink, use
frozen installs, run the clean-source gate, and embed provenance.

After the Windows build completes (Step 6), toggle back:

```bash
gh repo edit ProductoryHQ/ritemark-native --visibility public --accept-visibility-change-consequences
```

### Step 6 — Download + sign macOS x64 (NO notarization yet)

Wait for `build-macos-x64.yml` to finish:

```bash
gh run list --workflow=build-macos-x64.yml --limit 3
gh run download <run-id> --name ritemark-darwin-x64 --dir VSCode-darwin-x64
./scripts/codesign-app.sh darwin-x64
./scripts/create-dmg.sh x64
```

Output: `dist/Ritemark-X.Y.Z-darwin-x64.dmg` (signed, **NOT notarized**). Same rule as arm64 — record the DMG build timestamp; **do NOT notarize until Gate 2 passes AND ≥60 min hardening have elapsed.**

### ⛔ Gate 2 — Jarmo tests UNNOTARIZED x64 DMG + Windows installer

```bash
gh run list --workflow=build-windows.yml --limit 3
# Jarmo downloads Windows artifact + the signed (un-notarized) x64 DMG, tests both
```

Same as Gate 1: Jarmo tests the **un-notarized** x64 build (Gatekeeper right-click → Open). Wait for: "x64 approved", "Windows approved", "GATE 2 passed".

### Step 7 — Hardening period + notarize x64

Apply the same ⛔ **60-min hardening rule** as Step 4. Only after Gate 2 passes AND ≥60 min have elapsed since the x64 DMG build with no new bugs:

```bash
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-x64.dmg
```

Notarizes + staples. Verify before proceeding to Step 8.

### Step 8 — GitHub Release + update feed

```bash
cp dist/Ritemark-X.Y.Z-darwin-arm64.dmg dist/Ritemark-arm64.dmg
cp dist/Ritemark-X.Y.Z-darwin-x64.dmg   dist/Ritemark-x64.dmg

gh release create vX.Y.Z --repo jarmo-productory/ritemark-public \
  --title "Ritemark vX.Y.Z" \
  --notes-file docs/releases/vX.Y.Z.md \
  dist/Ritemark-arm64.dmg \
  dist/Ritemark-x64.dmg \
  installer/windows/Ritemark-X.Y.Z-win32-x64-setup.exe
```

**Update feed (MANDATORY):** regenerate canonical update metadata, verify it matches the published assets, publish to canonical location. Contract: `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`.

If feed/metadata is stale or missing, the release is BLOCKED — even if binaries are uploaded.

### Step 9 — Post-release

Surface to user: "Recommend invoking `product-marketer` for changelog, release notes, landing-page copy."

## Workflow — Extension-only release (Sprint 93)

For changes confined to `extensions/ritemark/` — i.e. extension-tier per `CLAUDE.md`'s "Release Tiers" section. This codebase does **not** use `vsce`/`.vsix` packaging anywhere — that text was stale/aspirational from an earlier draft. The real mechanism is a per-file manifest + canonical update feed, matching `src/update/userExtensionInstaller.ts`'s download-per-file model.

1. Bump version in `extensions/ritemark/package.json` to `X.Y.Z-ext.N`.
2. `./scripts/release-extension.sh X.Y.Z-ext.N` — runs `release-extension-preflight.sh` first (clean tree, release-tier guard, `engines.vscode` check, compile-clean, webview-freshness), then builds the manifest + files into `release-staging/upload/` and generates the canonical update feed via `generate-update-feed.mjs --mode extension`.
3. Review `release-staging/upload/` — the script prints (does not auto-run) the exact `gh release create` command to publish.
4. **Light gate, not the full Gate 1/Gate 2 process below:** Jarmo tests via the in-app "Relaunch to update" flow (or a local dev install pointed at the staged files) on the changed surfaces only, then gives the approval phrase. No notarization, no 60-min hardening wait, no Windows CI dispatch, no repo-visibility toggle — none of those apply to an extension-only release.
5. Only after Jarmo's approval: run the `gh release create` command the script printed, uploading the individual files from `release-staging/upload/` (never a `.vsix`).

See `docs/development/RELEASING.md` for the plain-language version Jarmo can follow without engineering background.

## Gotchas

### Notarize DMG, not .app

`./scripts/notarize-dmg.sh` is the canonical script. `notarize-app.sh` is **deprecated** — using it bypasses Gatekeeper for DMG installs.

### Windows builds — public/private repo toggle

GitHub does NOT allow larger runners (windows-8core) on public repos. Before dispatching `build-windows.yml` (Step 5, `gh workflow run`), switch repo to private. After the Windows build completes, switch back to public. Without the toggle, the Windows build fails with a billing/permissions error. (A separate `windows-canary.yml` runs weekly on the FREE `windows-latest` standard runner — no toggle needed — to catch runner-image toolchain breakage early; see W4.)

### Node version + architecture

Production builds require **arm64 Node at the version pinned by `vscode/.nvmrc`**. A machine default or Rosetta/x64 Node is not a release input. Always use the `arch -arm64 /bin/zsh` invocation and `nvm use "$(cat vscode/.nvmrc)"`.

### x64 from CI, never cross-compiled

x64 macOS builds come from GitHub Actions (`build-macos-x64.yml`), not from cross-compiling on arm64. Cross-compiling produces broken arm64-tainted x64 binaries.

### Build output buffering

NEVER pipe `./scripts/build-prod.sh` through `| tail` or `| head` — buffering hangs in background mode. Run as background task with full timeout.

### `gulp vscode-darwin-arm64` is not enough

Direct `gulp` skips the extension copy step → broken app. ALWAYS use `./scripts/build-prod.sh`.

### Extension-only hot-copy (skips full rebuild)

For changes confined to extension code:

```bash
cp -R extensions/ritemark/out/* "VSCode-darwin-arm64/Ritemark Native.app/Contents/Resources/app/extensions/ritemark/out/"
```

This is development-only. A hot-copied app has invalid provenance and must
never be signed, packaged, or described as an RC.

### Clean build and worktree contract

The authoritative contract is
`docs/development/release-process/BUILD-AND-WORKTREE-HYGIENE.md`.

- Audit after merge/close, at sprint close, before RC creation, and weekly:
  `node ./scripts/worktree-hygiene.mjs --check`.
- Use `--clean` only after reviewing classifications. Never override `BLOCKED`.
- Every RC begins with `./scripts/create-release-worktree.sh`.
- `codesign-app.sh` and `create-dmg.sh` refuse missing or mismatched provenance.
- Any source change or rebuild creates a new candidate and resets the relevant gate.

## Past incidents (institutional memory)

### v1.0.1 — broken DMG (2026-01-14)

Three root causes compounded:

1. **`node_modules` stripped from extension during DMG copy** → TipTap webview wouldn't load. When copying the extension to the app bundle, only remove `webview/node_modules` and `webview/src`. NEVER remove `extensions/ritemark/node_modules` — those are runtime dependencies. Hard check 7 (node_modules has 100+ packages) catches this regression.
2. ~~**`Info.plist` version not updated**~~ — **RETRACTED (2026-05-12).** `Info.plist CFBundleShortVersionString` always shows the VS Code base version (e.g. `1.117.0`) for ALL Ritemark releases — this is expected and correct. Ritemark's version is authoritative only in `product.json` (`ritemarkVersion`). The About dialog and update system (`versionService.ts`) both read from `product.json`, not `Info.plist`. Do NOT run PlistBuddy to patch the bundle version; do NOT flag this in release audits.
3. **0-byte source file corruption** (random source files became 0 bytes — TS, SVG, configs, even node_modules type defs). Detection: `find extensions/ritemark/src -name "*.ts" -size 0`. Fix: `git checkout HEAD -- extensions/ritemark/`, reinstall node_modules, rebuild webview. Root cause unconfirmed (disk / sync tool / system process).

### v1.7.1 — corruption + incremental tsc trap (2026-05-25)

Rebuilding v1.7.1 after the same 0-byte corruption pattern produced a DMG that installed cleanly but the editor was blank — Ritemark extension failed to activate with `'ritemark.ritemark' failed: Invalid or unexpected token`.

Root cause: when corruption zeroes `.js` files in `extensions/ritemark/out/`, **`git checkout HEAD -- extensions/ritemark/` does not restore them** because `out/` is gitignored. The subsequent build then runs `tsc -p ./` in incremental mode (`.tsbuildinfo` cache). tsc sees the `.ts` source unchanged vs. the cache, decides nothing needs recompilation, and leaves the 0-byte `.js` files in place. `build-prod.sh` copies the broken extension into the app bundle. Pre-flight only checks `extension.js` and `ritemarkEditor.js` sizes, not the deep tree, so the broken DMG passes Gate 1's automated checks.

At runtime, VS Code loads `extension.js` (non-empty), which `require()`s `./codex/codexManager` (0 bytes) → V8 throws "Invalid or unexpected token" → entire Ritemark extension fails to activate → editor pane blank.

**Detection (run after any corruption restore, before rebuild):**

```bash
find extensions/ritemark/out -type f -size 0 -name "*.js" | wc -l    # should be 0
find VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/extensions/ritemark/out -type f -size 0 -name "*.js" | wc -l    # should be 0 after build
```

**Fix:**

```bash
cd extensions/ritemark && rm -rf out && npm run compile    # forces tsc to rebuild every .js
```

Then re-run `build-prod.sh`. Don't trust tsc incremental after a corruption event — the `.tsbuildinfo` cache is now lying.

**Rule:** any time you've restored corrupted files via `git checkout`, treat `extensions/ritemark/out/` as poisoned and force a clean recompile before the production build.

### Quick comparison test

When TipTap doesn't load, mount the working previous DMG and the broken new DMG side-by-side, then `diff` the extension folder listings:

```bash
hdiutil attach dist/Ritemark-1.0.0-darwin-arm64.dmg -mountpoint /tmp/v100
hdiutil attach dist/Ritemark-1.0.1-darwin-arm64.dmg -mountpoint /tmp/v101
diff <(ls /tmp/v100/Ritemark.app/Contents/Resources/app/extensions/ritemark/) \
     <(ls /tmp/v101/Ritemark.app/Contents/Resources/app/extensions/ritemark/)
hdiutil detach /tmp/v100; hdiutil detach /tmp/v101
```

### Key takeaways

1. Never strip `node_modules` from the extension — runtime, not dev-only.
2. Always update `Info.plist` version (Finder reads it, not product.json).
3. Compare with the last working build when debugging — diff reveals missing pieces fast.
4. Watch for 0-byte files (corruption signal); restore from git.
5. Test the actual DMG, not just the source app bundle.
6. After any corruption restore: `rm -rf extensions/ritemark/out && npm run compile` before `build-prod.sh`. Incremental tsc will silently keep 0-byte `.js` artifacts otherwise (v1.7.1).

## CI workflow editing — pre-push audit (HARD RULE)

Before editing ANY GitHub Actions workflow file (`.github/workflows/*.yml`), follow this checklist. Skipping it costs 20–30 min per CI iteration; v1.6.3 burned ~5 hours across 5 commits because the checklist wasn't followed.

### Mandatory pre-edit audit

1. **Read the ENTIRE workflow file end-to-end first.** Not just the failing step. Map every step:
   - Does the step run **inline shell** in YAML, or call **a script** in `scripts/`?
   - Is similar logic **duplicated** between inline YAML and a script? (Hidden drift hazard.)
2. **Compare cross-platform workflow pairs.** When changing one workflow, also read the sibling. Differences between `build-macos-x64.yml` and `build-windows.yml` are often where bugs hide:
   - macOS step succeeds where Windows fails because Mac runner is more lenient (symlinks, line endings, `file(1)` format).
   - x64 macOS workflow may be missing a step the arm64 build does locally.
3. **For every fix:** before pushing, answer aloud "What code path runs in the failing step?" then verify your edit lands in that exact file. If the failing step is `inline:`, editing a `scripts/` file fixes nothing.
4. **Bash + YAML syntax checks before commit:**
   ```bash
   bash -n scripts/foo.sh
   python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-windows.yml'))"
   ```
5. **Where possible, run the same command path locally.** E.g. `./scripts/validate-build-output.sh win32-x64` works on Mac (it's cross-host pre-flight aware) — surfaces script bugs before the 25-min CI run does.

### Cross-platform CI pitfalls catalogue (Windows vs macOS runners)

| Pitfall | Symptom | Fix |
|---|---|---|
| **Python `print()` emits CRLF on Windows pipes** | `bash read -r IFS="|"` reads `tar.gz\r` (length 7) → `case` doesn't match | `sys.stdout.reconfigure(newline="\n")` after `import sys`, AND strip `${var%$'\r'}` on bash side (belt-and-braces) |
| **Git Bash `cp -R` cannot replicate macOS symlinks** | `cp: cannot create symbolic link '...libggml-base.0.dylib'` | Strip `binaries/darwin-*/` BEFORE `cp -R` on Windows runners. NEVER remove that line without solving symlinks first. |
| **`file(1)` output format drift across MSYS / Git Bash / libmagic versions** | `grep -qF "PE32+ executable (console) x86-64, for MS Windows"` misses runner output `"PE32+ executable for MS Windows 6.00 (console), x86-64, 7 sections"` | Two-token check (`PE32+` AND `x86-64`) + MZ magic-byte fallback (`od -An -N2 -tx1` → `4d5a`). Pattern is a hint, magic bytes are truth. |
| **`stat -f%z` (BSD) returns 0 on Git Bash; GNU expects `-c%s`** | size gates fail on valid build outputs | `file_size()` helper trying `-f%z` then `-c%s` then `wc -c`. |
| **`python3` not always on Windows PATH; only `python`** | `command not found` mid-script | Probe `for py in python3 python; do ...; done` and use the first hit. |
| **Inline YAML duplicates a script's logic** | Fix to script doesn't reach CI because workflow inlines its own copy | Single source of truth: delete inline, call the script. Two places = drift. |
| **Tag `--force` retriggers ALL `tag: 'v*'` workflows** | Earlier in-progress runs become wasted artifacts | Plan tag moves: only re-tag once per commit you actually want shipped. |
| **gh auth account drift** | `HTTP 404 Not Found` on a repo that exists | `gh auth status` to check active account. Switch with `gh auth switch --user <handle>`. ProductoryHQ repos need `jarmo-productory`. |

### Architecture rule: validation lives in scripts, not YAML

Validation logic for a build artifact (size checks, manifest cross-refs, arch verification, signing checks) MUST live in `scripts/validate-build-output.sh` (or a sibling). Workflows call the script. Workflows do not duplicate the logic inline.

Why: when the validation rule changes (e.g. `file(1)` format drift), the fix is one commit in one file. If the logic is duplicated inline in YAML, the fix may land in the script while CI still runs the stale inline copy — exact failure mode that cost 4 commits in v1.6.3.

When you find inline validation in a workflow, the right move is **replace inline with `./scripts/validate-build-output.sh <target>`** — preserves Layer 2 fallbacks, single source of truth, smaller workflow file.

### v1.6.3 post-mortem (for future reference)

| Commit | Intent | What broke after | Lesson |
|---|---|---|---|
| A `956665b` | Strip foreign agent platforms from .app | Removed `rm -rf binaries/darwin-arm64` thinking it was a buggy dictation strip; it was actually a Windows symlink workaround | Don't remove "looks wrong" lines without testing on the platform that step actually runs on |
| B `f7cbe10` | Fix CRLF in Python→bash pipe | Hit the symlink regression from Commit A | Always read end-to-end before pushing — would have caught both at once |
| C `82174be` | Restore Windows symlink-strip with comment | Hit `file(1)` format drift in arch check | Reading full workflow earlier would have flagged inline arch check |
| D `7dc66e5` | Add Layer 2 fallback in `validate-build-output.sh` | Windows CI didn't call the script — has its own inline check | Always verify the fix lands in the failing code path |
| E `ef99417` | Replace inline arch check with script call | ✅ Both runs green | Single source of truth |

If v1.6.3 had run the pre-edit audit, Commits A→D would have collapsed into a single first-pass commit that read both workflows fully, identified all the platform-specific quirks, and shipped one consolidated fix.

## References

- Update feed contract: `docs/development/sprints/sprint-42-unified-update-platform/research/update-feed-contract.md`
- Test checklist template: `docs/releases/vX.Y.Z/TEST-CHECKLIST.md` (per-release)
- Pre-flight script: `scripts/release-preflight.sh`
- Build script: `scripts/build-prod.sh`
- Sign + DMG + notarize: `scripts/codesign-app.sh`, `scripts/create-dmg.sh`, `scripts/notarize-dmg.sh`
- Validation script: `scripts/validate-build-output.sh` (cross-platform aware: `darwin-arm64` / `darwin-x64` / `win32-x64`)

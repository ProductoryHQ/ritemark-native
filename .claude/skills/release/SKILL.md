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

## Workflow — Full release (DMG)

### Step 0 — Pre-flight

```bash
./scripts/release-preflight.sh
```

Must pass (clean git, on main, synced with origin, Node v20.x arm64, signing cert present, no 0-byte source files, node_modules present, webview.js + extension.js built). If FAIL → fix, do not proceed.

### Step 1 — Version bump (no tag yet)

1. Edit `branding/product.json` — bump `version`.
2. Edit `extensions/ritemark/package.json` — bump `version`.
3. Commit: `git commit -m "chore: bump version to X.Y.Z"`
4. Push: `git push origin main`

**Do NOT create the tag yet** — tag push triggers CI; we wait until Gate 1 passes.

### Step 2 — Build macOS arm64 (local)

```bash
arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use 20 && cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" && ./scripts/build-prod.sh 2>&1'
```

Run as background task with `timeout: 600000` (10 min cap). Never pipe through `tail`/`head` — buffering hangs background mode.

Generate test checklist in `docs/releases/vX.Y.Z/TEST-CHECKLIST.md`.

### Step 3 — Sign + DMG + Notarize arm64

```bash
./scripts/codesign-app.sh
./scripts/create-dmg.sh
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
```

Output: `dist/Ritemark-X.Y.Z-darwin-arm64.dmg` (signed + notarized).

### ⛔ Gate 1 — Jarmo tests arm64 DMG

Surface to user: "arm64 DMG ready at `dist/Ritemark-X.Y.Z-darwin-arm64.dmg`. Please install and test."

Wait for: "approved", "DMG approved", "GATE 1 passed".

### Step 5 — Tag + push (triggers CI)

**Toggle repo to private first** — public repos cannot use larger Windows runners:

```bash
gh repo edit ProductoryHQ/ritemark-native --visibility private --accept-visibility-change-consequences
git tag vX.Y.Z
git push origin vX.Y.Z
```

After Windows build completes (Step 6), toggle back:

```bash
gh repo edit ProductoryHQ/ritemark-native --visibility public --accept-visibility-change-consequences
```

### Step 6 — Download + sign macOS x64

Wait for `build-macos-x64.yml` to finish:

```bash
gh run list --workflow=build-macos-x64.yml --limit 3
gh run download <run-id> --name ritemark-darwin-x64 --dir VSCode-darwin-x64
./scripts/codesign-app.sh darwin-x64
./scripts/create-dmg.sh x64
./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-x64.dmg
```

### ⛔ Gate 2 — Jarmo tests x64 DMG + Windows installer

```bash
gh run list --workflow=build-windows.yml --limit 3
# Jarmo downloads Windows artifact, tests installer
```

Wait for: "x64 approved", "Windows approved", "GATE 2 passed".

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

## Workflow — Extension-only release

For changes confined to `extensions/ritemark/` only.

1. Bump version in `extensions/ritemark/package.json` to `X.Y.Z-ext.N`.
2. Build extension: `cd extensions/ritemark && npm run compile && cd webview && npm run build && cd ..`
3. Package: `vsce package --out dist/ritemark-X.Y.Z-ext.N.vsix` (verify command path with `.vscodeignore`).
4. Create GitHub Release with `.vsix` asset.
5. Update extension-only feed metadata with correct `minimumAppVersion`.

## Gotchas

### Notarize DMG, not .app

`./scripts/notarize-dmg.sh` is the canonical script. `notarize-app.sh` is **deprecated** — using it bypasses Gatekeeper for DMG installs.

### Windows builds — public/private repo toggle

GitHub does NOT allow larger runners (windows-8core) on public repos. Before pushing the tag (which triggers `build-windows.yml`), switch repo to private. After the Windows build completes, switch back to public. Without the toggle, the Windows build fails with a billing/permissions error.

### Node version + architecture

Production builds require **Node v20.x arm64** (`nvm use 20`). Default shell has x64 Node v23 — this fails with missing `@rollup/rollup-darwin-arm64` and similar arm64 native binaries. Always wrap with the `arch -arm64 /bin/zsh` invocation.

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

## Past incidents (institutional memory)

### v1.0.1 — broken DMG (2026-01-14)

Three root causes compounded:

1. **`node_modules` stripped from extension during DMG copy** → TipTap webview wouldn't load. When copying the extension to the app bundle, only remove `webview/node_modules` and `webview/src`. NEVER remove `extensions/ritemark/node_modules` — those are runtime dependencies. Hard check 7 (node_modules has 100+ packages) catches this regression.
2. ~~**`Info.plist` version not updated**~~ — **RETRACTED (2026-05-12).** `Info.plist CFBundleShortVersionString` always shows the VS Code base version (e.g. `1.117.0`) for ALL Ritemark releases — this is expected and correct. Ritemark's version is authoritative only in `product.json` (`ritemarkVersion`). The About dialog and update system (`versionService.ts`) both read from `product.json`, not `Info.plist`. Do NOT run PlistBuddy to patch the bundle version; do NOT flag this in release audits.
3. **0-byte source file corruption** (random source files became 0 bytes — TS, SVG, configs, even node_modules type defs). Detection: `find extensions/ritemark/src -name "*.ts" -size 0`. Fix: `git checkout HEAD -- extensions/ritemark/`, reinstall node_modules, rebuild webview. Root cause unconfirmed (disk / sync tool / system process).

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

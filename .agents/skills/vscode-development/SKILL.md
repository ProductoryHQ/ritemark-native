---
name: vscode-development
description: Work on VS Code OSS build, extension loading, patch management, Node/toolchain issues, dev mode, and production app builds in ritemark-native. Use for compile failures, extension activation bugs, upstream updates, patch application, and environment diagnostics outside the webview.
---

# VS Code Development

Use this skill for the non-webview side of the app: VS Code fork, extension host, builds, patches, and environment issues.

## Use This Skill For

- `npm run compile`, `scripts/code.sh`, gulp, patch, upstream, build, install, symlink, or activation problems
- extension host behavior outside React/TipTap rendering
- production app builds under `scripts/build-prod.sh`

## Do First

Run the basic environment checks before proposing bigger fixes:

```bash
node -v
node -p "process.arch"
cat .nvmrc
ls -la vscode/extensions/ritemark
```

If dev Electron is relevant, also check:

```bash
file vscode/.build/electron/*.app/Contents/MacOS/Electron
xattr -l vscode/.build/electron/*.app | grep quarantine
```

## Build And Run

Common commands:

```bash
cd extensions/ritemark && npm run compile
./vscode/scripts/code.sh
./scripts/build-prod.sh
./scripts/build-prod.sh darwin-x64
./scripts/apply-patches.sh --dry-run
```

## Reproducible Production Builds

`build-prod.sh` is release-only and starts with `verify-release-source.sh`. The
only valid source is a new worktree made by `create-release-worktree.sh`: exact
`origin/main`, physical pristine `vscode` submodule at the gitlink, physical
top-level dependency directories, and no previous target output. The script
then materializes dependencies with `npm ci`, applies committed patches, and
embeds build provenance. Do not repair a failing release tree in place; discard
it and create a new one.

Development worktrees may keep an applied VS Code tree for fast iteration, but
that tree is never promoted, copied, or linked into an RC. `apply-patches.sh`
records its exact derived diff so the hygiene cleaner can later distinguish
unchanged generated patch state from an unreviewed manual VS Code edit.

## Responsibilities

1. Diagnose first: inspect versions, architecture, file layout, and the actual failing command.
2. Prefer the smallest fix: reload, targeted rebuild, reinstall dependencies, then only later larger cleanup.
3. Treat broken symlinks, wrong Node architecture, and missing patches as first-class suspects.
4. Keep webview rendering issues in `webview-development` unless the root cause is clearly extension-host side.
5. Run `node ./scripts/worktree-hygiene.mjs --check` after merge/close, at sprint close, before RC creation, and weekly. Review before `--clean`; never override `BLOCKED` worktrees.

## Deep References

Read these only when needed:

- `.claude/skills/vscode-development/SKILL.md`
- `.claude/skills/vscode-development/TROUBLESHOOTING.md`
- `docs/development/analysis/2026-02-03-multi-platform-build.md`

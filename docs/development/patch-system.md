# VS Code Patch System

Ritemark Native customizes VS Code via patch files instead of maintaining a fork. This makes upstream updates straightforward.

## How It Works

Patches live in `patches/vscode/` and are applied to the `vscode/` submodule. The submodule stays clean — all customizations are in versioned patch files.

## Current Patches

| Patch | Purpose |
|-------|---------|
| `001-ritemark-branding.patch` | Theme, fonts, icons, welcome page, about dialog, breadcrumbs |
| `002-ritemark-ui-layout.patch` | Sidebar, titlebar, tabs, explorer, panels |
| `003-ritemark-menu-cleanup.patch` | Hide VS Code developer features (chat, debug, go menu) |
| `004-ritemark-build-system.patch` | jschardet, microphone permission, integrity check skip |
| `005-ritemark-windows-and-oss-fixes.patch` | Windows packaging and OSS compatibility fixes |
| `006-ritemark-dev-launch-fallback.patch` | Development launch fallback behavior |
| `007-ritemark-vscode-1117-compat.patch` | VS Code 1.117 compatibility adjustments |
| `008-ritemark-windows-binary-strip.patch` | Windows binary packaging exclusions |
| `009-ritemark-browser-context-bridge.patch` | Browser context bridge |
| `010-ritemark-browser-action-bridge.patch` | Browser action bridge |
| `011-ritemark-cloud-file-error.patch` | Cloud-file error handling |
| `012-ritemark-shell-watchdog.patch` | Shell startup watchdog |
| `013-ritemark-configuration-defaults.patch` | Product configuration defaults |
| `014-ritemark-save-receipts.patch` | Exact successful-save identity for editor–disk synchronization |
| `015-ritemark-help-menu-policy.patch` | Ritemark-only fail-closed Help-menu policy shared by native and custom menubars |

## Commands

```bash
# Apply all patches
./scripts/apply-patches.sh

# Check status without applying
./scripts/apply-patches.sh --dry-run

# Create a new patch
./scripts/create-patch.sh "description-of-change"

# Remove all patches
./scripts/apply-patches.sh --reverse

# Update VS Code submodule
./scripts/update-vscode.sh
```

## Creating a New Patch

1. Make changes inside `vscode/`
2. Run `./scripts/create-patch.sh "description"`
3. The script generates a numbered patch file in `patches/vscode/`
4. Commit the patch file

## Important Rules

1. **Never edit `vscode/` directly** without creating a patch
2. **Remove unused imports** — VS Code build is strict about unused declarations
3. **Test with `--dry-run`** before applying to verify patches are compatible
4. **After fresh clone**: always run `./scripts/apply-patches.sh`

## Updating VS Code Upstream

```bash
# Check compatibility first
./scripts/update-vscode.sh --check

# Update submodule
./scripts/update-vscode.sh
```

If patches fail after an update, they need manual resolution — edit the patch files or recreate them against the new VS Code version.

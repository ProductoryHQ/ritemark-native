# Sprint 16 Research: Auto-Update Functionality

**Date:** 2026-01-10
**Phase:** 1 - RESEARCH

## Objective

Implement auto-update functionality for RiteMark Native (VS Code OSS fork) targeting macOS darwin-arm64.

## Requirements

1. Check for new versions in ritemark-public GitHub repo
2. Show notification when update available
3. Auto-download and install on user confirmation
4. Target: macOS (darwin-arm64)

## Research Areas

### 1. VS Code's Update Mechanism

VS Code has a built-in update service, but it's designed for official builds and Microsoft's infrastructure.

**Key Questions:**
- How does VS Code OSS handle updates?
- What update mechanism is already in the codebase?
- Can we reuse/adapt the existing update service?

### 2. Electron Auto-Update Solutions

Since VS Code is an Electron app, we can leverage Electron's update capabilities.

**Options:**
- `electron-updater` (Electron Builder's updater)
- Electron's built-in `autoUpdater` module
- Custom update mechanism

**Key Questions:**
- What's already integrated in VS Code?
- Do we need additional dependencies?
- How to point to our GitHub release artifacts?

### 3. GitHub Releases Integration

We need to:
- Host release artifacts on GitHub (DMG files)
- Provide update metadata (version, download URL, release notes)
- Check for latest version via GitHub API

**Key Questions:**
- What metadata format? (JSON, YAML, or GitHub Releases API directly)
- Where to host update manifest?
- How to handle version comparison?

### 4. Update Flow UX

**User Experience:**
1. App checks for updates (on startup? periodic?)
2. Notification appears if update available
3. User clicks "Update Now" or "Later"
4. Download progress indicator
5. Install and restart

**Key Questions:**
- When to check for updates? (startup, interval, manual)
- Where to show notification? (VS Code notification API)
- How to handle download in background?
- Auto-restart or user-initiated?

### 5. Code Signing & Security

macOS requires signed applications for auto-update to work properly.

**Key Questions:**
- Is RiteMark Native currently code-signed?
- Do we need Apple Developer certificate?
- How to verify update authenticity?
- SHA256 checksum verification?

## Key Findings

### VS Code Has Complete Update Infrastructure

VS Code OSS includes a full-featured update system that we can leverage:

**Files Found:**
- `vscode/src/vs/platform/update/electron-main/updateService.darwin.ts` - macOS update service
- `vscode/src/vs/platform/update/common/update.ts` - Update state machine & interfaces
- `vscode/src/vs/platform/update/electron-main/abstractUpdateService.ts` - Base implementation
- `vscode/src/vs/workbench/contrib/update/browser/update.ts` - UI contribution (notifications)

**How It Works:**
1. Uses Electron's built-in `autoUpdater` module
2. Calls `electron.autoUpdater.setFeedURL({ url })` to configure update server
3. State machine: Idle → Checking → Downloading → Downloaded → Ready
4. Notification system already implemented in VS Code workbench
5. Auto-restart on update ready

**Critical Dependencies:**
```typescript
// From abstractUpdateService.ts line 17-18
export function createUpdateURL(platform: string, quality: string, productService: IProductService): string {
  return `${productService.updateUrl}/api/update/${platform}/${quality}/${productService.commit}`;
}
```

**Required in product.json:**
- `updateUrl` - Base URL for update server
- `commit` - Current version commit hash
- `quality` - "stable" or "insider"

### Current RiteMark Configuration

**vscode/product.json** (our branding override):
```json
{
  "quality": "stable",
  "updateUrl": NOT SET,  ← This is the blocker
  "commit": NOT SET,     ← This is also missing
  ...
}
```

**Update Service Behavior:**
From `abstractUpdateService.ts` line 83-86:
```typescript
if (!this.productService.updateUrl || !this.productService.commit) {
  this.setState(State.Disabled(DisablementReason.MissingConfiguration));
  this.logService.info('update#ctor - updates are disabled as there is no update URL');
  return;
}
```

**Result:** Update service is currently DISABLED because we don't have `updateUrl` and `commit` set.

### Current Build & Release Process

**Build Script:** `scripts/build-mac.sh`
- Builds VS Code from source
- Copies RiteMark extension
- Applies branding from `branding/product.json`
- Output: `VSCode-darwin-arm64/RiteMark.app`

**Installer Script:** `scripts/create-dmg.sh`
- Uses `create-dmg` tool (Homebrew)
- Reads version from `vscode/package.json` (currently "1.94.0")
- Creates DMG: `dist/RiteMark-{version}-darwin-arm64.dmg`
- Generates SHA256 checksum

**No Release Automation:** Currently manual process, no GitHub Actions/releases workflow.

### Electron autoUpdater Requirements

From VS Code's `updateService.darwin.ts` line 85-90:
```typescript
try {
  electron.autoUpdater.setFeedURL({ url });
} catch (e) {
  // application is very likely not signed
  this.logService.error('Failed to set update feed URL', e);
  return undefined;
}
```

**Critical:** macOS `autoUpdater` requires the app to be code-signed. Unsigned apps will fail silently.

### Version Tracking

**Current Version Source:** `vscode/package.json`
```json
{
  "version": "1.94.0"
}
```

This is the VS Code upstream version. We need our own versioning scheme for RiteMark Native.

## Recommended Approach

### Option 1: GitHub Releases + Electron autoUpdater (Recommended)

**Pros:**
- Leverages existing VS Code update infrastructure
- No custom server needed
- Free hosting via GitHub Releases
- Automatic download & install
- State machine & UI already implemented

**Cons:**
- Requires code signing (Apple Developer account)
- Need to host update manifest alongside DMG
- Must set up GitHub Actions for releases

**Implementation:**
1. Add `updateUrl` to `branding/product.json` pointing to our update server/API
2. Set `commit` to RiteMark Native version
3. Create update manifest endpoint that returns version info
4. Host DMG on GitHub Releases
5. Code sign the app (requires Apple Developer certificate)

### Option 2: GitHub Releases + Custom Check (Simpler, No Signing Required)

**Pros:**
- No code signing required
- Full control over update UX
- Can work with unsigned builds
- Simpler server requirements (just GitHub API)

**Cons:**
- Need to implement custom update check logic
- Need to implement download UI
- Manual install (download DMG, user drags to Applications)
- More code to write & maintain

**Implementation:**
1. Check GitHub Releases API for latest version
2. Compare with current version
3. Show VS Code notification if update available
4. On click, open browser to download page or auto-download DMG
5. User manually installs (opens DMG, drags to Applications)

### Option 3: Electron Builder Auto-Updater

**Pros:**
- Industry standard (used by Slack, Discord, etc.)
- Handles code signing
- Supports differential updates

**Cons:**
- Requires refactoring our build process
- Currently we use VS Code's gulp build system
- Major change to infrastructure

**Not Recommended:** Too invasive for this sprint.

## Decision Matrix

| Feature | Option 1 (Native) | Option 2 (Custom) |
|---------|------------------|-------------------|
| Code Signing Required | Yes | No |
| Uses VS Code Infrastructure | Yes | Partial |
| Auto-Install | Yes | No |
| GitHub Hosting | Yes | Yes |
| Effort | Medium | Low |
| User Experience | Seamless | Manual install |

## Risks

1. **Code Signing:** Do we have Apple Developer account? Cost: $99/year
2. **Version Scheme:** Need to decide how RiteMark versions relate to VS Code versions
3. **Update Frequency:** How often do we release? (affects user annoyance)
4. **Breaking Changes:** What if update requires data migration?
5. **Rollback:** If update is broken, how do users downgrade?

## Questions for Jarmo

1. Do we have an Apple Developer account for code signing?
2. What versioning scheme should we use? (e.g., 1.0.0, 1.1.0, etc.)
3. Should updates auto-install or require user confirmation at each step?
4. How often should we check for updates? (startup only, hourly, daily?)
5. Manual install acceptable for MVP, or must it be seamless?

---

**Recommendation:** Start with **Option 2** (custom check, manual install) for MVP since it requires no code signing and is fastest to implement. Upgrade to Option 1 later when we have code signing in place.

---

*Research complete - ready for Phase 2 (Planning)*

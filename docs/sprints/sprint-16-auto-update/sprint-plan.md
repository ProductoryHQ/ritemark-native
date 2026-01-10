# Sprint 16: Auto-Update Functionality

## Goal

Implement auto-update notifications that check GitHub Releases for new versions and prompt users to download and install updates.

## Success Criteria

- [ ] App checks for updates 10 seconds after startup
- [ ] VS Code notification appears when new version is available in `ritemark-public`
- [ ] "Install Now" opens DMG download URL in browser
- [ ] "Later" dismisses notification (re-shows next startup)
- [ ] "Don't Show Again" persists preference via `globalState`
- [ ] Version comparison: `1.0.0` < `1.0.1` < `1.1.0` (ignores pre-release)
- [ ] Works on macOS darwin-arm64 (production build)
- [ ] Setting `ritemark.updates.enabled: false` disables all checks

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Update Check Service | Service that queries GitHub Releases API for latest version |
| Version Comparison Logic | Semantic version comparison (current vs latest) |
| Notification UI | VS Code notification with "Update" and "Later" actions |
| Update Settings | Configuration option to enable/disable update checks |
| GitHub Release Workflow | Documentation for creating releases with proper version tags |

## Approach

**Option 2 (Custom Check, Manual Install)** - chosen for MVP because:
- No code signing required
- Fast to implement
- Works with current unsigned builds
- Upgrade path to native auto-updater later

## Implementation Checklist

### Phase 1: Research
- [x] Investigate VS Code's update infrastructure
- [x] Analyze current build and versioning process
- [x] Evaluate update implementation options
- [x] Document code signing requirements
- [x] Identify GitHub Releases API integration approach

### Phase 2: Versioning Setup
- [x] Add `version` field to `branding/product.json` (e.g., "1.0.0")
- [ ] Modify `scripts/create-dmg.sh` to use RiteMark version instead of VS Code version
- [ ] Update build scripts to inject version into product.json
- [x] Create version constant accessible at runtime
- [x] Document versioning scheme (semantic versioning)

### Phase 3: GitHub API Integration
- [x] Create update check service class
- [x] Implement GitHub Releases API client
- [x] Parse latest release tag (e.g., "v1.0.1" → "1.0.1")
- [x] Extract download URL for darwin-arm64 DMG
- [x] Handle API errors gracefully (rate limits, network failures)
- [x] Add caching to avoid excessive API calls (via timestamp storage)

### Phase 4: Version Comparison
- [x] Implement semantic version comparison (semver)
- [x] Handle edge cases (pre-release versions, build metadata)
- [ ] Write unit tests for version comparison
- [x] Ensure "1.0.0" < "1.0.1" < "1.1.0" < "2.0.0"

### Phase 5: Update Notification UI
- [x] Integrate with VS Code notification service
- [x] Create notification with update message
- [x] Add "Update Now" button (opens download URL)
- [x] Add "Later" button (dismisses notification)
- [x] Add "Don't Show Again" option (saves preference)
- [x] Style notification to match RiteMark branding (using VS Code native)

### Phase 6: Update Check Trigger
- [x] Check for updates on app startup (after window opens)
- [x] Delay initial check by 10 seconds (avoid slowing startup)
- [x] Store last check timestamp (avoid checking too frequently)
- [ ] Add manual "Check for Updates" command to menu
- [x] Respect user preference (don't check if disabled)

### Phase 7: Settings & Configuration
- [x] Add `update.checkForUpdates` setting (boolean, default: true)
- [ ] Add `update.checkInterval` setting (hours, default: 24) - SKIPPED (MVP: check once per session)
- [x] Store last notification version (don't nag repeatedly)
- [x] Use VS Code's storage service for persistence

### Phase 8: Testing & Validation
- [ ] Test with mock GitHub API responses
- [ ] Test version comparison logic
- [ ] Test notification UI in production build
- [ ] Test "no update available" scenario
- [ ] Test network error scenarios
- [ ] Test update check disabled scenario
- [ ] Verify no performance impact on startup

### Phase 9: Documentation
- [ ] Document how to create GitHub releases
- [ ] Document version numbering scheme
- [ ] Document release asset naming convention
- [ ] Update ROADMAP with auto-update feature
- [ ] Add troubleshooting guide

## Technical Specifications (EXACT)

These are precise implementation details. AI agents MUST use these exact values.

### 1. Repository & Asset Naming (Single Source of Truth)

```
REPO_OWNER    = "jarmo-productory"
REPO_NAME     = "ritemark-public"
API_ENDPOINT  = "https://api.github.com/repos/jarmo-productory/ritemark-public/releases/latest"
```

**Release Asset Naming Convention (EXACT):**
```
RiteMark-{VERSION}-darwin-arm64.dmg
```
- Example: `RiteMark-1.0.0-darwin-arm64.dmg`
- NO spaces, NO uppercase except "RiteMark"
- Version WITHOUT "v" prefix in filename

**Git Tag Convention:**
```
v{VERSION}
```
- Example: `v1.0.0`, `v1.0.1`
- Tag HAS "v" prefix

### 2. Version Constant Location (EXACT)

**Source of truth:** `branding/product.json`

```json
{
  "version": "1.0.0"
}
```

**Runtime access in extension code:**
```typescript
// File: extensions/ritemark/src/update/versionService.ts
import * as vscode from 'vscode';

export function getCurrentVersion(): string {
  // VS Code exposes product.json via vscode.env
  // Access the version from the extension's package.json which inherits from product
  const extension = vscode.extensions.getExtension('ritemark.ritemark');
  return extension?.packageJSON?.version ?? '0.0.0';
}
```

**Alternative (if above doesn't work):** Read from `product.json` at build time and inject into extension's `package.json`.

### 3. Settings & Storage API (EXACT)

**Settings definition in `package.json`:**
```json
{
  "contributes": {
    "configuration": {
      "title": "RiteMark Updates",
      "properties": {
        "ritemark.updates.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Check for updates on startup"
        },
        "ritemark.updates.dismissed": {
          "type": "string",
          "default": "",
          "description": "Last dismissed update version (internal)"
        }
      }
    }
  }
}
```

**Storage API (for internal state):**
```typescript
// File: extensions/ritemark/src/update/updateStorage.ts
import * as vscode from 'vscode';

const STORAGE_KEYS = {
  LAST_CHECK_TIMESTAMP: 'ritemark.update.lastCheckTimestamp',
  DISMISSED_VERSION: 'ritemark.update.dismissedVersion',
  DONT_SHOW_AGAIN: 'ritemark.update.dontShowAgain'
} as const;

export class UpdateStorage {
  constructor(private globalState: vscode.Memento) {}

  getLastCheckTimestamp(): number {
    return this.globalState.get<number>(STORAGE_KEYS.LAST_CHECK_TIMESTAMP, 0);
  }

  setLastCheckTimestamp(timestamp: number): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.LAST_CHECK_TIMESTAMP, timestamp);
  }

  getDismissedVersion(): string {
    return this.globalState.get<string>(STORAGE_KEYS.DISMISSED_VERSION, '');
  }

  setDismissedVersion(version: string): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.DISMISSED_VERSION, version);
  }

  getDontShowAgain(): boolean {
    return this.globalState.get<boolean>(STORAGE_KEYS.DONT_SHOW_AGAIN, false);
  }

  setDontShowAgain(value: boolean): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.DONT_SHOW_AGAIN, value);
  }
}
```

**Initialization in extension activation:**
```typescript
// File: extensions/ritemark/src/extension.ts
export function activate(context: vscode.ExtensionContext) {
  const updateStorage = new UpdateStorage(context.globalState);
  // ... pass to UpdateService
}
```

### 4. Startup Check & Scheduler (EXACT)

**Implementation: setTimeout in activation, NOT setInterval**

```typescript
// File: extensions/ritemark/src/update/updateScheduler.ts

const STARTUP_DELAY_MS = 10_000; // 10 seconds after activation

export function scheduleStartupCheck(
  updateService: UpdateService,
  storage: UpdateStorage
): void {
  // Single delayed check on startup
  setTimeout(async () => {
    const settings = vscode.workspace.getConfiguration('ritemark.updates');
    const enabled = settings.get<boolean>('enabled', true);

    if (!enabled) {
      return; // User disabled update checks
    }

    if (storage.getDontShowAgain()) {
      return; // User clicked "Don't show again"
    }

    await updateService.checkAndNotify();
  }, STARTUP_DELAY_MS);
}
```

**Why setTimeout, not setInterval:**
- Check happens once per app session (startup)
- No background polling during session
- Simpler, less resource usage
- User can manually check via command

### 5. Pre-release Version Handling (DECISION)

**Decision: IGNORE pre-release versions**

```typescript
// File: extensions/ritemark/src/update/versionComparison.ts

export function isStableVersion(version: string): boolean {
  // Pre-release versions contain hyphen: 1.0.0-beta, 1.0.0-rc.1
  return !version.includes('-');
}

export function shouldNotifyUpdate(current: string, latest: string): boolean {
  // Only notify for stable releases
  if (!isStableVersion(latest)) {
    return false;
  }

  return isNewerVersion(latest, current);
}
```

**Rationale:** Users on stable channel should not see beta/rc versions. Beta channel support is a future enhancement.

### 6. Notification UI (EXACT)

**API:** `vscode.window.showInformationMessage()`

**Exact notification text and buttons:**
```typescript
// File: extensions/ritemark/src/update/updateNotification.ts
import * as vscode from 'vscode';

const NOTIFICATION_TEXT = 'A new version of RiteMark is available';

const ACTIONS = {
  INSTALL_NOW: 'Install Now',
  LATER: 'Later',
  DONT_SHOW: "Don't Show Again"
} as const;

export async function showUpdateNotification(
  downloadUrl: string,
  storage: UpdateStorage
): Promise<void> {
  const selection = await vscode.window.showInformationMessage(
    NOTIFICATION_TEXT,
    ACTIONS.INSTALL_NOW,
    ACTIONS.LATER,
    ACTIONS.DONT_SHOW
  );

  switch (selection) {
    case ACTIONS.INSTALL_NOW:
      // Open DMG download URL in browser
      await vscode.env.openExternal(vscode.Uri.parse(downloadUrl));
      break;

    case ACTIONS.LATER:
      // Do nothing, notification dismissed
      // Will show again on next startup
      break;

    case ACTIONS.DONT_SHOW:
      // Persist preference
      await storage.setDontShowAgain(true);
      break;

    default:
      // User clicked X or dismissed
      break;
  }
}
```

**Storage keys for notification state:**
| Key | Type | Purpose |
|-----|------|---------|
| `ritemark.update.dismissedVersion` | string | Version user clicked "Later" for (re-notify on newer) |
| `ritemark.update.dontShowAgain` | boolean | User clicked "Don't Show Again" |
| `ritemark.update.lastCheckTimestamp` | number | Unix timestamp of last API call |

### 7. File Structure (EXACT)

New files to create:
```
extensions/ritemark/src/update/
├── index.ts              # Export all update module
├── updateService.ts      # Main service: checkForUpdates()
├── updateStorage.ts      # globalState wrapper (storage keys)
├── updateNotification.ts # showUpdateNotification()
├── updateScheduler.ts    # scheduleStartupCheck()
├── versionService.ts     # getCurrentVersion()
├── versionComparison.ts  # isNewerVersion(), isStableVersion()
└── githubClient.ts       # fetchLatestRelease() from GitHub API
```

Modify existing files:
```
extensions/ritemark/src/extension.ts     # Add update initialization
extensions/ritemark/package.json         # Add settings contribution
branding/product.json                    # Add "version": "1.0.0"
```

---

## Technical Details

### GitHub Releases API

Endpoint:
```
GET https://api.github.com/repos/jarmo-productory/ritemark-public/releases/latest
```

Response (relevant fields):
```json
{
  "tag_name": "v1.0.1",
  "name": "RiteMark Native 1.0.1",
  "body": "Release notes...",
  "assets": [
    {
      "name": "RiteMark-1.0.1-darwin-arm64.dmg",
      "browser_download_url": "https://github.com/.../releases/download/v1.0.1/RiteMark-1.0.1-darwin-arm64.dmg"
    }
  ]
}
```

### Version Storage in product.json

```json
{
  "nameShort": "RiteMark",
  "nameLong": "RiteMark",
  "version": "1.0.0",
  "commit": "1.0.0",
  "quality": "stable",
  "updateUrl": "https://api.github.com/repos/jarmo-productory/ritemark-public",
  ...
}
```

### Update Check Service (Pseudocode)

```typescript
class UpdateService {
  async checkForUpdates(): Promise<UpdateInfo | null> {
    const currentVersion = productService.version; // "1.0.0"
    const latestRelease = await githubAPI.getLatestRelease();
    const latestVersion = parseVersion(latestRelease.tag_name); // "v1.0.1" → "1.0.1"

    if (isNewer(latestVersion, currentVersion)) {
      return {
        version: latestVersion,
        downloadUrl: latestRelease.assets.find(a => a.name.includes('darwin-arm64')).browser_download_url,
        releaseNotes: latestRelease.body
      };
    }

    return null; // No update available
  }
}
```

### Notification UI Design

**Reference: Cursor's Update Banner (see screenshot)**

Cursor uses a clean, non-intrusive banner at the top of the window:

```
┌───────────────────────────────────────────────────────────────┐
│ 📦 New update available                    [Later] [Install Now] │
└───────────────────────────────────────────────────────────────┘
```

**Key UX elements:**
- **Location:** Top banner (not modal popup)
- **Icon:** Package/gift icon (📦)
- **Text:** Simple "New update available" (no version number clutter)
- **"Later" button:** Gray text link style, non-prominent
- **"Install Now" button:** Blue, prominent call-to-action
- **Non-blocking:** User can continue working, banner stays visible

**VS Code implementation options:**
1. **Information Message** - `vscode.window.showInformationMessage()` with buttons
2. **Status Bar Item** - Persistent icon in status bar (less visible)
3. **Custom Notification Banner** - Like Cursor (requires VS Code modification)

**Recommendation for MVP:** Use VS Code's built-in `showInformationMessage` with buttons. It's similar to Cursor's banner but appears as a notification toast in VS Code's notification area.

**Future enhancement:** Create a custom top banner component matching Cursor's exact design.

## Versioning Scheme

**Format:** MAJOR.MINOR.PATCH (semantic versioning)

- **MAJOR:** Breaking changes, data format changes
- **MINOR:** New features, UI changes
- **PATCH:** Bug fixes, performance improvements

**Examples:**
- `1.0.0` - Initial public release
- `1.0.1` - Bug fix release
- `1.1.0` - New feature (e.g., export to PDF)
- `2.0.0` - Major rewrite or breaking change

**Git Tags:** `v1.0.0`, `v1.0.1`, etc.

## Release Asset Naming

```
RiteMark-{VERSION}-{PLATFORM}.dmg
```

**Examples:**
- `RiteMark-1.0.0-darwin-arm64.dmg`
- `RiteMark-1.0.1-darwin-arm64.dmg`

**Checksum:**
- `RiteMark-1.0.0-darwin-arm64.dmg.sha256`

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GitHub API rate limits (60/hour unauthenticated) | Cache last check, only check once per 24 hours |
| Network failures during check | Fail silently, log error, don't block startup |
| User annoyance from frequent notifications | Store last notified version, don't re-notify |
| Breaking VS Code's update service | Use separate custom service, don't modify VS Code code |
| Wrong version format in releases | Validate tag format, log warning if invalid |

## Decisions (LOCKED)

These are final decisions. Do not deviate.

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Repository** | `jarmo-productory/ritemark-public` | Public distribution repo |
| **Initial version** | `1.0.0` | Semantic versioning start |
| **Check trigger** | On every startup | User wants immediate awareness |
| **Update behavior** | Seamless download + restart | Best UX (limited by no code signing) |
| **Apple Developer** | None | Auto-install limited to DMG download + open |

## Future Enhancements (Post-MVP)

- [ ] Auto-download DMG to Downloads folder
- [ ] Show progress bar during download
- [ ] Verify DMG checksum before opening
- [ ] Integrate with native Electron autoUpdater (requires code signing)
- [ ] Support rollback to previous version
- [ ] Beta/insider channel support
- [ ] Release notes viewer in-app

## Approval

- [ ] Jarmo approved this sprint plan

---

*Sprint plan created: 2026-01-10*
*Phase 1 research completed: 2026-01-10*

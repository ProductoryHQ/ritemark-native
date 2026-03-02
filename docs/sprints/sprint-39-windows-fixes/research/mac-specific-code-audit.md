# Mac-Specific Code Audit

## Critical: External App Opening (B1, B2, B3)

### excelEditorProvider.ts (lines 223-242)
```typescript
// Mac-only: uses `open -Ra` to check if app exists
await execAsync('open -Ra "Microsoft Excel"');
// Mac-only: uses `open -a` to open file with specific app
await execAsync(`open -a "${appName}" "${filePath}"`);
// Mac-only: fallback to "Numbers" (Apple's spreadsheet app)
```

### docxEditorProvider.ts (lines 163-175)
```typescript
// Same pattern: `open -Ra "Microsoft Word"` check
// Fallback to "Pages" (Apple's word processor)
```

### ritemarkEditor.ts (lines 1013-1032)
```typescript
// Duplicate of excelEditorProvider logic
```

### Fix approach
Create shared `src/utils/openExternal.ts`:
```typescript
import { exec } from 'child_process';
import * as os from 'os';

export async function openInApp(filePath: string, appName: string): Promise<void> {
  if (os.platform() === 'darwin') {
    await execAsync(`open -a "${appName}" "${filePath}"`);
  } else if (os.platform() === 'win32') {
    await execAsync(`start "" "${filePath}"`);  // Windows opens with default app
  }
}

export async function isAppInstalled(appName: string): Promise<boolean> {
  if (os.platform() === 'darwin') {
    // open -Ra checks if app exists on Mac
    await execAsync(`open -Ra "${appName}"`);
  } else if (os.platform() === 'win32') {
    // On Windows, just try to open — the OS handles app selection
    return true; // Windows uses file association
  }
}
```

## Critical: Webview UI (B4, B6)

### SpreadsheetToolbar.tsx (lines 7, 27, 37-40)
- Shows "Open in Numbers" button regardless of platform
- **Fix:** Send `platform` from extension to webview, show "Open in Excel" on Windows, "Open in Numbers" on Mac

### FormattingBubbleMenu.tsx (lines 101, 331, 338, 385)
- Tooltips hardcode "Cmd+K", "Cmd+B", "Cmd+I"
- **Fix:** Use VS Code's platform detection or `navigator.platform` in webview
- Pattern: `const mod = isMac ? 'Cmd' : 'Ctrl';`

## Critical: Microphone Settings (B5)

### ritemarkEditor.ts (lines 371-372)
```typescript
// Opens macOS System Preferences → Privacy → Microphone
require('child_process').exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
```
- **Fix on Windows:** `start ms-settings:privacy-microphone` (Windows 10/11 Settings URL)

## Moderate: Update Service (C1)

The update system is deeply Mac-specific. Multiple files need changes:

### githubClient.ts
- `getDownloadUrl()` (line 123-128): Only looks for `darwin-arm64` + `.dmg`
- `buildFallbackManifest()` (line 163-180): Uses `dmgUrl` field name
- **Fix:** Make platform-aware. On Windows, look for `setup.exe` or `Ritemark-setup.exe`

### updateManifest.ts
- Validation (line 124): `Full update must have dmgUrl` — Mac-specific field name
- Size display (line 173-174): `manifest.dmgSize` — Mac-specific field name
- **Fix:** Add `installerUrl` as platform-neutral field, keep `dmgUrl` for backward compat

### updateService.ts
- Line 70: `'No darwin-arm64 DMG found in release assets'` — Mac-only error
- Line 88: `manifest.dmgUrl || getDownloadUrl(release)` — Mac-only fallback
- **Fix:** Platform detection to select correct download URL

### GitHub Release asset naming (confirmed by Jarmo):
| Platform | Asset Name |
|---|---|
| macOS Apple Silicon | `Ritemark-arm64.dmg` |
| macOS Intel | `Ritemark-x64.dmg` |
| Windows | `Ritemark-setup.exe` |

Published to `ritemark-public` repo, same as DMG releases.

## Already Handled
- Voice dictation: Feature flag `platforms: ['darwin']` correctly restricts to macOS
- Agent auth: Windows credential manager is implemented in `agent/setup.ts`
- Data paths: `%APPDATA%\Ritemark\` is correctly configured

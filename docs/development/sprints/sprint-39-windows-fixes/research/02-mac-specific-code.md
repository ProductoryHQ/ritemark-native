# Sprint 39 Research: Mac-Specific Code (Group B)

## Overview

Six instances of macOS-only code that either crashes silently or shows wrong UI on Windows.
All fixes are in `extensions/ritemark/` — no VS Code patches involved.

---

## B1 — excelEditorProvider.ts: Excel/Numbers open

**File:** `extensions/ritemark/src/excelEditorProvider.ts`
**Lines:** 223-242

**Current code:**
```typescript
private async checkExcelInstalled(): Promise<boolean> {
  try {
    await execAsync('open -Ra "Microsoft Excel"');
    return true;
  } catch (error) {
    return false;
  }
}

private async openInExternalApp(filePath: string, app: string): Promise<void> {
  try {
    const appName = app === 'excel' ? 'Microsoft Excel' : 'Numbers';
    await execAsync(`open -a "${appName}" "${filePath}"`);
    vscode.window.showInformationMessage(`Opening in ${appName}...`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open in ${app}: ${errorMessage}`);
  }
}
```

**Problem:** `open -Ra` and `open -a` are macOS commands. On Windows they will throw immediately.

**Fix:** Add `process.platform` branch:
- **macOS:** Keep existing `open -Ra` / `open -a` logic
- **Windows:** Use `start "" "Microsoft Excel" "filePath"` (or `cmd /c start`) to launch
  - For checking if Excel is installed on Windows: check registry or well-known install path, OR just try launching and catch the error
- **Linux:** `xdg-open` fallback

---

## B2 — docxEditorProvider.ts: Word/Pages open

**File:** `extensions/ritemark/src/docxEditorProvider.ts`
**Lines:** 163-175

**Current code:**
```typescript
private async checkWordInstalled(): Promise<boolean> {
  try {
    await execAsync('open -Ra "Microsoft Word"');
    return true;
  } catch {
    return false;
  }
}

private async openInExternalApp(filePath: string, app: string): Promise<void> {
  try {
    const appName = app === 'word' ? 'Microsoft Word' : 'Pages';
    await execAsync(`open -a "${appName}" "${filePath}"`);
  }
}
```

**Problem:** Same as B1. `open` is macOS-only. "Pages" does not exist on Windows.

**Fix:** Same platform-detection pattern as B1. On Windows, use `start "" "Microsoft Word" "filePath"`. Skip the "Pages" fallback entirely on Windows — Word is the only option.

---

## B3 — ritemarkEditor.ts: checkExcelInstalled / openInExternalApp

**File:** `extensions/ritemark/src/ritemarkEditor.ts`
**Lines:** 1013-1032

**Note:** This is a duplicate of B1's logic in `ritemarkEditor.ts`. Both files implement the same pattern.

**Fix:** Ideally extract platform-aware helpers into a shared utility:
```typescript
// src/utils/openExternal.ts
export async function checkAppInstalled(macAppName: string): Promise<boolean>
export async function openInExternalApp(filePath: string, macAppName: string, windowsAppName: string): Promise<void>
```
Then both `excelEditorProvider.ts` and `ritemarkEditor.ts` import from it.

---

## B4 — SpreadsheetToolbar.tsx: "Open in Numbers" UI

**File:** `extensions/ritemark/webview/src/components/header/SpreadsheetToolbar.tsx`
**Lines:** 7, 27, 37-40

**Current:**
```typescript
onOpenInNumbers?: () => void
const primaryLabel = hasExcel && onOpenInExcel ? 'Open in Excel' : 'Open in Numbers'
const secondaryLabel = hasExcel && onOpenInExcel ? 'Open in Numbers' : 'Open in Excel'
```

**Problem:** "Numbers" is a macOS-only app. On Windows, showing "Open in Numbers" as a fallback option is confusing — it will never work.

**Fix:** The webview needs to know the current platform. Extension already has `process.platform`. Pass platform in the `load` message (alongside `features`), then:
- On Windows: Only show "Open in Excel" option, hide Numbers entirely
- On macOS: Keep current Excel + Numbers split-button behavior

**Implementation path:**
1. Extension sends `platform: process.platform` in load message
2. `App.tsx` stores it in state, passes to children
3. `SpreadsheetToolbar` accepts `platform` prop and conditionally renders Numbers

---

## B5 — ritemarkEditor.ts: macOS System Preferences URL

**File:** `extensions/ritemark/src/ritemarkEditor.ts`
**Lines:** 371-372

**Current:**
```typescript
case 'system:openMicSettings':
  require('child_process').exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
  return;
```

**Problem:** `x-apple.systempreferences:` URL scheme is macOS-only. On Windows this silently does nothing (or throws).

**Fix:** Add platform branch:
- **macOS:** Keep existing `open "x-apple.systempreferences:..."` command
- **Windows:** Open Windows Settings microphone page: `start ms-settings:privacy-microphone`
  - Use `require('child_process').exec('start ms-settings:privacy-microphone')`
- **Linux:** `xdg-open` for whatever the distro provides

**Note:** This handler is only reachable when voice dictation is active. Since voice dictation is disabled on Windows via feature flag (`platforms: ['darwin']`), this is a defensive fix — the code path shouldn't be reached on Windows, but it should still be safe.

---

## B6 — FormattingBubbleMenu.tsx: Hardcoded "Cmd+K" tooltip

**File:** `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`
**Lines:** 101, 331, 338, 385

**Current:**
```tsx
title="Add/Edit Link (Cmd+K)"
title="Open in browser (Cmd+click also works)"
```

**Problem:** On Windows the modifier key is Ctrl, not Cmd. Showing "Cmd+K" confuses Windows users.

**Fix:** Detect platform in webview using the `platform` value passed in load message (same as B4):
```typescript
const modKey = platform === 'darwin' ? 'Cmd' : 'Ctrl'
// Usage:
title={`Add/Edit Link (${modKey}+K)`}
```

**Scope:** All hardcoded "Cmd+K" / "Cmd+click" strings in FormattingBubbleMenu.

---

## Shared Helper: Platform in Webview

B4 and B6 both need `platform` in the webview. This is a one-time addition:

**Extension side** (`ritemarkEditor.ts` load message):
```typescript
platform: process.platform,  // 'darwin' | 'win32' | 'linux'
```

**Webview side** (`App.tsx`):
```typescript
const [platform, setPlatform] = useState<string>('darwin')
// In onMessage('load'):
setPlatform(message.platform || 'darwin')
```

Then pass `platform` as a prop wherever needed. This is consistent with how `features` is already handled.

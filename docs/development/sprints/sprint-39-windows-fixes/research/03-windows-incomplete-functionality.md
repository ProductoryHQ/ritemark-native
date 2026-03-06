# Sprint 39 Research: Windows-Incomplete Functionality (Group C)

## Overview

Three areas where Windows support is incomplete or missing.
C1 (auto-update) is must-fix. C2-C3 (Whisper) are nice-to-have.

---

## C1 — githubClient.ts: Windows update URL not resolved

**File:** `extensions/ritemark/src/update/githubClient.ts`
**Lines:** 119-129

**Current code:**
```typescript
export function getDownloadUrl(release: GitHubRelease): string | null {
  const asset = release.assets.find(a =>
    a.name.includes('darwin-arm64') && a.name.endsWith('.dmg')
  );
  return asset?.browser_download_url ?? null;
}
```

**Problem:** This function only ever looks for `darwin-arm64` DMG files. On Windows it will always return `null`, which means:
- The auto-update system correctly detects a new version
- But it cannot find the download URL
- Update silently fails or shows a broken update prompt

**Fix:** Make the function platform-aware:

```typescript
export function getDownloadUrl(release: GitHubRelease): string | null {
  const platform = process.platform;
  const arch = process.arch;

  let assetPattern: (name: string) => boolean;

  if (platform === 'darwin' && arch === 'arm64') {
    assetPattern = (name) => name.includes('darwin-arm64') && name.endsWith('.dmg');
  } else if (platform === 'darwin' && arch === 'x64') {
    assetPattern = (name) => name.includes('darwin-x64') && name.endsWith('.dmg');
  } else if (platform === 'win32') {
    assetPattern = (name) => name.includes('win32-x64') && (name.endsWith('.exe') || name.endsWith('.zip'));
  } else {
    // Linux or unsupported
    return null;
  }

  const asset = release.assets.find(a => assetPattern(a.name));
  return asset?.browser_download_url ?? null;
}
```

**Note:** The exact Windows asset filename pattern depends on what the CI pipeline produces (`.exe` installer or `.zip` archive). Check the GitHub Actions build output naming convention from sprint-25 CI/CD work.

**Also check:** Does the update manifest (`getManifestUrl`) need similar platform-awareness? If the manifest contains platform-specific checksums, yes.

---

## C2 — whisperCpp.ts: Binary path Windows-only throws

**File:** `extensions/ritemark/src/voiceDictation/whisperCpp.ts`
**Lines:** 237-238

**Current code:**
```typescript
if (platform === 'darwin' && arch === 'arm64') {
  return path.join(context.extensionPath, 'binaries', 'darwin-arm64', 'whisper-cli');
}
// Future: add other platforms
throw new Error(`Unsupported platform: ${platform}-${arch}`);
```

**Problem:** On Windows this throws immediately. However, the voice dictation feature flag `platforms: ['darwin']` prevents this code from being called in normal usage. It is still a latent error if the feature gate is bypassed or the flag is changed.

**Fix options:**

| Option | Description | Complexity |
|--------|-------------|------------|
| A | Add Windows binary path for future use (throws if binary doesn't exist) | Low |
| B | Return `null` instead of throwing, let callers handle gracefully | Low |
| C | Full Windows Whisper binary bundled | High (out of scope) |

**Recommendation for this sprint:** Option B — return `null` and add a comment that Windows is not yet supported. This makes the code safe without shipping a non-functional feature.

```typescript
export function getWhisperBinaryPath(context: { extensionPath: string }): string | null {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin' && arch === 'arm64') {
    return path.join(context.extensionPath, 'binaries', 'darwin-arm64', 'whisper-cli');
  }

  // Windows and other platforms: whisper binary not yet bundled
  return null;
}
```

Callers must then handle `null` gracefully instead of crashing.

---

## C3 — flags.ts: Voice dictation already correctly platform-gated

**File:** `extensions/ritemark/src/features/flags.ts`
**Lines:** 33-35

**Current:**
```typescript
'voice-dictation': {
  platforms: ['darwin'],
}
```

**Status:** This is correct. Feature is already disabled on Windows at the platform gate level.

The sprint-29 research noted that the UI (dictate button) was visible on Windows even though the flag said darwin-only — that was fixed in sprint-29 by passing `features.voiceDictation` from the load message to the webview.

**Action for this sprint:** Verify the sprint-29 fix is actually committed and present in the codebase. If the dictate button is still showing on Windows, re-apply the App.tsx / DocumentHeader.tsx changes.

**Note on "macOS only" label:** The feature description says "Speech-to-text using Whisper (macOS only)". This is acceptable user-facing messaging. No change needed here unless Jarmo asks to update the label.

---

## Summary: C Group Priority

| Item | Priority | Effort | Risk |
|------|----------|--------|------|
| C1: Auto-update URL | Must-fix | Low-Medium | Medium — needs correct Windows asset naming |
| C2: Whisper null return | Nice-to-have | Low | Low — defensive safety only |
| C3: Flag label | No action | — | — |

# Microphone Permission Fix for Ritemark Webview

**Date:** 2026-01-18
**Status:** ✅ Implemented
**Patch:** `009-enable-microphone-in-webview.patch`

## Problem

VS Code webviews don't have access to `navigator.mediaDevices.getUserMedia()` by default due to Electron security restrictions. When the voice dictation button was clicked, users would see a "Permission denied" error.

## Root Cause

VS Code's Electron main process (`vscode/src/vs/code/electron-main/app.ts`) has strict permission handlers that only allow specific permissions for webviews:

```typescript
const allowedPermissionsInWebview = new Set([
  'clipboard-read',
  'clipboard-sanitized-write',
]);
```

Microphone access was not in this allowlist, causing `getUserMedia()` calls to fail.

## Solution

Added the `'media'` permission to the allowed permissions set in VS Code's Electron configuration.

### Patch: 009-enable-microphone-in-webview.patch

```diff
const allowedPermissionsInWebview = new Set([
  'clipboard-read',
  'clipboard-sanitized-write',
+ 'media', // Enable microphone access for voice dictation
]);
```

The `'media'` permission in Electron covers both audio and video capture from `getUserMedia()`.

## Technical Details

### File Modified
- `vscode/src/vs/code/electron-main/app.ts`

### Electron Permission System
Electron uses two handlers for permission control:
1. **`setPermissionRequestHandler`** - Called when a renderer process requests a permission
2. **`setPermissionCheckHandler`** - Called to verify if a permission is allowed

Both handlers check against the `allowedPermissionsInWebview` set for webview URLs (those starting with `vscode-webview://`).

### Permission Scope
The `'media'` permission enables:
- ✅ Microphone access (`audio: true`)
- ✅ Camera access (`video: true`)
- ✅ Screen sharing (if needed in the future)

For Ritemark's voice dictation, only microphone is used:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,      // Mono
    sampleRate: 16000,    // 16kHz for whisper
    echoCancellation: true,
    noiseSuppression: true,
  }
});
```

## Testing

To verify the fix works:

1. Build Ritemark with the patch applied:
   ```bash
   ./scripts/apply-patches.sh
   # Then rebuild if needed
   ```

2. Launch Ritemark and open a markdown file

3. Click the microphone button in the header toolbar

4. macOS will show a system permission dialog requesting microphone access

5. After granting permission, the microphone icon should turn red (recording state)

6. Speak and verify audio capture is working (check browser dev tools console)

## Security Considerations

### Why This Is Safe

1. **Webview Isolation**: Only webviews (with `vscode-webview://` URLs) can request this permission, not arbitrary web content

2. **System-Level Gatekeeper**: macOS/OS still shows a permission prompt the first time, requiring explicit user consent

3. **User-Initiated**: The webview code only requests microphone access when the user clicks the dictation button

4. **Same Domain as Clipboard**: We already allow clipboard access for the same webview, microphone follows the same security model

### What This Enables
- Voice dictation in Ritemark editor
- Future audio features (e.g., voice memos, audio notes)

### What This Does NOT Enable
- Camera access from arbitrary websites (webview only)
- Persistent background recording (only when user activates)
- Cross-origin media access (sandboxed to webview)

## Integration Points

### Frontend (Webview)
- `extensions/ritemark/webview/src/hooks/useVoiceDictation.ts`
  - Uses `navigator.mediaDevices.getUserMedia()`
  - Now works without permission errors

### Backend (Extension)
- `extensions/ritemark/src/ritemarkEditor.ts`
  - Receives audio chunks from webview
  - Forwards to whisper.cpp transcription service

### VS Code Core
- `vscode/src/vs/code/electron-main/app.ts`
  - **Modified by patch 009**
  - Grants media permission to webviews

## Related Files

| File | Purpose |
|------|---------|
| `patches/vscode/009-enable-microphone-in-webview.patch` | Patch file for VS Code |
| `vscode/src/vs/code/electron-main/app.ts` | Electron permission configuration |
| `extensions/ritemark/webview/src/hooks/useVoiceDictation.ts` | Microphone access code |
| `extensions/ritemark/webview/src/components/VoiceDictationButton.tsx` | UI component |

## Future Considerations

If additional media permissions are needed in the future (e.g., screen capture for screenshots), they're already enabled by the `'media'` permission. No additional patches needed.

## Rollback

To remove this feature:
1. Delete `patches/vscode/009-enable-microphone-in-webview.patch`
2. Run `./scripts/apply-patches.sh --reverse` (or reset the vscode submodule)
3. Reapply remaining patches with `./scripts/apply-patches.sh`

## References

- [Electron Session API - setPermissionRequestHandler](https://www.electronjs.org/docs/latest/api/session#sessetpermissionrequesthandlerhandler)
- [Electron Permissions](https://www.electronjs.org/docs/latest/tutorial/security#4-handle-session-permission-requests-from-remote-content)
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

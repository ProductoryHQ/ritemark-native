# Sprint 83 Phase 1 Research: Voice Dictation Mic Access — Codebase Audit

Date: 2026-06-10
Status: Complete — findings fed into sprint-plan.md

---

## 1. Feature Origin and History

Voice dictation shipped in Sprint 23 ("estonian-stt", ~v1.0.3). The Sprint 23 status report
(`docs/development/sprints/sprint-23-estonian-stt/notes/status-report-2025-01-18.md`) records
that `systemPreferences.askForMediaAccess('microphone')` was added as a fix during that sprint
and that `NSMicrophoneUsageDescription` was "already present" in Info.plist at the time. That
claim was never re-verified after Sprint 55 (VS Code 1.117 upstream bump).

---

## 2. Electron Permission Plumbing — Patch 004

`patches/vscode/004-ritemark-build-system.patch` adds two things to
`src/vs/code/electron-main/app.ts`:

1. Adds `'media'` to the `alwaysAllowedPermissions` set for webview URLs.
2. In `setPermissionRequestHandler`: when `permission === 'media' && isMacintosh`, calls
   `systemPreferences.getMediaAccessStatus('microphone')` and, if not `'granted'`, calls
   `systemPreferences.askForMediaAccess('microphone')` before resolving the permission.

CRITICAL GAP: This handler fires when Chromium asks Electron for permission to use the
microphone (i.e., when `getUserMedia` is called and the media permission is being negotiated).
On macOS, if TCC denies or hides the device at enumeration time, Chromium may throw
`NotFoundError` _before_ the permission handler is ever invoked — meaning the TCC
request/fix path in patch 004 is bypassed entirely for the user's reported symptom.

---

## 3. Entitlements

`branding/entitlements.plist` correctly contains:

```xml
<key>com.apple.security.device.audio-input</key>
<true/>
```

This is the hardened-runtime entitlement that allows microphone access. It is applied to
both the main app and helper apps via `scripts/codesign-app.sh` (step 5e signs helpers with
the same entitlements file). This is architecturally correct.

---

## 4. NSMicrophoneUsageDescription — H2 Verification Finding

Searched the entire repository for `NSMicrophoneUsageDescription`. Results:

- `docs/development/sprints/sprint-83-dictation-mic-fix/sprint-plan.md` — documentation only
- `docs/development/sprints/sprint-23-estonian-stt/notes/status-report-2025-01-18.md` — historical note only

The key is NOT present in:
- `branding/` (no Info.plist override file exists in branding/)
- `scripts/` (no `PlistBuddy` call, no `plutil` mutation, no injection step)
- `vscode/` submodule (not checked — would need `plutil -p` on a built app bundle)

This means the key's presence in the production app bundle depends entirely on whether
gulp-atom-electron (or the Electron binary) retains it in its stock Info.plist. This has
NEVER been enforced or verified in our build pipeline.

Action required (Phase 3, Checklist item "Verify & Diagnose"):
Run `plutil -p VSCode-darwin-arm64/Ritemark.app/Contents/Info.plist | grep -i micro`
on the latest production build to confirm or deny H2.

---

## 5. Webview Error Handling — useVoiceDictation.ts

File: `extensions/ritemark/webview/src/hooks/useVoiceDictation.ts`

The catch block at line ~253–267:

```typescript
} catch (err) {
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setError('Microphone access denied. Please enable microphone permissions.')
    } else if (err.name === 'NotFoundError') {
      setError('No microphone found. Please connect a microphone.')   // line ~259
    } else {
      setError(`Failed to start dictation: ${err.message}`)
    }
  }
}
```

Confirmed: `NotFoundError` → "No microphone found" message. No permission query back to
extension. No bridge call to `getMediaAccessStatus`.

---

## 6. VoiceDictationButton.tsx — Modal Trigger Gap

File: `extensions/ritemark/webview/src/components/VoiceDictationButton.tsx`

Line 77–82:
```typescript
useEffect(() => {
  if (error && error.includes('Microphone access denied')) {
    setShowMicPermission(true)
  }
}, [error])
```

The mic-permission help modal fires ONLY when the error string contains
`'Microphone access denied'`. The `NotFoundError` path sets the error to
`'No microphone found. Please connect a microphone.'` — which does NOT match this condition.
The user therefore gets no modal guidance, only a tooltip, and is directed to check hardware
rather than permissions.

---

## 7. Message Router — Existing Dictation Messages

Confirmed existing message types in `extensions/ritemark/src/voiceDictation/controller.ts`:
- `dictation:start` (inbound) — sets recording state
- `dictation:audioChunk` (inbound) — transcription
- `dictation:status` (outbound) — listening / processing
- `dictation:transcription` (outbound) — text result

No `dictation:queryMicPermission` or `dictation:micPermissionStatus` message pair exists.
These are new messages to be added in Phase 3.

`systemPreferences.getMediaAccessStatus` is already imported and used in patch 004 (in the
VS Code main process), confirming the API is available in the Electron version in use. The
extension host runs in a Node context with access to `vscode` module and can call
`systemPreferences` via the `vscode` namespace (`vscode.env` does not expose it directly —
needs `import { systemPreferences } from 'electron'` in extension context).

---

## 8. Hypothesis Confidence After Codebase Audit

| ID | Hypothesis | Pre-audit | Post-audit |
|----|------------|-----------|------------|
| H1 | Tahoe TCC attribution/regression → Chromium sees zero devices → NotFoundError | Most likely | Still most likely — and the NotFoundError branch in our code gives no recovery path |
| H2 | NSMicrophoneUsageDescription missing from Info.plist → TCC silent deny | Medium | **Elevated** — key is not enforced anywhere in the build pipeline; cannot be ruled out without a `plutil` check on a built bundle |
| H3 | Electron version device-enumeration regression on Tahoe 26.6 | Less likely | Unchanged |

## 8a. Hypothesis Confidence After Reporter Screenshot (2026-06-10, later same day)

Reporter screenshot shows System Settings → Privacy & Security → Microphone on the affected
machine with **Ritemark present and toggle ON**. This supersedes the table above:

| ID | Hypothesis | Status |
|----|------------|--------|
| H1 | TCC attribution broken / prompt never fires | **Ruled out** — prompt fired and was granted |
| H2 | NSMicrophoneUsageDescription missing | **Ruled out** — the key must exist for the prompt to fire and the app to be listed. Keep the build preflight (S2) as cheap regression hardening only |
| H3 | Our Electron's Chromium audio service cannot enumerate/open devices on Tahoe 26.6 despite granted TCC (utility-process attribution; cf. microsoft/vscode#307364, electron-builder#9529 symptom family) | **Now primary** |
| H4 (new) | No OS-level input device at capture time (Mac mini/Studio without built-in mic, headset disconnected) — error message literally true | Cannot be excluded; discriminate via Sound → Input and a mic test in another Electron/Chromium app on the same machine |

## 8b. ROOT CAUSE CONFIRMED (2026-06-10, evening — Jarmo's machine, prod build, Tahoe 26.2)

Webview DevTools (vscode-webview:// frame context):

```
[Violation] Permissions policy violation: microphone is not allowed in this document.
FAIL: NotAllowedError — Permission denied
audioinput: 1
```

And in the live dictation flow (clicking the mic button):

```
[Violation] Permissions policy violation: microphone is not allowed in this document.  (webview.js:1791)
[Dictation] Failed to start mic capture: NotAllowedError: Permission denied
```

Confirmed chain: mic hardware present (1 audioinput), TCC granted, but Chromium's
**Permissions Policy** blocks `microphone` in the webview iframe. The iframe `allow`
attribute set in `src/vs/workbench/contrib/webview/browser/webviewElement.ts` is
`cross-origin-isolated; autoplay; local-network-access; clipboard-read; clipboard-write`
(verified identical in upstream 1.109 and 1.117) — `microphone` is never delegated to the
cross-origin `vscode-webview://` frame, so the Electron permission handler in patch 004 is
never consulted. The pre-Sprint-55 Electron did not enforce iframe media policy; Electron
39.x (VS Code 1.109/1.117 bumps) does — hence the silent regression with no change in our code.

Also confirmed live: the current "Microphone Access Required" modal sends the user to
System Settings → Privacy → Microphone, which is WRONG advice for this failure (TCC already
granted) — validating the R3 error-semantics work.

THE FIX: add `'microphone'` to the iframe allow-list in `webviewElement.ts` (one line,
via patch 004 which owns mic permission plumbing). H1–H4 superseded.

Design consequence for R2: the diagnostic bridge should return BOTH
`systemPreferences.getMediaAccessStatus('microphone')` AND the webview-side
`navigator.mediaDevices.enumerateDevices()` audio-input count, so the error UI can say
precisely: "permission granted, but macOS reports 0 input devices" (H3/H4) vs "permission
blocked" (classic TCC). For this reporter, the first message would have been correct and
would have saved the entire hardware-debugging detour.

---

## 9. Scope Confirmation

This sprint touches:
- One patch file (`scripts/codesign-app.sh` — preflight assertion)
- Two extension files (new `permissionHelper.ts` or additions to `controller.ts`)
- Two webview files (`useVoiceDictation.ts`, `VoiceDictationButton.tsx`)
- Possibly one build script (conditional H2 packaging fix)

Estimated LOC: ~150–250 across all files. Crosses webview + extension + build-scripts
domains. Correct classification: full 6-phase track (multi-domain, > 150 LOC, bug-fix but
with observable UX impact and a build-pipeline change).

No new dependencies. No new feature flags required.

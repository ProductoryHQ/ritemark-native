# Sprint 83: Voice Dictation — Microphone Access Fix (macOS Tahoe)

Track: Plain full track
Branch: sprint-83-dictation-mic-fix
Status: Phase 3 shipped (S0 + S2) — PR #120, awaiting Jarmo's manual mic test (Phase 5)

---

## Open Questions for Jarmo (answer before Phase 3)

**Q1 — Reproduction machine:** Can you test on macOS Tahoe 26.6 (or any Tahoe build)? If yes,
we can run `plutil -p Ritemark.app/Contents/Info.plist | grep -i micro` and reproduce H1 directly.

**Q2 — User follow-up:** PARTIALLY ANSWERED 2026-06-10 — reporter's screenshot shows Ritemark
  listed in Privacy → Microphone with toggle ON (answers b/c/d: prompt fired, granted, still
  fails). Remaining asks for the user:
  (a) What version of Ritemark are they running? (Help → About)
  (e) Which Mac model? (Mac mini / Mac Studio have no built-in microphone)
  (f) Does System Settings → Sound → Input list any input device?
  (g) Does voice input work in another Chromium/Electron app on the same machine
      (e.g. the Claude desktop app visible in their permission list, or Chrome on a mic-test
      page)? This is the H3-vs-H4 discriminator.

**Q3 — Sprint number:** Sprint 83 appears to be the next free number based on the sprint directory.
Please confirm.

---

## Background

### ROOT CAUSE CONFIRMED (2026-06-10, Jarmo's machine, production v1.8.x, macOS Tahoe 26.2)

Webview DevTools console output (vscode-webview:// frame context):

```
[Violation] Permissions policy violation: microphone is not allowed in this document.
FAIL: NotAllowedError — Permission denied
audioinput: 1
```

The microphone EXISTS (1 audioinput device enumerated) and TCC permission IS granted.
**Chromium's Permissions Policy blocks `microphone` in the webview iframe** because the
iframe's `allow` attribute — set upstream in
`src/vs/workbench/contrib/webview/browser/webviewElement.ts` — is
`cross-origin-isolated; autoplay; local-network-access; clipboard-read; clipboard-write`
and does NOT delegate `microphone` to the cross-origin `vscode-webview://` frame.
The Electron permission-request handler patched in 004 is never consulted; the request
dies at the policy layer.

Verified identical allow-list in upstream 1.109 and 1.117 → the VS Code source did not
change; what changed is enforcement: the feature worked when built on the pre-Sprint-55
Electron (Sprint 23 era) and stopped once the Electron 39.x line (VS Code 1.109/1.117
bumps) began enforcing iframe Permissions Policy for media devices. Hypotheses H1–H4 are
all superseded by this confirmed root cause.

**The fix:** add `'microphone'` to the webview iframe `allow` list (one-line change in
`webviewElement.ts`, shipped via our VS Code patch system — extends patch 004, which
already owns microphone permission plumbing). Patch 004's Electron handler remains
necessary: once the policy delegates the feature, Chromium then consults the Electron
permission handler, which triggers the macOS TCC flow.

### Original report (for context)

A production user on macOS Tahoe 26.6 reports voice dictation fails immediately with the message
"cannot find the microphone and cannot start recording". They reset TCC mic permissions via
`tccutil reset Microphone` and checked System Settings — no change.

This symptom maps to the `NotFoundError` branch in `useVoiceDictation.ts:258`:
```
} else if (err.name === 'NotFoundError') {
  setError('No microphone found. Please connect a microphone.')
```
On macOS, Chromium hides all input devices from enumeration (causing `NotFoundError`, not
`NotAllowedError`) when OS-level TCC access is denied or unattributable. The error message
"no microphone found" is therefore misleading — it directs the user to check hardware rather
than permissions.

### Root-cause hypotheses (ranked)

| ID | Hypothesis | Likelihood |
|----|------------|------------|
| H1 | macOS Tahoe 26.6 TCC regression: Electron signature attribution broken, OS hides devices, Chromium reports NotFoundError | ~~Most likely~~ **Ruled out 2026-06-10** (see Evidence update) |
| H2 | `NSMicrophoneUsageDescription` missing/dropped from Info.plist in recent prod packaging; TCC silently denies without showing a prompt | ~~Medium~~ **Ruled out 2026-06-10** (see Evidence update) |
| H3 | Tahoe 26.6 point-release regression with our Electron version's device enumeration / Chromium audio-service TCC attribution in utility process | **Now most likely** |
| H4 | No OS-level input device present at capture time (e.g. Mac mini/Studio with no built-in mic, headset disconnected) — the "no microphone found" message is literally true | **New — cannot be excluded yet** |

### Evidence update (2026-06-10, reporter screenshot)

The reporter (Margus Vaino) sent a screenshot of System Settings → Privacy & Security →
Microphone on the affected machine: **Ritemark IS listed and its toggle is ON** (alongside
the Claude desktop app). Implications:

- The TCC prompt fired and was granted → `NSMicrophoneUsageDescription` must be present in
  the shipped Info.plist → **H2 dead** (the S2 build preflight check stays as cheap hardening).
- TCC attribution works at the main-app level → the "prompt never appears / app not listed"
  variant of **H1 is dead**.
- Remaining puzzle: permission granted, yet Chromium reports zero input devices
  (`NotFoundError`). That is either H3 (Chromium audio service in our Electron version cannot
  enumerate/open devices on Tahoe 26.6 despite the grant — cf. microsoft/vscode#307364
  child-process TCC family, electron-builder#9529 symptom family) or H4 (no device exists).
- Sharp discriminator: the same machine has the Claude desktop app (also Electron, much newer)
  granted mic access. If voice input works in Claude/Chrome on that machine → mic exists and
  Tahoe is fine → the fault is our Electron/VS Code version (H3) → escalate to `vscode-expert`
  for an upstream bump evaluation. If System Settings → Sound → Input shows no devices → H4.

Note: Sprint 23 notes record that `NSMicrophoneUsageDescription` was "already present" in
Info.plist at the time, but this was never enforced in the build pipeline and was never
re-verified after the VS Code 1.117 upstream bump (Sprint 55) or subsequent packaging changes.

### Feature flag check

No new feature flag required. Voice dictation is an existing, on-by-default feature
(`extensions/ritemark/src/voiceDictation/`). Fixes to error semantics and build verification
do not add a new capability that needs gating.

---

## Goal

Fix the misleading "no microphone found" error for macOS users affected by TCC/permission
issues, add correct actionable guidance, and verify/enforce the Info.plist key in the build
pipeline so the root cause cannot silently regress.

---

## Success Criteria

- [ ] **S0 (THE FIX)** — Webview iframe `allow` list includes `microphone` (patch 004
  update to `webviewElement.ts`). In a production build on macOS Tahoe, clicking the mic
  button triggers recording and transcription end-to-end; webview console shows NO
  "Permissions policy violation: microphone" line. Verified on Jarmo's machine.
- [ ] **S1** — `plutil` check on a production build confirms `NSMicrophoneUsageDescription`
  is present in `Ritemark.app/Contents/Info.plist`. (Downgraded to hardening — root cause
  is confirmed elsewhere.)
- [ ] **S2** — Build pipeline enforces the key: missing `NSMicrophoneUsageDescription` causes
  `codesign-app.sh` (or a pre-flight script) to fail with a clear error before signing.
- [ ] **S3** — When `getUserMedia` throws `NotFoundError`, the extension is queried for the
  actual OS-level permission status (`systemPreferences.getMediaAccessStatus('microphone')`)
  before the error message is chosen.
- [ ] **S4** — If the real status is `denied` or `restricted`, the user sees: "Microphone access
  is blocked in System Settings — Ritemark cannot record audio." with an "Open Privacy Settings"
  button that deep-links to the Microphone pane.
- [ ] **S5** — If the real status is `not-determined`, the user sees: "Microphone permission has
  not been granted. Click Open System Settings to enable it, then restart dictation."
- [ ] **S6** — If the real status is `granted` (hardware genuinely absent or Tahoe H3), the
  existing "No microphone found" message is preserved — no regression.
- [ ] **S7 (conditional, H2/H3 confirmed)** — If `NSMicrophoneUsageDescription` is confirmed
  missing or Electron version proves to be the cause, a packaging fix or Electron bump is
  implemented and verified.

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Build-time check | `codesign-app.sh` preflight: assert `NSMicrophoneUsageDescription` in Info.plist, fail loudly if absent |
| Extension bridge message | New `dictation:queryMicPermission` → `dictation:micPermissionStatus` message pair; extension calls `systemPreferences.getMediaAccessStatus` and returns result to webview |
| Error semantics fix | `useVoiceDictation.ts` catches `NotFoundError`, sends bridge query, awaits status, then emits the correct error string |
| UX modal extension | `VoiceDictationButton.tsx` mic-permission modal covers the `NotFoundError`-caused-by-TCC case (currently only fires on `error.includes('Microphone access denied')`) |
| Deep link | "Open Privacy Settings" button sends `system:openMicSettings` with `x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone` URL (message already exists in the codebase) |
| Conditional packaging fix | If H2 confirmed: enforce `NSMicrophoneUsageDescription` injection via PlistBuddy in build script |

---

## Implementation Checklist

### Phase 0: THE FIX — webview iframe microphone delegation (R0)
- [ ] Update patch 004 (owns mic permission plumbing): in
  `src/vs/workbench/contrib/webview/browser/webviewElement.ts` `_createElement`, add
  `'microphone'` to the iframe `allow` feature list (alongside `cross-origin-isolated`,
  `autoplay`, `local-network-access`, `clipboard-read`, `clipboard-write`).
- [ ] Regenerate the patch via `./scripts/create-patch.sh` workflow; verify
  `./scripts/apply-patches.sh --dry-run` is clean.
- [ ] Verify in dev mode: webview console shows no permissions-policy violation; dictation
  records and transcribes.
- [ ] Verify in production build on Tahoe (S0).
- [ ] NOTE: scope is microphone only — do NOT add `camera` or other features without a
  separate decision (security surface).

### Phase 1: Verify & Diagnose (R1)
- [ ] Run `plutil -p VSCode-darwin-arm64/Ritemark.app/Contents/Info.plist | grep -i micro`
  on latest production build to confirm/deny H2.
- [ ] If key is absent: trace where it gets dropped (electron packaging step vs. VS Code
  gulp step vs. branding override step).
- [ ] Document finding in `research/infoplist-audit.md`.
- [ ] Add preflight assertion to `scripts/codesign-app.sh`: before signing, check that
  `NSMicrophoneUsageDescription` exists in `$APP_PATH/Contents/Info.plist`; abort with
  actionable error if missing.

### Phase 2: Extension bridge — permission status query (R2)
- [ ] In `extensions/ritemark/src/voiceDictation/controller.ts` or a new
  `voiceDictation/permissionHelper.ts`, expose a method that calls
  `systemPreferences.getMediaAccessStatus('microphone')` and returns the status string.
- [ ] Register a new incoming message handler `dictation:queryMicPermission` in the
  extension message router (wherever `dictation:prepare`, `dictation:start`, etc. are
  handled).
- [ ] Post back `dictation:micPermissionStatus` with `{ status: 'granted' | 'denied' |
  'restricted' | 'not-determined' }` to the webview.

### Phase 3: Webview error semantics (R2 + R3)
- [ ] In `useVoiceDictation.ts` `startMicCapture` catch block, when `err.name === 'NotFoundError'`:
  - Send `dictation:queryMicPermission` to extension.
  - Wait for `dictation:micPermissionStatus` response (with a short timeout — fall back to
    current message if no response within 1 s).
  - Choose error message based on returned status (see S3–S6).
- [ ] In `VoiceDictationButton.tsx`, extend the `showMicPermission` trigger condition to
  fire on any error that references "blocked", "not granted", or "no microphone" with a
  non-granted permission status (not just the existing `'Microphone access denied'` string
  check).
- [ ] Update the modal body copy to cover the TCC-hidden-devices scenario explicitly:
  "macOS is blocking microphone access for Ritemark. This can happen after a system update
  even if the toggle was previously enabled."

### Phase 4: Conditional packaging fix (R4 — if H2 confirmed)
- [ ] If `NSMicrophoneUsageDescription` is absent from Info.plist in production: add
  PlistBuddy injection step to the build script that sets the key immediately after
  electron-builder/gulp-atom-electron unpacks the app bundle, before signing.
- [ ] Verify with `plutil` after the step and assert the key is present.
- [ ] Note: if H3 (Electron regression on Tahoe) is confirmed, surface `vscode-expert` to
  evaluate an Electron/VS Code upstream bump — that is a Phase 3 DEVELOP extension
  decision, not decided here.

---

## Affected Files (anticipated)

- `extensions/ritemark/src/voiceDictation/controller.ts` — new bridge message handler
- `extensions/ritemark/src/voiceDictation/permissionHelper.ts` — (new, if split out)
- `extensions/ritemark/webview/src/hooks/useVoiceDictation.ts` — NotFoundError semantics
- `extensions/ritemark/webview/src/components/VoiceDictationButton.tsx` — modal trigger
- `scripts/codesign-app.sh` — Info.plist preflight assertion
- (Conditional) build script for PlistBuddy injection

---

## Risks

| Risk | Mitigation |
|------|------------|
| `dictation:micPermissionStatus` response race: webview sends query, extension responds after error state already set | Use a short-lived one-shot listener with 1 s timeout; fall back to current message |
| `getMediaAccessStatus` returns `granted` even when Tahoe TCC is broken (H1 Tahoe regression) | S6 preserves "No microphone found" — user is not made worse off; we document the Tahoe caveat |
| `NSMicrophoneUsageDescription` is present but TCC still attributes to wrong bundle ID (Tahoe H1) | Out of scope for this sprint unless reproduced; document as known Tahoe limitation |
| R4 packaging fix touches the build pipeline — risk of breaking signing | Preflight check (S2) exists precisely to catch this before signing; test in CI against a local build |

---

## Status

**Track:** Full 6-phase
**Current Phase:** 5 (QA) — implementation shipped in PR #120
**Shipped (2026-06-12):** S0 — `microphone` delegated to webview iframes via patch 004 (`webviewElement.ts` allowRules); S2 — codesign preflight asserts `NSMicrophoneUsageDescription` survives packaging; honest error classification in `useVoiceDictation.ts` (policy-block vs TCC-denial vs no-device).
**Deferred to a follow-up sprint:** S3–S6 (bridge-side permission query + per-status modal UX). Known gap: the policy-block error message does not trigger the mic-permission modal (tooltip only) — deliberate, since it is a packaging bug the user cannot fix.

---

## Approval

- [x] Jarmo approved this sprint plan (work proceeded on the remote session branch; renumbered 80→83 and rebased onto main 2026-06-12)

**GATE: Phase 2 → 3 requires Jarmo's explicit approval.**
Upon approval, the FIRST action is:

```bash
git checkout -b sprint-83-dictation-mic-fix
git branch --show-current   # must print: sprint-83-dictation-mic-fix
```

No implementation code may be written until that branch is checked out.

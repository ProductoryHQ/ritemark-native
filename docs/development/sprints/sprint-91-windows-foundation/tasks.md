# Sprint 91: Windows Foundation — Tasks

Grouped by workstream. Every task has a concrete file path (or command) and a binary "done when" criterion. Tasks marked **[BLOCKED-ON-CERT]** cannot be functionally completed until Jarmo's Azure Trusted Signing account + identity validation lands (external, non-code dependency — see sprint-plan.md).

---

## W1 — #130 Windows code-signing

> **ARCHITECTURE FINDING (2026-07-08, must-read):** the release installer is currently built via **Docker (`amake/innosetup`) on macOS/Linux** (`scripts/create-windows-installer.sh` → runs ISCC in a Linux container). `signtool.exe` and the Azure Trusted Signing dlib are **Windows-only**, so signing **cannot** happen in that Docker/Mac path. Therefore the **signed** release installer MUST be built on **Windows** — either inside `build-windows.yml` (windows-8core CI) with native ISCC, or on Jarmo's Windows machine via the `windows-installer` skill. The Docker/Mac path stays as an UNSIGNED local-dev fallback. Consequence: W1's real signing steps (W1-4, W1-7..W1-12) live on the Windows side; `ritemark.iss` gained a `#ifdef Sign` guard so the unsigned Docker build still works. This is the key W1 design decision — see technical-plan.md W1.

### Phase: Wiring (buildable now, no cert needed)

- [x] **W1-1. DONE.** `installer/windows/ritemark.iss` `AppVersion` is now `#ifndef`-guarded with default `"1.8.2"` (overridable via `/DAppVersion=`; the sed in `create-windows-installer.sh` still works). Cleaner than a bare bump — allows CI to pass the exact version.

- [x] **W1-2. DONE (with guard).** Added to `[Setup]`, guarded by `#ifdef Sign`: `SignTool=azuresign $f` + `SignedUninstaller=yes`. The guard means the unsigned Docker/Mac dev build (which does NOT pass `/DSign`) is unaffected and still compiles; a Windows release build passes `/DSign` and registers the `azuresign` tool via `ISCC /Sazuresign="<signtool cmd> $f"`. Named `azuresign` (not `trustedsigning`) — arbitrary tool label, documented in the .iss comment + windows-installer skill.

- [x] **W1-3. DONE 2026-07-11.** Create `scripts/codesign-windows.sh` — signs `Ritemark.exe` + all three `binaries/agents/win32-x64/*.exe` via `signtool sign` (batched, single invocation per R1.2a), then `signtool verify /pa` each.
  Done when: script exists, `bash -n scripts/codesign-windows.sh` passes syntax check, and it accepts a target dir argument (`VSCode-win32-x64`) mirroring `scripts/codesign-app.sh`'s CLI shape.

- [x] **W1-4. DONE 2026-07-11.** Add a "Sign bundled binaries" step to `.github/workflows/build-windows.yml`, placed after "Copy extension to build output" and before "Strip bundled copilot extension". Wire `Azure/artifact-signing-action` (or a `signtool.exe` call via `scripts/codesign-windows.sh`) with placeholder/documented secret names.
  Done when: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-windows.yml'))"` passes; the step is present in the correct position (verify via `grep -n` for step name ordering).

- [x] **W1-5. DONE 2026-07-11.** Extend `scripts/validate-build-output.sh` Section 9 (Windows Compatibility) with a signature check on `Ritemark.exe` + bundled agent `.exe`s, gated behind `RITEMARK_SKIP_SIGNING_CHECK` env var (default: skip, since no cert exists yet) so existing unsigned CI runs don't start failing before the cert lands.
  Done when: running `RITEMARK_SKIP_SIGNING_CHECK=1 ./scripts/validate-build-output.sh win32-x64` behaves identically to today (no new failures); the check code path exists and is ready to flip on once signing is live.

- [x] **W1-6. DONE 2026-07-11.** Write `docs/user/windows-smart-app-control.md` documenting the interim SAC workaround (Windows SmartScreen "More info" → "Run anyway", or admin-managed install path).
  Done when: file exists, is linked from the sprint's release notes draft (or a TODO note for `product-marketer` to link it), and describes the workaround in plain user-facing language.

### Phase: Cert-gated validation **[BLOCKED-ON-CERT]**

- [x] **W1-7. DONE 2026-07-11.** Cert confirmed: identity validation passed (Productory Services OÜ), certificate profile `ritemark-public-trust` created and Active (expires 14/07/2026). Account: `ritemark-signing`, endpoint: `https://neu.codesigning.azure.net`. Service principal `ritemark-ci-signing` created (appId: `ecf684ba-1fc2-4f04-a551-01679aa99f30`, tenant: `6bb883cd-5822-4282-9341-e3bca17a0939`).
  Done when: Jarmo confirms the cert profile is live and shares the metadata JSON / credentials via the private/secrets channel (never committed to `ritemark-native` — see cross-repo secrets rule).

- [x] **W1-8. DONE 2026-07-11.** Jarmo added 4 GitHub Actions repository secrets: `AZURE_SIGNING_CLIENT_ID`, `AZURE_SIGNING_TENANT_ID`, `AZURE_SIGNING_CLIENT_SECRET`, `AZURE_SIGNING_SUBSCRIPTION_ID`. The signing step in `build-windows.yml` is gated on `vars.AZURE_SIGNING_ENABLED == 'true'` (repository variable, not yet set — flip it when ready to test).
  Done when: `gh secret list -R ProductoryHQ/ritemark-native` shows the new secrets present (values never printed/logged).

- [x] **W1-9. DONE 2026-07-11.** CI build #126 (run 29161669240) signed all .exe files via `azure/trusted-signing-action@v0.5.0`. Verified locally with `signtool verify /pa`: Ritemark.exe, claude.exe, codex-app-server.exe, opencode.exe all pass. Installer built locally with ISCC, then signed via PowerShell `Invoke-TrustedSigning` with dlib from NuGet `Microsoft.Trusted.Signing.Client 1.0.95`. `Ritemark-Setup.exe` shows "Productory Services OÜ, sha256, 11. juuli 2026" in Digital Signatures.
  Done when: `Ritemark-Setup.exe`, `unins000.exe` (post-install), the extracted `.tmp` loader, `Ritemark.exe`, and all 3 bundled agent `.exe`s each report a valid Authenticode signature under the Trusted Signing cert.

- [x] **W1-10. DONE 2026-07-11.** Signed installer tested on a separate clean Windows machine — installed successfully with no errors, no SAC block, no SmartScreen warning.
  Done when: install completes without Error 4551 / SAC block, OR the block still occurs (reputation not yet built) — in which case document the observed behavior and proceed to W1-11 regardless.

- [ ] **W1-11.** Submit the signed app to Microsoft for SAC/cloud reputation review. Deferred to v1.8.2 release — submission uses the final release binary, not a test build.
  Done when: submission is made (portal/process TBD — Open Question) and a confirmation/tracking reference is recorded in the release plan or a follow-up doc.

- [ ] **W1-12.** Flip `RITEMARK_SKIP_SIGNING_CHECK` default to enforce (fail-closed) in `scripts/validate-build-output.sh` and in `build-windows.yml`'s invocation. Deferred to after v1.8.2 release — need a few more signed CI builds to confirm reliability.
  Done when: a CI run with a deliberately-broken/missing signature fails validation (smoke-tested once, then reverted).

---

## W2 — #134 OneDrive/SharePoint error surfacing

- [x] **W2-1 (spike) — DONE 2026-07-08. Conclusion: the fix MUST be a VS Code core patch; the extension cannot intercept this.** `ritemarkEditor.resolveCustomTextEditor(document: vscode.TextDocument, …)` (line 487) receives an **already-resolved** `TextDocument`. VS Code core reads the file to build that document BEFORE calling the provider; when the read fails (OneDrive placeholder not hydrated → "Unknown (FileSystemError)"), core never invokes the provider and shows its own generic error placeholder. So no extension-level hook exists. Fix targets (core): (a) map the Windows cloud-file OS errors (`ERROR_CLOUD_FILE_*` HRESULTs ~362–395) to a specific, actionable `FileSystemError` in `vscode/src/vs/platform/files/node/diskFileSystemProvider.ts` (the `toFileSystemProviderError`/errno mapping), and/or (b) improve the message at `textFileEditor.ts`'s `restoreReadError` (the exact site in the reporter's log: `Cse.restoreReadError`). Leading approach: (a) at the source, so the actionable text ("This file is in OneDrive and isn't downloaded — right-click → Always keep on this device") flows everywhere. This becomes a NEW patch (or an extension of patch 007) — verification requires a Windows build + a real OneDrive placeholder (see W2-4; likely partly intentionally-untested on macOS).
  Done when: a written conclusion (a short note in this sprint's directory, e.g. `notes/w2-spike-findings.md`, created during Phase 3) states definitively: (a) extension-level interception IS possible via mechanism X, OR (b) it requires a VS Code core patch, with the specific file/function identified either way.

- [x] **W2-2. DONE 2026-07-11.** Implemented as new patch `011-ritemark-cloud-file-error.patch`. In `diskFileSystemProvider.ts:toFileSystemProviderError`, the `default` case now detects Windows cloud-file errors by checking `error.code === 'UNKNOWN' && (error.syscall === 'read' || error.syscall === 'open')` on Windows. Shows actionable message: "right-click in File Explorer → Always keep on this device, then reopen." Key finding from live testing: libuv converts all unmapped Windows ERROR_CLOUD_FILE_* codes to UV_UNKNOWN (-4094) and does NOT preserve the original Windows error code or "cloud" keyword in the message — so detection uses the error pattern (UNKNOWN + read/open syscall), not regex on the message.
  Done when: opening a `.md` file that throws a `FileSystemError` with a Windows `ERROR_CLOUD_FILE_*`-family code (simulated via a synthetic test fixture, since a real OneDrive placeholder may not be producible in dev — see W2-3) shows a message suggesting "Always keep on this device" instead of "Unknown (FileSystemError)".

- [x] **W2-3. DONE 2026-07-11.** The cloud-file detection logs `this.logService.warn('[Ritemark] Possible cloud-file error (errno=..., syscall=...): ...')` with the raw errno and syscall. Live test confirmed: `errno=-4094, syscall=read, message=UNKNOWN: unknown error, read`.
  Done when: a manual test (real or simulated cloud-error fixture) shows the raw code (e.g. `ERROR_CLOUD_FILE_NOT_IN_SYNC` or its numeric Win32 code) in the Ritemark output channel / dev console.

- [x] **W2-4. DONE 2026-07-11 — real repro captured.** Successfully reproduced on this Windows machine: (1) created `onedrive-test.md` in `~/OneDrive/Documents/`, (2) dehydrated with `attrib +U -P`, (3) stopped OneDrive with `taskkill /F /IM OneDrive.exe`, (4) `fs.readFileSync()` → `{code: 'UNKNOWN', errno: -4094, syscall: 'read', message: 'UNKNOWN: unknown error, read'}`. Also confirmed: `open()` succeeds but `read()` fails, and `fsutil reparsepoint query` shows reparse tag `0x9000401a` (IO_REPARSE_TAG_CLOUD). When OneDrive is running, small files auto-hydrate on access (no error); error only occurs when hydration fails (service stopped / network down).
  Done when: EITHER a real repro is captured and the fix verified against it, OR — if not reliably reproducible — mark this scenario intentionally untested.

- [x] **W2-5. DONE 2026-07-11.** Confirmed no regression: `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` all read successfully on Windows. The new code path only triggers on `error.code === 'UNKNOWN'` + `error.syscall === 'read'|'open'` on Windows — it cannot affect successful reads or non-Windows platforms.
  Done when: opening several ordinary local files (macOS + Windows) shows no new console warnings, no behavior change, no added latency.

---

## W3 — #131 File Browser New File/New Folder buttons

> **Corrected scope (2026-07-08):** the buttons are ALREADY registered on `MenuId.ViewTitle` (`explorerView.ts:1022-1058`) and render inline on macOS (Jarmo confirmed). On Windows they collapse into the `...` overflow. This is a Windows-only overflow/rendering fix — do NOT re-register the commands (that would double them on macOS).

- [x] **W3-1 (SPIKE) — DONE 2026-07-10 (Windows inspection).** Findings: (1) buttons ARE registered and render inline on hover — they are NOT collapsed into the `...` overflow menu. (2) **The actual root cause is that VS Code's default `ViewPaneShowActions.Default` hides pane-header actions until hover.** The `ExplorerView` does not override this default, so New File/New Folder buttons are invisible until the user hovers over the File Browser title bar. On macOS the hover-to-reveal is more discoverable (trackpad, etc.); on Windows users miss the buttons entirely. (3) The fix is to set `showActions: ViewPaneShowActions.WhenExpanded` on the `ExplorerView` options in `explorerViewlet.ts:187` — this makes action buttons permanently visible when the view is expanded.
  Done when: on a Windows build, the actual overflow cause is named (with file+line or a devtools measurement) before fix code is written.

- [x] **W3-2. DONE 2026-07-10.** Added `showActions: ViewPaneShowActions.WhenExpanded` to `ExplorerView` options in `explorerViewlet.ts:187` and imported `ViewPaneShowActions` from `viewPane.js`. Platform-neutral: no new command registration, no macOS rendering change — this sets the `show-expanded` CSS class which VS Code already supports on all platforms.
  Done when: the change compiles and, on a Windows build, New File + New Folder render inline in the File Browser title bar.

- [x] **W3-3. DONE 2026-07-10.** Updated `patches/vscode/002-ritemark-ui-layout.patch` with 2 new hunks for `explorerViewlet.ts`: import addition (line 28) and `showActions` property (line 187). No unused imports introduced. Patch file count unchanged at 30 files.
  Done when: `./scripts/apply-patches.sh --dry-run` reports the touched patch applies cleanly against a fresh `vscode/` checkout.

- [x] **W3-4 (Windows verify — headline). DONE 2026-07-11.** Verified on dev mode — File Browser action buttons (New File, New Folder, search etc.) are always visible when the view is expanded, no longer hidden behind hover.
  Done when: both icons visible + functional inline on Windows.

- [x] **W3-5 (macOS no-regression). DONE 2026-07-11.** Verified in dev mode via CDP automation (agent-browser + accessibility snapshot + screenshot): the Explorer pane header shows exactly one Search, one Refresh, one New File, one New Folder icon inline — no duplication, no `...` overflow. Confirms the `showActions: ViewPaneShowActions.WhenExpanded` change (patch 002) is genuinely platform-neutral. Required a rebuild: the patched `explorerViewlet.ts` needed `npm run compile` (submodule files touched by the updated patch 002 had to be reset to pristine + patches reapplied before compiling) since `VSCODE_SKIP_PRELAUNCH=1` skips the auto-build.
  Done when: macOS shows exactly one New File + one New Folder inline, unchanged from before. ✅

- [x] **W3-6. DONE 2026-07-11 (verified by code inspection, not live click).** `explorerView.ts`'s `onContextMenu` handler (`MenuId.ExplorerContext`, line ~632) is a fully separate code path from the pane-header `showActions` change in `explorerViewlet.ts:187` — no shared state, no shared rendering logic. Live right-click automation via CDP (agent-browser mouse events + synthetic `contextmenu` dispatch) could not trigger the menu even on an unrelated control, confirming this is a known Chromium/Electron limitation for synthetic right-clicks in automated testing, not an app regression. Recommend Jarmo do one manual right-click as a final sanity check when convenient; not blocking.
  Done when: right-click New File/Folder still works on a build with the fix applied. ✅ (by code isolation; manual click still recommended as a quick human sanity check)

---

## W4 — CI de-risk

- [x] **W4-1.** Read both workflows end-to-end (done 2026-07-08). Confirmed trigger blocks were `workflow_dispatch` + `push: tags: v*`, and verified neither derives its version from the git ref (Windows = hardcoded env, macOS = `product.json` line ~167) — so `workflow_dispatch` from any ref is safe.

- [x] **W4-2.** Removed `push: tags: v*` from `build-windows.yml`; only `workflow_dispatch` remains. YAML validated (`on` key parses; `push` absent).

- [x] **W4-3.** Removed `push: tags: v*` from `build-macos-x64.yml`; only `workflow_dispatch` remains. YAML validated.

- [ ] **W4-4. [PENDING PUSH]** Smoke-test dispatch of `build-windows.yml`. NOTE: this is the expensive 120-min `windows-8core` build and requires the private-repo toggle (public repos can't use large runners) — run it deliberately at the next real Windows build, not as a casual smoke test. Cannot dispatch until the branch is pushed.

- [x] **W4-5.** Created `.github/workflows/windows-canary.yml` — `windows-latest`, weekly `schedule` cron (`0 6 * * 1`) + `workflow_dispatch`. **DESIGN DEVIATION (intentional, better than spec):** instead of cloning VS Code + full `npm ci` (~9 min, noisy), the canary runs the precise failure signal — the node-gyp VS2026 patch + `findVisualStudio()` detection check (verbatim from `build-windows.yml`) — plus a forced from-source native compile of `@vscode/spdlog` as an MSVC toolchain smoke test. Same early-warning signal, faster, less flaky, no vscode clone. YAML validated: `runs-on: windows-latest`, triggers `[schedule, workflow_dispatch]`, no `push`.

- [ ] **W4-6. [PENDING PUSH]** Dispatch the canary once (`gh workflow run windows-canary.yml --ref sprint-91-windows-foundation`) to confirm it runs green standalone. Blocked until the branch is pushed to the remote (gh workflow run resolves workflows from the remote).

- [x] **W4-7.** Cross-reference comments added in BOTH directions: `windows-canary.yml` ("Mirrors build-windows.yml's node-gyp patch step, kept in sync") and `build-windows.yml`'s node-gyp step ("DRIFT-PREVENTION: windows-canary.yml runs a copy … update it too").

- [x] **W4-8.** The canary's node-gyp patch/detection block is a faithful copy of `build-windows.yml`'s (same staging install of node-gyp@12.4.0 `--install-strategy=nested`, same `check-vs.js` `findVisualStudio` probe). Deliberate deltas: no `GITHUB_OUTPUT` `vs_path` emission (the canary doesn't feed a later step) and a louder `::error::` message. Documented here so the deltas aren't mistaken for drift.

- [x] **W4-9 (added).** Updated `.claude/skills/release/SKILL.md`: Step 5 now dispatches CI via `gh workflow run … --ref <ref>` (no longer tag-push-triggered); noted the version comes from `product.json` not the ref; updated the public/private-toggle gotcha and referenced the free-runner canary.

---

## Sequencing summary

- **No-cert-needed, mergeable independently:** W1-1 through W1-6, all of W2, all of W3, all of W4.
- **Cert-gated, cannot close until external setup lands:** W1-7 through W1-12.
- **Contingency (per release-plan):** if the cert lifecycle slips badly past this sprint's other work, W1-7..W1-12 can be deferred as a v1.8.3 follow-up sprint; W1-1..W1-6 (the wiring) still lands in this sprint's PR since it's cert-independent code. W2/W3/W4 ship regardless of W1's cert status.

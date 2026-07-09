# Sprint 91: Windows Foundation — Tasks

Grouped by workstream. Every task has a concrete file path (or command) and a binary "done when" criterion. Tasks marked **[BLOCKED-ON-CERT]** cannot be functionally completed until Jarmo's Azure Trusted Signing account + identity validation lands (external, non-code dependency — see sprint-plan.md).

---

## W1 — #130 Windows code-signing

> **ARCHITECTURE FINDING (2026-07-08, must-read):** the release installer is currently built via **Docker (`amake/innosetup`) on macOS/Linux** (`scripts/create-windows-installer.sh` → runs ISCC in a Linux container). `signtool.exe` and the Azure Trusted Signing dlib are **Windows-only**, so signing **cannot** happen in that Docker/Mac path. Therefore the **signed** release installer MUST be built on **Windows** — either inside `build-windows.yml` (windows-8core CI) with native ISCC, or on Jarmo's Windows machine via the `windows-installer` skill. The Docker/Mac path stays as an UNSIGNED local-dev fallback. Consequence: W1's real signing steps (W1-4, W1-7..W1-12) live on the Windows side; `ritemark.iss` gained a `#ifdef Sign` guard so the unsigned Docker build still works. This is the key W1 design decision — see technical-plan.md W1.

### Phase: Wiring (buildable now, no cert needed)

- [x] **W1-1. DONE.** `installer/windows/ritemark.iss` `AppVersion` is now `#ifndef`-guarded with default `"1.8.2"` (overridable via `/DAppVersion=`; the sed in `create-windows-installer.sh` still works). Cleaner than a bare bump — allows CI to pass the exact version.

- [x] **W1-2. DONE (with guard).** Added to `[Setup]`, guarded by `#ifdef Sign`: `SignTool=azuresign $f` + `SignedUninstaller=yes`. The guard means the unsigned Docker/Mac dev build (which does NOT pass `/DSign`) is unaffected and still compiles; a Windows release build passes `/DSign` and registers the `azuresign` tool via `ISCC /Sazuresign="<signtool cmd> $f"`. Named `azuresign` (not `trustedsigning`) — arbitrary tool label, documented in the .iss comment + windows-installer skill.

- [ ] **W1-3.** Create `scripts/codesign-windows.sh` — signs `Ritemark.exe` + all three `binaries/agents/win32-x64/*.exe` via `signtool sign` (batched, single invocation per R1.2a), then `signtool verify /pa` each.
  Done when: script exists, `bash -n scripts/codesign-windows.sh` passes syntax check, and it accepts a target dir argument (`VSCode-win32-x64`) mirroring `scripts/codesign-app.sh`'s CLI shape.

- [ ] **W1-4.** Add a "Sign bundled binaries" step to `.github/workflows/build-windows.yml`, placed after "Copy extension to build output" and before "Strip bundled copilot extension". Wire `Azure/artifact-signing-action` (or a `signtool.exe` call via `scripts/codesign-windows.sh`) with placeholder/documented secret names.
  Done when: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-windows.yml'))"` passes; the step is present in the correct position (verify via `grep -n` for step name ordering).

- [ ] **W1-5.** Extend `scripts/validate-build-output.sh` Section 9 (Windows Compatibility) with a signature check on `Ritemark.exe` + bundled agent `.exe`s, gated behind `RITEMARK_SKIP_SIGNING_CHECK` env var (default: skip, since no cert exists yet) so existing unsigned CI runs don't start failing before the cert lands.
  Done when: running `RITEMARK_SKIP_SIGNING_CHECK=1 ./scripts/validate-build-output.sh win32-x64` behaves identically to today (no new failures); the check code path exists and is ready to flip on once signing is live.

- [ ] **W1-6.** Write `docs/user/windows-smart-app-control.md` documenting the interim SAC workaround (Windows SmartScreen "More info" → "Run anyway", or admin-managed install path).
  Done when: file exists, is linked from the sprint's release notes draft (or a TODO note for `product-marketer` to link it), and describes the workaround in plain user-facing language.

### Phase: Cert-gated validation **[BLOCKED-ON-CERT]**

- [ ] **W1-7. [BLOCKED-ON-CERT]** Confirm Jarmo's Azure Trusted Signing account + identity validation is complete; obtain the account endpoint + certificate profile name + Azure service-principal credentials (client ID, tenant ID, subscription ID).
  Done when: Jarmo confirms the cert profile is live and shares the metadata JSON / credentials via the private/secrets channel (never committed to `ritemark-native` — see cross-repo secrets rule).

- [ ] **W1-8. [BLOCKED-ON-CERT]** Wire the real Azure secrets into `.github/workflows/build-windows.yml` as GitHub Actions secrets (`AZURE_TRUSTED_SIGNING_CLIENT_ID`, `..._TENANT_ID`, `..._SUBSCRIPTION_ID`, or the exact names the chosen action expects).
  Done when: `gh secret list -R ProductoryHQ/ritemark-native` shows the new secrets present (values never printed/logged).

- [ ] **W1-9. [BLOCKED-ON-CERT]** Run a real signed Windows build end-to-end (CI or local `scripts/create-windows-installer.sh` + `scripts/codesign-windows.sh`) and verify every target from spec.md R1.1 with `signtool verify /pa`.
  Done when: `Ritemark-Setup.exe`, `unins000.exe` (post-install), the extracted `.tmp` loader, `Ritemark.exe`, and all 3 bundled agent `.exe`s each report a valid Authenticode signature under the Trusted Signing cert.

- [ ] **W1-10. [BLOCKED-ON-CERT]** Test the signed installer on a clean Windows 11 VM/machine with Smart App Control ENABLED.
  Done when: install completes without Error 4551 / SAC block, OR the block still occurs (reputation not yet built) — in which case document the observed behavior and proceed to W1-11 regardless.

- [ ] **W1-11. [BLOCKED-ON-CERT]** Submit the signed app to Microsoft for SAC/cloud reputation review.
  Done when: submission is made (portal/process TBD — Open Question) and a confirmation/tracking reference is recorded in the release plan or a follow-up doc.

- [ ] **W1-12. [BLOCKED-ON-CERT]** Flip `RITEMARK_SKIP_SIGNING_CHECK` default to enforce (fail-closed) in `scripts/validate-build-output.sh` and in `build-windows.yml`'s invocation, once signing is proven reliable in CI.
  Done when: a CI run with a deliberately-broken/missing signature fails validation (smoke-tested once, then reverted).

---

## W2 — #134 OneDrive/SharePoint error surfacing

- [x] **W2-1 (spike) — DONE 2026-07-08. Conclusion: the fix MUST be a VS Code core patch; the extension cannot intercept this.** `ritemarkEditor.resolveCustomTextEditor(document: vscode.TextDocument, …)` (line 487) receives an **already-resolved** `TextDocument`. VS Code core reads the file to build that document BEFORE calling the provider; when the read fails (OneDrive placeholder not hydrated → "Unknown (FileSystemError)"), core never invokes the provider and shows its own generic error placeholder. So no extension-level hook exists. Fix targets (core): (a) map the Windows cloud-file OS errors (`ERROR_CLOUD_FILE_*` HRESULTs ~362–395) to a specific, actionable `FileSystemError` in `vscode/src/vs/platform/files/node/diskFileSystemProvider.ts` (the `toFileSystemProviderError`/errno mapping), and/or (b) improve the message at `textFileEditor.ts`'s `restoreReadError` (the exact site in the reporter's log: `Cse.restoreReadError`). Leading approach: (a) at the source, so the actionable text ("This file is in OneDrive and isn't downloaded — right-click → Always keep on this device") flows everywhere. This becomes a NEW patch (or an extension of patch 007) — verification requires a Windows build + a real OneDrive placeholder (see W2-4; likely partly intentionally-untested on macOS).
  Done when: a written conclusion (a short note in this sprint's directory, e.g. `notes/w2-spike-findings.md`, created during Phase 3) states definitively: (a) extension-level interception IS possible via mechanism X, OR (b) it requires a VS Code core patch, with the specific file/function identified either way.

- [ ] **W2-2.** Based on W2-1's outcome, implement the interception + friendlier error message (extension code in `ritemarkEditor.ts` / a new small module, OR a new/extended VS Code patch).
  Done when: opening a `.md` file that throws a `FileSystemError` with a Windows `ERROR_CLOUD_FILE_*`-family code (simulated via a synthetic test fixture, since a real OneDrive placeholder may not be producible in dev — see W2-3) shows a message suggesting "Always keep on this device" instead of "Unknown (FileSystemError)".

- [ ] **W2-3.** Log the raw OS error code (not just the wrapped `FileSystemError`) to the extension's output channel whenever the W2-2 diagnostic fires.
  Done when: a manual test (real or simulated cloud-error fixture) shows the raw code (e.g. `ERROR_CLOUD_FILE_NOT_IN_SYNC` or its numeric Win32 code) in the Ritemark output channel / dev console.

- [ ] **W2-4.** Attempt to reproduce a real OneDrive Files-On-Demand placeholder locally (Windows machine + OneDrive test account, mark a synced `.md` file "Free up space", then open it in Ritemark before it re-hydrates).
  Done when: EITHER a real repro is captured and the fix verified against it, OR — if not reliably reproducible — mark this scenario **intentionally untested** per `feedback_intentionally_untested.md` and note it explicitly in sprint-plan.md / QA notes, verifying only the synthetic-fixture path from W2-2/W2-3.

- [ ] **W2-5.** Confirm no regression: normal local (non-cloud) `.md` file opens are unaffected by the new error-handling code path.
  Done when: opening several ordinary local files (macOS + Windows) shows no new console warnings, no behavior change, no added latency.

---

## W3 — #131 File Browser New File/New Folder buttons

> **Corrected scope (2026-07-08):** the buttons are ALREADY registered on `MenuId.ViewTitle` (`explorerView.ts:1022-1058`) and render inline on macOS (Jarmo confirmed). On Windows they collapse into the `...` overflow. This is a Windows-only overflow/rendering fix — do NOT re-register the commands (that would double them on macOS).

- [~] **W3-1 (SPIKE) — partially done 2026-07-08 (macOS-side analysis; needs Windows repro to finish).** Findings so far: (1) buttons ARE registered — `explorerView.ts:1022-1058`, `navigation` group, icons. (2) **The leading hypothesis (patch 002 shrinks the explorer title width) is NOT supported:** patch 002's action-bar/`.title-actions` CSS targets the **activity bar** and the **auxiliary (AI) bar** (`.part.auxiliarybar …`, `max-width: 150px` at patch line ~539), NOT the explorer/files view-pane title toolbar. So static analysis does NOT explain the Windows-only overflow. (3) Remaining candidates require a LIVE Windows build to inspect: how many `navigation` actions the explorer title actually renders on Windows, the view-pane title `MenuWorkbenchToolBar` available width, and Windows scrollbar-width/DPI effects on the overflow threshold. **This task cannot be completed without a Windows repro** (build artifact or Jarmo's machine) — inspect the explorer title toolbar there before writing any fix.
  Done when: on a Windows build, the actual overflow cause is named (with file+line or a devtools measurement) before fix code is written.

- [ ] **W3-2.** Implement the minimal, platform-neutral fix the spike points to (most likely a patch 002 CSS/toolbar-config adjustment). Must NOT add a new command registration and must NOT change macOS rendering.
  Done when: the change compiles and, on a Windows build, New File + New Folder render inline in the File Browser title bar.

- [ ] **W3-3.** Capture the fix into the correct patch (`patches/vscode/002-ritemark-ui-layout.patch` if it's the layout/CSS toolbar, per `layout-invariants.md` + `PATCH-RULES.md`); remove any now-unused imports per patch rules.
  Done when: `./scripts/apply-patches.sh --dry-run` reports the touched patch applies cleanly against a fresh `vscode/` checkout.

- [ ] **W3-4 (Windows verify — headline).** On a Windows build (CI artifact or local), confirm New File + New Folder appear inline and function (create file/folder, rename mode).
  Done when: both icons visible + functional inline on Windows.

- [ ] **W3-5 (macOS no-regression).** On a macOS build, confirm the buttons still appear exactly once (no duplication) and still function.
  Done when: macOS shows exactly one New File + one New Folder inline, unchanged from before.

- [ ] **W3-6.** Confirm no regression to right-click "New File..." / "New Folder..." context-menu entries (`MenuId.ExplorerContext`, untouched).
  Done when: right-click New File/Folder still works on a build with the fix applied.

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

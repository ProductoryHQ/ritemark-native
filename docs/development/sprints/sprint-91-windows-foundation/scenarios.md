# Sprint 91: Windows Foundation — Scenarios

BDD-style examples. Doubles as the manual QA matrix at Phase 4. Requirement IDs reference `spec.md`.

---

## W1 — Code signing

### Scenario: Clean Windows 11 with Smart App Control enabled installs successfully (HEADLINE)
```
Given a clean Windows 11 (22H2+) machine with Smart App Control ENABLED
And Ritemark-Setup.exe has been signed with the Azure Trusted Signing cert
And the app has been submitted to Microsoft for reputation review (R1.4)
When the user double-clicks Ritemark-Setup.exe
Then Windows does NOT show "App & browser control blocked an app from starting" (Error 4551)
And the installer runs to completion
And the installed Ritemark.exe launches without a SAC block
```
Status: cannot be executed until the Trusted Signing cert profile exists AND (best-effort) reputation review has had time to take effect. Mark as the sprint's primary blocked-until-cert scenario; document the interim SAC workaround (R1.4) as the fallback path if reputation is still pending at ship time.

### Scenario: Signed uninstaller and `.tmp` setup loader verified via signtool
```
Given a built Ritemark-Setup.exe produced with SignTool= and SignedUninstaller=yes wired in ritemark.iss
When the installer is run and immediately cancelled after Windows extracts the payload
Then the extracted *.tmp loader in the Windows temp directory shows a valid Authenticode signature
  (verify: signtool verify /pa <path-to-tmp-file>)
When the app is installed and then uninstalled
Then unins000.exe in the install directory also shows a valid Authenticode signature
  (verify: signtool verify /pa <install-dir>\unins000.exe)
```

### Scenario: Bundled agent binaries carry our signature
```
Given a signed Ritemark.exe build with binaries/agents/win32-x64/{codex-app-server.exe,claude.exe,opencode.exe}
When each binary is checked with signtool verify /pa <binary>
Then all three report a valid signature under the Trusted Signing certificate
  (mirrors the macOS codesign-app.sh step 5c-agents Team ID check, Windows analog)
```

### Scenario: Main app exe is signed
```
Given a built VSCode-win32-x64/Ritemark.exe
When checked with signtool verify /pa Ritemark.exe
Then it reports a valid signature (not "is not signed")
```

---

## W2 — OneDrive/SharePoint error surfacing

### Scenario: OneDrive placeholder file shows an actionable error, not a generic one
```
Given a .md file synced via OneDrive Files-On-Demand that is a cloud-only placeholder (not hydrated locally)
When the user opens the file in Ritemark
Then the error message is NOT the generic "Unknown (FileSystemError)"
And the message suggests: right-click the file → "Always keep on this device"
And the real OS error code (e.g. ERROR_CLOUD_FILE_NOT_IN_SYNC) is logged to the extension output channel
```
Status: this is the sprint's "intentionally untested if no fixture" scenario — see spec.md R2.4. If a real OneDrive placeholder cannot be reliably reproduced in dev, mark this scenario intentionally untested at Phase 4 (per `feedback_intentionally_untested.md`) rather than fabricating a fixture, and verify only that the code path (diagnostic + message) compiles and fires on a simulated `FileSystemError` with a synthetic cloud-error code.

### Scenario: Normal local file open is unaffected
```
Given a normal local .md file (not cloud-synced)
When the user opens it in Ritemark
Then it opens exactly as before — no new error paths triggered, no regression
```

---

## W3 — New File / New Folder buttons

### Scenario: New File / New Folder render inline on Windows (headline)
```
Given Ritemark is running on Windows
And the File Browser (Explorer) view is open with a folder loaded
When the user looks at the File Browser title-bar action icons
Then a "New File" icon and a "New Folder" icon are visible inline (not hidden inside the "..." overflow)
When the user clicks "New File"
Then a new untitled file is created in the current root and enters rename/edit mode
When the user clicks "New Folder"
Then a new folder is created in the current root and enters rename/edit mode
```

### Scenario: macOS unchanged — no duplication (no-regression)
```
Given Ritemark is running on macOS (where the buttons already render correctly)
When the user looks at the File Browser title bar after the fix
Then exactly one "New File" and one "New Folder" icon are visible (the fix must not duplicate the already-registered actions)
And both still function as before
```

### Scenario: Existing right-click New File/Folder still works (no regression)
```
Given the File Browser view with a folder loaded
When the user right-clicks a folder and selects "New File..." / "New Folder..." from the context menu
Then it behaves exactly as before (this path was never touched — the fix only affects Windows title-bar overflow)
```

---

## W4 — CI de-risk

### Scenario: workflow_dispatch triggers a Windows build without a tag push
```
Given the updated build-windows.yml (push: tags: v* removed, workflow_dispatch retained)
When a maintainer runs: gh workflow run "Build Windows (x64)" --ref main
Then the workflow starts and runs to completion (or fails on its own merits) WITHOUT any git tag having been pushed
```

### Scenario: Pushing a version tag no longer auto-triggers the Windows/macOS-x64 builds
```
Given the updated workflows
When a maintainer pushes a tag (e.g. git push origin v1.8.2)
Then build-windows.yml and build-macos-x64.yml do NOT start automatically
And the release proceeds via explicit gh workflow run invocations per the release skill
```

### Scenario: Weekly canary catches a broken runner image
```
Given windows-canary.yml scheduled weekly on windows-latest
When GitHub upgrades the windows-latest runner image in a way that breaks native module builds (e.g. a new VS/toolchain major version, analogous to the VS2026 incident)
Then the next scheduled canary run fails with a clear error (e.g. "Could not find any Visual Studio installation")
And this failure is visible in Actions BEFORE any release attempt touches build-windows.yml
```

### Scenario: Canary run does not require the repo-visibility toggle or windows-8core
```
Given windows-canary.yml
When it runs (scheduled or workflow_dispatch)
Then it runs on windows-latest (free public runner)
And it does NOT require the repo to be toggled private
And it does NOT touch build-windows.yml's windows-8core job
```

### Scenario: Manual canary trigger for validating a fix ahead of the weekly schedule
```
Given a suspected runner-image regression
When a maintainer runs: gh workflow run "Windows Canary" --ref main
Then the canary runs on demand without waiting for the weekly schedule
```

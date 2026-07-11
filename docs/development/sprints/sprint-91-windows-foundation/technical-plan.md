# Sprint 91: Windows Foundation — Technical Plan

Architecture, file-level changes, and verified current-state findings for each workstream. Requirement IDs reference `spec.md`.

---

## W1 — Windows code-signing

### Current state (verified in-repo)

- `installer/windows/ritemark.iss` has NO `SignTool=` directive and NO `SignedUninstaller` setting today. `#define AppVersion "1.7.2"` (stale — needs bump to `1.8.2`, R1.3).
- `.github/workflows/build-windows.yml` has NO signing step of any kind today — it builds, copies the extension, strips copilot, validates, and uploads the raw artifact. Signing currently happens nowhere in the Windows pipeline (confirmed: full end-to-end read of the workflow file).
- `scripts/validate-build-output.sh win32-x64` has no signature-verification check today (Section 9 "Windows Compatibility" only checks ripgrep binary presence, not signing).
- macOS analog (`scripts/codesign-app.sh` step `5c-agents`) name-agnostically `find`s every file under `binaries/agents/` with executable permission and re-signs Mach-O files with our Developer ID, overriding vendor/adhoc signatures. This is the pattern to mirror for Windows — but Windows binaries are already unsigned-by-default from their vendors' own release process in most cases (verify per-binary at implementation time; some upstream releases may ship Authenticode-signed exes that would need `/f` force-replace semantics analogous to `--force`).

### Design

**A. New script: `scripts/codesign-windows.sh` (or `.ps1` if signtool invocation is cleaner from PowerShell — decide at implementation time; prefer bash for CI consistency with the existing Windows workflow's bash-shell steps).**

Responsibilities:
1. Accept a target directory (`VSCode-win32-x64/`) as input.
2. Locate and `signtool sign` (via the Trusted Signing dlib metadata JSON):
   - `VSCode-win32-x64/Ritemark.exe`
   - `VSCode-win32-x64/resources/app/extensions/ritemark/binaries/agents/win32-x64/codex-app-server.exe`
   - `.../binaries/agents/win32-x64/claude.exe`
   - `.../binaries/agents/win32-x64/opencode.exe`
3. Batch these into a single `signtool sign /fd SHA256 /tr <timestamp-url> /td SHA256 <file1> <file2> ... <fileN>` invocation where the tool supports multi-file args (reduces the 5-8s/file cost's wall-clock impact vs N separate invocations — R1.2a).
4. Verify each with `signtool verify /pa <file>` after signing; fail loudly (non-zero exit) if any verification fails.

This runs BEFORE the Inno Setup packaging step (`ISCC.exe`), since Inno's own `SignTool=` directive only covers the installer/uninstaller/loader it produces — it does not reach into `{app}\*` payload files.

**B. `installer/windows/ritemark.iss` changes:**
```ini
#define AppVersion "1.8.2"   ; was 1.7.2 — bump per release

[Setup]
...
SignTool=trustedsigning
SignedUninstaller=yes
```
The `SignTool=trustedsigning` name references a tool registered via Inno Setup's "Configure Sign Tools" dialog (GUI) or, for CI/headless use, the `/S<name>=<command>` ISCC command-line switch, e.g.:
```
ISCC.exe /Ssigntool="signtool.exe sign /fd SHA256 /tr <ts-url> /td SHA256 /dlib <trusted-signing-dlib-path> /d $qRitemark$q $f" ...
```
(exact `/dlib` metadata JSON path is an Open Question below — depends on final Trusted Signing account setup).

**C. `.github/workflows/build-windows.yml` changes:**
- Add a new step "Sign bundled binaries" AFTER "Copy extension to build output" and BEFORE "Strip bundled copilot extension" (order doesn't matter relative to copilot-strip, but must be after the extension + agent binaries are in final place, and before installer packaging — though installer packaging is a SEPARATE workflow/script per the `windows-installer` skill, run on a Windows machine locally or via a follow-up CI job. Verify at implementation time whether `.iss` packaging happens IN this workflow or in a separate manual/CI step — currently `.github/workflows/build-windows.yml` does NOT invoke ISCC at all; that step lives in `scripts/create-windows-installer.sh` / manual local builds per the `windows-installer` skill. So CI-side signing here covers `Ritemark.exe` + bundled agents only; the installer/uninstaller/`.tmp` loader signing happens at ISCC build time via the `.iss` `SignTool=` directive, wherever that build runs).**
- Add `Azure/artifact-signing-action` step using service-principal secrets (names TBD — see Open Questions), OR call the new `scripts/codesign-windows.sh` if it wraps `signtool.exe` directly with secrets passed as env vars.
- Add a validation step (or extend `scripts/validate-build-output.sh win32-x64`) that calls `signtool verify /pa` on `Ritemark.exe` and each bundled agent binary, failing the build if unsigned.

**D. `scripts/validate-build-output.sh` — extend Section 9 (Windows Compatibility)** with a signing check, gated so it only runs when a cert/signing step actually ran (don't fail unrelated non-Windows validation paths, and don't fail if signing is intentionally skipped pre-cert during the interim W1-blocked period — use an env flag like `RITEMARK_SKIP_SIGNING_CHECK=1` for the pre-cert interim, matching the "single source of truth: scripts > inline" rule from the CI-audit feedback).

### R1.4 — Reputation review + workaround doc

- Reputation submission is a Microsoft-side manual process (Windows Defender Application Control / SAC reputation submission — exact portal/steps TBD, likely via the Microsoft Partner Center or a dedicated SAC submission form; this needs confirmation once the cert exists and a signed build is in hand — flagged as Open Question).
- New doc: `docs/user/windows-smart-app-control.md` (or similar) — the interim SAC workaround (e.g., "Windows protected your PC" → "More info" → "Run anyway", or admin group policy for managed machines). Linked from release notes and possibly a first-run tip for Windows users if SAC is detected blocking (out of scope to build detection UI this sprint — doc only).

---

## W2 — OneDrive/SharePoint error surfacing

### Current state (verified in-repo)

- `extensions/ritemark/src/ritemarkEditor.ts` `resolveCustomTextEditor` (line 487) receives an already-resolved `vscode.TextDocument` — VS Code core has ALREADY read the file successfully by the time this method runs. This confirms the release-plan's root-cause framing: the failure happens in VS Code core's document-resolution path, BEFORE Ritemark's custom editor is ever invoked. There is currently no Ritemark-owned try/catch around the failing read, because Ritemark never sees it — the error surfaces from VS Code's own generic editor-open error UI ("Unknown (FileSystemError)").
- This means the fix point is NOT inside `ritemarkEditor.ts`'s existing methods, but in how/whether Ritemark's `CustomEditorProvider` registration can intercept or wrap the failure. Two candidate mechanisms to investigate at implementation time:
  1. `vscode.workspace.onDidFailToOpenTextDocument`-equivalent — verify if such an event exists in this VS Code API version (may not).
  2. A pre-check: before VS Code even attempts to resolve the document, Ritemark could register a lightweight file-existence/accessibility probe (e.g., `vscode.workspace.fs.stat()`) triggered from a custom `workbench.editorAssociations`-driven hook or a `FileSystemProvider`-level wrapper — but Ritemark does not currently implement its own `FileSystemProvider` (it relies on the default local `file://` provider), so this may not be feasible without a much larger change.
  3. **Most likely feasible path:** VS Code's own generic "could not open" error notification is what needs enriching — this may require a small patch (new patch file or an addition to an existing one) in `vscode/src/vs/workbench/services/textfile` or wherever `FileSystemError` is surfaced to the generic editor-open failure UI, translating Windows `ERROR_CLOUD_FILE_*` codes (surfaced via the underlying `NodeJS.ErrnoException` / raw Win32 error) into a friendlier message specifically for `.md` files opened via Ritemark's association.
- **This needs a research spike as the FIRST task in W2** (see tasks.md) — the brief describes the desired UX outcome, but the exact interception point is genuinely unverified and may turn out to require a VS Code patch rather than pure extension code. Flag this uncertainty explicitly; do not assume it's purely extension-side until the spike confirms.

### Design (pending spike outcome)

- If interception is possible at the extension level: add a check in `RitemarkEditorProvider` (or a new lightweight wrapper registered alongside it) that, on `CustomTextEditorProvider` resolution failure, inspects the error for Windows `ERROR_CLOUD_FILE_*` codes (`error.code` or `errno`) and posts a friendlier message + logs the raw code to the extension's output channel (`vscode.window.createOutputChannel('Ritemark')` — verify existing channel name/pattern in-repo before adding a new one).
- If interception requires a VS Code core patch: scope the smallest possible patch (ideally an addition to patch 007 `ritemark-vscode-1117-compat.patch` if it's a small API-surface tweak, or a new patch `011-ritemark-cloud-file-errors.patch` if it's a distinct concern) that wraps the generic error path with a check for `.md`/markdown-associated files and cloud error codes.

---

## W3 — New File / New Folder buttons

### Current state (verified in-repo 2026-07-08 — corrects the earlier research pass)

- New File / New Folder ARE already registered on the Explorer title bar: `vscode/src/vs/workbench/contrib/files/browser/views/explorerView.ts` lines ~1022–1058 register both `NEW_FILE_COMMAND_ID` and `NEW_FOLDER_COMMAND_ID` on `MenuId.ViewTitle`, `group: 'navigation'`, `order: 10`/`20`, `when: ContextKeyExpr.equals('view', VIEW_ID)`, with `icon: Codicon.newFile`/`Codicon.newFolder`. (The earlier pass only checked `fileActions.contribution.ts`, which has the context-menu + palette entries, and wrongly concluded no `ViewTitle` registration exists.)
- Neither patch 002 nor 003 touches these entries (verified: grep of both patches for `newFile`/`newFolder` is empty; patch 002 only removes Refresh/Collapse and reworks title-action toolbar CSS).
- **Jarmo confirms the buttons render correctly inline on macOS.** Issue #131 is a Windows report where they collapse into the `...` "More Actions" overflow. So the commands, icons, and registration are all correct and cross-platform — the delta is Windows-only *rendering/overflow* of an already-registered `navigation`-group action.

### Design — spike first (root cause not yet pinned)

This is NOT a "register the command" change (it's already registered; re-registering would double the buttons on macOS). The real question is why the Windows title toolbar overflows the two `navigation` actions into `...` while macOS shows them inline. **W3-1 is a mandatory spike** to determine which of these it is, on a Windows build/artifact:

1. **Usable title-toolbar width** — Windows scrollbar width / DPI scaling leaves less room, tripping the toolbar's overflow threshold. Likely fix: ensure the explorer view-pane title toolbar reserves enough width, or pin the `navigation` group as primary/non-overflowing.
2. **Toolbar overflow config** — the view-pane title `MenuWorkbenchToolBar` / `HiddenItemStrategy` collapses secondary items; confirm New File/Folder are `navigation` (primary) and not being demoted.
3. **Patch 002 interaction** — patch 002 heavily reworks `.title-actions` / composite-bar toolbar CSS (grep shows `.title-actions .monaco-action-bar .action-item`, `HiddenItemStrategy`, `MenuWorkbenchToolBar` imports). A width/padding change there could push Windows over the overflow threshold while macOS stays under. This is the leading hypothesis given the buttons are stock and only Windows regresses.

The fix lands wherever the spike points — most likely a patch 002 CSS/toolbar-config adjustment, NOT a new command registration. Keep it minimal and platform-neutral (fix the overflow/width, don't add a `win32` conditional) so macOS is unaffected.

### Platform scope (R3.3)

Windows-only. macOS confirmed working (Jarmo) — the change must not alter macOS behavior or duplicate the buttons there. QA checks Windows shows them inline post-fix and macOS is unchanged.

---

## W4 — CI de-risk

### Current state (verified in-repo)

- `build-windows.yml` ALREADY has both `workflow_dispatch:` and `push: tags: v*` (lines 3-7). Same for `build-macos-x64.yml` (lines 4-7, with a `# Manual trigger (backup)` comment showing `workflow_dispatch` was already added as a secondary path).
- So R4.1 is "remove the automatic tag trigger", not "add workflow_dispatch" (already present). This is a small, low-risk diff: delete the `push: tags: - 'v*'` block from both files.
- No existing weekly canary workflow exists (`.github/workflows/` currently has `build-windows.yml`, `build-macos-x64.yml`, and others — no canary present. Confirm the full list at implementation time with `ls .github/workflows/`).

### Design

**A. `build-windows.yml` / `build-macos-x64.yml` trigger change:**
```yaml
on:
  workflow_dispatch:
    inputs:
      ref:
        description: 'Git ref (branch/tag/commit) to build'
        required: false
        type: string
```
Remove the `push: tags: - 'v*'` block entirely. If a `ref` input is added, the `Checkout` step needs `with: ref: ${{ inputs.ref || github.ref }}` — decide at implementation time whether this input is worth adding vs. relying on `--ref` at invocation time (`gh workflow run ... --ref v1.8.2`), which already works without any input parameter since `workflow_dispatch` runs against whatever ref is specified at trigger time. **Recommend: no new input needed** — `gh workflow run "Build Windows (x64)" --ref v1.8.2` already checks out that ref implicitly via the standard `actions/checkout@v4` default (`ref: github.ref`), which resolves correctly when the workflow is dispatched against a specific ref. Simpler diff, same outcome.

**B. New `.github/workflows/windows-canary.yml`:**
```yaml
name: Windows Canary (dependency install)
on:
  schedule:
    - cron: '0 6 * * 1'   # weekly, Monday 06:00 UTC
  workflow_dispatch:
jobs:
  canary:
    runs-on: windows-latest   # free public runner, NOT windows-8core
    timeout-minutes: 30
    steps:
      - Configure Git for Windows (mirror build-windows.yml)
      - Checkout RiteMark
      - Setup Node.js 22.22.1
      - Setup Python 3.11
      - Clone VS Code OSS (shallow, same VSCODE_VERSION)
      - Patch bundled node-gyp for VS2026 detection (COPY this step verbatim from build-windows.yml — single source of truth risk: if this step changes in build-windows.yml, the canary must be updated too; note this coupling explicitly in a comment)
      - Install VS Code dependencies (npm ci in vscode/, same env vars: NODE_GYP_FORCE_PYTHON, vs2022_install)
      # STOP HERE — do not run gulp / full build. This is enough to catch runner-image breakage.
```
Per the CI-audit hard rule, this step's logic is copy-duplicated from `build-windows.yml` intentionally (a canary that calls into the release workflow would defeat the "isolated, cheap, no release-path coupling" goal) — but flag the duplication risk explicitly in both files' comments so a future node-gyp-patch fix updates both.

**C. Verify R4.3 (no regression):** diff the canary's copied steps against `build-windows.yml` line-for-line after writing, to confirm no drift was introduced during the copy.

---

## Cross-cutting: scripts touched summary

| File | Workstream | Change type |
|---|---|---|
| `installer/windows/ritemark.iss` | W1 | Edit (SignTool, SignedUninstaller, AppVersion bump) |
| `scripts/codesign-windows.sh` (new) | W1 | New file |
| `.github/workflows/build-windows.yml` | W1, W4 | Edit (add signing step; remove tag trigger) |
| `scripts/validate-build-output.sh` | W1 | Edit (extend Section 9) |
| `docs/user/windows-smart-app-control.md` (new) | W1 | New file |
| `patches/vscode/002-ritemark-ui-layout.patch` | W3 | Edit (new hunk) |
| `extensions/ritemark/src/ritemarkEditor.ts` and/or a new/existing VS Code patch | W2 | Edit (pending spike outcome) |
| `.github/workflows/build-macos-x64.yml` | W4 | Edit (remove tag trigger) |
| `.github/workflows/windows-canary.yml` (new) | W4 | New file |

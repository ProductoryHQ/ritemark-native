# Sprint 91: Windows Foundation — Spec

Parent release: [`docs/development/releases/v1.8.2/release-plan.md`](../../releases/v1.8.2/release-plan.md)
Track: SDD (four workstreams, edge-case-heavy signing/installer domain, multi-component CI flow — see sprint-plan.md for track-decision rationale)

This is the behaviour contract. Requirements are grouped by workstream (W1-W4) and numbered `R<workstream>.<n>` so tasks.md and scenarios.md can reference them unambiguously.

---

## W1 — #130 Windows code-signing

**R1.1 — Sign every executable artifact in the installer output.**
The build MUST code-sign, with our Azure Trusted Signing RSA certificate:
- The Inno Setup installer (`Ritemark-Setup.exe`)
- The Inno Setup uninstaller (`unins000.exe`, generated at install time — signed via Inno's `SignedUninstaller` mechanism, not a separate manual step)
- The Inno Setup extracted `.tmp` setup loader (the payload Windows actually launches mid-install — signed via Inno's `SignTool=` directive, which covers both the outer installer and this inner loader)
- The main app executable (`Ritemark.exe`)
- Every bundled PE binary under `extensions/ritemark/binaries/agents/win32-x64/` (`codex-app-server.exe`, `claude.exe`, `opencode.exe` — confirmed via `extensions/ritemark/binaries/agents/manifest.json`)

Explicitly OUT of scope for R1.1: `whisper-cli.exe` (voice dictation, #133, deferred).

**R1.2 — Signing tool wiring.**
- Local/manual builds: `signtool.exe` (Windows SDK) + the Trusted Signing dlib + a metadata JSON (account endpoint + cert profile name), invoked via Inno's `SignTool=` directive (registered through "Configure Sign Tools" in Inno Setup, or the CLI-equivalent `/S` switch) for the installer/uninstaller/loader, and a standalone `signtool sign` invocation for `Ritemark.exe` + bundled agent `.exe`s before they're fed to Inno.
- CI (`build-windows.yml`): use `Azure/artifact-signing-action` (formerly `trusted-signing-action`) with an Azure service principal. Required secrets: client ID, tenant ID, subscription ID (exact secret names TBD at implementation time — see Open Questions).
- **Batching constraint (R1.2a):** Trusted Signing signs ~5-8s per file with NO parallelism. The signing step must batch all target files (3 agent binaries + `Ritemark.exe` + installer + uninstaller) into as few `signtool`/action invocations as possible (the action supports a file-list/glob input) rather than one invocation per file, to keep CI time bounded.

**R1.3 — `ritemark.iss` changes.**
- Add `SignTool=` name + directive wiring signing tool + parameters at build time.
- Add `SignedUninstaller=yes`.
- Bump `#define AppVersion` from `"1.7.2"` (current, confirmed in-repo) to `"1.8.2"`.

**R1.4 — Reputation review (the non-signing half of "done").**
Signing alone does not clear Smart App Control (SAC) on a fresh build (cloud ML reputation gate, confirmed in release-level research). "#130 done" requires, IN ADDITION to R1.1-R1.3:
- Submitting the signed app to Microsoft for reputation review (manual, Jarmo or Claude-assisted — process TBD, see Open Questions).
- Documenting the interim SAC workaround for users who hit the block before reputation builds (e.g. "More info" → "Run anyway", or admin-approved install) in a user-facing doc.

**R1.5 — External cert dependency gate.**
R1.1-R1.3 (the wiring) can be built and code-reviewed without a live cert profile, but cannot be functionally validated (a real signed binary produced and tested against SAC) until Jarmo's Azure Trusted Signing account + identity validation completes. This is an external, non-code blocker — see sprint-plan.md Product Decisions and tasks.md task gating.

---

## W2 — #134 OneDrive/SharePoint read-failure error surfacing

**R2.1 — Distinguish cloud-placeholder failures from generic errors.**
When a `.md` file fails to open because VS Code core's file read fails (confirmed: the failure happens BEFORE `RitemarkEditorProvider.resolveCustomTextEditor` runs — Ritemark's editor provider is never invoked, so there is no Ritemark-owned try/catch around the failing read today), the user-visible error message must be actionable, not the current generic "Unknown (FileSystemError)".

**R2.2 — Diagnostic signal.**
Where the failure can be identified as an OS-level cloud-placeholder error (Windows `ERROR_CLOUD_FILE_*` family, e.g. `ERROR_CLOUD_FILE_NOT_IN_SYNC` / `ERROR_CLOUD_FILE_PROVIDER_NOT_RUNNING`), log the real OS error code (not just the VS Code `FileSystemError` wrapper) to the extension's output channel / console, to make future field diagnosis possible even if this sprint doesn't reproduce the exact placeholder state.

**R2.3 — Actionable user message.**
When the diagnostic in R2.2 fires, surface a message suggesting the fix: right-click the file in Explorer/OneDrive → "Always keep on this device" (or the SharePoint-sync equivalent), rather than a bare error dialog.

**R2.4 — Explicit non-goal.**
This is error surfacing + diagnostics ONLY. No deep VS Code core read-path fix is in scope — the underlying OneDrive Files-On-Demand hydration failure is a VS Code core behavior, not reproduced against a live cloud placeholder in this sprint. If the mechanism can't be verified against a real repro, mark the manual QA item "intentionally untested" per the project's existing pattern (see `feedback_intentionally_untested.md`) rather than fabricating a fixture.

---

## W3 — #131 File Browser New File/New Folder buttons

**Corrected root cause (Jarmo + in-repo verification, 2026-07-08 — read before implementing):** New File / New Folder ARE already registered on the Explorer title bar. `vscode/src/vs/workbench/contrib/files/browser/views/explorerView.ts` (lines ~1022–1058) registers both on `MenuId.ViewTitle`, `group: 'navigation'`, `when: view == VIEW_ID`, `order: 10`/`20`, with `Codicon.newFile`/`Codicon.newFolder`. (The earlier research pass looked only at `fileActions.contribution.ts` and missed this — that file only has the context-menu/palette entries.) **Jarmo confirms the buttons show correctly on macOS.** Issue #131 was filed against Windows, where the panel header shows only the `...` overflow. So this is **not** a missing registration and **not** a net-new addition — the actions exist and render inline on macOS but collapse into the `...` "More Actions" overflow on Windows. This is a **Windows-only title-toolbar overflow / rendering issue**, and the fix must NOT re-register the commands (they are already registered — doing so would duplicate them on macOS).

**R3.1 — Restore inline New File / New Folder on the Windows Explorer title bar.**
The `navigation`-group `ViewTitle` actions must render inline on Windows as they do on macOS, not collapse into the `...` overflow. The fix targets whatever makes the Windows title toolbar overflow these actions — candidates to determine in the R3-spike: reduced usable title-toolbar width on Windows (scrollbar width / DPI scaling), the toolbar's overflow threshold / `HiddenItemStrategy`, or an interaction with patch 002's title-action toolbar CSS. Fix minimally so Windows matches macOS.

**R3.2 — Do not duplicate on macOS.**
The change must be scoped so it does not add a second New File/New Folder on macOS (where they already show). A platform-neutral fix that only affects overflow/width is preferred over a `platform === 'win32'` conditional if achievable.

**R3.3 — Platform scope: Windows-only.**
macOS is confirmed working by Jarmo — no change needed there. Scope is Windows. QA verifies the buttons appear inline on Windows after the fix and remain unchanged on macOS.

---

## W4 — CI de-risk

**R4.1 — `workflow_dispatch`-first triggers.**
`.github/workflows/build-windows.yml` and `.github/workflows/build-macos-x64.yml` currently both already have `workflow_dispatch:` (confirmed in-repo) ALONGSIDE `push: tags: v*`. Both triggers currently coexist. This requirement is about removing the automatic `push: tags: v*` trigger so a tag push alone no longer fires these expensive builds — release procedure moves to explicit `gh workflow run ... --ref <ref-or-tag>` per the `release` skill's existing `workflow_dispatch`-preferred guidance. Input: `ref` (branch/tag/commit) — default to the current implicit behavior (checkout ref = triggering ref) if no explicit ref input is added.

**R4.2 — Weekly Windows canary (new workflow).**
A new `.github/workflows/windows-canary.yml` running on the FREE public `windows-latest` runner (NOT `windows-8core` — no repo-visibility toggle required, no cost gate). Scope: ONLY the dependency-install / native-module-build steps — i.e., enough of `build-windows.yml`'s early steps (clone VS Code, node-gyp VS2026 patch, `npm ci` for `vscode/`) to catch a runner-image break (like the VS2026 incident) early, WITHOUT running the full ~120-minute build. Triggers: `schedule:` (weekly cron) + `workflow_dispatch:` (manual test trigger).

**R4.3 — No regression to existing green CI.**
The v1.8.1 Windows CI fix (commit `8295cee`, 3-layer VS2026 fix) must remain intact — R4.1/R4.2 changes are additive/trigger-only, must not touch the node-gyp patch step, the `preinstall.ts` override step, or the copilot `ignore-scripts` step.

---

## Cross-workstream requirements

**R5.1 — No implementation before Jarmo approval.** Per repo HARD gate — no code edit until `sprint-plan.md` is approved and the sprint branch `sprint-91-windows-foundation` is created.

**R5.2 — Independent mergeability.** W2, W3, W4 must be gated and mergeable without W1's cert dependency landing first (per release-plan external-dependency note). W1's non-cert-dependent wiring (`.iss` edits, CI workflow signing step skeleton) can also land ahead of the cert, but its "done" state (R1.4, and functional validation of R1.1-R1.3) is blocked until the cert profile exists.

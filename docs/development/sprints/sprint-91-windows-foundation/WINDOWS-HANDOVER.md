# Windows Handover — Sprint 91 (v1.8.2 Windows Foundation)

**For:** a fresh Claude Code session running on a **Windows** machine, continuing sprint-91.
**From:** the macOS session, 2026-07-08, commit `6c029b2` (pushed to `origin/sprint-91-windows-foundation`).
**Read this whole file first.** Claude's file-based memory does NOT transfer between machines, so every fact you need is either in this note or in the sprint docs it points to — do not assume prior context.

---

## 0. First 5 minutes — get oriented

```bash
git fetch origin
git checkout sprint-91-windows-foundation
git log --oneline -1   # expect: 6c029b2 feat(sprint-91): Windows Foundation planning + CI de-risk
```

Then read, in order:
1. This file (the whole thing).
2. `docs/development/releases/v1.8.2/release-plan.md` — the release this sprint belongs to.
3. `docs/development/sprints/sprint-91-windows-foundation/` — the SDD: `spec.md`, `scenarios.md`, `technical-plan.md`, `tasks.md`, `sprint-plan.md`.
4. `docs/development/releases/v1.8.2/azure-trusted-signing-setup.md` — the code-signing cert setup (Jarmo's external task).

The sprint plan is **already approved by Jarmo** — you may write implementation code on this branch. You may NOT merge to `main` without Jarmo's release sign-off.

---

## 1. The mission (why v1.8.2 exists)

One release, one vision: **a Windows user can install Ritemark on a default Windows 11 machine and open their business files.** Four of the last open issues came from Windows; three live in the shell/installer/signing layer. v1.8.2 "Sturdy & Seamless Delivery (Windows-first)" fixes them. Four workstreams:

- **W1 — #130** Windows code-signing (Smart App Control blocks the unsigned installer).
- **W2 — #134** OneDrive/SharePoint files fail to open ("Unknown FileSystemError").
- **W3 — #131** File Browser New File / New Folder buttons missing on Windows.
- **W4 — CI de-risk** (`workflow_dispatch` triggers + a weekly free-runner canary).

---

## 2. State as of this handover (commit 6c029b2)

| WS | Status | Detail |
|---|---|---|
| **W4** | ✅ DONE (2 smoke-tests pending) | Tag auto-triggers removed from `build-windows.yml`/`build-macos-x64.yml`; new `.github/workflows/windows-canary.yml`; `release` skill updated. Pending: dispatch the canary + a Windows build once to confirm (needs the pushed branch — now available). |
| **W1** | 🏗️ Architecture + safe scaffolding done; rest **cert/Windows-gated** | `installer/windows/ritemark.iss` has a `#ifdef Sign`-guarded `SignTool=azuresign $f` + `SignedUninstaller=yes`, and `#ifndef AppVersion` default `1.8.2`. **Key decision:** the signed installer must be built on **Windows** (the current Docker/Inno-on-macOS path has no `signtool.exe`). Remaining signing steps are blocked on the Azure cert (see §5). |
| **W2** | 🔎 Spike done → **needs a VS Code core patch** | `ritemarkEditor.resolveCustomTextEditor(document, …)` receives an **already-resolved** `TextDocument`; VS Code core reads the file and fails BEFORE the provider runs, so the extension can't intercept it. Fix must be a core patch. **Blocked on a Windows repro to capture the real OS error code** (see Task B below). |
| **W3** | 🔎 Spike partial → **needs a Windows repro to pin the cause** | Buttons ARE registered (`vscode/src/vs/workbench/contrib/files/browser/views/explorerView.ts:1022-1058`, `MenuId.ViewTitle`, `navigation` group, icons). macOS shows them (Jarmo confirmed). Windows collapses them into the `...` overflow. The "patch 002 CSS shrinks the title width" hypothesis was **ruled out** (patch 002's CSS targets the activity bar + AI sidebar, not the explorer title). **Cause unknown from static analysis — you must inspect a live Windows build (see Task A).** |

Full per-task detail (with `[BLOCKED-ON-CERT]` / `[PENDING PUSH]` markers) is in `sprint-91-windows-foundation/tasks.md`.

---

## 3. YOUR job on Windows — two investigations that unblock the blind-written code

These are the reason we need a Windows machine. Both can be done on **any existing Windows Ritemark install** (a shipped v1.8.x, or a fresh CI build — see §4). Neither needs the cert.

### Task A — #131: why do New File / New Folder overflow into `...` on Windows?

Facts: the two actions are registered on the explorer title (`explorerView.ts:1022-1058`) and render inline on macOS; on Windows they collapse into the `...` "More Actions" overflow.

Do:
1. Open Ritemark on Windows, open a folder so the **File Browser** (Explorer) view shows.
2. **Widen the File Browser panel** as far as it goes — do New File / New Folder icons appear inline when it's wide? Narrow it — do they disappear into `...`? (This tests the available-width / overflow-threshold theory.)
3. Open **Help → Toggle Developer Tools** → Elements. Inspect the File Browser title bar's action toolbar (`.pane-header .actions-container` / the `monaco-action-bar` in the view title). Note: how many action items are present, which are in the visible bar vs the `...` overflow menu, and the computed width of the toolbar container vs the title.
4. Compare scrollbar width / device pixel ratio if relevant.

Write the finding (the actual cause + file/line or a measurement) into `tasks.md` **W3-1**, then implement the minimal, **platform-neutral** fix (do NOT re-register the commands — that duplicates them on macOS). Likely a small CSS/toolbar-config tweak in `patches/vscode/002-ritemark-ui-layout.patch` (layout-owning patch; read `.claude/skills/vscode-development/references/layout-invariants.md` first). Verify inline on Windows + unchanged (no duplication) on macOS.

### Task B — #134: capture the real OneDrive read-failure error code

Facts: opening a `.md` in a OneDrive/SharePoint "Files On-Demand" placeholder that isn't hydrated fails with a generic "Unknown (FileSystemError)"; the fix is a core patch that maps the real Windows cloud-file error to an actionable message.

Do:
1. In a OneDrive/SharePoint-synced folder, set a `.md` file to **"Free up space"** (cloud icon, online-only). Open it in Ritemark before it re-hydrates.
2. Help → Toggle Developer Tools → Console. Capture the **real OS error code / HRESULT** behind the generic error — look for `ERROR_CLOUD_FILE_*` (~362–395) or a reparse-point code. Also capture the exact code path (the log line `Cse.restoreReadError` points to `vscode/src/vs/workbench/contrib/files/browser/editors/textFileEditor.ts`).
3. Confirm the fix target: map the cloud-file OS error to an actionable `FileSystemError` in `vscode/src/vs/platform/files/node/diskFileSystemProvider.ts` (the errno/HRESULT mapping), and/or improve the message at `textFileEditor.ts`'s `restoreReadError`.

Write the captured code + chosen target into `tasks.md` **W2**, then implement it as a new patch (or an extension of `patches/vscode/007-ritemark-vscode-1117-compat.patch`). Message text example: *"This file is stored in OneDrive and isn't downloaded yet. In File Explorer, right-click it → Always keep on this device, then reopen."*

---

## 4. Building / testing a Windows Ritemark

**Fastest for Tasks A & B:** use an **already-installed** Windows Ritemark — the bugs exist in shipped builds, no rebuild needed.

**To test YOUR sprint-91 changes** (W2 patch, W3 fix, later the signed installer), build from the branch:

- **CI build (recommended):** the repo is **private**, so `windows-8core` CI works with no visibility toggle.
  ```bash
  gh workflow run build-windows.yml --ref sprint-91-windows-foundation
  gh run list --workflow=build-windows.yml --limit 3       # wait ~2h
  gh run download <run-id> -R ProductoryHQ/ritemark-native -n ritemark-windows-x64 -D VSCode-win32-x64
  ```
  Then build the installer with the **`windows-installer` skill** (`.claude/skills/windows-installer/SKILL.md`) — native Windows ISCC (`ISCC.exe`), NOT the Docker path. Prerequisites in that skill: Inno Setup 6.x, `rcedit`, `gh`, Node.
- **Local dev build on Windows:** heavier; the `windows-installer` skill is the documented path.

Note: `build-windows.yml` is now `workflow_dispatch`-only (no tag trigger) — dispatching on the branch is expected.

---

## 5. W1 signing — blocked on the Azure cert (external, ~1–20 business days)

Status (2026-07-08): Azure **Trusted Signing** (a.k.a. Artifact Signing) — org validation for **Productory Services OÜ** (Estonia, Public Trust) is **In Progress** in Microsoft's queue; individual identity verification is **done**. Productory (7 yrs) clears the eligibility gate. Setup guide: `docs/development/releases/v1.8.2/azure-trusted-signing-setup.md`.

When it completes, Jarmo creates the certificate profile (Public Trust) + a service principal. You'll then need these to wire signing:
- **Endpoint URI:** `https://neu.codesigning.azure.net` (North Europe region)
- **Account name** + **certificate profile name**
- **Service principal:** client ID / tenant ID / subscription ID (+ secret → GitHub Secrets, never committed)

Then implement (all on the **Windows** side — the signed installer can't be built via Docker/Mac):
- Sign inner PE files (`Ritemark.exe` + `resources/app/extensions/ritemark/binaries/agents/win32-x64/{claude.exe,codex-app-server.exe}` + DLLs) — this mirrors the macOS `codesign-app.sh` step `5c-agents` that re-signs bundled binaries.
- Build the installer with `ISCC /DSign /Sazuresign="<signtool cmd> $f"` so Inno signs Setup.exe + the extracted `.tmp` loader + the uninstaller (the exact pieces SAC rejects).
- Verify each with `signtool verify /pa`, then test on a **clean Windows 11 with Smart App Control ENABLED**.

**SAC reality (important — don't over-promise):** signing removes the "unsigned / can't confirm publisher" block, but Smart App Control also gates on Microsoft **cloud reputation** — a brand-new signed build may still be held. So "#130 done" = sign everything **+ submit the app to Microsoft for reputation review + document the interim workaround** (`docs/user/windows-smart-app-control.md`, still to be written — W1-6). EV certs are NOT a shortcut (they lost auto-reputation in 2024); Trusted Signing is Microsoft's preferred SAC path.

---

## 6. Rules & gotchas that don't transfer via memory (read before editing)

- **Sprint branch only.** All work stays on `sprint-91-windows-foundation`. Never edit code on `main`.
- **Approval gate:** the plan is approved, so implementation is unlocked — but production/release still needs Jarmo's Gate sign-off. Don't publish anything.
- **NEVER stub, remove, or disable existing features** (this broke Settings in v1.3.0). All features ON by default; disable only via feature flags when Jarmo says so.
- **Do NOT commit the pre-existing unrelated working-tree changes** if they reappear: `.claude/agents/harness-equalizer.md`, `docs/development/architecture.md`, `docs/development/sprints/sprint-89-*/sprint-plan.md`, `docs/development/sprints/sprint-90-*/sprint-plan.md`, `docs/releases/v1.8.1/TEST-CHECKLIST.md`, `docs/releases/v1.8.1/fixtures/`. They are NOT sprint-91 work — the macOS session deliberately left them unstaged.
- **VS Code patches:** customizations go through `patches/vscode/*.patch`, NEVER direct `vscode/` submodule edits. Use `./scripts/apply-patches.sh` / `./scripts/create-patch.sh`; read `.claude/skills/vscode-development/PATCH-RULES.md` (watch the unused-imports gotcha).
- **CI history (in case Windows CI breaks):** the `windows-8core` runner moved to Visual Studio 2026 (VC++ major 18) in 2026-07, which broke node-gyp VS detection, VS Code's `preinstall.ts`, and a nested copilot node-gyp. All three are fixed in `build-windows.yml` (green on `8295cee`). The new `windows-canary.yml` is the early-warning for the next such bump. If a native-module build fails with "Could not find any Visual Studio installation", re-scan `vscode/**/package-lock.json` for local node-gyp copies.
- **Harness:** edit `.claude/**` only; the scheduled `harness-equalizer` syncs the Codex mirror (`.codex/**`, `AGENTS.md`) — never hand-edit those.
- **Codex/expert routing:** the repo has expert agents (`vscode-expert`, `webview-expert`, etc.) — but for builds, do NOT delegate to `vscode-expert` (output-buffering hang); run them yourself.

---

## 7. Definition of "Windows session productive"

- [x] Task A: #131 root cause pinned on Windows → W3 fix written + verified inline (Windows) + no macOS duplication.
- [x] Task B: #134 real OS error code captured → W2 core patch written (verify against a real placeholder if reproducible; else mark intentionally-untested per `feedback_intentionally_untested`).
- [ ] (Optional now) dispatch `windows-canary.yml` once to confirm it's green.
- [x] (When cert lands) W1 signing wired + signed installer built + clean-Win11-SAC test.

Commit your work on the branch with clear messages (end each with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`); push to `origin/sprint-91-windows-foundation` so the macOS side stays in sync. Report findings back to Jarmo — he coordinates both machines.

---

## 8. MAC HANDOVER — from Windows session, 2026-07-11

**For:** a fresh Claude Code session on macOS, continuing sprint-91.
**From:** the Windows session, 2026-07-11, latest commit on `origin/sprint-91-windows-foundation`.

### What was done on Windows

| Task | Status | Detail |
|---|---|---|
| **W3 (#131)** | ✅ Done | Root cause: `ViewPaneShowActions.Default` hides buttons until hover. Fix: `showActions: ViewPaneShowActions.WhenExpanded` in `explorerViewlet.ts:187`. Patch 002 updated. Verified in dev mode. |
| **W2 (#134)** | ✅ Done | Live-reproduced OneDrive error (dehydrate + kill OneDrive → `{code:'UNKNOWN', errno:-4094, syscall:'read'}`). New patch `011-ritemark-cloud-file-error.patch` — detects UNKNOWN+read/open on Windows, shows actionable message. No regression on local files. |
| **W1 (#130)** | ✅ Done (except W1-11, W1-12) | Azure Trusted Signing cert live (Productory Services OÜ). CI signing via `azure/trusted-signing-action@v0.5.0` works. Icon patching moved to CI (before signing). Signed installer tested on clean Windows — **no errors, no SAC block**. |
| **W4** | ✅ Previously done | Canary dispatch still pending. |

### Remaining for macOS session

1. **W3-5** — Verify File Browser buttons on macOS (no duplication, still one New File + one New Folder).
2. **W3-6** — Verify right-click context menu still works.
3. **W1-11** — Submit signed app to Microsoft for SAC reputation review (use the final v1.8.2 release binary).
4. **W1-12** — Flip `RITEMARK_SKIP_SIGNING_CHECK=0` once signing is proven reliable across multiple CI builds.
5. **W4-6** — Dispatch `windows-canary.yml` once to confirm green.

### Key facts for macOS session

- **Patch 002** has 2 new hunks for `explorerViewlet.ts` (import + showActions). 30 files total (unchanged count).
- **Patch 011** is NEW — `diskFileSystemProvider.ts` cloud-file error detection. 1 file.
- **CI signing** is gated on repo variable `AZURE_SIGNING_ENABLED=true` (already set). Uses `azure/trusted-signing-action@v0.5.0`.
- **Icon patching** now happens in CI (`rcedit` step before signing) — do NOT patch icon locally after CI build (invalidates signature).
- **Installer signing** was done locally via PowerShell `Invoke-TrustedSigning` (TrustedSigning module + NuGet dlib). CI does not build the installer yet — that's a future improvement.
- **`.signing-env`** exists locally (gitignored) for local signing credentials.
- **`azure-signing-commands.md`** is a temp file, not committed — can be deleted.





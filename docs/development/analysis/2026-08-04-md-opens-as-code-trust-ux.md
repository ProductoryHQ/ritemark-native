# Analysis: .md from Finder/Explorer opens as raw code + trust-dialog noise

**Date:** 2026-08-04
**Reporter:** User complaint via Jarmo — double-clicking an .md in Windows Explorer / macOS Finder opens it as plain code instead of the Ritemark editor; suspicion was "a trusted folder must already be loaded".
**Status:** Root-caused with empirical reproduction on the installed production app (v1.8.5 shell). Solution strategies proposed for v1.8.6.

## Reproduction (production app, fresh profile)

Launched `/Applications/Ritemark.app` with a fresh `--user-data-dir` and a loose
`test-notes.md` as file argument — the exact state of a brand-new user
double-clicking a markdown file.

Observed, in order:

1. **First launch:** file opens in the **plain text editor** (raw markdown,
   line numbers). Status bar shows **Restricted Mode**. A modal appears:
   *"Do you trust the authors of the files in this workspace? — Creating a
   terminal process requires executing code."*
2. **Second launch (same profile):** same file **still opens as text** (the
   text-editor tab was restored). Same trust modal appears again.
3. **New .md opened into the same untrusted window:** opens in the **Ritemark
   WYSIWYG editor** — Restricted Mode does *not* block the custom editor.
4. **Closing the stuck text tab and reopening the same file:** opens in
   **Ritemark**. The "always opens as code" symptom is the restored tab, not
   re-resolution.
5. Declining the trust modal produces an error toast: *"The terminal process
   failed to launch: Cannot launch a terminal process in an untrusted
   workspace."*

## Root cause — one underlying defect, three visible mechanisms

### The underlying defect: `configurationDefaults` in product.json is dead on desktop

`branding/product.json` has carried (since Sprint 57, commit `9cc928e`):

```json
"security.workspace.trust.enabled": false,
"workbench.editorAssociations": { "*.md": "ritemark.editor", ... }
```

**VS Code OSS desktop never reads this key.** `configurationDefaults` is only
honored on the *web* workbench via embedder options
(`vscode/src/vs/workbench/services/configuration/browser/configuration.ts:48-50`
reads `environmentService.options?.configurationDefaults`; desktop's
environment service has no `options`). Nothing in
`IProductConfiguration` / the desktop startup path consumes it. Every entry in
that block is silently ignored. The theme/layout entries in the same block
*appear* to work only because `extension.ts activate()` independently writes
the same values into user settings (`extensions/ritemark/src/extension.ts:239-271`).

So both intended behaviors — trust disabled, and .md defaulting to
`ritemark.editor` — have never been in effect in any shipped build.

### Mechanism 1 — first launch: cold editor-resolver cache

`EditorResolverService` keeps a PROFILE-scoped cache of which glob patterns
have contributed editors (`editorOverrideService.cache`,
`vscode/src/vs/workbench/services/editor/browser/editorResolverService.ts:49,70`).
On the very first launch of a profile the cache is empty, so a file opened at
startup does not wait for extension registration and falls through to the
default text editor (`:128-130,154-158`). Upstream fix #244597 added an
escape hatch: if the resource matches a **user association**
(`workbench.editorAssociations`), resolution waits for extensions — but we
have no *effective* association (see the underlying defect), so the hatch
never engages for us.

### Mechanism 2 — persistence: the text tab sticks forever

The text-editor tab from mechanism 1 is persisted in window state and restored
on every subsequent launch; Finder/Explorer re-opens of the same file focus the
existing tab instead of re-resolving. The bug therefore looks permanent to the
user until the tab is manually closed. (Verified: closing the tab and reopening
the file yields the Ritemark editor, even in an untrusted window.)

### Mechanism 3 — trust noise: untrusted loose-file window + auto-created terminal

* A window launched with only a loose file takes its trust from **the startup
  files**, not from the `emptyWindow` default:
  `vscode/src/vs/workbench/services/workspaces/common/workspaceTrust.ts:310-324`
  (startup-files branch at `:317-320` runs *before* the
  `security.workspace.trust.emptyWindow` fallback). A random Documents file is
  never in the trusted list → the window starts in Restricted Mode.
* Our locked layout keeps the terminal view present
  (`patches/vscode/002-ritemark-ui-layout.patch`, `hideIfEmpty: false`), and a
  visible/focused empty terminal view auto-creates a terminal
  (`vscode/src/vs/workbench/contrib/terminal/browser/terminalView.ts:324-326`).
  In an untrusted window that shell launch triggers the workspace-trust modal
  on **every** launch; declining yields the error toast.

**Explicitly ruled out:** workspace trust does *not* block the custom editor.
`extensions/ritemark/package.json` declares
`capabilities.untrustedWorkspaces.supported: true` (shipped since v1.7.1) and
the WYSIWYG editor demonstrably works in Restricted Mode.

### Side finding — latent security gap in the daemon scheduler

The extension contains **no** `workspace.isTrusted` checks at all. The Sprint 80
daemon (`extensions/ritemark/src/daemon/Scheduler.ts:25,38,182`) scans the
**workspace's** `.claude/agents` and `.agents` directories and schedule-runs
agent definitions found there. Because the extension runs in untrusted
workspaces, opening a malicious downloaded folder can already auto-schedule
agents today; disabling workspace trust globally (the Sprint 57 intent) would
remove even the Restricted-Mode speed bump. Any strategy that neutralizes trust
must pair with a consent/gating mechanism for workspace-defined scheduled
agents.

## Solution strategies for v1.8.6

### S1 — Wire product.json `configurationDefaults` for real (core fix; shell-tier)

New small patch (013): in the workbench `DefaultConfiguration` construction
path, register `productService.configurationDefaults` via
`configurationRegistry.registerDefaultConfigurations(...)` — the exact
mechanism the web workbench already uses. This single wiring change activates:

* `workbench.editorAssociations` defaults → kills mechanisms 1+2 for md,
  markdown, csv, xlsx, pdf, docx, flow.json (rides the upstream #244597 hatch,
  works on the very first launch);
* `security.workspace.trust.enabled: false` → kills mechanism 3 entirely
  (**if** we confirm that posture — see S2);
* future product-level defaults become data-driven (no per-setting extension
  writes).

### S2 — Decide the trust posture (product decision, pairs with S1)

* **T-off (Sprint 57 intent):** keep `security.workspace.trust.enabled: false`.
  Consumer-app norm. **Must** ship together with daemon hardening: workspace
  `.claude/agents`/`.agents` scheduled agents need explicit consent (e.g.
  per-workspace opt-in, or load only user-level agent dirs by default), because
  `isTrusted` becomes permanently true.
* **T-tame (conservative):** keep trust enabled but (a) default
  `security.workspace.trust.untrustedFiles: "open"`, (b) patch the
  startup-files branch so a loose-file empty window follows the (trusted)
  `emptyWindow` rule, (c) skip terminal auto-create in untrusted windows.
  More patch surface; preserves Restricted Mode for folders. Note: settings
  alone do **not** fix the launch case — the startup-files branch precedes the
  `emptyWindow` setting, hence (b) is required.
* Either way, daemon trust/consent gating should be added — the gap exists
  today independent of the chosen posture.

### S3 — Heal existing victims (extension-tier)

One-shot migration on activation: enumerate `vscode.window.tabGroups`, find
file-scheme `.md`/`.markdown` tabs stuck as `TabInputText`, reopen via
`vscode.openWith` → `ritemark.editor`. Fixes every user who already has a
stuck text tab, without waiting for them to discover "close tab and reopen".

### Rejected alternatives

* Extension-contributed `configurationDefaults` — not yet registered at
  first-launch startup-file resolution; fails exactly the case that matters.
* Writing `workbench.editorAssociations` into user settings from `activate()` —
  fixes launch 2+, not launch 1; pollutes user settings; racy.
* Auto-trusting file parent folders — weakens the security model, nonstandard.

## Release implications

S1 (+T-off/T-tame patches) touch `patches/` and `branding/product.json` →
**shell-tier** → v1.8.6 becomes a full app release (Gate 1 + Gate 2,
notarization, Windows CI). The v1.8.6 release plan already lists the release
type as undecided with Home possibly needing a shell patch; this work weighs
the same direction. S3 is extension-tier and can ride the same release.

## QA scenarios (for the sprint plan)

1. Fresh profile + double-click .md from Finder → Ritemark editor, no trust
   dialog, no Restricted Mode (under T-off).
2. Second launch, same profile → same result; no sticky text tab.
3. Upgrade path: profile with an existing stuck text tab → healed to Ritemark.
4. Windows Explorer file association → same behavior as macOS.
5. Untrusted folder with `.agents` scheduled agent → agent does NOT auto-run
   without consent (daemon gating).
6. `Reopen With… → Text Editor` still available and functional.

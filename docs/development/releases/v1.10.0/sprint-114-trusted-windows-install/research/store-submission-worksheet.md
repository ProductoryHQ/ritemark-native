# Microsoft Store submission worksheet — Ritemark v1.10.0

**Prepared:** 2026-08-25  
**Submission owner:** Jarmo  
**Engineering owner:** v1.10.0 release manager  
**State:** Draft ready; binary, hosting, legal-URL, security, and certification gates remain open

This is the copy/paste worksheet for Partner Center's **EXE or MSI app** flow. Do not submit placeholder URLs or an installer that may later be replaced.

## Product identity

| Partner Center field | Value / decision |
|---|---|
| Product name | `Ritemark` — Jarmo must reserve and confirm availability |
| Publisher display name | `Productory Services OÜ` |
| App type | `EXE` |
| Package architecture | `x64` |
| Version | `1.10.0` |
| Minimum OS | Windows 10, x64-compatible; clean Windows 11 is the certification/SAC test baseline |
| Install context | Per-user / lowest privileges; no administrator account required for the normal path |
| Category proposal | Productivity — Jarmo confirms the closest current Partner Center category |
| Pricing | Jarmo decision; do not assume Free in the submission |
| Age rating | Complete the Partner Center questionnaire; do not infer a rating from repo metadata |

## Package fields

| Field | Final value |
|---|---|
| Package URL | `https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe` |
| Silent-install parameters | `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER` |
| Uninstall behavior | Inno uninstaller; standard-user silent uninstall and cleanup must pass in CI |
| Expected filename | `Ritemark-Setup.exe` |
| SHA-256 | **Pending final Windows workflow artifact** |
| Signature publisher | `Productory Services OÜ` |

The URL must be direct HTTPS, standalone/offline, versioned, and immutable after submission. A rebuilt binary uses a new candidate path such as `/windows/v1.10.0-candidate-2/Ritemark-Setup.exe`; never replace submitted bytes in place.

## Listing copy draft

### Short description

> A local-first Markdown editor with visual writing, AI agents, transcription, diagrams, tables, and export.

### Description

> Ritemark is a local-first Markdown editor for people who want a clean visual writing experience without giving up ordinary files. Write and format Markdown, work with tables and diagrams, transcribe audio, create reusable document insights, and export polished results. Integrated AI agents can help with your project while Ritemark keeps the document workflow visible and under your control. Files remain standard files on your computer; network-connected AI features depend on the provider you choose.

### What's new in 1.10.0

- Durable project-scoped agent conversations that survive restart.
- Honest native resume or bounded transcript-context restoration across supported runtimes.
- Refreshed bundled Claude, Codex, and OpenCode runtimes.
- Per-turn thinking-effort controls where the selected runtime/model supports them.
- Language-aware Transcribe Insights saved as separate Markdown documents.
- Reliable editor/disk synchronization: agent writes appear without reopening, ordinary autosave stays quiet, and real conflicts preserve both versions.

### Search terms proposal

`markdown`, `editor`, `writing`, `documents`, `notes`, `AI`, `transcription`, `local-first`, `diagrams`, `tables`

## Public URLs

| Purpose | URL | Audit status |
|---|---|---|
| Website | `https://ritemark.app/en/` | Ready |
| Support | `https://ritemark.app/en/support/` | Ready — returned HTTP 200 on 2026-08-25 |
| Privacy policy | Proposed canonical path: `https://ritemark.app/en/privacy/` | **Blocked — currently HTTP 404** |
| License terms | Proposed canonical path: `https://ritemark.app/en/terms/` | **Blocked — currently HTTP 404** |

The repository is MIT-licensed (`LICENSE`), but a development-repository link is not a good Store contract because the repo becomes private temporarily for Windows CI. Publish stable public Ritemark-specific privacy and license/terms pages first. The privacy text must describe local files, telemetry, transcription, and what selected AI-provider flows may send off-device; do not reuse stale legal copy without review.

## Store media inventory

| Asset | Current evidence | Action |
|---|---|---|
| Square app artwork | `branding/icons/Icon-1024.png` — 1024×1024 | Ready as source; export/validate the exact Partner Center slot |
| Screenshots | Seven v1.10.0 PNGs, each 2880×1800 | Quantity and resolution ready; prefer Windows-candidate captures or explicitly verify that macOS chrome/shortcuts do not misrepresent the Windows app |
| 1:1 box art | App icon is a viable source | Validate crop, safe area, and Partner Center preview |
| 2:3 poster art | No dedicated asset identified | Prepare only if Partner Center requests/recommends it for the chosen listing |

Existing screenshots:

1. `1-10-0-conversation-rail-full-screen.png`
2. `1-10-0-all-conversations-pinned.png`
3. `1-10-0-conversation-reopened.png`
4. `1-10-0-transcript-context-restored.png`
5. `1-10-0-thinking-effort.png`
6. `1-10-0-agent-switch-boundary.png`
7. `1-10-0-rename-conversation.png`

## Submission blockers and owners

| Gate | Owner | Current state |
|---|---|---|
| v1.10.0 dependency-security disposition | Engineering + Jarmo | Open — production npm advisories need an explicit ship/fix decision |
| Final signed Windows candidate | Engineering | Open — dispatch only after arm64 Gate 1 |
| `downloads.ritemark.app` DNS and HTTPS | Jarmo / web owner | **Blocked — hostname did not resolve on 2026-08-25** |
| Immutable installer upload | Engineering / web owner | Open — exact CI artifact and SHA pending |
| Privacy and license pages | Jarmo / legal / web owner | **Blocked — proposed Ritemark URLs return 404** |
| Product-name reservation and listing fields | Jarmo | Open |
| Windows-fidelity media review | Jarmo | Open |
| Partner Center preprocessing/certification | Jarmo | Open |
| Clean Windows 11 SAC-On test | Kristiina | Open |
| Exact SHA-256 Gate 2 approval | Jarmo | Open |

## Final submission sequence

1. Clear arm64 Gate 1; do not dispatch Windows merely to populate Partner Center.
2. Run the signed Windows workflow from the exact v1.10.0 release ref.
3. Download `ritemark-windows-installer`; verify signatures, standard-user install/uninstall, version, and SHA-256.
4. Publish the unchanged `Ritemark-Setup.exe` at the versioned HTTPS URL and verify a fresh download has the same SHA-256.
5. Complete legal URLs and listing/media review.
6. Submit the exact URL, parameters, publisher, architecture, and version to Partner Center.
7. Record preprocessing/certification evidence and Kristiina's SAC-On evidence against the same SHA-256.
8. Jarmo approves that hash for Gate 2; only then may the listing/direct-download claims be treated as shipped.

## Official references

- [EXE/MSI package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- [Create an EXE/MSI submission](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/create-app-submission)
- [Upload EXE/MSI packages](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages)
- [Manual package validation](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/manual-package-validation)
- [App certification process](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-certification-process)


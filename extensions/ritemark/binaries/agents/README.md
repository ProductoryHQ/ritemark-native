# Bundled Agent Runtimes

Sprint 64 ships Codex and Claude agent runtimes inside the Ritemark `.app` (macOS) and Windows installer so a clean install has working app-owned runtimes without requiring the user to install Node, npm, or set `PATH`.

## Layout

```text
extensions/ritemark/binaries/agents/
├── manifest.json          ← source of truth (tracked)
├── README.md              ← this file (tracked)
├── darwin-arm64/          ← payloads, gitignored
│   ├── codex-app-server
│   └── claude
├── darwin-x64/            ← payloads, gitignored
│   ├── codex-app-server
│   └── claude
└── win32-x64/             ← payloads, gitignored
    ├── codex-app-server.exe
    └── claude.exe
```

The platform subdirectories are populated by `scripts/fetch-agent-runtimes.sh` (Phase B). Binary payloads are listed in the root `.gitignore` and never committed.

## What is bundled

| Agent | Vendor | Version | Source | License |
|---|---|---|---|---|
| Codex | OpenAI | 0.144.4 (`rust-v0.144.4`) | GitHub Releases — `codex-app-server-*` archives | Apache-2.0 |
| Claude | Anthropic | 2.1.156 | npm optional packages — `@anthropic-ai/claude-code-<platform>-<arch>` | Proprietary (`LicenseRef-Anthropic-Proprietary`); redistribution permitted by product-owner decision — see "Claude redistribution paper trail" below |
| OpenCode | sst | 1.15.13 | npm optional packages — `opencode-<platform>-<arch>` | MIT |

Versions are pinned in `manifest.json`. Updates ship inside Ritemark releases (Sprint 64, Q4 decision). A separate runtime update channel is not in scope for this sprint.

### Claude redistribution paper trail

Anthropic publishes the `@anthropic-ai/claude-code-<platform>-<arch>` packages under a proprietary license (LICENSE.md inside each package: "© Anthropic PBC. All rights reserved."), with the public legal terms at the URL recorded in `manifest.json` under `license.noticeUrl`.

Redistribution of these binaries inside the Ritemark installer was approved by product-owner Jarmo Tuisk on **2026-05-06** during Sprint 64 Phase A planning. The decision is also reflected in `docs/development/sprints/sprint-64-bundled-agent-runtimes/sprint-plan.md` (Risks table) and follows the audit input in `docs/internal/analysis/2026-05-06-codex-startup-and-binary-audit.md`.

If Anthropic's published terms change, this README and the manifest must be re-validated before the next Ritemark release that ships bundled Claude binaries.

## Codex invocation contract

Codex 0.130.0 publishes a standalone `codex-app-server` binary that is **not** the same as the `codex` CLI. The `manifest.json` records this as `invocationMode: "direct-app-server"`, which means Ritemark spawns the extracted binary directly:

```text
<binaries>/agents/<platform>-<arch>/codex-app-server[.exe]
```

Ritemark must **not** invoke `codex app-server` as a subcommand; the `codex` CLI is not bundled.

If a future Codex release reorganises this (for example, merges the app-server back into the main `codex` binary as a subcommand), the manifest entry's `invocationMode` field flips to `cli-subcommand` and the extension code reads the manifest to pick the spawn strategy. The wrong value here will silently break runtime startup, so it is derived from inspecting the actual upstream artifact, not from documentation.

## Manifest schema (`manifest.json`)

Top-level:

| Field | Description |
|---|---|
| `schemaVersion` | Manifest schema version. Bump when the structure changes. |
| `generated` | ISO date the manifest entries were last verified. |
| `description` | Human-readable purpose. |
| `runtimes` | Array of runtime entries (one per agent × platform × arch). |

Each entry in `runtimes`:

| Field | Description |
|---|---|
| `agent` | `codex` or `claude`. |
| `vendor` | `openai` or `anthropic`. |
| `version` | Pinned upstream version. Never `latest`. |
| `platform` | `darwin` or `win32`. |
| `arch` | `arm64` or `x64`. |
| `sourceType` | `github-release` (Codex) or `npm-optional-package` (Claude). |
| `sourceUrl` | Direct download URL for the archive. |
| `npmPackage` | npm package name (only for `sourceType: npm-optional-package`). |
| `archiveFilename` | Filename the archive is saved as locally. |
| `archiveFormat` | `tar.gz` (current state for all entries; covers both Codex tarballs and npm tarballs). |
| `sha256` | SHA-256 of the downloaded archive. **Verified before extraction.** |
| `archivePath` | Path inside the archive to the runnable binary. |
| `installName` | What the binary is renamed to inside `binaries/agents/<platform>-<arch>/`. |
| `invocationMode` | Codex only. `direct-app-server` or `cli-subcommand`. |
| `validationArgs` | Args passed to the installed binary as a smoke test (e.g. `["--help"]`, `["--version"]`). |
| `expectedFileArchPattern` | Substring that must appear in `file <binary>` output to validate architecture. |
| `license.spdx` | SPDX identifier. Anthropic uses `LicenseRef-Anthropic-Proprietary` (non-standard SPDX). |
| `license.redistribution` | `permitted` (Apache-2.0) or `permitted-by-vendor-confirmation` (Anthropic). |
| `license.noticeUrl` | URL to the upstream license / legal terms. |

## Fetch workflow

Phase B will deliver `scripts/fetch-agent-runtimes.sh`. Until then, runtimes can be materialised manually for local testing by following the `sourceUrl` and `archivePath` fields in `manifest.json`. Sample one-shot for macOS arm64 Codex:

```bash
mkdir -p extensions/ritemark/binaries/agents/darwin-arm64
curl -L -o /tmp/codex.tar.gz \
  https://github.com/openai/codex/releases/download/rust-v0.130.0/codex-app-server-aarch64-apple-darwin.tar.gz
echo "f4ba64ca358497c932306d35b3fd321261603f402b12ea726e29c986e4100714  /tmp/codex.tar.gz" | shasum -a 256 -c
tar -xzf /tmp/codex.tar.gz -C /tmp
mv /tmp/codex-app-server-aarch64-apple-darwin \
  extensions/ritemark/binaries/agents/darwin-arm64/codex-app-server
chmod +x extensions/ritemark/binaries/agents/darwin-arm64/codex-app-server
```

The fetch script (Phase B) automates this for all six runtime entries and adds POSIX exec-bit / PE-header validation plus the manifest `validationArgs` smoke test.

## Update process

1. Bump the upstream `version` in `manifest.json`.
2. Re-fetch the new archives (locally or in CI).
3. Recompute and update each `sha256`.
4. Update `expectedFileArchPattern` only if upstream rebuilds with different toolchain output.
5. Update `archivePath` and `installName` only if upstream changes the artifact layout (rare).
6. Re-verify `invocationMode` for Codex by inspecting the new tarball — do not assume it stayed the same.
7. Bump `generated` to the new date.
8. Ship a new Ritemark release; users get the new runtime via the standard Ritemark app update.

A Settings "Check for updates" button (Sprint 64, Phase E) wires into Ritemark's existing app-update check — there is no separate runtime update channel.

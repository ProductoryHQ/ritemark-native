# Bundled Agent Runtimes

Ritemark ships app-owned Claude, Codex, and OpenCode runtimes. A clean install does not depend on a user-installed runtime or `PATH` tool.

## Approved v1.11.0 snapshot

| Runtime | Version | Companion dependency | Source rows |
|---|---:|---|---:|
| Codex | 0.154.0 | Complete official app-server package; bundled ripgrep 15.2.0 and platform resources | 3 |
| Claude Code | 2.1.270 | `@anthropic-ai/claude-agent-sdk` 0.3.270 with all eight optional platform packages | 3 |
| OpenCode | 1.18.30 | ACP SDK 1.4.0 and runtime-owned ripgrep 15.1.0 | 6 |

The schema-v3 manifest contains 12 downloaded source rows. They produce 25 approved installed files: 16 Codex package members, three Claude runtimes, three OpenCode runtimes, and three OpenCode ripgrep binaries. Every archive and installed file has an exact SHA-256.

Claude Code and its Agent SDK move in lockstep: runtime `2.1.270` pairs with SDK `0.3.270`. The validator also requires every SDK optional platform package at that exact version. Anthropic runtime redistribution remains covered by the product-owner decision recorded on 2026-05-06 and the legal URL in each manifest row.

## Installed layout

```text
binaries/agents/<platform>-<arch>/
├── claude[.exe]
├── opencode[.exe]
├── opencode-path/
│   └── rg[.exe]
└── codex/
    ├── bin/
    │   ├── codex-app-server[.exe]
    │   └── codex-code-mode-host[.exe]
    ├── codex-package.json
    ├── codex-path/
    │   └── rg[.exe]
    └── codex-resources/
        ├── zsh/bin/zsh                         # macOS
        ├── codex-command-runner.exe            # Windows
        └── codex-windows-sandbox-setup.exe     # Windows
```

The Codex tree is copied without flattening because app-server resolves code-mode-host, ripgrep, shell resources, and Windows sandbox helpers relative to the official package. OpenCode receives only `opencode-path` at the front of its subprocess `PATH`; this prevents a first-use ripgrep download and does not couple OpenCode to Codex's package.

Payload directories and `.sha256` sidecars are generated and gitignored. The manifest, validator, fetcher, and this notice are tracked.

## Fetch and verification

```bash
./scripts/fetch-agent-runtimes.sh
./scripts/fetch-agent-runtimes.sh --platform win32 --arch x64
./scripts/fetch-agent-runtimes.sh --all-platforms
./scripts/fetch-agent-runtimes.sh --verify-only
```

The fetcher validates the manifest before network access, caches archives by digest, verifies archive hashes, rejects absolute paths, traversal, links, and device members, preserves the exact Codex package file set, checks installed hashes and architectures, and runs native smoke arguments. It promotes a complete staged Codex directory as one unit. Foreign-target binaries are inspected but never executed.

`scripts/validate-agent-runtime-manifest.mjs` rejects version drift, missing targets or Codex members, unsafe or duplicate install paths, unsupported smoke arguments, and SDK/lockfile mismatch. The Agent Runtime Matrix repeats native Intel macOS and Windows checks on pull requests.

## Update and rollback

Update the manifest, validator allowlist, SDK pin, lockfile, evidence, and this notice in one sprint. Inspect the complete upstream package and first-use behavior before approving a new snapshot. Never mix Codex app-server with members from another package version.

The Sprint 116 rollback snapshot is commit `30ea2ab32d15be161991d1bb8924a4c4ca331f8c`: Codex 0.153.0, Claude Code 2.1.239 with SDK 0.3.239, OpenCode 1.18.21, and ACP SDK 1.4.0. A rollback restores the manifest, fetch/validation contract, adapters, SDK lockfile, and catalog together.

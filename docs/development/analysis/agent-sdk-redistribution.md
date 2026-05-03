# Agent SDK Redistribution: How Claude and Codex Ship Inside Ritemark

Date: 2026-05-02  
Scope: What Ritemark redistributes from the Anthropic and OpenAI agent stacks today, where each piece lives in the source tree and in the shipped app, and what Sprint 57 changes about it.

This document is descriptive — it states the current state, not a redistribution policy. License/legal review for the upcoming bundled native runtimes is tracked in `docs/development/analysis/cli-bundling-research.md` and the Sprint 57 plan; that gate is not closed yet.

## TL;DR

| Component | Vendor | Form | Bundled in Ritemark today? | Where it lives in shipped app |
| --- | --- | --- | --- | --- |
| `@anthropic-ai/claude-agent-sdk` (TS/JS) | Anthropic | npm package (ESM) | **Yes** — full package inside extension `node_modules` | `Ritemark.app/Contents/Resources/app/extensions/ritemark/node_modules/@anthropic-ai/claude-agent-sdk/` |
| `claude` / `claude.exe` (Claude Code CLI native binary) | Anthropic | platform binary (~242 MB on Windows) | **No** — resolved at runtime from user PATH | (not present) — Sprint 57 plans to add it under `binaries/agents/<platform>-<arch>/` |
| `openai` (TS/JS) | OpenAI | npm package | **Yes** — full package inside extension `node_modules` | `Ritemark.app/...app/extensions/ritemark/node_modules/openai/` |
| `codex` / `codex-app-server` (Codex CLI / app-server native binary) | OpenAI | platform binary | **No** — resolved at runtime from user PATH | (not present) — Sprint 57 plans to add it under `binaries/agents/<platform>-<arch>/` |
| `whisper-cli` + `libwhisper.dylib` + `libggml*.dylib` | ggerganov/whisper.cpp | platform binaries | **Yes** | `Ritemark.app/...app/extensions/ritemark/binaries/darwin-arm64/` (voice dictation; included for completeness — not an agent SDK) |

The two redistribution shapes that matter:

1.  **SDK as npm package** — JS/TS code, zero-config, lives in `node_modules`. Anthropic and OpenAI both ship one. Ritemark already ships both in every release.
2.  **Native CLI runtime** — platform-specific compiled binary that the SDK or extension spawns as a child process. Today the user must install it. Sprint 57 will bundle it.

These two shapes have different licensing footprints. The SDK packages are public npm tarballs with terms attached; the CLI binaries are larger, vendor-owned executables whose redistribution requires explicit review.

## What Lives Where

### Source tree

```
extensions/ritemark/
├── package.json                          # declares "@anthropic-ai/claude-agent-sdk", "openai", "zod"
├── package-lock.json
├── node_modules/
│   ├── @anthropic-ai/claude-agent-sdk/   # full SDK ships here (sdk.mjs, cli.js, *.wasm, vendor/)
│   └── openai/                           # full SDK ships here
├── binaries/
│   ├── README.md
│   ├── darwin-arm64/                     # whisper STT binaries (NOT agent runtimes)
│   │   ├── whisper-cli
│   │   ├── libwhisper.dylib
│   │   └── libggml*.dylib (×5 + 9 symlinks)
│   └── agents/                           # Sprint 57 destination for bundled agent runtimes
│       ├── README.md                     # placeholder spec — see "Sprint 57 plan" below
│       └── darwin-arm64/                 # currently empty
└── src/
    ├── agent/
    │   ├── AgentRunner.ts                # dynamic ESM import of @anthropic-ai/claude-agent-sdk
    │   └── setup.ts                      # detects + spawns claude CLI
    ├── codex/
    │   ├── codexManager.ts               # detects + spawns codex / codex-app-server
    │   └── codexAppServer.ts             # JSON-RPC client over stdio
    └── utils/
        └── bundledAgentRuntime.ts        # central path resolver: bundled-first, then PATH
```

### Shipped app (verified after `./scripts/build-prod.sh`)

```
Ritemark Native.app/Contents/Resources/app/extensions/ritemark/
├── extension.js                                              # compiled extension entry
├── package.json
├── node_modules/                                             # 93 packages incl. SDKs
│   ├── @anthropic-ai/claude-agent-sdk/
│   │   ├── sdk.mjs            # ESM entry imported by AgentRunner
│   │   ├── cli.js             # SDK's bundled JS CLI shim
│   │   ├── manifest.json
│   │   ├── package.json       # version 0.2.31, claudeCodeVersion 2.1.31
│   │   ├── LICENSE.md         # © Anthropic PBC. All rights reserved.
│   │   ├── README.md
│   │   ├── resvg.wasm
│   │   ├── tree-sitter*.wasm
│   │   └── vendor/
│   ├── openai/
│   ├── zod/                   # peer dep required by Claude SDK
│   └── …
├── media/
│   └── webview.js             # ~7 MB Vite bundle (in-process OpenAI calls live here too)
└── binaries/
    └── darwin-arm64/          # whisper-only today
```

The VS Code extension bundling pipeline copies `productionDependencies` from `extensions/ritemark/package.json` into the app's resources directory. Anything declared in `dependencies` ships; anything in `devDependencies` does not.

## Path 1 — How the JS SDKs Ship

Both Anthropic and OpenAI publish their SDKs as plain npm packages. Ritemark redistributes them by virtue of the standard VS Code extension packaging behavior — there is no Ritemark-specific bundling step.

### Claude Agent SDK

Declared in `extensions/ritemark/package.json:536`: `"@anthropic-ai/claude-agent-sdk": "^0.2.29"` (currently resolved to 0.2.31).

Imported lazily, at first use, via dynamic ESM import from a CommonJS extension host:

The `new Function` wrapper exists because TypeScript's CJS target rewrites `import()` to `require()`, which would break ESM resolution.

Peer dep `zod@^4.0.0` is declared in `extensions/ritemark/package.json:551` so the SDK's runtime schema validation works.

The SDK package contains: `sdk.mjs` (entry), `cli.js`, `sdk.d.ts`, `manifest.json`, `resvg.wasm`, `tree-sitter*.wasm`, `vendor/`. Total package size ≈ small enough that it fits inside the 7 MB headroom of the existing extension bundle without notable impact.

License declared by the package itself: `LICENSE.md` reads `© Anthropic PBC. All rights reserved. Use is subject to the Legal Agreements outlined here: https://code.claude.com/docs/en/legal-and-compliance.` The SDK `package.json` declares `"license": "SEE LICENSE IN README.md"` and the README points to Anthropic's commercial terms and privacy policy.

The SDK is **only the orchestration library** — it knows how to talk to a Claude Code session over stdio and how to assemble messages. It does **not** include the LLM, the Anthropic API client transport that runs the model, or the `claude` binary that owns the Claude Code execution loop. The SDK spawns `claude` as a child process via the `pathToClaudeCodeExecutable` option (see Path 2 below).

### OpenAI SDK

*   Declared in `extensions/ritemark/package.json:544`: `"openai": "^6.17.0"`.
*   Imported normally (CJS-compatible package).
*   Used for the in-process OpenAI integration: Responses API for API-key users, image generation models, and the in-process Ritemark agent path. Webview code reads its model list from `extensions/ritemark/src/ai/modelConfig.ts` (single source of truth) — no SDK code runs in the webview, only the extension host.
*   License: Apache-2.0. Standard npm redistribution applies.

### Update Policy

*   SDK versions are pinned by `package-lock.json`. Bumping happens explicitly in a commit; there is no auto-update at runtime.
*   A SDK upgrade is a normal Ritemark release: change `package.json`, `npm install --legacy-peer-deps` (CI flag carried since Sprint 44), commit lockfile, ship in the next DMG/installer.

## Path 2 — How the Native CLI Binaries Ship (or Don't)

This is the asymmetric bit. Both `claude` and `codex` are vendor-built native executables; the SDK packages above orchestrate them but do not contain them.

### Today — runtime resolution from user-installed binaries

`extensions/ritemark/src/utils/bundledAgentRuntime.ts` is the single resolver used by both the Claude setup code and the Codex manager. It checks:

```
const directories = [
  join(extensionRoot, 'binaries', 'agents', tag),       // <platform>-<arch>
  join(extensionRoot, 'binaries', 'agents', platform),  // <platform> only
  join(extensionRoot, 'resources', 'native-binaries', tag),
  join(extensionRoot, 'resources', 'native-binary'),    // mirrors Anthropic VSIX layout
  join(extensionRoot, 'resources', kind, tag),
];
```

If none of those contain the expected binary, the consumers fall back:

*   **Claude** (`extensions/ritemark/src/agent/setup.ts:147-192`) — `findBundledAgentRuntime('claude')` first, then `which/where claude`, then platform-specific common install dirs (`~/.claude/local/bin`, `%LOCALAPPDATA%\Programs\Claude\claude.exe`, `%APPDATA%\npm\claude.cmd`, `/opt/homebrew/bin/claude`, `/usr/local/bin/claude`, etc.). On Windows, `.cmd` wrappers are unwrapped to the underlying `cli.js` because the SDK runs `node <path>`, not the `.cmd` shell.
*   **Codex** (`extensions/ritemark/src/codex/codexManager.ts:103-120`) — `findBundledAgentRuntime('codex-app-server')`, then `findBundledAgentRuntime('codex-cli')`, then PATH lookup, then user dirs.

`binaries/agents/darwin-arm64/` and `binaries/agents/win32-x64/` exist as directories in the source tree (Sprint 57 reserved them) but are **empty in v1.6.1**. The Claude SDK still has to find a system-installed `claude` for any agent action to work.

This means:

*   Today, Ritemark's macOS DMG ships the Claude **SDK** but does not ship Claude Code itself. The user must run `npm install -g @anthropic-ai/claude-code` (or use the official installer) before any agent feature works.
*   Today, Ritemark also does not ship Codex. Same install requirement on the user side.

### Sprint 57 plan — bundled native runtimes

The selected Sprint 57 path is "Path A: bundled runtimes" (`docs/development/analysis/cli-bundling-research.md`). The plan, summarized:

*   Place native runtime binaries at `extensions/ritemark/binaries/agents/<platform>-<arch>/<name>` (`claude` / `claude.exe`, `codex` / `codex.exe` or `codex-app-server` / `codex-app-server.exe`).
*   Spawn the bundled runtime first; fall back to system-installed only as an advanced override.
*   For Claude on Windows, mirror the **official Anthropic Claude Code VSIX 2.1.126** pattern: that VSIX ships `extension/resources/native-binary/claude.exe` (~242 MB extracted). `bundledAgentRuntime.ts` already accepts that path layout, so an alternate vendor location is supported without code changes.
*   For Codex, the candidate sources are the OpenAI release assets at `github.com/openai/codex/releases` (which include `codex-*-pc-windows-msvc.exe` and macOS arm64/x64 binaries) or the npm platform packages (`@openai/codex-win32-x64`, `@openai/codex-darwin-arm64`, etc.) that wrap them.

What is **explicitly deferred until release readiness** in the cli-bundling-research doc:

*   Final artifact source per platform/arch (extension VSIX vs. release asset vs. npm platform package vs. internal mirror).
*   Pinned versions and SHA256 checksums recorded in build metadata.
*   Update policy: bundle ships pinned with each Ritemark release; runtime in-place updates are not in scope yet.
*   **Legal review** — Anthropic's VSIX license says Anthropic owns the package and use is subject to Anthropic legal terms. Engineering for the spike assumes redistribution to test the technical path; before any public release that bundles Claude, this gate must close.

So at v1.6.1, the redistribution profile is:

*   ✅ Claude **SDK** redistribution: present, governed by Anthropic's commercial terms via the SDK package's LICENSE.md.
*   ❌ Claude **CLI binary** redistribution: not happening yet.
*   ✅ OpenAI **SDK** redistribution: present, Apache-2.0.
*   ❌ Codex **CLI binary** redistribution: not happening yet.

## How a Single Agent Call Flows Through Ritemark

For the JS-SDK-only path (today's reality on a clean machine that has `claude` installed):

```
user clicks Send in AI sidebar
  └─ webview posts message → extension host
       └─ AgentRunner.runAgent / AgentSession.sendMessage   (extensions/ritemark/src/agent/AgentRunner.ts)
            └─ getQuery() lazily ESM-imports @anthropic-ai/claude-agent-sdk
                 └─ sdk.query({ prompt, options: { pathToClaudeCodeExecutable, ... } })
                      └─ SDK spawns child process: node <pathToClaudeCodeExecutable>
                           └─ claude (CLI binary, vendor-installed today, bundled later)
                                └─ Anthropic API over HTTPS
```

`pathToClaudeCodeExecutable` is what threads the user-resolved (or future bundled) Claude binary into the SDK. Without it, the SDK falls back to its own resolution rules, which on Windows fail because npm `.cmd` shims can't be spawned the way the SDK expects.

For Codex, the flow is similar but Ritemark drives the JSON-RPC handshake itself instead of using a vendor SDK:

```
user runs a Codex flow node
  └─ CodexNodeExecutor → CodexManager.spawn (extensions/ritemark/src/codex/codexManager.ts)
       └─ child_process.spawn(<codex binaryPath>, ['app-server'])
            └─ codex-app-server emits JSON-RPC 2.0 over stdio
                 └─ codexAppServer.ts marshals app-server methods and events
                      └─ OpenAI Responses API or ChatGPT OAuth
```

## File Locations Referenced in This Doc

*   Resolver:
    *   `extensions/ritemark/src/utils/bundledAgentRuntime.ts`
*   Claude SDK consumer:
    *   `extensions/ritemark/src/agent/AgentRunner.ts`
    *   `extensions/ritemark/src/agent/setup.ts`
*   Codex consumer:
    *   `extensions/ritemark/src/codex/codexManager.ts`
    *   `extensions/ritemark/src/codex/codexAppServer.ts`
    *   `extensions/ritemark/src/codex/codexProtocol.ts`
*   Bundled binaries directory layout:
    *   `extensions/ritemark/binaries/README.md` (whisper)
    *   `extensions/ritemark/binaries/agents/README.md` (Sprint 57 placeholder)
*   Background docs:
    *   `docs/development/analysis/cli-bundling-research.md` — option matrix, license/legal gates.
    *   `docs/development/sprints/sprint-57-windows-onboarding/sprint-plan.md` — current implementation plan.
    *   `docs/development/sprints/sprint-57-windows-onboarding/research/03-official-claude-vsix-inspection.md` — what's inside the official Anthropic VSIX.

## Open Questions (for Release Readiness, Not for v1.6.1)

These are tracked in the Sprint 57 plan and `cli-bundling-research.md`; listing here so the redistribution picture is honest:

1.  Is Anthropic redistribution of `claude.exe`/`claude` from their VSIX or release artifacts permitted under Anthropic legal terms for a third-party app like Ritemark? If not, what is the alternative happy path on a clean Windows machine (official extension/runtime channel, vendor-managed installer, etc.)?
2.  Codex (Apache-2.0) is easier on the license axis, but the artifact source still needs pinning — release asset (`codex-*-pc-windows-msvc.exe`) vs. npm platform package vs. self-built. Which one matches the audited compatibility range in `codexManager.ts` (`0.111.x – 0.124.x`)?
3.  Update cadence: when Anthropic ships a new `claude` version, do we re-spin Ritemark, or do we ship an in-place updater for the bundled runtime? Same question for Codex.
4.  Bundle size impact: `claude.exe` alone is ~242 MB. Ritemark DMG today is ~416 MB. Doubling install size for one user-facing feature is a product call.

These are explicitly _not_ answered by this doc — they belong with whoever closes the release-readiness gate before bundled runtimes ship to users.

```
// extensions/ritemark/src/agent/AgentRunner.ts:36-45
async function getQuery() {
  if (!queryFn) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;
    const sdk = await dynamicImport('@anthropic-ai/claude-agent-sdk');
    queryFn = sdk.query as unknown as typeof queryFn;
  }
  return queryFn!;
}
```
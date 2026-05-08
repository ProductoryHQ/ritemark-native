# Codex Startup & Binary Audit — 2026-05-06

**Status:** revised and source-validated on 2026-05-06.  
**Primary product requirement:** Ritemark clean installs must be out-of-box. New users must not need to know about binaries, Node, npm, CPU architecture, Rosetta, PATH, or vendor CLIs. Ritemark must ship or immediately install the required Codex/Claude runtimes itself.

---

## Executive summary

The observed Codex failure (`RPC call 'thread/start' timed out after 30000ms`) is a runtime-startup/auth symptom, but the larger product issue is architectural:

1. **Ritemark currently has a bundled-runtime resolver, but no bundled agent artifacts.**  
   `extensions/ritemark/binaries/agents/darwin-arm64/` is empty in both dev and the inspected production app. So clean-machine success currently depends on system-installed Codex/Claude or the onboarding installer path.

2. **Codex is fragile when installed through the user's global Node/npm environment.**  
   On this Apple Silicon machine, Ritemark resolves `codex` from an x86_64 nvm Node installation, which in turn installed the x86_64 Codex optional dependency. That is compatible enough to start under Rosetta, but it is the wrong product dependency for an out-of-box app.

3. **Claude is healthier on this machine, but should still be bundled/provisioned by Ritemark for clean installs.**  
   The inspected Claude binary is arm64. Official Anthropic docs now also emphasize native installation paths, and the npm package publishes per-platform optional native dependencies. Ritemark should not require users to understand either path.

4. **The correct target architecture is bundled/provisioned agent runtimes first, system runtimes second.**  
   Existing `which codex` / `which claude` resolution should become fallback/advanced override behavior, not the clean-machine path.

5. **Settings repair is still useful, but it is not the primary install strategy.**  
   Repair should fix corrupt/missing bundled artifacts or explicitly selected external runtimes. It should not be the user's first exposure to agent setup.

---

## Validated external source facts

Sources checked on 2026-05-06:

| Claim | Validation | Source |
|---|---|---|
| Codex CLI official install path includes `npm install -g @openai/codex`. | Confirmed by OpenAI Help Center. | OpenAI Help Center: <https://help.openai.com/en/articles/11096431> |
| Codex app-server is a JSON-RPC interface over stdio/ws used by rich interfaces such as the VS Code extension. | Confirmed by OpenAI Codex repository docs. | GitHub: <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md> |
| Codex npm package is a JS wrapper with per-platform optional dependencies including darwin arm64/x64, linux arm64/x64, win32 arm64/x64. | Confirmed from npm registry metadata for latest `@openai/codex` (`0.128.0` at check time). | npm registry: <https://registry.npmjs.org/%40openai%2Fcodex/latest> |
| Codex GitHub releases include platform artifacts such as Apple Silicon `codex-aarch64-apple-darwin.tar.gz`. | Confirmed by npm page / GitHub release listing. | npm package page: <https://www.npmjs.com/package/%40openai/codex> and GitHub releases: <https://github.com/openai/codex/releases> |
| Claude Code official native installer path includes `curl -fsSL https://claude.ai/install.sh \| bash`; Windows native installer path includes `winget install Anthropic.ClaudeCode`. | Confirmed by Anthropic/Claude docs and support pages. | Anthropic setup docs: <https://docs.anthropic.com/en/docs/claude-code/setup>, Claude support FAQ: <https://support.claude.com/en/articles/14554922-claude-code-user-faq> |
| Claude native installer places the binary at `~/.local/bin/claude` on macOS/Linux. | Confirmed by Claude support FAQ. | <https://support.claude.com/en/articles/14554922-claude-code-user-faq> |
| Claude npm package also has per-platform optional native dependencies. | Confirmed from npm registry metadata for latest `@anthropic-ai/claude-code` (`2.1.131` at check time). | npm registry: <https://registry.npmjs.org/%40anthropic-ai%2Fclaude-code/latest> |

Important correction from the first audit version: Claude should not be described as “not Node-related” in all distribution forms. The installed binary on this machine is native, and Anthropic recommends native installation, but the npm package also exists and uses per-platform optional native dependencies. The product conclusion is unchanged: Ritemark should hide all of this from end users.

---

## Product requirement: what clean install must do

### macOS

When a user copies/opens Ritemark on macOS, Ritemark must already contain or immediately provision the correct agent runtime binaries for that app build:

```text
Ritemark.app
└── Contents/Resources/app/extensions/ritemark/binaries/agents/
    └── darwin-arm64/
        ├── codex or codex-app-server
        └── claude
```

For an Intel macOS build, the equivalent should be `darwin-x64/`.

### Windows

When a user runs the Windows installer, the installer must install the required agent runtime binaries into the app payload or app-owned data directory, for example:

```text
resources/app/extensions/ritemark/binaries/agents/win32-x64/
  codex.exe or codex-app-server.exe
  claude.exe
```

The exact path can be adjusted for installer/update constraints, but it must be Ritemark-owned and deterministic.

### User experience rule

The user should see:

```text
Codex: Ready
Claude: Ready
```

not:

```text
Install Node
Run npm install -g
Choose arm64 vs x64
Fix PATH
Restart shell
Understand Rosetta
```

---

## Current Ritemark runtime architecture

### Resolver exists

`extensions/ritemark/src/utils/bundledAgentRuntime.ts` already implements the intended lookup order: prefer a bundled runtime under `extensions/ritemark/binaries/agents/<platform>-<arch>/`, then fall back to system-installed binaries.

Codex lookup in `codexManager.ts` currently resolves roughly as:

1. bundled `codex-app-server`;
2. bundled `codex`;
3. `which codex`;
4. known nvm/global install locations;
5. known local binary paths.

Claude lookup in `agent/setup.ts` similarly checks:

1. bundled `claude`;
2. `which claude`;
3. known local/global paths.

### Artifacts are missing

Inspected repo/dev state:

```text
extensions/ritemark/binaries/agents/
├── README.md
└── darwin-arm64/        # empty
```

Inspected production app state:

```text
VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/extensions/ritemark/binaries/agents/
├── README.md
└── darwin-arm64/        # empty
```

Sprint reference: `docs/development/sprints/sprint-57-windows-onboarding/sprint-plan.md` marked the resolver as implemented but artifact delivery as pending.

**Conclusion:** Ritemark already has the skeleton for the desired architecture, but the shipped artifacts are absent. Therefore Ritemark currently falls back to the user's machine state.

---

## Current onboarding/install architecture

The current onboarding path is vendor-managed installation, not app-owned bundling:

| Component | Current action | Product concern |
|---|---|---|
| Git | sends user to Git installer/download path | acceptable for Git, but still guided |
| Node | sends user to Node installer/download path | not acceptable as hidden dependency for Codex readiness |
| Claude | runs vendor native installer path | better than npm, but still external/provisioning-dependent |
| Codex | runs `npm install -g @openai/codex` | fragile because npm chooses optional dependency based on active Node/platform environment |

This can work on many clean machines, but it is not robust enough for the stated Ritemark requirement. Clean-machine agent readiness should not depend on a global npm environment.

---

## On-disk audit: this Apple Silicon machine

Host: Apple Silicon (`uname -m = arm64`).

### Ritemark app

| Component | Path | Result |
|---|---|---|
| Ritemark.app Electron binary | `VSCode-darwin-arm64/Ritemark.app/Contents/MacOS/Ritemark` | arm64 ✅ |

### Claude

| Component | Path | Result |
|---|---|---|
| `which claude` | `/Users/jarmotuisk/.local/bin/claude` | native launcher/binary path ✅ |
| installed Claude version target | `/Users/jarmotuisk/.local/share/claude/versions/2.1.128` | arm64 ✅ |

This local Claude install is compatible with the machine.

### Codex

| Component | Path | Result |
|---|---|---|
| `which codex` | `/Users/jarmotuisk/.nvm/versions/node/v23.0.0/bin/codex` | JS wrapper via shebang |
| Node used by that Codex | `/Users/jarmotuisk/.nvm/versions/node/v23.0.0/bin/node` | x86_64 ❌ |
| Codex vendor binary installed under that npm tree | `@openai/codex-darwin-x64/vendor/x86_64-apple-darwin/codex/codex` | x86_64 ❌ |
| Expected native Apple Silicon package | `@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/...` | not installed |

**Conclusion for this machine:** Ritemark is selecting an x86_64 Codex through PATH/nvm. That should be repaired locally, but the product fix is to stop depending on this path for clean installs.

---

## Why `thread/start` times out

Ritemark's Codex app-server wrapper uses a generic 30-second JSON-RPC timeout:

`extensions/ritemark/src/codex/codexAppServer.ts`

```ts
private rpc<TParams, TResult>(method: string, params: TParams, timeoutMs = 30_000): Promise<TResult>
```

The failure path in `UnifiedViewProvider._handleCodexExecution` is:

1. `account/read` status check;
2. `initialize`;
3. `thread/start`; ← timeout observed here
4. `turn/start` would only happen after thread creation.

Because `initialize` succeeds, stdio transport is alive. The hang is likely inside Codex's app-server handling of `thread/start`, not in Ritemark's JSONL parser.

Most likely contributing factors:

1. Codex auth/model/plan resolution during `thread/start` can involve network/auth refresh work.
2. The selected local Codex runtime is x86_64 under Rosetta on an arm64 Mac.
3. Multiple Codex app-server processes from different ecosystems were observed and may share auth/log state.
4. `model: null` can force Codex to resolve the user's default model/plan.
5. A fixed 30-second timeout is too brittle for cold start + auth refresh.

Not supported by evidence:

- pinned markdown context causing `thread/start` itself to fail; pinned content is used later in the turn prompt, not in thread creation parameters;
- parser corruption; `initialize` would likely fail too;
- Ritemark bundling the wrong Codex binary; no Codex binary is currently bundled.

---

## Required target architecture

### Rule 1 — bundled/provisioned first

Ritemark should always prefer app-owned runtimes:

```text
1. Ritemark-bundled/provisioned runtime for exact platform/arch
2. Ritemark-managed updated runtime cache, if used
3. explicitly selected external runtime
4. system PATH fallback for advanced/debug use only
```

### Rule 2 — no global Node/npm dependency for first-run success

Codex and Claude may internally ship native binaries, JS wrappers, optional dependencies, or app-server subcommands. That must be hidden behind Ritemark packaging. The first-run path should not call `npm install -g` as the primary way to become ready.

### Rule 3 — health check remains mandatory

Even with bundled runtimes, Ritemark should check:

- artifact exists;
- executable bit / Windows executable validity;
- architecture matches host/build;
- binary starts and reports version;
- Codex app-server `initialize` works;
- auth/account state is understandable;
- app-server thread creation has progress/timeout UX.

### Rule 4 — Settings repair is fallback

Settings should include:

- “Check agent installation”;
- “Repair bundled Codex runtime”;
- “Repair bundled Claude runtime”;
- optional “Use system Codex/Claude instead” advanced override;
- diagnostics export.

This is for recovery, not normal onboarding.

---

## Implementation plan candidates

### A. Add runtime artifact ingestion to builds

Create a deterministic source of truth for runtime artifacts, e.g.:

```text
extensions/ritemark/binaries/agents/
  manifest.json
  darwin-arm64/
    codex
    claude
  darwin-x64/
    codex
    claude
  win32-x64/
    codex.exe
    claude.exe
```

Manifest should include:

- vendor;
- upstream version;
- source URL or internal artifact ID;
- sha256;
- platform/arch;
- expected executable name;
- license metadata;
- signing/notarization status.

### B. Wire artifacts into macOS packaging

Ensure `build-prod.sh` / VS Code OSS packaging copies artifacts into the final `.app` bundle and preserves executable bits.

Need validation gate:

```bash
file Ritemark.app/.../binaries/agents/darwin-arm64/codex
file Ritemark.app/.../binaries/agents/darwin-arm64/claude
```

Expected on Apple Silicon: arm64/aarch64.

### C. Wire artifacts into Windows installer

Ensure the Windows installer includes `win32-x64` artifacts and validates they are present after install. If Windows arm64 is supported, add `win32-arm64` as a separate target; do not rely on emulation silently.

### D. Promote bundled runtime status into UI readiness

AI sidebar and Settings should not report Codex/Claude as ready unless the selected runtime is compatible. If a bundled runtime exists and is healthy, it should win over `which`.

### E. Improve Codex timeout/progress UX

`thread/start` should have method-specific handling:

- progress message after ~10 seconds;
- clearer timeout after 60 seconds for thread creation;
- diagnostics button;
- automatic runtime/auth status snapshot in the error.

### F. Consolidate app-server process ownership

Ritemark currently has multiple possible `CodexAppServer` owners: AI sidebar, Settings, and Flow execution. Consolidating or serializing auth-sensitive operations would reduce local contention, but this is secondary after controlling the runtime source.

---

## Recommended sequencing

1. **Ship/provision bundled runtimes first.** This is the core product requirement.
2. **Make the resolver prefer bundled runtimes and treat system runtimes as fallback/advanced.** The resolver mostly does this already; the missing piece is artifacts and readiness gating.
3. **Add packaging validation gates.** CI/release should fail if required runtime artifacts are missing or wrong-architecture.
4. **Add Settings repair and diagnostics.** Useful for corrupted installs and external runtime overrides.
5. **Improve `thread/start` timeout UX.** Avoid developer-facing `RPC call ... timed out` messages.
6. **Only then optimize app-server lifecycle/concurrency.**

Do **not** rely on global npm installs as the clean-machine path.

---

## Immediate repair for this machine

This fixes Jarmo's local x86_64 Codex install by reinstalling Codex under arm64 Node:

```bash
arch -arm64 /bin/bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm install 22 && nvm use 22 && npm uninstall -g @openai/codex @openai/codex-darwin-x64 @openai/codex-darwin-arm64; npm install -g @openai/codex'
```

Then verify:

```bash
which codex
file "$(which node)"
codex --version
```

Expected result on Apple Silicon: selected Node and Codex vendor binary are arm64/aarch64, not x86_64.

This is a local workaround only. It does not satisfy the clean-install product requirement.

---

## Diagnostic commands used / recommended

```bash
# Process inventory
ps aux | grep -E "codex|app-server" | grep -v grep

# Architecture checks
file /Users/jarmotuisk/.nvm/versions/node/v23.0.0/bin/node
file /Users/jarmotuisk/.nvm/versions/node/v23.0.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-x64/vendor/x86_64-apple-darwin/codex/codex
file /Users/jarmotuisk/.local/bin/claude
file /Users/jarmotuisk/.local/share/claude/versions/2.1.128
file VSCode-darwin-arm64/Ritemark.app/Contents/MacOS/Ritemark

# Bundled artifact check: dev + prod
ls -la extensions/ritemark/binaries/agents/darwin-arm64/
ls -la VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/extensions/ritemark/binaries/agents/darwin-arm64/

# Source metadata checks used during validation
curl -L -s https://registry.npmjs.org/%40openai%2Fcodex/latest
curl -L -s https://registry.npmjs.org/%40anthropic-ai%2Fclaude-code/latest
```

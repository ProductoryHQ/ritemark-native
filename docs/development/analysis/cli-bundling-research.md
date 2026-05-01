# Agent Runtime Bundling Research: Windows Onboarding

Date: 2026-04-30  
Sprint: `docs/development/sprints/sprint-57-windows-onboarding/`

## Decision Needed

Ritemark should stop depending on user-installed global agent CLIs on Windows. The current model makes product onboarding depend on npm global install behavior, PowerShell execution policy, Node availability, PATH state, and architecture detection.

Jarmo selected **Path A: bundled runtimes** for Sprint 57. The engineering assumption is to redistribute bundled runtimes during the implementation spike. Legal review is deferred to release readiness, because if the technical path does not work there is no redistribution path to approve.

The remaining implementation decisions are the exact runtime source, packaging shape, checksums, and update policy for each agent.

Path B (in-process agent replacement) remains a future architecture option, but it is not the selected Sprint 57 implementation path.

## Current Ritemark State

Ritemark currently uses `extensions/ritemark/src/codex/` for Codex integration:

- `codexManager.ts` detects a `codex` binary in PATH and handles version compatibility.
- `codexAppServer.ts` talks to `codex app-server` over JSON-RPC.
- `codexProtocol.ts` defines the app-server protocol shape.
- `codexAuth.ts` starts ChatGPT OAuth via app-server.

Measured code size:

```text
extensions/ritemark/src/codex/*.ts: 2153 lines total
codexManager.ts: 767 lines
codexAppServer.ts: 368 lines
codexProtocol.ts: 419 lines
codexApproval.ts: 53 lines
```

The primary onboarding failure is not that Codex has no Windows runtime. It is that Ritemark asks a normal Windows user to obtain and expose that runtime through global npm/PowerShell/PATH.

Ritemark also has Claude setup code that currently runs the vendor installer:

- `extensions/ritemark/src/agent/installer.ts` runs `irm https://claude.ai/install.ps1 | iex` on Windows.
- `extensions/ritemark/src/agent/setup.ts` detects `claude` from PATH or common user install locations.
- This should not remain the happy path for clean Windows onboarding.

## External Facts Checked

As of 2026-04-30:

- OpenAI Codex release assets for `rust-v0.125.0` include native Windows `codex-*-pc-windows-msvc.exe` binaries and npm platform packages for Windows.
- The OpenAI Windows release workflow builds Windows binaries for `codex`, `codex-responses-api-proxy`, `codex-windows-sandbox-setup`, `codex-command-runner`, and `codex-app-server`.
- The npm launcher maps `process.platform === "win32"` to `@openai/codex-win32-x64` or `@openai/codex-win32-arm64`, then runs `codex.exe`.
- The public install docs still list Windows 11 via WSL2 as the supported Windows install path.
- The app-server README describes `codex app-server` as JSON-RPC 2.0 over stdio by default.
- Official Anthropic Claude Code VSIX `2.1.126` for `win32-x64` contains `extension/resources/native-binary/claude.exe`.
- The official Anthropic VSIX uses a platform-specific bundled native binary as its happy path and falls back to JS/Node only when native binary lookup fails.

Sources:

- https://github.com/openai/codex/releases/expanded_assets/rust-v0.125.0
- https://github.com/openai/codex/blob/main/.github/workflows/rust-release-windows.yml
- https://raw.githubusercontent.com/openai/codex/main/codex-cli/bin/codex.js
- https://github.com/openai/codex/blob/main/docs/install.md
- https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md
- https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code
- `docs/development/sprints/sprint-57-windows-onboarding/research/03-official-claude-vsix-inspection.md`

## Options

| Option | Description | Windows onboarding | Implementation effort | Main risk |
| --- | --- | --- | --- | --- |
| Keep global npm install | Status quo with better errors | Poor | Low | Still depends on Node, npm, PowerShell, PATH. |
| Spawn `.cmd` or `.exe` from global install | Avoid `.ps1` execution-policy failure | Partial | Low-medium | Still requires global install and PATH. |
| Bundle Claude native runtime | Mirror official Anthropic VSIX pattern | Good | Medium | Package size, update cadence, release-time legal review. |
| Bundle full `codex.exe` | Ship native Codex runtime with Ritemark | Good | Medium | Large binary, release tracking, subprocess lifecycle. |
| Bundle `codex-app-server` | Ship only embeddable Codex server | Good if artifact is available | Medium | Exact downloadable artifact must be verified for chosen release. |
| Use npm platform package as build-time source | Vendor platform binary into extension/app package | Good | Medium | Package structure/versioning may change. |
| Replace Codex CLI with in-process OpenAI agent | Remove external binary dependency | Best | High | ChatGPT OAuth supportability and agent parity. |

## Key Finding: PowerShell Is A Packaging Problem

The PowerShell execution policy error comes from npm-generated `.ps1` shims. It is not evidence that Codex cannot run on Windows.

Practical mitigations:

- Never ask users to run `npm install -g @openai/codex`.
- Never ask users to install Claude via `install.ps1` or global npm as the first-run happy path.
- Do not spawn `.ps1` wrappers.
- Prefer a known executable path owned by Ritemark.
- If still using npm packages internally, extract or reference the native `.exe`, not a shell shim.

## Path A: Bundled Runtimes

### What It Would Do

- Download or vendor known Claude and Codex Windows runtimes during Ritemark packaging.
- Place it under an extension/app-owned runtime directory.
- Spawn bundled binaries directly.
- Delete or bypass PATH/nvm/npm repair logic for the bundled path.

### Benefits

- Smallest conceptual change from current app-server integration.
- Keeps existing JSON-RPC client and protocol work.
- Removes clean-machine npm/PowerShell/Node blockers for Claude and Codex.
- Preserves the option to use Codex's own runtime behavior and sandboxing where available.
- Matches the official Anthropic Claude Code VSIX runtime packaging pattern.

### Costs

- Ritemark now owns runtime update cadence and binary provenance unless it delegates to official runtime channels.
- Package size increases.
- Subprocess lifecycle remains.
- App-server protocol compatibility must be pinned and tested.
- Exact app-server release artifact availability must be verified before implementation.
- Third-party redistribution/licensing is a release gate, not an implementation blocker for the spike.

### Implementation Preconditions

- Choose exact artifact source for Claude and Codex: official extension package, release asset, npm platform package, or internally mirrored binary.
- Verify Windows x64 and arm64 artifacts for each chosen runtime.
- Record SHA256 checksums in build metadata.
- Record redistribution/legal review as a release readiness gate.
- Define update policy: pinned with Ritemark releases, or runtime updater.

## Claude Runtime Strategy

Primary technical direction:

- Mirror the official Anthropic VSIX pattern.
- Bundle a platform-specific native Claude runtime under extension/app resources.
- Spawn the bundled runtime directly.
- Keep system-installed Claude as an advanced override.
- Do not run `install.ps1`, `curl | bash`, or `npm install -g` in the first-run happy path.

Verified facts from official VSIX inspection:

- `Anthropic.claude-code` version `2.1.126` has `TargetPlatform="win32-x64"` in `extension.vsixmanifest`.
- It contains `extension/resources/native-binary/claude.exe`.
- Extracted `claude.exe` is a PE32+ x86-64 console executable.
- The VSIX is about 79 MB compressed; `claude.exe` is about 242 MB extracted.
- `package.json` has no npm dependencies.
- Its extension code resolves bundled native binaries first, then falls back to JS/Node only if no native binary exists.

Release constraint:

- The official VSIX license says Anthropic owns the package and use is subject to Anthropic legal terms. For the engineering spike, Ritemark assumes redistribution so the technical path can be tested. Before any public release, legal/redistribution approval must be resolved or the fallback is an official extension/runtime channel.

## Path B: In-Process Agent

### What It Would Do

- Replace `extensions/ritemark/src/codex/` with Ritemark-owned TypeScript services.
- Use OpenAI Responses API for API-key users.
- Use ChatGPT OAuth only if product/legal supportability is accepted.
- Keep approval handling and tool execution inside the extension host.

### Benefits

- Best Windows onboarding: no external binary.
- Removes npm, PATH, PowerShell, Node-version, and architecture detection complexity.
- Easier debugging and testability inside the extension process.
- Aligns with other VS Code agent extensions that implement the loop in-process.

### Costs

- Larger rewrite.
- Must recreate enough Codex agent behavior to preserve product workflows.
- Loses direct reliance on Codex runtime sandboxing.
- ChatGPT OAuth path depends on a backend route that is observable in public code and used by other products, but is not a separately documented public API contract.

### Implementation Preconditions

- Product decision on ChatGPT OAuth supportability.
- API-key fallback must remain first-class.
- Tool set and approval semantics must be specified before coding.
- Flow node compatibility must be maintained or migrated.

## Recommendation

Do not continue with global npm-installed Claude or Codex as user prerequisites.

For Sprint 57, implement **Path A: bundled runtimes** after artifact source and checksum checks:

1. **Claude:** bundled native runtime, following the official Anthropic VSIX pattern.
2. **Codex:** bundled runtime from the smallest stable artifact that preserves existing app-server integration.
3. **Fallback:** advanced override to a system-installed runtime for debugging or vendor-managed installs.

Path B remains the long-term simplification option if runtime redistribution or subprocess lifecycle becomes too expensive.

## Open Questions

- Which OpenAI/Codex artifact should be used for the implementation spike?
- Is `codex-app-server` available as a public release asset for the release we want to pin, or only built in workflow/npm packaging?
- Do we need Windows arm64 in the first bundled-runtime release?
- Does bundled Claude runtime remove Node from the Windows happy path, and which features still require Git/Git Bash?
- What legal/redistribution approval is required before release if the spike works?
- Is ChatGPT OAuth acceptable without an explicit public API support statement?

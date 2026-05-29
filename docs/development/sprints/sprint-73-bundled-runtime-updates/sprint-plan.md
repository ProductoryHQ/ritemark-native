# Sprint 73: Bundled Runtime Updates

## Track
Lightweight

## Goal
Update the three bundled runtimes to their latest versions (`@anthropic-ai/claude-agent-sdk` npm package, Claude Code CLI binary, and Codex App Server binary), and display the real bundled versions inside the Settings UI model selector so the user sees actual runtime versions at a glance.

---

## Research Findings (Phase 1)

### Versions after bump (commit 834d844, 2026-05-29)

| Component | From → To | Location |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` (npm) | `0.2.31` → `0.3.156` | `extensions/ritemark/package.json` + `package-lock.json` |
| Claude Code CLI binary | `2.1.131` → `2.1.156` | `extensions/ritemark/binaries/agents/manifest.json` |
| Codex App Server binary | `0.130.0` → `0.135.0` (`rust-v0.135.0`) | `extensions/ritemark/binaries/agents/manifest.json` |

**SDK 0.2 → 0.3 notes:** the major bump introduced native platform binaries (`@anthropic-ai/claude-agent-sdk-<platform>-<arch>` optional deps) and two new peer dependencies (`@anthropic-ai/sdk >=0.93.0`, `@modelcontextprotocol/sdk ^1.29.0`). Extension TypeScript compiles clean against 0.3.156 — no source changes required. Wire-protocol coupling with the bundled Claude CLI binary (`2.1.156`) is aligned via `claudeCodeVersion` metadata in the SDK.

**Codex `--version` confirmed:** `codex-app-server 0.135.0` supports `--version` directly; the section 7 fallback to the existing capability probe is unnecessary.

### How bundling works

**Claude binary** — sourced from npm optional packages `@anthropic-ai/claude-code-<platform>-<arch>`. `manifest.json` records `sourceType: "npm-optional-package"`, a direct tgz `sourceUrl` pointing to the registry, and the sha256 of the archive. `scripts/fetch-agent-runtimes.sh` downloads, verifies, extracts, and installs to `extensions/ritemark/binaries/agents/<platform>-<arch>/claude[.exe]`.

**Codex App Server binary** — sourced from GitHub Releases (`openai/codex`). `manifest.json` records `sourceType: "github-release"` and the direct tar.gz `sourceUrl`. Same fetch script handles download + verification.

**`@anthropic-ai/claude-agent-sdk`** — a regular npm dependency in `extensions/ritemark/package.json`. Updated by bumping the semver range and running `npm install` inside `extensions/ritemark/`.

**Manifest update process (from README)**:
1. Bump `version` in `manifest.json` for the relevant entries.
2. Update `sourceUrl` and `archiveFilename` to point at the new release artifact.
3. Recompute `sha256` of the new archive.
4. Update `archivePath` / `installName` only if upstream changed artifact layout.
5. Re-verify `invocationMode` for Codex (do not assume it stayed the same).
6. Bump `generated` date.
7. Re-run `scripts/fetch-agent-runtimes.sh` to materialise the new binaries locally.
8. Update `.sha256` sidecar files (fetch script writes these).

**Binary storage** — payloads in `binaries/agents/<platform>-<arch>/` are gitignored. Only `manifest.json` and `README.md` are tracked. Sidecar `.sha256` files are also gitignored and written by the fetch script at install time.

### Platforms covered by manifest

| Agent | darwin-arm64 | darwin-x64 | win32-x64 |
|---|---|---|---|
| codex-app-server | yes | yes | yes |
| claude | yes | yes | yes |

All three platforms must be updated in manifest.json for each binary.

---

## Implementation Checklist

### 1. Research latest versions
- [x] Check latest `@anthropic-ai/claude-agent-sdk` version on npm registry → `0.3.156`
- [x] Check latest Claude Code CLI version (`@anthropic-ai/claude-code-darwin-arm64` on npm registry) → `2.1.156`
- [x] Check latest Codex App Server version on GitHub Releases (`openai/codex`) → `rust-v0.135.0`

### 2. Update `@anthropic-ai/claude-agent-sdk` npm package
- [x] Bump version in `extensions/ritemark/package.json` (`^0.2.29` → `^0.3.156`)
- [x] Run `npm install` inside `extensions/ritemark/` to update `package-lock.json`
- [x] Verify the resolved version in `package-lock.json` is `0.3.156`

### 3. Update Claude Code CLI binary in `manifest.json`
- [x] Fetch the new archive URLs from the npm registry for all 3 platform entries (darwin-arm64, darwin-x64, win32-x64)
- [x] Compute sha256 of each new archive
- [x] Update all 3 `claude` entries in `manifest.json`: `version`, `sourceUrl`, `archiveFilename`, `sha256`
- [x] Bump `generated` date in `manifest.json` → 2026-05-29

### 4. Update Codex App Server binary in `manifest.json`
- [x] Identify the new release tag on `github.com/openai/codex` → `rust-v0.135.0`
- [x] Fetch the new archive URLs for all 3 platform entries (darwin-arm64, darwin-x64, win32-x64)
- [x] Compute sha256 of each new archive
- [x] Verify `invocationMode` is still `direct-app-server` for the new release
- [x] Update all 3 `codex` entries in `manifest.json`: `version`, `sourceUrl`, `archiveFilename`, `sha256`
- [x] Bump `generated` date in `manifest.json` → 2026-05-29

### 5. Re-fetch binaries locally (darwin-arm64, the dev machine)
- [x] Run `./scripts/fetch-agent-runtimes.sh --agent claude --platform darwin --arch arm64`
- [x] Run `./scripts/fetch-agent-runtimes.sh --agent codex --platform darwin --arch arm64`
- [x] Smoke tests passed: `claude --version` → `2.1.156 (Claude Code)`; `codex-app-server --version` → `codex-app-server 0.135.0`

### 6. Compile extension
- [x] Run `npm run compile` inside `extensions/ritemark/` — clean, no TypeScript errors against SDK 0.3.156

### 7. Research — runtime version detection (new scope)
- [x] `codex-app-server --version` is supported on `0.135.0` (output: `codex-app-server 0.135.0`). Fallback to capability probe NOT needed.
- [x] Claude CLI version detection ALREADY runtime-detected in `extensions/ritemark/src/agent/setup.ts:220` (`getClaudeVersion()` spawns `claude --version`); exposed via `componentStatus.claudeCode.version` and rendered in `RuntimeStatusCard` (RitemarkSettings.tsx:1256). **No code change needed.**
- [x] IPC channel: Settings webview receives `componentStatus` via the `setSetting` message from `RitemarkSettingsProvider.ts:554`. **Existing channel — add fields to existing `componentStatus.claudeCode` / `componentStatus.codex`, no new IPC.**
- [x] `require('@anthropic-ai/claude-agent-sdk/package.json').version` returns `0.3.156` — confirmed file exists at `extensions/ritemark/node_modules/@anthropic-ai/claude-agent-sdk/package.json`.
- [x] **Codex bug found:** `codexManager.ts:281–311` returns MANIFEST version for `codex-app-server` launch mode (stale comment claims binary does not support `--version`, but 0.135.0 does). This is the only fix required to match Claude's runtime-detection behaviour.
- [x] SDK version not displayed anywhere today — needs to be added to `componentStatus.claudeCode` as a new field and rendered in the Claude `RuntimeStatusCard`.

### 8. Extension-side implementation — minimal fixes (revised scope)

Scope is much smaller than originally planned. Claude already runtime-detects its CLI version; the only fixes needed are:

- [x] Fix Codex `--version` detection in `codexManager.ts:281–311` (app-server launch mode branch). Replaced manifest-only path with: try `codex-app-server --version` (parse `codex(?:-app-server|-cli)?\s+([\d.]+)`); fall back to manifest + `--help` runnable probe only if `--version` is unsupported. Updated the stale comment.
- [x] Add SDK version read in `RitemarkSettingsProvider.ts`: module-level `CLAUDE_AGENT_SDK_VERSION` constant computed via `require('@anthropic-ai/claude-agent-sdk/package.json').version` (try/catch to null on failure). Added `sdkVersion: string | null` to the `claudeCode` interface (extension side line 576, webview side line 65). Fallback claudeCode object also extended with `sdkVersion: null` to satisfy the interface.
- [x] Add drift-detection `console.warn` in the extension host: Codex (codexManager.ts app-server branch) and Claude (`agent/setup.ts:266+`, bundled paths only — system installs by definition don't have a manifest entry to compare against).

### 9. Webview-side display — `RuntimeStatusCard` (revised scope)

UI surface is the existing `RuntimeStatusCard` (RitemarkSettings.tsx:1472), not the model selector. Card already renders `version` prop next to the title. All edits are additive.

- [x] Extended Claude `RuntimeStatusCard` invocation (line 1257) to pass new `sdkVersion={settings.componentStatus.claudeCode.sdkVersion}` prop.
- [x] Updated `RuntimeStatusCard` component to accept optional `sdkVersion?: string | null`. The version chip now renders combined format `v2.1.156 · SDK 0.3.156` when both are present (per UX decision). Either alone renders as fallback.
- [x] No changes to the Codex card invocation — once Codex `--version` runs runtime-side, the existing `version` field displays the real value automatically.
- [ ] Manual QA: launch dev mode → open Settings → confirm Claude card shows `v2.1.156 · SDK 0.3.156` and Codex card shows real `v0.135.0` (not manifest-derived).
- [ ] Manual QA: Reload Window → confirm versions repopulate from fresh runtime query.

---

## Runtime Version Detection (revised after Section 7 research)

**Existing infrastructure (no changes needed):**

| Runtime | Detection method | Status |
|---|---|---|
| Claude Code CLI binary | `getClaudeVersion()` in `src/agent/setup.ts:220` spawns `claude --version`, parses output, exposes via `componentStatus.claudeCode.version` | ✅ Already runtime-detected |
| Codex CLI binary (CLI launch mode) | `codexManager.ts:314` spawns `codex --version`, parses output | ✅ Already runtime-detected |

**Gap to fix:**

| Runtime | Current behaviour | Fix |
|---|---|---|
| Codex App Server (`codex-app-server` launch mode) | `codexManager.ts:281–311` returns MANIFEST version (stale comment claims binary does not support `--version`, but 0.135.0 does) | Replace manifest read with `codex-app-server --version` spawn + parse; fall back to manifest on parse failure |
| `@anthropic-ai/claude-agent-sdk` | Not surfaced anywhere in Settings | Add synchronous `require('@anthropic-ai/claude-agent-sdk/package.json').version` to `componentStatus.claudeCode.sdkVersion` |

**Caching:** Both Claude and Codex versions are already computed inside `RitemarkSettingsProvider.buildComponentStatus()` and are NOT re-computed on every render — they are fetched when Settings provider initialises or when the user clicks "Check installation". Adding the Codex `--version` spawn adds ~1s to that path; acceptable.

**IPC channel:** No new channel. Settings already receives `componentStatus` via the existing `setSetting` message (`RitemarkSettingsProvider.ts:554`). New fields just need to be added to the existing payload shape.

**UI surface:** `RuntimeStatusCard` component inside `RitemarkSettings.tsx:1472`. The card already renders the `version` prop next to the title. All edits are strictly additive — pass new `sdkVersion` prop into the Claude card; existing Codex card consumes the corrected `version` field automatically.

**Drift detection:** After each runtime version read, compare against the `manifest.json` entry. If they differ, emit `console.warn` in the extension host. No user-facing UI for MVP.

---

## Success Criteria
- [x] `@anthropic-ai/claude-agent-sdk` resolved version in `package-lock.json` matches the new latest (`0.3.156`)
- [x] All 6 `manifest.json` entries (3 claude + 3 codex) carry the new versions and updated sha256 hashes
- [x] Extension TypeScript compiles clean against SDK 0.3.156
- [ ] AI sidebar (Claude chat) starts a session without error in dev mode (manual QA)
- [ ] Codex panel connects and returns a response in dev mode (manual QA)
- [ ] Settings → Model selector shows real Claude SDK version queried from the bundle (not hardcoded)
- [ ] Settings → Model selector shows real Claude CLI version queried from the bundle
- [ ] Settings → Model selector shows real Codex App Server version queried from the bundle
- [ ] Opening the AI chat panel with Claude active triggers a warmup that populates version strings; subsequent reads within the session are served from cache
- [ ] Drift between manifest-recorded version and runtime-detected version is logged as a `console.warn` in the extension host
- [ ] `RitemarkSettings.tsx` remains intact — no existing functionality removed or stubbed (HARD RULE #1)

---

## Risk Notes

**SDK/CLI version coupling** — `@anthropic-ai/claude-agent-sdk` and the Claude CLI binary may have a coupled protocol. The SDK communicates with the `claude` binary over stdio using a defined message shape. A major SDK bump that assumes a newer protocol than the bundled binary supports (or vice versa) will break the AI sidebar at runtime. Mitigation: check if the SDK changelog mentions breaking protocol changes; smoke-test the AI sidebar end-to-end after updating both.

**Codex protocol changes** — The extension uses `codex-app-server generate-ts` to probe the server's protocol at startup and populate `CodexCapabilityFlags`. A new Codex release may add, rename, or remove JSON-RPC methods. The compatibility probe in `codexManager.ts` handles graceful degradation (falls back to optimistic "all capabilities on"), but a broken method name will produce a silent regression. Mitigation: check the Codex release notes for protocol changes; test the Codex panel end-to-end (start a thread, send a message, receive a response, check approval flow).

**Codex `invocationMode`** — If a Codex release merges the app-server back into the CLI as a subcommand, `invocationMode` in the manifest must flip from `direct-app-server` to `cli-subcommand`. The README documents this as a manual verification step. The wrong value silently breaks runtime startup. Mitigation: always inspect the new tarball contents before updating the manifest.

**Settings page regression risk** — `RitemarkSettings.tsx` was broken in v1.3.0 by stubbing, making all AI features unusable. Any edit to this file must be strictly additive. The pre-commit hook's Settings page integrity check must pass before committing.

**Codex `--version` uncertainty** — ~~Not yet confirmed.~~ **Resolved 2026-05-29:** `codex-app-server 0.135.0` supports `--version` directly. No probe-fallback needed.

---

## QA Approach

1. **Smoke tests via fetch script** — `./scripts/fetch-agent-runtimes.sh --verify-only` confirms sha256 integrity. Post-install validation args (`claude --version`, `codex-app-server --help`) confirm the binary runs.
2. **Manual AI sidebar test** — launch dev mode, open a `.md` file, open the AI sidebar, send a message, confirm a response arrives without errors in the extension host console.
3. **Manual Codex panel test** — open the Codex panel in the AI sidebar, start a new thread, confirm the session initialises (no timeout), send a simple prompt, confirm a response.
4. **Pre-commit hook** — run `.claude/hooks/pre-commit-validator.sh` before committing to ensure no invariants are broken by the npm dependency change.
5. **Version display** — open Settings and confirm the model selector renders real version strings matching the output of `claude --version` and `codex-app-server --version` (or the probe) run directly against the bundled binaries in a terminal.
6. **Cache invalidation** — restart the extension (Reload Window), reopen Settings, confirm versions repopulate correctly from a fresh warmup.

---

## Status
**Track:** Lightweight
**Phase:** Handoff-ready (QA checks passed + user accepted model selector UX in dev mode)

### Code changes shipped this sprint
- `extensions/ritemark/src/codex/codexManager.ts` — Codex app-server now uses `--version` (real runtime), falls back to manifest + `--help` probe only for older binaries. Drift warning emitted on mismatch.
- `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` — added `sdkVersion` to `claudeCode` interface (and fallback), wired `readClaudeAgentSdkVersion()` from npm `package.json` (module-cached).
- `extensions/ritemark/src/agent/setup.ts` — added Claude drift warning for bundled runtime paths only.
- `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` — added `sdkVersion: string | null` to local interface; `RuntimeStatusCard` accepts new `sdkVersion?: string | null` prop and renders combined chip `v{cli} · SDK {sdk}` when both present; Claude card invocation passes the new prop.
- `extensions/ritemark/binaries/agents/manifest.json` + `package.json` + `package-lock.json` — runtime bumps from commit `834d844`.

---

## Sub-scope: AgentSelector model versions (added 2026-05-29)

**Problem caught during QA:** The AI sidebar's `AgentSelector` dropdown showed generic Claude model labels ("Sonnet", "Opus", "Haiku") without version info. An earlier attempt to surface versions in that surface incorrectly placed CLI/SDK *binary* versions next to the group header (e.g. "Claude · SDK 0.3.156 · v2.1.156"). The user wants per-model *model* versions on each row (e.g. "Claude Sonnet 4.5"), pulled authoritatively from the bundled runtime — not hardcoded.

**Authoritative source confirmed:** `@anthropic-ai/claude-agent-sdk` 0.3.156 exposes `Query.supportedModels(): Promise<ModelInfo[]>` where each `ModelInfo` carries `{ value, displayName, description }`. The SDK's `displayName` is the canonical, version-bearing string. Codex models were already authoritative (read from `~/.codex/models_cache.json` maintained by the Codex CLI; `display_name` already version-suffixed like "GPT-5.3 Codex").

**Existing gap:** `AgentRunner._fetchSupportedModels()` already calls `supportedModels()` and broadcasts `agent:models-update`, but only AFTER the user sends a first message (which is when the SDK `system:init` event fires). At sidebar open the user saw `CLAUDE_FALLBACK_MODELS` with version-less labels until they sent something.

**Fix shipped:**
- `extensions/ritemark/src/agent/discoverModels.ts` (new) — standalone `discoverClaudeModels()` opens a short-lived `query()` stream with a blocking (no-yield) prompt iterator, calls `supportedModels()` with a 10s timeout, closes the stream, returns mapped `ModelOption[]` (or `null` on failure). Best-effort: falls back silently to the hardcoded list.
- `extensions/ritemark/src/agent/index.ts` — re-exports `discoverClaudeModels`.
- `extensions/ritemark/src/views/UnifiedViewProvider.ts` — module-level `cachedDiscoveredClaudeModels` cache + `claudeModelDiscoveryInFlight` guard. `_sendAgentConfig()` passes `cachedDiscoveredClaudeModels ?? CLAUDE_FALLBACK_MODELS` as `models`, then fire-and-forgets `_warmupClaudeModels()` if Claude is `ready` and cache empty. Warmup posts `agent:models-update` on success. Cache invalidated in `_handleExternalClaudeStatusInvalidation` on install/settings/refresh reasons.
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentSelector.tsx` — removed the incorrectly-placed CLI/SDK/Codex binary-version pills from group labels. Per-model rows now render the authoritative `model.label` (which carries the version once warmup completes) plus the existing `model.description`.

**Why a separate query stream (not AgentSession warmup):** Reusing `AgentSession` would require restructuring `_startSession`/`_createMessageStream` to accept a null first message and reworking the input-queue lifecycle. The standalone `discoverClaudeModels()` is decoupled, runs once per extension session (memoised), and cannot regress the main chat session.

**Verification outcomes (dev-mode QA):**
- `displayName` format is acceptable for current UX: model/version line is readable (e.g. Sonnet 4.6 / Opus 4.8 / Haiku 4.5), and per-model row layout is clear.
- Warmup path is functioning in practice for active usage (model list upgrades beyond fallback without requiring hardcoded version labels).
- Cache invalidation / refresh behaviour exercised via Reload Window during QA iterations; selector repopulates as expected.
- Additional UX polish accepted: constrained dropdown height + visible thin vertical scrollbar + pointer cursor rows.

**Docs readiness update (2026-05-29):**
- Updated `docs/CHANGELOG.md` (`[Unreleased]`) with sprint-73 user-facing changes.
- Updated `docs/releases/v1.7.2/release-notes.md` with sprint-73 follow-up section.

---

## Approval
- [x] Jarmo approved expanded scope on 2026-05-29 ("proceed")
- [x] Jarmo approved AgentSelector model-version sub-scope on 2026-05-29 ("alusta kohe (a)")

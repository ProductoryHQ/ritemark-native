# Sprint 73: Bundled Runtime Updates

## Track
Lightweight

## Goal
Update the three bundled runtimes to their latest versions: `@anthropic-ai/claude-agent-sdk` npm package, Claude Code CLI binary, and Codex App Server binary.

---

## Research Findings (Phase 1)

### Current versions (as of 2026-05-29)

| Component | Current version | Location |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` (npm) | `0.2.31` (lock) / `^0.2.29` (declared) | `extensions/ritemark/package.json` + `package-lock.json` |
| Claude Code CLI binary | `2.1.131` | `extensions/ritemark/binaries/agents/manifest.json` |
| Codex App Server binary | `0.130.0` (`rust-v0.130.0`) | `extensions/ritemark/binaries/agents/manifest.json` |

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
- [ ] Check latest `@anthropic-ai/claude-agent-sdk` version on npm registry
- [ ] Check latest Claude Code CLI version (`@anthropic-ai/claude-code-darwin-arm64` on npm registry)
- [ ] Check latest Codex App Server version on GitHub Releases (`openai/codex`)

### 2. Update `@anthropic-ai/claude-agent-sdk` npm package
- [ ] Bump version in `extensions/ritemark/package.json` (update `^0.2.29` to the new range)
- [ ] Run `npm install` inside `extensions/ritemark/` to update `package-lock.json`
- [ ] Verify the resolved version in `package-lock.json` is the expected new version

### 3. Update Claude Code CLI binary in `manifest.json`
- [ ] Fetch the new archive URLs from the npm registry for all 3 platform entries (darwin-arm64, darwin-x64, win32-x64)
- [ ] Compute sha256 of each new archive
- [ ] Update all 3 `claude` entries in `manifest.json`: `version`, `sourceUrl`, `archiveFilename`, `sha256`, `archivePath` (if changed)
- [ ] Bump `generated` date in `manifest.json`

### 4. Update Codex App Server binary in `manifest.json`
- [ ] Identify the new release tag on `github.com/openai/codex`
- [ ] Fetch the new archive URLs for all 3 platform entries (darwin-arm64, darwin-x64, win32-x64)
- [ ] Compute sha256 of each new archive
- [ ] Verify `invocationMode` is still `direct-app-server` for the new release
- [ ] Update all 3 `codex` entries in `manifest.json`: `version`, `sourceUrl`, `archiveFilename`, `sha256`, `archivePath` (if changed)
- [ ] Bump `generated` date in `manifest.json`

### 5. Re-fetch binaries locally (darwin-arm64, the dev machine)
- [ ] Run `./scripts/fetch-agent-runtimes.sh --agent claude --platform darwin --arch arm64`
- [ ] Run `./scripts/fetch-agent-runtimes.sh --agent codex --platform darwin --arch arm64`
- [ ] Confirm both smoke tests pass (`claude --version`, `codex-app-server --help`)

### 6. Compile extension
- [ ] Run `npm run compile` inside `extensions/ritemark/`
- [ ] Confirm no TypeScript errors

---

## Success Criteria
- [ ] `@anthropic-ai/claude-agent-sdk` resolved version in `package-lock.json` matches the new latest
- [ ] All 6 `manifest.json` entries (3 claude + 3 codex) carry the new versions and updated sha256 hashes
- [ ] `./scripts/fetch-agent-runtimes.sh --verify-only` passes for darwin-arm64
- [ ] Extension TypeScript compiles clean
- [ ] AI sidebar (Claude chat) starts a session without error in dev mode
- [ ] Codex panel connects and returns a response in dev mode

---

## Risk Notes

**SDK/CLI version coupling** — `@anthropic-ai/claude-agent-sdk` and the Claude CLI binary may have a coupled protocol. The SDK communicates with the `claude` binary over stdio using a defined message shape. A major SDK bump that assumes a newer protocol than the bundled binary supports (or vice versa) will break the AI sidebar at runtime. Mitigation: check if the SDK changelog mentions breaking protocol changes; smoke-test the AI sidebar end-to-end after updating both.

**Codex protocol changes** — The extension uses `codex-app-server generate-ts` to probe the server's protocol at startup and populate `CodexCapabilityFlags`. A new Codex release may add, rename, or remove JSON-RPC methods. The compatibility probe in `codexManager.ts` handles graceful degradation (falls back to optimistic "all capabilities on"), but a broken method name will produce a silent regression. Mitigation: check the Codex release notes for protocol changes; test the Codex panel end-to-end (start a thread, send a message, receive a response, check approval flow).

**Codex `invocationMode`** — If a Codex release merges the app-server back into the CLI as a subcommand, `invocationMode` in the manifest must flip from `direct-app-server` to `cli-subcommand`. The README documents this as a manual verification step. The wrong value silently breaks runtime startup. Mitigation: always inspect the new tarball contents before updating the manifest.

---

## QA Approach

1. **Smoke tests via fetch script** — `./scripts/fetch-agent-runtimes.sh --verify-only` confirms sha256 integrity. Post-install validation args (`claude --version`, `codex-app-server --help`) confirm the binary runs.
2. **Manual AI sidebar test** — launch dev mode, open a `.md` file, open the AI sidebar, send a message, confirm a response arrives without errors in the extension host console.
3. **Manual Codex panel test** — open the Codex panel in the AI sidebar, start a new thread, confirm the session initialises (no timeout), send a simple prompt, confirm a response.
4. **Pre-commit hook** — run `.claude/hooks/pre-commit-validator.sh` before committing to ensure no invariants are broken by the npm dependency change.

---

## Status
**Track:** Lightweight
**Phase:** Plan — awaiting approval

---

## Approval
- [ ] Jarmo approved this sprint plan

# Runtime review for v2.1.0 (A4)

Reviewed on 26 October 2026 for Sprint 141 (R11, decision 8). It compares the runtimes 2.0.1 ships (`binaries/agents/manifest.json`, the Agent SDK pin) with npm `latest`, and for Codex with its latest GitHub release. It covers:
- each changelog;
- the SDK's type declarations (0.3.304 against 0.3.310);
- Codex's source at both tags (`codex-rs`, the release workflow, the macOS signing scripts);
- OpenCode's commits between the tags.

Ritemark's calls into each runtime (`src/agent`, `src/codex`, `src/acp`) were read against them. The update itself, with its measured values, is recorded in *Verified at the update* below and in `docs/development/agent-runtime-compatibility.md`.

## Versions

| Package | 2.0.1 | Latest on 26 October | Published in between |
|---|---|---|---|
| `@anthropic-ai/claude-code` | 2.1.304 | **2.1.310** (23 Oct) | 2.1.305 to 2.1.310. `stable` is 2.1.308; 2.1.311 is `next` (26 Oct), not reviewed |
| `@anthropic-ai/claude-agent-sdk` | 0.3.304 | **0.3.310** | The same numbers |
| Codex (`rust-v*`) | 0.163.0 | **0.164.0** (23 Oct) | None |
| `opencode-ai` | 1.19.3 | **1.19.4** (22 Oct) | None |
| `@agentclientprotocol/sdk` | 1.4.0 | 2.0.2 | A major version; not part of this review (decision 8) |

## Review

### Claude Code and the Agent SDK

| Version | Change that touches Ritemark | Risk |
|---|---|---|
| 2.1.305 | Fixes a 2.1.304 regression where every request failed on gateways that reject tool search; `setMcpServers` servers are no longer replaced by a same-named user server | Low; the update fixes it |
| 2.1.306 | API errors no longer shown as "prompt is too long" in sessions with many MCP tools | Low |
| 2.1.307 | `setModel()` waits up to 15 s instead of 5 s (the composer's model switch); a turn no longer starts without an SDK MCP server's latest tools while a background task runs | Low |
| 2.1.308 | "Bug fixes"; in the binary, the built-in fallback aliases move to the 5.5 models (the main alias table was already sonnet → `claude-sonnet-5-5`, haiku → `claude-haiku-5-5`) | Low |
| 2.1.309 | Stricter Bash permission checks: a compound `cd` + git command asks, an Edit deny blocks Bash redirects, and `sed -i` gets an ordinary Bash approval instead of a file-edit preview | Medium: `canUseTool` is asked more often, and the approval card's shape changes for `sed -i` |
| 2.1.310 | With telemetry or nonessential traffic off, the Monitor tool is available and long foreground sleeps are blocked; lower compaction memory in SDK sessions | Low |

- **The SDK's API** (`sdk.d.ts`, 0.3.304 against 0.3.310) is additive only. Every identifier Ritemark uses appears unchanged:
  - `task_started`, `task_notification`, `background_tasks_changed`;
  - `stopTask`, `supportedModels`, `interrupt`;
  - `modelPicker`, `canUseTool`, `settingSources`.
- **The SDK's package** splits its code into four `core-*.mjs` chunks instead of two. Ritemark ships the whole package as an esbuild external (`esbuild.config.mjs`), and no staging script names a chunk, so nothing in the harness changes. Because it is an external, the update reaches users only with a shell release.
- **To re-check after the update:**
  - the model listing (Sprint 127's probe), because 2.1.308 moved the fallback aliases;
  - an approval card for a `sed -i` and a compound command, where a Claude sign-in exists;
  - Sprint 128's background probes, which need Jarmo's Claude sign-in.

### Codex

| Area | Change in 0.164.0 | Risk |
|---|---|---|
| JSON-RPC | Additive only: `thread/sample` and `thread/sample/cancel` (experimental), `feedback/save`. No method Ritemark uses is removed or renamed | Low |
| Resume | A resumed thread keeps its saved service tier, reasoning summary and personality unless the caller overrides them (#55923); compressed rollouts are found on resume (#54008). `approvalPolicy` and `sandbox` handling is unchanged | Low; S46 re-checks Sprint 139's R6 |
| Models | The built-in model list is identical; the `models_cache.json` code is unchanged; the catalog reloads after an account change (#54169) | Low |
| Wire shapes | `PlanType` adds `sci` and `sci_plus`; `ImageGenerationItem.result` may be a `fileId`; `McpServerStatus.toolListMeta` | Low: Ritemark reads `planType` as a string |
| Defaults turned on | `mcp_oauth_refresh_coordination` (#55701), `incremental_tools` (#55368) | Medium, below |
| Package | `scripts/codex_package/*` and the release asset names are unchanged; the members stay `bin/codex-app-server`, `bin/codex-code-mode-host`, `codex-package.json`, `codex-path/rg`, plus the Windows `codex-resources/*.exe` | Low; the fetch checks the exact members |

### OpenCode

- 1.19.4 has five commits. None touch ACP, permissions, MCP or model listing; `@modelcontextprotocol/sdk` stays at 1.29.0.
- It moves to Bun 1.4.4, with security fixes for TLS, HTTP and `fetch`.
- The binary grows: darwin-arm64 from 144.6 to 180.8 MB unpacked; Windows from 181.0 to 211.7 MB.
- Risk is low to medium, because of the runtime bump. OpenCode's permission gate (the HARD GATE) and a cancel run again in `verify-agent-runtimes.sh`.

## Codex and the keychain (decision 8's addition)

**The history.** Ritemark re-signs `codex-app-server` under its own team at release (`scripts/codesign-app.sh`, step 5c-agents, `codesign --force`). The Keychain items `Codex MCP Credentials` that OpenAI's Codex wrote don't list that signature. So Codex in the installed Ritemark asked for the login password once per item at every start, until "Always Allow" (memory: Codex keychain prompt storm, 8 September; `releases/v2.0.0/sprint-136-release/research/runtime-review.md`).

What 0.164.0 changes, from its source and release workflow:
- **Same signing identity.**
  - The release workflow (`.github/workflows/rust-release.yml`) still signs the app-server with `--identifier codex-app-server`.
  - Every file under `.github/scripts/macos-signing/` is byte-identical between the tags, entitlements included. There is no `keychain-access-groups` entitlement.
  - Ritemark's `--force` re-sign keeps the identifier, so the designated requirement after Ritemark's signing is the same as 0.163.0's: `codex-app-server`, team JKBSC3ZDT5.
  - An "Always Allow" given to 0.163.0's re-signed binary should hold for 0.164.0's.
- **Same items.**
  - The Keychain service names are unchanged: `Codex MCP Credentials` and `Codex Auth`.
  - `keyring-store` and `auth_keyring.rs` are byte-identical.
  - The store defaults are unchanged: `cli_auth_credentials_store = file`, `mcp_oauth_credentials_store = auto`.
  - The enterprise MCP sign-in (#55334, #55859, #56001) uses the same keyring path, and needs a feature that is off by default. Credential masking (#54309, #54432, #56049) has no keyring code and is off by default.
- **One change can add prompts.** #55701 turns `mcp_oauth_refresh_coordination` on by default. A token refresh then re-reads the `Codex MCP Credentials` item under a lock and writes it back.
  - On a Mac where those items don't yet allow Ritemark's signature, the prompt can come at a token refresh as well as at start.
  - Where "Always Allow" was given, the read is allowed.
  - This is read from the code, not tested.

**What can't be tested here.** The prompts come only from a binary re-signed under Ritemark's team, that is, from a signed release build. A dev instance runs OpenAI's own signature. Re-signing a copy and running it against Jarmo's `~/.codex` would raise the dialogs on his screen, which the rules forbid. So the proof belongs to 2.1's signed candidate (Gate 2):
1. Start a ChatGPT chat in the installed candidate on a Mac whose `~/.codex/config.toml` has OAuth MCP servers.
2. Count the prompts at start.
3. Leave the chat open past a token refresh, and count again.

The same rule as 2.0.1 holds: back up `~/.codex/config.toml` byte for byte first, and stop at the first prompt. If 0.164.0 prompts more than 0.163.0 did, the candidate goes back to 0.163.0, or passes `-c features.mcp_oauth_refresh_coordination=false` to the app-server. The override is untested; `codexManager.buildAppServerArgs()` passes no override today. A release plan row records this check.

**On the update** (*Verified at the update*): the downloaded 0.164.0 binary's own identifier is read with `codesign -dv`, so the claim above rests on the binary, not only on the workflow.

## check:anthropic-models

`npm run check:anthropic-models` on `main`, 26 October:

```
Anthropic model catalog v3177, issued 2026-10-26T20:48:32Z, expires 2026-11-02T20:48:32Z.
Bundled Claude Code: 2.1.304.
Main models: Opus 5.5 (claude-opus-5-5, needs 2.1.280+); Sonnet 5.5 (claude-sonnet-5-5); Fable 5.1 (claude-fable-5-1, needs 2.1.251+); Haiku 5.5 (claude-haiku-5-5).
OK: the bundled Claude Code supports every model in Anthropic's Claude Code catalog.
```

There is no new model and no warning. The check runs again after the update and in the candidate's worktree.

## Recommendation (decided: decision 8)

Update all three:
- **Claude Code 2.1.310 with Agent SDK 0.3.310**, not 2.1.311 (`next`). It fixes 2.1.304's gateway regression, and its API changes are additive;
- **Codex 0.164.0.** The protocol is additive and the signing identity unchanged; the keychain check above is a Gate 2 row;
- **OpenCode 1.19.4.** Bun's security fixes, no ACP change.

The ACP SDK stays at 1.4.0. If `latest` moves before the update is written, it stays on these versions. A newer one after the merge is the release's call.

## Sources

- Claude Code: <https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md> (2.1.305 to 2.1.310)
- Agent SDK: <https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md>; `sdk.d.ts` at 0.3.304 and 0.3.310 (unpkg)
- Codex:
  - <https://github.com/openai/codex/releases/tag/rust-v0.164.0>, and `gh api` compare `rust-v0.163.0...rust-v0.164.0`;
  - `codex-rs/rmcp-client/src/oauth.rs`, `codex-rs/login/src/auth/storage.rs`, `codex-rs/config/src/types.rs` and `codex-rs/features/src/lib.rs` at both tags;
  - `.github/workflows/rust-release.yml` and `.github/scripts/macos-signing/` at both tags
- OpenCode: <https://github.com/anomalyco/opencode/releases/tag/v1.19.4> and its compare with v1.19.3
- npm registry (`npm view <package> version time dist-tags`), 26 October 2026

## Verified at the update

Filled in when the manifest moves (W4).

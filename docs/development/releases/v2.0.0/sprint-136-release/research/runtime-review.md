# Runtime review for v2.0.0

Reviewed on 20 October 2026, around 19:40 UTC, for Sprint 136 (R4, D1). It compares the runtimes v1.14.0 shipped (`binaries/agents/manifest.json`, the Agent SDK pin) with npm `latest`, and for Codex with its latest GitHub release. It covers each changelog, Ritemark's calls into each runtime (`src/agent`, `src/codex`, `src/acp`, `src/runtime`) and the manifest harness. Nothing was installed or downloaded, and no manifest value was measured.

## Versions

| Package | v1.14.0 | Latest on 20 October | Published in between |
|---|---|---|---|
| `@anthropic-ai/claude-code` | 2.1.296 | **2.1.304** (19 Oct) | 2.1.299 to 2.1.304. 2.1.297 and 2.1.298 were never published. 2.1.305 came out today as `next`. |
| `@anthropic-ai/claude-agent-sdk` | 0.3.296 | **0.3.304** (19 Oct) | The same numbers. 0.3.305 is `next`. |
| Codex (npm, GitHub `rust-v*`) | 0.162.1 | **0.163.0** (15 Oct) | None. 0.164.0 is an alpha. |
| `opencode-ai` | 1.19.0 | **1.19.3** (16 Oct) | 1.19.1, 1.19.2 |

## Review

| Runtime | Main changes | Risk for Ritemark | Decision |
|---|---|---|---|
| Claude Code and Agent SDK | 2.1.299 fixes a 2.1.296 regression: a headless session could run an approved tool call twice after a restart. SDK MCP tool calls no longer fail or run twice on a reconnect. In 2.1.304, model switches and interrupts no longer wait behind a context check. 2.1.302 turns fork subagents on in SDK sessions, and a subagent's own Agent calls now run in the foreground. MCP allow rules match only the server they name (2.1.299). In 0.3.300, hooks' `updatedInput` is validated, and `canUseTool` is unchanged. | Low. Every `query()` call passes `permissionMode`. Ritemark lists full `mcp__<server>__<tool>` names and answers AskUserQuestion through `canUseTool`. The subagent changes touch the background work Sprint 128 relies on, so its probes must pass again. | Update to **2.1.304 / 0.3.304** |
| Codex | Resuming a thread restores its saved permissions, "while respecting explicit overrides" (#53150). Instant interrupts are on by default (#51812). An incomplete response ends as an error (#53451). **The packages no longer include the patched `zsh`** (#52213). No new default model is named. | Medium, from the package, not the protocol. No JSON-RPC method Ritemark uses is removed, and Ritemark resumes with an explicit `approvalPolicy` and `sandbox`. Ritemark's code never names `zsh`, but the harness does: the Mac manifest rows, `CODEX_MEMBERS` in `validate-agent-runtime-manifest.mjs`, and line 20 of `list-agent-runtime-files.test.mjs`. With `exactArchiveMembers: true`, the fetch fails until the member is dropped. The Windows layout is unchanged. | Update to **0.163.0** and drop `zsh` |
| OpenCode | 1.19.1 ends session sharing. 1.19.2 keeps update checks on 1.x, so OpenCode 2 stays a separate choice. 1.19.3 builds reasoning variants from a model's reasoning options. Nothing on ACP, `session/request_permission` or MCP. | Low. Ritemark uses neither sharing nor update checks, and reads no variants. The permission gate (`OPENCODE_PERMISSION`) runs again as the hard gate. | Update to **1.19.3** |

No breaking change was found. The only extra work is removing Codex's `zsh` member.

## check:anthropic-models

`npx tsx scripts/check-anthropic-model-catalog.ts`, in `extensions/ritemark`:

```
Anthropic model catalog v2736, issued 2026-10-20T19:35:18Z, expires 2026-10-27T19:35:18Z.
Bundled Claude Code: 2.1.296.
Main models: Opus 5.5 (claude-opus-5-5, needs 2.1.280+); Sonnet 5.5 (claude-sonnet-5-5); Fable 5.1 (claude-fable-5-1, needs 2.1.251+); Haiku 5.5 (claude-haiku-5-5).
OK: the bundled Claude Code supports every model in Anthropic's Claude Code catalog.
```

No new model and no warning. The models do not need the update; the fixes do. The check runs again at the dress rehearsal and in the candidate's worktree.

## Node 24 and Electron 43

- No runtime runs on Electron's Node. Claude Code and OpenCode are single executables, and Codex is Rust. Each runs as its own process, as in 1.x.
- On Node 24.18 the extension host runs the Agent SDK and the ACP SDK. SDK 0.3.304 keeps `engines.node >=18`, its peer dependencies and its platform packages. 0.3.300 fixes a Node 24 bug in `importSessionToStore`, which Ritemark does not call. The ACP SDK stays at 1.4.0; its 2.0.0 is a separate decision.
- **Not proven:** an authenticated turn on any runtime in the 1.142 shell (Sprint 135 did not run S27). The first is the dress rehearsal's runtime turn (S18), on the updated runtimes.

## Codex and the keychain

The prompt appears because Ritemark re-signs `codex-app-server` under its own team (`codesign-app.sh`, step 5c-agents), and the `Codex MCP Credentials` items that OpenAI's Codex wrote do not list that signature. Every version Ritemark re-signs has the same identity (`codex-app-server`, team JKBSC3ZDT5). So 0.163.0 should prompt no more than 0.162.1 does, and an earlier "Always Allow" should still hold. 0.163.0's notes do not touch credential storage. This is reasoning, not a test. On the candidate, the ChatGPT turns follow the 19 October rule: back up and restore `~/.codex/config.toml` byte for byte, and stop at any keychain prompt.

## Update steps

After Jarmo's answer, the update goes in the first sprint PR. It follows the release skill's **Claude Code and model currency**, step 2 (`.claude/skills/release/SKILL.md`), for all three runtimes:

1. Manifest rows for darwin-arm64, darwin-x64 and win32-x64, with every value measured by script from the published archives. For Codex, confirm the member list and drop `zsh`.
2. The snapshots in `validate-agent-runtime-manifest.mjs` and its test, and `list-agent-runtime-files.test.mjs`.
3. `npm install --save-exact @anthropic-ai/claude-agent-sdk@0.3.304`.
4. The checks: the validator, `fetch-agent-runtimes.mjs --all-platforms` (12 rows), `tsc` and `npm test`, the Sprint 127 and 128 probes, and `verify-agent-runtimes.sh` with the OpenCode gate. For Codex, also `model/list` in an isolated `CODEX_HOME` and a turn stopped mid-way.
5. A v2.0.0 entry in `agent-runtime-compatibility.md` (pre-commit check 11).

## Recommendation

Update all three, as D1 says: Claude Code 2.1.304 with Agent SDK 0.3.304, Codex 0.163.0 and OpenCode 1.19.3. The review found no breaking change. The Claude update is worth having for its fixes alone, above all the fix for the double run in 2.1.296, the version v1.14.0 ships. Codex needs one harness change, dropping the `zsh` it no longer ships. Its usual risks, the keychain prompt and the Windows sandbox, are checked on the candidates. If `latest` moves before the update is written, the update stays on these versions unless Jarmo says otherwise.

## Sources

- Claude Code: <https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md> (2.1.299 to 2.1.304)
- Agent SDK: <https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md> (0.3.297 to 0.3.304)
- Codex: <https://github.com/openai/codex/releases/tag/rust-v0.163.0>, <https://github.com/openai/codex/pull/52213>, and `scripts/codex_package/layout.py` compared between `rust-v0.162.1` and `rust-v0.163.0`
- OpenCode: <https://github.com/anomalyco/opencode/releases/tag/v1.19.1>, [v1.19.2](https://github.com/anomalyco/opencode/releases/tag/v1.19.2), [v1.19.3](https://github.com/anomalyco/opencode/releases/tag/v1.19.3)
- npm registry (`npm view <package> dist-tags time`), 20 October 2026

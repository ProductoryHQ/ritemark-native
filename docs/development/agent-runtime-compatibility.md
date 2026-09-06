# Agent Runtime Compatibility Matrix

## v1.10.0 service-compatibility correction — 2026-09-03

The bundled Codex `0.149.0` candidate is invalidated. A real GPT-5.6-Sol RUNDEV
turn returned the service's explicit newer-runtime requirement, while the same
runtime also failed to decode the current model catalog's `max` effort value.
This was not an account failure and cannot be repaired by provider fallback.

The release manifest now pins both official Codex components to `0.153.0` on
darwin-arm64, darwin-x64, and win32-x64 with the SHA-256 values published by
OpenAI. The manifest validator and its mutation suite pass. On darwin-arm64,
the fetched `codex-app-server` reports `0.153.0`, the adjacent
`codex-code-mode-host` passes its supported `--help` probe, and both binaries
are native arm64 Mach-O executables.

Generated app-server types were compared from `0.149.0` through `0.153.0` for
the Thread start/resume, Turn start, approvals, user input, account, and model
surfaces Ritemark consumes. Existing fields remain compatible and later fields
are optional/additive. In a fresh isolated RUNDEV profile, Settings reported
`Codex · Ready · Bundled with app · v0.153.0`; selecting GPT-5.6-Sol and sending
a no-write canary returned the requested exact answer. The previous newer-client
and effort-decoding errors were absent. Native darwin-x64/win32-x64 execution,
signed-package validation, and the packaged file create/edit/read canary remain
release gates.

## v1.10.0 release-candidate correction — 2026-08-31

The first signed arm64 candidate exposed a packaging gap that the original
Sprint 111 matrix could not detect: Codex chat started through
`codex-app-server`, but its file tools failed because the version-matched
`codex-code-mode-host` sibling was not bundled. Installed-app renderer logs
recorded `No such file or directory` at the expected sibling path.

OpenAI's official `rust-v0.149.0` release publishes separate
`codex-code-mode-host` archives for darwin-arm64, darwin-x64, and win32-x64.
Manifest schema 2 models required runtime components explicitly. Codex now has
complete `app-server` and `code-mode-host` matrices; Claude and OpenCode each
retain one `runtime` matrix. The validator rejects a missing component, a
duplicate per-target install name, a mismatched version, or an unsupported
smoke argument before any build begins.

All twelve pinned archives fetched on 2026-08-31, matched their recorded
SHA-256, extracted at the recorded path, and matched the target architecture.
On darwin-arm64, `codex-app-server 0.149.0` reports its pinned version and the
adjacent code-mode host starts successfully with its supported `--help` probe.
Native darwin-x64 and win32-x64 execution, signed-package validation, and one
real packaged Codex file edit remain release gates.

## Sprint 111 shipping candidate — 2026-08-24

**Shipping candidate:** Claude Code `2.1.239` (SDK `0.3.239`) · OpenCode `1.18.21` (ACP SDK `1.4.0`) · Codex app-server `0.149.0`.

The exact darwin-arm64 binaries report `2.1.239 (Claude Code)`, `1.18.21`, and `codex-app-server 0.149.0`. All nine then-modeled manifest archives fetched, matched the recorded SHA-256, extracted at the recorded path, and matched the target architecture. This evidence is retained as the historical Sprint 111 baseline; the RC correction above supersedes its runtime-component completeness claim.

| Runtime | Protocol/SDK compatibility | Continuation and isolation | Permission/cancel evidence | Effort capability evidence |
|---|---|---|---|---|
| **Codex 0.149.0** | pass — current app-server lifecycle and `untrusted` policy accepted; `request_user_input.isBlocking` is additive/tolerated; focused compile/tests pass | pass — semantic resume across app-server restart, invalid descriptor rejection, and two-thread isolation | pass — existing unified approval/cancel routing tests; no policy default change | pass — live `model/list` advertises `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
| **Claude 2.1.239 / SDK 0.3.239** | pass — SDK declares exact binary parity; current extension compiles unchanged; hard checked against package/lock/manifest | pass — semantic resume across new subprocesses, invalid-session rejection, and two-session isolation | pass — existing permission/runtime adapter tests; tools denied during live probes | pass — SDK retains model support metadata and `low` through `max` effort types |
| **OpenCode 1.18.21 / ACP 1.4.0** | pass — current adapter compiles unchanged; protocol v1 and session load/resume/list/fork/close advertised | pass — semantic resume, transcript replay, invalid-session rejection, and two-session isolation | pass — live write pauses, denial blocks, approval writes, cancel settles `cancelled`, shared process survives | changed-capability-by-model — no option on the default model; an eligible model exposes semantic category `thought_level` with `low`, `medium`, `high` |

### Sprint 111 hard gates

- `scripts/validate-agent-runtime-manifest.mjs` rejects incomplete platform matrices, floating/mismatched versions, stale vendor metadata, lockfile drift, and Claude binary/SDK patch drift before fetch/build.
- `scripts/fetch-agent-runtimes.sh --all-platforms` passed for all nine then-modeled exact archives (historical; superseded by the twelve-component RC gate above).
- `scripts/verify-agent-runtimes.sh` passed version discovery and all four OpenCode behavioral rows (`gate-pauses`, `gate-denies`, `gate-allows`, `cancel`).
- Target-SDK TypeScript compile and focused Codex/Claude/OpenCode adapter tests pass.
- Redacted live evidence and remaining native-platform boundaries are recorded in the [Sprint 111 audit](./releases/v1.10.0/sprint-111-agent-runtime-refresh/research/runtime-version-audit.md).

## Sprint 100 historical baseline

Evidence for issue #146. Every cell is pass / fail / **changed-behavior** with the evidence that
produced it — not a checkmark. Empty cells are stated as untested rather than assumed.

**Shipping:** Claude Code `2.1.217` (SDK pinned `0.3.217`) · OpenCode `1.18.4` · Codex `0.144.4` (unchanged reference).

Verified on darwin-arm64 against the real bundled binaries. `--version` from the installed copies:
`2.1.217 (Claude Code)`, `1.18.4`, `codex-app-server 0.144.4`.

---

## Hard Gate 1 — OpenCode `OPENCODE_PERMISSION` (SECURITY, ship-blocking)

**VERDICT: GATE HOLDS.** Both directions proven against 1.18.4, not inferred.

| direction | evidence |
|---|---|
| a write **pauses** for host approval | `session/request_permission` fired for the target path in both runs |
| host **denial blocks** the write | denied run: `exists: false`, no file on disk, `wroteViaProxy: false` |
| host approval permits the write | allowed run: `exists: true`, content `BREACH` |

Static confirmation alongside the empirical proof: the env var name (`core/src/flag/flag.ts:69`),
its `edit`/`bash`/`webfetch` schema, and the consuming block (`config/config.ts:545-549`) are
byte-identical between 1.15.13 and 1.18.4.

**Standing risk, NOT introduced by this bump:** if `OPENCODE_PERMISSION` is ever absent, OpenCode's
default ruleset is `"*": "allow"` — no prompt at all. Ritemark's injection is unconditional and last
in the spread (`acpManager.ts`), so the gate holds today, but it *is* the entire gate with no failure
signal. A startup assertion is the right follow-up; it is out of this sprint's scope.

## Main matrix

| Runtime | Startup / version discovery | Model listing + default | Streaming taxonomy | Approval round-trip | Cancel / interrupt | Restart after partial turn | Permission enforcement (fs + shell) |
|---|---|---|---|---|---|---|---|
| **Codex 0.144.4** (reference, unchanged) | pass — `codex-app-server 0.144.4` | pass (Sprint 96) | pass (Sprint 96) | pass (Sprint 96) | pass (Sprint 96) | pass (Sprint 96) | pass (Sprint 96) |
| **Claude 2.1.156 → 2.1.217** | **pass** — fetch arch-check + `--version` smoke test green; `/^([\d.]+)/` still matches `2.1.217 (Claude Code)` | **pass** — `supportedModels()` unchanged; `bundledCatalog` default `claude-sonnet-5` corroborated by SDK 0.3.217's own examples | **pass** — additive only: `SDKMessage` gained 6 variants, lost none; all 7 we branch on survive | **pass** — `canUseTool` + `toolUseID` unchanged; return type widened to `\| null`, which is fail-CLOSED (null blocks the tool) and unreachable from our non-nullable handler | **changed-behavior, no impact** — `interrupt()` now returns a response object instead of void; we discard it | **untested** — no live restart-after-partial-turn run | **pass** — `PermissionMode` union byte-identical; `allowDangerouslySkipPermissions` still required for bypass; no changed default |
| **OpenCode 1.15.13 → 1.18.4** | **pass** — arch-check + `--version` green; protocol version still `1`, so SDK 0.22.1 needs no bump | **changed-behavior** — neither version ships a default model (`configOptions.model.current` undefined in BOTH, verified by running 1.15.13 side by side). Prompting without one: 1.15.13 returned a silent zero-token `end_turn`; 1.18.4 **throws** `No provider available`. Louder is better, but the raw message is useless to a user — now translated (`AcpRuntime.describeAcpTurnError`) | **pass** — `session/update` shapes additive; unknown variants already ignored by the handler's `default:` branch | **pass** — `session/request_permission` fired and honoured in both Hard-Gate-1 runs; request shape additive only (`title`, richer `locations`, `diff` block) | **pass, and it is now REAL** — `session/cancel` implemented in 1.18.4 (upstream `50b4ad89b`). Verified by `verify-agent-runtimes.sh`: cancel sent **mid-stream** (9 chunks already delivered), turn settled `stopReason: cancelled` after 4 more, **process preserved**. On 1.15.13 this answered -32601 and the turn ran to completion | **untested** | **pass** — see Hard Gate 1 |

## Parallel sessions matrix

Sprint 99 made all three runtimes multi-session. This checks the capability survives the bump.

| Runtime | Concurrent streaming (N≥2) | Concurrent approvals, correctly attributed | Cancel-one-of-two | Per-session permission isolation |
|---|---|---|---|---|
| **Codex 0.144.4** | pass — unit coverage: deltas route by `threadId`, orphans dropped | pass — `_requestIdMap` keyed by connection-wide JSON-RPC id | pass — `turn/completed` clears only its own thread | pass — per-conversation approval key |
| **Claude 2.1.217** | **untested live** — one `AgentSession` per conversation with no shared state (audit found no module-level singleton); unit coverage green under the new SDK | **untested live** — pending-approval maps keyed by server-minted `toolUseId` | **untested live** | **untested live** |
| **OpenCode 1.18.4** | **untested live under 1.18.4** — proven on 1.15.13 in the Sprint 99 spike (overlap 1795–2228 ms, 33–36 alternation blocks) | **untested live** | **improved** — cancel is now per-session by protocol, so it cannot affect a sibling; the process-kill that made this dangerous is removed | pass by construction — write-approval state is per session (Sprint 99 C1) |

## Dev-instance validation (2026-07-23)

Jarmo drove the new binaries in a running dev instance. Outcomes:

- **Claude 2.1.217 live turn — CONFIRMED working.** The matrix previously listed this untested; a
  live conversation through Ritemark's actual code path is now confirmed. (Note: on this machine the
  extension resolves Claude to a separately-managed global install that is *also* 2.1.217, so this
  proves the SDK + version pair works end to end, against a binary of the same version, not literally
  the bundled file.)
- **OpenCode Stop mid-turn — confirmed** returning to idle without killing the shared process.
- **Two pre-existing OpenCode gaps surfaced and were fixed** (neither a runtime-bump regression):
  switching a conversation to OpenCode dropped the Claude handoff, and a hung provider turn had no
  timeout and sat at "Starting OpenCode…" forever. Both now fixed with regression tests.
- **A Gemini-via-BYOK turn hung.** Root cause undiagnosed — could not be reproduced without the
  provider key; all six OpenCode Zen free models handled the same large prompt in seconds. The
  timeout fix converts the hang into an actionable error regardless of cause.

## What is NOT proven

Stated plainly rather than left to look green:

- **Restart-after-partial-turn** for both bumped runtimes — no live run.
- **Parallel sessions under the NEW binaries** — the Sprint 99 concurrency evidence was gathered on
  1.15.13 and the pre-bump SDK. Unit coverage passes under the new versions, but nothing drove two
  live concurrent turns against 2.1.217 / 1.18.4.
- **Windows and darwin-x64** — every empirical result here is darwin-arm64. The other platforms are
  covered only by manifest/sha256/URL verification.
- **Claude live turns** — the Claude binary was smoke-tested (`--version`, arch) but no live
  model-backed turn was run against 2.1.217 through Ritemark.

The honest summary: the two ship-blocking questions (Hard Gate 1, and whether `session/cancel` is
real now that the process-kill is gone) are **answered with evidence**. The breadth items are not.

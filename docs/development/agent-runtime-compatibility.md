# Agent Runtime Compatibility Matrix

## v1.12.0 Sprint 127 — Claude Code 2.1.281 / SDK 0.3.281 — 2026-09-24

**Change:** Claude Code `2.1.270` → `2.1.281` with Claude Agent SDK `0.3.270` → `0.3.281`, in lockstep. Codex, OpenCode, ripgrep and ACP are unchanged.

**Why:**
- Anthropic's Claude Code model catalog lists Opus 5.5 with `min_claude_code_version` `2.1.280`, and 2.1.270 does not know the model.
- 2.1.281 is npm `latest` (published 2026-09-23). The npm `stable` tag, 2.1.273, predates Opus 5.5.

Evidence: [Sprint 127 served-catalog audit](./releases/v1.12.0/sprint-127-day-zero-models/research/anthropic-served-catalog.md).

| Check | Result on 2.1.281 / 0.3.281 |
|---|---|
| Manifest rows (darwin-arm64, darwin-x64, win32-x64) | pass. npm integrity, archive SHA-256 and installed SHA-256 were measured from the published packages. `fetch-agent-runtimes.mjs --agent claude --all-platforms` gives PASS for all three targets (hash, safe layout, architecture). |
| Lockstep pins | pass. `validate-agent-runtime-manifest.mjs` approves `2.1.281` / `0.3.281`, and `package.json`, `package-lock.json` and all eight optional SDK platform packages agree. The validator's tests pass (11/11). |
| SDK type surface | pass, additive only. The `sdk.d.ts` diff from 0.3.270 widens unions and adds optional fields and new types (`SDKUsageReport`, `SDKStartupFailureReason`, MCP resource reads, `userSettings` as a settings source, a `highlights` thinking display). Ritemark calls none of the changed methods. `tsc --noEmit` is clean, and the full `npm test` passes. |
| Model listing | pass. `supportedModels()` lists `default`/`sonnet` → `claude-sonnet-5`, `claude-fable-5-1`, `opus` → **`claude-opus-5-5`** and `haiku` → `claude-haiku-4-5-20251001`, all without a declaration. Saved `opus` selections follow the alias to Opus 5.5. |
| Opus 5.5 request shape | pass. Adaptive thinking, `effort: medium` (the model default in Anthropic's catalog) and `max_tokens` 128000. 2.1.281 adds four betas for it that 2.1.270 did not send: `per-turn-control`, `server-side-fallback`, `fallback-credit` and `thinking-binding-controls`. |
| `settings.modelPicker` declaration | pass. Offline smoke with a local API stand-in: a declared id is listed and requested with the declared budget and no tools. |
| Native execution (darwin-arm64, darwin-x64, win32-x64) | **not proven here.** This session ran on linux-x64. `verify-agent-runtimes.sh` refuses unsupported hosts, and its OpenCode checks are unchanged by this bump. The proof comes from Gate 1 (arm64 DMG), Gate 2 (x64 DMG and Windows installer), and PR CI. |
| Authenticated turn on Opus 5.5 | **not proven here.** No credentials were used. A Max subscription session is QA scenario S35. |

Release-manager Step 2b runs `./scripts/verify-agent-runtimes.sh` on the release Mac and adds the **Last verified** line for 2.1.281 here.

Probe evidence: [cli-2.1.281-probes.json](./releases/v1.12.0/sprint-127-day-zero-models/research/evidence/cli-2.1.281-probes.json) and [canary-smoke-2026-09-24.json](./releases/v1.12.0/sprint-127-day-zero-models/research/evidence/canary-smoke-2026-09-24.json).

## v1.11.0 Sprint 116 candidate — 2026-09-13

**Candidate baseline:** Claude Code `2.1.270` with Claude Agent SDK `0.3.270`,
Codex `0.154.0`, OpenCode `1.18.30` with its packaged ripgrep `15.1.0`, and
ACP SDK `1.4.0`.

Manifest schema 3 models complete install trees rather than one archive per
executable. Twelve exact source rows expand to 25 installed files across
darwin-arm64, darwin-x64, and win32-x64. Every archive, member, installed hash,
license, target architecture, executable mode, and sidecar is validated. Codex
preserves the official package tree, including code-mode-host, ripgrep, zsh on
macOS, and both Windows sandbox helpers. OpenCode owns its first-use ripgrep
dependency under `opencode-path` so startup does not depend on the user's PATH.

| Runtime | Adapter result on final pin | Continuation/cancel | Model and effort result | Remaining native evidence |
|---|---|---|---|---|
| **Codex 0.154.0** | pass — current and legacy effort-cache schemas decode; explicit unknown thread events are dropped | pass — final adapter handles immediate Stop, exact completion, and immediate resend | pass — Astra and 5.6 family use canonical IDs with measured effort ranges; stale static sources cannot replace the newer bundled floor | darwin-x64 and win32-x64 execution in PR CI |
| **Claude 2.1.270 / SDK 0.3.270** | pass — exact binary/SDK and all eight optional packages are enforced in lockstep | pass — persistent-session cancellation and immediate follow-up | pass — curated identities are centralized; no adapter change was required | darwin-x64 and win32-x64 execution in PR CI |
| **OpenCode 1.18.30 / ACP 1.4.0** | pass — packaged dependency PATH is scoped to the ACP subprocess | pass within the retained ACP contract tests and canaries | pass — provider routes derive from canonical IDs; account-specific BYOK availability remains release evidence | darwin-x64 and win32-x64 execution in PR CI |

All source archives and installed files passed cross-platform fetch verification.
Native Apple Silicon startup/version probes and the authenticated Codex
file-tool plus immediate Stop/resend canary passed. Direct API/BYOK account
availability, native Intel/Windows execution, and signed-application validation
remain explicit CI/release gates. Detailed evidence is in the
[Sprint 116 audit](./releases/v1.11.0/sprint-116-runtime-model-baseline/research/runtime-model-audit.md).

## v1.10.1 Windows sandbox helpers — 2026-09-08

Measured on Windows 11 x64 (Smart App Control in enforcement) against the
win32-x64 binaries fetched from the v1.10.1 manifest. No runtime version moved:
Codex `0.153.0`, Claude Code `2.1.239`, OpenCode `1.18.21` are unchanged from
v1.10.0. Only components were added.

The v1.10.0 Windows installer shipped Codex with file and exec tools that
failed on every turn in the default `workspace-write` sandbox mode with
`orchestrator_helper_launch_failed: ... program not found`. Codex's Windows
sandbox path spawns `codex-windows-sandbox-setup` and `codex-command-runner`,
published by OpenAI as separate `rust-v0.153.0` artifacts and absent from the
manifest. Setting the sandbox to full access appeared to work only because that
path bypasses the sandbox and never spawns a helper — which is why the gap
survived v1.10.0 validation. Both helpers are win32-x64 only: no darwin build
exists, because on macOS the sandbox is the OS seatbelt rather than a spawned
process. Manifest schema 2 now models platform-scoped components, and the
validator rejects a stray darwin row for either helper.

Neither helper can be smoke-tested. `codex-command-runner` expects a pipe handle
and `codex-windows-sandbox-setup` expects a base64 payload, so both exit
non-zero on `--version` and `--help`. Their manifest rows carry no
`validationArgs`; the fetcher skips the smoke test when that field is empty and
the validator rejects `validationArgs` on them. Presence beside
`codex-app-server` is the check.

`./scripts/verify-agent-runtimes.sh` results on this host:

| Check | Result |
|---|---|
| codex code-mode host installed beside app-server and starts | PASS |
| codex Windows sandbox helpers installed beside app-server | PASS |
| OpenCode: a write pauses for host approval | PASS |
| OpenCode: host denial blocks the write | PASS |
| OpenCode: host approval permits the write | PASS |
| OpenCode: session/cancel honoured, shared subprocess preserved | PASS |

The OpenCode permission gate is a HARD GATE and this is the first time it has
been measured on Windows at all. The harness could not previously run there:
`scripts/lib/verify-opencode.mjs` loaded the ACP SDK through a bare Windows
absolute path, which Node's ESM loader rejects, and each probe removed its temp
workspace on the line after `proc.kill()`, which throws `EBUSY` on Windows
because the directory is still the exiting process's cwd. Both crashes were
reported as three OpenCode gate failures — runtime defects that did not exist.
Fixed in [#262](https://github.com/ProductoryHQ/ritemark-native/pull/262).

**NOT PROVEN on this host** — the run reported three SKIPs, all of the form
"<agent> has no manifest version to compare against" (claude, opencode, codex).
Version discovery was therefore not exercised, and these are recorded as not
proven rather than as passes.

Also not proven here: signed-package validation and the packaged-installer
canary. Both remain release gates and must run against the CI-built installer,
not a local drop-in — the v1.10.0 defect was in packaging, so a local drop-in
proves the wrong thing.

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

# Sprint 100 — Runtime Compatibility Matrix

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
| **OpenCode 1.15.13 → 1.18.4** | **pass** — arch-check + `--version` green; protocol version still `1`, so SDK 0.22.1 needs no bump | **changed-behavior** — neither version ships a default model (`configOptions.model.current` undefined in BOTH, verified by running 1.15.13 side by side). Prompting without one: 1.15.13 returned a silent zero-token `end_turn`; 1.18.4 **throws** `No provider available`. Louder is better, but the raw message is useless to a user — now translated (`AcpRuntime.describeAcpTurnError`) | **pass** — `session/update` shapes additive; unknown variants already ignored by the handler's `default:` branch | **pass** — `session/request_permission` fired and honoured in both Hard-Gate-1 runs; request shape additive only (`title`, richer `locations`, `diff` block) | **pass, and it is now REAL** — `session/cancel` implemented in 1.18.4 (upstream `50b4ad89b`). Spike: `stopReason: cancelled`, streaming stopped (+0 chunks after cancel), **process preserved**. On 1.15.13 this answered -32601 and the turn ran to completion | **untested** | **pass** — see Hard Gate 1 |

## Parallel sessions matrix

Sprint 99 made all three runtimes multi-session. This checks the capability survives the bump.

| Runtime | Concurrent streaming (N≥2) | Concurrent approvals, correctly attributed | Cancel-one-of-two | Per-session permission isolation |
|---|---|---|---|---|
| **Codex 0.144.4** | pass — unit coverage: deltas route by `threadId`, orphans dropped | pass — `_requestIdMap` keyed by connection-wide JSON-RPC id | pass — `turn/completed` clears only its own thread | pass — per-conversation approval key |
| **Claude 2.1.217** | **untested live** — one `AgentSession` per conversation with no shared state (audit found no module-level singleton); unit coverage green under the new SDK | **untested live** — pending-approval maps keyed by server-minted `toolUseId` | **untested live** | **untested live** |
| **OpenCode 1.18.4** | **untested live under 1.18.4** — proven on 1.15.13 in the Sprint 99 spike (overlap 1795–2228 ms, 33–36 alternation blocks) | **untested live** | **improved** — cancel is now per-session by protocol, so it cannot affect a sibling; the process-kill that made this dangerous is removed | pass by construction — write-approval state is per session (Sprint 99 C1) |

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

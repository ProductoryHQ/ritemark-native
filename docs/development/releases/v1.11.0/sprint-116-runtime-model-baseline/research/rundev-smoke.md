# Sprint 116 RUNDEV runtime smoke

**Date:** 2026-09-14<br>
**Branch:** `codex/sprint-116-runtime-model-baseline`<br>
**Host:** macOS darwin-arm64<br>
**Profile:** fresh RUNDEV user-data directory and isolated smoke workspace

## Build and shell identity

The accepted smoke run used a clean VS Code/Ritemark compile after applying the
repository patch stack in the sprint worktree. Before runtime testing, the
compiled output was checked for the Ritemark welcome assets and shell markers.
The launched app showed the Ritemark document surface, Ritemark Agent Chat,
Ritemark Settings, and the Ritemark activity rail.

Two earlier launches were rejected as invalid evidence. The first used the
unpatched VS Code submodule and displayed Code OSS. The second inherited
`VSCODE_SKIP_PRELAUNCH=1` and reused stale compiled output. Neither run is
counted below.

## Runtime matrix

| Runtime | Installed/readiness evidence | RUNDEV interaction | Result |
|---|---|---|---|
| Claude | Settings reported bundled Claude Code `2.1.270`; the sidebar initially showed the correct runtime-installed sign-in recovery state, then an authenticated Sonnet session. | A README turn exercised streaming, a clarification question, and a document edit before returning a completed answer. | Pass for startup, question, file tool, and completion. |
| Codex | Settings reported bundled Codex `0.154.0` ready and the authenticated model picker exposed `GPT-6 Astra`. | Exact response canary returned `RITEMARK_RUNTIME_OK`; a workspace-write turn produced `ritemark-runtime-smoke.txt` with exact bytes `Ritemark runtime tool OK\n`; an active `sleep 20` turn exposed Stop, stopped with `Stopped`, and the next turn returned `AFTER_STOP_OK`. | Pass for startup, streaming completion, file tool, immediate Stop, and resend. |
| OpenCode | The picker first exposed the correct BYOK setup state. After a Gemini key was added, it offered Gemini models and started bundled OpenCode `1.18.30`. | Gemini 3.8 Flash edited README and streamed a final answer, reproducing a false red `Failed` marker. The adapter was fixed to normalize ACP `end_turn` to Ritemark `completed`; a fresh Gemini 3.1 Pro turn then edited README, returned exactly `OPENCODE_UI_OK`, and visibly ended as `Done`. | Pass for startup, streaming completion, file tool, status normalization, and native continuation. Approval and Stop remain separate matrix items. |

## Provider isolation and model presentation

Claude being signed out did not hide or disable Codex. Codex completed all
RUNDEV canaries in the same fresh profile. After credentials were available,
Claude and OpenCode also completed document turns. The model picker showed the
refreshed catalog, including GPT-6 Astra, the GPT-5.6 family, Claude Fable 5.1,
current Gemini choices, and the retained documented Codex fallbacks. OpenCode
truthfully moved from its API-key setup state to authenticated Gemini choices.

## Starred scenario disposition

| Scenario | Evidence/result |
|---|---|
| Candidate table freezes one coherent set | Pass — [runtime-model-audit.md](./runtime-model-audit.md) and [phase-0-recommendation.md](./phase-0-recommendation.md). |
| Complete manifest validates | Pass — schema-v3 validation, 12 source rows, and 25 installed files are covered by [qa-validation.md](./qa-validation.md). |
| Required Codex helper is missing | Pass — negative manifest fixtures reject missing platform helpers. |
| Claude lockstep is enforced | Pass — manifest/package/lockfile validation enforces Claude Code `2.1.270` with Agent SDK `0.3.270`. |
| Codex real canary exercises file tools | Pass — both the captured direct audit canary and this RUNDEV file-tool canary completed. |
| OpenCode negotiates ACP capabilities | Pass for authenticated startup, streaming, file tools, continuation, and completion; approval and Stop remain separate behavior-matrix items. |
| Live discovery and bundled catalog agree | Pass for automated discovery/cache/floor checks and authenticated Claude, Codex, and OpenCode picker presentation. |
| Alias spellings resolve to one picker item | Pass — catalog resolver and presentation tests cover canonical deduplication. |
| Runtime behavior matrix passes | Partial — all three runtimes completed authenticated document turns; the full per-runtime approval, plan, cancel, and failure matrix remains open. |
| Provider failure stays isolated | Pass — Claude was signed out while Codex remained ready and completed turns. |
| Continuation truth is revalidated | Pass within the recorded provider limits in audit fixtures and the live Claude → Codex → OpenCode transcript handoff. |
| Thinking effort is revalidated | Pass in focused mappings/catalog tests and candidate evidence; the live RUNDEV turns used Auto. |
| Every native target proves startup | Partial — darwin-arm64 startup passes; native darwin-x64 and win32-x64 execution await PR CI. |
| Baseline is ready for Sprint 117 | Pending — local implementation and QA pass; issue/PR publication and native CI evidence remain. |

## Observed non-sprint warning

RUNDEV logged an existing product-icon theme warning because the theme declares
numeric font weight `400`, while the VS Code parser expects a string value. The
same source state exists on the base checkout and the Ritemark activity icons
rendered in the accepted smoke run. This is recorded as a separate shell/theme
follow-up rather than folded into the runtime/model baseline.

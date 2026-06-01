# Sprint 76 Tasks — ACP Client + OpenCode BYOK Runtime

> Status legend: tick `[x]` only when the change exists on `sprint-76-acp-opencode`
> (`git diff main...HEAD` shows it). Do not pre-tick.

## Phase 0: Audits + UX prototypes (R1, R2 risk reduction; R3, R6 surface approval) — BEFORE implementation code

### 0a: Technical audits
- [x] Write `research/acp-e2e-audit.md`: drive real `opencode acp` binary with
      `@agentclientprotocol/sdk` test script (Linux binary in remote env — protocol behavior is
      platform-independent; darwin-arm64 binary re-validated during first production build).
      Verify handshake, prompt with BYOK key, fs proxying, permission request, cancel.
      Record ship/fallback/defer decision. **→ DECISION: ship via ACP** (commit 2394e97)
- [x] Resolve R6 mechanism in the audit: how OpenCode receives model selection over ACP.
      **→ `setSessionConfigOption(configId: "model", value: "provider/model")`** (commit 2394e97)
- [x] Write `research/opencode-bundling-audit.md`: binary sizes (all platforms), license/NOTICE
      source, sha256s. Codesign/notarization verification deferred to first production build
      (Gate 2). Record bundle vs first-use-download recommendation (answers spec Q1).
      **→ RECOMMENDATION: bundle (103.7 MB, half of Claude's binary)** (commit bf844d7)

### 0b: UX prototypes (added 2026-06-01 per Jarmo — user-facing surfaces approved before development)
- [x] ux-expert design pass: Settings → BYOK section (key fields, validation states, empty/configured states)
      **→ `research/ux-design-spec.md`** (commit 817dec8)
- [x] ux-expert design pass: agent selector + model picker with OpenCode entries
      (provider-grouped models, "no keys configured" state) **→ same spec** (commit 817dec8)
- [x] Build reviewable HTML prototypes of both surfaces (ritemark-design tokens) under
      `research/prototypes/` **→ index.html + settings.html (S1–S7) + model-picker.html (A1–A6)**
- [ ] Jarmo reviews and approves both prototypes

### 0c: Gate
- [ ] Jarmo's Q1 decision (bundle vs download) based on audit data
- [ ] **⛔ GATE: Jarmo approves spec + audits + prototypes before Phase 1 (CLAUDE.md Sprint Phase 2→3 gate).**

## Phase 1: ACP client core (R1)

- [ ] Add `@agentclientprotocol/sdk` to `extensions/ritemark/package.json` (exact version pin)
- [ ] Write `src/acp/acpTrace.ts`
- [ ] Write `src/acp/acpClient.ts` (spawn, stdio wiring, typed API: newSession/prompt/cancel/dispose)
- [ ] Write `src/acp/acpFsProxy.ts` (fs/read_text_file, fs/write_text_file via vscode.workspace.fs)
- [ ] Write `src/acp/acpManager.ts` (lifecycle, session/update → AgentProgress mapping, error handling)
- [ ] Write `src/acp/index.ts` exports
- [ ] Write `src/acp/acpClient.test.ts` (mock child process, scripted JSON-RPC)
- [ ] `npm test` green for new tests

## Phase 2: Bundling & runtime discovery (R2)

- [ ] Add `'opencode'` to `AgentRuntimeKind` + `executableNames()` in `src/utils/bundledAgentRuntime.ts`
- [ ] Add OpenCode entries (darwin-arm64, darwin-x64, win32-x64) to `binaries/agents/manifest.json`
      with computed sha256
- [ ] Verify/generalize fetch script handles the new entries; run it; binary installs and
      `--version` validation passes
- [ ] Add `'opencode'` to `AgentId` + `AGENTS` registry in `src/agent/types.ts`
      (incl. `requiresApiKey: 'byok'` type extension)

## Phase 3: BYOK keys (R3)

- [ ] SecretStorage helpers for the four BYOK keys (gemini/openai/anthropic/openrouter)
- [ ] Spawn-env injection in `acpManager.ts`
- [ ] Settings page BYOK section (after ux-expert layout review)
- [ ] AI sidebar empty-state "Set up your keys" card + `open-settings-byok` deep link
- [ ] Verify keys never appear in webview messages (trace channel inspection — scenarios.md
      "Keys never leak")

## Phase 4: Approval gating + dispatch + streaming (R4, R5)

- [ ] Write `src/acp/acpApproval.ts` (workspace-root validation, always-allow, webview round-trip)
- [ ] Write `src/acp/acpApproval.test.ts` (approve / reject / auto-reject traversal)
- [ ] Wire `'acp-execute'`, `'acp-cancel'`, `'acp-approval-response'` cases in `UnifiedViewProvider.ts`
- [ ] Normalize ACP + Codex approval payloads to one webview message shape; reuse Codex approval card
- [ ] Progress streaming verified end-to-end in dev mode (text, tool_use, error, cancel ≤ 2s)

## Phase 5: Model selection (R6)

- [ ] `BYOK_PROVIDER_MODELS` in `src/ai/modelConfig.ts`
- [ ] `opencode:` composite values + provider-filtered model list in `AgentSelector.tsx`
- [ ] Model selection mechanism (per Phase 0 audit finding) implemented in `acpManager.ts`

## Phase 6: Feature flag (R7)

- [ ] `'opencode-integration'` flag in `src/features/flags.ts` (experimental, all platforms)
- [ ] Gate: AGENTS registry exposure, AgentSelector entry, Settings BYOK section
- [ ] Verify flag-off hides everything (scenarios.md R7 scenario)

## Phase 7: QA and Closeout

- [ ] Walk every `[x]` above and confirm the code exists on this branch (Discrepancy Detection)
- [ ] Run full manual QA matrix from `scenarios.md` (all features, all negative scenarios)
- [ ] Run focused automated tests (`npm test` in extensions/ritemark)
- [ ] Run `./scripts/validate-qa.sh`
- [ ] qa-validator review (sprint-end commit gate)
- [ ] Add OpenCode MIT text to third-party notices
- [ ] Update `docs/CHANGELOG.md`
- [ ] Update release notes draft for next version
- [ ] Update GitHub issue #52 (close or mark implemented)
- [ ] Update `docs/development/analysis/2026-06-01-third-agent-runtime-research.md` status line
- [ ] Commit and push; open PR `sprint-76-acp-opencode` → `main` for pr-reviewer + Jarmo

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
- [x] Jarmo reviews and approves both prototypes (model picker explicitly approved; Settings
      approved 2026-06-01 "last time I checked it was all good")

### 0c: Gate
- [x] Jarmo's Q1 decision (bundle vs download) based on audit data **→ BUNDLE** (sprint approval)
- [x] **GATE PASSED 2026-06-01: sprint approved by Jarmo ("the sprint is approved, please proceed")**

## Phase 1: ACP client core (R1) — ✅ complete 2026-06-01

- [x] Add `@agentclientprotocol/sdk` to `extensions/ritemark/package.json` (exact version pin: 0.22.1)
- [x] Write `src/acp/acpTrace.ts` (7 lines)
- [x] Write `src/acp/acpClient.ts` (spawn, stdio wiring, typed API: newSession/prompt/setModel/cancel/dispose) (288 lines)
- [x] Write `src/acp/acpFsProxy.ts` (fs/read_text_file, fs/write_text_file via vscode.workspace.fs; mandatory approveWrite callback) (180 lines)
- [x] Write `src/acp/acpManager.ts` (lifecycle, session/update → AgentProgress mapping, OPENCODE_PERMISSION env, 0-token soft error, cancel-as-kill) (266 lines)
- [x] Write `src/acp/index.ts` exports (24 lines)
- [x] Write `src/acp/acpClient.test.ts` + `acpManager.test.ts` (mock child process, scripted JSON-RPC)
- [x] `npm test` green for new tests (all src/ tests pass; webview tests can't run in Linux remote env — EBADPLATFORM on darwin-pinned deps, pre-existing)

## Phase 2: Bundling & runtime discovery (R2) — ✅ complete 2026-06-01

- [x] Add `'opencode'` to `AgentRuntimeKind` + `executableNames()` in `src/utils/bundledAgentRuntime.ts`
- [x] Add OpenCode entries (darwin-arm64, darwin-x64, win32-x64) to `binaries/agents/manifest.json`
      with computed sha256 (sha256 of darwin-arm64 tarball independently re-verified against npm)
- [x] Verify/generalize fetch script handles the new entries (accepts any --agent filter; help text
      updated). NOTE: full fetch + file(1) arch check + `--version` smoke test are Mac-side
      validations (cross-platform entries skip smoke test by design) — exercised at first
      production build on darwin, same as existing claude/codex entries
- [x] Add `'opencode'` to `AgentId` + `AGENTS` registry in `src/agent/types.ts`
      (incl. `requiresApiKey: 'byok'` type extension; label "OpenCode" per Q2)

## Phase 3: Provider keys for OpenCode (R3a — revised 2026-06-01) — host side ✅ 2026-06-01

- [x] Locate existing provider-key SecretStorage helpers (`openai-api-key`, `google-ai-key`,
      `anthropic-api-key` in RitemarkSettingsProvider); add ONE new stored key for OpenRouter
      (`openrouter-api-key`, flag-gated handlers + test routing)
- [x] Spawn-env injection: `src/acp/acpKeyEnv.ts` (`buildByokEnv`/`byokProviderFlags` + tests);
      keys → spawn env only, webview gets booleans
- [ ] **[WEBVIEW — Mac session]** Settings page: update "Used for:" copy on 3 existing cards;
      add OpenRouter card (flag-gated, optional)
- [ ] **[WEBVIEW — Mac session]** Remove stale "Imagen 3 (coming soon)" from Google AI card copy
      (not flag-gated — ships unconditionally; Jarmo 2026-06-01)
- [ ] AI sidebar empty-state "Set up your API keys" card + `open-settings-api-keys` deep link
- [ ] Verify keys never appear in webview messages (trace channel inspection — scenarios.md
      "Keys never leak")

## Phase 4: Approval gating + dispatch + streaming (R4, R5) — host side ✅ 2026-06-01

- [x] Workspace-root validation + always-allow + approval round-trip (in `acpFsProxy.ts` from
      Phase 1 + `_handleAcpWriteApproval`/`_handleAcpPermission`/`_acpSessionAlwaysAllow` in
      UnifiedViewProvider — structure differs from planned `acpApproval.ts`, same behavior)
- [x] Approval behavior covered by `acpClient.test.ts` + `acpManager.test.ts` permission tests
- [x] Wire `'acp-execute'`, `'acp-cancel'`, `'acp-approval-response'`, `'acp-get-providers'` cases
      in `UnifiedViewProvider.ts`
- [x] Normalize ACP + Codex approval payloads to one webview message shape (`codex-approval` with
      acp- prefixed requestId; progress reuses `codex-progress`/`codex-streaming`/`codex-result`)
- [ ] **[Mac session]** Progress streaming verified end-to-end in dev mode (text, tool_use, error,
      cancel ≤ 2s) — needs runnable webview + real binary

## Phase 5: Model selection (R6) — host side ✅ 2026-06-01

- [x] `BYOK_PROVIDER_MODELS` in `src/ai/modelConfig.ts` (+ `ByokProvider` type,
      `toOpenCodeModelValue()`; surfaced via `agent:config` and `flow:modelConfig`)
- [ ] **[WEBVIEW — Mac session]** `opencode:` composite values + provider-filtered model list
      in `AgentSelector.tsx`
- [x] Model selection mechanism (`setSessionConfigOption(configId: 'model')` per audit)
      implemented in `acpClient.setModel()`, wired in `acp-execute`

## Phase 6: Feature flag (R7) — host side ✅ 2026-06-01

- [x] `'opencode-integration'` flag in `src/features/flags.ts` (**stable** per Q3, all platforms)
      + `opencodeFlag.test.ts`
- [x] Gate (host side): AGENTS registry exposure to webview, `acp-execute`/key handlers inert
      when off, `acpProviders`/`byokProviderModels` excluded from `agent:config` when off
- [ ] **[WEBVIEW — Mac session]** Gate: AgentSelector entry, Settings OpenRouter card
- [ ] **[Mac session]** Verify flag-off hides everything (scenarios.md R7 scenario)

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

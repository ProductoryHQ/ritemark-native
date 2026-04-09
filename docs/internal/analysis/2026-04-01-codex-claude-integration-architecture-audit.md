# Codex + Claude Integration Audit (System Architecture POV)

**Date:** 2026-04-01  
**Scope:** `ritemark-native` AI sidebar, agent runtime integration, and flow-node integration for Claude Code + Codex.  
**Authoring mode:** codebase audit + external best-practice research.

---

## 1) Executive summary

Ritemark currently implements a **dual-provider agent architecture** where Claude and Codex are integrated through different runtime stacks but exposed through a mostly unified sidebar UX. This is a practical and shippable design, but it creates some medium-term complexity around duplicated lifecycle logic, provider-specific edge-case handling, and inconsistent execution contracts between sidebar sessions and flow nodes.

At a high level:

- The **sidebar orchestration is centralized** in `UnifiedViewProvider`, which routes to Ritemark assistant, Claude session logic, or Codex app-server logic.
- **Claude path** uses Anthropic SDK via `AgentRunner` with persistent sessions and tool/lifecycle conventions.
- **Codex path** uses a custom JSON-RPC client over `codex app-server` with explicit request/response and approval callbacks.
- **Flows support both providers** (`claude-code`, `codex`) but use separate executors and separate operational assumptions.
- There is already a healthy foundation for safety controls (approval policy, sandbox mode, excluded folders, setup checks), but enforcement is mixed between prompt-time contracts and runtime controls.

**Strategic recommendation:** keep the current integration for short-term velocity, but move toward a **provider-neutral agent runtime contract** with a shared event model, policy engine, and adapter layer.

---

## 2) Current architecture (as implemented)

## 2.1 Control plane and UI boundary

`UnifiedViewProvider` is the primary bridge between VS Code extension host and webview UI. It owns:

- webview message routing (`ai-execute`, `ai-select-agent`, model selection, cancellation, approvals, questions)
- provider-specific state (Claude session state and Codex app-server/auth state)
- setup/status propagation for provider readiness

This makes it a **high-centrality orchestrator** that combines transport, policy hints, provider lifecycle, and UI wiring in one place.

## 2.2 Claude integration path

Claude integration uses `AgentRunner` as shared runtime abstraction with two usage modes:

- one-shot `runAgent()` (used by flows)
- persistent `AgentSession` (used by sidebar)

Notable traits:

- Dynamic import pattern to load ESM SDK from CommonJS extension context.
- Prompt-embedded lifecycle guardrails (AskUserQuestion / ExitPlanMode behavior).
- Attachment handling transformed into SDK message content blocks.
- Local safety prefix (workspace + excluded folders) added to system append.

The Claude setup path (`agent/setup.ts`) additionally handles cross-platform binary discovery and Windows-specific `.cmd`/spawn nuances.

## 2.3 Codex integration path

Codex integration is split across:

- `codexManager.ts` (binary discovery, version/compatibility, process lifecycle)
- `codexAppServer.ts` (JSON-RPC protocol client + event emitter)
- `codexAuth.ts` (auth + login status orchestration)
- protocol typings in `codexProtocol.ts`

Notable traits:

- Direct app-server session semantics (initialize → thread/start → turn/start).
- Runtime handling of server-initiated approval requests and `request_user_input` responses.
- Explicit capability compatibility checks and diagnostics surfaced to UI.

## 2.4 Flows integration

Flows define both agent node types in `flows/types.ts` and use:

- `ClaudeCodeNodeExecutor.ts` for Claude
- `CodexNodeExecutor.ts` for Codex

Current divergence:

- Codex flow executor auto-approves all server requests in flow context.
- Claude flow executor goes through Claude runner semantics and maps richer progress into a simplified progress contract.

This is workable but creates policy asymmetry and inconsistent observability.

## 2.5 Agent/command discovery boundary

`agent/discovery.ts` scans `.claude/agents`, `.claude/commands`, `.claude/skills` and exposes these to webview UX (mentions/slash command affordances). This means Claude ecosystem metadata currently acts as a broader “agent capability catalog”, even when Codex is selected.

---

## 3) Architecture strengths

1. **Clear provider isolation at runtime process layer** (Claude SDK vs Codex app-server), reducing blast radius of provider-specific failures.
2. **Good operator ergonomics** via diagnostics, setup status, and repair command hints.
3. **Safety controls exposed in settings** (approval policy, sandbox mode, excluded folders), improving user-governed trust boundaries.
4. **Progressive multi-agent UX** with shared chat interface and provider-specific handling beneath.
5. **Compatibility introspection** for Codex versions (pragmatic guard against protocol drift).

---

## 4) Key risks and architectural debt

## 4.1 Orchestrator concentration risk

`UnifiedViewProvider` is becoming a “god orchestrator”: transport broker + policy adapter + lifecycle manager + state coordinator. This reduces change safety and testability when adding more providers/features.

## 4.2 Contract drift between providers

Claude uses prompt-level lifecycle constraints and SDK semantics; Codex uses protocol-level events and explicit responses. Same user intent (plan, question, approval) is implemented differently, which risks UX inconsistency and subtle regressions.

## 4.3 Sidebar vs Flows policy mismatch

Auto-approval behavior in Codex flow execution can diverge from user expectations configured in sidebar settings. This is a policy-layer inconsistency, not just an executor detail.

## 4.4 Discovery model tied to `.claude` conventions

Agent/command discovery assumes Claude filesystem conventions. As multi-provider strategy grows, this can become an accidental dependency and make cross-provider capability portability harder.

## 4.5 Provider protocol evolution risk

Codex protocol is vendored in local TS types and partially generated/simplified. Any upstream protocol drift can break event parsing, approval handshakes, or auth flow behavior unless version-gated and contract-tested.

---

## 5) External best-practice research (online)

> Note: these recommendations synthesize published guidance and map it to this codebase. Where provider behavior is inferred from product docs rather than formal API contracts, treat as directional.

## 5.1 Best-practice themes

1. **Policy enforcement should be runtime, not only prompt text.**
   - Prompt contracts are useful but should backstop—not replace—hard policy gates.

2. **Use least-privilege execution with explicit escalation paths.**
   - Sandbox defaults and command/file-change approvals should align with execution mode (chat vs flow automation).

3. **Separate provider adapters from product lifecycle state machine.**
   - Keep one canonical turn lifecycle contract and map provider events into that model.

4. **Treat tool invocation as untrusted boundary.**
   - Prompt-injection-resistant controls should include allowlists, workspace boundary checks, and output sanitization.

5. **Versioned protocol contracts + compatibility tests.**
   - Protocol clients should be validated against fixed fixtures and smoke tests for server-request callbacks.

## 5.2 Sources consulted

- Anthropic docs (Claude Code / agent SDK guidance): https://docs.anthropic.com/
- OpenAI Codex product/docs hub: https://openai.com/codex/
- OpenAI developer docs (agent/tooling patterns): https://platform.openai.com/docs
- Model Context Protocol site/spec references: https://modelcontextprotocol.io/
- OWASP Top 10 for LLM Applications (agent/tool/prompt-injection risks): https://owasp.org/www-project-top-10-for-large-language-model-applications/

---

## 6) Refactor strategy options by budget scenario

## Scenario 1 — Near-limitless time + budget

**Goal:** Build a durable multi-provider agent platform inside Ritemark.

### What to refactor

1. **Introduce Agent Runtime Core (ARC)**
   - New internal module owning canonical lifecycle states:
     `idle -> planning -> awaiting_input -> awaiting_approval -> executing -> completed/failed/interrupted`
   - Provider adapters emit normalized domain events into ARC.

2. **Provider Adapter Interface**
   - `IProviderAdapter` for Claude, Codex (and future providers).
   - Responsibilities: session init, turn start/interrupt, auth status, capability reporting, event translation.

3. **Unified Policy Engine**
   - Central policy service for approvals, sandbox rules, workspace boundaries, and flow-vs-sidebar policy profiles.
   - Hard enforcement before tool execution responses are sent.

4. **Capability Registry & Feature Negotiation**
   - Provider declares capabilities (`supportsStructuredQuestions`, `supportsPlanEvents`, `supportsPatchApprovalScopes`, etc.).
   - UI and flow executors bind to capability flags instead of provider `if/else` logic.

5. **Protocol Contract Test Harness**
   - JSON-RPC replay fixtures for Codex; SDK event fixtures for Claude.
   - Golden lifecycle tests proving same user-level behavior across providers.

6. **Telemetry & SLOs**
   - Structured traces per turn + per tool with provider-neutral keys.
   - Operational dashboards for auth failures, approval loops, timeout rates, context overflow rates.

### Expected outcomes

- High reliability and provider portability.
- Faster future integration of additional agent backends.
- Lower regression risk from protocol/provider changes.

### Trade-offs

- Significant up-front architecture and migration cost.
- Needs strict rollout governance and dual-run compatibility window.

---

## Scenario 2 — Medium time + budget

**Goal:** Reduce most architectural risk without full platform rewrite.

### What to refactor

1. **Extract lifecycle reducer from `UnifiedViewProvider`**
   - Keep existing providers, but move turn-state transitions to shared state machine module.

2. **Add thin adapter wrappers (not full platform)**
   - `ClaudeAdapter` and `CodexAdapter` expose same minimal interface for sidebar operations.

3. **Unify policy behavior for Flows + Sidebar**
   - Reuse same approval policy resolver in both executors.
   - Replace Codex flow “auto-approve all” with explicit execution profile (e.g., `automation-safe`, `interactive`, `dry-run`).

4. **Strengthen compatibility guards**
   - Add startup contract checks + warning downgrade mode when unsupported Codex protocol capabilities are detected.

5. **Consolidate discovery abstraction**
   - Keep `.claude` scan support, but introduce provider-neutral discovery schema in UI-facing contract.

### Expected outcomes

- Noticeably better consistency and maintainability.
- Lower migration risk than full rewrite.
- Fits incremental sprint delivery.

### Trade-offs

- Some duplication remains.
- May need another refactor in 1–2 major releases if provider count increases.

---

## Scenario 3 — Very tight budget

**Goal:** Improve safety + maintainability with minimal churn.

### What to refactor

1. **Add explicit architecture boundary docs + invariants tests**
   - Document lifecycle invariants and approval semantics.
   - Add smoke tests that assert Claude and Codex both trigger question/plan/approval UX correctly.

2. **Patch highest-risk inconsistency only**
   - Remove unconditional Codex flow auto-approval or gate it behind explicit setting with clear warning.

3. **Reduce `UnifiedViewProvider` complexity surgically**
   - Extract only Codex auth/status polling and request routing helpers into small focused modules.

4. **Protocol drift guardrail**
   - On Codex init, validate required RPC methods/capabilities; fail fast with actionable diagnostics.

### Expected outcomes

- Lower operational risk quickly.
- Keeps velocity for feature work.

### Trade-offs

- Technical debt remains.
- Future provider expansion still expensive.

---

## 7) Suggested phased plan (pragmatic)

1. **Phase A (immediate, low risk):** policy alignment + contract tests (Scenario 3 baseline).
2. **Phase B (next):** lifecycle extraction + thin adapters (Scenario 2 core).
3. **Phase C (strategic):** optional ARC platformization if roadmap includes more providers/automation depth.

---

## 8) Concrete recommendations (priority-ordered)

1. **P0:** unify approval semantics between sidebar and flows.
2. **P0:** add provider-agnostic lifecycle contract tests (plan/question/approval/interruption).
3. **P1:** split `UnifiedViewProvider` into coordinator + provider services.
4. **P1:** codify capability negotiation and fallback UX.
5. **P2:** introduce provider-neutral discovery and command metadata model.
6. **P2:** centralize telemetry schema for both provider runtimes.

---

## 9) Final audit verdict

The current system is **functionally strong for a two-provider experimental-to-production transition stage**, but its architecture is at the point where incremental complexity will compound quickly. If the product intent is sustained multi-agent depth (and especially if adding providers/tooling), investing now in a normalized runtime contract and policy layer will produce strong long-term leverage.



---

## 10) Follow-up coverage gaps and continuation

After review, the biggest under-covered area is the desktop onboarding dependency funnel (Windows + macOS) for non-technical users (terminal-averse setup). This is now tracked in a dedicated continuation audit with concrete architecture and implementation sequencing:

- `docs/internal/analysis/2026-04-01-windows-zero-terminal-bootstrap-plan.md`

Priority order for continuation:

1. P0: Desktop (Windows + macOS) zero-terminal bootstrap and blocker-specific one-click recovery, with explicit handling for Node runtime mismatch (VS Code runtime vs terminal), architecture mismatch, and PATH/shim conflicts.
2. P1: Sidebar vs flow approval policy unification and migration safety.
3. P2: Provider lifecycle contract tests and protocol-drift fixtures.
4. P3: Onboarding telemetry schema and measurable setup SLOs.

---

## 11) Provider update scenarios (Codex + Claude) — missing depth now covered

This section focuses on what happens when provider CLIs/protocols/auth behaviors change between releases, and how Ritemark should remain stable for non-technical users.

### 11.1 Scenario matrix (by blast radius)

## S1 — Routine CLI patch/minor updates (low blast radius)

- **Trigger examples**
  - Codex CLI global package updated.
  - Claude Code auto-update applies in background.
- **Primary risk**
  - New diagnostics text or minor auth prompts break brittle parsing/UI assumptions.
- **Required handling**
  - Tolerant parsing; avoid string-fragile state transitions.
  - Keep user state in `ready` unless hard capability checks fail.

## S2 — Protocol/event schema evolution (medium blast radius)

- **Trigger examples**
  - Codex app-server adds/renames fields or changes event ordering.
  - Claude SDK event shape/semantics for plan/question/tool updates evolve.
- **Primary risk**
  - Sidebar turn lifecycle drifts; approvals/questions may stall.
- **Required handling**
  - Versioned adapter contract + fixture replay tests per provider.
  - Capability negotiation at session start, with graceful feature downgrade.

## S3 — Runtime/install channel shifts (high blast radius for onboarding)

- **Trigger examples**
  - CLI install method changes (native installer vs npm path assumptions).
  - Node runtime requirements advance.
- **Primary risk**
  - Existing repair/install flows become incorrect, especially on Windows/macOS non-technical installs.
- **Required handling**
  - Installer-channel detection in setup status.
  - Blocker mapper uses channel-aware remediation, not one command for all users.

## S4 — Auth/session policy changes (high blast radius for trust)

- **Trigger examples**
  - Login token format/expiry behavior changes.
  - Browser callback behavior changes or stricter security prompts.
- **Primary risk**
  - Repeated login loops or false “ready” state.
- **Required handling**
  - Distinct states for `needs-auth`, `auth-in-progress`, `auth-stale`, `auth-failed`.
  - Recheck with bounded retries and user-facing explanation.

## S5 — Breaking major releases (highest blast radius)

- **Trigger examples**
  - Codex/Claude major version with incompatible behavior.
- **Primary risk**
  - Hard startup failures, broken flows, support surge.
- **Required handling**
  - Compatibility gate at startup + explicit minimum/maximum supported ranges.
  - Controlled rollout and rollback toggles.

### 11.2 Update-safe architecture requirements

1. **Provider version fingerprinting** on every session bootstrap (binary version, install channel, arch/runtime hints).
2. **Adapter-level compatibility verdict**: `supported | degraded | unsupported` with structured reasons.
3. **State-machine invariant tests** proving plan/question/approval/cancel parity across providers on upgraded fixtures.
4. **Release ring strategy** (internal -> beta -> stable) for provider-related updates.
5. **Fast rollback path**: disable affected capability without disabling the full provider when possible.

### 11.3 UX contract during update incompatibility

When an update breaks compatibility, user experience must:

- stay explicit (“Codex update changed a required capability” rather than generic failure)
- present one safe next action (reload, repair, sign-in, or wait-for-update)
- avoid terminal-first commands for default path
- keep technical payload in expandable details for support workflows

### 11.4 Test plan additions for update scenarios

Add provider update regression suite:

1. Codex protocol fixture versions `vN`, `vN+1` (added/unknown fields).
2. Claude event ordering variants (question before plan, plan deltas interleaved with tool output).
3. Auth loop prevention tests after simulated token invalidation.
4. Startup compatibility gate tests: supported/degraded/unsupported mapping.
5. Rollback behavior tests (feature toggle off -> provider still usable in reduced mode).

### 11.5 Priority execution (next two increments)

- **Increment A**: fingerprint + compatibility verdict + user-facing degraded mode.
- **Increment B**: fixture replay CI gate + release-ring telemetry dashboards.


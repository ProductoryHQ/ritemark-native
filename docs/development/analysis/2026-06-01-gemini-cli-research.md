# Gemini CLI as a Third Agent Runtime — Research Analysis

**Date:** 2026-06-01
**Issue:** [#52 — Research Gemini CLI equivalent for agent offerings](https://github.com/ProductoryHQ/ritemark-native/issues/52)
**Status:** Research complete — recommendation: **defer**

* * *

## Executive Summary

**Yes, a Gemini equivalent to Claude Code CLI / Codex CLI exists** — Google's official
[Gemini CLI](https://github.com/google-gemini/gemini-cli) (Apache-2.0, ~105K stars, npm
`@google/gemini-cli`). It is technically embeddable in Ritemark via its **ACP mode**
(`gemini --acp`, JSON-RPC 2.0 over stdio) — architecturally the same shape as our existing
Codex `codex-app-server` integration, and the same path Zed uses to embed it.

**However, the recommendation is to NOT integrate it now.** The timing is actively hostile:

> **On 2026-06-18, Google sunsets Gemini CLI for free / Google AI Pro / Ultra users**, steering
> consumers to a new **closed-source, Go-based "Antigravity CLI"**. After that date, Gemini CLI
> only works with **paid Gemini API keys / Vertex AI / enterprise accounts**, and the open-source
> repo receives enterprise-only fixes.
> Source: [Google Developers Blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/),
> [GitHub Discussion #27274](https://github.com/google-gemini/gemini-cli/discussions/27274)

The headline benefit — free Gemini in the sidebar via Google-account OAuth (60 req/min,
1,000 req/day) — evaporates 17 days from this writing. What remains is a consumer-frozen CLI
requiring a paid API key, which Ritemark could reach more simply via the `@google/genai` SDK
without spawning a CLI subprocess at all.

**Verdict on the three "Requested outcome" items in #52:**

| #52 asked | Answer |
| --- | --- |
| Does a comparable Gemini CLI exist? | Yes — `@google/gemini-cli`, comparable to Codex CLI in capability |
| Capabilities and limitations | Documented below (§3–§6) |
| Suitable for Ritemark's agent experience? | **Not now.** Consumer deprecation 2026-06-18 + closed-source successor with no embedding story yet. Re-evaluate when Antigravity CLI publishes an SDK/protocol. |

* * *

## 1. What Ritemark Requires of a Runtime (Codebase Grounding)

Ritemark currently embeds two runtimes through two different patterns:

| | Claude Code | Codex |
| --- | --- | --- |
| Interface | In-process TS SDK (`@anthropic-ai/claude-agent-sdk`, dynamic import) + bundled `claude` binary | Bundled `codex-app-server` binary, JSON-RPC 2.0 over stdio |
| Integration code | `extensions/ritemark/src/agent/` (`AgentRunner.ts`, `AgentSession`) | `extensions/ritemark/src/codex/` (`codexManager.ts`, `codexAppServer.ts`, `codexProtocol.ts`, `codexAuth.ts`, `codexApproval.ts`, `codexModels.ts`, `codexStatusEvents.ts`, `codexTrace.ts`) |
| Auth | Claude OAuth (`claude auth login --claudeai`) + API key fallback | ChatGPT OAuth built into binary + API key |

Shared abstraction points a third runtime must plug into:

- **Agent registry:** `src/agent/types.ts:11` — `export type AgentId = 'claude-code' | 'codex'`;
  `AGENTS: Record<AgentId, AgentInfo>` at `types.ts:29`. Gemini = new union member + registry entry.
- **Binary resolution:** `src/utils/bundledAgentRuntime.ts:4` —
  `AgentRuntimeKind = 'claude' | 'codex-cli' | 'codex-app-server'`; `executableNames()` /
  `candidateRuntimePaths()` resolve bundled-first, system-PATH fallback.
- **Bundling manifest:** `extensions/ritemark/binaries/agents/manifest.json` — source URL, sha256,
  platform/arch, license block (`spdx`, `redistribution`) per runtime per platform.
- **Progress events:** common `AgentProgressType` (`text | tool_use | error | plan_ready | …`,
  `src/agent/types.ts:73`) — every runtime's protocol must map onto this.
- **Dispatch:** message-based routing in `src/views/UnifiedViewProvider.ts`
  (`'ai-execute-agent'` vs `'codex-execute'` cases).
- **Model selection:** composite values (`'claude-code:model'`, `'codex:model'`) in
  `webview/src/components/ai-sidebar/AgentSelector.tsx`; model IDs centralized in
  `src/ai/modelConfig.ts` (CLAUDE.md hard rule).
- **Approval gating:** edits/commands must flow through an approval surface
  (`codexApproval.ts` precedent) — no silent unapproved writes.

This mirrors the integration checklist already written down in
[issue #92](https://github.com/ProductoryHQ/ritemark-native/issues/92) (Cursor CLI as third runtime).

* * *

## 2. Gemini CLI at a Glance

| Attribute | Finding |
| --- | --- |
| Repo | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) — ~105K stars, 6,000+ external PRs merged, 508 releases |
| Latest stable | v0.44.1 (2026-05-28); weekly stable + weekly preview + nightly cadence |
| License | **Apache 2.0** — redistribution/bundling in a commercial app is permitted (NOTICE attribution required) |
| Distribution | npm `@google/gemini-cli` (Node ≥ 20 process). **No standalone native binary** — unlike `codex-app-server` |
| Maintenance | 🔴 **Consumer-deprecated effective 2026-06-18**; enterprise-only fixes thereafter; successor (Antigravity CLI) is closed-source |

* * *

## 3. Embedding Interfaces (the decisive area)

Three candidate paths, ranked by fit:

### 3a. ACP mode — `gemini --acp` — best fit ✅

- JSON-RPC 2.0 over stdio, client/server — **same architecture as our Codex
  `codexAppServer.ts` integration**. Zed embeds Gemini CLI, Claude Code, and Codex this way.
- Protocol covers the full agent loop: `initialize` (registers MCP servers), `authenticate`,
  `newSession` / `loadSession`, `prompt`, `cancel`, `setSessionMode` (approval level),
  `unstable_setSessionModel` (mid-session model switch).
- **File reads/writes are proxied through the ACP client** — Ritemark would gate every write.
  Excellent fit for a document editor's approval model.
- ⚠️ Gaps (per Zed's production integration): **session resume and checkpointing are not yet
  supported over ACP**; model switching is `unstable_`-prefixed.
- Docs: [ACP Mode](https://geminicli.com/docs/cli/acp-mode/),
  [Zed external agents](https://zed.dev/docs/ai/external-agents)

### 3b. Headless mode — `gemini -p "…" --output-format stream-json` — limited

- One-shot, non-interactive; JSONL events (`init`, `message`, `tool_use`, `tool_result`,
  `error`, `result`).
- No documented session resumption or bidirectional permission prompts — too weak for an
  interactive sidebar; fine for Flow-node-style batch use.
- Docs: [Headless mode](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md)

### 3c. `@google/gemini-cli-core` npm — not a supported SDK ❌

- **There is no official Gemini equivalent of `@anthropic-ai/claude-agent-sdk`.**
  Issue [#15539 "Create a Formal SDK for Programmatic Use"](https://github.com/google-gemini/gemini-cli/issues/15539)
  was **closed without delivering one**.
- `@google/gemini-cli-core` is published but documented as the internal core-logic package, not a
  stable consumer API. Do not design against it.
- UNVERIFIED: third-party references to a `@google/gemini-cli-sdk` package could not be confirmed
  on npm or in official docs.

* * *

## 4. Agent Capabilities

| Capability | Status |
| --- | --- |
| Streaming responses | ✅ (stream-json / ACP) |
| Tools: file read/write/edit, shell, web search/fetch | ✅ (bundles ripgrep for search) |
| MCP client (inject Ritemark's own tools) | ✅ first-class — `~/.gemini/settings.json` or extensions system |
| Custom system prompt | ⚠️ context injection only (`GEMINI.md`); full base-prompt override UNVERIFIED |
| Approval modes | ✅ `default` / `auto_edit` / `plan` (read-only) / `yolo` — maps onto Ritemark's approval model |
| Plan mode | ✅ (behind experimental flag) |
| Session resume / checkpointing | ✅ via CLI (`--resume`, `--checkpointing`); ⚠️ **not over ACP** |
| Context files / @ mentions / memory | ✅ (`GEMINI.md`, `/memory`, `@file`) |

* * *

## 5. Auth & Models

**Auth (post-2026-06-18 reality):**

| Method | Status after cutover |
| --- | --- |
| Google account OAuth (free: 60 req/min, 1,000 req/day) | 🔴 **Stops serving requests** for consumer tiers |
| Gemini API key (AI Studio) | ✅ survives — free tier limited to Flash models, then pay-as-you-go |
| Vertex AI (ADC / service account) | ✅ survives — heavy setup |
| Workspace / Gemini Code Assist Enterprise | ✅ survives — enterprise only |

→ A realistic Ritemark integration would require users to bring a **paid Gemini API key**. Same
friction as our Codex API-key path, but with no free OAuth on-ramp — undercutting the original
motivation in #52.

**Models:** Gemini 3 Pro / 3 Flash / 3.5 Flash (1M-token input context, 65K output). The 1M
context is a genuine advantage for long-document editing. Selection over ACP only via
`unstable_setSessionModel`.

* * *

## 6. Alternatives Considered

| Option | Verdict |
| --- | --- |
| **Antigravity CLI** (Google's official successor) | Closed-source, Go-based. Public repo has README/changelog only — **no source, no embedding protocol yet**. The strategic watch item, not a today option. |
| **Qwen Code** (gemini-cli fork, ~25K stars) | Living fork of the codebase but tuned for Qwen models — doesn't satisfy "Gemini-based". |
| **opencode / Crush** (multi-model agent CLIs) | Support Gemini models via API key but are general runtimes — wrong shape, large surface. |
| **Jules / Jules Tools** (Google async cloud agent) | Cloud-VM, PR-opening async model — not an embeddable local stdio agent. |
| **Direct `@google/genai` SDK** (no CLI at all) | ✅ Most pragmatic if Gemini *models* are ever required: call the API directly with a user key, wrap Ritemark's existing tool layer around it. No subprocess, no deprecated dependency. |

* * *

## 7. Risks

| Risk | Severity |
| --- | --- |
| Consumer deprecation 2026-06-18 (free OAuth tier dies) | 🔴 Critical |
| Successor (Antigravity) is closed-source with no embedding API | 🔴 High |
| No supported SDK; ACP sub-features experimental/`unstable_` | 🟠 Medium-high |
| Session resume/checkpointing missing over ACP | 🟠 Medium |
| Node-subprocess runtime weight (vs native binary) | 🟡 Low-medium (we already ship Node) |
| Telemetry | 🟢 Off by default (`GEMINI_TELEMETRY_ENABLED`) — fits privacy-first stance |

* * *

## 8. Capability Comparison

| Capability | Gemini CLI (ACP) | Claude Code (SDK + CLI) | Codex (app-server) |
| --- | --- | --- | --- |
| Embedding interface | JSON-RPC/stdio (`--acp`); no formal SDK | In-process TS SDK + bundled binary | JSON-RPC/stdio binary |
| Streaming | ✅ | ✅ | ✅ |
| Tool use (file/shell/web) | ✅ | ✅ | ✅ |
| MCP / custom tool injection | ✅ | ✅ | ✅ |
| Custom system prompt | ⚠️ context-only | ✅ first-class | ⚠️ limited |
| Plan / approval modes | ✅ | ✅ | ✅ |
| Session resume (embedded) | ⚠️ not over ACP | ✅ | ✅ |
| Auth without paid key | 🔴 dying 2026-06-18 | ✅ Claude OAuth | ✅ ChatGPT OAuth |
| Runtime form | Node subprocess | SDK in-process + binary | Native binary |
| License (bundling) | Apache 2.0 ✅ | Proprietary (redistribution agreement) | Apache 2.0 ✅ |
| Maintenance trajectory | 🔴 consumer-frozen | 🟢 active | 🟢 active |

* * *

## 9. Recommendation

1. **Defer issue #52.** Do not build a Gemini CLI runtime now. The free-tier sunset
   (2026-06-18) removes the headline user benefit, and Google's investment is moving to a
   closed-source successor we cannot embed yet.

2. **Watch item:** re-open evaluation when **Antigravity CLI** publishes source and/or a
   documented embedding protocol (ACP or otherwise). Suggest converting #52 into a watch issue
   or closing it with a link to this analysis.

3. **If Gemini models become a requirement before then:** integrate the **`@google/genai` SDK
   directly** (user-supplied paid API key) rather than embedding the deprecated CLI — no
   subprocess, no dependency on a frozen consumer product.

4. **If a CLI-style Gemini agent is explicitly wanted anyway:** use **ACP mode** mirroring the
   Codex integration (`src/gemini/` sibling of `src/codex/`, new `AgentRuntimeKind`,
   feature-flagged, paid API key required, `default`/`plan` approval modes only, pinned CLI
   version, accept no session resume).

* * *

## 10. Unverified Items

- Existence of `@google/gemini-cli-sdk` (third-party claim; not found on npm/official docs)
- Any A2A server mode for Gemini CLI
- Headless device-code OAuth flow suitable for embedded auth
- Full base-system-prompt override beyond `GEMINI.md` context injection
- Whether Antigravity CLI will expose ACP/stdio embedding
- npm download counts (npm returned HTTP 403 to automated fetch)

* * *

## 11. Sources

- [Google Developers Blog — Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [GitHub Discussion #27274 — official transition thread](https://github.com/google-gemini/gemini-cli/discussions/27274)
- [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- [ACP Mode docs](https://geminicli.com/docs/cli/acp-mode/) · [Headless mode docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md) · [npm package overview](https://geminicli.com/docs/npm/)
- [Issue #15539 — Create a Formal SDK (closed, undelivered)](https://github.com/google-gemini/gemini-cli/issues/15539)
- [Zed external agents](https://zed.dev/docs/ai/external-agents) · [Zed ACP / Gemini CLI](https://zed.dev/acp/agent/gemini-cli)
- [Quotas & pricing](https://geminicli.com/docs/resources/quota-and-pricing/) · [Authentication](https://geminicli.com/docs/get-started/authentication/) · [MCP](https://geminicli.com/docs/tools/mcp-server/) · [Extensions](https://geminicli.com/docs/extensions/)
- [The New Stack — Google Antigravity CLI](https://thenewstack.io/google-antigravity-cli/) · [The Register — Bye bye Gemini CLI](https://www.theregister.com/ai-ml/2026/05/20/bye-bye-gemini-cli-google-nudges-devs-toward-antigravity/)
- [Gemini 3.5 Flash model card](https://deepmind.google/models/model-cards/gemini-3-5-flash/) · [Gemini 3 Flash in Gemini CLI](https://developers.googleblog.com/gemini-3-flash-is-now-available-in-gemini-cli/)
- Internal prior art: `docs/development/analysis/2026-02-14-codex-cli-chatgpt-integration.md`, `agent-sdk-redistribution.md`, [issue #92 (Cursor CLI runtime)](https://github.com/ProductoryHQ/ritemark-native/issues/92)

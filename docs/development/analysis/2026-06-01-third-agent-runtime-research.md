# Third Agent Runtime Research — Gemini CLI, Antigravity CLI, and Open BYOK Harnesses

**Date:** 2026-06-01
**Issue:** [#52 — Research Gemini CLI equivalent for agent offerings](https://github.com/ProductoryHQ/ritemark-native/issues/52)
**Status:** Research complete — recommendation: **adopt the Agent Client Protocol (ACP) as Ritemark's third runtime layer, with OpenCode (MIT) as the bundled default BYOK agent**

* * *

## Executive Summary

This research ran in three phases:

| Phase | Question | Verdict |
| --- | --- | --- |
| **I — Gemini CLI** | Is there a Gemini equivalent of Claude Code / Codex we can embed? | Yes (`@google/gemini-cli`, ACP-embeddable) — but **consumer-deprecated 2026-06-18**. Dead end. |
| **II — Antigravity CLI** | Is the successor more sustainable? What does the market say? | Platform will persist, but it's **closed-source, ACP-less, ToS-hostile to third-party clients** (OpenClaw bans). Market calls it a bait-and-switch. Rejected. |
| **III — Open BYOK harnesses** | Is there a serious open, Claude-Code-class harness users can bring their own keys to? | **Yes: OpenCode** (MIT, 168K stars, 75+ providers). But the smarter move is to integrate the **protocol (ACP)**, not one product — one client unlocks OpenCode, Goose, Qwen Code, OpenHands, Cline, and more. |

**Final recommendation:**

1. **Implement one ACP client** in `extensions/ritemark/src/acp/` using the Apache-2.0
   [`@agentclientprotocol/sdk`](https://www.npmjs.com/package/@agentclientprotocol/sdk).
   ACP is JSON-RPC 2.0 over newline-delimited stdio — **the exact wire model of our existing
   `codex-app-server` integration** — with native client-proxied file writes and permission
   requests. Estimated effort: **~0.5–0.7× of the Codex integration** (the hard parts are
   already written; ACP additionally provides a maintained SDK for the wire layer).
2. **Bundle [OpenCode](https://github.com/sst/opencode) (MIT)** as the default BYOK agent —
   users plug in their own Anthropic / OpenAI / **Gemini** / OpenRouter / Ollama keys.
   Optionally also **Goose** (Apache-2.0, Linux Foundation-governed) for bus-factor insurance.
3. **Gemini models reach Ritemark users through OpenCode BYOK** (Google Gemini is one of its
   75+ providers) — no dependency on Google's CLI products at all. The narrower
   `@google/genai` direct-SDK option from Phase II remains valid as a lighter-weight
   "model provider only" alternative if a full third runtime is deemed too large a sprint.
4. **Never build on Gemini CLI or Antigravity CLI.**

* * *

# Part I — Gemini CLI

## 1. What Ritemark Requires of a Runtime (Codebase Grounding)

Ritemark currently embeds two runtimes through two different patterns:

| | Claude Code | Codex |
| --- | --- | --- |
| Interface | In-process TS SDK (`@anthropic-ai/claude-agent-sdk`, dynamic import) + bundled `claude` binary | Bundled `codex-app-server` binary, JSON-RPC 2.0 over stdio |
| Integration code | `extensions/ritemark/src/agent/` (`AgentRunner.ts`, `AgentSession`) | `extensions/ritemark/src/codex/` (`codexManager.ts`, `codexAppServer.ts`, `codexProtocol.ts`, `codexAuth.ts`, `codexApproval.ts`, `codexModels.ts`, `codexStatusEvents.ts`, `codexTrace.ts`) — ~2,438 LOC |
| Auth | Claude OAuth (`claude auth login --claudeai`) + API key fallback | ChatGPT OAuth built into binary + API key |

Shared abstraction points a third runtime must plug into:

- **Agent registry:** `src/agent/types.ts:11` — `export type AgentId = 'claude-code' | 'codex'`;
  `AGENTS: Record<AgentId, AgentInfo>` at `types.ts:29`. New runtime = new union member + registry entry.
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

## 2. Gemini CLI at a Glance

| Attribute | Finding |
| --- | --- |
| Repo | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) — ~105K stars, 6,000+ external PRs merged, 508 releases |
| Latest stable | v0.44.1 (2026-05-28); weekly stable + weekly preview + nightly cadence |
| License | **Apache 2.0** — redistribution/bundling in a commercial app is permitted (NOTICE attribution required) |
| Distribution | npm `@google/gemini-cli` (Node ≥ 20 process). **No standalone native binary** — unlike `codex-app-server` |
| Maintenance | 🔴 **Consumer-deprecated effective 2026-06-18**; enterprise-only fixes thereafter; successor (Antigravity CLI) is closed-source |

## 3. Embedding Interfaces

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

## 4. Agent Capabilities

| Capability | Status |
| --- | --- |
| Streaming responses | ✅ (stream-json / ACP) |
| Tools: file read/write/edit, shell, web search/fetch | ✅ (bundles ripgrep for search) |
| MCP client (inject Ritemark's own tools) | ✅ first-class — `~/.gemini/settings.json` or extensions system |
| Custom system prompt | ⚠️ context injection only (`GEMINI.md`); full base-prompt override UNVERIFIED |
| Approval modes | ✅ `default` / `auto_edit` / `plan` (read-only) / `yolo` |
| Plan mode | ✅ (behind experimental flag) |
| Session resume / checkpointing | ✅ via CLI (`--resume`, `--checkpointing`); ⚠️ **not over ACP** |
| Context files / @ mentions / memory | ✅ (`GEMINI.md`, `/memory`, `@file`) |

## 5. Auth & Models

**Auth (post-2026-06-18 reality):**

| Method | Status after cutover |
| --- | --- |
| Google account OAuth (free: 60 req/min, 1,000 req/day) | 🔴 **Stops serving requests** for consumer tiers |
| Gemini API key (AI Studio) | ✅ survives — free tier limited to Flash models, then pay-as-you-go |
| Vertex AI (ADC / service account) | ✅ survives — heavy setup |
| Workspace / Gemini Code Assist Enterprise | ✅ survives — enterprise only |

→ A realistic integration would require users to bring a **paid Gemini API key**. Same friction as
our Codex API-key path, but with no free OAuth on-ramp — undercutting the original motivation in #52.

**Models:** Gemini 3 Pro / 3 Flash / 3.5 Flash (1M-token input context, 65K output). The 1M
context is a genuine advantage for long-document editing. Selection over ACP only via
`unstable_setSessionModel`.

## 6. Capability Comparison (Gemini CLI vs Existing Runtimes)

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

# Part II — Antigravity CLI: Sustainability & Market Sentiment

## 7. What Antigravity CLI Is

| Attribute | Finding |
| --- | --- |
| Lineage | Productized output of the **~$2.4B Windsurf/Codeium acquihire** (Varun Mohan, Douglas Chen, ~40 staff into DeepMind, July 2025). Antigravity IDE launched Nov 2025 with Gemini 3; **Antigravity 2.0** (IDE + **CLI** + **SDK** + Managed Agents) launched at **I/O 2026 (May 19, 2026)** |
| Binary | `agy` — **Go-based, closed-source**. Public repo ([google-antigravity/antigravity-cli](https://github.com/google-antigravity/antigravity-cli)) contains only README, CHANGELOG, examples, demo GIF; installs via `curl … \| bash` |
| Features | Agent Skills, Hooks, Subagents, plugins (rebranded Gemini CLI extensions), async/background multi-agent workflows, Docker sandboxing, MCP (stdio + HTTP). **No 1:1 parity with Gemini CLI at launch; no parity date given** |
| Models | Gemini 3.x Pro/Flash; reportedly also Claude Sonnet/Opus and GPT-OSS-120B (UNVERIFIED, single source) |
| Auth / pricing | Google Sign-In OAuth or `ANTIGRAVITY_API_KEY`; consumer usage tied to AI Pro / **AI Ultra ($100/mo)**. Users report **aggressive weekly quotas** — a downgrade from Gemini CLI's 1,000 req/day free tier |

## 8. Sustainability Assessment

**The platform is strategic, not an experiment.** Tied directly to Gemini 3.x, the AI Ultra
subscription, and Google Cloud's enterprise agent push. Heavy capital + talent commitment.
Unlikely to be killed at the platform level.

**But the developer-facing surface is demonstrably unstable.** Google open-sourced Gemini CLI,
took ~6,000 community PRs and ~105K stars, then closed-sourced the successor and gated continued
Gemini CLI access behind enterprise — within ~11 months. That *is* the dev-tool-graveyard pattern,
freshly re-confirmed. Representative HN sentiment
([thread](https://news.ycombinator.com/item?id=48196867)):

> "Google really can't help themselves but to have some internal re-org kill off a public thing
> people are actively using."
> "Fool me once, shame on you. Fool me 305+1 times, shame on me."
> "This is why most devs I know have stopped building anything serious on top of Google's AI tools."

For a dependency Ritemark must **embed and ship**, this is exactly the risk profile to avoid.

## 9. Embedding & ToS — the Decisive Blockers

1. **No programmatic embedding surface.** ACP (which Gemini CLI had) was **dropped**. Headless
   `agy -p` exists but reviewers report documented flags (e.g. `--output-format json`) don't match
   the shipping binary — no stable structured-output contract. Zed maintainers on adding ACP:
   *"it's entirely on Google to do so"* — no commitment exists
   ([Zed discussion #57221](https://github.com/zed-industries/zed/discussions/57221)).

2. **The Antigravity SDK is Python-only and ships a closed runtime binary.**
   [`pip install google-antigravity`](https://github.com/google-antigravity/antigravity-sdk-python)
   (Apache-2.0 wrapper around a closed precompiled binary; MCP + custom tools + streaming;
   `GEMINI_API_KEY` auth). Architectural mismatch with Ritemark's Node/TS extension. No Node/TS
   SDK found (UNVERIFIED that one exists).

3. **ToS Section 6 prohibits third-party clients on Antigravity OAuth — and Google enforces it.**
   **Verified precedent (Feb 2026):** Google [banned OpenClaw users](https://discuss.ai.google.dev/t/issue-with-antigravity-account-suspension-due-to-openclaw-oauth-usage/126426)
   for piping Antigravity OAuth tokens through a third-party client; Varun Mohan personally
   justified the bans. Whether a **BYOK** third-party client via the SDK is permitted was
   [asked directly to Google on 2026-05-21 and remains unanswered](https://discuss.ai.google.dev/t/clarification-on-tos-section-6-is-a-byok-bring-your-own-key-third-party-client-permissible-via-the-sdk/146844).

**Bottom line:** Google's posture is *"use our surfaces; don't build your own client against our
agent backend"* — fundamentally incompatible with Ritemark's runtime-agnostic embedding model.

## 10. Market Sentiment

Dominant narrative: **"open-source bait-and-switch."**

- Google's own transition thread: **~211 downvotes vs 3 upvotes**
  ([Discussion #27274](https://github.com/google-gemini/gemini-cli/discussions/27274)) —
  *"So, basically, we're making the project closed source."*
- Press: [The Register](https://www.theregister.com/ai-ml/2026/05/20/bye-bye-gemini-cli-google-nudges-devs-toward-antigravity/)
  (*"Now please open your wallets if you want access to this open-source product"*),
  [The New Stack](https://thenewstack.io/google-antigravity-cli/),
  [FOSS Force](https://fossforce.com/2026/05/gemini-clis-short-life-and-googles-antigravity-bait-and-switch/) ("bait-and-switch").
- Antigravity 2.0's forced IDE update reportedly "broke thousands of developer setups overnight"
  (chat-first UI replacing direct editing), amplifying backlash.
- **Competitive flight:** developers report moving to Anthropic (Claude Code) and OpenAI (Codex)
  as the more open, stable platforms — i.e., exactly the two runtimes Ritemark already embeds.

* * *

# Part III — Open BYOK Harnesses & the Agent Client Protocol

## 11. The Wider Question

Instead of chasing each vendor's CLI (and inheriting each vendor's deprecation risk), is there a
**serious, open, Claude-Code-class harness** where the user brings their own keys — Anthropic,
OpenAI, **Gemini**, OpenRouter, local models — and Ritemark integrates **once**?

Answer: **yes**, and there's a protocol-level strategy that's even better than picking one harness.

## 12. Candidate Comparison Matrix

| Candidate | Embed interface | BYOK providers | Quality vs Claude Code | License (bundling) | Sustainability | Arch fit |
| --- | --- | --- | --- | --- | --- | --- |
| **OpenCode** ([sst/opencode](https://github.com/sst/opencode)) | First-party **ACP** (`opencode acp`) + **HTTP server** (OpenAPI 3.1, SSE, permission endpoint) + `@opencode-ai/sdk` | **75+** via Models.dev (all required) | "Gets closest today" (multiple comparisons) | **MIT** ✅ | 168K★, v1.15.13 (2026-05-30), SST/Dax Raad, 814 releases | TS/Node ✅ |
| **Goose** ([block/goose](https://github.com/block/goose)) | **ACP** (goose-acp-server) + `goose serve` + headless | 15+ (all required) | MCP reference impl; "matches proprietary" self-claim UNVERIFIED | **Apache-2.0** ✅ | **Linux Foundation AAIF-governed** (Dec 2025) — best bus factor | Rust binary ✅ |
| **Qwen Code** (Alibaba) | **ACP** native (registry-listed) | OpenAI/Anthropic/Gemini-compatible + OpenRouter | Gemini-CLI fork lineage | **Apache-2.0** ✅ | Active; Qwen OAuth discontinued 2026-04-15 (BYOK only) | Node ✅ |
| **OpenHands** (All-Hands-AI) | **ACP** native + Python SDK | Any LLM | **72.8% SWE-bench Verified** (strongest verified number) | **MIT** (except enterprise/) ✅ | $18.8M Series A | Python ⚠️ (irrelevant over ACP) |
| **Cline** | **ACP** native | Many BYOK | VS Code-extension core | Apache-2.0 (UNVERIFIED exact) | Active | TS ✅ |
| **Crush** ([charmbracelet/crush](https://github.com/charmbracelet/crush)) | ❌ TUI-only, **no ACP**, no server mode | Excellent (Anthropic/OpenAI/Gemini/Ollama/…) | Polished TUI | ⚠️ **FSL-1.1-MIT** — competing-product restriction; legal grey zone for an agent-bearing editor | Charm, active | Go binary |
| **Aider** | ❌ no protocol/server interface | litellm (broad) | Mature, architect mode | Apache-2.0 | Active | Python |
| **Pi** (badlogic) | ACP via pi-acp adapter | Provider-agnostic | Minimal harness | UNVERIFIED | Single-author bus factor ⚠️ | TS |
| **Factory Droid** | ACP native | Multi-model | Strong bench claims (UNVERIFIED) | **Closed-source** ❌ | Factory Inc. | binary |
| **Amp** (Sourcegraph) | CLI only | **Not BYOK** ❌ | — | Proprietary ❌ | Sourcegraph | binary |

## 13. The Agent Client Protocol (ACP) — the Strategic Core

**ACP is now the standard for editor↔agent embedding, and it's independently governed.**

- **Transport:** JSON-RPC 2.0, newline-delimited over stdin/stdout — **identical to our
  `codexAppServer.ts` wire model**.
- **Governance:** moved from Zed (`@zed-industries/agent-client-protocol`, deprecated) to a
  dedicated [`agentclientprotocol` GitHub org](https://github.com/agentclientprotocol) with
  GOVERNANCE.md; official SDKs in **TypeScript** ([`@agentclientprotocol/sdk`](https://www.npmjs.com/package/@agentclientprotocol/sdk)
  v0.22.1, **Apache-2.0**), Rust, Python, Java, Kotlin. Protocol version `1` is stable.
  JetBrains co-drove the registry spec; the **ACP Registry went live 2026-01-28**.
- **Protocol fit for Ritemark (verified):**
  - `initialize` → capability negotiation; `session/new` / `session/load` / `session/prompt` /
    `session/cancel` → session management ✅
  - `session/update` notifications → streaming message chunks + tool-call events ✅
  - `fs/read_text_file` / `fs/write_text_file` → **agent calls the client for file I/O** —
    client-proxied writes, Ritemark gates every edit ✅
  - `session/request_permission` → approval gating ✅
- **What one ACP client unlocks today:** OpenCode, Goose, Qwen Code, OpenHands, Cline,
  GitHub Copilot CLI (preview), Factory Droid, Kimi CLI, Kiro CLI, Mistral Vibe, Augment —
  plus, via Zed-maintained adapters: **Claude Code, Codex CLI, Gemini CLI, Pi**.
  Not available: Crush.

**Verdict:** "Build one ACP client" beats "embed one specific harness." It is structurally immune
to the exact failure mode that killed Phase I/II (a vendor deprecating its CLI), and it converts
Ritemark's third-runtime slot into an open socket rather than another bespoke integration.

## 14. OpenCode — the Recommended Default Agent

- **License: MIT** (verified). v1.15.13 (2026-05-30), **168K stars**, 814 releases, ~66% TypeScript.
  Maintained by SST (Dax Raad).
- **Three embedding paths** (use #1):
  1. **First-party ACP**: [`opencode acp`](https://opencode.ai/docs/acp/) — "ACP-compatible
     subprocess that communicates with your editor over JSON-RPC via stdio." Exposes built-in
     file/terminal tools, MCP servers, AGENTS.md rules, slash commands, permission system.
     (Known gap: `/undo`, `/redo` unsupported over ACP.)
  2. **HTTP server**: [`opencode serve`](https://opencode.ai/docs/server/) — OpenAPI 3.1, SSE
     event stream, session create/fork/revert, **`/session/:id/permissions/:permissionID`**
     approval endpoint. Fallback path if ACP gaps bite.
  3. **`@opencode-ai/sdk`** — typed TS client generated from the OpenAPI spec.
- **BYOK:** [75+ providers](https://opencode.ai/docs/providers/) via Models.dev — Anthropic,
  OpenAI, **Google Gemini / Vertex**, OpenRouter, Azure, Bedrock, Ollama, LM Studio, llama.cpp.
  Keys via `/connect` → `auth.json`, env vars, or `opencode.json`.
- **History note:** the 2025 OpenCode/Charm naming dispute resolved cleanly — Charm rebranded
  theirs to Crush; SST kept the name. No licensing cloud over today's MIT sst/opencode.
- **Community sentiment:** *"OpenCode treats you like a developer. Claude Code treats you like a
  user"* (Reddit); HN reports OpenCode + frontier models competitive with or beating Claude Code
  on specific tasks. Consensus: closest open analog, "less polished, more setup." Claude Code
  still dominates real-world usage (~10% of public GitHub commits, peak 326K/day in March 2026) —
  OpenCode leads on stars (168K vs ~124K).

## 15. Sustainability & Risk Notes

- **OpenCode bus factor:** driven by SST (a company, not a foundation). Mitigated by the
  protocol-first approach: **Goose** (Apache-2.0, Linux Foundation Agentic AI Foundation-governed,
  alongside MCP and AGENTS.md, 49 member orgs) plugs into the **same ACP client** at zero extra
  protocol cost.
- **ACP version churn:** TS SDK is pre-1.0 (`0.22.x`) though protocol v1 is stable — pin the
  version, watch for breaking changes.
- **Crush:** recommend **against** bundling — FSL-1.1-MIT's competing-product restriction
  ([discussion #1482](https://github.com/charmbracelet/crush/discussions/1482)) is a real risk
  for a commercial agent-bearing editor, and it has no embedding interface anyway.
- **Quality is the user's model choice:** BYOK means output quality tracks the model the user
  pairs with the harness. Set expectations accordingly.

* * *

## 16. Final Recommendation

1. **Adopt ACP as Ritemark's third runtime layer.** New module `extensions/ritemark/src/acp/`
   built on `@agentclientprotocol/sdk` (Apache-2.0). Implement the *Client* side: process
   spawning, `session/update` → `AgentProgressType` mapping, `fs/*` handlers, and
   `session/request_permission` wired to the existing approval UI.
2. **Bundle OpenCode (MIT) as the default ACP agent**; surface it in `AgentSelector` as the
   BYOK option ("bring any key: Gemini, GPT, Claude, local"). Consider Goose as a second
   bundled agent for governance diversity.
3. **Effort estimate: ~0.5–0.7× of the Codex integration.** The Codex work (~2,438 LOC) already
   solved JSONL parsing, request/response correlation, server-initiated approvals, and event
   dispatch; ACP is the same shape *and* provides a maintained SDK for the wire layer. Mapping:
   `thread.start`→`session/new`, `turn.start`→`session/prompt`, codex approvals→
   `session/request_permission`, codex events→`session/update`.
4. **Gemini models arrive via OpenCode BYOK** — no Google CLI dependency. The lighter
   alternative (direct `@google/genai` as a model provider in Ritemark's own loop) remains on
   the table if a full runtime sprint is deferred.
5. **Do not build on Gemini CLI, Antigravity CLI, Crush, or Amp.**
6. **Re-evaluate Antigravity ~Q4 2026** only if it gains ACP support
   ([watch Zed #57221](https://github.com/zed-industries/zed/discussions/57221)) — at which point
   it would plug into the same ACP client anyway, vindicating the protocol-first approach.

* * *

## 17. Unverified Items

- Existence of `@google/gemini-cli-sdk` (third-party claim; not found on npm/official docs)
- Gemini CLI: A2A server mode; headless device-code OAuth; full base-prompt override
- Verbatim text of Antigravity ToS Section 6; legality of a BYOK third-party SDK client (officially unanswered)
- Antigravity CLI exact model lineup and quota numbers (single-source hands-on blogs); existence of any Node/TS Antigravity SDK
- Goose "matches proprietary at scale" quality claim (self-claim)
- Factory Droid Terminal-Bench ranking and license; Cline exact license; Pi license; Continue CLI status

* * *

## 18. Sources

**Phase I — Gemini CLI:**
- [Google Developers Blog — Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [GitHub Discussion #27274 — official transition thread](https://github.com/google-gemini/gemini-cli/discussions/27274)
- [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) · [ACP Mode docs](https://geminicli.com/docs/cli/acp-mode/) · [Headless mode](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md)
- [Issue #15539 — Create a Formal SDK (closed, undelivered)](https://github.com/google-gemini/gemini-cli/issues/15539)
- [Zed external agents](https://zed.dev/docs/ai/external-agents) · [Quotas & pricing](https://geminicli.com/docs/resources/quota-and-pricing/) · [Authentication](https://geminicli.com/docs/get-started/authentication/)

**Phase II — Antigravity CLI:**
- [google-antigravity/antigravity-cli](https://github.com/google-antigravity/antigravity-cli) · [antigravity-sdk-python](https://github.com/google-antigravity/antigravity-sdk-python) · [SDK announcement](https://antigravity.google/blog/introducing-google-antigravity-sdk)
- [Google I/O 2026 developer highlights](https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/) · [Google Antigravity — Wikipedia](https://en.wikipedia.org/wiki/Google_Antigravity)
- [The Register](https://www.theregister.com/ai-ml/2026/05/20/bye-bye-gemini-cli-google-nudges-devs-toward-antigravity/) · [The New Stack](https://thenewstack.io/google-antigravity-cli/) · [FOSS Force](https://fossforce.com/2026/05/gemini-clis-short-life-and-googles-antigravity-bait-and-switch/) · [HN thread](https://news.ycombinator.com/item?id=48196867)
- [Zed discussion #57221 — Antigravity ACP request](https://github.com/zed-industries/zed/discussions/57221)
- [OpenClaw ban — Google AI forum](https://discuss.ai.google.dev/t/issue-with-antigravity-account-suspension-due-to-openclaw-oauth-usage/126426) · [ToS Section 6 BYOK question (unanswered)](https://discuss.ai.google.dev/t/clarification-on-tos-section-6-is-a-byok-bring-your-own-key-third-party-client-permissible-via-the-sdk/146844)

**Phase III — Open harnesses & ACP:**
- ACP: [protocol overview](https://agentclientprotocol.com/protocol/overview) · [agents list](https://agentclientprotocol.com/get-started/agents) · [`@agentclientprotocol/sdk` on npm](https://www.npmjs.com/package/@agentclientprotocol/sdk) · [ACP Registry launch](https://zed.dev/blog/acp-registry)
- OpenCode: [repo](https://github.com/sst/opencode) · [ACP docs](https://opencode.ai/docs/acp/) · [server docs](https://opencode.ai/docs/server/) · [providers](https://opencode.ai/docs/providers/)
- Goose: [repo](https://github.com/block/goose) · [ACP providers](https://goose-docs.ai/docs/guides/acp-providers) · Linux Foundation AAIF press release
- Crush: [repo](https://github.com/charmbracelet/crush) · [license discussion #1482](https://github.com/charmbracelet/crush/discussions/1482) · [fsl.software](https://fsl.software)
- OpenHands: [repo](https://github.com/OpenHands/OpenHands) · [SDK docs](https://docs.openhands.dev/sdk)
- Qwen Code: [repo](https://github.com/QwenLM/qwen-code)

**Internal prior art:**
- `docs/development/analysis/2026-02-14-codex-cli-chatgpt-integration.md` · `agent-sdk-redistribution.md` · [issue #92 (Cursor CLI runtime)](https://github.com/ProductoryHQ/ritemark-native/issues/92)

# Gemini / Antigravity CLI as a Third Agent Runtime — Research Analysis

**Date:** 2026-06-01
**Issue:** [#52 — Research Gemini CLI equivalent for agent offerings](https://github.com/ProductoryHQ/ritemark-native/issues/52)
**Status:** Research complete — recommendation: **don't embed either CLI; offer Gemini via direct `@google/genai` BYOK as a model provider**

* * *

## Executive Summary

This research ran in two phases: **Phase 1** evaluated Google's open-source **Gemini CLI** as a
third embedded agent runtime (alongside Claude Code SDK + Codex). **Phase 2** evaluated its
closed-source successor, **Antigravity CLI**, for sustainability and market reception.

**Phase 1 verdict — Gemini CLI exists and is technically embeddable, but it's a dead end.**
[Gemini CLI](https://github.com/google-gemini/gemini-cli) (Apache-2.0, ~105K stars, npm
`@google/gemini-cli`) is comparable to Codex CLI and embeddable via its **ACP mode**
(`gemini --acp`, JSON-RPC 2.0 over stdio) — the same pattern as our Codex `codex-app-server`
integration, and the path Zed uses. However:

> **On 2026-06-18, Google sunsets Gemini CLI for free / Google AI Pro / Ultra users**, steering
> consumers to **Antigravity CLI**. After that date, Gemini CLI only works with **paid Gemini API
> keys / Vertex AI / enterprise accounts**, and the open-source repo receives enterprise-only fixes.
> Source: [Google Developers Blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/),
> [GitHub Discussion #27274](https://github.com/google-gemini/gemini-cli/discussions/27274)

**Phase 2 verdict — Antigravity CLI is NOT a viable replacement for embedding, and waiting for
it is not a strategy.** The Antigravity *platform* (IDE + CLI + SDK, built by the ~$2.4B
Windsurf/Codeium acquihire team under Varun Mohan) is strategically core to Google and will
likely persist. But everything that matters for *embedding in a third-party editor* moves in the
wrong direction:

1. **Closed-source.** The public repo distributes a precompiled Go binary (`agy`); no source.
2. **ACP support was dropped** (Gemini CLI had it). No stdio/JSON-RPC embedding surface, no
   commitment to add one ([Zed discussion #57221](https://github.com/zed-industries/zed/discussions/57221):
   "it's entirely on Google to do so").
3. **ToS-hostile to third-party clients.** ToS Section 6 prohibits accessing the Antigravity
   Service via OAuth from third-party apps. **Verified precedent:** Google banned OpenClaw users
   (Feb 2026) for using Antigravity OAuth tokens in a third-party client, with Varun Mohan
   personally enforcing. Whether even a BYOK third-party client is permitted remains
   [officially unanswered](https://discuss.ai.google.dev/t/clarification-on-tos-section-6-is-a-byok-bring-your-own-key-third-party-client-permissible-via-the-sdk/146844).
4. **Market sentiment is strongly negative** — "open-source bait-and-switch" is the dominant
   narrative (211 downvotes vs 3 upvotes on Google's own transition thread; press: The Register,
   The New Stack, FOSS Force). Developers report moving to Anthropic/OpenAI as the more open,
   stable platforms to build on.

**Verdict on the three "Requested outcome" items in #52:**

| #52 asked | Answer |
| --- | --- |
| Does a comparable Gemini CLI exist? | Yes — `@google/gemini-cli` — but consumer-deprecated 2026-06-18; its successor (Antigravity CLI) is closed and un-embeddable |
| Capabilities and limitations | Documented below (Part I §3–§6 for Gemini CLI, Part II for Antigravity) |
| Suitable for Ritemark's agent experience? | **Neither CLI is.** Sustainable path: offer **Gemini as a model provider** via the direct **`@google/genai` SDK (BYOK)** — Ritemark keeps owning the agent loop. Re-evaluate Antigravity ~Q4 2026 only if it gains ACP + embedding-friendly ToS. |

* * *

# Part I — Gemini CLI

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

## 2. Gemini CLI at a Glance

| Attribute | Finding |
| --- | --- |
| Repo | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) — ~105K stars, 6,000+ external PRs merged, 508 releases |
| Latest stable | v0.44.1 (2026-05-28); weekly stable + weekly preview + nightly cadence |
| License | **Apache 2.0** — redistribution/bundling in a commercial app is permitted (NOTICE attribution required) |
| Distribution | npm `@google/gemini-cli` (Node ≥ 20 process). **No standalone native binary** — unlike `codex-app-server` |
| Maintenance | 🔴 **Consumer-deprecated effective 2026-06-18**; enterprise-only fixes thereafter; successor (Antigravity CLI) is closed-source |

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

## 6. Capability Comparison

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
subscription, and Google Cloud's enterprise agent push (Managed Agents, Gemini Enterprise Agent
Platform). Heavy capital + talent commitment. Unlikely to be killed at the platform level.

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

## 11. Recommendation

1. **Do not embed Gemini CLI** (consumer-deprecated 2026-06-18, frozen for our use case).
2. **Do not wait for Antigravity CLI** (closed-source, ACP-less, ToS-hostile to third-party
   clients, negative market trajectory). "Wait for Google to open it up" is a bet against Google's
   demonstrated direction.
3. **If/when Gemini models are wanted in Ritemark: integrate the direct
   [`@google/genai`](https://ai.google.dev/gemini-api/docs) Gemini API SDK with BYOK** (user-supplied
   API key) — Node/TS-native, officially supported, sidesteps Antigravity ToS entirely (it's the
   Gemini API, not the Antigravity Service). Gemini becomes a **model provider** inside Ritemark's
   own agent loop, not a wholesale runtime swap. This is a much smaller sprint than a runtime
   integration.
4. **Stopgap option (not recommended as foundation):** an ACP-compatible community fork of
   Gemini CLI (Apache-2.0, `--acp` works today) could be embedded Codex-style, but inherits
   maintenance burden and will lag on new models post-cutover.
5. **Re-evaluate ~Q4 2026.** Signals to watch:
   - Antigravity CLI gains **ACP support** ([Zed discussion #57221](https://github.com/zed-industries/zed/discussions/57221))
   - Google answers the **ToS Section 6 BYOK question** ([forum thread](https://discuss.ai.google.dev/t/clarification-on-tos-section-6-is-a-byok-bring-your-own-key-third-party-client-permissible-via-the-sdk/146844))
   - A **Node/TS Antigravity SDK** with explicit embedding/redistribution rights ships

* * *

## 12. Unverified Items

- Existence of `@google/gemini-cli-sdk` (third-party claim; not found on npm/official docs)
- Any A2A server mode for Gemini CLI
- Headless device-code OAuth flow suitable for embedded auth
- Full base-system-prompt override beyond `GEMINI.md` context injection
- Verbatim text of Antigravity ToS Section 6 (paraphrased from developer forum); legality of a BYOK third-party SDK client (officially unanswered)
- Exact Antigravity CLI model lineup and quota numbers (single-source hands-on blogs)
- Existence of any Node/TS Antigravity SDK (none found)

* * *

## 13. Sources

**Phase 1 — Gemini CLI:**
- [Google Developers Blog — Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [GitHub Discussion #27274 — official transition thread](https://github.com/google-gemini/gemini-cli/discussions/27274)
- [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- [ACP Mode docs](https://geminicli.com/docs/cli/acp-mode/) · [Headless mode docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md) · [npm package overview](https://geminicli.com/docs/npm/)
- [Issue #15539 — Create a Formal SDK (closed, undelivered)](https://github.com/google-gemini/gemini-cli/issues/15539)
- [Zed external agents](https://zed.dev/docs/ai/external-agents) · [Zed ACP / Gemini CLI](https://zed.dev/acp/agent/gemini-cli)
- [Quotas & pricing](https://geminicli.com/docs/resources/quota-and-pricing/) · [Authentication](https://geminicli.com/docs/get-started/authentication/) · [MCP](https://geminicli.com/docs/tools/mcp-server/) · [Extensions](https://geminicli.com/docs/extensions/)
- [Gemini 3.5 Flash model card](https://deepmind.google/models/model-cards/gemini-3-5-flash/) · [Gemini 3 Flash in Gemini CLI](https://developers.googleblog.com/gemini-3-flash-is-now-available-in-gemini-cli/)

**Phase 2 — Antigravity CLI:**
- [google-antigravity/antigravity-cli](https://github.com/google-antigravity/antigravity-cli) · [antigravity-sdk-python](https://github.com/google-antigravity/antigravity-sdk-python) · [SDK announcement](https://antigravity.google/blog/introducing-google-antigravity-sdk)
- [Google I/O 2026 developer highlights](https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/)
- [Google Antigravity — Wikipedia](https://en.wikipedia.org/wiki/Google_Antigravity) (Windsurf acquihire background)
- [The Register — Bye bye Gemini CLI](https://www.theregister.com/ai-ml/2026/05/20/bye-bye-gemini-cli-google-nudges-devs-toward-antigravity/) · [The New Stack](https://thenewstack.io/google-antigravity-cli/) · [FOSS Force](https://fossforce.com/2026/05/gemini-clis-short-life-and-googles-antigravity-bait-and-switch/)
- [Hacker News thread on the transition](https://news.ycombinator.com/item?id=48196867)
- [Zed discussion #57221 — Antigravity CLI ACP request](https://github.com/zed-industries/zed/discussions/57221)
- [OpenClaw ban — Google AI forum](https://discuss.ai.google.dev/t/issue-with-antigravity-account-suspension-due-to-openclaw-oauth-usage/126426) · [ToS Section 6 BYOK question (unanswered)](https://discuss.ai.google.dev/t/clarification-on-tos-section-6-is-a-byok-bring-your-own-key-third-party-client-permissible-via-the-sdk/146844)

**Internal prior art:**
- `docs/development/analysis/2026-02-14-codex-cli-chatgpt-integration.md` · `agent-sdk-redistribution.md` · [issue #92 (Cursor CLI runtime)](https://github.com/ProductoryHQ/ritemark-native/issues/92)

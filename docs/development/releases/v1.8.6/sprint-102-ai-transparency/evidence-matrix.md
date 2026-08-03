# Sprint 102 — AI Disclosure Evidence Matrix

**Verified:** 2026-08-03  
**Scope:** Ritemark Native v1.8.5 baseline plus Sprint 102 branch changes  
**Purpose:** Source-of-truth evidence for in-product, support, Terms, and Privacy wording  
**Legal status:** Product evidence, not legal advice

## Runtime, Provider, Model, and Authentication

| Ritemark runtime | Provider/service shown to the user | Model source | Supported authentication evidenced in code | Evidence |
| --- | --- | --- | --- | --- |
| Claude Code | Anthropic | Claude models supplied in `agent:config`; the active conversation stores `selectedModel` and `pendingRuntime.modelId` | Claude OAuth or an Anthropic API key | `webview/src/components/ai-sidebar/store.ts`; `src/agent/setup.ts`; `src/agent/types.ts`; `src/views/UnifiedViewProvider.ts` |
| Codex | OpenAI | Codex models supplied in `agent:config`; the active conversation stores `codexSelectedModel` and `pendingRuntime.modelId` | ChatGPT sign-in or API-key authentication | `webview/src/components/ai-sidebar/store.ts`; `src/codex/codexAuth.ts`; `src/codex/CodexRuntime.ts` |
| OpenCode | The selected route: Google, OpenAI, Anthropic, or OpenRouter | Shared model catalogue; stored as `opencode:<provider>/<model>` | User-provided key for the selected service | `src/ai/modelCatalog/index.ts`; `src/acp/AcpRuntime.ts`; `webview/src/components/ai-sidebar/ChatInput.tsx` |

Sprint 102 resolves the disclosure identity from these existing conversation and catalogue values in `webview/src/components/ai-sidebar/aiDisclosure.ts`. It does not add a second runtime registry or hard-code a model identifier. A pending model ID is used only when it belongs to the selected runtime's catalogue, so stale state from a runtime switch cannot be displayed as the new runtime's model.

## Context Sent on an AI Turn

| Context category | Claude Code | Codex | OpenCode | User control / caveat | Evidence |
| --- | --- | --- | --- | --- | --- |
| User prompt | Sent | Sent | Sent | Required to start the turn | `store.ts` send actions; `UnifiedViewProvider.ts` `agent-execute` |
| Hidden Ritemark capability/instruction context | Sent | Sent | Sent | Provider-neutral shared capability context; selection and handoff context can also be prepended | `src/ai/capabilityContext.ts`; `store.ts`; `UnifiedViewProvider.ts` |
| Active file | Path/context available to the runtime | Path/context available to the runtime | Path/context available to the runtime | Composer chip can exclude the active file from that turn. Sprint 102 makes the exclusion reach Codex and OpenCode as well as Claude. An approved agent may later read workspace files with tools. | `ChatInput.tsx`; `store.ts`; `UnifiedViewProvider.ts`; runtime adapters |
| Selected text | Text, file path, and surrounding context window | Same | Same | Chat selection can be dismissed from the composer | `store.ts` `buildSelectionContextBlock()` |
| Explicit attachments | Image, PDF, and text payloads supported by Claude Code | Image payloads become Codex image inputs; text/PDF picker entries are not native Codex inputs | Attachment payload is composed into the ACP prompt path; model/provider interpretation varies | Only content explicitly attached; Sprint 102 fixes the missing OpenCode store-to-host payload | `src/agent/AgentRunner.ts`; `src/codex/CodexRuntime.ts`; `src/acp/AcpRuntime.ts`; `store.ts` |
| Browser context | Shared page summary/URL and optional screenshot | Same | Not injected | Consent-gated; removable for a turn. Sprint 102 hides the chip for OpenCode so the UI does not imply unsupported transmission. | `UnifiedViewProvider.ts:241-252`; `BrowserContextStore`; `ChatInput.tsx` |
| Cross-runtime handoff | Recent Codex/OpenCode response context can be prepended | Recent Claude context can be prepended | Recent Claude context can be prepended | Scoped to the same chat | `store.ts` `buildHandoffContext()` call sites |
| Tool results | Can be returned to the active runtime/session | Can be returned to the active runtime/session | Can be returned to the active runtime/session | Depends on allowed tools, permission mode, and approvals | Runtime adapters; `UnifiedApprovalGate`; browser tool injection path |

**Safe public wording:** files remain local as stored files, but prompt and relevant file, selection, attachment, browser, conversation, and tool context can leave the device when a cloud-connected runtime needs it. Do not say that prompts or file contents always remain local.

## AI Request Path

The desktop extension opens the selected local runtime session and calls its prompt API directly. The evidence found no Productory AI proxy in the sidebar execution path. Provider processing is governed by the provider/service account and configuration used by the user.

This statement does not mean “Ritemark sees nothing.” The Ritemark process constructs prompts, keeps local conversation state, invokes runtimes, and separately emits product analytics when enabled.

## Ritemark Analytics

| Claim | Verified behavior | Evidence |
| --- | --- | --- |
| Enabled state | `ritemark.analytics.enabled` defaults to `true`; `ritemark.features.analytics` is an additional kill switch | `extensions/ritemark/package.json`; `src/analytics/posthog.ts` |
| Identity | Random anonymous UUID stored in extension global state | `src/analytics/posthog.ts` |
| Destination | PostHog; packaged configuration supplies host/key, with `https://eu.i.posthog.com` as the default host | `src/analytics/posthog.ts` |
| Event inventory | App session, feature use, agent use, reaction, and feedback | `src/analytics/events.ts` |
| Prompt/file content | Not fields in app-session, feature, agent-use, or reaction events | `src/analytics/events.ts`; call-site sweep |
| Explicit feedback text | The text a user deliberately submits can be sent in `feedback_sent` | `src/analytics/reactions.ts`; `src/analytics/events.ts` |
| First-run notice | Shown once; offers opt-out and policy links | `src/analytics/posthog.ts` |

## Reliability and Human Review

The product can limit or request approval for actions, but approval does not validate the truth or suitability of model output. The Sprint 102 disclosure therefore tells users to review facts, citations, calculations, commands, and file changes before relying on, publishing, or acting on them.

This is a product-safety statement, not a claim that a particular review step satisfies a legal obligation.

## External Primary Sources

- [European Commission Article 50 guidelines](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems) — transparency obligations generally apply from 2 August 2026.
- [European Commission transparency quick facts](https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems) — interaction disclosure and AI-generated-content marking are distinct obligations.
- [Anthropic Claude Code data usage](https://code.claude.com/docs/en/data-usage) — the local runtime sends prompt/model data over the network for provider processing.
- [Anthropic Claude Code setup](https://docs.anthropic.com/en/docs/claude-code/getting-started) — current authentication options and network requirement.
- [OpenAI Codex CLI sign-in information](https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt) — ChatGPT sign-in/API relationship and account-side data choices.
- [OpenCode provider documentation](https://opencode.ai/docs/providers/) — OpenCode connects to configured external providers.

## Unresolved Legal Decisions

Engineering does not decide the following:

1. Productory's provider/deployer role for each Ritemark AI flow.
2. Whether Article 50(2) marking/detectability obligations attach to Ritemark, and whether any pre-2-August-2026 grace period applies.
3. Whether upstream provider markings exist and whether Ritemark preserves them.
4. Exact Article 50(4) wording for users publishing public-interest content.
5. Controller/processor wording for Productory, the user, and each external provider.

These questions are carried in [counsel-decision-memo.md](./counsel-decision-memo.md).

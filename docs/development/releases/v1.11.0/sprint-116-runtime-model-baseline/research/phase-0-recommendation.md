# Sprint 116 — Phase 0 recommendation

**Date:** 2026-09-13.<br>
**Status:** Approved by Jarmo on 2026-09-13. Implementation is authorized for the exact package, protocol, and catalog scope below.<br>
**Evidence:** [runtime-model-audit.md](./runtime-model-audit.md).

## Recommended runtime snapshot

Use Claude Code **2.1.270** with Claude Agent SDK **0.3.270**, Codex official app-server packages **0.154.0**, OpenCode **1.18.30** with its own ripgrep **15.1.0**, and ACP SDK **1.4.0**. The approved schema-v3 proposal is [candidate-package-manifest.json](./evidence/candidate-package-manifest.json): 12 downloaded source rows produce 25 installed files. The earlier [candidate-manifest.json](./evidence/candidate-manifest.json) is retained as the initial 14 single-artifact audit and is superseded for installation because it did not model the complete Codex package or OpenCode's first-use dependency.

Update the product manifest, validator version assertions and negative fixtures, extension dependency and lockfile together. Keep all eight Claude SDK optional packages in lockstep. Update runtime notices and target component counts. No floating dependencies or additional runtime are proposed.

All candidate archives passed integrity/layout/architecture checks. Apple Silicon startup, candidate SDK compilation and live continuation/tool probes support further evaluation of this set. Jarmo confirmed that the later Codex `thread/start` timeouts followed his denial of an unexpected macOS Keychain access prompt from the separately launched audit runtime; a fresh 0.154.0 direct file-tool canary subsequently passed. Native Intel/Windows execution and final packaging remain required before sprint close. Do not treat cross-platform archive inspection as native sign-off.

## Bounded compatibility work

1. **Codex effort cache:** support measured `default_reasoning_level` and object-valued `supported_reasoning_levels`, while preserving valid legacy schemas. Add a sanitized fixture covering a new model without bundled enrichment.
2. **Static catalog freshness:** prevent older remote and cached catalogs from replacing a newer bundled floor. Keep live discovery authoritative and equal-date source ordering unchanged; invalid static timestamps cannot override the dated bundled floor. Cover all cases in regression tests and architecture documentation. This is the only proposed resolver-policy adjustment, justified by reproductions of remote-only, cache-only and combined inputs.
3. **Conversation isolation:** drop explicit unknown Codex thread IDs before the single-session fallback. Verify stale completion, text and approval events cannot reach the surviving conversation.
4. **Cancellation:** handle only the measured Codex race: wait for `turn/started`, retry the exact `no active turn to interrupt` response once, and track the exact turn completion. The final adapter passes immediate Stop and immediate resend. Claude's unchanged persistent AgentSession passed cancellation during approval and immediate follow-up in the same session.

## Catalog and default policy

Centralize canonical IDs in `modelConfig.ts` and derive bundled projections/routes from them. Continue using the existing catalog service for availability and presentation. Preserve stored selections; do not silently rewrite saved Flows or conversation models.

| Surface | Proposed change | Default policy |
|---|---|---|
| Codex | Add `gpt-6-astra`; carry measured per-model effort ranges and default efforts | Retain curated `gpt-5.6-sol`; represent the live runtime's Astra default accurately |
| Claude | Add `claude-fable-5-1`; deduplicate the measured Opus aliases while keeping selector/resolved identity | Preserve current product selection; no blanket move to the most expensive model |
| OpenAI text | Add `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` with API-specific capabilities | Keep assistant `gpt-4o-mini` and Flow `gpt-5.2`, subject to account canary |
| Gemini text | Replace retired Pro preview with `gemini-3.1-pro-preview`; add `gemini-3.8-flash` and `gemini-3.5-flash-lite` | Keep Flow `gemini-2.5-flash`, subject to account canary |
| OpenAI images | Remove retired choices from new selection; mark deprecated models; validate Image 2 and optional Image 2.5 entries | Propose `gpt-image-2` after generation/edit contract check |
| Gemini images | Replace retired Imagen/preview entries with current native image choices | Propose `gemini-3.1-flash-image` after generation/edit contract check |
| OpenCode/BYOK | Derive complete provider/model routes; add only routes the actual provider advertises | Preserve route and user choice; no inferred cross-provider effort levels |

These model changes are a concrete proposal, **not an authenticated availability claim**. The audit links dated primary sources and live runtime evidence. New API/BYOK choices and image defaults must pass account-specific discovery and bounded execution before catalog freeze. Existing quality/effort controls are sufficient; no new controls or extra effort vocabulary are proposed.

## Remaining evidence after the product decision

- Access through the intended Ritemark credential path for direct OpenAI/Gemini/Anthropic APIs and OpenCode BYOK. Environment keys were absent; whether Ritemark Settings already contain them is pending clarification. Never ask for keys in chat.
- Native Intel/Windows execution of the approved package tree. Archive/member/hash/architecture inspection passes for all targets; native execution remains a CI gate.
- Full supported/unsupported/Auto effort matrix on the final candidates.
- Codex immediate Stop and immediate resend passed through the final adapter in `codex-session-cancel-final.json`.
- Auth failure/provider isolation and actual shared approval/browser-injection checks. Unit tests and current direct canaries are partial evidence, not the complete behavior matrix.
- Explicit allocation of native Intel and Windows runners for the later native gate.

Jarmo supplied the separate product decision on 2026-09-13 after reviewing this package. Native Intel/Windows execution and signed application verification remain evidence gates; they do not alter the approved pins.

## Rollback and external tracker

Restore the exact source snapshot `30ea2ab32d15be161991d1bb8924a4c4ca331f8c` and the coupled manifest/SDK/adapter inputs recorded in [baseline.json](./evidence/baseline.json). Keep retired-model corrections explicitly separated in the rollback decision, since provider shutdowns are irreversible from the application side.

The [GitHub issue draft](./github-issue-draft.md) is prepared for `ProductoryHQ/ritemark-native`, milestone [v1.11.0](https://github.com/ProductoryHQ/ritemark-native/milestone/11). Automatic approval review rejected issue creation because publication of that payload to that destination lacked explicit authorization. It remains local; no retry through another channel has been made.

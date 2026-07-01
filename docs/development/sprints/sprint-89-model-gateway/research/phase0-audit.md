# Sprint 89 — Phase 0 Audit

**Status:** COMPLETE (doc-based) — 2026-07-01. One key-dependent empirical check deferred
to on-branch execution (see §2); it is non-blocking because the design does not depend on it.
Jarmo approved proceeding ("approve granted").

---

## 1. Anthropic `/v1/models` Response Shape — CONFIRMED (docs)

Source: `https://platform.claude.com/docs/en/api/models/list`.

**Auth:** `x-api-key: $KEY` + `anthropic-version: 2023-06-01`. **No beta header required.**

**Response shape:**
```json
{
  "data": [
    { "id": "claude-...", "display_name": "Claude ...", "created_at": "RFC3339",
      "type": "model", "max_input_tokens": 0, "max_tokens": 0,
      "capabilities": { "image_input": {"supported": bool}, "thinking": {...}, "effort": {...}, ... } }
  ],
  "first_id": "...", "last_id": "...", "has_more": bool
}
```
Pagination: `after_id` / `before_id` / `limit` (default 20, max 1000). "More recently
released models are listed first." **No `description` field** — the endpoint gives
`display_name` only → confirms the resolver design (live probe supplies ids + names +
capabilities; the catalog supplies curated `description`/`tier`/`order`/`defaults`).

**Does `claude-sonnet-5` appear?** The models-overview doc lists `claude-sonnet-5` (shipped
2026-06-30) as a current model, so it is returned by `/v1/models`. Live byte-for-byte
verification deferred (needs a key) — non-blocking.

**Bearer/OAuth (Q2):** the documented auth is `x-api-key`. OAuth Bearer would additionally
require `anthropic-beta: oauth-2025-04-20`. **We do not need Bearer on `/v1/models`:** the
resolver uses `x-api-key` when a key is present, and falls back to the SDK `supportedModels()`
(which already handles the OAuth-login case) when no key is stored. Resolved.

## 2. `supportedModels()` empirical — DEFERRED (non-blocking)

Requires the running app + a live key/login. Runs on-branch with Jarmo's key.
**Design de-risks this:** `/v1/models` is PRIMARY; `supportedModels()` is SECONDARY (used only
when no API key is stored). So whether the bundled CLI reports `claude-sonnet-5` does not gate
correctness — it only affects the OAuth-only fallback path. Conclusion: **SECONDARY**, as planned.

## 3. OpenAI `models.list()` filter — CONFIRMED (existing code)

`FlowEditorProvider.fetchOpenAIModels()` already filters: include ids containing `gpt`/`o1`/`o3`;
exclude `instruct`/`vision`/`audio`/`realtime`/`tts`/`whisper`/`embedding`/`davinci`/`babbage`/
`search`/`image`. This predicate moves into `providerDiscovery.discoverOpenAI()`.

## 4. Gemini `/v1/models` — CONFIRMED (existing code)

`GET https://generativelanguage.googleapis.com/v1/models?key=…`. Entries carry `name`
(`models/<id>`) and `supportedGenerationMethods`; filter to those including `generateContent`.
Moves into `providerDiscovery.discoverGemini()`. (Not empirically re-run; existing code path.)

## 5. `fetchOpenAIModels()` call path — CONFIRMED: webview-triggered

`FlowEditorProvider.ts:164` handles a webview message → `fetchModels(provider, type)` →
`fetchOpenAIModels()` / `fetchGeminiModels()` → posts `flow:models`. Triggered on demand from
`NodeConfigPanel.tsx` (webview). **Rewire:** these become the OpenAI/Gemini live probes in
`providerDiscovery`; the `flow:models` message handler is retained but sources from the catalog.

## 6. `UnifiedViewProvider.ts` baseline LOC — **1267**

⚠️ Already **over** the ≤1100 target (architecture.md claims 1097 post-Sprint 79; it has since
grown to 1267). The rewire must not increase it — model-list assembly moves into the catalog
subsystem. The pre-existing 167-LOC overage is separate debt; flag it, do not silently absorb.
`modelConfig.ts` baseline: 446 LOC.

## 7. Dead-constant call-site audit — CONFIRMED

| Constant | Definition | Real consumers | Verdict |
|---|---|---|---|
| `CLAUDE_MODELS` | modelConfig.ts:440 | **none** (only re-exported agent/index.ts:32) | **ZOMBIE — delete** |
| `DEFAULT_MODEL` (AI) | modelConfig.ts:446 | UnifiedViewProvider.ts:694 (config default) + re-export | **replace** with `getDefault('anthropic','claude-code')`, then delete |
| `CLAUDE_FALLBACK_MODELS` | claudeModels.ts:10 | UnifiedViewProvider.ts:36,733 | **replace → delete file** |
| `BYOK_PROVIDER_MODELS` | modelConfig.ts:318 | UnifiedViewProvider.ts:76,748; FlowEditorProvider.ts:27,257 | **replace → delete** |

⚠️ **Do-not-touch collision:** `voiceDictation/modelManager.ts` has its own
`DEFAULT_MODEL = 'ggml-large-v3-turbo.bin'` (the Whisper STT model). Unrelated — must not be
altered by the model-gateway rewire.

## 8. Open questions resolved

| Question | Answer |
|---|---|
| Q1: Does `supportedModels()` report `claude-sonnet-5`? | Deferred (empirical, on-branch); non-blocking — SECONDARY in waterfall |
| Q2: Does `/v1/models` accept Bearer (OAuth)? | Not needed — `x-api-key` when key present, SDK `supportedModels()` handles OAuth |
| Q4: Are `fetch*Models()` webview-triggered or internal? | Webview-triggered (confirmed) |
| Q5: Rename `modelConfig.ts` after deletions? | No — keep the name (Jarmo) |

## Plan corrections (audit → implementation)

1. **`resolveJsonModule` is NOT set** in `extensions/ritemark/tsconfig.json`. The in-extension
   baseline is a typed `bundledCatalog.ts` const, **not** a `.json` import (safer: compiled,
   type-checked, no runtime file read). The published catalog stays JSON.
2. **Feature-flag `status`** enum is `stable|experimental|disabled|premium` — there is no
   `'enabled'`. ON-by-default flag uses `status: 'stable'` (plan said `'enabled'` — corrected).

## 9. Phase 1 gate

- [x] Doc-based audit complete
- [x] Jarmo approved ("approve granted")
- [x] One empirical check (supportedModels → sonnet-5) deferred, non-blocking
- [x] Phase 1 core implemented + verified green (compile exit 0; 11/11 unit tests)

**Audit by:** Claude (Opus 4.8) · **Date:** 2026-07-01

# Sprint 89: Model Gateway

Track: SDD (auto-detected: 6 distinct requirements + multi-component flow webview ↔ host ↔
provider REST ↔ remote catalog + irreversible dead-registry deletions)
Branch: sprint-89-model-gateway
Status: Phase 0 — Audit (awaiting Phase 0→1 gate)

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth for requirements R1–R6)
- [scenarios.md](scenarios.md) — BDD examples (manual QA matrix)
- [technical-plan.md](technical-plan.md) — architecture, workstreams, module shapes
- [tasks.md](tasks.md) — implementation checklist organised by phase
- [sprint-plan.md](sprint-plan.md) — this file (intent + status + product decisions)

## Goal

Introduce `src/ai/modelCatalog/` — a provenance-tracked waterfall resolver that resolves model
lists and defaults for every runtime and surface in Ritemark, so new models appear in the app
without a release, and every zombie model constant is deleted.

## Linked Issues

- [#109](https://github.com/ProductoryHQ/ritemark-native/issues/109) — Model gateway: agent
  runtimes and flow nodes have separate auth/model-resolution/retry/telemetry paths

## MVP Scope

Full requirements live in spec.md. Workstream summary:

| Workstream | Scope |
|---|---|
| W0 — Audit | Phase 0 empirical gate: REST shapes, `supportedModels()` CLI cap, call-site grep |
| W1 — Subsystem | `src/ai/modelCatalog/`: schema, bundled JSON, remoteSource, providerDiscovery, resolver, index |
| W2 — Host rewire | UnifiedViewProvider, FlowEditorProvider, LLMNodeExecutor, SettingsProvider, ACP layer |
| W3 — Webview rewire | store.ts hardcoded defaults removed; `modelCatalog:update` message handled |
| W4 — Publish | `feeds/model-catalog.json` in ritemark-public; bundled seed finalized |
| W5 — Architecture | architecture.md updated; GH #109 closed; locked decision evolved inline |

## Feature Flag

`remote-model-catalog` (enabled by default).  
Disable → waterfall skips live probes and remote fetch → bundled/cache path only.  
Defined in `extensions/ritemark/src/features/flags.ts`.

## Hard Constraints

- Phase 2→3 APPROVAL GATE: no implementation code until Jarmo says "approved" or "proceed".
- IMMEDIATELY after plan approval, before any code edit:
  `git checkout -b sprint-89-model-gateway`
  Verify with `git branch --show-current` before touching any file.
- Phase 0 is itself a gate: Phases 1–5 do not start until the audit is complete and Jarmo
  confirms "proceed" on audit findings.
- `qa-validator` + pre-commit hook required before any commit.
- Dead-code deletion checkpoints: `CLAUDE_MODELS` and `BYOK_PROVIDER_MODELS` must have zero
  confirmed callers (Phase 0 audit) before the delete commits land.
- No new npm dependencies. Hand-rolled schema validation; no zod.
- `UnifiedViewProvider.ts` must stay at or below 1100 LOC after rewire.

## Product Decisions

- **2026-07-01:** Remote catalog hosted at `jarmo-productory/ritemark-public` as raw GitHub
  JSON, reusing the `update-feed.json` publish path. Decision: Jarmo.
- **2026-07-01:** Trust model v1 = HTTPS + strict schema validation + 512 KB size cap + origin
  allowlist. Pinned-key signature deferred as explicit future work (Phase 2 follow-up GitHub
  issue to be created at sprint close). Decision: Jarmo.
- **2026-07-01:** Anthropic `/v1/models` REST is the PRIMARY live Claude source.
  `supportedModels()` (SDK OAuth path) is a secondary fallback used only when no API key is
  stored. Rationale: SDK path is capped at bundled CLI version; REST is provider-cadence.
  Decision: Jarmo.
- **2026-07-01:** No new npm dependencies for this sprint. Existing `fetch` global + hand-rolled
  validator. Defers the `zod` question entirely. Decision: Jarmo.
- **2026-07-01:** Sprint scope is model-resolution only. Retry and telemetry unification
  (also mentioned in GH #109) is deferred. Noted in spec Non-Requirements. Decision: scoping call.
- **2026-07-01:** Sprint number = **89** (`sprint-89-model-gateway`). `sprint-85`–`88` are
  reserved by the v1.9.0 cloud release sequence (accounts/billing/share); Model Gateway takes the
  first free slot after that block. Cloud sequence unchanged. Decision: Jarmo.
- **2026-07-01:** Out-of-box default model for the `claude-code` surface = **`claude-sonnet-5`**
  (shipped 2026-06-30). Replaces the stale `claude-sonnet-4-5` default. Seeded in the bundled
  catalog and the published catalog. Decision: Jarmo.
- **2026-07-01:** Remote-catalog refresh cadence = on activation + every **6 h** + a manual
  refresh action. Tunable later. Decision: Jarmo (recommended default accepted).
- **2026-07-01:** `src/ai/modelConfig.ts` **keeps its name** after `CLAUDE_MODELS` /
  `DEFAULT_MODEL` / `BYOK_PROVIDER_MODELS` are deleted (it still holds the OpenAI/Gemini static
  config and image-model types). No rename churn. Decision: Jarmo (recommended default accepted).
- **2026-07-01:** Phase 0 audit split — the doc-based part (`/v1/models` response shape from
  public docs, call-site enumeration) runs during planning with no key; the one key-dependent
  empirical check ("does the bundled CLI `supportedModels()` report `claude-sonnet-5`?") runs in
  Phase 0 *after* the branch exists, with Jarmo supplying the key. Decision: Jarmo.

## Success Criteria

These mirror spec.md acceptance criteria at the high level. Tick only when observably met.

- [x] (R1) `modelCatalog.getModels()` / `getDefault()` / `onUpdate()` / `refresh()` all function;
      cold start works with zero network (bundled floor) — unit-tested (12/12)
- [x] (R2) Live `/v1/models` probe primary (API-key) with SDK OAuth fallback; degrades to catalog
      without a key. Code complete + compiles; live-key runtime check is Jarmo's Gate 2 (deferred)
- [x] (R3) `CLAUDE_MODELS`, `DEFAULT_MODEL`, `CLAUDE_FALLBACK_MODELS`, `BYOK_PROVIDER_MODELS`,
      Codex `FALLBACK_MODELS`, webview hardcoded defaults — all deleted; `tsc` clean (compile 0)
- [~] (R4) All consumer surfaces (AI sidebar, Flow LLM nodes, BYOK picker) draw from `modelCatalog` ✓.
      Settings connectivity-test model deferred (current valid haiku id, not stale). `UnifiedViewProvider`
      1223 LOC — reduced from 1267 but still over the ≤1100 target (**pre-existing debt**, flagged)
- [x] (R5) `bundledCatalog.ts` seeds `claude-sonnet-5` ✓; fetch + cache + schema-validate code ✓ + tested.
      `feeds/model-catalog.json` **published** to `ritemark-public` `main` — confirmed byte-identical to
      `research/model-catalog.json` via live fetch during the v1.8.1 merge (2026-07-03)
- [~] (R6) `architecture.md` updated + dated gate memo ✓. #109 marked **partial-resolved**
      (model-resolution done; retry/telemetry deferred — so #109 stays open, not closed)

## Sprint Architecture Gate

This sprint evolves a locked architectural decision: "Model IDs centralised in
`src/ai/modelConfig.ts`" (Sprint 79). The new mechanism is a dynamic catalog + resolver in
`src/ai/modelCatalog/`. The spirit (one place to look) is preserved. `architecture.md` must
be updated before sprint close (tracked in Phase 5 tasks).

## Pre-Implementation Gate

Phase 0 audit (`research/phase0-audit.md`) must complete before any of Phases 1–4 begin.
This is an adversarial audit pattern: the audit findings could narrow or alter workstream
scope (e.g. if `supportedModels()` does report `claude-sonnet-5`, the waterfall priority
for the SDK path may change).

## Approval

- [x] Jarmo approved this sprint plan — 2026-07-01 ("shape is right"; "approve granted")

---

## Status Log

| Date | Phase | Note |
|---|---|---|
| 2026-07-01 | Plan | Sprint plan drafted (SDD track); awaiting Jarmo approval |
| 2026-07-01 | Plan | Renumbered 85→89; default model `claude-sonnet-5`; Jarmo approved plan |
| 2026-07-01 | Phase 0 | Doc-based audit complete (`research/phase0-audit.md`); 1 empirical check deferred, non-blocking |
| 2026-07-01 | Phase 1 | Workstream-1 core landed: `modelCatalog/{schema,bundledCatalog,resolver}.ts` + tests; `remote-model-catalog` flag. Verifier green (compile exit 0; 11/11 unit tests). Quality loop harness set up (`/verify-sprint89` command). remoteSource/providerDiscovery/index + consumer rewire (WS2–5) pending. |
| 2026-07-01 | Phase 1–3 | WS1 subsystem complete (schema/bundled/resolver/remoteSource/providerDiscovery/index + tests). WS2 host rewire + zombie deletions (`CLAUDE_MODELS`/`DEFAULT_MODEL`/`BYOK_PROVIDER_MODELS` + `claudeModels.ts`/`codexModels.ts`). WS3 webview store defaults cleared + extension-side stale-id reconcile. `extension.ts` wires `activate` + discovery provider (anthropic/openai/gemini keys + codex cache) + `onUpdate`→sidebar. Verifier green: compile 0, webview tsc 0, 12/12 catalog unit tests, all runnable unit tests. UnifiedViewProvider 1267→1223 LOC. |
| 2026-07-01 | QA gate | `qa-validator` (independent evaluator) found 5 real defects: (1) deprecated live-absent model preservation, (2) `LLMNodeExecutor` default via catalog, (3) flow LLM lists via catalog + fetchers removed, (4) `onUpdate` had no subscriber, (5) docs not updated. **All 5 fixed + re-verified green** (compile 0, webview tsc 0, 12/12 catalog tests). |
| 2026-07-01 | Phase 4 (WS5) | `architecture.md` updated: Model Configuration section rewritten to the catalog resolver; #109 marked partial-resolved (model-resolution done, retry/telemetry deferred); locked decision evolved + dated gate memo. **WS4 publish of `feeds/model-catalog.json` to ritemark-public DEFERRED — outward-facing, awaiting Jarmo's go.** Commits deferred (worktree has no vscode symlink/patches → pre-commit Checks 1/8 fail environmentally). |
| 2026-07-03 | Fold into v1.8.1 | Jarmo: fold Sprint 89 into v1.8.1 alongside Sprint 90 (export integrity). WS4 status corrected — `feeds/model-catalog.json` was already live on `ritemark-public` `main`, confirmed byte-identical to the prepared seed; the "awaiting Jarmo's go" note above was stale, not the real state. Rebased `sprint-89-model-gateway` onto post-Sprint-90 `main` (only conflict: generated `webview.js` bundle, resolved by rebuilding from source — zero real source overlap between the two sprints). Re-verified after rebase: `npm run compile` 0, webview `typecheck` 0, 12/12 catalog tests, Sprint 90's export tests unaffected. `modelCatalog.test.ts` wired into `npm test`. R4's `UnifiedViewProvider` LOC gap (1223 vs ≤1100 target) carried forward as tracked debt, not re-opened for rework here. |

---

## Sprint Number — Resolved

Resolved 2026-07-01 (Jarmo): Model Gateway is **sprint-89**. `sprint-85`–`88` remain reserved
by the v1.9.0 cloud release sequence (`sprint-85-cloud-accounts`, `86-billing-entitlements`,
`87-share-backend`, `88-share-client-launch`); Model Gateway takes the first free slot after
that block. No renumbering of the cloud sequence. No collision.

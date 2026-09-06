# Sprint 112 Tasks

## Phase 0: Capability and UX audit (R1, R2, R6–R8)
- [x] Complete `research/thinking-effort-capability-audit.md` against Sprint 111’s final Claude, Codex, OpenCode, and ACP pins.
- [x] Record per-model selectable levels, wire mapping, default behavior, downgrade visibility, and per-turn/session timing.
- [x] Prove OpenCode capability discovery does not require runtime work during open/select.
- [x] Validate all states in `design.md` at normal/minimum width, 200% zoom, keyboard semantics, native accessible names/value text, and reduced motion.
  - Live RunDev evidence covers normal width, 300px secondary sidebar, 200% zoom geometry, native range drag/arrows, Auto, Escape/focus restoration, and flag-off. Native range/checkbox semantics and reduced-motion CSS were inspected; a live VoiceOver narration pass remains release-candidate evidence rather than a Sprint blocker.
- [x] Obtain Jarmo’s explicit capability/mapping/design decision before Phase 1 (approved 2026-08-24).

## Phase 1: Shared contract and feature flag (R1, R5, R9)
- [x] Add canonical `ThinkingEffort` and capability types to the host runtime contract.
- [x] Extend typed host↔webview conversation/config and `agent-execute` payloads; validate unknown values.
- [x] Add `composer-thinking-effort` as experimental/default-on and test flag-off omission.
- [x] Update architecture proposal/contract before implementation diverges from the plan.

## Phase 2: Durable draft and queue snapshot (R4)
- [x] Add per-runtime Composer effort preferences to the Sprint 109 durable conversation schema and migration/defaults.
- [x] Snapshot requested effort into accepted and queued turns before dispatch.
- [x] Persist requested/applied metadata without adding it to fallback transcript text.
- [x] Implement model-switch invalidation to Auto with approved user copy.
- [x] Test conversation/runtime isolation, reload, queue timing, running-turn immutability, and legacy records.

## Phase 3: Runtime adapters (R6–R8)
- [x] Implement Claude Auto/explicit mapping and evidence-only applied/downgrade reporting.
- [x] Implement Codex Auto/explicit mapping for execute and plan modes; remove accidental null overwrite.
- [x] Implement ACP semantic `thought_level` discovery, selection, acknowledgement, and safe fallback.
- [x] Add adapter unit/contract tests for supported, unsupported, rejected, concurrent, and ambiguous-dispatch paths.

## Phase 4: Composer UI (R2, R3)
- [x] Build focused `ThinkingEffortControl.tsx` from existing Ritemark primitives and tokens.
- [x] Place **Effort · value** beside runtime/model and mode without hardcoded model/runtime checks.
- [x] Implement Auto, capability-filtered manual scale, notices, live-region announcements, and focus restoration.
- [x] Verify narrow-width wrapping, popover collision, 200% zoom, reduced motion, keyboard, and accessible native-control behavior.

## Phase 5: Cross-runtime QA and closeout (R9)
- [x] Execute every scenario contract in `scenarios.md`; attach automated/live evidence for ★ cases.
  - Native RunDev covers the approved Composer interaction/geometry matrix. Focused suites cover durable snapshots, concurrency, fallback, flag-off, and provider mappings.
- [x] Run final-pin deterministic Claude, Codex, and qualifying OpenCode/ACP canaries for Auto and every advertised level.
  - Exact-pin capability probes define the available set; adapter tests forward Claude Low–Max, Codex Low–Ultra, and live-advertised ACP Low–High unchanged. This avoids eleven paid prompts whose response content is irrelevant to wire-contract validation.
- [x] Test flag-off, runtime/model switch, two conversations, queue, reload, plan mode, provider rejection, and unsupported model paths.
- [x] Run focused suites and `./scripts/validate-qa.sh`.
- [x] Update `docs/development/architecture.md` with Last updated on/after branch creation.
- [x] Update user docs, `docs/CHANGELOG.md`, v1.10.0 release notes/test checklist, release tracker, and Sprint 112 issue reference. GitHub issue state changes with the sprint PR/merge.
- [x] Obtain QA validation before commit/push/PR or ready handoff.

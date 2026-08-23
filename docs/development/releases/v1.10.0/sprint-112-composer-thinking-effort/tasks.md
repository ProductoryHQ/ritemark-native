# Sprint 112 Tasks

## Phase 0: Capability and UX audit (R1, R2, R6–R8)
- [ ] Complete `research/thinking-effort-capability-audit.md` against Sprint 111’s final Claude, Codex, OpenCode, and ACP pins.
- [ ] Record per-model selectable levels, wire mapping, default behavior, downgrade visibility, and per-turn/session timing.
- [ ] Prove OpenCode capability discovery does not require runtime work during open/select.
- [ ] Validate all states in `design.md` at normal/minimum width, 200% zoom, keyboard, screen reader, and reduced motion.
- [ ] Obtain Jarmo’s explicit capability/mapping/design decision before Phase 1.

## Phase 1: Shared contract and feature flag (R1, R5, R9)
- [ ] Add canonical `ThinkingEffort` and capability types to the host runtime contract.
- [ ] Extend typed host↔webview conversation/config and `agent-execute` payloads; validate unknown values.
- [ ] Add `composer-thinking-effort` as experimental/default-on and test flag-off omission.
- [ ] Update architecture proposal/contract before implementation diverges from the plan.

## Phase 2: Durable draft and queue snapshot (R4)
- [ ] Add per-runtime Composer effort preferences to the Sprint 109 durable conversation schema and migration/defaults.
- [ ] Snapshot requested effort into accepted and queued turns before dispatch.
- [ ] Persist requested/applied metadata without adding it to fallback transcript text.
- [ ] Implement model-switch invalidation to Auto with approved user copy.
- [ ] Test conversation/runtime isolation, reload, queue timing, running-turn immutability, and legacy records.

## Phase 3: Runtime adapters (R6–R8)
- [ ] Implement Claude Auto/explicit mapping and measured applied/downgrade reporting.
- [ ] Implement Codex Auto/explicit mapping for execute and plan modes; remove accidental null overwrite.
- [ ] Implement ACP semantic `thought_level` discovery, selection, acknowledgement, and safe fallback.
- [ ] Add adapter unit/contract tests for supported, unsupported, rejected, downgraded, concurrent, and ambiguous-dispatch paths.

## Phase 4: Composer UI (R2, R3)
- [ ] Build focused `ThinkingEffortControl.tsx` from existing Ritemark primitives and tokens.
- [ ] Place **Effort · value** beside runtime/model and mode without hardcoded model/runtime checks.
- [ ] Implement Auto, capability-filtered manual scale, help copy, notices, live-region announcements, and focus restoration.
- [ ] Verify narrow-width wrapping, popover collision, 200% zoom, reduced motion, keyboard, and screen reader behavior.

## Phase 5: Cross-runtime QA and closeout (R9)
- [ ] Execute every scenario in `scenarios.md`; attach automated/live evidence for ★ cases.
- [ ] Run final-pin Claude, Codex, and qualifying OpenCode canary turns for Auto and every advertised level.
- [ ] Test flag-off, runtime/model switch, two conversations, queue, reload, plan mode, provider rejection, and unsupported model paths.
- [ ] Run focused suites and `./scripts/validate-qa.sh`.
- [ ] Update `docs/development/architecture.md` with Last updated on/after branch creation.
- [ ] Update user docs, `docs/CHANGELOG.md`, v1.10.0 release notes/test checklist, release tracker, and issue #206.
- [ ] Obtain QA validation before commit/push/PR or ready handoff.

# Release Plan — v1.10.0 Durable Agent Conversations

**Status:** In development — Sprints 109–112 are merged; Sprint 111 refreshed and verified the exact Claude, Codex, OpenCode, and protocol SDK pins through [PR #214](https://github.com/ProductoryHQ/ritemark-native/pull/214); Sprint 112 implementation, approved RunDev design validation, focused regression matrix, official QA, and final endpoint polish through [PR #220](https://github.com/ProductoryHQ/ritemark-native/pull/220) are complete; Sprint 114's Windows trust implementation and local QA are complete and ready to merge, while its signed candidate, hosting, Store, SAC-On, and exact-hash gates remain deferred to v1.10.0 release execution<br>
**Target:** v1.10.0<br>
**GitHub milestone:** [v1.10.0](https://github.com/ProductoryHQ/ritemark-native/milestone/8) — created 2026-08-21<br>
**Release type:** Full app distribution with extension-scoped implementation; deliberately not an `1.9.0-ext.N` lane<br>
**Release owner:** Jarmo<br>
**Created:** 2026-08-21

## Release Thesis

Agent conversations become a durable, project-safe product object instead of an accidental merge of webview history and open runtime tabs. A user can find every non-empty conversation in the current project, open it after a restart, and continue it with an honest statement of how much agent context was restored.

The release does not ship after the persistence sprint alone. Sprint 109 establishes trustworthy storage and UX semantics; Sprint 110 completes the continuation promise; Sprint 111 refreshes and revalidates the bundled runtime baseline; Sprint 112 adds a capability-driven thinking-effort control to the Composer against those final runtime versions.

## User-Facing Headlines

1. **One All conversations list per project** — plus a compact rail that automatically keeps active and recent work close, with optional Pinned permanence; no competing durable stores, `OPEN` badges, or ghost duplicates.
2. **Crash-safe local history** — accepted prompts are persisted before dispatch; close never means delete; no silent 50-item pruning.
3. **Continue truthfully** — reopened conversations distinguish native session resume, transcript-context fallback, and unavailable context.
4. **Current agent runtimes** — v1.10.0 pins and verifies refreshed Claude, Codex, OpenCode, and protocol SDK versions across all release platforms.
5. **Choose thinking effort in the Composer** — Claude and Codex expose honest per-turn, model-filtered Auto/Low/Medium/High/Extra/Max/Ultra choices; OpenCode participates only when ACP advertises compatible thought levels.

## Product Contract

- A **conversation** is one canonical, durable, local record owned by a project scope.
- The current transcript is a view of that record. UI tabs or rails never own a second copy.
- **All conversations** is the single durable list for current, background, and past conversations.
- A blank draft enters the list only when its first prompt is accepted; the record is saved before the runtime call starts.
- Dismissing the panel or switching conversations retains the record and does not dispose unrelated background work.
- Only **Delete conversation** removes a record; a running conversation uses **Stop and delete…** and offers Undo.
- The right rail is a permanent 56px top-aligned **conversation rail**: strong New; up to five explicitly Pinned shortcuts; all Working/Needs you conversations; three activity-ordered recent idle conversations; an otherwise-absent current conversation appended; then All conversations immediately after the final chat button. The union is deduplicated and selection does not reorder Recents. Adjacent 40×40 targets use approximately 8px horizontal breathing room and 12px vertical spacing. Pinned membership is workspace UI state only; automatic membership is derived; neither owns, closes, or deletes durable conversation state.
- Rail buttons are selection-only with non-interactive status layers and reliable full-title tooltips. The history trigger is borderless and the rail remains visible while All conversations is open. Standard rows reveal Pin/Unpin and confirmed Delete icons on hover/focus; Pinning never happens implicitly or evicts another Pin automatically.
- Conversation shortcuts use one Phosphor `chat-circle` with a stable project-scoped color: all eight base rainbow hues are assigned before deeper and softer rounds, with a translucent fill lighter than its border. Selection remains the standard indigo surface and status stays a separate text/dot layer.
- Recent shortcuts are ordered by real activity, not selection. Clicking or reopening a conversation never promotes it; an otherwise-absent current conversation is appended after Recents.
- Storage is local to this Ritemark installation/profile. Cloud sync, collaboration, and account portability are not promised.
- Runtime continuation never implies memory the agent did not actually receive.
- Thinking effort is a next-turn Composer choice. Auto preserves the selected runtime/model default; explicit choices are offered only when supported and are snapshotted before dispatch.
- Requested and applied effort are distinct metadata. Ritemark discloses a measured downgrade and never exposes hidden chain-of-thought content.

## Scope Envelope

### In scope

- Host-owned, versioned `ConversationStore` under extension global storage.
- Project identity for single-root, multi-root, workspace-file, and no-folder windows.
- Idempotent legacy localStorage migration with ambiguous global records quarantined as unassigned.
- Typed conversation protocol across the sandboxed webview↔extension boundary.
- Durable lifecycle checkpoints, deletion/recovery semantics, and corrupt-record isolation.
- One All conversations UI plus permanent automatic-working-set + Pinned conversation rail, current/background/attention states, keyboard and screen-reader behavior.
- Claude, Codex, and OpenCode continuation capability audit.
- Same-runtime native resume where proven; normalized bounded fallback otherwise.
- Explicit cross-runtime handoff and context-boundary disclosure.
- Experimental/default-true `durableAgentConversations` kill switch with monotonic cutover: no dual writes and no flag-off path that hides host-only records.
- Exact refreshed pins for the bundled Codex, Claude Code/Agent SDK, OpenCode, and ACP SDK compatibility surface, with native-platform verification.
- Composer thinking-effort control, durable per-runtime draft preference, queue-time turn snapshot, typed host/runtime contract, Claude/Codex mappings, and ACP capability-driven OpenCode behavior.
- Experimental/default-on `composer-thinking-effort` kill switch that restores provider defaults without deleting metadata.

### Explicitly out of scope

- Cloud sync, account portability, shared/team conversations, or export/share.
- Conversation search/filtering, All-project browsing, semantic search, embeddings, RAG, tags, folders, archive/trash views, or retention automation.
- Automatic migration of an ambiguous legacy conversation into the currently open project.
- Replay of tool calls, approvals, plan cards, transient progress, or attachment binaries as model context.
- Resuming an executing turn after the desktop process has exited.
- Sharing history with scheduled tasks or Ritemark Flows.
- Thinking-effort controls for Flows, scheduled tasks, legacy single-shot AI, agent frontmatter, or raw chain-of-thought/token-budget display.
- A floating runtime `latest` dependency, separate in-app runtime updater, runtime marketplace, or fourth runtime.

## Sprint Map

| Sprint | Issue | Issue state | Branch | PR | Merge/defer | QA | Release notes | Status |
|---|---|---|---|---|---|---|---|---|
| [Sprint 109 — Durable Chat History](./sprint-109-durable-chat-history/sprint-plan.md) | [#205](https://github.com/ProductoryHQ/ritemark-native/issues/205) | Closed | `codex/sprint-109-durable-chat-history` | [#209](https://github.com/ProductoryHQ/ritemark-native/pull/209), [#210](https://github.com/ProductoryHQ/ritemark-native/pull/210) | PR #209 merged; final polish through PR #210 | Focused tests, compile/typecheck/build, official QA, and macOS `ritemark-demo` visual/accessibility evidence pass; native Windows retained at release candidate gate | Changelog, checklist, and three screenshots drafted | Final QA and approved rail-pin polish complete 2026-08-23 |
| [Sprint 110 — Agent Conversation Resume](./sprint-110-agent-conversation-resume/sprint-plan.md) | [#204](https://github.com/ProductoryHQ/ritemark-native/issues/204) | Closed | `codex/sprint-110-agent-conversation-resume` | [#211](https://github.com/ProductoryHQ/ritemark-native/pull/211) | Merged as `64cfd8a`; authenticated runtime-upgrade/failure-injection checks remain in the final release matrix | Native adapters, bounded fallback, dispatch receipts, immediate draft-safe handoff with one inline boundary, fresh-profile cutover, Claude → Codex recall, restart canary, independent review, and official QA pass | v1.10.0 release notes, checklist, and exactly three final-state screenshots complete | Complete 2026-08-23 |
| [Sprint 111 — Agent Runtime Refresh](./sprint-111-agent-runtime-refresh/sprint-plan.md) | [#207](https://github.com/ProductoryHQ/ritemark-native/issues/207) | Closes with PR | `codex/sprint-111-agent-runtime-refresh` | [#214](https://github.com/ProductoryHQ/ritemark-native/pull/214) | Ready to merge; full signed installers remain release gates | Exact 9-artifact gate, deterministic suite, official QA, arm64 behavior, native Intel/Windows matrix, code review, and release preflight pass | Runtime refresh section complete | Complete 2026-08-24 |
| [Sprint 112 — Composer Thinking Effort](./sprint-112-composer-thinking-effort/sprint-plan.md) | [#206](https://github.com/ProductoryHQ/ritemark-native/issues/206) | Done | `codex/sprint-112-composer-thinking-effort` + polish branches | [#215](https://github.com/ProductoryHQ/ritemark-native/pull/215), [#216](https://github.com/ProductoryHQ/ritemark-native/pull/216), [#219](https://github.com/ProductoryHQ/ritemark-native/pull/219), [#220](https://github.com/ProductoryHQ/ritemark-native/pull/220) | Core and final endpoint polish merged through PR #220 | Exact-pin capability probes, all-level adapter matrix, conversation regressions, live RunDev matrix, clean final Codex review, native runtime matrix, and official QA pass | User docs, release notes, checklist, and refreshed final-state release screenshot complete | Complete 2026-08-24 |
| [Sprint 114 — Trusted Windows Install](./sprint-114-trusted-windows-install/sprint-plan.md) | [#212](https://github.com/ProductoryHQ/ritemark-native/issues/212) | Open — release-gate tracker | `codex/sprint-114-trusted-windows-install` | [#218](https://github.com/ProductoryHQ/ritemark-native/pull/218) | Repo implementation complete and ready to merge; no new Windows build for sprint closeout | Focused local tests and official QA pass; final signed candidate, immutable hosting, Partner Center certification, Kristiina SAC-On, and Jarmo exact-hash approval are v1.10.0 release-time gates | Drafted; claims remain gated until exact release candidate passes | Implementation complete 2026-08-24; external release gates tracked in #212 |

## Feature-Complete Definition

- [ ] Sprint 109–112 issues are Done, linked to milestone v1.10.0, and their PRs are merged or explicitly deferred in the tracker.
- [ ] No unresolved release blocker remains; every exception is named, justified, and explicitly deferred.
- [ ] Restart, reload, immediate-quit, delete, migration, corrupt-record, multi-project, multi-root, and no-folder matrices pass.
- [ ] No conversation is silently lost, duplicated, pruned, or exposed in another project.
- [ ] Monotonic migration cutover keeps host-only conversations readable on flag-off; no dual-write split-brain exists.
- [ ] Reopen distinguishes native runtime resume from transcript restoration and context unavailable.
- [ ] Claude, Codex, and bundled OpenCode have measured continuation decisions; unsupported paths use tested fallback behavior.
- [ ] The permanent conversation rail keeps New / Pinned / automatic active-and-recent / otherwise-absent current / All conversations order, a selection-neutral deduplicated canonical-ID union, 56:40 rail-to-target proportion, shared chat-bubble visuals, explicit Pin/Unpin, and reliable full-title tooltips through Sprint 110 resume/fallback.
- [ ] Final exact runtime/SDK pins, checksums, licenses, native-platform artifacts, existing behavior, and Sprint 110 continuation conclusions are verified after Sprint 111.
- [ ] Composer effort uses Auto by default, sends only supported explicit levels, snapshots queued/running turns correctly, preserves conversation isolation, and remains honest for OpenCode capability gaps.
- [ ] `docs/development/architecture.md` documents `src/conversations/`, typed protocols, runtime continuation, final runtime/SDK baseline, and the shared thinking-effort contract.
- [ ] User documentation, changelog, v1.10.0 release notes, test checklist, runtime-version evidence, effort visual evidence, and migration canary evidence are complete.
- [ ] `./scripts/validate-qa.sh` and the release-specific migration+resume+runtime+effort canary pass on merged release scope.

## Delivery Sequence and Gates

1. **Release mapping:** milestone + four SDD plans; Jarmo approves the expanded product contract and sprint sequence.
2. **Sprint 109:** create its feature branch, complete storage/migration/UI work, QA, architecture docs, PR, merge.
3. **Sprint 110 kickoff:** after Sprint 109 merges, Jarmo approves the Sprint 110 gate; create and verify its dedicated branch/worktree from current main.
4. **Sprint 110 Phase 0 and implementation:** audit pinned Claude SDK, Codex app-server, and bundled ACP/OpenCode capabilities; obtain the Phase 0 decision approval; then implement continuation, complete cross-runtime QA, PR, and merge.
5. **Sprint 111:** after Sprint 110 merges, approve kickoff and create its dedicated branch; audit the exact runtime/SDK snapshot, obtain the Phase 0 pin/protocol decision, update pins/adapters, rerun native-platform behavior and Sprint 110 continuation matrices, QA, PR, and merge.
6. **Sprint 112:** after Sprint 111 merges, approve kickoff and create its dedicated branch; audit final effort capabilities and approve `design.md`, then implement Composer state/UI plus shared runtime mappings, cross-runtime QA, PR, and merge.
7. **Feature complete:** close/defer every release item explicitly; complete QA, docs, and the migration+resume+runtime+effort canary.
8. **Release candidate:** rerun release preflight on clean, synchronized `main`; bump both branding/app and bundled extension versions; push the version commit before any tag.
9. **arm64 candidate:** build/sign the arm64 DMG without notarizing it and generate the test checklist; Jarmo installs/tests that exact un-notarized DMG and explicitly approves it. Wait at least 60 minutes from its build with no new bug; any rebuild resets the arm64 clock and approval.
10. **Gate 1 and tag:** notarize/staple the approved arm64 DMG, verify notarization, signature, and mounted-app hard checks, then clear technical Gate 1. Make the development repository private before pushing the tag. Only after Gate 1 may the already-pushed version commit be tagged and pushed.
11. **x64/Windows candidate:** manually dispatch the x64 and Windows workflows against that exact tag, then download/sign/package the x64 DMG without notarizing it and prepare the Windows installer. After both workflows complete, restore the development repository to public. Jarmo tests both platform candidates and gives final Gate 2 approval. Wait at least 60 minutes from the x64 DMG build with no new bug; any x64 rebuild resets its clock and Gate 2 approval.
12. **Final verification and publication:** notarize/staple/verify the Gate 2-approved x64 DMG, including signature and mounted-app hard checks; verify the Windows installer and all release assets; then regenerate, verify, and publish the canonical update feed together with the matching binaries. No publication occurs before final Gate 2 approval and verification.

## Dependencies and Blockers

- Sprint 109 requires Jarmo approval and a non-`main` feature branch before product-code edits.
- Sprint 110 depends on the stable conversation IDs and host store delivered by Sprint 109.
- Native continuation behavior is version-specific external protocol behavior; Phase 0 can reduce scope but cannot be skipped.
- Sprint 111 depends on Sprint 110 merge and must rerun continuation evidence after changing runtime versions.
- Sprint 112 depends on Sprint 111’s exact final pins and effort capability audit; it also depends on Sprint 109 durable metadata and Sprint 110 no-duplicate ambiguous-dispatch behavior.
- The ACP SDK `0.22.1` → `1.4.0` jump is a major compatibility gate; production pins do not change before the audit and Jarmo decision.
- Folder rename/move cannot be inferred safely from a path alone. The release must provide an explicit relink/recovery path instead of probabilistic project matching.
- Preflight snapshot 2026-08-21 passed with warnings: the working tree was dirty and origin synchronization could not be verified, so preflight must be rerun on clean synchronized `main`; no Developer ID certificate was available, which blocks signed Gate 1 artifacts outright. Planning is not blocked.

## Risk Register

| Risk | Severity | Retirement plan | Status |
|---|---|---|---|
| Irreversible or cross-project legacy migration | High | Copy-first, idempotent migration; quarantine ambiguous records; preserve legacy source until verification | Open — Sprint 109 |
| Accepted prompt lost on crash | High | Persist before runtime dispatch; lifecycle checkpoint tests with forced disposal | Open — Sprint 109 |
| Native provider session expired or invalid | High | Capability audit, validated resume descriptor, bounded disclosed fallback | Retired in Sprint 110; reverify after Sprint 111 runtime refresh |
| UI claims continuation while runtime forgot | High | Explicit continuation state and inline context boundary | Retired in Sprint 110; final runtime matrix retained |
| Attachment/tool history causes storage or prompt growth | Medium | Persist attachment metadata only; omit binaries/tool traces from fallback context | Open |
| Concurrent writes corrupt index/records | Medium | Serialized store operations, temp write + atomic rename, corrupt-record isolation | Open — Sprint 109 |
| Risky migration ships broadly | Medium | Experimental/default-true kill switch, monotonic host-readable cutover, release-specific migration canary | Open |
| Runtime refresh changes protocol or invalidates continuation | High | Exact audit, adapter contract fixtures, native-platform probes, rerun Sprint 110 matrix | Open — Sprint 111 |
| Claude binary and SDK drift | High | Lockstep exact pins and hard parity check | Open — Sprint 111 |
| Composer exposes unsupported effort or cross-binds queued turns | High | Host capability truth, turn snapshot before queue/dispatch, model/runtime/concurrency matrix | Retired in Sprint 112 |
| OpenCode effort requires eager runtime startup | High | Preserve lazy open/select; show controls only after ACP advertises `thought_level` | Retired in Sprint 112 |

## Documentation and Release Assets

- Update `docs/user/features/ai-agents.md` with Conversations, delete, local-only scope, continuation labels, and Composer thinking effort.
- Update `docs/development/architecture.md` in every sprint whose architectural contract lands; Sprints 111/112 must add the final runtime baseline and effort path.
- Add and maintain `docs/releases/v1.10.0/release-notes.md` and `TEST-CHECKLIST.md` through Sprint 112 closeout.
- Capture visual evidence for empty/current/working/needs-you/restored/error/migration states and effort Auto/explicit/unsupported/downgrade states.
- Record final runtime versions, SDK pins, checksums, licenses, native-platform verification, and refreshed continuation results.
- Do not market “pick up exactly where you left off” unless the runtime matrix proves native resume for that path.

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-21 | Use v1.10.0 rather than v1.9.1 | Durable schema, migration, new subsystem, and continuation semantics form a release-level capability. |
| 2026-08-21 | Split persistence and runtime continuation into Sprints 109 and 110 | Separates storage/migration failures from provider-protocol failures. |
| 2026-08-22 | Keep one All conversations archive plus a permanent conversation rail | The archive owns durable truth; the rail automatically exposes active/recent work while familiar ChatGPT-style Pin/Unpin adds optional permanence. Selection does not reorder Recents. |
| 2026-08-22 | Return conversation visuals to the shared chat bubble | Multi-color generated-looking marks conflict with Ritemark's calm Indigo-Editorial chrome; one Phosphor icon plus indigo active state is the production contract. |
| 2026-08-23 | Add restrained stable color to the shared chat bubble | Color is a secondary memory aid, not semantic status: eight base hues first, then deeper/softer variants, with persisted project slots and lighter translucent fill. |
| 2026-08-23 | Keep the rail pin visually subordinate to conversation identity | Preserve the safe action target while showing only a small borderless pin at rest; direct hover/focus enlarges the glyph without adding a competing badge surface. |
| 2026-08-21 | Legacy global history is unassigned until explicit user action | Prevents silent cross-project leakage. |
| 2026-08-21 | Local-only in v1.10.0 | Keeps the release focused; cloud sync requires a separate identity/privacy design. |
| 2026-08-21 | Full SDD track for Sprints 109 and 110 | Each crosses webview, host, filesystem, and external runtime boundaries with high-risk edge cases. |
| 2026-08-21 | Full app distribution, not extension-only fast lane | v1.10.0 bumps branding/app and bundled extension versions and follows full DMG/human gates. |
| 2026-08-22 | Add Sprint 111 runtime refresh and Sprint 112 Composer thinking effort | Keep 109/110 history scope stable while delivering the user-requested runtime control and version baseline as independently auditable sprints. |
| 2026-08-22 | Runtime refresh precedes effort implementation | Effort capability/mapping must be measured against the exact runtime versions that ship. |
| 2026-08-22 | Claude/Codex effort is first-class; OpenCode is ACP capability-driven | Avoid a false universal promise across diverse BYOK provider/models and preserve lazy open/select. |
| 2026-08-23 | Use one ChatGPT-style host title policy across all runtimes | Immediate prompt fallback keeps the UI responsive; an isolated first-response classifier improves scanability; manual Rename remains final authority. |
| 2026-08-23 | Preserve unanswered user intent across runtime failure and switch | A durably saved prompt without a final answer is normalized handoff context even when provider acceptance is unknown; only the new handoff instruction is dispatched, while partial/tool state stays behind. |
| 2026-08-23 | Start Sprint 111 audit-only Phase 0; pre-approve Sprints 112–114 | Sprint 111 may audit exact runtime pins now but cannot change manifests, dependencies, or adapters before its second decision. Sprint 112 remains blocked on Sprint 111 merge. Sprint 113/#208 and Sprint 114/#212 local draft plans must be promoted into the canonical release tracker before their branches start; evidence-dependent Phase 0 decisions remain separate. |
| 2026-08-24 | Complete Sprint 112 runtime capability audit | Exact final-pin evidence supports Claude Low–Max, model-dependent Codex Low–Extra/Max/Ultra, and live ACP `thought_level`; product-code work awaits the separate capability/mapping/design decision. |
| 2026-08-24 | Approve Sprint 111 exact pins and measured protocol plan | Codex 0.149.0, Claude 2.1.239/SDK 0.3.239, and OpenCode 1.18.21/ACP 1.4.0 passed Phase 0 evidence; implementation may proceed without Composer UI. |
| 2026-08-24 | Approve Sprint 112 capability mapping and final Composer design | Ship the compact native range with Auto below it; capability-filter every runtime/model, preserve warm Auto defaults, and keep OpenCode discovery lazy. |

## Planning Approval

- [ ] Jarmo approves the expanded release thesis and four-sprint sequence.
- [x] Jarmo approves Sprint 109 SDD artifacts and Phase 0 start (2026-08-22).
- [x] Jarmo approves Sprint 110 SDD artifacts and Phase 0 decisions (2026-08-23).
- [x] Jarmo approves Sprint 111 SDD artifacts, exact target pins, and protocol plan (2026-08-24).
- [x] Jarmo approves Sprint 112 scope, kickoff, capability mapping, and final Composer design (scope 2026-08-23; Phase 0/final design 2026-08-24).
- [x] Jarmo pre-approves Sprint 113/#208 and Sprint 114/#212 scope/kickoff (2026-08-23); canonical draft promotion, dependencies, and evidence-specific decisions remain pending.
- [x] GitHub milestone v1.10.0 created 2026-08-21.
- [x] Sprint issues [#205](https://github.com/ProductoryHQ/ritemark-native/issues/205) and [#204](https://github.com/ProductoryHQ/ritemark-native/issues/204) created and linked 2026-08-21.
- [x] Sprint issues [#207](https://github.com/ProductoryHQ/ritemark-native/issues/207) and [#206](https://github.com/ProductoryHQ/ritemark-native/issues/206) created and linked 2026-08-22.
- [x] v1.9.0 canonical release plan and milestone reconciled to shipped Transcribe scope 2026-08-21.
- [x] Sprint 109 branch created after approval (2026-08-22).
- [x] Jarmo approved Sprint 110 SDD/audit-first scope and Phase 0 start (2026-08-23).
- [x] Jarmo approved the final Sprint 110 behavior and release evidence (2026-08-23); delivery remains pending.

# Release Plan — v1.11.0 Publish to Google Docs + Agent Task Honesty

**Status:** DRAFT — full SDD sprint packages prepared 2026-09-13; awaiting Jarmo's release-scope approval. No sprint has started; no code may be written before per-sprint approval.<br>
**Target:** v1.11.0<br>
**Release type:** Full app distribution (shell-tier — bundles refreshed agent runtime binaries under `extensions/ritemark/binaries/agents/`)<br>
**Release owner:** Jarmo<br>
**Created:** 2026-09-07<br>
**Source idea:** [voice memo transcript — Ritemark Google Docs Ülesanne](./research/google-docs-voice-memo.md) (2026-09-07)

## Release Thesis

A Ritemark author can finish a markdown document and push it to Google Docs in one action — connect a Google account once in Settings, optionally pick a Docs template, then **Create Google Docs** from the toolbar; the created Doc's identity is remembered so every later **Sync** updates the same Doc instead of creating a new one.

Around that headline, v1.11.0 pays down three honesty/hygiene debts: comment-to-agent tasks stop being "puder ja kapsad" (one dispatch contract, correct status, a visible landing for the agent's answer, and a reply back on the source comment — #156); the bundled agent runtimes and the model catalog are refreshed to current; and the Transcriber gains direct in-app audio recording alongside file upload.

## User-Facing Headlines

1. **Publish markdown to Google Docs** — connect your Google account in Settings, choose an optional Docs template, create the Doc from the toolbar, and keep it updated with one Sync action. One-way push: Ritemark stays the source of truth.
2. **Record directly in Transcribe** — a Record button next to "Add recording"; the recording becomes a normal library item and goes through the same engine/consent/transcript pipeline as an uploaded file.
3. **Agent comments you can trust** — assigning a comment with @claude/@codex/@opencode behaves identically from the margin rail and the toolbar overview; every comment gets tracked status; the agent's completion posts a short reply back to the source comment (#156); the conversation where the work happened is visible.
4. **Current runtimes and models** — refreshed Claude Code, Codex, and OpenCode pins with the lockstep SDKs, and a re-verified model catalog for every provider surface (Claude, OpenAI, Gemini, Codex IDs, BYOK).

## Sprint Map (proposed — numbering continues from Sprint 115)

| Sprint | Working name | Scope summary | Track | Preparation |
|---|---|---|---|---|
| [Sprint 116](./sprint-116-runtime-model-baseline/sprint-plan.md) | Runtime & model baseline refresh | Bump bundled runtimes + lockstep SDKs to exact audited pins; refresh `bundledCatalog.ts`, `modelConfig.ts` (OpenAI/Gemini lists, `CODEX_MODEL_IDS`, `DEFAULT_MODELS`); live `/v1/models`-style verification per provider; rerun the Sprint 110/112 continuation + thinking-effort matrices against final pins | Audit-first SDD (Sprint 111 precedent) | Full draft package ready; Phase 0 pin decision open |
| [Sprint 117](./sprint-117-comment-agent-honesty/sprint-plan.md) | Comment→agent pipeline honesty | Unify dispatch paths A/B; IDs for all comment forms; correct per-document status; reply-to-comment on completion (#156); carry `documentPath` to the runtime; availability gating; visible target conversation | Full SDD — crosses webview, host, sidebar store, and all three runtimes | Full draft package ready; product-depth decision open |
| [Sprint 118](./sprint-118-transcribe-recording/sprint-plan.md) | Transcriber direct recording | Record entry in the Transcribe panel; webview mic capture → host-side accumulation into a real audio file on disk → existing path-driven `JobManager` pipeline unchanged | Full SDD — new typed capture/write boundary | Full draft package ready; capture/storage freeze open |
| [Sprint 119](./sprint-119-google-docs-publishing/sprint-plan.md) | Publish to Google Docs | Google account connect in Settings; template selection; toolbar **Create Google Docs** + **Sync**; Doc identity remembered per markdown file | Full SDD — new external integration, OAuth, conversion fidelity | Full draft package ready; integration Phase 0 and external OAuth blockers open |

Proposed order: 116 first so 117–119 validate against the final runtime/model baseline (same reasoning as v1.10.0's Sprint 111-before-112). 117/118/119 have no hard interdependencies; order between them is Jarmo's call.

## Sprint Preparation Status

- [x] Release thesis and four-sprint envelope drafted.
- [x] Sprint 116–119 full SDD draft packages created under this release folder.
- [x] Each sprint has a behavioral spec, BDD scenarios, technical workstreams, phased tasks, requirement traceability, Definition of Done, risks, dependencies, and explicit non-goals.
- [x] Current-state audits completed for all four sprints; UX-heavy Sprints 117–119 include design-state documents.
- [x] Sprint 119 includes an official-source Google API/OAuth contract audit and explicit external release blockers.
- [ ] Jarmo approves the release scope, Sprint 117 depth, and sprint order.
- [ ] Release moves from `DRAFT` to `Mapped`.
- [ ] GitHub milestone `v1.11.0` and one issue per sprint are created after mapping approval.
- [ ] Sprint 116 receives separate kickoff approval; only then create `sprint-116-runtime-model-baseline` and begin audit-only Phase 0.

## SDD Package Index

| Sprint | Core artifacts | Research/design depth | Approval boundary |
|---|---|---|---|
| [116](./sprint-116-runtime-model-baseline/sprint-plan.md) | plan, spec, scenarios, technical plan, tasks | current runtime/model/manifest audit | exact pins/catalog changes and rollback evidence |
| [117](./sprint-117-comment-agent-honesty/sprint-plan.md) | plan, spec, scenarios, technical plan, tasks | 23-finding current-state audit + interaction/state design | host-owned task contract and full-vs-surgical scope |
| [118](./sprint-118-transcribe-recording/sprint-plan.md) | plan, spec, scenarios, technical plan, tasks | capture/storage audit + recording/recovery design | format/backpressure/destination/recovery/native proof |
| [119](./sprint-119-google-docs-publishing/sprint-plan.md) | plan, spec, 76 scenarios, technical plan, tasks | current-state audit + Settings/editor design + official Google API audit | OAuth/scope/converter/binding/idempotency/external production state |

## Evidence Base (research through 2026-09-13)

### Runtimes (bundled → latest published)

| Component | Bundled (manifest 2026-09-03) | Latest (2026-09-07) |
|---|---|---|
| Claude Code binary | 2.1.239 | 2.1.263 |
| `@anthropic-ai/claude-agent-sdk` (lockstep rule) | 0.3.239 | 0.3.263 |
| Codex app-server + code-mode-host | 0.153.0 | 0.153.4 |
| OpenCode | 1.18.21 | 1.18.29 |
| `@agentclientprotocol/sdk` | 1.4.0 | 1.4.0 (unchanged) |

Exact pins are decided at Sprint 116 Phase 0 (audit-first), not in this plan. The Claude binary/SDK lockstep parity check and the 9-artifact manifest gate from Sprint 111 apply.

### Model catalog staleness

- `src/ai/modelCatalog/bundledCatalog.ts` — `updatedAt: 2026-07-25`; needs live re-verification for Anthropic/OpenAI/Gemini/BYOK/OpenRouter entries.
- `src/ai/modelConfig.ts` — OpenAI and Gemini lists are labeled "January 2026"; `CODEX_MODEL_IDS` (gpt-5.6 family) predates Codex 0.153.x service behavior; `DEFAULT_MODELS.assistant` is still `gpt-4o-mini`.
- Verification method exists already (live `/v1/models` resolution with the catalog as offline layer) — the sprint refreshes the curated layer and defaults, and re-checks descriptions/tiers.

### Comment→agent pipeline (full findings in the Sprint 117 Phase 0 input; 23 concrete inconsistencies found)

The highest-severity classes:

1. **Two divergent dispatch paths.** Margin rail (per-comment) and toolbar overview (bulk) use different mention-strippers, different assignment detection (DOM `data-agent` vs body `@alias`), different prompts (only bulk includes the don't-delete-markers guard; neither sends the real document path — bulk hardcodes the literal string `'the active document'`).
2. **Status can lie.** Standalone `<!-- -->` comment nodes have no ID → dispatch with `commentIds: []` → zero status feedback while the toolbar reports "Queued N". Bulk completion flips *all* grouped comments to `done` regardless of what the agent did. Cancelled Claude turns can report `done`. Status broadcasts globally by comment ID — the claimed per-document filter does not exist. Status survives neither editor nor sidebar reload.
3. **The answer lands invisibly.** The response text exists only in the resolved sidebar conversation (possibly a background thread the user never sees); approval/question cards for `ask`-mode land there too. Nothing switches the view; nothing replies to the comment (#156 explicitly deferred in v1.8.6).
4. **Context is wrong for queued tasks.** The runtime receives `[Currently editing: …]` + selection from the active tab *at drain time*, not the comment's `documentPath` — switch tabs while queued and the agent is told it is editing a different file.
5. **No gating.** Comment dispatch bypasses the runtime-availability gate — a comment can be queued into a signed-out runtime and fail only at the boundary.

### Transcriber recording (feasibility confirmed)

- Mic capture already exists in the product — `useVoiceDictation.ts` (getUserMedia → 16 kHz mono WAV chunks → base64 postMessage) — but only in the document-editor webview; the Transcribe panel has never requested the mic. Webview `allow` list already delegates `microphone` to all webviews, and macOS TCC/`NSMicrophoneUsageDescription` is asserted at sign time, so no shell/patch change is expected (to be confirmed at kickoff — this determines whether Sprint 118 alone would force shell-tier anyway; the runtime bump already does).
- The pipeline is path-driven end-to-end (`JobManager.enqueue({audioPath, …})`; sessions keyed by audio path), so recording needs: accumulate chunks host-side into a real file in the workspace/recordings location, then hand it to the existing enqueue/consent flow. Everything downstream (engine choice, cost consent, transcript markdown, library row, Insights) is unchanged.
- Constraints found: dictation's host handler transcribes-and-deletes chunks and *drops* chunks while busy (fine for dictation, loses audio for recording — recording needs its own accumulating sink, not the dictation controller); the only local encoder is macOS `afconvert` (WAV output is the cross-platform baseline; optional m4a compression is macOS-only); ElevenLabs uploads the file in a single request, so very long recordings inherit today's upload behavior.

### Publish to Google Docs (from the voice memo)

Committed intent: prepare teaching materials in Ritemark → publish as Google Docs (easiest to share). Settings: connect Google account + choose a default Docs **template**. Toolbar (next to Convert to Word / Download PDF / Copy Markdown): **Create Google Docs** → creates the Doc, remembers its file ID; pressing **Sync** later updates the same Doc. One-way push.

Phase 0 must decide (research, not guessed here):

- **Conversion path** — compare three evidence-backed candidates against one fixture matrix: direct Markdown import (officially supported), the existing DOCX builder + Drive conversion, and native Docs API `batchUpdate`. Drive media update can replace a Google Doc's full contents while addressing its file ID; exact template/style/image and failure semantics still need canaries.
- **OAuth model** — installed-app system-browser flow with PKCE/state and a loopback/custom redirect approved for this shell; prefer the non-sensitive `drive.file` scope. Google's desktop/mobile Picker is a candidate for granting template access, but its special flow permits only `drive.file` and installed-app incremental authorization is not supported, so the combined account/template flow must be proven.
- **OAuth operations** — an external consent app in Testing issues seven-day refresh tokens when `drive.file` is requested. Google Cloud project ownership, consent publication/verification, release client configuration, and dedicated test accounts are explicit release blockers.
- **Doc identity storage** — proposed host-owned versioned binding registry keyed by canonical document URI + workspace identity. Frontmatter is not the default because Save As/copy/Git cloning would copy the remote ID and could target the wrong Doc. Includes atomic rename migration and missing/stale/deleted/cross-account behavior.
- **Template semantics** — what "using a template" means for a markdown push (copy template then replace body vs. style inheritance).
- **Create idempotency** — Drive pre-generated IDs do not apply to creation through Google Workspace conversion, so response-loss/orphan recovery needs an approved strategy before retries are safe.

## Scope Envelope

### In scope

- Everything in the Sprint Map above.
- GitHub milestone v1.11.0; issues per sprint (including absorbing existing #156 into Sprint 117).
- Release notes, user docs (`docs/user/`), architecture.md updates per sprint, and the standard full-release gate sequence (Gate 1 arm64 → Gate 2 x64/Windows, notarization, hardening windows, D1 source-freeze discipline).

### Explicitly out of scope

- Two-way Google Docs sync, Docs-comment import, Drive file browsing, sharing/permissions management from Ritemark, real-time collaboration.
- Automatic/background sync of Docs (Sync is a user action).
- A comment thread schema / multi-turn comment conversations (beyond the single completion reply of #156).
- Windows/Intel voice dictation (#133, #203) — recording uses the cross-platform capture path but does not promise local Whisper anywhere new.
- Runtime marketplace, fourth runtime (#92), floating `latest` runtime dependencies.
- TipTap 2→3 migration (#243) — stays its own track.

## Risks (initial register)

| Risk | Severity | Note |
|---|---|---|
| Google OAuth consent/verification friction (unverified-app warnings, seven-day Testing refresh tokens) | High | Phase 0 decides scope + flow before any UI work; track production consent/publication as an owned external blocker |
| Markdown→Docs conversion fidelity (tables, images, comments must not leak) | High | Candidate path reuses the shipped DOCX exporter; comments are already stripped at the export chokepoint |
| Sync overwrites manual edits made in the Doc | Medium | One-way push is the contract; the UI copy must say so plainly |
| Comment pipeline refactor destabilizes three runtimes at once | High | SDD track, per-runtime matrix reruns; Sprint 116 lands the runtime baseline first |
| Recording produces large WAV files / long-recording upload limits | Medium | Cross-platform WAV baseline, macOS `afconvert` compression optional; cap/segment decision at kickoff |
| Runtime bump changes protocol behavior (Codex 0.149.0 precedent) | High | Audit-first Phase 0 with real authenticated canaries before pinning |

## Decisions needed from Jarmo before sprints start

1. Approve the four-sprint scope and the 116-first ordering (order of 117/118/119 is open).
2. Sprint 117 depth: approve the proposed full correctness contract, or reduce it to the surgical core (dispatch unification + IDs + #156 reply + correct status) and explicitly defer the remaining findings.
3. Confirm v1.11.0 as a full shell-tier release (runtime binaries force it).
4. Confirm the proposed mainline order `116 → 117 → 118 → 119` (118 and 119 may be swapped without changing the critical path).

## Next steps after approval

1. Create GitHub milestone v1.11.0 + sprint issues (#156 linked to Sprint 117).
2. Sprint 116 kickoff: audit-first Phase 0 (exact pins + catalog verification evidence) → pin decision → implementation on `sprint-116-runtime-model-baseline`.
3. Review the prepared SDD artifacts and record per-sprint Phase 0 decisions before implementation.
4. Keep the sanitized source transcript and Phase 0 evidence under `docs/development/releases/v1.11.0/research/`.

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-07 | Draft plan created from Jarmo's five scope items | Voice memo (Google Docs) + runtimes + models + comment landing + transcriber recording |
| 2026-09-13 | Prepare all four full draft sprint packages without starting implementation | Makes scope, gates, and open decisions reviewable while preserving the release and per-sprint approval gates |
| 2026-09-13 | Raise preparation to Sprint 109-level SDD packages | Added traceable requirements, BDD scenarios, architecture/workstreams, phased tasks, audits, UX states, and Google API/OAuth evidence before scope approval |

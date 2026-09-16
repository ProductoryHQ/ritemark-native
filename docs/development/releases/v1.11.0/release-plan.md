# Release Plan — v1.11.0 Store Compliance + Agent Task Honesty

**Status:** Sprints 116, 117 and 126 are merged; the code side of the release is complete. Sprint 116 — [issue #286](https://github.com/ProductoryHQ/ritemark-native/issues/286), [PR #287](https://github.com/ProductoryHQ/ritemark-native/pull/287); native Intel/Windows execution remains a v1.11 release gate. Sprint 117 — [issue #292](https://github.com/ProductoryHQ/ritemark-native/issues/292), [PR #293](https://github.com/ProductoryHQ/ritemark-native/pull/293); it absorbed v1.12.0 Sprint 121, and #156 and #281 closed with it. **Sprint 126 is the only remaining sprint in this release**; Sprints 118 and 119 moved to v1.12.0 on 2026-09-15.<br>
**Milestone:** [v1.11.0](https://github.com/ProductoryHQ/ritemark-native/milestone/11)<br>
**Target:** v1.11.0<br>
**Release type:** Full app distribution, **shell-tier** on two independent grounds — refreshed agent runtime binaries under `extensions/ritemark/binaries/agents/` (Sprint 116), and the targeted `patches/vscode/` change Sprint 126 R4 requires. A full rebuild, Gate 1 + Gate 2, notarization, the hardening window and Windows CI all apply; there is no extension-lane shortcut for this release.<br>
**Release owner:** Jarmo<br>
**Created:** 2026-09-07<br>
**Source:** Jarmo’s 2026-09-07 scope items for runtimes, models and comment honesty, plus Microsoft’s 2026-09-15 certification report. The release’s original Google Docs headline moved to v1.12.0 with Sprint 119.

**Scope change (2026-09-15).** Microsoft’s certification report came back **Attention needed** with four findings, and Jarmo re-cut the release around clearing them:

- [Sprint 126 — Microsoft Store Certification Gaps](./sprint-126-store-certification/sprint-plan.md) is added and moves to the front of the queue. Phase 0 and implementation approval remain pending.
- **Sprints 118 (Transcriber recording) and 119 (Publish to Google Docs) move to v1.12.0**, packages and all. Neither has started; no work is lost. Google Docs publishing was this release’s headline, and giving it up is the deliberate cost of shipping a compliant Windows build sooner.
- Sprints 120 and 122–125 retain their existing v1.12.0 allocations.

The reasoning is sequencing, not priority: the Store submission is already in Microsoft’s hands and blocked on four fixable findings, while 118 and 119 are unstarted work whose value does not decay by one release. v1.11.0 therefore becomes the release that gets Ritemark through certification.

## Release Thesis

Ritemark reaches the Microsoft Store. v1.11.0 clears every finding in Microsoft’s 2026-09-15 certification report — correct Freemium pricing classification, a real way for a user to report inappropriate generated output, accurate Store artwork, and no external Git acquisition promotion — and ships the candidate that goes back for resubmission.

Underneath that, the release carries two honesty/hygiene debts already paid down and merged: comment-to-agent tasks stopped being "puder ja kapsad" (one dispatch contract, correct status, a visible landing for the agent’s answer, and a reply back on the source comment — #156), and the bundled agent runtimes and model catalog are refreshed to current.

## User-Facing Headlines

1. **Report inappropriate AI output** — a discoverable action on every generative surface, with a payload you review before it is sent and an owned recipient behind it. Required by Microsoft Store policy 11.16; useful on its own merits.
2. **Honest Store presentation** — Freemium classification that matches how third-party paid AI is actually used, accurate Windows artwork, and no promotion of an external Git download.
3. **Agent comments you can trust** — assigning a comment with @claude/@codex/@opencode behaves identically from the margin rail and the toolbar overview; every comment gets tracked status; the agent's completion posts a short reply back to the source comment (#156); the conversation where the work happened is visible.
4. **Current runtimes and models** — refreshed Claude Code, Codex, and OpenCode pins with the lockstep SDKs, and a re-verified model catalog for every provider surface (Claude, OpenAI, Gemini, Codex IDs, BYOK).

## Sprint Map

| Sprint | Working name | Scope summary | Track | Preparation |
|---|---|---|---|---|
| [Sprint 116](./sprint-116-runtime-model-baseline/sprint-plan.md) | Runtime & model baseline refresh | Complete runtime package snapshot, lockstep SDKs, model catalog refresh, and measured protocol fixes | Audit-first SDD (Sprint 111 precedent) | Implementation complete; [issue #286](https://github.com/ProductoryHQ/ritemark-native/issues/286); [PR #287](https://github.com/ProductoryHQ/ritemark-native/pull/287); native execution deferred to release gates |
| [Sprint 117](./sprint-117-comment-agent-honesty/sprint-plan.md) | Comment→agent pipeline honesty | Unify dispatch paths A/B; IDs for all comment forms; correct per-document status; reply-to-comment on completion (#156); carry `documentPath` to the runtime; availability gating; visible target conversation; absorbs v1.12.0 Sprint 121 (#281): tasks go to the conversation open in the AI sidebar, named on the Send surface, with no confirmation step, bounded composer resize, immediate filterable `@` agent picker, collapsed comments that never cover text | Full SDD — crosses webview, host, sidebar store, and all three runtimes | **Merged 2026-09-15**; [issue #292](https://github.com/ProductoryHQ/ritemark-native/issues/292), [PR #293](https://github.com/ProductoryHQ/ritemark-native/pull/293); closed #156 and #281 |
| [Sprint 126](./sprint-126-store-certification/sprint-plan.md) | Microsoft Store certification gaps | Freemium classification; inappropriate AI-output reporting; correct StoreLogo2 imagery; remove external Git acquisition promotion while preserving SCM | Audit-first — shared AI reporting, targeted shell patch, Store metadata | **R2 and R4 merged 2026-09-16**; [issue #305](https://github.com/ProductoryHQ/ritemark-native/issues/305), [PR #304](https://github.com/ProductoryHQ/ritemark-native/pull/304). R1 and R3 are Partner Center work and remain open |

Order as run: 116 first so the rest validated against the final runtime/model baseline (same reasoning as v1.10.0’s Sprint 111-before-112), then 117. Both are merged. Sprint 126 runs on that landed baseline and is the only sprint left.

Sprint 126’s certified-candidate handoff depends on the release gates. Microsoft Store resubmission is blocked until all four report findings have verified fixes, and the new candidate needs a new immutable installer URL — the submitted `https://getritemark.com/windows/v1.10.1/Ritemark-Setup.exe` stays byte-for-byte unchanged.

## Sprint Preparation Status

- [x] Release thesis drafted, then re-cut on 2026-09-15 around Store certification.
- [x] Sprints 116 and 117 delivered and merged under this release.
- [x] Jarmo approved Sprint 117 depth (full) and its absorption of v1.12.0 Sprint 121 on 2026-09-14.
- [x] Sprints 118 and 119 moved to v1.12.0 with their complete SDD packages on 2026-09-15; their scope decisions are now v1.12.0's.
- [x] GitHub milestone `v1.11.0` created (milestone 11).
- [x] Sprint 116 issue [#286](https://github.com/ProductoryHQ/ritemark-native/issues/286) created under milestone `v1.11.0`; other sprint issues await their scope decisions.
- [x] Sprint 116 scope/kickoff and exact Phase 0 package approved; implementation runs on `codex/sprint-116-runtime-model-baseline` in its dedicated worktree.
- [x] Sprint 117 issue [#292](https://github.com/ProductoryHQ/ritemark-native/issues/292) published under milestone `v1.11.0` 2026-09-14; #156 and #281 re-homed to it and closed with [PR #293](https://github.com/ProductoryHQ/ritemark-native/pull/293) on 2026-09-15.
- [x] Sprint 126 added with report-to-deliverable traceability, acceptance checks, dependencies and explicit non-goals.
- [x] Sprint 126 completed Phase 0, received implementation approval, published [issue #305](https://github.com/ProductoryHQ/ritemark-native/issues/305), and merged [PR #304](https://github.com/ProductoryHQ/ritemark-native/pull/304) on 2026-09-16.
- [ ] R1 (Freemium classification and listing copy) and R3 (live StoreLogo2 asset and replacement artwork) — Jarmo, in Partner Center.
- [ ] Native darwin-x64 and win32-x64 execution plus signed artifact verification.
- [ ] Release candidate built, signed, notarized and published to a **new** immutable installer URL, then resubmitted.

## SDD Package Index

| Sprint | Core artifacts | Research/design depth | Approval boundary |
|---|---|---|---|
| [116](./sprint-116-runtime-model-baseline/sprint-plan.md) | plan, spec, scenarios, technical plan, tasks | current runtime/model/manifest audit | exact pins/catalog changes and rollback evidence |
| [117](./sprint-117-comment-agent-honesty/sprint-plan.md) | plan, spec, scenarios, technical plan, tasks | 23-finding current-state audit + interaction/state design | host-owned task contract and full-vs-surgical scope |
| [126](./sprint-126-store-certification/sprint-plan.md) | plan and certification traceability; full specification pending | live report findings captured; reporting/shell/asset audit pending | reporting destination/privacy/coverage, targeted Git fix, artwork and metadata approval |

## Evidence Base (research through 2026-09-13)

### Runtimes (bundled → latest published)

| Component | Checked-in baseline | Official candidate captured 2026-09-13 |
|---|---|---|
| Claude Code binary | 2.1.239 | 2.1.270 |
| `@anthropic-ai/claude-agent-sdk` (lockstep rule) | 0.3.239 | 0.3.270 |
| Codex app-server + code-mode-host + Windows helpers | 0.153.0 | 0.154.0 |
| OpenCode | 1.18.21 | 1.18.30 |
| `@agentclientprotocol/sdk` | 1.4.0 | 1.4.0 (unchanged) |

These exact pins were approved on 2026-09-13. The schema-v3 manifest has 12 source rows and installs 25 checked files, including the complete Codex package tree and OpenCode's own ripgrep. See the [dated audit](./sprint-116-runtime-model-baseline/research/runtime-model-audit.md) and [approved decision](./sprint-116-runtime-model-baseline/research/phase-0-recommendation.md).

### Model catalog baseline

- `src/ai/modelConfig.ts` now owns the canonical Claude, Codex, OpenAI, Gemini, image, and OpenRouter identities; a source scan rejects duplicates in production TypeScript outside that file.
- The bundled catalog is dated `2026-09-13`. Older or undated remote/cache snapshots cannot replace that offline floor; live discovery remains authoritative.
- Valid text defaults remain stable. Retired image defaults move to GPT Image 2 and Gemini 3.1 Flash Image, while a saved unavailable Flow model remains visible with an explicit replacement message.

### Comment→agent pipeline (full findings in the Sprint 117 Phase 0 input; 23 concrete inconsistencies found)

The highest-severity classes:

1. **Two divergent dispatch paths.** Margin rail (per-comment) and toolbar overview (bulk) use different mention-strippers, different assignment detection (DOM `data-agent` vs body `@alias`), different prompts (only bulk includes the don't-delete-markers guard; neither sends the real document path — bulk hardcodes the literal string `'the active document'`).
2. **Status can lie.** Standalone `<!-- -->` comment nodes have no ID → dispatch with `commentIds: []` → zero status feedback while the toolbar reports "Queued N". Bulk completion flips *all* grouped comments to `done` regardless of what the agent did. Cancelled Claude turns can report `done`. Status broadcasts globally by comment ID — the claimed per-document filter does not exist. Status survives neither editor nor sidebar reload.
3. **The answer lands invisibly.** The response text exists only in the resolved sidebar conversation (possibly a background thread the user never sees); approval/question cards for `ask`-mode land there too. Nothing switches the view; nothing replies to the comment (#156 explicitly deferred in v1.8.6).
4. **Context is wrong for queued tasks.** The runtime receives `[Currently editing: …]` + selection from the active tab *at drain time*, not the comment's `documentPath` — switch tabs while queued and the agent is told it is editing a different file.
5. **No gating.** Comment dispatch bypasses the runtime-availability gate — a comment can be queued into a signed-out runtime and fail only at the boundary.

### Moved to v1.12.0

The Transcriber-recording feasibility work and the Google Docs / OAuth evidence moved with Sprints 118 and 119 to [the v1.12.0 release plan](../v1.12.0/release-plan.md) on 2026-09-15. Nothing was discarded; the full packages, audits and design documents travelled intact.

<details>
<summary>Retained here for the record — the evidence as it stood when these sprints were part of v1.11.0</summary>

#### Transcriber recording (feasibility confirmed)

- Mic capture already exists in the product — `useVoiceDictation.ts` (getUserMedia → 16 kHz mono WAV chunks → base64 postMessage) — but only in the document-editor webview; the Transcribe panel has never requested the mic. Webview `allow` list already delegates `microphone` to all webviews, and macOS TCC/`NSMicrophoneUsageDescription` is asserted at sign time, so no shell/patch change is expected (to be confirmed at kickoff — this determines whether Sprint 118 alone would force shell-tier anyway; the runtime bump already does).
- The pipeline is path-driven end-to-end (`JobManager.enqueue({audioPath, …})`; sessions keyed by audio path), so recording needs: accumulate chunks host-side into a real file in the workspace/recordings location, then hand it to the existing enqueue/consent flow. Everything downstream (engine choice, cost consent, transcript markdown, library row, Insights) is unchanged.
- Constraints found: dictation's host handler transcribes-and-deletes chunks and *drops* chunks while busy (fine for dictation, loses audio for recording — recording needs its own accumulating sink, not the dictation controller); the only local encoder is macOS `afconvert` (WAV output is the cross-platform baseline; optional m4a compression is macOS-only); ElevenLabs uploads the file in a single request, so very long recordings inherit today's upload behavior.

#### Publish to Google Docs (from the voice memo)

Committed intent: prepare teaching materials in Ritemark → publish as Google Docs (easiest to share). Settings: connect Google account + choose a default Docs **template**. Toolbar (next to Convert to Word / Download PDF / Copy Markdown): **Create Google Docs** → creates the Doc, remembers its file ID; pressing **Sync** later updates the same Doc. One-way push.

Phase 0 must decide (research, not guessed here):

- **Conversion path** — compare three evidence-backed candidates against one fixture matrix: direct Markdown import (officially supported), the existing DOCX builder + Drive conversion, and native Docs API `batchUpdate`. Drive media update can replace a Google Doc's full contents while addressing its file ID; exact template/style/image and failure semantics still need canaries.
- **OAuth model** — installed-app system-browser flow with PKCE/state and a loopback/custom redirect approved for this shell; prefer the non-sensitive `drive.file` scope. Google's desktop/mobile Picker is a candidate for granting template access, but its special flow permits only `drive.file` and installed-app incremental authorization is not supported, so the combined account/template flow must be proven.
- **OAuth operations** — an external consent app in Testing issues seven-day refresh tokens when `drive.file` is requested. Google Cloud project ownership, consent publication/verification, release client configuration, and dedicated test accounts are explicit release blockers.
- **Doc identity storage** — proposed host-owned versioned binding registry keyed by canonical document URI + workspace identity. Frontmatter is not the default because Save As/copy/Git cloning would copy the remote ID and could target the wrong Doc. Includes atomic rename migration and missing/stale/deleted/cross-account behavior.
- **Template semantics** — what "using a template" means for a markdown push (copy template then replace body vs. style inheritance).
- **Create idempotency** — Drive pre-generated IDs do not apply to creation through Google Workspace conversion, so response-loss/orphan recovery needs an approved strategy before retries are safe.

</details>

## Scope Envelope

### In scope

- Everything in the Sprint Map above.
- GitHub milestone v1.11.0; issues per sprint (including absorbing existing #156 and #281 into Sprint 117).
- Release notes, user docs (`docs/user/`), architecture.md updates per sprint, and the standard full-release gate sequence (Gate 1 arm64 → Gate 2 x64/Windows, notarization, hardening windows, D1 source-freeze discipline).
- A new signed Windows candidate at a new immutable installer URL, and the authorized Partner Center resubmission that follows it.

### Explicitly out of scope

- Google Docs publishing and Transcriber direct recording — moved to v1.12.0 with Sprints 119 and 118.
- Rebuilding or replacing the already-submitted v1.10.1 installer under its existing URL.
- New billing or subscription implementation. Freemium is a *classification* of how third-party paid AI is already used, not a new payment feature in Ritemark.
- A comment thread schema / multi-turn comment conversations (beyond the single completion reply of #156).
- Windows/Intel voice dictation (#133, #203).
- Runtime marketplace, fourth runtime (#92), floating `latest` runtime dependencies.
- TipTap 2→3 migration (#243) — stays its own track.

## Risks (initial register)

| Risk | Severity | Note |
|---|---|---|
| Store certification remains blocked by four findings | High | Sprint 126 tracks each finding separately; require packaged-app and saved metadata evidence before resubmission |
| AI-output reports expose private content or have no reliable recipient | High | Sprint 126 Phase 0 freezes user-reviewed minimal payload, transport, retention and triage ownership |
| The R4 Git fix needs a `patches/vscode/` change, which forces shell-tier and a full rebuild | Medium | Already shell-tier from the Sprint 116 runtime binaries, so the tier costs nothing extra — but the patch must survive an upstream bump, so it needs a persistent applicability check |
| Metadata-only fixes are mistaken for full compliance | High | R2 and R4 require packaged-app evidence; all four findings are tracked separately to the end |
| A further certification round returns new findings | Medium | Record as new intake rather than silently widening Sprint 126; acceptance is never promised |
| Native Intel/Windows execution still unproven for this baseline | High | Remains a hard release gate before any candidate is built |

## Decisions needed from Jarmo before the remaining sprints start

1. Approve Sprint 126's implementation scope after its reporting/privacy, Git-promotion and live-artwork audit. Release inclusion and sequencing are decided; implementation is not yet approved.
2. Decide the reporting destination and its triage owner — R2 cannot be specified without it.
3. Resolved 2026-09-14: Sprint 117 runs the full correctness contract and absorbs Sprint 121.
4. Resolved 2026-09-15: Sprints 118 and 119 move to v1.12.0; v1.11.0 ships once Sprint 126 and the release gates are done.

## Current next steps

1. Sprint 126 Phase 0: audit reporting surfaces/delivery/privacy, trace the Git acquisition promotion, identify the live StoreLogo2 asset, then freeze the specification for Jarmo's implementation approval.
2. Create the Sprint 126 issue under milestone `v1.11.0` at scope freeze, and start on its own branch.
3. Run native darwin-x64 and win32-x64 execution plus signed artifact verification before the v1.11 release candidate.
4. Build, sign and notarize the candidate, publish it to a new immutable installer URL, then resubmit to Partner Center with per-finding evidence.

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-16 | Sprint 126 R2 and R4 merged via [PR #304](https://github.com/ProductoryHQ/ritemark-native/pull/304) | Validated on a running dev instance, not only in tests. Three defects surfaced there: a three-button dialog footer whose labels each wrapped to four lines at real sidebar width, fallback copy pointing at a control that had moved, and a z-index inversion that let `ThreadRail` (z-60) paint over every modal (z-50) — the last a webview-wide bug this sprint happened to expose. The Git/Node *missing* branch and the Source Control empty state were NOT driven live; they need a machine without Git, and the guarantee there is structural. |
| 2026-09-15 | Move Sprints 118 and 119 to v1.12.0 and re-cut v1.11.0 around Store certification | Jarmo: "meil on vaja Microsofti asjad korda teha ja siis teha uus release ja see üles panna." The Store submission is already lodged and blocked on four fixable findings; 118 and 119 are unstarted work whose value does not decay by one release. Google Docs publishing was the release's headline and was given up deliberately. Packages moved intact into the v1.12.0 folder. |
| 2026-09-15 | Add Sprint 126 to v1.11.0 for all four Microsoft Store certification findings | Jarmo requested a new sprint in the open release. Plan only; implementation, release builds and external submission changes remain gated. Numbers 120–125 are already allocated to v1.12.0. |
| 2026-09-07 | Draft plan created from Jarmo's five scope items | Voice memo (Google Docs) + runtimes + models + comment landing + transcriber recording |
| 2026-09-13 | Prepare all four full draft sprint packages without starting implementation | Makes scope, gates, and open decisions reviewable while preserving the release and per-sprint approval gates |
| 2026-09-13 | Raise preparation to Sprint 109-level SDD packages | Added traceable requirements, BDD scenarios, architecture/workstreams, phased tasks, audits, UX states, and Google API/OAuth evidence before scope approval |
| 2026-09-13 | Start the approved Sprint 116 slice | Jarmo approved its scope and kickoff. Milestone 11 exists; work runs on `codex/sprint-116-runtime-model-baseline`. Other sprint decisions remain open. |
| 2026-09-13 | Approve and implement the Sprint 116 Phase 0 package | Exact runtime/SDK pins, measured adapter fixes, canonical catalog changes, complete package dependency trees, and rollback policy approved. Local repository QA and Apple Silicon evidence pass; PR-native Intel/Windows evidence remains. |
| 2026-09-14 | Publish Sprint 116 for review and merge after green checks | Jarmo explicitly authorized issue publication, branch push, PR creation, and merge; issue #286 and PR #287 now track the sprint under milestone `v1.11.0`. |
| 2026-09-14 | Defer native Intel/Windows CI to release validation | Jarmo confirmed that today's merge does not produce installers. Local QA and Apple Silicon RUNDEV gate the implementation merge; cross-platform native execution remains mandatory before the v1.11 release. |
| 2026-09-14 | Approve Sprint 117 at full scope | The 23 findings share one message path and state model; the surgical subset would leave the two worst symptoms — wrong document context and the invisible landing — in place. |
| 2026-09-14 | Absorb v1.12.0 Sprint 121 (#281) into Sprint 117 | Two of Sprint 121's six outcomes were already Sprint 117 R4/R6/R7; the remaining three ergonomic outcomes (composer resize, `@` picker with explicit agent selection, collapsed-comment layout) change the same component Sprint 117 W6 rewrites (`MarginCommentRail` and the Comments menu) and share the `@` alias vocabulary. One sprint avoids rebuilding the rail in two releases; the resizable composer becomes a primitive Sprint 122 reuses. |
| 2026-09-14 | Start Sprint 117 on `sprint-117-comment-agent-honesty` from main `d0328249` | Jarmo: "täismaht ja 121 sulata 117 sisse". |
| 2026-09-14 | Comment tasks go to the conversation open in the AI sidebar; no confirmation dialog, no destination picker | Jarmo: "läheb automaatselt sinna, milline on hetkel visuaalselt avatud" |
| 2026-09-15 | Sprint 117 merged via [PR #293](https://github.com/ProductoryHQ/ritemark-native/pull/293); #292, #156 and #281 closed | Implementation validated on a running dev instance, not only in tests: five defects surfaced there (turn lookup by a stale conversation id, retry into a deleted conversation, status lost on window reload, a raw provider payload rendered in a comment, an unannounced agent takeover) and were fixed before merge. Two edge cases — signed-out runtime and a full queue — remain unit-tested only, because neither can be produced without breaking the environment. |

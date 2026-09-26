# Sprint 127 — New Anthropic models on day zero

Track: SDD (auto-detected: eight requirements; host↔binary and cross-repository boundaries; an automatically published feed is a trust boundary)<br>
Override with: "use plain full track"<br>
Release tier: **shell** (revised 2026-09-24, D4). The Claude Code bump changes `extensions/ritemark/binaries/agents/manifest.json`, so this sprint ships inside the v1.12.0 shell release, which is shell-tier already because of Sprint 119. The client changes stay under `extensions/ritemark/src/`, and nothing is published to `ritemark-public`. Before D4 the sprint was extension-tier.<br>
Status: **Phase 3 (DEVELOP); scope changed by D4 on 2026-09-24.**
- Jarmo approved the plan on 2026-09-24 ("tee sprint ja asap töösse") and D4 on the same day ("nii sobib!").
- The client work for R1–R3 and R5–R7 is committed.
- D4 withdraws the automatic publisher (R4). In its place: a bundled Claude Code bump (R9) and a pre-release check of Anthropic's catalog (R10).
- Jarmo's admin merges put the work on `main`: #347 and review follow-up #349 on 2026-09-25, and review follow-up #352 on 2026-09-26, after the release freeze.
- Phase 4 QA follows, with A1–A5 and A7.<br>
Branch: `sprint-127-day-zero-models`, created locally on 2026-09-24 from `03076a6`. This cloud session may push only the remote ref `claude/anthropic-models-bundled-cli-gtjld9`, so the sprint branch is pushed there (Q4).<br>
Issue: [#343](https://github.com/ProductoryHQ/ritemark-native/issues/343) under milestone `v1.12.0`<br>
Release: [v1.12.0](../release-plan.md) (Q3 resolved by D4)

## SDD Artifacts

- [spec.md](./spec.md) — behavior contract (R1–R10; R4 withdrawn by D4).
- [scenarios.md](./scenarios.md) — BDD matrix (S1–S40, including refusal paths; S16–S23 withdrawn by D4).
- [technical-plan.md](./technical-plan.md) — workstreams W0–W10 (W7 withdrawn by D4).
- [tasks.md](./tasks.md) — implementation checklist.
- [research/model-visibility-audit.md](./research/model-visibility-audit.md) — root causes and runtime evidence; [probes](./research/probes/README.md) re-run everything.
- [research/anthropic-served-catalog.md](./research/anthropic-served-catalog.md) — Anthropic's own catalog and minimum Claude Code versions; the basis for D4.

## Goal

A newly released Anthropic model can be chosen in the Claude Code agent by every Ritemark user within minutes. This covers subscription and API-key users alike, and needs no Claude Code CLI update and no Ritemark update.

*(Revised 2026-09-24, D4.)* Anthropic ties new models to a minimum Claude Code version, so the supported path is a bundled Claude Code that Anthropic says supports the model. The goal for this sprint is now:
- v1.12.0 ships a current Claude Code with Opus 5.5.
- Every release checks Anthropic's catalog and raises an alert when the bundled Claude Code falls behind.
- Ritemark's own feed keeps working as a hand-edited fallback.

Delivering new models between releases needs a separate Claude Code update channel, which is a later decision.

## Why

- **Subscription users** get their model list from the bundled CLI's compiled picker (2.1.270). The resolver treats that list as the only allowed set, so neither the remote feed nor a new bundled catalog can add a model for them. Reproduced with the unchanged resolver.
- **The bundled CLI updates only with a shell release.** Shell releases come roughly every 4–6 weeks; Claude Code published ten releases in eleven days, and Opus 5.5 arrived in CLI 2.1.280 on 2026-09-22.
- **The remote feed has been inert since 2026-07-25.** It is older than the bundled catalog, so every build ignores it.
- **The pinned CLI is not the obstacle.** It runs an unknown first-party model with valid current-generation requests. It also lists one when Ritemark declares it through the documented SDK `settings.modelPicker` channel.
- *(Added 2026-09-24, D4.)* **Anthropic publishes the answer and ties it to CLI versions.** Claude Code can take its model list from Anthropic's signed catalog (`downloads.claude.ai/model-catalog/v1/catalog.json`), but Anthropic keeps that switch off by default. The catalog states that Opus 5.5 needs Claude Code 2.1.280 or newer. See the [audit](./research/anthropic-served-catalog.md).

## Requirement Traceability

| Requirement | Scenarios | Workstreams | Close evidence |
|---|---|---|---|
| R1 subscription users see and run a published model | S1–S6 | W3 | Max/Pro RunDev evidence + declaration tests |
| R2 list follows the running credential | S7–S9 | W4 | resolver/provider tests + RunDev |
| R3 merge without hiding or resurrecting | S10–S15 | W1, W2 | resolver tests (incl. Sprint 116 A2 cases) |
| ~~R4 fully automatic, immediate publishing~~ | ~~S16–S23~~ | ~~W7~~ | withdrawn 2026-09-24 (D4); replaced by R9 and R10 |
| R5 clients pick up within minutes | S24–S27 | W5 | timing evidence + remote-source tests |
| R6 no silent substitution | S28–S29 | W6 | transcript evidence + error-classification tests |
| R7 guardrails and kill switches | S30–S33 | W1, W3 | validation tests + flag-off RunDev |
| R8 documentation and release process | S34 | W8 | architecture.md, release skill |
| R9 the bundled Claude Code supports every current model (D4) | S35–S37 | W9 | manifest and lockstep validation, runtime matrix, Opus 5.5 on a Max subscription |
| R10 pre-release check with an alert (D4) | S38–S40 | W10 | check tests + a release preflight run |

## Scope

- ~~**Publisher (`ritemark-public`).**~~ Withdrawn 2026-09-24 (D4). The plan was a job that read Anthropic's model list every 10 minutes with a Ritemark key, ran a canary for each new Claude model on the pinned CLI, and appended rows to the feed.
- **Claude Code currency (D4, R9).** v1.12.0 bundles Claude Code 2.1.281 with Agent SDK 0.3.281, and Opus 5.5 joins the bundled lineup.
- **Pre-release check (D4, R10).** A script reads Anthropic's public catalog. It raises an alert when the catalog is unreadable, has changed or has expired, or when a model needs a newer Claude Code than the build bundles. It runs in the release skill's preflight and in release-manager Gate 1.
- **Ritemark's own feed stays** and is edited by hand when needed.
- **Client (extension host).**
  - A per-row merge of feed, cache and bundled catalog.
  - Runtime declarations through `settings.modelPicker`, with an output budget, in discovery and in sessions.
  - `/v1/models` used only for API-key sign-in.
  - Conditional feed polling every 10 minutes.
  - Honest substitution notices and model-unavailable errors.
- **Out of scope:**
  - Updating the bundled CLI between shell releases, which needs a separate Claude Code update channel (D4).
  - Automatic defaults, retirements or `behavesAs`.
  - Auto-publishing of any kind.
  - Reading Anthropic's catalog at runtime.

## Product Decisions

- **2026-09-24 (Jarmo) D1:** existence, runnability and presentation are separate authorities. The CLI's list is not the existence authority.
- **2026-09-24 (Jarmo) D2:** subscription users may see a model before the CLI knows it natively, through a runtime declaration after a canary.
- **2026-09-24 (Jarmo) D3:** publishing is fully automatic and immediate.
- **2026-09-24 (proposed with this plan):**
  - **E1 — Automation never sets `behavesAs`.** The Opus 5 profile can send `thinking: disabled` in CLI side paths, and Opus 5.5 rejects that. The output budget comes from `CLAUDE_CODE_MAX_OUTPUT_TOKENS` instead (verified: 32K → 64K).
  - **E2 — Automation only appends.** Defaults, retirements and curation stay with people.
  - **E3 — The publisher runs in `ritemark-public`.** It is public, so Actions minutes are free, and it sits next to the feed.
  - **E4 — No new flag.** `remote-model-catalog` gates feed, probes and declarations.
  - **E5 — Automated rows carry `minAppVersion`** equal to this client's release, so older clients are unaffected.
  - **E6 — The client validates Claude ids before declaring them.** The CLI accepts arbitrary strings as picker rows.
- **2026-09-24 (Jarmo) — plan approved:** "tee sprint ja asap töösse". E1–E6 are accepted with the plan.
- **2026-09-24 — audits move to the QA gate.** A1–A5 and A7 need Jarmo's subscription accounts, Intel and Windows machines, or managed settings, and this cloud session has none of them. Implementation starts now; those items become QA-gate evidence in Phase 7 instead of a pre-code gate. A6 is measured at the first live publish.
- **2026-09-24 — the publisher ships as an apply-ready payload.** This session was denied push access to `ritemark-public` (Q1). The publisher is built and tested in `ritemark-public/`, mirroring that repository's layout. Jarmo applies it, or grants access. Once applied, `ritemark-public` becomes its source of truth. *(Withdrawn by D4 the same day; the payload was removed, and its history is in commit `e03b8fc`.)*
- **2026-09-24 (Jarmo) D4 — follow Anthropic's own catalog; keep Claude Code current.** Approved with "nii sobib!" after the [served-catalog audit](./research/anthropic-served-catalog.md). Jarmo had challenged the complexity ("kas kogu asi ei ole üle inseneeritud?") and the claim that the CLI cannot know new models. The audit found that Anthropic's own catalog lists Opus 5.5 with `min_claude_code_version` 2.1.280, above the bundled 2.1.270. So:
  1. v1.12.0 bundles Claude Code 2.1.281 with SDK 0.3.281, and Opus 5.5 joins the bundled lineup (R9).
  2. A pre-release script checks Anthropic's catalog and raises an alert (R10, as Jarmo asked). It alerts when the catalog cannot be read, has changed format or has expired, or lists a model that the bundled Claude Code is too old for.
  3. Ritemark's own feed keeps working, edited by hand, for other providers and to add or hide a model. It never declares a model to a Claude Code older than Anthropic's minimum for it.
  4. The automatic publisher is withdrawn (R4, E3, the payload), so no Anthropic API key or workspace is needed.
  5. Delivering new models between releases needs a Claude Code update channel outside full releases. That is a separate decision.

  D4 supersedes D3. It narrows D2: a runtime declaration is only for a model that the bundled CLI supports by Anthropic's minimum.

## Linked Issues

- [#343](https://github.com/ProductoryHQ/ritemark-native/issues/343) — New Anthropic models don't reach Claude subscription users until a shell release.

## Feature Flag Decision

No new flag. The work extends the existing stable `remote-model-catalog` flag ("so new models appear without an app update"). Turning it off already reduces the catalog to the bundled or cached floor. This sprint makes the same switch also stop runtime declarations (R7, S32). (The server-side `MODEL_CATALOG_AUTOPUBLISH` switch was withdrawn with R4 by D4.)

## Success Criteria

- [ ] ~~A Max subscriber on bundled CLI 2.1.270 sees and runs Opus 5.5 from the feed, with no restart and no update (R1).~~ *(Revised 2026-09-24, D4.)* A hand-added feed row reaches the menu without a restart, and only for a model the bundled Claude Code supports (R1).
- [ ] The Claude list is built from the credential that runs requests (R2).
- [ ] No stale document hides a current model or resurrects a dropped one (R3).
- ~~The publisher publishes Opus 5.5 by itself after a green canary, and refuses unsafe changes (R4).~~ Withdrawn 2026-09-24 (D4).
- [ ] Feed commit → model menu within 15 minutes on an open app (R5).
- [ ] An unavailable model is always named: substitution notice and clear error (R6).
- [ ] The id guard, the automated-row limits and the `remote-model-catalog` flag are verified (R7).
- [ ] The architecture doc and the release skill describe the new authority model (R8).
- [ ] v1.12.0 bundles Claude Code 2.1.281 with SDK 0.3.281. Manifest, lockstep and runtime-matrix checks pass, and a Max subscriber sees and runs Opus 5.5 (R9).
- [ ] The pre-release check passes against Anthropic's live catalog, and tests show an alert for each failure mode (R10).

## Implementation Notes (2026-09-24)

- `R1`: implemented. Feed rows with `claudeCode.inject` are declared to Claude Code as `settings.modelPicker` plus the output budget, both for discovery and for the session that runs the model. Unit-tested. The offline smoke check ran the real CLI 2.1.270 and 2.1.281 against a local API stand-in: the declared model was listed and requested with `max_tokens` 64000 and no tools ([evidence](./research/evidence/canary-smoke-2026-09-24.json)). Still to do: A1 and S1–S2 on a Max subscription.
- `R2`: implemented. `/v1/models` runs only for API-key sign-in. S7–S9 are manual QA.
- `R3`: implemented. Per-row `mergeStatic()`: tombstones, automated rows never defaults, `minAppVersion`. Covered by unit tests S10–S15 and S33.
- `R4`: implemented as a `ritemark-public` payload with 70 `node --test` tests (commit `e03b8fc`). Withdrawn by D4 the same day; the payload is removed.
- `R5`: implemented. The feed is polled every 10 minutes with ETag and when a stale sidebar is shown. S24 timing is manual QA.
- `R6`: implemented. The substitution line and named model-unavailable errors are unit-tested. A2 confirms the subscription-plan wording.
- `R7`: implemented. The id guard and the automated-row limits are checked in the client. The `remote-model-catalog` flag switches off fetch, injection and declarations.
- `R8`: done for `architecture.md`, the release skill (now "Claude Code and model currency"), release-manager Gate 1, the CHANGELOG, the release notes, the test checklist and the release plan, including the D4 pass.
- `R9` (D4): implemented. Claude Code 2.1.281 / SDK 0.3.281:
  - manifest rows measured from npm, and the runtime fetch gives PASS on all three targets;
  - validator snapshots updated, with the lockfile changed through npm;
  - the SDK type diff is additive, and `tsc` plus the tests are green;
  - the linux-x64 probes show Opus 5.5 listed natively (`opus` → `claude-opus-5-5`), with `max_tokens` 128000 and four betas that 2.1.270 did not send;
  - Opus 5.5 is in the bundled lineup.

  Still to prove: native darwin and Windows execution (Gate 1 and Gate 2, `verify-agent-runtimes.sh`) and S35 on a Max subscription.
- `R10` (D4): implemented. `npm run check:anthropic-models` passes against the live catalog (v1088), and 11 unit tests cover each alert and warning ([evidence](./research/evidence/anthropic-models-check-2026-09-24.txt)). It is wired into the release skill and release-manager.

## Risks

- **Side paths on an undeclared profile.** A few CLI side requests use the model's profile, and a declared model without `behavesAs` gets the generic modern profile. Risk is low, because unknown first-party models are treated as rejecting disabled thinking. A1 exercises a long session.
- **Plan limits.** A subscription may not include a new model. R6 turns that into a named error; A2 captures the shape.
- ~~**Scheduler latency.**~~ Withdrawn with R4 (D4).
- **Old clients.** Older clients take a fresher feed as a whole. The feed is inert while nobody edits it. Any hand edit starts from `export-bundled-model-catalog.ts --merge`, so it carries the complete current lineup.
- **Order of going live** *(revised 2026-09-24, D4).* Subscription users who also saved an Anthropic API key lose the key-based `/v1/models` list (R2). With R9, Opus 5.5 is native in v1.12.0, so they still see it. The publisher gate is withdrawn, and the release gate is now the R10 check.
- **Unsigned feed.** The Sprint 89 deferral stands. Client id validation, automated rows never becoming defaults, and tombstones bound the impact.
- *(Added 2026-09-24, D4.)* **Undocumented catalog URL.** Anthropic does not document `downloads.claude.ai/model-catalog/v1/`. The app does not read it at runtime; only the R10 release check does, and it raises an alert when the URL or its format changes.
- *(Added 2026-09-24, D4.)* **Claude Code 2.1.270 → 2.1.281.** Eleven CLI releases can change behavior that tests do not see. `tsc` and `npm test` run against the SDK 0.3.281 types, the linux-x64 probes check model listing and requests, and the runtime matrix records what is proven. Native darwin and Windows execution is proven at Gate 1 and Gate 2.

## Pre-Implementation Gate

- Passed 2026-09-24 with the plan's approval.
- Q1 (publisher location and access) and Q4 (branch) are resolved, see [spec.md](./spec.md#resolved-questions). Q2 (the Anthropic key and variable) and Q3 (the release vehicle) were resolved by D4 on 2026-09-24: no key is needed, and the vehicle is v1.12.0.
- Audit items A1–A5 and A7 are verified at the QA gate (Phase 7). A6 is measured at the first live publish (Phase 1).

## Approval

- [x] Jarmo approved this sprint plan (2026-09-24)

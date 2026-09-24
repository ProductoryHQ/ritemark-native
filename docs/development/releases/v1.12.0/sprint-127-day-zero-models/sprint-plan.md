# Sprint 127 — New Anthropic models on day zero

Track: SDD (auto-detected: eight requirements; host↔binary and cross-repository boundaries; an automatically published feed is a trust boundary)<br>
Override with: "use plain full track"<br>
Release tier: extension. Client changes stay under `extensions/ritemark/src/`, and the publisher lives in `jarmo-productory/ritemark-public`. No `binaries/agents/`, patch, `product.json` or other shell-tier path changes.<br>
Status: **Phase 3 (DEVELOP) done on 2026-09-24; Phase 4 (QA) waits on Jarmo.** The plan was approved by Jarmo on 2026-09-24 ("tee sprint ja asap töösse"). The client and the publisher payload are implemented and tested. Going live needs the payload applied to `ritemark-public` with its key and switch ([APPLY.md](./ritemark-public/APPLY.md)), and then audits A1–A5 and A7.<br>
Branch: `sprint-127-day-zero-models`, created locally on 2026-09-24 from `03076a6`. This cloud session may push only the remote ref `claude/anthropic-models-bundled-cli-gtjld9`, so the sprint branch is pushed there (Q4).<br>
Issue: [#343](https://github.com/ProductoryHQ/ritemark-native/issues/343) under milestone `v1.12.0`<br>
Release: [v1.12.0](../release-plan.md), proposed (see Q3)

## SDD Artifacts

- [spec.md](./spec.md) — behavior contract (R1–R8).
- [scenarios.md](./scenarios.md) — BDD matrix (S1–S34), including refusal paths.
- [technical-plan.md](./technical-plan.md) — workstreams W0–W8.
- [tasks.md](./tasks.md) — implementation checklist.
- [research/model-visibility-audit.md](./research/model-visibility-audit.md) — root causes and runtime evidence; [probes](./research/probes/README.md) re-run everything.

## Goal

A newly released Anthropic model can be chosen in the Claude Code agent by every Ritemark user within minutes. This covers subscription and API-key users alike, and needs no Claude Code CLI update and no Ritemark update.

## Why

- **Subscription users** get their model list from the bundled CLI's compiled picker (2.1.270). The resolver treats that list as the only allowed set, so neither the remote feed nor a new bundled catalog can add a model for them. Reproduced with the unchanged resolver.
- **The bundled CLI updates only with a shell release.** Shell releases come roughly every 4–6 weeks; Claude Code published ten releases in eleven days, and Opus 5.5 arrived in CLI 2.1.280 on 2026-09-22.
- **The remote feed has been inert since 2026-07-25.** It is older than the bundled catalog, so every build ignores it.
- **The pinned CLI is not the obstacle.** It runs an unknown first-party model with valid current-generation requests. It also lists one when Ritemark declares it through the documented SDK `settings.modelPicker` channel.

## Requirement Traceability

| Requirement | Scenarios | Workstreams | Close evidence |
|---|---|---|---|
| R1 subscription users see and run a published model | S1–S6 | W3 | Max/Pro RunDev evidence + declaration tests |
| R2 list follows the running credential | S7–S9 | W4 | resolver/provider tests + RunDev |
| R3 merge without hiding or resurrecting | S10–S15 | W1, W2 | resolver tests (incl. Sprint 116 A2 cases) |
| R4 fully automatic, immediate publishing | S16–S23 | W7 | publisher tests + first live publish (Opus 5.5) |
| R5 clients pick up within minutes | S24–S27 | W5 | timing evidence + remote-source tests |
| R6 no silent substitution | S28–S29 | W6 | transcript evidence + error-classification tests |
| R7 guardrails and kill switches | S30–S33 | W1, W3, W7 | validation tests + flag-off RunDev |
| R8 documentation and release process | S34 | W8 | architecture.md, release skill, public README |

## Scope

- **Publisher (`ritemark-public`).** Every 10 minutes it reads Anthropic's model list with a Ritemark key. It runs a canary for each new Claude model on the pinned CLI, then appends a row to the feed; only additions, never defaults.
- **Client (extension host).**
  - A per-row merge of feed, cache and bundled catalog.
  - Runtime declarations through `settings.modelPicker`, with an output budget, in discovery and in sessions.
  - `/v1/models` used only for API-key sign-in.
  - Conditional feed polling every 10 minutes.
  - Honest substitution notices and model-unavailable errors.
- **Out of scope:** updating the bundled CLI between shell releases, automatic defaults, retirements or `behavesAs`, and other providers' auto-publishing.

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
- **2026-09-24 — the publisher ships as an apply-ready payload.** This session was denied push access to `ritemark-public` (Q1). The publisher is built and tested in [ritemark-public/](./ritemark-public/APPLY.md), mirroring that repository's layout. Jarmo applies it, or grants access. Once applied, `ritemark-public` becomes its source of truth.

## Linked Issues

- [#343](https://github.com/ProductoryHQ/ritemark-native/issues/343) — New Anthropic models don't reach Claude subscription users until a shell release.

## Feature Flag Decision

No new flag. The work extends the existing stable `remote-model-catalog` flag ("so new models appear without an app update"). Turning it off already reduces the catalog to the bundled or cached floor. This sprint makes the same switch also stop runtime declarations (R7, S32). The server-side switch is the `MODEL_CATALOG_AUTOPUBLISH` repository variable.

## Success Criteria

- [ ] A Max subscriber on bundled CLI 2.1.270 sees and runs Opus 5.5 from the feed, with no restart and no update (R1).
- [ ] The Claude list is built from the credential that runs requests (R2).
- [ ] No stale document hides a current model or resurrects a dropped one (R3).
- [ ] The publisher publishes Opus 5.5 by itself after a green canary, and refuses unsafe changes (R4).
- [ ] Feed commit → model menu within 15 minutes on an open app (R5).
- [ ] An unavailable model is always named: substitution notice and clear error (R6).
- [ ] The id guard, automated-row limits and both kill switches are verified (R7).
- [ ] The architecture doc, the release skill and the public README describe the new authority model (R8).

## Implementation Notes (2026-09-24)

- `R1`: implemented. Feed rows with `claudeCode.inject` are declared to Claude Code as `settings.modelPicker` plus the output budget, both for discovery and for the session that runs the model. Unit-tested. The offline smoke check ran the real CLI 2.1.270 and 2.1.281 against a local API stand-in: the declared model was listed and requested with `max_tokens` 64000 and no tools ([evidence](./research/evidence/canary-smoke-2026-09-24.json)). Still to do: A1 and S1–S2 on a Max subscription.
- `R2`: implemented. `/v1/models` runs only for API-key sign-in. S7–S9 are manual QA.
- `R3`: implemented. Per-row `mergeStatic()`: tombstones, automated rows never defaults, `minAppVersion`. Covered by unit tests S10–S15 and S33.
- `R4`: implemented as the [ritemark-public payload](./ritemark-public/APPLY.md), with 70 `node --test` tests and the smoke check above. The workflow's triggers, permissions and pinned actions are guarded by tests. It goes live when Jarmo applies it; the first scheduled run is the S16 acceptance test.
- `R5`: implemented. The feed is polled every 10 minutes with ETag and when a stale sidebar is shown. S24 timing is manual QA.
- `R6`: implemented. The substitution line and named model-unavailable errors are unit-tested. A2 confirms the subscription-plan wording.
- `R7`: implemented. The id guard exists in both the client and the publisher. The automated-row limits are checked by the additions-only diff and in the client. The `remote-model-catalog` flag switches off fetch, injection and declarations.
- `R8`: done for `architecture.md`, the release skill, `feeds/README.md` (payload), the CHANGELOG, the release notes and the test checklist. The public README goes public when the payload is applied.

## Risks

- **Side paths on an undeclared profile.** A few CLI side requests use the model's profile, and a declared model without `behavesAs` gets the generic modern profile. Risk is low, because unknown first-party models are treated as rejecting disabled thinking. A1 exercises a long session.
- **Plan limits.** A subscription may not include a new model. R6 turns that into a named error; A2 captures the shape.
- **Scheduler latency.** GitHub schedules are best effort. A6 measures it, and `workflow_dispatch` is the manual override.
- **Old clients.** Older clients use whole-document freshness, so the bootstrap commit must be a complete current lineup for every provider. `export-bundled-model-catalog.ts` produces it, and the release skill keeps it current.
- **Order of going live.** Subscription users who also saved an Anthropic API key used to get `/v1/models` (R2 removes that, because the list described the key's account, not theirs). From then on they get new models through the publisher. The publisher must therefore be live before the client ships, or they briefly see fewer models than today. This is a release gate item (tasks Phase 7).
- **Unsigned feed.** The Sprint 89 deferral stands. The additions-only publisher, client id validation, automated rows never becoming defaults, and tombstones bound the impact.

## Pre-Implementation Gate

- Passed 2026-09-24 with the plan's approval.
- Q1 (publisher location and access) and Q4 (branch) are resolved, see [spec.md](./spec.md#resolved-questions). Q2, Jarmo creating the Anthropic key and variable, is needed only for the publisher to go live.
- Audit items A1–A5 and A7 are verified at the QA gate (Phase 7). A6 is measured at the first live publish (Phase 1).

## Approval

- [x] Jarmo approved this sprint plan (2026-09-24)

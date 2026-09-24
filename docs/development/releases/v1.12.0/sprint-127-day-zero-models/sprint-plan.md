# Sprint 127 — New Anthropic models on day zero

Track: SDD (auto-detected: eight requirements; host↔binary and cross-repository boundaries; an automatically published feed is a trust boundary)<br>
Override with: "use plain full track"<br>
Release tier: extension. Client changes stay under `extensions/ritemark/src/`, and the publisher lives in `jarmo-productory/ritemark-public`. No `binaries/agents/`, patch, `product.json` or other shell-tier path changes.<br>
Status: **Phase 2 (PLAN) — awaiting Jarmo's approval.** Research done 2026-09-24.<br>
Branch: `sprint-127-day-zero-models`, created at Phase 3. The planning documents are on `claude/anthropic-models-bundled-cli-gtjld9` (see Q4).<br>
Issue: pending — [draft](./research/github-issue-draft.md)<br>
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

## Feature Flag Check

- [x] Does this sprint need a feature flag? **No new flag.** The work extends the existing stable `remote-model-catalog` flag ("so new models appear without an app update"). Turning it off already reduces the catalog to the bundled or cached floor. This sprint makes the same switch also stop runtime declarations (R7, S32). The server-side switch is the `MODEL_CATALOG_AUTOPUBLISH` repository variable.

## Success Criteria

- [ ] A Max subscriber on bundled CLI 2.1.270 sees and runs Opus 5.5 from the feed, with no restart and no update (R1).
- [ ] The Claude list is built from the credential that runs requests (R2).
- [ ] No stale document hides a current model or resurrects a dropped one (R3).
- [ ] The publisher publishes Opus 5.5 by itself after a green canary, and refuses unsafe changes (R4).
- [ ] Feed commit → model menu within 15 minutes on an open app (R5).
- [ ] An unavailable model is always named: substitution notice and clear error (R6).
- [ ] The id guard, automated-row limits and both kill switches are verified (R7).
- [ ] The architecture doc, the release skill and the public README describe the new authority model (R8).

## Risks

- **Side paths on an undeclared profile.** A few CLI side requests use the model's profile, and a declared model without `behavesAs` gets the generic modern profile. Risk is low, because unknown first-party models are treated as rejecting disabled thinking. A1 exercises a long session.
- **Plan limits.** A subscription may not include a new model. R6 turns that into a named error; A2 captures the shape.
- **Scheduler latency.** GitHub schedules are best effort. A6 measures it, and `workflow_dispatch` is the manual override.
- **Old clients.** Older clients use whole-document freshness, so the bootstrap commit must be a complete current lineup for every provider. `export-bundled-model-catalog.ts` produces it, and the release skill keeps it current.
- **Unsigned feed.** The Sprint 89 deferral stands. The additions-only publisher, client id validation, automated rows never becoming defaults, and tombstones bound the impact.

## Pre-Implementation Gate

- Jarmo answers Q1–Q4 in [spec.md](./spec.md#open-questions). The main ones are push access to `ritemark-public` for Phase 1 and the Anthropic key.
- Phase 0 audit items A1–A5 run before Phase 2 code; A6 and A7 are measured during Phase 1.

## Approval

- [ ] Jarmo approved this sprint plan

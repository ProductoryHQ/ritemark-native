# Sprint 141: 2.1's model lineup

Track: SDD (auto-detected: four linked issues and the release's runtime review, across the model catalog, the feed in another repository, Flows' host and editor, and OpenCode's runtime; version-skew edge cases over fourteen shipped releases with two resolvers)
Override with: "use plain full track"

Branch: `sprint-141-model-lineup`, made on 26 October from the plan commit rebased on `origin/main` at `84ea15db` (Sprint 138's merge). The plan was written on `plan/sprint-141-model-lineup`.

Release tier: shell, because of W4's runtime updates:
- `extensions/ritemark/binaries/agents/manifest.json`, a shell-tier path;
- the Claude Agent SDK, an esbuild external that only a full release delivers.

Everything else is under `extensions/ritemark/src/` and `webview/`, extension-tier, and ships in 2.1.0's shell release. If the runtime review decides no update, this line changes to extension.

Status: **Approved (Phase 2 → 3), 26 October 2026,** by the Development manager under Jarmo's delegation of the same day, with all nine decisions as recommended (*Approval*, below). **Merge 1 built** on `sprint-141-model-lineup` (27 October): W1–W4 and W2b, with the evidence in [qa-evidence.md](qa-evidence.md). Merge 2 (W5, #529) follows A3's go. The tier line is confirmed: shell (the runtimes moved). #558 joined the same day under the scope-change protocol (R12, with R13 from A2).

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R13 and E1–E6.
- [scenarios.md](scenarios.md): S1–S55, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, what was checked while planning, the four audits, workstreams W1–W6, two merges and the release step.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

The release is 2.1.0 (`release-plan.md`, beside this folder). Its shape is in `ritemark-dev`: `releases/v2.1.0/shape.md`, item 4, approved by Jarmo on 21 October with all eight recommendations. Sprint 139 split these issues off on 26 October (its *Approval*, decision 1).

## Goal

2.1 offers the models the providers offer today: Gemini 4 Argon, and the current Claude and GPT models in OpenCode. A new Gemini user's Flow starts on a model their key can use. The model feed is right for every app version that reads it, and stays right after the release. OpenCode's lists follow what OpenCode and the provider offer, with no feed edit (the first to cut). The bundled agent runtimes are current, and the lineup matches them.

## Linked Issues

- [#532](https://github.com/ProductoryHQ/ritemark-native/issues/532): Gemini 4 Argon in `modelConfig.ts` and the bundled catalog (R1).
- [#531](https://github.com/ProductoryHQ/ritemark-native/issues/531): Flows' default Gemini model is `gemini-2.5-flash`, which Google limits to past users (R3–R5).
- [#530](https://github.com/ProductoryHQ/ritemark-native/issues/530): refresh the model feed to the current lineup without breaking older apps (R6–R9).
- [#529](https://github.com/ProductoryHQ/ritemark-native/issues/529): OpenCode's model lists from the providers' live lists, as Flows' are (R2, R10). The first to cut.
- The release's runtime review (R11): memory `feedback_release_runtime_review`; the release plan's *Runtime versions* and Feature-Complete Checklist.
- [#558](https://github.com/ProductoryHQ/ritemark-native/issues/558): the Gemini API key goes in the `x-goog-api-key` header, not the request URL (R12; added 26 October).

## MVP Scope

| Area | Requirements |
|---|---|
| Gemini 4 Argon: Flows, OpenCode's Google and OpenRouter groups, offline | R1 |
| OpenCode's hand-made lists: Claude 5.5s, GPT-6.1 Sol, the OpenRouter routes, with OpenRouter's own ids | R2 |
| Flows' Gemini default; the 2.5 rows kept for saved selections | R3 |
| One default for the Flow editor and the run | R4 |
| A saved Flow on a refused model says so in one sentence | R5 |
| The export keeps `claudeCode` and `minAppVersion` that older apps need | R6 |
| 2.1 takes declarations for its bundled Claude models from its own catalog | R7 |
| The feed refreshed to 2.1's lineup, gated per version, published with 2.1 | R8 |
| `check:model-feed`: every release's resolver against the candidate | R9 |
| OpenCode's lists from OpenCode's own list, narrowed by the provider, filtered | R10 (merge 2) |
| The runtime review and updates; `check:anthropic-models` | R11 |
| The Gemini key in a header at every call site, never in a URL (#558) | R12 (added 26 October) |
| Gemini's model list read in full, every page (A2's finding) | R13 (added 26 October) |
| One home for ids, version skew, tests, the bundle, docs, Windows | E1–E6 |

**Not in this sprint:**
- OpenCode's free `opencode/*` models in the menu, and a default for OpenCode;
- Codex's model source (#377);
- Flows' OpenAI list and default;
- hiding deprecated rows from menus;
- the ACP SDK 2.x update;
- Electron and Node (#515, the release's step);
- publishing the feed before 2.1.

The plan first listed the Gemini key's move to a header here, filed as #558. The Development manager added it on 26 October (R12).

## What the planning check found

The release plan asked to verify Sprint 139's lead: that 1.12.0's resolver already skips a feed default whose row is gated by `minAppVersion`. The details are in [technical-plan.md](technical-plan.md#checked-while-planning-26-october).

- **True for 1.12.0 and later.** The code was read, and each release's own resolver was run against a test feed. A Codex default `gpt-6.1-sol` on a row gated to 1.14.0 gives:
  - 1.12.0 and 1.13.0 their bundled GPT-5.6 Sol;
  - 1.14.0 and 2.0.x GPT-6.1 Sol.

  1.12.0's resolver differs from 2.0.0's only in hiding Claude below 5.
- **Not true for 1.8.1–1.11.0.** Those releases take the feed whole: 1.8.1–1.10.1 whatever its date, 1.11.0 when it is newer than their bundled catalog. A gated default falls to the first row they can see (GPT-6 Astra in the test). They don't know tombstones, so the refresh adds none.
- **Only 1.12.0 needs Sonnet 5.5's declaration.** Its Claude Code (2.1.281) doesn't know Sonnet 5.5; 2.1.289 (1.13.0) and later do. The issue said 1.12–1.14.
- **The Flow editor and the run take Flows' default from two places.** A feed default reaches the run and never the editor (R4).
- **OpenCode already reports its own model list** on every `session/new`. That is a runtime-authoritative source for #529, which Ritemark doesn't read yet.
- **OpenRouter serves Argon,** and its Claude ids use a dot (`claude-sonnet-5.5`). Checked in its public model list.
- **2.0.1 has no tag in this repository.** Its source commit is `7810385d`, which the check uses.

## The feed: a cross-repo step, published with 2.1

The feed lives in `jarmo-productory/ritemark-public` `feeds/model-catalog.json`. This sprint changes nothing there.

**What the sprint ships:**
- the export's carry-over (R6);
- the per-version check (R9);
- the rule that keeps feed declarations away from 2.1's own Claude models (R7);
- the release skill's new steps;
- a candidate with its report, as evidence in A1.

**At 2.1's publication** the release makes the candidate again from the release source and checks it again. Then it commits the feed as `jarmo-productory`, with the report in the release evidence. That makes it part of the release, which Jarmo approves. The release plan gains a checklist row for it (*Decisions* 7).

**Why not sooner:** 2.1's bundled catalog is newer than the current feed, so 2.1 ships correctly without the refresh. A feed refreshed early would give 2.0.1 a lineup that partly needs 2.1's runtimes.

## Not runnable without keys

Jarmo, 26 October: no test keys or accounts for now ("Mitte praegu"). These are recorded as not run, never worked around:
- a Flow's Gemini step on the new default;
- what a new Google account's key answers for the 2.5 models;
- a 2.1 turn on Argon (proven on 2.0.1's candidate on 24 October);
- OpenRouter turns, and OpenCode turns on the new Anthropic and OpenAI rows;
- #529's done-when;
- authenticated Claude turns and Sprint 128's background probes, unless Jarmo's Claude sign-in is available to the dev instance.

What runs without keys:
- Claude Code's model listing (unauthenticated);
- the request-capture probe (a local server);
- Codex's `model/list` and Codex turns on Jarmo's own ChatGPT sign-in;
- OpenCode's permission gate and model list with its free models;
- OpenRouter's public list and the models.dev registry;
- the per-version check;
- every unit test, with recorded fixtures.

## Windows

- **Before merge 1:** through the test overlay on the latest Windows build from `main`: the Flow editor's default and the lists in the AI sheet's bootstrap payload.
- **Before merge 2:** OpenCode's fallback and filter.
- **The runtime updates** reach Windows only through a shell build: Windows CI on the merge, then 2.1's Gate 2 (a Codex turn and OpenCode's permission gate on the PC).

## Product Decisions

- **2026-10-21 (Jarmo, the shape approved "with recommendations"):** item 4 is in 2.1, with its model items.
- **2026-10-24 (Jarmo):** "jah, lisa gemini-4-argon ja OpenCode #376 alla": Argon joins the lineup.
- **2026-10-26 (the Development manager, approving Sprint 139):** #529–#532 become this sprint, "2.1's model lineup".
- **2026-10-26 (Jarmo):** no test keys or accounts for now ("Mitte praegu").
- **2026-10-26 (engineering, in this plan):**
  - the runtime decides what can run: Claude Code for Claude (Sprint 127), OpenCode's own list for OpenCode (R10);
  - the bundled catalog is the record; the feed is exported from it at each shell release and checked against every release before it is published;
  - gates go on bundled rows up to `main`'s version, and in the feed by hand above it (R6);
  - OpenRouter's ids are OpenRouter's own, in `OPENROUTER_MODEL_IDS`;
  - no tombstones while 1.8.1–1.11.0 read the feed;
  - Flows' default is written once, and the editor takes it from the catalog (R4);
  - a saved Flow, chat or pick never moves to another model by itself.
- **2026-10-26 (the Development manager, the approval):** the plan approved with all nine decisions as recommended (*Approval*). Two additions to decision 8 and 9 are recorded there.
- **2026-10-26 (the Development manager, scope change):** #558 joins this sprint: "You're already in those files, and it's small." It becomes R12, with every Gemini call site and a test that no Gemini request URL carries `key=`, proven with unit tests and request mocks only. The Settings page's key Test (`RitemarkSettingsProvider.ts:1130`), which #558 didn't list, is one of those call sites.
- **2026-10-26 (engineering, after A2):**
  - Google documents that thinking tokens count against `maxOutputTokens`, and that a turn can stop at `MAX_TOKENS` with truncated or empty output. Gemini 3.8 Flash thinks at `medium` by default. So, by R3's own rule, Flows' Gemini default is **Gemini 3.5 Flash Lite**. It thinks at `minimal` by default; it is not a model that doesn't reason, as R3 first said.
  - Google's own advice for new projects names both models.
  - Two adjacent findings join under the protocol:
    - an answer cut off at Max tokens says so (R5, revised);
    - Gemini's model list is read in full, past its first 50 models (R13).

## Decisions

Nine. Each has a recommendation, and [spec.md](spec.md#open-questions) carries the same list. The Development manager decides them under the delegation. None is a release gate. **Decided on 26 October, all as recommended** (*Approval*).

1. **#529's design.** I recommend:
   - OpenCode's own model list as the runnability authority, as Claude Code's is for Claude;
   - narrowed by the provider's list for the person's key where Ritemark already asks for Flows (Google, OpenAI);
   - OpenRouter limited to the lineup's families.

   The issue proposed provider probes with a version rule. OpenCode's list makes that rule unnecessary. A3 confirms it can be read cheaply.
2. **#529 without a Google key.** I recommend:
   - build it last, as merge 2;
   - ship it on the keyless proofs (A3, fixtures, the free-model run), with the key proof listed as not run;
   - cut it to v2.2.0 if A3 shows that reading OpenCode's list needs a new process per probe, or can't be filtered to a short menu.
3. **OpenCode's hand-made rows follow the lineup (R2)** on the public lists' evidence, with turns not run. I recommend yes. These rows are also what every older app gets from the feed. A model a provider refuses lands on Sprint 139's model card.
4. **Flows' Gemini default.** I recommend:
   - Gemini 3.8 Flash, or 3.5 Flash Lite if A2 finds that thinking can use up a step's default 2,000 tokens;
   - changed without a run, which isn't possible without a key, because a new account's 2.5 Flash probably fails today.
5. **The Gemini 2.5 rows.** I recommend:
   - kept, deprecated, "Retained for saved selections", listed last;
   - no tombstone: older apps would show it, and past users still run these models.
6. **Sonnet 5.5's declaration.** I recommend:
   - carried in the feed for 1.12.0 (R6);
   - 2.1 takes declarations for the models it bundles from its own catalog (R7).

   2.1 is then immune whatever older apps need. A1 re-checks Sprint 127's shadowing on 1.13–2.0.x.
7. **When the feed is published.** I recommend:
   - with 2.1's publication, as a release step in `ritemark-public`, with the check's report;
   - a row in the release plan's checklist.
8. **The runtime updates.** I recommend:
   - all three to their latest at merge 1: on 26 October, Claude Code 2.1.310 with SDK 0.3.310, Codex 0.164.0 and OpenCode 1.19.4;
   - the ACP SDK stays at 1.4.0 (2.0.2 is a major version, for its own review);
   - a newer release after the merge is the release's call.
9. **1.8.1–1.11.0's Codex default after the refresh.** Those releases fall back to the first row they can see (GPT-6 Astra in today's order) when GPT-6.1 Sol is gated away from them. They use it only when no Codex cache matches their Codex. I recommend accepting it if A1's counts show few or none of these versions. Otherwise keep GPT-5.6 Sol first among the rows they can see.

## Feature Flag Check

No new feature flag:
- the lineup and Flows' default fix what 2.0 shows, for everyone;
- the existing `remote-model-catalog` flag already gates the feed, the live probes and the declarations, and it gates OpenCode's live list (R10) too;
- OpenCode's list also sits behind `opencode-integration`.

HARD RULE #1 holds:
- no row is removed, only added or marked deprecated;
- a saved Flow, chat or OpenCode pick keeps its model;
- the export's existing rules stay.

## Success Criteria

- [ ] Argon is in Flows' Gemini list and OpenCode's Google and OpenRouter groups, offline and online, once (R1).
- [ ] OpenCode's groups carry Claude Sonnet 5.5, Opus 5.5 and Haiku 5.5, GPT-6.1 Sol and the new OpenRouter routes, with OpenRouter's own ids (R2).
- [ ] A new Gemini step proposes the new default; a saved 2.5 step keeps its model; the 2.5 rows say they are retained (R3).
- [ ] The Flow editor and the run use the same default, from the catalog (R4).
- [ ] A Gemini step refused for its model says so in one sentence; nothing else changes its words (R5).
- [ ] The export keeps Sonnet 5.5's declaration and Argon's gate (R6).
- [ ] 2.1 declares nothing to its Claude Code for a model it bundles (R7).
- [ ] The candidate feed passes the check on every release from 1.8.1 to 2.1, and its report is accepted in A1 (R8, R9).
- [ ] The release skill says how to refresh the feed and how to hand-edit it (R9).
- [ ] OpenCode's groups follow OpenCode's own list with a key, and fall back to the static rows without one (R10, merge 2, or moved to v2.2.0 with A3).
- [ ] The runtime review is written; the decided updates pass their verification; `check:anthropic-models` is OK (R11).
- [ ] No Gemini request URL carries the key; every call site sends `x-goog-api-key`; a test enforces it (R12, #558).
- [ ] Gemini's model list is read past its first page (R13).
- [ ] At 2.1's publication, the feed is published with its report (R8, the release step).

## Risks

| Risk | Retirement |
|---|---|
| The refresh changes or hides a model on an older release | The per-version check (R9), S30, publish only with 2.1, revert by a commit |
| 1.8.1–1.11.0 take the feed whole | No tombstones; every validator checked; A1's counts; *Decisions* 9 |
| The carried declaration changes 1.13–2.0.x sessions | A1's probes per Claude Code; R7 for 2.1; else the row is gated to 1.13.0 |
| The new Gemini default can't be run | A2's docs rule, with 3.5 Flash Lite as the fallback; listed as not run |
| OpenCode's live list is noisy or costly | A3's filter and cost, the Experience lead's look, cut-first |
| A runtime update regresses | The verification set, OpenCode's HARD GATE, S46 |
| The feed is published by mistake before 2.1 | A release task; nothing in the sprint writes to `ritemark-public` |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **The v2.1.0 release plan** on `main`. Its row for this sprint says "Plan to write"; the Development manager updates it.
- **The Development manager:**
  - the decisions above;
  - the version counts from PostHog for A1;
  - the words of R3 and R5 as small wording;
  - the release plan's rows: the feed publish, *Runtime versions*.
- **The Experience lead:** a look at the OpenCode groups before merge 2.
- **Sprint 139 (merged):** the error matchers that R5 reuses.
- **The release:** the feed publish at 2.1's publication; #515; the native `v2.0.1` tag, if the release owner wants it.

## Pre-Implementation Gate

- This plan is reviewed, and the Development manager's approval, under Jarmo's delegation, gates Phase 0. Release approval stays Jarmo's (ritemark-dev `CLAUDE.md`, rule 7, and the delegation).
- Phase 1's audits come before any code. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [x] Approved on 26 October 2026 by the Development manager, under Jarmo's delegation of the same day: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" (ritemark-dev `decisions/log.md`, 26 October). Until 2.1's Gate 1 RC, the manager's word counts for plan approval, sprint start and admin merge of 2.1 work. Release approval (Gate 1, Gate 2, publish) stays Jarmo's.

**The decisions, all nine as recommended, and a tenth:**
1. **#529's design:**
   - OpenCode's own model list is the runnability authority;
   - Google's and OpenAI's lists for the person's key narrow it, where Ritemark already asks for Flows;
   - OpenRouter is limited to the lineup's families.
2. **#529 without a Google key:** built last as merge 2 and shipped on the keyless proofs, with the key proof listed as not run. It is cut to v2.2.0 if A3 shows that reading the list needs a new process per probe, or can't be filtered to a short menu.
3. **R2:** OpenCode's hand-made rows follow the lineup, on the public lists' evidence; turns not run.
4. **Flows' Gemini default:** Gemini 3.8 Flash, or 3.5 Flash Lite by A2's rule, changed without a run. A2 then applied the rule: 3.5 Flash Lite (*Product Decisions*, 26 October, after A2).
5. **The Gemini 2.5 rows:** kept, deprecated, "Retained for saved selections", last; no tombstone.
6. **Sonnet 5.5's declaration:** carried in the feed for 1.12.0 (R6); 2.1 takes declarations for its bundled Claude models from its own catalog (R7).
7. **The feed** is published with 2.1's publication as a release step in `ritemark-public`, with `check:model-feed`'s report, and gets a checklist row in the release plan.
8. **The runtime updates:** all three to their latest at merge 1, and the ACP SDK stays at 1.4.0.
   - *Addition:* check that the Codex 0.164.0 update, with `codesign-app.sh`'s agent signing, doesn't bring back the keychain prompt storm. The Codex Keychain items written by OpenAI's Codex don't list Ritemark's re-signed `codex-app-server` (`releases/v2.0.0/sprint-136-release/research/runtime-review.md`, *Codex and the keychain*).
   - The result is in `research/runtime-review.md`.
9. **1.8.1–1.11.0's static Codex default:** GPT-6 Astra is accepted as their fallback.
   - The User lead's PostHog counts (26 September – 26 October, test profiles removed):
     - 1.8.1–1.11.0: 37 people, most of them one-time 1.11 Store newcomers; 4 active in the last 7 days;
     - 1.14: 29 people (16 active in the last 7 days);
     - 2.0.x: 14 people (all active in the last 7 days).
   - A1 records them as its result.

10. **OpenCode's Google group leads with a model Google's free tier serves** (the Development manager under Jarmo's delegation, 27 October, from item 6 of the merge-1 report).
    - **Why:** the group's first row is OpenCode's one-shot model and the composer's first choice. Many people bring a free AI Studio key, and their first turn shouldn't land on an error card.
    - **The source:** Google's Gemini API pricing page (<https://ai.google.dev/gemini-api/docs/pricing>, last updated 2026-10-26). For the free tier it lists Gemini 3.8 Flash and 3.5 Flash Lite as "Free of charge", and Gemini 4 Argon and 3.1 Pro as "Not available". The rate-limits page (same date) points to AI Studio for per-model free limits and has no free-tier table of its own.
    - **The change:** Gemini 3.8 Flash is first in OpenCode's Google group in the bundled catalog and the candidate feed, with Argon second. `check:model-feed` re-run: exit 0, and every release from 1.8.1 now gets 3.8 Flash as that group's first row (`research/feed-check-report.md`).
    - **Left alone:** Flows' Gemini list (Argon first) and default (3.5 Flash Lite), OpenRouter's group, and the other lineups.

**After the approval:** #558 joined on 26 October (R12), and A2's findings added R13 and revised R5. Both are under the scope-change protocol, with `spec.md` first.

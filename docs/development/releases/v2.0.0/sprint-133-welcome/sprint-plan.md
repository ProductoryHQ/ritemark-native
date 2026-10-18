# Sprint 133: The welcome

Track: SDD (15 user-facing requirements; the extension, the webview, three patches shrinking and one gaining two hunks; privacy)
Override with: "use plain full track"
Branch: `sprint-133-welcome` (created only after approval, and only once Sprint 132 is merged)
Release tier: shell (patches 001, 016, 017 and 018; there is no release from main until 2.0)
Status: Phase 2 (PLAN) drafted 2026-10-18, **awaiting Jarmo's approval**. Not started.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R15 and E1–E7.
- [scenarios.md](scenarios.md): S1–S49, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, workstreams W1–W11, the four audits, one merge.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

The release is [v2.0.0](../release-plan.md), step 2. The design is the Experience lead's experience 2 (the welcome) and experience 32 (updating from 1.x, and the welcome's states), in `ritemark-dev`: `product/design/experience/experiences/welcome/` and `experiences/update/`.

## Goal

A window with no folder opens on one calm sheet. It asks which AI the person uses, signs them in with that provider's own sign-in, asks where their work is, and lands them on the project with the AI ready beside it. Someone updating from Ritemark 1 sees a shorter sheet once, already signed in, and is back in their work in one click. The usage-data choice is on the sheet, off until yes, and nothing at all is counted before it. Four anonymous events tell whether people reach a project.

## Linked Issues

- [#429](https://github.com/ProductoryHQ/ritemark-native/issues/429): the first launch sometimes opens a `.md` twice (R11).
- [#338](https://github.com/ProductoryHQ/ritemark-native/issues/338): mark non-production runs in analytics (R9).
- [#401](https://github.com/ProductoryHQ/ritemark-native/issues/401): the extension host's first 8 s on a fresh Windows profile (R15; decided in this plan, Open Question 4).
- [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107): watched; the bundle is measured before and after (E4).

## MVP Scope

| Area | Requirements |
|---|---|
| The welcome as a Ritemark page, alone in the window | R1 |
| Which AI do you use: ChatGPT, Claude, OpenCode; API keys (Anthropic only); Skip | R2 |
| Each provider's own sign-in, with Cancel and Open the page again | R3 |
| Each provider's state as its check answers; offline | R4 |
| Set up project: Open a folder…, Start a new project (a name, an empty folder); a missing Git or Node line | R5 |
| Landing on the project with the AI ready; an empty desk offers Text, Table and Web page | R6 |
| Usage data on the welcome, off until yes; the 1.x notice retired | R7 |
| Four anonymous events; dev runs marked | R8, R9 |
| Updating from 1.x: the welcome once | R10 |
| A first window opened with a file; one tab per file | R11 |
| Getting Started retired; its launch check's rows kept | R12 |
| A file's extension in muted ink | R13 |
| Nothing lost; Windows | R14, R15 |
| One consent gate, tests, the bundle, builds, docs, drift | E1–E7 |

**Not in this sprint:**
- Home, the project file and list, switching projects, What moved (step 3, Sprint 134);
- a ChatGPT API key;
- About this project, written by Claude or created with a new project (experience 24's open questions);
- the Settings redesign;
- a VS Code update.

## What 1.x's first window did, and where it lives in 2.0 (HARD RULE #1)

| 1.x | 2.0 | Requirement |
|---|---|---|
| Getting Started: New document, New table, New flow | The + and the head's New (Sprint 132) | R12 |
| Getting Started: Open folder | The welcome's step 2; the head's Open a folder… | R5, R12 |
| Getting Started: recent files and folders | The update welcome's projects; Switch project…; the project list in step 3 | R10, R12 |
| Getting Started: Getting started, Support articles and Blog links | Help, under You | R12 |
| Launch check: ChatGPT and Claude signed in, with log in | The welcome's states and Sign in; Settings' sign-in cards | R2–R4, R12 |
| Launch check: Git, and Node when needed (Windows, this computer's Claude) | A line at the top of step 2 when missing, with Use Ritemark's own Claude; rows in Settings under the runtime choice | R5, R12 |
| The usage-data notice, with Privacy Policy and Terms of Use | The welcome's switch; Settings, with both links | R7 |
| The AI sheet's onboarding wizard and setup views | Unchanged, for anyone who skipped the welcome | R14 |
| The AI sheet focused 4 s after start | Kept for project windows; not while the welcome shows | R1 |

## Analytics and privacy

- **Nothing is counted before yes** (Jarmo, 17 October). From this sprint, `ritemark.analytics.enabled` defaults to off; the PostHog client is not even created before a yes; every send passes one gate. This holds for the existing events too, not only the new four.
- **The four events** (`welcome_shown`, `ai_signed_in`, `project_opened`, `first_message_sent`) carry no path, name, file, message or account, only the properties in R8 and the existing shared ones, plus `build_channel`.
- **The held events** (Open Question 1): if Jarmo agrees, the welcome's first two events wait in memory until the person answers, and are dropped at a no.
- **1.x answers** (Open Question 2): an Opt Out stays off; an OK on the 1.x notice is not taken as a yes.
- **Dev runs** carry `build_channel: dev` (#338), and the automation profiles never answer yes, so they send nothing.
- **Expected effect:** PostHog's numbers drop to the people who say yes. That is the rule working, and the Development manager tells whoever reads the numbers.
- **Privacy policy:** opt-in and `build_channel` may need a line on ritemark.app. The Development manager takes it to the web side (cross-repo; nothing here changes it). GeoIP and what the existing events carry are not changed, and are listed in the same note.

## Windows

- **Round 1, before the merge:** the extension side through the test overlay on the latest Windows build from main (S45, S46).
- **Round 2, after the merge:** a Windows build from main for everything, including the shell parts (S45–S47, Getting Started gone, the welcome alone, the muted extension).
- **#401:** audited on a fresh Windows profile; fixed here if the cause is Ritemark's start-up code (Open Question 4).

## Tests and the production build

- Extension unit tests for the welcome's state, the landing, the update detection, the protocol, the consent gate and the events, and the healer.
- A VS Code unit test for the muted extension.
- CDP checks for the welcome alone, the landing and the update sheet; the screenshot baseline gains the welcome's frames.
- PostHog's live events checked on a production build: four after a yes, none before an answer or after a no.
- After the merge, a production build from a clean-room worktree at the merged commit, as a build check; all patches apply on the pin, a second run is clean, the stacking check passes; the drift check.

## Product Decisions

- **2026-10-15 (Jarmo):** OpenCode as the third choice; the 1.x Welcome tab's illustration as the header; sign-in buttons blue; a two-part progress bar on the header; "2 · Set up project".
- **2026-10-17 (Jarmo):** the usage-data choice is on the welcome, nothing counted until yes; people updating from 1.x see the welcome once; the Home tab comes in step 3 ("ok").
- **2026-10-17 (release plan):** the welcome is a Ritemark page; opening the folder reloads and the welcome writes where it is going.
- **2026-10-18 (the Experience lead's answers to this plan's design questions):**
  - the welcome alone is only the sheet on the ground; on Windows the caption buttons and no menu button;
  - a first window opened with a file opens it and counts nothing; the welcome waits until a project has been opened from it;
  - step 2 has no skip; a finished profile's window with no folder gets a short "Where do you want to start?" sheet;
  - the missing Git or Node line: its place, words and Use Ritemark's own Claude; its Settings rows under the runtime choice;
  - the landing's empty desk offers Text, Table and Web page as tiles, as every empty desk does;
  - OpenCode's Set up and API keys open a small sheet over the welcome;
  - Start a new project is a name field with Create and Change…; About this project stays out of step 2.
- **2026-10-18 (Development manager's brief):** no ChatGPT API key in 2.0. The release plan still lists it as a recommendation, so this plan's approval confirms it. The OpenAI key Settings holds for OpenCode and other services is not affected.
- **2026-10-18 (engineering, in this plan):**
  - one merge, not two: the shell part is small;
  - `workbench.startupEditor` set where it wins at start-up (the audit), and patch 017 retired;
  - the update detection reads `ritemark.activation.lastConfirmedVersion`, the only key that tells a 1.x profile from a fresh one;
  - the update sheet's recent folders come from VS Code's recent list for this step; Sprint 134's project list replaces it;
  - the What moved card arrives with Home in step 3.

## Decisions for Jarmo

Each has a recommendation. They are listed in plain words, in [spec.md](spec.md#open-questions) too.

1. **The welcome's events before the yes.** The switch is on step 2, after both "welcome shown" and "signed in" have happened. I recommend holding those two in memory and sending them only if the person says yes, dropping them otherwise; nothing leaves the computer or is written before the answer. Without this, no fresh start is ever counted.
2. **An OK on 1.x's notice.** I recommend it does not count as a yes, as the Experience lead drew it: everyone who did not opt out starts off and is asked once on the update sheet.
3. **The sample project.** I recommend leaving "Try the sample project" out of this sprint, until there is real content for it. The Experience lead has asked Jarmo the same.
4. **#401.** I recommend an audit first, and a fix in this sprint if the cause is in Ritemark's own start-up code.

## Feature Flag Check

No feature flag. 2.0 is built on main with no switch (Jarmo, 17 October). The existing `analytics` kill switch stays and is read through the one gate; it can only turn analytics off. HARD RULE #1 holds through the table above.

## Success Criteria

- [ ] A fresh profile goes from the welcome to a project with the AI ready, with Claude and with ChatGPT, signed in and signed out, with an existing folder and a new one, and with the network off (R1–R6).
- [ ] The welcome is alone in the window, as drawn, in Light and Dark (R1).
- [ ] A v1.14.0 profile sees the update welcome once, already signed in, and never again (R10).
- [ ] Nothing is sent to PostHog before a yes, from any part of Ritemark; the four events arrive after a yes, with `build_channel`; none after a no (R7–R9).
- [ ] A first launch with a `.md` opens it once; #429's reproduction ends with one tab (R11).
- [ ] VS Code's Getting Started page never shows; the launch check's rows live on the welcome and in Settings (R12).
- [ ] Extensions are in muted ink in the tree and on tabs (R13).
- [ ] Every 1.x first-window function works from its 2.0 home (R14).
- [ ] Windows: the welcome works on a build from main; the first seconds on a fresh profile lose no click (R15).
- [ ] A production build from a clean-room worktree succeeds after the merge; the drift is recorded (E5, E7).

## Risks

| Risk | Retirement |
|---|---|
| A route into Getting Started survives | Audit first; S40 tries every route |
| The welcome alone needs a shell hook | Audit first; one class, removed as soon as anything else opens |
| Sign-ins behave differently from inside the welcome | The same entry points as Settings; S8–S13 on both providers, and on Windows |
| Opt-in makes the numbers drop | Intended; said to whoever reads them |
| #401 is outside Ritemark | Recorded; R15's guarantee holds either way |
| The bundle grows | The illustration is a file; measured before and after |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprint 132 merged** (both merges): the frame, the head, the + and New, Ritemark's menus, the terminal as a tab.
- **The Experience lead's drawings and answers:** experience 2 and experience 32 (signed in, signed out, offline, checking and updating from 1.x), and the answers of 18 October (spec, *Resolved Questions*).

## Pre-Implementation Gate

- This plan's PR gets the usual automated review, and Jarmo's approval gates Phase 0.
- Phase 1's audits come before any code beyond the starting tree. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [ ] Jarmo approved this sprint plan

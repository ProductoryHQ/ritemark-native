# Sprint 147: The new Settings

Track: SDD (auto-detected: five linked issues on one page that holds every setting, a hard rule that none is lost, one High-tier host change, and a Windows measurement that decides one fix)
Override with: "use plain full track"
Branch: `sprint-147-settings`, made from `origin/main` at Phase 3, after approval and after Sprint 146 has merged. Each later PR has its own branch that starts with the same name (*Pull requests* below). This plan was written on `plan/sprint-147-settings`.
Release tier: extension. No path is on `CLAUDE.md`'s shell-tier list; it ships in 2.2's shell release ([release-plan.md](../release-plan.md)).
Status: **Approved**, 1 November 2026, by the Development manager on Jarmo's 2.2 delegation (*Approval* below). The code named under *What reading the code added* was read for the plan, not run.

## SDD Artifacts

- [spec.md](spec.md): R1–R12 and E1–E5, with **the inventory of every setting today** (R1) as the QA matrix, and the decisions.
- [technical-plan.md](technical-plan.md): what exists today, the four audits that come first (A1 is the Windows measurement), workstreams W1–W6, risks.
- [tasks.md](tasks.md): the checklist by phase.
- This file: intent, PRs, cut order, decisions, and the questions at the end.
- `research/` is not created yet. Phase 1 writes one file per audit there, before the code it gates.

## Goal

Settings becomes a tab of plain sections, the Experience lead's experience 15: AI accounts, Appearance, Sharing, Usage data, Updates and Advanced, with AI on this computer joining when Sprint 151 ships it. Every setting the build has today keeps a place and works, and none is added. Around that: a read-only list of what each AI can use, an open Settings tab that follows changes made elsewhere, the shared Button on every button, and a page that draws at once on Windows.

## Linked Issues

| Issue | What | Req | Seen so far |
|---|---|---|---|
| [#592](https://github.com/ProductoryHQ/ritemark-native/issues/592) | The epic: today's settings in seven plain sections, none added | R1–R9 | The drawing, checked against the build on 29 October |
| [#415](https://github.com/ProductoryHQ/ritemark-native/issues/415) | What each AI can use (part 1); tidy the sections (part 2, which experience 15 is) | R12, R2 | Raised 12 October |
| [#460](https://github.com/ProductoryHQ/ritemark-native/issues/460) | Settings doesn't redraw when a sign-in or the runtime changes elsewhere | R11 | Sprint 133's QA (PR #453), the 2.0 parity list (PR #458) |
| [#577](https://github.com/ProductoryHQ/ritemark-native/issues/577) | Hand-rolled buttons on Settings and the Flow step panel | R9 | QA on PR #574 (Sprint 144) |
| [#593](https://github.com/ProductoryHQ/ritemark-native/issues/593) | Settings takes about 13 s to draw on Windows | R10 | 2.1.0's Windows Gate 2 (RC3, 27 October) |

## What reading the code added

- **One host file and one page.** `RitemarkSettingsProvider.ts` (1,558 lines) holds the panel, every message, the key store and its tests, the sign-in calls and the probes; `RitemarkSettings.tsx` (2,101 lines) is the page. The page sends 28 message types and Google Docs' five. Since the key handling sits in the same host file as everything else, every host change goes into one PR (PR 3, High), and PRs 1 and 2 change only the page.
- **Suspects for #593, not a diagnosis.** The page shows a spinner until one message carries everything (`RitemarkSettings.tsx:342`). That message waits for five secrets read one by one, transcript storage's size, the update snapshot (with a network check if none was ever made), Claude's setup status, ChatGPT's binary and sign-in, and the Git and Node probes. It runs twice per open (`RitemarkSettingsProvider.ts:571` and `:312`), again on every setting and theme change, and reads ChatGPT's binary status twice each time. The page's script is the shared 8.6 MB bundle. A1 measures which of these is the 13 s.
- **The page holds every saved key.** Each key's value goes to the page "full for input" (`:711–735`), for the fields and the eye. The drawing never shows a key, so the new sheet doesn't need them (decision 2).
- **#460 is partly fixed already.** The page follows the theme, usage data, Claude's and ChatGPT's status events and Google Docs. It has no listener for the runtime choice or any other setting changed in All settings, none for a key saved elsewhere, and nothing for a sign-in no event reports. A2 lists which paths are still stale before anything is fixed.
- **The ways in keep working without a host change.** Five section names (Sprint 145 added `openai-api-key` after the drawing's inventory of 29 October) and a dozen openers with none; the page maps the names to the new places.
- **The drawing's "also in each project's menu" for Terminal and Extensions doesn't match the build:** the project menu (`package.json`, `ritemark/projectHead`) has neither (question 7).
- **One control is missing.** Two of the drawing's choices are segmented (Where the AI runs from, Text size in chats), and `components/ui/` has no segmented control or radio group. A new `ui/segmented-control.tsx` on native radio inputs needs no new dependency and gets its catalogue row. The section list is the shared Tabs, vertical (Radix 1.1.13 supports it).
- **The Claude SDK can report what #415 asks** (skills, plugins and MCP servers in a session's start report; `mcpServerStatus()`, SDK 0.3.310), but Ritemark reads none of it today, nor ChatGPT's or OpenCode's lists. A3 finds what each reports and at what cost.
- **The timeout's words need a check.** The setting says "Inactivity timeout for Claude"; the drawing says "Ritemark stops the AI". The value goes to every runtime's prompt call; A4 checks which honour it, and the row's words follow.

## MVP Scope

| Area | Requirement | Proven by |
|---|---|---|
| Every setting keeps a place and works | R1 | The inventory test; every row's check in `qa-evidence.md` |
| A tab of sections, the ways in mapped | R2 | Render and mapping tests; every opener (L rows) |
| AI accounts, the Details sheets, the API keys sheet | R3 | Render tests per state; the key round trip on the Mac and on Windows |
| Appearance, Sharing, Usage data, Updates, Advanced | R4–R8 | The inventory rows; screenshots in Light and Dark |
| The shared Button with a tooltip (#577) | R9 | No hand-rolled button or native select left; the Flow step panel as before at rest |
| Draws at once on Windows (#593) | R10 | A1's runs before and after, on the Windows PC and the Mac |
| Follows changes made elsewhere (#460) | R11 | A2's table, stale on `main`, redrawn on the branch |
| What each AI can use (#415) | R12 | Parsing tests from recorded reports; the list on a dev instance |

**Not in this sprint:** the first drawing's new settings (its "Later, not in 2.2"); AI on this computer (Sprint 151) and Web pages (Sprint 149); installing skills, connectors or plugins; splitting the shared bundle (GH #107); any change to how keys are stored or how sign-in works.

## Where later sprints own a part

- **AI on this computer** is Sprint 151's, the first sprint in the release's cut order. **147 draws nothing there** (recommended, decision 1): the section joins the list, second, when 151 ships it. A placeholder would be a "coming soon" message, which hard rule 1 forbids, and if 151 moves to 2.3, 2.2's Settings simply has six sections.
- **Web pages** in Sharing is Sprint 149's (publishing). 149 comes after 147, so 147 draws no row for it; 149 adds it.
- The sections are a list of data, so each later sprint adds one entry.

## Pull requests

Four, so the High paths sit in one PR and the item cut first stands alone. Each PR's Risk section names its tier and the paths that set it, and `control-states.mjs`' result when a shared control changed. Findings are answered and the merge is at the reviewed head (`REVIEW.md`, *Before the merge*).

| PR | Branch | Holds | Release tier | Review tier |
|---|---|---|---|---|
| 1 | `sprint-147-settings` | The inventory test (W1); the frame, the sections list, `ui/segmented-control.tsx` (W2); Appearance, Sharing, Usage data, Updates, Advanced (W3); AI accounts holding today's AI and key cards, moved whole; R9 on what it touches and the Flow step panel's two buttons | extension | Standard (`webview/src/`). The new control's catalogue images approved by the Experience lead; screenshots to the lead |
| 2 | `sprint-147-settings-ai` | AI accounts: the three rows, the Details sheets, the API keys sheet, AI information (W4) | extension | Standard (`webview/src/`; it sends today's messages, so no host key or sign-in code changes). Its proof is the key round trip for all five keys and the sign-in rows, on the Mac and on Windows |
| 3 | `sprint-147-settings-host` | Draw first, then fill in (#593); one probe run per open; keys stay in the host (decision 2); follow changes elsewhere (#460); the tab's title; the page's handling of the parts (W5) | extension | **High**: the key handling in `src/settings/`; `src/agent/setup.ts` if A1 puts a fix there, and `src/update/` if A2 needs an event from it, so every High path stays in this PR. `/code-review` at high and `/security-review`, up to three rounds; proof: A1's runs before and after, on Windows and the Mac, and the key round trip again |
| 4 | `sprint-147-settings-capabilities` | What each AI can use (#415, W6) | extension | Standard (new files in `src/runtime/` and next to each runtime, outside the permission paths; `webview/src/`); two delegating lines in the provider that don't touch key handling. If the reviewer judges otherwise, it goes to High |

**Order:** A1 (the Windows measurement) first, while PR 1 is built. PR 1 next: it needs only the drawing as it is. PR 2 after PR 1. PR 3 after PR 2 (both change how the page handles messages) and after A1 and A2. PR 4 last, after PR 2's sheets and the lead's answer on where it lives.

**Between merges `main` stays releasable:** after PR 1 every AI and key card still works, moved whole into AI accounts; PR 2 redraws them.

## Cut order

If the appetite runs out, the first goes first:

1. **What each AI can use** (#415, PR 4) moves to 2.3. It is new information the drawing doesn't place yet, and the most new host code.
2. **The theme pictures:** Appearance keeps today's two theme cards, in the new section.
3. **The Updates card's redraw:** today's update block moves into the section in the new words, without the one-card layout.

Not cut: every setting in its place (R1), the sections in plain words, AI accounts with its two sheets, #577, #460 and #593. If more must go, Jarmo decides.

## Windows

- **Every PR is extension-tier**, so each goes through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`) before its merge, by the "Ritemark on Windows" session, at 100% and 150%, in Light and Dark.
- **A1 runs there first,** and again on PR 3's branch, the same way.
- **The key round trip** on Windows for PR 2 and PR 3 (keys stored through the system's own protection there), and I5 on a PC without Git.

## Product Decisions

- **2026-10-29 (Jarmo):** today's settings in seven sections, none added.
- **2026-10-31 (the release plan):** 147 after 146; 151 after 147, since its section lives in the new Settings.
- **Engineering, in this plan (approved with it):**
  - Every host change goes into PR 3, so the High paths sit in one PR; PRs 1 and 2 send today's messages.
  - The page maps today's five section names to the new places, so no opener changes.
  - Use an API key instead keeps the host's own prompt (`claude:enterApiKey`), so key handling doesn't change in PR 2.
  - When the AI goes quiet offers 5, 10, 15, 20, 30, 45 and 60 minutes, and the stored value when it isn't one of them.
  - The tab's title reads Settings, as drawn.
  - The theme pictures are drawn in the bundle, not as image files.

## Decisions for Jarmo

Three, each with a recommendation. [spec.md](spec.md#decisions) carries the same list.

1. **AI on this computer appears only when Sprint 151 ships it,** and Web pages only with Sprint 149. Nothing shows as "coming". **Recommended: yes.** If 151 is cut, 2.2's Settings has six sections.
2. **A saved key never goes back to the page.** The API keys sheet says "Saved · it works", and the eye that showed a saved key goes; the eye for a key you're typing stays. To see a key again, you get it from the service. **Recommended: yes**, since a key then stays only in the part of Ritemark that stores it. You're asked because a way to do something leaves.
3. **This sprint's cut order:** what each AI can use first (to 2.3), then the theme pictures, then the Updates card's redraw. **Recommended: yes.**

## Feature Flag Check

One new flag, `settings-ai-capabilities`, for R12 alone (#415, PR 4): what each AI can use starts an AI session and adds host and page behaviour, so it can be turned off without touching the runtimes' flags or the rest of the page. It is ON by default (HARD RULE #2), registered in `src/features/flags.ts`, and gates both the host's request handler and the Details sheets' section; with it off, the sheets draw as they would without R12. The rest needs no new flag: the new page replaces the old one, and every setting moves with it (R1); a fault is fixed or reverted by an extension release. (Codex's review of #627.) The existing flags gate the same rows as today: `codex-integration`, `opencode-integration`, `transcription-workbench`, `google-docs-publishing` (spec R1). HARD RULE #1 holds: nothing is removed, the chat's exact size moves to All settings as the drawing says, and reading a saved key back goes only with Jarmo's answer to decision 2.

## Testing

- **The Mac, here:** `npm test` (the inventory test, the mapping test, render tests per state, the host's part messages, the capability readers' parsing), the webview's tests and `tsc --noEmit`, and `control-states.mjs` on PR 1.
- **Hidden dev instances** (`open -n -g -j`), one launch per check, `--use-mock-keychain`, a short profile under `/private/tmp`, a port checked to be free, and CDP input only.
- **Isolated AI homes** (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`) for every run that doesn't need a signed-in AI; the user's `HOME` isn't changed. Sign-in rows start and cancel; nothing signs the person's own accounts out.
- **Keys:** the round trip uses the test keys from the test keys registry, injected by its script; nobody types a key.
- **Not here:** Windows (the overlay session).

## Success Criteria

- [ ] Every row of the inventory has its new place in the build and its check's result in `qa-evidence.md`; the inventory test passes on `main` after the last merge (R1).
- [ ] Settings is a tab named Settings with six sections in plain words, and every way in lands on its place (R2).
- [ ] Claude, ChatGPT and OpenCode each show their state and next step; all five keys can be added, tested, changed and removed, on the Mac and on Windows (R3).
- [ ] Appearance, Sharing, Usage data, Updates and Advanced hold today's settings in the lead's words, in Light and Dark, at any desk width (R4–R8).
- [ ] No hand-rolled button or native select is left on Settings; every button has a tooltip; the Flow step panel looks as before (R9).
- [ ] On the Windows PC, the settings that need no probe show within 300 ms of the page's script loading, or A1 has set the target the measurement supports (R10).
- [ ] Every stale row in A2's table redraws (R11).
- [ ] Each AI's skills, connectors and plugins show read-only where the lead puts them, or the item has moved to 2.3 (R12).
- [ ] Each check failed on `main` first, or the plan says why it couldn't (E1).

## Risks

| Risk | Retirement |
|---|---|
| A setting is lost in the move (v1.3.0) | The inventory and its test before the page changes; PR 1 moves the AI cards whole |
| Key entry breaks | Today's messages; the key round trip on the Mac and Windows, in PR 2 and again in PR 3 |
| The 13 s is the bundle, not the probes | A1 separates them; the target is measured from the script's load |
| The lead's answers come late | PR 1 needs none of them; the cut order |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprint 146 merged:** the input-mode tracker, the catalogue and `control-states.mjs`, the one tooltip look and the narrow-button rule. 147's new control gets its catalogue row.
- **The Experience lead** for the answers below, and the screenshots before each UI merge.
- **The "Ritemark on Windows" session** for A1 and the overlay checks.
- **Sprints 149 and 151** add their parts to the page later.

## Pre-Implementation Gate

- The plan is approved (*Approval* below), under Jarmo's own delegation of 2.2's approvals to the Development manager (ritemark-dev `decisions/log.md`, c45d69c). A message from the manager to another session carries it only by quoting the log's row (ritemark-dev `CLAUDE.md`, rule 7).
- Decision 2 stays Jarmo's (HARD RULE #1: a way to do something leaves). Until he answers, the page keeps today's behaviour for a saved key, and PR 3's "keys stay in the host" change waits for his word.
- Sprint 146 has merged.
- Phase 1's audits come before the code they gate: A1 before W5, A2 before W5's listeners, A3 before W6, A4 before W1's list is final. When an audit changes a requirement, `spec.md` changes first.
- The branch is made before the first code edit, and `git branch --show-current` shows it.

## Approval

- [x] Approved on 1 November 2026 by the Development manager, on Jarmo's delegation of every 2.2 sprint until the release candidate: "võta nii et kõik sprindid on 2.2 osas approved until RC - ei vaja heakskiitu. I trust you. When needed use admin merge and clean worktrees" (ritemark-dev `decisions/log.md`, c45d69c).
- [x] Decision 1: yes, as recommended. Decision 3: yes, as recommended.
- [ ] Decision 2 (a saved key never back on the page): Jarmo's, since a way to do something leaves (HARD RULE #1). Today's behaviour stays until he answers.
- [x] Sprint start: the audits now; the code after Sprint 146 has merged.

## Questions

Only what the drawing doesn't settle, each with a recommendation.

**For the Experience lead:**

1. **What each AI can use (#415): where does it go?** Recommended: a folded "What Claude can use" in each AI's Details sheet, and an OpenCode Details sheet for it (none is drawn).
2. **Removing a saved key** (I37): the API keys sheet has Test, Change, Get a key and Add, but no way to remove one, which today's page has. Recommended: Change opens the field with Save, Cancel and Remove key.
3. **A skipped version and paused update reminders** (I49, I50): no place is drawn, nor Resume (today's Re-enable Notifications). Recommended: one line under Check now ("You skipped 2.2.1." or "Reminders paused until 8 November.", with Resume).
4. **Text size in chats:** which three sizes, and how a size set in All settings shows. Recommended: 12, 13 (today's default) and 15 px; another size shows no step chosen, with "16 px, set in All settings".
5. **Ritemark's parts: what does Repair… open?** Recommended: a sheet like the API keys sheet, one row per part (the voice model, Claude, ChatGPT) with its state, version and today's actions (Install, Repair, Reload, Check).
6. **OpenCode's row:** what Set up opens, and when it reads Ready. Recommended: the API keys sheet; Ready once a key OpenCode uses is saved.
7. **More tools: Terminal and Extensions.** The build's project menu has neither, though the drawing says they're there too. Recommended: All settings only, since Terminal is already the tab row's +. Extensions would need Jarmo's word, since the marketplace is hidden by a locked decision.
8. **A narrow desk:** how the section list reads when the desk is narrow. Recommended: under 640 wide, the list becomes a Select at the top of the page.
9. **An AI's row when it isn't installed, needs a repair, or is signing in** (the drawing puts those states on the sheet, not the row). Recommended: "Not installed" with Set up; "Needs a repair" with Repair…; "Signing in…" with Cancel.

**For Jarmo:** decisions 1–3 above: AI on this computer only with Sprint 151; a saved key never back on the page; this sprint's cut order.

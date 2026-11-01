# Sprint 147 Tasks

Nothing here starts before Jarmo approves the plan, and the build starts only after Sprint 146 has merged. Tick a box only when the change is on its PR's branch. W numbers are workstreams in [technical-plan.md](technical-plan.md); R, E and I numbers are in [spec.md](spec.md); A numbers are the audits.

## Phase 0: Branch and starting tree

- [ ] Jarmo's approval is on the sprint plan, with his answers to the decisions; Sprint 146's PRs are merged
- [ ] `git checkout -b sprint-147-settings` from `origin/main`; `git branch --show-current` shows it before any edit. Later PRs: `sprint-147-settings-ai`, `-host`, `-capabilities`, each from `origin/main` the same way
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [ ] Asked: the Experience lead for the answers to the plan's questions; the "Ritemark on Windows" session for A1 and the overlay checks

## Phase 1: Audits (each in `research/`, before its code)

- [ ] **A1 first:** the measurement branch's timing lines; ten runs on the Windows PC through the overlay and ten on the Mac; `research/windows-draw-time.md`; R10's target confirmed or changed in `spec.md`
- [ ] A2 `research/stale-settings.md`: every way a change elsewhere reaches an open Settings tab, redrawn or stale
- [ ] A3 `research/agent-capabilities.md`: what Claude, ChatGPT and OpenCode report of their skills, connectors and plugins, and at what cost
- [ ] A4 `research/inventory-check.md`: the inventory against the code at the branch's start; rows it adds go into spec R1 first; the timeout's AIs; the `docs/user/` pages to update

## Phase 2: PR 1, the frame and five sections (W1, W2, W3; R1, R2, R4–R9)

- [ ] `settingsInventory.test.ts` against today's page: passes; with one message removed, fails (E1)
- [ ] The section-name mapping and its test (I61)
- [ ] `ui/segmented-control.tsx`, its catalogue row, its images approved by the Experience lead; `control-states.mjs` exits 0
- [ ] The vertical Tabs for the list (a `tabs.tsx` variant if the drawing needs one, with its catalogue cells)
- [ ] `SettingsPage.tsx` and the sections list as data; the page draws from whatever parts it has
- [ ] Appearance, Sharing, Usage data, Updates, Advanced, from today's code in the lead's words; AI accounts holds today's AI and key cards, moved whole
- [ ] Every button on the page the shared Button with a tooltip; the links its link variant through `openExternal`; no native `<select>` left; the Flow step panel's two buttons (#577)
- [ ] The rows of the inventory this PR moves checked (T, R, D), and the ways in (L); results in `qa-evidence.md`
- [ ] Light and Dark, at a wide and a narrow desk; screenshots to the Experience lead
- [ ] Windows through the overlay
- [ ] PR 1 opened: Standard, `/code-review` at medium; every finding answered; merged at the reviewed head

## Phase 3: PR 2, AI accounts (W4; R3, R9)

- [ ] The three rows, with every state; render tests from recorded payloads
- [ ] `AiDetailsSheet.tsx` for Claude and ChatGPT (and OpenCode's if drawn)
- [ ] `ApiKeysSheet.tsx`: Add, Test, Change, Remove, Get a key; Change opens an empty field
- [ ] AI information at the foot
- [ ] The key round trip (K) for all five keys, on the Mac and on Windows through the overlay; sign-in rows start and cancel
- [ ] The inventory test passes; the rows I7–I38 and I59 checked
- [ ] Screenshots in Light and Dark to the Experience lead
- [ ] PR 2 opened: Standard, `/code-review` at medium; merged at the reviewed head

## Phase 4: PR 3, the host (W5; R10, R11, decision 2)

- [ ] `settings` without probes; `settings:part` per probe; the first update check off the first draw
- [ ] One probe run per open; a setting change sends its own part; a test of both
- [ ] Key values out of the payload; the CSP's `connect-src` closed if unused
- [ ] The listeners A2 calls for; the check when the tab comes back into view; A2's table run again, every row redrawn
- [ ] The tab's title; the summary log line
- [ ] A fix in `src/agent/setup.ts` only if A1 points there
- [ ] A1's runs again on the Windows PC and the Mac: before and after in `research/windows-draw-time.md`
- [ ] The key round trip (K) again, on the Mac and on Windows
- [ ] PR 3 opened: **High**, `/code-review` at high and `/security-review`, up to three rounds; every finding answered; merged at the reviewed head

## Phase 5: PR 4, what each AI can use (W6; R12)

- [ ] The lead's answer on where it lives
- [ ] `capabilityReport.ts` and a reader per AI by A3; parsing tests from recorded reports
- [ ] `capabilities/request` and its answer; cached for the window; Check again
- [ ] The list in place, read-only, with "can't use it now, because…" where it applies; Light and Dark; Windows through the overlay
- [ ] PR 4 opened: Standard, `/code-review` at medium

## Phase 6: QA and closeout

- [ ] Every inventory row's result in `qa-evidence.md`; the inventory test on `main` after the last merge
- [ ] `npm test`, the webview tests and `tsc --noEmit` for both; the pre-commit validator on every PR
- [ ] Records unchanged (E2); `media/webview.js` after (E4)
- [ ] `architecture.md`, the `docs/user/` pages, `docs/CHANGELOG.md`; the release notes line through the `release-notes` skill (E5)
- [ ] Gate 2 row for the release plan: Settings on the Windows candidate, with its log line
- [ ] Issues closed on merge with their evidence: #577, #460, #593 (after the candidate's check), #415, #592; `release-plan.md`'s tracker rows, one per PR

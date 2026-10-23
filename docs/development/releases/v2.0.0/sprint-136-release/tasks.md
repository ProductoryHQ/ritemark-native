# Sprint 136 Tasks

Nothing here starts before Jarmo approves the sprint plan in this sprint's own session. Tick a box only when the change is on the sprint branch, or when the release step is done and its evidence recorded. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting state

- [x] Steps 1–3 and Sprint 135 merged; `origin/main` is `16b5bf0d` or later, and the commit is noted: `16b5bf0d` (2026-10-20)
- [x] `git checkout -b sprint-136-release` from `origin/main`; `git branch --show-current` shows it (2026-10-20, after Jarmo's approval)
- [ ] Windows round 4's results (run 39467716747's installer) recorded from the Development manager; each defect becomes a fix in Phase 2. *Not recorded in this sprint's documents; round 5 ran on the dress rehearsal's installer.*
- [x] The milestone v2.0.0 holds #475, #477, #482, #485–#488, and gains #459, #471 and #480 (the Development manager, 20 October); every other open issue that 2.0 touches is listed as deferred (spec, Non-Requirements)
- [x] The parity list brought up to date: G1 and G2 done (Sprint 133's QA evidence), G6 → #459, G7 and G8 with Jarmo's answer (D5), G9 → R6 (W9); no row reads Gap
- [x] The list of PRs merged from `v1.14.0` to main, sorted into product, harness and docs (W6): [notes/prs-since-v1.14.0.md](notes/prs-since-v1.14.0.md), 33 merges
- [x] `node ./scripts/worktree-hygiene.mjs --check` reported, with the free disk: 30 GB free; Sprint 135's worktree REVIEW (9.5 GB, kept for now as this sprint's VS Code 1.142 source); Sprint 134's BLOCKED by a `dist/` (8 GB); the three Store worktrees held

## Phase 1: Audits and asks

- [x] `research/update-path-audit.md`: every one-time change 2.0 makes to a v1.14.0 profile, the recent folders' copy into the shared list (#475), how each is marked done, what each step's QA already proved; the user-directory extension copies; v1.14.0 on a 2.0 profile (W1, R1, E4)
- [x] `research/installed-app-cdp.md`: the frame scripts against a signed, installed app (v1.14.0 first), with `--shared-data-dir`, the test marker and `--arch x86_64`; on Windows, whether the session can run them; More's production scenes (W2, W3, R2, R3)
- [x] `research/runtime-review.md`: each runtime against the latest since v1.14.0; `check:anthropic-models`; Node 24 and Electron 43; Codex and the keychain; the recommendation for D1 (W4, R4)
- [x] The Experience lead's answers, through the Development manager: dictation's menu (#486: a pick only sets the language; "ET ⌄"; "Dictate, in Estonian") and a card's tab (#477: the check-square and the title, on the tab and the chip)
- [x] Jarmo's answers to D1–D5 recorded in the sprint plan (all as recommended, 2026-10-20)

## Phase 2: The fixes and the harness, the first sprint PR (W11, W12, W3, W4)

- [x] #477: a card's tab shows its title and follows an edit; the chip's label (R11; S35)
- [x] #485: the chip follows the document in front; closed and deleted files leave it (R11; S36)
- [x] #482: Settings' ChatGPT line and `ai-agents.md` lines 142 and 151 (R11; S37)
- [x] #486: dictation's first language from the operating system's language (`VSCODE_NLS_CONFIG.osLocale`; Ritemark has no language packs, so the display language is always English); the menu as the Experience lead decided; the pick's persistence is checked in the dev walk (R11; S38)
- [x] #487: no Documents refresh from a turn at any of the three call sites; Documents still lists the AI's files (R11; S39)
- [x] #488: a turn's active duration saved and restored; older turns show "Done" (R11; S40)
- [x] #459: a flow's Claude Code step names the right Settings heading (R11, G6; S41)
- [x] #480: `RITEMARK_BUILD_CHANNEL=test` in `consent.ts`, with its test (R10; S34)
- [ ] Any fix from Windows round 4. *None recorded; round 5's faults were fixed in #494 and #495.*
- [x] #475: `--shared-data-dir` and the test marker in `rundev.md`, the `ritemark-automation` skill, `plan-truth-matrix.sh` and the frame baseline's README (E4)
- [x] #471: `build-prod.sh` without the link during gulp, the whole-tree digest guard, the `vscode-development` skill's note (E5); proved by the dress rehearsal (S44)
- [x] The release skill's Step 2 and the `release-manager` agent's "Test Checklist Generation": "The base window against the baseline" and the launch rule (R3)
- [x] `frame-screenshots.mjs`: usage text for installed apps; `--release` for More's release images (D2); `frame-baseline/README.md`: "Comparing a release candidate" (R3)
- [x] The runtime review table in the release plan; if Jarmo approves (D1), the update per the release skill, with every check in W4 and the compatibility matrix entry (R4): Claude Code 2.1.304 / SDK 0.3.304, Codex 0.163.0 (no macOS zsh), OpenCode 1.19.3
- [x] The extension's `npm run compile`, the webview's build, and every offline test script (`npm test` and each `test:*` but `test:integration`, which calls real models: `test:editor-sync` caught a payload key `npm test` did not); `./scripts/validate-qa.sh`; the pre-commit validator by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [x] The fixes walked in a dev build with the launch rule (S35–S41, S34): [qa-evidence.md](qa-evidence.md); two defects found and fixed (the payload key, Documents going stale: patch 002's `{ reveal: false }`)
- [x] The PR opened ([#490](https://github.com/ProductoryHQ/ritemark-native/pull/490)); `qa-validator` (nothing blocking; its fixes in `ac7164d2`); the Development manager's smoke test; Jarmo's "admin merge": merged as `8052a182` on 21 October

## Phase 3: The dress rehearsal (W12, W1, E3)

- [x] "Harbour" made with the installed v1.14.0 on the Mac, in the background, and archived outside the repository (`/private/tmp/claude-501/harbour-v1.14.0.zip`, with its manifest)
- [x] "Harbour" made on the Windows PC by the Windows session, and archived there: Gate 2's update ran over its v1.14.0 zip
- [x] A new release worktree at main's commit; `release-preflight.sh`; `check:anthropic-models` (Step 0): `release-8052a182c16a`
- [x] `build-prod.sh` under the arm64 wrapper; S44; `validate-build-output.sh`
- [x] The app run hidden: Sprint 135's E5 checks; `project-check.mjs`; `frame-geometry.mjs`; R3's section with `--compare`; S1, S4, S5, S18 (arm64), S42 (S45); S6 and S34 moved to the candidate ([qa-evidence.md](qa-evidence.md))
- [x] macOS x64 CI and Windows CI green on the same commit (the visibility toggled and back): 39540339261, 39540359645
- [x] Windows round 5 on that installer: S35–S41 on Windows and S2 (S46), on 21 October. It found the update over 1.14 failing (fixed in #494) and faults A–C (fixed in #495)
- [x] Findings listed; each fixed in Phase 4 or deferred by Jarmo: the file watcher stall (fixed in #491: no recursive home-folder watch; S47), the context line (fixed in #491), the Settings foot's release images (D2, at Gate 1)
- [x] The dress rehearsal's worktree removed, with Jarmo's yes (E2): "admin merge 491 and remove the folder", 21 October

## Phase 4: The release documents, the second sprint PR (W6, W7, W9)

- [ ] Release notes drafted with `product-marketer`, covering every product PR since v1.14.0, R11's fixes, What moved and known issues; Jarmo approves the words (R6). *Drafted in #492 and published on Jarmo's "publish - lets go live", with the Strategy Room's inked first sentence. A separate approval of the words is not recorded here.*
- [x] `docs/CHANGELOG.md`'s 2.0.0 section complete, still undated (R6)
- [x] `docs/user/` pages rewritten for 2.0, as the parity list's docs rows name them (R6, G9, S21): 17 pages, the broken links fixed
- [x] `docs/microsoft-store-submission/`: `CERTIFICATION-NOTES-v2.0.0.md`, `LISTING-COPY.md` reviewed, the screenshot plan in `ASSETS.md` with the Experience lead's scenes (R7): drafted; Jarmo approves the listing copy; the scenes go to the Experience lead
- [x] The fixes from Phase 3, each with its scenario re-run: #491, smoke-tested by the Development manager
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator by hand
- [x] The PR opened; `qa-validator`; Jarmo's "admin merge": [#492](https://github.com/ProductoryHQ/ritemark-native/pull/492), merged as `0ead698e` on 21 October

## Phase 5: Version 2.0.0 (W5)

- [x] A release-prep branch from `origin/main`: the six files by targeted replacement (R5): [#500](https://github.com/ProductoryHQ/ritemark-native/pull/500)
- [x] The diff reads 7 insertions and 7 deletions across 6 files (S19)
- [x] The PR merged with Jarmo's "admin merge"; `main` is frozen from here until publication: `c04eabf2`, 21 October. Main stays frozen until the closeout PR merges

## Phase 6: The arm64 candidate and Gate 1 (W8, W2, W9)

- [x] `build-windows.yml` (visibility toggled and back) and `build-macos-x64.yml` green on `main` at the bump's commit (S25): 39598992733 and 39598843953
- [x] A new release worktree; `release-preflight.sh`; `check:anthropic-models` (S26, S17): `release-c04eabf2fe02`, RELEASE SOURCE VERIFIED
- [x] `build-prod.sh` under the arm64 wrapper; `.signing-config` copied; sign; DMG; the DMG's build time recorded. The DMG came from the `ditto` + `hdiutil` fallback
- [x] `docs/releases/v2.0.0/TEST-CHECKLIST.md` with the Gate 2 list, R3's section, the parity rows, R10's check and E4's line (S14)
- [x] The frame scripts on the installed arm64 candidate; More's release images shown to Jarmo (S9, D2): "release pildid OK"
- [x] S1, S4–S7, S33, S34 on the candidate with "Harbour" and fresh profiles. S33 ran against a local stand-in; the live PostHog check was not run
- [x] Before Gate 1 on Jarmo's Mac (S43, D3): read his profile's own recent list (`state.vscdb`, `history.recentlyOpenedPathsList`) to see that his 1.x list is still there, and list the entries that point into `/private/tmp` or a Claude scratchpad (the Social manager found two); show them to him and remove them only on his OK. *Done by the Development manager on 21 October; the two entries were left, so they show as Not found projects (TEST-CHECKLIST)*
- [x] With Jarmo's yes: a copy of his profile folder, and `~/.ritemark-shared` moved aside, not deleted (S43, D3): `~/Ritemark-gate1-backup-2026-10-21`
- [x] Gate 1: Jarmo's pass, including S12 where possible, S13, S18 (arm64), the Mac parity rows, S32, S35–S41 and S43: "gate 1 approved", 21 October
- [x] At least 60 minutes from the DMG's build, nothing new found; `notarize-dmg.sh` exits 0 (S27): `b9506d94…`, Accepted and stapled

## Phase 7: x64, Windows and Gate 2 (W8)

- [x] The x64 artifact downloaded and extracted; signed against `RITEMARK_RELEASE_COMMIT`; DMG; build time recorded
- [x] The Windows installer staged from the CI artifact, with its SHA-256 and round-trip evidence (`docs/releases/v2.0.0/evidence/`)
- [ ] The Windows screenshots against their baseline or round 5's (S11, D2). *Not recorded; there are no `release-win32/` images.*
- [x] Gate 2: S2, S3 and S10 (on an Intel Mac or under Rosetta, the evidence says which), S11, S18, the Windows parity rows, the fixes on Windows: "rosetta - approved" (21 October) and "windows approved" (22 October)
- [x] At least 60 minutes from the x64 DMG's build; x64 notarized: 161 minutes, `a11f044b…`

## Phase 8: Publication (W8)

- [x] The privacy policy's usage-data lines confirmed by the Development manager (R8): live on release day (spec, R8's *As shipped*)
- [x] The binaries staged under their published names
- [x] The body from the approved notes, with absolute image URLs: the repo's notes with four edits (qa-evidence, Publication)
- [x] The feed generated with `--existing-feed-url` naming v1.14.0; `fullReleases` grew by one: 25 entries
- [x] A draft release; binaries and feed uploaded; every digest matches `dist/` (S29)
- [x] Published for all three platforms; `latest` is v2.0.0; the `latest` feed matches byte for byte: 2026-10-23T04:56:43Z
- [ ] S8: a v1.14.0 app on the Mac and on Windows is offered 2.0.0. *The Mac passed on 23 October; Windows' offer was not checked.*

## Phase 9: The Store (W7)

- [ ] The v1.14.0 update's state in Partner Center read. *The 2.0.0 update replaced the v1.14.0 update submitted on 17 October (`STATUS.md`).*
- [ ] The installer at `windows/v2.0.0/Ritemark-Setup.exe` through the guarded uploader; anonymous verification; a second plan refused (S22). *Jarmo uploaded it on 22 October, and two anonymous checks passed (`evidence/hosting-v2.0.0-2026-10-22.md`). A second plan's refusal is not recorded.*
- [ ] Six screenshots from the installed signed Windows build, with the test marker, captions reviewed. *Five 2.0 Windows screenshots went with the submission. How they were taken is not recorded here.*
- [x] The Store brief handed to Jarmo; he submits; the result in `STATUS.md` (S23): submitted on 23 October, in review
- [ ] After certification (waiting): the Store-origin install check, and a v1.14.0 Store install updated (S24)

## Phase 10: After the release (W8, W10)

- [x] The issue sweep against the v2.0.0 milestone; the milestone closed with every issue closed or deferred: all 11 closed, the milestone closed on 23 October
- [ ] The marketing handoff to the Development manager (Social, Traffic)
- [x] The closeout: published assets against `dist/`; evidence in `docs/releases/v2.0.0/evidence/`; build output cleared; the worktree reads `REVIEW` (S30)
- [x] `docs/CHANGELOG.md` dated; `architecture.md`'s version-history row
- [x] The release plan: published, the pause on releases from main ended, the risk register closed
- [x] The closeout PR; Jarmo's "admin merge": [#520](https://github.com/ProductoryHQ/ritemark-native/pull/520), merged by the Development manager as `36bf2193` on 23 October ("merge siis ise")
- [x] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call): `--check` on 23 October; the release worktree is the only `REVIEW` entry. Removed with `--clean` on Jarmo's "clean the release worktree", 23 October (closeout 10.4)

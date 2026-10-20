# Sprint 136 Tasks

Nothing here starts before Jarmo approves the sprint plan in this sprint's own session. Tick a box only when the change is on the sprint branch, or when the release step is done and its evidence recorded. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting state

- [x] Steps 1–3 and Sprint 135 merged; `origin/main` is `16b5bf0d` or later, and the commit is noted: `16b5bf0d` (2026-10-20)
- [x] `git checkout -b sprint-136-release` from `origin/main`; `git branch --show-current` shows it (2026-10-20, after Jarmo's approval)
- [ ] Windows round 4's results (run 39467716747's installer) recorded from the Development manager; each defect becomes a fix in Phase 2
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
- [ ] Any fix from Windows round 4
- [x] #475: `--shared-data-dir` and the test marker in `rundev.md`, the `ritemark-automation` skill, `plan-truth-matrix.sh` and the frame baseline's README (E4)
- [x] #471: `build-prod.sh` without the link during gulp, the whole-tree digest guard, the `vscode-development` skill's note (E5); proved by the dress rehearsal (S44)
- [x] The release skill's Step 2 and the `release-manager` agent's "Test Checklist Generation": "The base window against the baseline" and the launch rule (R3)
- [x] `frame-screenshots.mjs`: usage text for installed apps; `--release` for More's release images (D2); `frame-baseline/README.md`: "Comparing a release candidate" (R3)
- [ ] The runtime review table in the release plan; if Jarmo approves (D1), the update per the release skill, with every check in W4 and the compatibility matrix entry (R4)
- [ ] The extension's `npm run compile`, the webview's build, and every offline test script (`npm test` and each `test:*` but `test:integration`, which calls real models: `test:editor-sync` caught a payload key `npm test` did not); `./scripts/validate-qa.sh`; the pre-commit validator by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] The fixes walked in a dev build with the launch rule (S35–S41, S34)
- [ ] The PR opened; the Development manager's smoke test; `qa-validator`; Jarmo's "admin merge"

## Phase 3: The dress rehearsal (W12, W1, E3)

- [ ] "Harbour" made with the installed v1.14.0 on the Mac, in the background, and archived outside the repository
- [ ] "Harbour" made on the Windows PC by the Windows session, and archived there
- [ ] A new release worktree at main's commit; `release-preflight.sh`; `check:anthropic-models` (Step 0)
- [ ] `build-prod.sh` under the arm64 wrapper; S44; `validate-build-output.sh`
- [ ] The app run hidden: Sprint 135's E5 checks; `project-check.mjs`; `frame-geometry.mjs`; R3's section with `--compare`; S1, S4, S5, S6, S18 (arm64), S34 (S45)
- [ ] macOS x64 CI and Windows CI green on the same commit (the visibility toggled and back)
- [ ] Windows round 5 on that installer: S35–S41 on Windows and S2 (S46)
- [ ] Findings listed; each fixed in Phase 4 or deferred by Jarmo
- [ ] The dress rehearsal's worktree removed, with Jarmo's yes (E2)

## Phase 4: The release documents, the second sprint PR (W6, W7, W9)

- [ ] Release notes drafted with `product-marketer`, covering every product PR since v1.14.0, R11's fixes, What moved and known issues; Jarmo approves the words (R6)
- [ ] `docs/CHANGELOG.md`'s 2.0.0 section complete, still undated (R6)
- [ ] `docs/user/` pages rewritten for 2.0, as the parity list's docs rows name them (R6, G9, S21)
- [ ] `docs/microsoft-store-submission/`: `CERTIFICATION-NOTES-v2.0.0.md`, `LISTING-COPY.md` reviewed, the screenshot plan in `ASSETS.md` with the Experience lead's scenes (R7)
- [ ] The fixes from Phase 3, each with its scenario re-run
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator by hand
- [ ] The PR opened; `qa-validator`; Jarmo's "admin merge"

## Phase 5: Version 2.0.0 (W5)

- [ ] A release-prep branch from `origin/main`: the six files by targeted replacement (R5)
- [ ] The diff reads 7 insertions and 7 deletions across 6 files (S19)
- [ ] The PR merged with Jarmo's "admin merge"; `main` is frozen from here until publication

## Phase 6: The arm64 candidate and Gate 1 (W8, W2, W9)

- [ ] `build-windows.yml` (visibility toggled and back) and `build-macos-x64.yml` green on `main` at the bump's commit (S25)
- [ ] A new release worktree; `release-preflight.sh`; `check:anthropic-models` (S26, S17)
- [ ] `build-prod.sh` under the arm64 wrapper; `.signing-config` copied; sign; DMG; the DMG's build time recorded
- [ ] `docs/releases/v2.0.0/TEST-CHECKLIST.md` with the Gate 2 list, R3's section, the parity rows, R10's check and E4's line (S14)
- [ ] The frame scripts on the installed arm64 candidate; More's release images shown to Jarmo (S9, D2)
- [ ] S1, S4–S7, S33, S34 on the candidate with "Harbour" and fresh profiles
- [ ] Before Gate 1 on Jarmo's Mac (S43, D3): read his profile's own recent list (`state.vscdb`, `history.recentlyOpenedPathsList`) to see that his 1.x list is still there, and list the entries that point into `/private/tmp` or a Claude scratchpad (the Social manager found two); show them to him and remove them only on his OK
- [ ] With Jarmo's yes: a copy of his profile folder, and `~/.ritemark-shared` moved aside, not deleted (S43, D3)
- [ ] Gate 1: Jarmo's pass, including S12 where possible, S13, S18 (arm64), the Mac parity rows, S32, S35–S41 and S43
- [ ] At least 60 minutes from the DMG's build, nothing new found; `notarize-dmg.sh` exits 0 (S27)

## Phase 7: x64, Windows and Gate 2 (W8)

- [ ] The x64 artifact downloaded and extracted; signed against `RITEMARK_RELEASE_COMMIT`; DMG; build time recorded
- [ ] The Windows installer staged from the CI artifact, with its SHA-256 and round-trip evidence
- [ ] The Windows screenshots against their baseline or round 5's (S11, D2)
- [ ] Gate 2: S2, S3 and S10 (on an Intel Mac or under Rosetta, the evidence says which), S11, S18, the Windows parity rows, the fixes on Windows
- [ ] At least 60 minutes from the x64 DMG's build; x64 notarized

## Phase 8: Publication (W8)

- [ ] The privacy policy's usage-data lines confirmed by the Development manager (R8)
- [ ] The binaries staged under their published names
- [ ] The body from the approved notes, with absolute image URLs
- [ ] The feed generated with `--existing-feed-url` naming v1.14.0; `fullReleases` grew by one
- [ ] A draft release; binaries and feed uploaded; every digest matches `dist/` (S29)
- [ ] Published for all three platforms; `latest` is v2.0.0; the `latest` feed matches byte for byte
- [ ] S8: a v1.14.0 app on the Mac and on Windows is offered 2.0.0

## Phase 9: The Store (W7)

- [ ] The v1.14.0 update's state in Partner Center read
- [ ] The installer at `windows/v2.0.0/Ritemark-Setup.exe` through the guarded uploader; anonymous verification; a second plan refused (S22)
- [ ] Six screenshots from the installed signed Windows build, with the test marker, captions reviewed
- [ ] The Store brief handed to Jarmo; he submits; the result in `STATUS.md` (S23)
- [ ] After certification: the Store-origin install check, and a v1.14.0 Store install updated (S24)

## Phase 10: After the release (W8, W10)

- [ ] The issue sweep against the v2.0.0 milestone; the milestone closed with every issue closed or deferred
- [ ] The marketing handoff to the Development manager (Social, Traffic)
- [ ] The closeout: published assets against `dist/`; evidence in `docs/releases/v2.0.0/evidence/`; build output cleared; the worktree reads `REVIEW` (S30)
- [ ] `docs/CHANGELOG.md` dated; `architecture.md`'s version-history row
- [ ] The release plan: published, the pause on releases from main ended, the risk register closed
- [ ] The closeout PR; Jarmo's "admin merge"
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)

# Sprint 136 Tasks

Nothing here starts before Jarmo approves the sprint plan, and not before Steps 1, 2 and 3 and Sprint 135 are merged. Tick a box only when the change is on the sprint branch, or when the release step is done and its evidence recorded. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting state

- [ ] Steps 1–3 and Sprint 135 merged; confirm on `origin/main` and note the commit
- [ ] `git checkout -b sprint-136-release` from `origin/main`; `git branch --show-current` shows it
- [ ] The GitHub milestone v2.0.0 exists, with every open issue 2.0 touches on it (the Development manager)
- [ ] Every row of the [v1.14 parity list](../parity-v1.14.md) is done or deferred by Jarmo; no row is still a gap (R9)
- [ ] The list of PRs merged from `v1.14.0` to main, sorted into product, harness and docs (W6)
- [ ] `node ./scripts/worktree-hygiene.mjs --check` reported

## Phase 1: Audits first

- [ ] `research/update-path-audit.md`: every one-time change 2.0 makes to a v1.14.0 profile, how it is marked done, what each step's QA already proved; the user-directory extension copies; v1.14.0 on a 2.0 profile (W1, R1)
- [ ] `research/installed-app-cdp.md`: the frame scripts against a signed, installed app on the Mac and on Windows; the differences from the dev baseline (W2, W3, R2, R3)
- [ ] `research/runtime-review.md`: each runtime against the latest since v1.14.0; `check:anthropic-models`; Node 24 and Electron 43; the recommendation for D1 (W4, R4)
- [ ] Jarmo's answers to D1–D7 recorded in the sprint plan

## Phase 2: Profiles and the dress rehearsal (W1, E3)

- [ ] "Harbour" made with the installed v1.14.0 on the Mac, in the background, and archived outside the repository
- [ ] "Harbour" made on the Windows PC by the Windows session, and archived there
- [ ] A clean-room production build of main's commit (a build check, not signed as a release)
- [ ] R1 on that build on the Mac: S1, S4, S5, S6; findings fixed on main before the bump

## Phase 3: Harness, runtimes, notes and Store documents (W3, W4, W6, W7)

- [ ] The release skill's Step 2: every checklist carries "The base window against the baseline" (R3)
- [ ] The `release-manager` agent's "Test Checklist Generation": the fifth item (R3)
- [ ] `frame-screenshots.mjs`: usage text for installed apps; a launch flag only if the audit needs one (R3)
- [ ] `docs/development/frame-baseline/README.md`: "Comparing a release candidate" (R3)
- [ ] The runtime review table in the release plan; Jarmo's decision (R4, D1)
- [ ] If approved: the runtime update per the release skill, with every check in W4 and the compatibility matrix entry (R4)
- [ ] Release notes drafted with `product-marketer`, covering every product PR since v1.14.0, What moved and known issues; Jarmo approves the words (R6)
- [ ] `docs/CHANGELOG.md`'s 2.0.0 section complete, still undated (R6)
- [ ] `docs/user/` pages rewritten for 2.0, as the parity list's docs rows name them (R6, S21)
- [ ] `docs/microsoft-store-submission/`: `CERTIFICATION-NOTES-v2.0.0.md`, `LISTING-COPY.md` reviewed, the screenshot plan in `ASSETS.md` (R7)
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] The sprint PR opened; `qa-validator` review; Jarmo's "admin merge"

## Phase 4: Version 2.0.0 (W5)

- [ ] A release-prep branch from `origin/main`: the six files by targeted replacement (R5)
- [ ] The diff reads 7 insertions and 7 deletions across 6 files (S19)
- [ ] The PR merged with Jarmo's "admin merge"; `main` is frozen from here until publication

## Phase 5: The arm64 candidate and Gate 1 (W8, W2, W9)

- [ ] `build-windows.yml` (visibility toggled and back) and `build-macos-x64.yml` green on `main` at the bump's commit (S25)
- [ ] A new release worktree; `release-preflight.sh`; `check:anthropic-models` (S26, S17)
- [ ] `build-prod.sh` under the arm64 wrapper; `.signing-config` copied; sign; DMG; the DMG's build time recorded
- [ ] `docs/releases/v2.0.0/TEST-CHECKLIST.md` with the Gate 2 list, R3's section, the parity rows and R10's check (S14)
- [ ] The frame scripts on the installed arm64 candidate; the release baseline shown to Jarmo (S9, D2)
- [ ] S1, S4–S7 on the candidate with "Harbour"
- [ ] Gate 1: Jarmo's pass, including S12 where possible, S13, S18 (arm64), the Mac parity rows, S32 and S33
- [ ] At least 60 minutes from the DMG's build, nothing new found; `notarize-dmg.sh` exits 0 (S27)

## Phase 6: x64, Windows and Gate 2 (W8)

- [ ] The x64 artifact downloaded and extracted; signed against `RITEMARK_RELEASE_COMMIT`; DMG; build time recorded
- [ ] The Windows installer staged from the CI artifact, with its SHA-256 and round-trip evidence
- [ ] The Windows release baseline shown to Jarmo (S11, D2)
- [ ] Gate 2: S2, S3 (or the note that no Intel Mac was at hand), S10, S11, S18, the Windows parity rows
- [ ] At least 60 minutes from the x64 DMG's build; x64 notarized

## Phase 7: Publication (W8)

- [ ] The binaries staged under their published names
- [ ] The body from the approved notes, with absolute image URLs
- [ ] The feed generated with `--existing-feed-url` naming v1.14.0; `fullReleases` grew by one
- [ ] A draft release; binaries and feed uploaded; every digest matches `dist/` (S29)
- [ ] Published; `latest` is v2.0.0; the `latest` feed matches byte for byte
- [ ] S8: a v1.14.0 app on the Mac and on Windows is offered 2.0.0

## Phase 8: The Store (W7)

- [ ] The installer at `windows/v2.0.0/Ritemark-Setup.exe` through the guarded uploader; anonymous verification; a second plan refused (S22)
- [ ] Screenshots from the installed signed Windows build, captions reviewed (D4)
- [ ] Partner Center updated; validation recorded; Jarmo's action-time yes; Submit; the result in `STATUS.md` (S23)
- [ ] After certification: the Store-origin install check, and a v1.14.0 Store install updated (S24)

## Phase 9: After the release (W8, W10)

- [ ] The issue sweep against the v2.0.0 milestone; the milestone closed with every issue closed or deferred
- [ ] The closeout: published assets against `dist/`; evidence in `docs/releases/v2.0.0/evidence/`; build output cleared; the worktree reads `REVIEW` (S30)
- [ ] `docs/CHANGELOG.md` dated; `architecture.md`'s version-history row
- [ ] The release plan: published, the pause on releases from main ended, the risk register closed
- [ ] The closeout PR; Jarmo's "admin merge"
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)

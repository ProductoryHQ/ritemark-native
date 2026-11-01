# Sprint 152 Tasks

The plan is approved on Jarmo's 2.2 delegation (sprint-plan.md, *Approval*). Tick a box only when the change is on its PR's branch. W numbers are
workstreams in [technical-plan.md](technical-plan.md); R and E numbers are requirements in [spec.md](spec.md); A numbers
are the audits.

## Phase 0: Branch and starting tree

- [x] The plan's approval is recorded (the Development manager, on Jarmo's 2.2 delegation; decisions 1 and 3). Decision
      2 gates only R6's work: it is recorded in the sprint plan before R6 starts (recorded 1 November: it stays closed)
- [x] `git checkout -b sprint-152-startup-contract` from `origin/main`; `git branch --show-current` shows it before any
      edit. PR 2's branch, `sprint-152-startup-contract-shell`, is made the same way, from `origin/main` after Sprint
      146's shell PR has merged
- [x] The hunk counts recorded (`grep -c '^@@'` for 002, 018, 019) and `media/webview.js`' size in `notes/bundle.md`
- [x] `node ./scripts/worktree-hygiene.mjs --report` read, and the free disk recorded; removal by `--clean` on the
      delegation, never over BLOCKED (1 November: nothing to clean up, 24 GiB free)
- [x] Asked: the Experience lead for the proposal's nine questions; the "Ritemark on Windows" session for A2 (both
      answered 1 November)

## Phase 1: Audits (each in `research/`, before its code)

- [x] A1 `research/first-frames.md`: the four starts on `main`, the extension host held 10 s, every 50 ms, Light and Dark;
      each *read* row of the inventory seen or not; R1's list of frame-shaping settings confirmed
- [x] A2 `research/windows-marks.md`: the installed 2.1.0's marks on a cold and a warm Windows start (by the "Ritemark on
      Windows" session: the closest-to-cold start had Ritemark active at 17.2 s, 12.0 s after the splash went; warm
      starts 3.4–3.5 s; a start after an install about 26 s. All well inside the slots' 60 s release)
- [x] A3 `research/desk-front.md`: Home's and the board's tabs restored before Ritemark starts, and a restored webview
      with no serializer; the choice for R3 (the tabs, through the restore path; the plain desk as the fallback)
- [x] A4 `research/ai-view-start.md`: the AI view's starts, signed in and not, for each AI; the deciding message (signed
      in: not run, no signed-in AI in a scratch home)
- [x] Where an audit changes a requirement or the tier, `spec.md` and the sprint plan's tier line change first; a row A1
      doesn't show (R9 expected) is dropped with the reason (A1 showed R9's row; R5, R6, R8 and R1's list updated; no
      tier moves)

## Phase 2: PR 1, the check, #624 and R6 (W1, W2, W3; R5, R6, R8)

- [x] W1: `project-check.mjs --first-frame` and the four starts; five runs per start on `main`; the failing set recorded
- [x] W2: the AI view keeps one starting state with the turning mark, then draws the chat or the sign-in once; no
      "Preparing Agent Chat…" on a normal start; the error card in the lead's words (the words pending the lead)
- [x] W2's webview tests fail on `main`'s view and pass; `npm test`, the webview's `tsc --noEmit`; the bundle rebuilt and
      measured
- [x] W3, by decision 2: the start-time focus calls, or nothing here (PR 2's `layout.ts` instead) (the two calls removed)
- [x] The `release` skill's Gate 1 frame step and layout-invariants.md's *When patching layout* name the check
- [ ] The Mac: the AI column's start signed in and not, Light and Dark, screenshots to the Experience lead (not signed
      in: `qa/r5-*.png`; signed in: not run)
- [ ] Windows through the test overlay: the AI column's start, signed in and not
- [ ] The PR: Standard review, every finding answered, the Review record, the merge at the reviewed head

## Phase 3: PR 2, the contract in the shell (W4–W7; R1–R4, R7, R9)

- [ ] A CoW-cloned `vscode/` at the pin, every patch applied (`./scripts/apply-patches.sh --dry-run` OK first)
- [ ] W4: the `ritemarkFrame` block and the frame-shaping defaults in `branding/product.json`; 002's reader; 018's
      `ritemarkSlots.ts`; `validate-build-output.sh`; their unit tests
- [ ] W5: the AI column, the landing, the terminals, the head's rows and the AI column's loading look on the slot;
      Sprint 145's checks pass before and after (`project-check.mjs --measure 10`, the S47 traces, the two unit tests)
- [ ] W6: R3 (Home's place, the desk's front by A3, no tiles while it waits); R4 (the welcome alone at the first frame
      and its release); R9 if A1 showed it
- [ ] W7: the preflight check and its fixture; the extension's defaults test
- [ ] The first-frame check passes in all four starts, five runs each; `frame-screenshots.mjs --compare` the same pixels,
      every `JOINS` ok; `frame-geometry.mjs` the same numbers
- [ ] E2: the hunk counts after, no upstream file newly touched, `check-patch-stacking.mjs` clean
- [ ] Patches regenerated with `./scripts/create-patch.sh`; their headers say what changed and why
- [ ] E5's docs: `architecture.md`, layout-invariants.md, `vscode-patches.md`, `CLAUDE.md`'s patch table
- [ ] Screenshots of the four starts' first frames to the Experience lead
- [ ] The PR: High review (`/code-review` at high, `/security-review`), every finding answered, the Review record, the
      merge at the reviewed head with Jarmo's word (or the Development manager's while he has delegated merging)

## Phase 4: QA and closeout

- [ ] `qa-evidence.md`: each requirement's check, failing on `main` and passing on the branch (E1) (PR 1's rows in)
- [ ] `docs/CHANGELOG.md`; the release-notes line through the `release-notes` skill
- [ ] #624 closed with its PR; any row A1 showed that is left for 2.3 filed as an issue with its capture
- [ ] Gate 2 rows for 2.2's candidate written for the Windows session: a cold first start after an install and after an
      update, the four starts' first frames, the AI column's start
- [ ] The release plan's tracker updated

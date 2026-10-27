# Sprint 144: The release harness, and polish from the 2.1 smoke test

Track: SDD (auto-detected: two shell-tier harness changes resting on measurements, five extension-tier defects across the AI's sheet, Settings, the status bar, Flows and the project switch)
Override with: "use plain full track"
Branches, made from `origin/main` at Phase 3, after approval: `sprint-144-release-harness` (Part 1, shell tier) and `sprint-144-release-harness-polish` (Part 2, extension tier), one PR each. This plan was written on `plan/sprint-144-release-harness`.
Release tier: **Part 1 shell** (`.github/workflows/build-windows.yml`, `patches/vscode/`); **Part 2 extension** (`extensions/ritemark/` only). 2.1 is a shell release already.
Status: **Proposed (Phase 2), 27 October 2026,** for the Development manager's review under Jarmo's delegation. No implementation code is written before approval. The planning measurement ran on a scratch branch (`scratch/sprint-144-free-runner-probe`), which changes nothing on `main`; P4's reproduction is a harness under `research/repro/`, outside the product.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, Part 1's R1–R5, Part 2's P1–P5, E1–E7, and the open questions.
- [scenarios.md](scenarios.md): S1–S40, the QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, the audits, workstreams W1–W9, delivery, risks.
- [tasks.md](tasks.md): the implementation checklist by phase.
- [research/windows-ci-audit.md](research/windows-ci-audit.md): A1, #506's options and the free-runner probe.
- [research/electron-node-audit.md](research/electron-node-audit.md): A2, #515's Electron, Node and exposure.
- [research/repro/flow-step-panel/](research/repro/flow-step-panel/README.md): A4, P4's harness; screenshots in `qa/p4-*.png`.
- This file: intent, decisions, status.

The release is 2.1.0 ([release-plan.md](../release-plan.md)). This is the last sprint before its candidate: the release's own code, which the plan left as "a sprint number of its own only if it needs code", and the smoke test's small defects.

## Goal

2.1's candidate is built, signed and tested on Windows while the repository stays public, so its stars and watchers survive; it ships on the newest Electron its VS Code line has, carrying the 21 October Node fix if Electron publishes it in time, with the risk written if not. And the smoke test's five small defects are gone: the sign-in card's buttons, Settings' badges, a status bar that says only what it knows, a Flow step panel that keeps its fields, and a project switch that lands on Home.

## Linked Issues

| Issue | What | Requirement | Tier |
|---|---|---|---|
| [#506](https://github.com/ProductoryHQ/ritemark-native/issues/506) | Windows CI without making the repository private | R1, R2 | shell (`.github/workflows/build-`) |
| [#515](https://github.com/ProductoryHQ/ritemark-native/issues/515) | Ship on an Electron carrying Node 24.22.1 | R3, R4 | shell (`patches/`) |
| [#499](https://github.com/ProductoryHQ/ritemark-native/issues/499) | The done list: synced folders and the Windows first window | R5 (checks, no code) | — |
| [#501](https://github.com/ProductoryHQ/ritemark-native/issues/501) | A restored terminal before the welcome on the first start after 1.14 | R5 (check, no code) | — |
| [#569](https://github.com/ProductoryHQ/ritemark-native/issues/569) | After a switch the AI column comes back after Home, and Home reflows | P5 | extension, or an RC check |
| — (smoke test of `c99a8596`) | The sign-in card's buttons; Settings' badges; the status bar's "AI Ready"; the Flow step panel | P1–P4 | extension |

## What the measurements say

**#506 (A1), measured on 27 October.** The release workflow, changed only to run on the free `windows-latest` runner without secrets (so unsigned), built `main` (`c99a8596`) green in **37.5 minutes**, with the repository public throughout ([run 40425970110](https://github.com/ProductoryHQ/ritemark-native/actions/runs/40425970110)).
- The runner: 4 processors, 16 GB, the same image as the 8-core runner (`windows-2025-vs2026`), queued for 4 seconds.
- Its work drive is D:, 150 GB with 147 GB free; the build used about 15 GB and left 132 GB free at worst. Memory was never below 3.4 GB free.
- `npm ci` took 14.1 minutes (21.8 on the 8-core run; one sample each), gulp 8.2 (5.6), Inno Setup 7.9 (7.5).
- Not run: signing (2.3 minutes on 8 cores) and the standard-user round trip (5.0). The whole job is estimated at 45–50 minutes, about what the 8-core runner takes, for $0 instead of about $2.
- One caution: GitHub documents only 14 GB of disk for this runner, and the build's tree is 14 GB. Today's 150 GB is more than promised, so the job gets a guard that stops it in seconds below 30 GB free.

**#515 (A2), measured on 27 October:**
- **No Electron has Node 24.22.1 yet.** The newest 43.x is 43.8.3 (Node 24.22.0, 21 October). Electron merged the Node 24.22.1 bump on its 43 line on 22 October (electron/electron#55161), unreleased since. No VS Code has it either: 1.143.1 ships 43.7.7, 1.144 and main 43.8.3.
- **A VS Code update would bring nothing more today** and is the biggest shell change there is. An Electron patch bump inside 43 is three files in `vscode/` (the target, Electron's own checksums, the notices), no source change, the same native-module ABI (148).
- **43.8.3 is worth taking now** even without the Node fix: three weeks of Chromium security backports (43.7.9–43.8.3) for an app whose browser opens any site, and the eMudhra CA distrust (43.8.1).
- **The Brotli flaw (CVE-2026-111497) is upstream Brotli's**, but Chromium 150's copy already has the fixed code, so the integrated browser isn't exposed. Only Node's copy is.
- **One Ritemark path fetches an outside URL with Node:** a flow's Save File step with an image URL from a previous step. Everything else goes to fixed services. About already shows the Node version.

**The smoke test's defects (P1–P5), each reproduced or traced in code:**
- **P1:** the sign-in card draws its own buttons (`OnboardingWizard.tsx:428–463`) without the shared Button's icon rule, so `Icon`'s muted default shows grey on indigo; five more hand-rolled buttons in the file (Re-check twice, Retry, Install twice).
- **P2:** the two "Experimental" badges are hard-coded `<span>`s (`RitemarkSettings.tsx:454–456`, `:638–640`); no flag drives them, and no other "Experimental" text is in the webview.
- **P3:** "AI Ready" comes from the internet probe alone (`connectivity.ts:120–134`). The host can already probe each AI without the sheet (`UnifiedViewProvider.runtimeAvailability`) and has change events for Claude and ChatGPT; it doesn't know the open chat's AI, which one field on an existing message fixes.
- **P4, reproduced in a headless harness at the Flow editor's size in a 1440 × 900 window (784 × 824):** the Delete row sits flush on the scroll area's edge and crosses Temperature and Max Tokens at 784 × 800; and the model picker greys out with "Loading models..." for 5 s on every step selection, because the host answers with `modelType: 'flow:getModels'` (`FlowEditorProvider.ts:164`), which the panel never matches. A bug since January.
- **P5, traced in code, not yet timed:** a switch reloads the window; VS Code restores the target project's last document in front; Ritemark brings Home forward 800 ms after activation (`permanentTabs.ts:153`) and the AI column after a fixed 4 s (`extension.ts:377–380`). Those two timers fit the 1.7–4.6 s gap; whether the workbench itself hides the AI column first (patch 002) is not yet known in 1.142.

## What else the done list needs before the candidate

- **Synced folders (#499):** no code now. Sprint 137's R11 is the save half. The check runs on a Windows build of `main` before the candidate (S17), and here on the Mac (S20) if Decision 4 is yes; this Mac has OneDrive and Google Drive.
- **The Windows first window (#276) and #501:** no code now. #501's fix is a product call (patch 019 keeping restored terminals behind the document, or the welcome earlier), and it only shows when updating from 1.x. S18 and S19 run on the same Windows build; a failure is a 2.1 bug fixed before the version bump.
- **The rest of the done list** (the Store, `ritemark-web`'s privacy lines, the model feed) is release steps and another repository, not native code.
- **The Actions budget line** falls away with R1: a Windows build no longer bills the 8-core runner.

## MVP Scope

| Area | Requirement | Proven by |
|---|---|---|
| The Windows build on `windows-latest`, the repository public | R1, E1–E4 | A1's probe; S1–S4, S8 on `main` after the merge |
| No toggle anywhere in the release path | R2 | The grep in tasks Phase 3; S2 |
| Electron 43.8.3 (or the 43.x with Node 24.22.1) through patch 020, checked in the build | R3 | S9–S14 |
| The written risk if Node 24.22.1 isn't out | R4 | A2; S16 |
| The done list's Windows checks before the candidate | R5 | S17–S20 |
| The sign-in card's buttons | P1 | S21–S23 |
| No "Experimental" badges | P2 | S24 |
| The status bar's AI item in the Experience lead's words, live for all three AIs | P3 | S25–S32 |
| The Flow step panel's footer and model picker | P4 | S33–S36 |
| The project switch measured; fixed here only if extension-side | P5 | S37–S40 |

**Not in this sprint:** a VS Code update; the build-time Node; code for #499, #276 or #501 before a check fails; a private build mirror or an org runner setting (unless Decision 1 picks one); a plan-refusal signal for P3's "needs a paid plan" (#496's); a patch for P5.

## Product Decisions

- **2026-10-26 (Jarmo, ritemark-dev `decisions/log.md`):** the Development manager approves 2.1's sprint plans and starts sprints until Gate 1 RC; release approval stays Jarmo's.
- **2026-10-27 (the Development manager):** Part 2 joins this sprint, extension-tier and separate from Part 1. P2: both badges go. P5: fixed in 144 only if the cause is small and extension-side, otherwise an RC check that closes #569 under 300 ms.
- **2026-10-27 (the Experience lead, ritemark-dev `55bf49c`, experiences 13 and 15):** P3's words and states, word for word in [spec.md](spec.md#p3-the-status-bars-ai-item-says-only-what-ritemark-knows); P2's badges removed; P1 confirmed: an icon beside words takes the words' colour in every state.
- **2026-10-27 (engineering, in this plan):**
  - The Windows workflow stays one file in this repository; no second copy (the `release` skill's drift rule).
  - Electron moves inside its VS Code line only, through its own patch (020), deleted rather than rebased at the next VS Code update that carries it.
  - The packaged Electron is checked against the target in `validate-build-output.sh`, not trusted.
  - P3 reads the host's own availability and events, not the sheet's, so it is right before the sheet opens.
  - Nothing is written into the person's cloud folders without the manager's yes (Decision 4).

## Decisions for the Development manager

1. **#506: where the Windows build runs.** I recommend the free `windows-latest` runner on the public repository. The probe built `main` there green in 37.5 minutes with 132 GB of disk to spare; the whole job should take about what the 8-core runner takes, and costs nothing. If the first real run fails for a reason the probe couldn't see (signing, the install round trip), the fallback is to let the public repository use the 8-core runner's group, which is one organization setting for Jarmo; a private build repository comes last.
2. **#515: take Electron 43.8.3 now.** I recommend yes: patch 020 with 43.8.3 in this sprint, moved to the first 43.x with Node 24.22.1 as soon as Electron publishes it, up to the version bump. It brings the Chromium backports and the eMudhra distrust today, and the Node fix is then a one-line change.
3. **#515: if Electron hasn't published the fix by the version bump.** I recommend shipping 2.1 on 43.8.3 with the audit as the written risk and #515 open: the one exposed path is narrow (someone has to run a flow that downloads a hostile URL), and every other Node request goes to a fixed service over TLS. Holding the candidate for Electron's release is the other answer; that one would be Jarmo's, since it moves 2.1's date.
4. **#499 on the Mac, here.** I recommend yes: one new folder, "Ritemark 2.1 sync test", in this Mac's OneDrive folder and one in its Google Drive folder, for S20; they sync to Jarmo's accounts, and they are left for him to remove. If no, S20 moves to Gate 2.
5. **The autosave on step selection** (noticed while reproducing P4: selecting a Flow step saves the flow about 100 ms later). I recommend filing it for 2.2 and not touching it in 144: it writes nothing wrong, and changing when flows save is not polish.
6. **The probe branch.** I recommend deleting `scratch/sprint-144-free-runner-probe` once you have read A1. It holds only the probe's workflow, which must never merge.

**For the Experience lead, through you (P3's words not yet given):**
- When the AI the next message goes to was never signed in but another AI is, "Claude: sign in again" says "again" to someone who never did. Proposed: "Claude: sign in".
- The tooltips of the two needing-the-person states. Proposed: "Your Claude sign-in has ended" and "Your Claude plan doesn't include working in Ritemark".
- The dot is its own status bar item just left of the words, since VS Code colours an item's text all at once and the words stay in body ink. The screenshots will show it.

## Feature Flag Check

No feature flag. Part 1 changes nothing a person sees. Part 2 corrects what 2.0 and 2.1 already show, on for everyone. HARD RULE #1 holds: every step of the Windows job stays, the canary stays, patch 020 replaces no code, no flag is deleted or changed for P2, and the status bar item is rewritten, never hidden or removed.

## Testing

- **Here (the Mac):** the patch stack on a pristine pin; dev launches on the new Electron and of Part 2 (hidden, `--use-mock-keychain`, one launch reused, isolated profiles for P3's states, never the person's `~/.codex` or `~/.claude`); P4's harness; the YAML and the scripts. No production build here (about 16 GB free).
- **On GitHub, free:** the Windows build on `main` after the merge (S1–S4, S8), and macOS x64.
- **On Windows:** the Windows session, through the Development manager (S11–S12's Windows half, S17–S19).
- **Not paid:** nothing in this sprint runs on the 8-core runner.

## Success Criteria

- [ ] A Windows build of `main` is green on `windows-latest`, signed, with the repository public before and after and its stars and watchers unchanged (R1, S1–S3).
- [ ] The release instructions contain no visibility command (R2).
- [ ] The Mac and Windows apps run on Electron 43.8.3 or newer 43.x, and About shows its Node (R3, S9, S11).
- [ ] A build whose packaged Electron differs from the target fails (R3, S14).
- [ ] Either About shows Node 24.22.1, or the release plan carries #515's written risk (R3, R4, S15/S16).
- [ ] S17–S19 reported from Windows before the version bump (R5).
- [ ] No hand-rolled button on the sign-in card, and its icons match its words (P1).
- [ ] No "Experimental" badge in Settings (P2).
- [ ] The status bar names the AI and its state in the Experience lead's words, live for all three AIs, and never says ready when no AI is (P3).
- [ ] The Flow step panel's fields are whole and its model picker is usable within 250 ms (P4).
- [ ] The switch measured; Home without a loading document and the AI column within 300 ms, either fixed here or checked on the candidate (P5).

## Risks

| Risk | Retirement |
|---|---|
| The free runner can't hold the build | Measured to fit (A1); the disk guard; Decision 1's fallback |
| Electron 43.8.x breaks something | Upstream VS Code runs 43.8.3; S11, S12; drop patch 020 to return to 43.7.7 |
| No Node 24.22.1 in time | R4 and Decision 3 |
| A Windows check fails late | R5 runs them before the candidate, not at it |
| P3 grows into a readiness subsystem | It reuses `runtimeAvailability()` and the existing events; one field on one existing message |
| P5 needs a patch | It stops at the measurement and becomes an RC check |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprints 141–143 merged** (main `c99a8596` has all three); this sprint is the last code before the version bump.
- **The Windows session** for S11–S12's Windows half and S17–S19.
- **The Experience lead** for P3's open words and the screenshots of P1–P4.
- **Electron's release schedule** for S15.

## Pre-Implementation Gate

- This plan is reviewed and approved. A message from the Development manager approving it counts under Jarmo's delegation of 26 October; nothing else does.
- A3 comes before W3's check; A5 (S37) before any P5 code.

## Approval

- [ ] Approved by the Development manager under Jarmo's delegation.

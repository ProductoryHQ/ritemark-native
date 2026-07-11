# Sprint 91: Windows Foundation

Track: SDD (auto-detected: 4 distinct user-facing/technical workstreams spanning signing, VS Code core error surfacing, patch-layer UI, and CI — plus an edge-case-heavy domain: Smart App Control reputation gating, cloud-file-placeholder OS error codes, and cross-platform patch verification. Multi-component flow: Inno Setup installer ↔ signtool/Trusted Signing ↔ CI workflow ↔ VS Code core file-open path.)
Override with: "use plain full track" / already SDD, no override requested.

Branch: `sprint-91-windows-foundation` (created, pushed to origin)

Status: Phase 5 (PR pending) — implementation complete across two machines (macOS wiring + Windows session + macOS verification); W1-11/W1-12 intentionally deferred to release time (see tasks.md)

Parent release: [`docs/development/releases/v1.8.2/release-plan.md`](../../releases/v1.8.2/release-plan.md) — v1.8.2 "Sturdy & Seamless Delivery (Windows-first)", sprint #1 of 3. Release type: **shell** (patches + installer + code-signing + build system).

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (R1.x-R5.x, source of truth)
- [scenarios.md](scenarios.md) — BDD examples / manual QA matrix
- [technical-plan.md](technical-plan.md) — architecture, verified current-state findings, file-level design
- [tasks.md](tasks.md) — implementation tracker, grouped W1-W4, cert-gated tasks flagged
- [sprint-plan.md](sprint-plan.md) — this file (intent + status + product decisions)

## Goal

Make Windows installable on a default (Smart App Control-enabled) Windows 11 machine, give OneDrive/SharePoint users an actionable error instead of a cryptic one, restore File Browser New File/New Folder buttons, and de-risk the CI pipeline that builds all of this — as one coherent "Windows Foundation" shell release.

## Linked Issues

- [#130] Windows 11 Smart App Control blocks `Ritemark-Setup.exe` (Error 4551) — headline, externally gated on Azure Trusted Signing cert procurement
- [#134] OneDrive/SharePoint synced file fails to open ("Unknown (FileSystemError)")
- [#131] File Browser missing New File / New Folder buttons

## Release-Tier Justification

**Shell tier.** Per the release-tier taxonomy in `docs/development/analysis/2026-07-07-seamless-update-delivery-plan.md` §2, a release is shell-tier if it touches `patches/vscode/*`, native/build tooling under `scripts/`, or anything affecting the shipped app layout outside the extension zip. This sprint touches:
- `patches/vscode/002-ritemark-ui-layout.patch` (W3 — new hunk)
- `installer/windows/ritemark.iss` (W1 — Inno Setup signing directives)
- `.github/workflows/build-windows.yml`, `build-macos-x64.yml`, new `windows-canary.yml` (W1, W4)
- New `scripts/codesign-windows.sh`, edits to `scripts/validate-build-output.sh` (W1)
- Possibly a VS Code core patch for W2 (pending the W2-1 spike outcome in tasks.md)

None of this ships via the extension fast-lane (out of reach until v1.8.2's own sprint-93 exists) — it requires the shell/installer layer, confirming the release-plan's framing that Windows Foundation must be a shell release.

## MVP Scope

Four workstreams (full detail in spec.md / technical-plan.md / tasks.md):
- **W1** — #130 sign installer + uninstaller + `.tmp` loader + app exe + bundled agent binaries via Azure Trusted Signing; submit for Microsoft reputation review; document interim SAC workaround.
- **W2** — #134 error surfacing + OS error-code logging for OneDrive/SharePoint cloud-placeholder read failures (diagnostics only, no deep core fix).
- **W3** — #131 add New File / New Folder to the File Browser title bar (corrected root-cause: net-new addition, not a patch revert — see spec.md W3 header).
- **W4** — CI de-risk: drop `push: tags: v*` auto-triggers from `build-windows.yml`/`build-macos-x64.yml` (both already have `workflow_dispatch`); add a weekly free-runner Windows dependency-install canary.

## Product Decisions

- **2026-07-08 (release-level, inherited):** Productory's 7-year business history clears the Azure Trusted Signing public-trust eligibility gate; Trusted Signing (not cloud-OV fallback) is the confirmed signing path. *Jarmo may override at plan approval if the Azure account setup surfaces a blocker not anticipated here.*
- **2026-07-08 (Jarmo, at approval):** #131 is **Windows-only** — macOS already shows New File/New Folder correctly. The buttons ARE registered on the Explorer `ViewTitle` (`explorerView.ts:1022-1058`, verified); on Windows they collapse into the `...` overflow. So the fix is a **Windows title-toolbar overflow/rendering fix, not a new command registration** (re-registering would duplicate the buttons on macOS). Root cause not yet pinned — W3-1 is a spike (leading hypothesis: patch 002's title-action toolbar CSS reduces usable width on Windows). This corrects the earlier research-pass claim (which checked the wrong file, `fileActions.contribution.ts`, and wrongly concluded "never registered / net-new for both platforms").
- **2026-07-08 (this plan):** W2's fix point (extension-level vs. a VS Code core patch) is NOT yet determined — `ritemarkEditor.ts`'s `resolveCustomTextEditor` never sees the failing read (VS Code core fails before Ritemark's editor provider runs). Task W2-1 is a mandatory first-task spike to determine the real interception point before implementation proceeds. *This is a genuine open question, not a decision — flagging here so Jarmo knows Phase 3 may reveal W2 needs a VS Code patch rather than pure extension code.*
- **2026-07-08 (this plan):** Following sprint-90's precedent (`feedback_intentionally_untested.md`), if a real OneDrive Files-On-Demand placeholder cannot be reliably reproduced in dev (task W2-4), the scenario ships intentionally untested against the synthetic-fixture path only, rather than blocking the sprint on fabricating a fixture.

## Success Criteria

Mirrors the release plan's sprint-91 feature-complete bar:
- [x] Installer + uninstaller + `.tmp` loader + bundled binaries all signed (#130). Cert landed 2026-07-11; all `.exe`s verified with `signtool verify /pa`.
- [ ] App submitted to Microsoft for reputation review; interim SAC workaround documented (#130) — workaround doc (`docs/user/windows-smart-app-control.md`) done; **submission itself deferred to release time (W1-11)**, needs the final v1.8.2 binary.
- [x] Clean Windows 11 (Smart App Control enabled) install test passes — headline exit test (#130). Verified 2026-07-11: no Error 4551, no SAC block, no SmartScreen warning.
- [x] OneDrive/SharePoint placeholder shows an actionable error; real OS error code logged (#134). Live-reproduced (`errno=-4094, syscall=read`), patch 011.
- [x] New File / New Folder buttons render inline in File Browser on Windows (#131); macOS unchanged (already correct). Verified on both platforms (W3-4 Windows, W3-5 macOS).
- [ ] Windows / macOS-x64 CI trigger via `workflow_dispatch` only (tag auto-trigger removed) — done; weekly Windows canary green — **not yet dispatchable** (new `workflow_dispatch` workflows only register with GitHub Actions once merged to the default branch; will confirm right after this PR merges, W4-6).

## External Critical-Path Note (read this before Phase 3)

W1's full completion (signing verification, SAC test, reputation submission) is gated on an **external, non-code dependency**: Jarmo's Azure Trusted Signing account setup + identity validation (officially 1-20 business days, per release-level research). This is Jarmo's parallel action, independent of sprint code work. The sprint's code-side wiring (tasks W1-1 through W1-6) can be built, reviewed, and merged without the cert existing. Tasks W1-7 through W1-12 are explicitly marked **[BLOCKED-ON-CERT]** in tasks.md and cannot be marked done until the cert profile is live.

**Contingency (per release plan):** if the cert procurement slips badly, W1's cert-gated tasks can drop to a v1.8.3 follow-up sprint while W1's wiring, W2, W3, and W4 still ship in this sprint/release. This does not require a scope-change protocol invocation unless Jarmo wants to formally re-cut the sprint boundary — it is anticipated in the release plan itself.

## Approval Gate (HARD — read before touching code)

Per repo CLAUDE.md and the user's global instruction ("never start sprint coding before me (user) actually approves sprint plan"):

1. **No implementation code until Jarmo approves this plan.** Release phrases: "approved", "Jarmo approved", "proceed".
2. **Immediately after approval, before any code edit:** create the sprint branch.
   ```bash
   git checkout -b sprint-91-windows-foundation
   git branch --show-current   # must print sprint-91-windows-foundation
   ```
3. Sprint code never lands on `main` directly.
4. Standard commit gate: pre-commit hook (`.claude/hooks/pre-commit-validator.sh`) must pass on every commit.
5. Sprint-end gate: recommend invoking `qa-validator` for Phase 4 sign-off (build/standards validation) before merge, and again at Phase 6 if a prod build is produced from this sprint's work directly (more likely this lands as part of the full v1.8.2 release build, per the release plan's Gate 1/Gate 2 process).

## Approval

- [x] Jarmo approved this sprint plan (2026-07-08, per branch creation + WINDOWS-HANDOVER.md's confirmation that implementation was unlocked)

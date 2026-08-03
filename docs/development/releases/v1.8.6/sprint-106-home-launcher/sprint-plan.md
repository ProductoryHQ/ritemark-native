# Sprint 106 — Home and First-Task Launcher

**Status:** Approved — planned; implementation not started  
**Parent release:** [v1.8.6](../release-plan.md)  
**GitHub milestone:** [v1.8.6](https://github.com/ProductoryHQ/ritemark-native/milestone/7)  
**Branch:** `sprint-106-home-launcher`  
**Track:** Full — new navigation surface and onboarding re-entry  
**Delivery tier:** Extension-first; shell-tier only after explicit escalation

## Goal

Give users a persistent, task-oriented way to create a normal Markdown document, start an AI task, or reopen recent work after the one-time Welcome surface is gone.

## Release Outcome

Home becomes a lightweight re-entry point, not a second onboarding system: one obvious **New document — Markdown (.md)** action, a small set of existing quick actions, and recent work.

## Linked Issues

- [#74 — Home launcher for New Markdown document, AI task, and recent work](https://github.com/ProductoryHQ/ritemark-native/issues/74), rescoped to the approved MVP.
- Pinned files, git sync, and TODO aggregation were removed from the issue and remain outside this sprint.

## In Scope

- Extension-contributed Home entry in the Activity Bar.
- Dominant **New document** action with explicit “Markdown (.md)” helper copy.
- **New AI task**, Open document, Import file, and New folder quick actions.
- Recently opened documents/folders using existing sources.
- Reuse `ritemark.newDocument`, `ritemark.newChat`, and existing open/import commands.
- Empty, missing-folder, unavailable-command, keyboard navigation, and narrow-sidebar states.
- Decide extension-only placement first; escalate to a VS Code shell patch only if exact icon position is essential and Jarmo approves the release-tier change.

## Explicitly Out of Scope

- Pinned files.
- Git push/pull or sync-state UI.
- Project-wide TODO aggregation.
- A second Welcome hero, tutorial system, or duplicated launch checks.
- Custom document-creation logic that diverges from `ritemark.newDocument`.
- A shell patch made only for cosmetic first-icon ordering without explicit approval.

## Deliverables

1. Home MVP view and Activity Bar contribution.
2. Existing-command adapter layer with no duplicate creation logic.
3. Recent-work and empty/error states.
4. Feature-flag wiring and rollback path.
5. User docs, release notes, screenshots, and Home-focused QA coverage.

## Architecture and Feature Flags

- Add a `home-launcher` flag in `src/features/flags.ts`; this is a large new navigation surface and needs a kill switch during rollout.
- Gate extension contribution and webview/view behavior through the existing feature flag system; no ad hoc configuration checks.
- Do not modify the VS Code submodule directly. If exact placement requires shell work, use `patches/vscode` in an explicitly approved shell-tier path.
- Update [architecture.md](../../../architecture.md) if a new top-level view/provider module, message contract, feature flag, or shell patch is added.

## Definition of Done

- [ ] Home is reachable persistently after Welcome is closed.
- [ ] The primary action visibly says **New document — Markdown (.md)** and invokes the canonical command.
- [ ] New AI task and open/import/folder actions invoke existing commands.
- [ ] Recent work is accurate, deduplicated, keyboard accessible, and handles missing entries safely.
- [ ] Home does not duplicate tutorial content or launch checks from Welcome.
- [ ] `home-launcher` disables the entire new surface cleanly.
- [ ] Extension-only placement is accepted, or shell escalation is explicitly approved and release tier updated before implementation continues.
- [ ] #74 is closed only for the approved MVP slice; removed residual ideas require new issues if requested later.

## Validation

- Unit/component tests for actions, recent-item mapping, empty state, feature flag, and unavailable commands.
- Dev-mode walkthrough from fresh profile, returning profile, folder/no-folder, missing recent item, keyboard-only navigation, and flag off.
- Screenshot evidence at narrow and normal sidebar widths.
- If shell-tier is approved, use `vscode-development`, update the patch manifest/architecture, and validate a production build path.
- Run `./scripts/validate-qa.sh` before readiness handoff.

## Dependencies and Blockers

- No code dependency on Sprints 102–105; it is sequenced last to keep the release’s critical AI correctness path ahead of onboarding polish.
- The delivery tier decision must be made during the extension prototype, not at release packaging time.
- Full release execution starts only after this sprint and the feature-complete checklist are complete.

## Risks

- A duplicated Welcome surface creates two inconsistent onboarding systems.
- Exact Activity Bar ordering may not be controllable through supported extension APIs.
- Adding a late shell patch can expand the release from extension-only to full app; escalate early or accept supported placement.

## Approval Gate

- [x] Jarmo approved the #74 MVP split and extension-first placement rule on 2026-08-03.
- [x] Rescoped #74 is assigned to the v1.8.6 milestone.
- [ ] Create the sprint branch only after approval; no product code changes on `main`.

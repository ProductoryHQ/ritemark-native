# Sprint 102 — AI Transparency and Policy Alignment

**Status:** In progress — branch created 2026-08-03  
**Parent release:** [v1.8.6](../release-plan.md)  
**GitHub milestone:** [v1.8.6](https://github.com/ProductoryHQ/ritemark-native/milestone/7)  
**Branch:** `sprint-102-ai-transparency`  
**Track:** Full — product UI, policy accuracy, documentation, and external legal dependency  
**Delivery tier:** Extension + Productory website content

## Goal

Make Ritemark’s AI use clear before users rely on it, and align the public Terms and Privacy Policy with the product that actually ships.

## Release Outcome

Users can always see that they are interacting with AI, which runtime/provider/model is active, what context may be sent, and why human review is required. Productory’s live policy text accurately covers supported platforms, providers, authentication, analytics, and AI data flow.

## Linked Issues

- [#163 — AI transparency UI and Productory policy alignment](https://github.com/ProductoryHQ/ritemark-native/issues/163).
- [#143](https://github.com/ProductoryHQ/ritemark-native/issues/143) is release operations only and is not part of this sprint.

## In Scope

- Verify every disclosure claim against current Claude, Codex, and OpenCode behavior.
- Add an always-accessible **AI information** entry in the AI sidebar and at the end of Ritemark Settings.
- Add clear first-interaction disclosure without a repeated blocking modal, with an explicit **Don’t show again** action.
- Show the selected runtime, provider, and model using existing shared model/runtime sources.
- Explain the context categories that may leave the device: prompt, explicit attachments, active file/selection, browser context, and tool results.
- Add a concise reliability and human-review cue.
- Link to updated Productory/Ritemark AI, Terms, Privacy, and relevant provider information.
- Draft corrected Terms and Privacy wording for counsel and publish the approved text.
- Update user documentation, changelog, release notes, and release test coverage.

## Explicitly Out of Scope

- Productory role classification without counsel approval.
- A custom machine-readable AI-content marking format.
- High-risk-domain compliance workflows or legal conclusions for users.
- Repeating a blocking warning on every AI turn.
- New model identifiers outside `src/ai/modelConfig.ts` / the shared model catalog.

## Deliverables

1. Evidence-backed disclosure matrix for all three runtimes.
2. AI information UI and first-interaction disclosure.
3. Approved Terms and Privacy copy published on Productory’s live site.
4. Updated user docs, release notes, changelog, and test checklist.
5. Counsel decision recorded for Article 50(1), (2), and (4) treatment.

## Architecture and Feature Flags

- Do not add a runtime-specific disclosure implementation; consume shared runtime/model state.
- No feature flag is expected: this is mandatory accuracy and transparency work, not an experiment.
- If a new host↔webview message or shared module is introduced, update [architecture.md](../../../architecture.md) before sprint close.

## Definition of Done

- [x] The disclosure is visible no later than the first AI interaction and remains accessible afterward.
- [x] Dismissing the first-use notice is persistent and the UI says **Don’t show again** rather than using an ambiguous close action.
- [x] The public AI-information page is reachable from both the AI sidebar and Ritemark Settings.
- [x] Runtime/provider/model labels match actual selected values for Claude, Codex, and OpenCode.
- [x] Context and analytics wording matches current code and settings.
- [x] No disclosure promises that files or prompts always remain local.
- [ ] Counsel approves the role, marking, public-interest, Terms, and Privacy wording.
- [ ] Live Terms and Privacy pages are updated and their links are verified from the app.
- [x] Automated tests cover disclosure state and provider/runtime value mapping.
- [ ] Manual QA covers fresh profile, returning profile, runtime switch, model switch, offline state, and broken-link handling.
- [x] User docs, `docs/CHANGELOG.md`, and v1.8.6 release assets are updated for Sprint 102.

## Validation

- Unit/component tests for disclosure visibility and dynamic values.
- Dev-mode walkthrough for Claude, Codex, and OpenCode configurations.
- Verify all linked policies in the integrated browser.
- Run `./scripts/validate-qa.sh` before readiness handoff.

## Dependencies and Blockers

- EU counsel approval is the legal blocker.
- The live Productory Terms/Privacy pages are outside the `ritemark-web` repository; their site owner must publish the approved corrections.
- The product UI can be implemented while counsel review is in progress, but the sprint cannot close until approved policy copy is live.

## Implementation and QA Evidence — 2026-08-03

- Added the compact first-use notice, persistent **AI information** button/dialog, shared runtime/provider/model resolution, context-state rows, review cue, analytics explanation, and provider/policy links.
- Corrected two context-boundary defects discovered during the evidence audit: OpenCode attachments now reach ACP, and removing the active-file chip now reaches Codex/OpenCode as well as Claude. The OpenCode browser chip is hidden because that runtime does not receive integrated-browser context.
- Added `aiDisclosure.test.ts` and extended `runtimeSwitching.test.ts`.
- Fresh-profile CDP smoke verified the first-use notice, full dialog, acknowledgement persistence after reopening the view, and the always-available information button. Switching to Codex exposed a stale Claude model label in the first implementation; the resolver now rejects pending model IDs that do not belong to the selected runtime, with a regression test, and the follow-up smoke showed `Codex · OpenAI · GPT-5.6-Sol` consistently.
- `npm run typecheck`, the two targeted Sprint 102 tests, the webview production build, and `./scripts/validate-qa.sh` pass.
- Full extension `npm test` reaches and passes the Sprint 102 tests, then stops in the existing flow integration suite because the standalone test process cannot resolve the `vscode` module.
- The paired `ritemark-web` work merged in [PR #77](https://github.com/jarmo-productory/ritemark-web/pull/77). CI passed, the production-mode Playwright suite passed 86/86, and both localized AI-information pages and footer links were verified live.
- The native implementation and documentation are in [draft PR #166](https://github.com/ProductoryHQ/ritemark-native/pull/166).
- Follow-up polish makes the first-use persistence explicit with a **Don’t show again** action and adds an **AI information** link at the end of Settings.
- Follow-up `npm run typecheck`, the disclosure test, webview production build, extension compile, and `./scripts/validate-qa.sh` pass. CDP verified that **Don’t show again** writes the existing acknowledgement key and hides the notice, then a clean reload restores it when the key is cleared; the Settings footer entry also renders in the dev app. The external Settings link was not clicked during automation so review would not open another browser window unexpectedly.
- Remaining work: Jarmo’s visual review of those two follow-up placements, OpenCode/offline/broken-link manual coverage, counsel decision, approved Productory policy publication, and verification of the live policy links.

## Decisions

- No feature flag: the disclosure corrects mandatory product accuracy rather than introducing an experiment.
- No architecture document update is required: Sprint 102 reuses the existing `agent-execute` message shape, runtime registry, shared model catalogue, and existing context fields; it adds no host↔webview message type or runtime.
- The Ritemark website can host the stable EN/ET AI-information routes, but it cannot publish Productory's Terms/Privacy pages. Those corrections remain a counsel draft and an external publication gate.
- The first-use notice remains one-time and locally persisted. Use an explicit **Don’t show again** action rather than a checkbox with a temporary-dismiss state.
- Settings provides a stable secondary route to the public AI-information page; it reuses the existing safe `openExternal` message contract.

## Risks

- Static copy can drift from runtime behavior; derive dynamic identifiers from shared state and keep prose provider-neutral.
- Legal review can delay release; send a narrow decision memo at sprint start rather than after UI implementation.
- An overbearing warning can damage onboarding; keep first-use disclosure concise and make detail progressively accessible.

## Approval Gate

- [x] Jarmo approved this sprint scope on 2026-08-03.
- [x] #163 is created and assigned to the v1.8.6 milestone.
- [x] Created `sprint-102-ai-transparency` after approval; no product code changes on `main`.
- [x] Jarmo reviewed and approved the final **Don’t show again** action and Settings footer link in the dev build on 2026-08-03.

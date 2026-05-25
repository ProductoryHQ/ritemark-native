# Sprint 71: GitHub Copilot Support

## Goal

Make GitHub Copilot usable in Ritemark without letting upstream Copilot or VS Code Chat reclaim Ritemark-owned UI surfaces.

This sprint starts with an audit because the current codebase intentionally suppresses Copilot in several places. Implementation should proceed only after the audit path is confirmed.

## Linked Issue

- [#68 Support GitHub Copilot extension without conflicting with Ritemark UI](https://github.com/ProductoryHQ/ritemark-native/issues/68)

## Product Intent

Some users can use GitHub Copilot Business or Enterprise through Microsoft/GitHub-approved company policy, while direct OpenAI or Anthropic use is blocked. Ritemark should not force those users out of the app when they need VS Code-native Copilot features.

## MVP Scope

- Allow a user to install GitHub Copilot/Copilot Chat from the Marketplace and use it in Ritemark.
- Let Copilot authenticate through GitHub without a broken or missing auth flow.
- Validate inline completions in normal editor text.
- Ship Copilot Chat in the same sprint, provided it lives beside Ritemark AI rather than taking over the Ritemark AI auxiliary bar.
- Understand Copilot Agents / Agent Window behavior and either support a contained surface or disable it gracefully.
- Document remaining conflicts and the smallest follow-up path.

## Out of Scope

- Replacing Ritemark AI with Copilot.
- Wiring Copilot into Ritemark's custom AI sidebar runtime selector.
- Supporting Copilot Cloud Coding Agent as a first-class Ritemark scheduled-agent runtime.
- Making Copilot the default chat agent for all users.
- Enabling broad upstream VS Code Chat UI by default.
- Bundling GitHub Copilot into Ritemark as a built-in extension in this sprint.
- Adding a separate Ritemark-owned user-facing Copilot setting beyond the Marketplace install/uninstall path.

## Feature Flag Check

- Does this sprint need a feature flag?
  - **No separate user-facing Ritemark flag for Sprint 71.** The Marketplace extension install/uninstall state is the user control surface.
  - Implementation still keeps the risky upstream UI surfaces suppressed: command center, titlebar/setup badge, and chat status bar remain off.
  - Expected behavior without Copilot installed: current Ritemark behavior should remain unchanged.
  - Expected behavior with Marketplace Copilot installed: Copilot can authenticate, inline completions can run, and Copilot Chat lives in the Auxiliary Bar beside Ritemark AI while the primary Activity Bar exposes only a launcher.

## Success Criteria

- [x] Copilot support audit exists under `research/`.
- [x] Current blockers are listed with exact files/patches/scripts.
- [x] Chosen implementation path says whether Ritemark uses bundled Copilot, Marketplace-installed Copilot, or both.
- [x] Copilot auth requirements are documented (`defaultChatAgent`, trusted auth access, product metadata, extension API proposals).
- [x] UI containment rules are documented: which Copilot surfaces may appear, which must remain hidden, and why.
- [x] A validation checklist exists for sign-in, inline completions, chat/agent behavior, and Ritemark UI regression checks.
- [x] Marketplace-installed Copilot has been smoke-tested in the dev app. User acceptance completed on 2026-05-23.
- [x] Existing non-Copilot users see no Ritemark AI UI regression. Closeout QA passed on 2026-05-23.

## Product Decisions

- **Install path:** Marketplace-installed Copilot only for this sprint. Ritemark should allow users to install GitHub Copilot from the Marketplace and manage/uninstall it there.
- **Copilot Chat:** in scope for the same sprint.
- **User-facing setting:** no extra Ritemark Copilot setting. The Marketplace extension install/uninstall state is the user-facing control.
- **Activity Bar:** acceptable as a launcher if the user installed the Copilot extension.
- **Primary AI surface:** Ritemark AI Chat Panel remains the primary agentic UI. GitHub Copilot Chat lives next to it in the Auxiliary Bar, ordered after Ritemark AI and before Terminal, and must not overtake, hide, or replace the Ritemark panel.

## Current Findings

See [research/copilot-support-audit.md](research/copilot-support-audit.md).

Regression follow-up on 2026-05-24:

- See [research/prod-copilot-chat-regression-2026-05-24.md](research/prod-copilot-chat-regression-2026-05-24.md).
- Production macOS `1.7.1` contains the expected Copilot product metadata and the Marketplace-installed `github.copilot-chat` extension activates.
- The active production profile had stale workspace state hiding `workbench.panel.chat.view.copilot`, so Copilot Chat could be installed and active without a visible Chat surface.
- The same profile had `workbench.panel.chat` cached in the auxiliary bar as unpinned/hidden, explaining why the sign-in panel could appear briefly in a new window and then be removed.
- The narrow Sprint 71 setup replacement registered setup commands but did not run the install-state/layout-state repair that full `ChatSetupContribution` used to perform.
- Follow-up UI validation clarified the intended layout: the real `workbench.panel.chat` container must remain in the Auxiliary Bar, and the primary Activity Bar should expose only a launcher that opens that right-side Chat panel.
- A post-closeout patch edit also removed the `chatParticipant.contribution.ts` hunk that kept the Chat container non-default in clean production patch application.
- A corrected macOS arm64 production build was produced on 2026-05-24. A later sandbox-safe DMG attempt is not a release candidate because it bypassed the repository release-manager protocol; a proper DMG must follow the signed/notarized release workflow.

Short version:

- Production builds currently remove `extensions/copilot`.
- Windows build scripts also remove the bundled Copilot extension.
- Ritemark configuration defaults explicitly disable Copilot and VS Code Chat.
- `branding/product.json` / generated `vscode/product.json` currently do not define `defaultChatAgent` or trusted auth access for `github.copilot-chat`.
- Patch 003 disables upstream chat view registration, status bar entry, and several chat/menu surfaces.
- Patch 007 disables VS Code 1.117's `ChatSetupContribution` / `ChatTeardownContribution` because they leaked a "Chat Debug" activity bar item.
- Build CSS has a belt-and-suspenders rule hiding Copilot's debug-only `copilot-chat` Activity Bar container. The user-facing Chat entry is the core `workbench.panel.chat` container.
- Copilot Chat 0.45.0 contributes many proposed APIs, chat participants, tools, prompt files, chat sessions, and activity bar debug views. This cannot be treated as a simple inline-completion extension.
- Normal Copilot Chat appears to depend on the core VS Code Chat view (`workbench.panel.chat.view.copilot`), not the Copilot extension's debug-only `copilot-chat` Activity Bar container.
- Recommended minimum restore is the core Chat view registration in `chatParticipant.contribution.ts`, while keeping Chat setup/status/titlebar/command-center contributions suppressed.

## Proposed Delivery Path

### Phase 0: Audit and decision

- [x] Create sprint branch/worktree.
- [x] Inspect current #68 issue body.
- [x] Inspect existing Ritemark Copilot suppression points.
- [x] Inspect bundled Copilot package metadata from VS Code 1.117.
- [x] Record findings in sprint research.
- [x] Product decision: MVP supports Marketplace-installed Copilot, not bundled Copilot.
- [x] Product decision: Copilot Chat is allowed for v1, with Activity Bar access acceptable if Ritemark AI remains primary.
- [x] Technical decision: start with minimal core Chat view restoration, not broad VS Code Chat restoration.

### Phase 1: Minimal enablement experiment

- [x] Decision: do not add a separate Ritemark Copilot setting; Marketplace install/uninstall is the control.
- [x] Stop disabling Marketplace-installed Copilot defaults:
  - `github.copilot.enable`
  - `github.copilot.editor.enableAutoCompletions`
  - `github.copilot.editor.enableCodeActions`
  - `chat.agent.enabled` if Copilot agent/chat modes require it
- [x] Keep `chat.commandCenter.enabled` false unless validation proves it is mandatory.
- [x] Keep production stripping of bundled `extensions/copilot` for this sprint.
- [x] Add/restore product metadata required by Copilot auth in a way that does not break non-Copilot Ritemark:
  - `defaultChatAgent` with `GitHub.copilot` / `GitHub.copilot-chat`
  - `trustedExtensionAuthAccess.github = ["github.copilot-chat"]`
  - `extensionEnabledApiProposals["github.copilot-chat"]` copied from the compatible Copilot package
- [x] Restore only the core Chat view registration in `chatParticipant.contribution.ts`.
- [x] Keep upstream setup/status/titlebar/command-center takeover hidden unless explicitly needed; Activity Bar launcher access for installed Copilot is allowed.

### Phase 2: UI containment

- [x] Verify Ritemark AI auxiliary bar remains default and visible.
- [x] Verify Copilot does not overwrite `ritemark-ai` or `ritemark.unifiedView`.
- [x] Allow Copilot Activity Bar access only when the Copilot extension is installed.
- [x] Allow Copilot Chat to live beside Ritemark AI in the Auxiliary Bar if it does not hide or replace Ritemark AI.
- [x] Add a primary Activity Bar launcher that opens the Auxiliary Bar `workbench.panel.chat` container for Marketplace-installed Copilot Chat.
- [x] Gate or remove production CSS that hides the intended `workbench-panel-chat` surface when Copilot support is enabled.
- [x] Keep Copilot debug containers hidden unless their debug settings are explicitly enabled.
- [x] Prevent VS Code's builtin chat enablement migration from disabling Marketplace-installed Copilot Chat when Ritemark suppresses ChatSetupContribution.
- [x] Register the narrow Copilot sign-in setup commands without restoring the full ChatSetupContribution UI/badge surface.
- [x] Force Auxiliary Bar order to Ritemark AI, GitHub Chat, Terminal for repaired profiles.
- [x] If Copilot Agent Window depends on taking over the primary chat surface, disable that specific surface gracefully while keeping Copilot Chat and inline completions working. No blocking Agent Window takeover issue was reported during acceptance testing.

### Phase 3: Validation

- [x] Launch dev app with Copilot support flag off: confirm current UI remains clean.
- [x] Launch dev app with Copilot support flag on.
- [x] Sign in with a GitHub account that has Copilot entitlement.
- [x] Validate inline completions.
- [x] Validate Copilot Chat / Agent behavior according to the Phase 0 decision.
- [x] Validate Ritemark AI sidebar still works.
- [x] Validate Agent Library, Browser, Flows, and Explorer activity bar entries remain stable.
- [x] Run `./scripts/validate-qa.sh` before merge/readiness.

## Risks

| Risk | Mitigation |
| --- | --- |
| Copilot requires product metadata Ritemark deliberately removed | Add metadata behind a controlled support path; keep optional guards where needed. |
| Copilot Chat contributes too many UI/menu/tool surfaces | Keep MVP to inline completions first; allow chat only in a clearly contained surface. |
| Re-bundling Copilot increases app size and Windows native-binary packaging risk | Reuse existing `.moduleignore` strip rules; choose Marketplace-installed extension path if bundling is too risky. |
| Upstream VS Code Chat patches conflict with Copilot Chat | Do not undo broad chat patches blindly; re-enable only the minimum required contributions. |
| Corporate users need Business/Enterprise auth | Validate with a real entitled account; document entitlement failure states. |
| Marketplace Copilot Chat uses proposed APIs unavailable in Ritemark's VS Code fork | Allow-list the compatible proposal set in product metadata and validate against the Marketplace version actually installed. |
| `defaultChatAgent` accidentally makes Copilot feel primary | Keep Ritemark's Activity Bar/Auxiliary Bar defaults and Ritemark AI contribution unchanged; use `defaultChatAgent` as compatibility metadata, not product positioning. |

## Validation Notes

Official VS Code Copilot setup docs currently require a GitHub account with Copilot access and describe sign-in through VS Code's Copilot UI. The bundled Copilot Chat extension's own development docs require trusted GitHub auth access for `github.copilot-chat` and a populated `defaultChatAgent` product entry when running in Code OSS-style builds.

Implementation validation completed on 2026-05-18:

- `branding/product.json` parses as valid JSON.
- `extensions/ritemark/package.json` parses as valid JSON.
- Product metadata includes `defaultChatAgent`, provider-scoped trusted auth access, and 60 Copilot Chat proposed APIs.
- All 60 proposal names exist in the local VS Code proposal registry.
- `./scripts/apply-patches.sh --dry-run` passes in the main checkout: all 10 patches are already applied and none conflict.
- `cd extensions/ritemark && npm run compile` passes.
- `./scripts/validate-qa.sh` passes in the main checkout.
- `git diff --check` passes.

Earlier validation blocker, now resolved:

- The separate `/Users/jarmotuisk/Projects/ritemark-native-copilot` worktree could not validate because it lacked initialized `vscode` and extension dependencies, and `vscode` submodule initialization hit `Out of diskspace`.
- The branch was moved onto the main checkout, where `vscode` and `extensions/ritemark/node_modules` were already present.
- Local patched source in `vscode/src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts` was synced to match the updated patch: core Chat view registration is active and the Chat container remains non-default.
- `vscode/product.json` was synced from `branding/product.json` for dev validation.

Dev smoke follow-up from the Marketplace screenshot:

- Marketplace search now finds `github.copilot-chat`, but the details page showed `This extension is disabled globally by the user.`
- The dev profile contained `extensionsIdentifiers/disabled = [{"id":"github.copilot-chat"}]` and `builtinChatExtensionEnablementMigration = true`.
- Root cause: VS Code's builtin chat enablement migration disables the chat extension when chat setup has not completed. Ritemark intentionally disables `ChatSetupContribution`, so that migration strands Marketplace-installed Copilot Chat in a disabled state.
- Patch 003 now skips that migration for Ritemark while keeping setup/status/titlebar/command-center takeover surfaces suppressed.
- Follow-up: Copilot's contained `Sign In` button calls `workbench.action.chat.triggerSetupForceSignIn`. Patch 007 now registers a narrow action-only setup contribution for `workbench.action.chat.triggerSetupForceSignIn`, `workbench.action.chat.triggerSetup`, and anonymous setup support, without registering setup agents, titlebar sign-in, account menus, or setup badges.

Closeout validation completed on 2026-05-23:

- User acceptance testing completed and sprint closure approved.
- `./scripts/validate-qa.sh` passed in the main checkout.
- Git working tree was clean before closeout documentation was updated.

References:

- [VS Code: Set up GitHub Copilot](https://code.visualstudio.com/docs/copilot/setup?ref_product=copilot&ref_style=text)
- [VS Code: Get started with GitHub Copilot](https://code.visualstudio.com/docs/copilot/getting-started)
- [GitHub Copilot Chat extension repository](https://github.com/microsoft/vscode-copilot-chat)
- Local upstream extension docs: `/Users/jarmotuisk/Projects/ritemark-native/vscode/extensions/copilot/CONTRIBUTING.md`

## Status

**Track:** Reopened for production regression follow-up
**Current phase:** Regression fix/audit on 2026-05-24
**Branch:** `codex/sprint-71-github-copilot-regression-audit`
**Worktree:** `/Users/jarmotuisk/Projects/ritemark-native`

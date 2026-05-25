# Production Copilot Chat Regression Audit

Date: 2026-05-24
Branch: `codex/sprint-71-github-copilot-regression-audit`

## Symptom

Marketplace-installed GitHub Copilot Chat appears in the Extensions view, but the Copilot Chat surface does not appear in the macOS production app. The same support path had passed dev-app acceptance during Sprint 71.

## Findings

- `/Applications/Ritemark.app` is a `1.7.1` build with Sprint 71 product metadata present:
  - `defaultChatAgent.chatExtensionId = GitHub.copilot-chat`
  - trusted GitHub auth access includes `github.copilot` and `github.copilot-chat`
  - `extensionEnabledApiProposals.github.copilot-chat` contains 60 proposals
- The bundled `extensions/copilot` directory is absent, as intended for Sprint 71. The user-installed extension is present at `~/.ritemark/extensions/github.copilot-chat-0.45.1`.
- Latest production logs show `GitHub.copilot-chat` activates, so this is not an extension discovery failure.
- The Copilot extension log reports `GitHubLoginFailed` because the user is not signed in inside Ritemark, which is expected until a visible sign-in path exists.
- The renderer log also shows `CodeExpectedError: No default agent registered`; this follows from starting a chat session before Copilot has registered an implementation.
- The active `productory-consulting` workspace storage contains `workbench.panel.chat.view.copilot` with `isHidden: true`. Several older workspaces have the same stale hidden state.
- The profile auxiliary bar state also contains `workbench.panel.chat` with `pinned: false` and `visible: false`, matching the observed behavior where the sign-in panel appears briefly in a new window and is then removed from the bar.
- Follow-up UI validation showed the contained Chat view can be visible while still missing from the primary Activity Bar. Marketplace Copilot Chat contributes only a debug-only `copilot-chat` Activity Bar container; the real user Chat surface is the core `workbench.panel.chat` container.
- A post-closeout edit had removed the `chatParticipant.contribution.ts` hunk from `patches/vscode/003-ritemark-menu-cleanup.patch`. That means future clean production patch application could lose the intended `isDefault: false` containment for the Chat container.

## Root Cause

Sprint 71 correctly avoided restoring VS Code's full `ChatSetupContribution`, because it brings back upstream setup badges and broader Copilot UI. The replacement `ChatSetupActionsContribution` registered only the setup/sign-in commands.

That was too narrow for cold or migrated production profiles:

- it did not run the install-state check that marks Marketplace Copilot Chat as installed and reopens Chat setup visibility;
- it did not clear stale per-workspace view state from the earlier “hide upstream chat” era;
- it did not repin the Chat container after older profile state had recorded it as intentionally hidden;
- it did not move/pin the real `workbench.panel.chat` container into the primary Activity Bar when Marketplace Copilot Chat was installed;
- therefore an already-installed Copilot Chat extension could activate while its intended `workbench.panel.chat.view.copilot` view remained hidden.

Dev acceptance likely missed this because the dev profile had a warmer/authenticated layout state than the production profile.

## Fix Direction

- Keep full `ChatSetupContribution` and `ChatTeardownContribution` disabled.
- Extend the narrow `ChatSetupActionsContribution` to run the Copilot install-state check.
- When Marketplace Copilot Chat is installed and enabled, clear stale hidden state for `workbench.panel.chat.view.copilot` in both workspace and profile view storage.
- Move and pin the real `workbench.panel.chat` container into the primary Activity Bar when Marketplace Copilot Chat is installed and enabled. Do not rely on the extension's debug-only `copilot-chat` view container for user Chat access.
- When a prior profile already has `workbench.panel.chat` in the auxiliary bar cache, repin and show that container while preserving Ritemark AI as order `0`.
- Restore the `003` patch hunk that keeps the Chat container non-default (`isDefault: false`) so Copilot remains beside Ritemark AI instead of becoming the primary auxiliary bar surface.

## Build Follow-Up

- Rebuilt macOS arm64 production app on 2026-05-24 after the Activity Bar correction.
- Verified the built workbench bundle contains the `ritemark-copilot-chat` Activity Bar move/pin path.
- A sandbox-safe DMG was generated during investigation after standard `create-dmg` failed with `/Volumes/Ritemark/Ritemark.app - Operation not permitted`, but that artifact is explicitly not a release candidate because it bypassed the repository release-manager protocol.
- Proper DMG delivery remains blocked until the signed/notarized release workflow is run end-to-end: `codesign-app`, standard `create-dmg`, `notarize-dmg`, `verify-notarization`, mounted-DMG hard checks, and Jarmo Gate 1 approval.

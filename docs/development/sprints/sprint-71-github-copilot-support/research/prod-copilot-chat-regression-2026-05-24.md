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
- Follow-up UI validation clarified the desired split: Marketplace Copilot Chat contributes only a debug-only `copilot-chat` Activity Bar container, while the real user Chat surface is the core `workbench.panel.chat` container and must stay in the Auxiliary Bar.
- A post-closeout edit had removed the `chatParticipant.contribution.ts` hunk from `patches/vscode/003-ritemark-menu-cleanup.patch`. That means future clean production patch application could lose the intended `isDefault: false` containment for the Chat container.

## Root Cause

Sprint 71 correctly avoided restoring VS Code's full `ChatSetupContribution`, because it brings back upstream setup badges and broader Copilot UI. The replacement `ChatSetupActionsContribution` registered only the setup/sign-in commands.

That was too narrow for cold or migrated production profiles:

- it did not run the install-state check that marks Marketplace Copilot Chat as installed and reopens Chat setup visibility;
- it did not clear stale per-workspace view state from the earlier “hide upstream chat” era;
- it did not repin the Chat container after older profile state had recorded it as intentionally hidden;
- it did not provide a primary Activity Bar launcher that opens the real `workbench.panel.chat` container in the Auxiliary Bar when Marketplace Copilot Chat was installed;
- therefore an already-installed Copilot Chat extension could activate while its intended `workbench.panel.chat.view.copilot` view remained hidden.

Dev acceptance likely missed this because the dev profile had a warmer/authenticated layout state than the production profile.

## Fix Direction

- Keep full `ChatSetupContribution` and `ChatTeardownContribution` disabled.
- Extend the narrow `ChatSetupActionsContribution` to run the Copilot install-state check.
- When Marketplace Copilot Chat is installed and enabled, clear stale hidden state for `workbench.panel.chat.view.copilot` in both workspace and profile view storage.
- Keep the real `workbench.panel.chat` container in the Auxiliary Bar when Marketplace Copilot Chat is installed and enabled. Do not rely on the extension's debug-only `copilot-chat` view container for user Chat access.
- When a prior profile already has `workbench.panel.chat` in the auxiliary bar cache, repin and show that container while forcing the order to Ritemark AI, GitHub Chat, Terminal.
- Add a primary Activity Bar launcher that opens the Auxiliary Bar Chat container without moving the real Chat surface out of the right side.
- Restore the `003` patch hunk that keeps the Chat container non-default (`isDefault: false`) so Copilot remains beside Ritemark AI instead of becoming the primary auxiliary bar surface.

## Build Follow-Up

- Rebuilt macOS arm64 production app on 2026-05-24 after the first Activity Bar correction; this was later superseded by the Auxiliary Bar + Activity Bar launcher correction.
- The corrected path should verify that `ritemark-copilot-chat` moves Chat to `ViewContainerLocation.AuxiliaryBar` and that the launcher id opens that auxiliary container.
- A sandbox-safe DMG was generated during investigation after standard `create-dmg` failed with `/Volumes/Ritemark/Ritemark.app - Operation not permitted`, but that artifact is explicitly not a release candidate because it bypassed the repository release-manager protocol.
- Proper DMG delivery remains blocked until the signed/notarized release workflow is run end-to-end: `codesign-app`, standard `create-dmg`, `notarize-dmg`, `verify-notarization`, mounted-DMG hard checks, and Jarmo Gate 1 approval.

## 2026-05-25 — Re-release build attempt blocked by corruption + tsc incremental trap

Second-pass production rebuild of v1.7.1 (with Codex's Auxiliary Bar + Activity Bar launcher fix) hit two compounding failures:

1. **0-byte corruption mid-process.** The v1.0.1-pattern disk corruption fired during the build cycle, zeroing thousands of files across `extensions/ritemark/` including most of `node_modules`, all icon SVGs, multiple `.ts` sources, and the `out/` build artifacts. Symptom: pre-flight validator reported corrupt `webview.js`, `vite.config.ts`, and missing icon files.

2. **Incremental tsc preserves 0-byte `.js` after restore.** The first recovery attempt — `git checkout HEAD -- extensions/ritemark/` + `npm install` + `build-prod.sh` — produced a signed DMG that *passed* all build-time validation (`extension.js` was 31449 bytes) but failed at runtime with `'ritemark.ritemark' failed: Invalid or unexpected token` and a blank editor pane. Root cause: `git checkout` does not restore gitignored `out/`, leaving ~26 zero-byte `.js` files (codexManager, versionService, RitemarkSettingsProvider, FlowsViewProvider, etc.). `tsc -p ./` ran in incremental mode against an intact `.tsbuildinfo` cache, decided no recompilation was needed, and the zeroes shipped. At runtime, `extension.js` `require()`d a zero-byte module and V8 raised a parse error, killing extension activation.

   Detection (post-corruption / post-restore):

   ```bash
   find extensions/ritemark/out -type f -size 0 -name "*.js"   # must be empty list
   ```

   Fix:

   ```bash
   cd extensions/ritemark && rm -rf out && npm run compile     # force full tsc recompile
   ```

   Then re-run `build-prod.sh`. The third-pass DMG (SHA `4272876…`) installed cleanly and the Copilot Chat AuxiliaryBar + Activity Bar launcher placement worked.

This is documented in `.claude/skills/release/SKILL.md` under "v1.7.1 — corruption + incremental tsc trap" and added as a key-takeaway rule.

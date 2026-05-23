# GitHub Copilot Support Audit

Date: 2026-05-18  
Branch: `codex/sprint-71-github-copilot-support`  
Issue: [#68](https://github.com/ProductoryHQ/ritemark-native/issues/68)

## Executive Summary

GitHub Copilot support is currently blocked by multiple intentional Ritemark choices, not by a single bug.

The product decision is **Marketplace-installed Copilot first**, including Copilot Chat in the same sprint. Ritemark should not bundle Copilot in this sprint, and should not add a separate user-facing Copilot setting. Marketplace install/uninstall is the user's control surface.

The highest-confidence implementation path is still **not** to broadly restore VS Code Chat. The safer path is:

1. keep current Ritemark AI surfaces as the default;
2. enable enough Copilot product metadata, auth, and proposed API allow-listing for a Marketplace-installed extension;
3. restore only the core Chat view registration required for Copilot Chat to open;
4. keep setup/status/titlebar/command-center takeover surfaces suppressed;
5. validate inline completions and Copilot Chat together;
6. allow Copilot Chat Activity Bar / Auxiliary Bar access only if it lives beside `ritemark-ai`, never over it.

## Current Blockers

### 1. Production builds remove bundled Copilot

`scripts/build-prod.sh` removes the bundled VS Code 1.117 `extensions/copilot` directory:

```sh
for unwanted_ext in copilot mermaid-chat-features; do
  rm -rf "$EXTENSIONS_DIR/$unwanted_ext"
done
```

The script comment says Copilot polluted the activity bar with a "Chat Debug" item and injected chat tools Ritemark does not use.

`scripts/build-windows-local.ps1` does the same:

```powershell
$copilotExt = Join-Path $BuildOut "resources\app\extensions\copilot"
Remove-Item -Recurse -Force $copilotExt
```

Implication: a production Ritemark build cannot use bundled Copilot unless this removal becomes conditional or is reversed.

### 2. Ritemark defaults disable Copilot and Chat

`extensions/ritemark/package.json` sets:

```json
"chat.commandCenter.enabled": false,
"chat.agent.enabled": false,
"github.copilot.enable": { "*": false },
"github.copilot.editor.enableAutoCompletions": false,
"github.copilot.editor.enableCodeActions": false
```

Implication: even if Copilot is installed, default settings suppress its core editor behavior.

### 3. Ritemark product metadata omits Copilot auth wiring

`branding/product.json` and generated `vscode/product.json` currently have:

```json
"defaultChatAgent": null,
"builtInExtensions": [],
"builtInExtensionsEnabledWithAutoUpdates": []
```

The local upstream Copilot Chat docs say Code OSS-style builds need:

- `trustedExtensionAuthAccess.github = ["github.copilot-chat"]`
- a populated `defaultChatAgent` entry with `extensionId: "GitHub.copilot"` and `chatExtensionId: "GitHub.copilot-chat"`

The docs also list entitlement URLs, provider scopes, and commands such as `github.copilot.signIn` / `github.copilot.refreshToken`.

Implication: auth/sign-in may fail or degrade until product metadata is restored or replaced with an equivalent Ritemark-specific path.

### 4. Patch 003 disables upstream chat UI

`patches/vscode/003-ritemark-menu-cleanup.patch` changes the upstream chat view registration:

- chat container no longer default in the auxiliary bar;
- `ChatViewPane` registration is effectively disabled with `when: ContextKeyExpr.equals('ritemark.chatDisabled', 'true')`;
- chat status bar entry is disposed instead of shown;
- several `defaultChatAgent` references are made optional;
- command-center/titlebar chat entry points are removed.

This was correct for Ritemark's existing AI sidebar, but it means Copilot Chat cannot be assumed to work by simply installing the extension.

### 5. Patch 007 disables VS Code 1.117 chat setup contributions

`patches/vscode/007-ritemark-vscode-1117-compat.patch` disables:

- `ChatSetupContribution`
- `ChatTeardownContribution`

Reason in the patch: these contributions add a chat icon with setup badge to the activity bar even when chat views are disabled.

Implication: Copilot's normal first-run setup UI may be missing unless we provide a contained replacement path.

### 6. Build CSS hides Copilot/Chat activity bar items

`scripts/build-prod.sh` appends CSS hiding:

```css
.activitybar .action-item a[class*="workbench-panel-chat"] { display: none !important; }
.activitybar .action-item a[class*="copilot-chat"] { display: none !important; }
```

Implication: even if a view leaks through, production CSS may make the UI unreachable.

### 7. Bundled Copilot is not a tiny extension

Local VS Code 1.117 has `vscode/extensions/copilot/package.json`:

- name: `copilot-chat`
- publisher: `GitHub`
- version: `0.45.0`
- activation: `onStartupFinished`, `onLanguageModelChat:copilot`, `onUri`, file systems `ccreq` / `ccsettings`
- contributes:
  - language model tools and tool sets
  - chat participants
  - language model chat providers
  - interactive sessions
  - MCP server definition providers
  - chat sessions
  - chat prompt files
  - chat skills
  - terminal integration
  - activity bar containers: `copilot-chat` ("Chat Debug") and `context-inspector`

It also requires a large set of proposed APIs via `enabledApiProposals`.

Implication: this is a full VS Code AI platform participant. Treating it as "just inline suggestions" is risky unless we deliberately constrain which surfaces are enabled.

## Product Surface Decision

The confirmed MVP is:

- **Allowed:** Copilot sign-in and inline completions.
- **Allowed:** Copilot Chat in the same sprint.
- **Allowed:** Activity Bar access when the user installed the Copilot extension.
- **Not needed:** an extra Ritemark-owned user-facing Copilot setting; the Marketplace extension install/uninstall flow is the control.
- **Blocked for MVP:** Copilot taking over, hiding, or replacing the Ritemark AI Chat Panel.
- **Gracefully disabled:** Copilot Agents/Agent Window if it depends on taking over the primary agentic UI. Ritemark AI remains the primary agentic UI for users.

## Implementation Options

### Option A: Marketplace-installed Copilot only

Users install Copilot from the Marketplace. Ritemark stops disabling Copilot defaults and provides product auth metadata.

Pros:

- Avoids shipping the large bundled Copilot extension.
- Avoids Windows native-binary packaging risk from `extensions/copilot`.
- Lets users choose whether they want Copilot installed.

Cons:

- We still need Marketplace/extension UI to be discoverable enough.
- The Copilot extension may still require `defaultChatAgent` and trusted auth access.
- Version drift is user-controlled and harder to validate.

### Option B: Bundled Copilot behind a support flag

Ritemark keeps VS Code 1.117's built-in `extensions/copilot` in production when Copilot support is enabled.

Pros:

- Known extension version.
- Easier to validate a fixed Ritemark/Copilot compatibility matrix.
- Better first-run story if users expect "Copilot is available."

Cons:

- App size increase.
- Windows packaging risk from nested native binaries, though patch 008 already strips many of these paths.
- We must carefully keep debug/chat surfaces contained.

### Option C: Hybrid

Support Marketplace-installed Copilot first, then optionally bundle Copilot once packaging/UI containment is proven.

Pros:

- Lowest blast radius.
- Lets the first sprint prove auth + inline completions before app-size/build decisions.

Cons:

- Less polished than a fully bundled experience.
- Validation matrix has two install paths.

## Recommendation

Chosen direction: **Option A for Sprint 71**.

1. Validate Marketplace-installed Copilot with Ritemark product metadata and settings changes.
2. Keep bundled Copilot removal in production for this sprint.
3. Restore the smallest upstream Chat surface required for Copilot Chat: the core Chat view descriptor registration in the auxiliary bar.
4. Do not restore broad setup/status/titlebar/command-center contributions unless validation proves they are mandatory.
5. Do not add a separate Ritemark Copilot setting; the Marketplace extension install/uninstall state is the user-facing control.
6. Ship Copilot Chat in the same sprint if it can live next to Ritemark AI in the Activity Bar / Auxiliary Bar without overtaking it.
7. Preserve Ritemark AI Chat Panel as the primary agentic UI.

## Technical Answer: Which VS Code Chat Contributions to Restore

Recommended minimum:

- Restore `Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([chatViewDescriptor], chatViewContainer);` in `vscode/src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts`.
- Restore the upstream `when` condition for `chatViewDescriptor`:

```ts
ContextKeyExpr.or(
  ContextKeyExpr.and(
    ChatContextKeys.Setup.hidden.negate(),
    ChatContextKeys.Setup.disabledInWorkspace.negate(),
  ),
  ChatContextKeys.panelParticipantRegistered,
  ChatContextKeys.extensionInvalid
)
```

- Keep the Ritemark change that makes the Chat container non-default:

```ts
ViewContainerLocation.AuxiliaryBar, { isDefault: false, doNotRegisterOpenCommand: true }
```

Reason: `workbench.action.chat.open` / `workbench.action.chat.toggle` need `ChatViewId` to be registered before they can reveal Copilot Chat. Without this view registration, Marketplace-installed `GitHub.copilot-chat` can register participants and tools, but the normal chat surface has nowhere to open.

Do **not** restore in the first implementation pass:

- `ChatSetupContribution`
- `ChatTeardownContribution`
- `ChatStatusBarEntry` visible behavior
- titlebar or command-center chat menu registrations removed by Ritemark patches

Reason: `ChatSetupContribution` and `ChatTeardownContribution` are broad onboarding/entitlement/setup contributions. They register setup agents, account/setup actions, growth sessions, URL handlers, and setup badges. Patch 007 disabled them specifically because they leaked a chat icon/setup badge even when Ritemark wanted the chat surface hidden. Restoring them wholesale is likely to reintroduce the UI takeover risk.

Fallback only if validation fails: restore a narrower setup/auth path rather than the full setup contributions. Product metadata and trusted auth access may be enough for Marketplace Copilot sign-in without re-enabling the setup badge machinery.

## Product Metadata Answer

Marketplace-installed `GitHub.copilot-chat` likely needs three product-level pieces:

1. `defaultChatAgent` with `extensionId: "GitHub.copilot"` and `chatExtensionId: "GitHub.copilot-chat"`.
2. `trustedExtensionAuthAccess.github = ["github.copilot-chat"]`.
3. `extensionEnabledApiProposals["github.copilot-chat"]` containing the `enabledApiProposals` declared by the Copilot package.

Why this matters:

- `chatEntitlementService` returns early when `productService.defaultChatAgent` is missing, so entitlement/setup context can be absent without it.
- `authenticationAccessService` has product support for provider-scoped trusted auth access, which matches Copilot Chat's GitHub auth requirement.
- Marketplace extensions using proposed APIs are normally rejected or stripped unless product metadata explicitly allows those proposals. The bundled Copilot package declares many proposals, including chat participants, tools, chat sessions, prompt files, MCP server definitions, chat status items, and language model capabilities.

Important distinction: setting `defaultChatAgent` does **not** by itself have to make Copilot the primary user-facing Ritemark UI. The primary UI is controlled by view/container defaults and Ritemark's own extension contribution. The sprint should keep Ritemark's `ritemark-ai` container as default and use `defaultChatAgent` as compatibility/auth metadata for Copilot.

## Surface Containment Answer

Allowed for Sprint 71:

- Marketplace installation of GitHub Copilot / Copilot Chat.
- GitHub sign-in and entitlement checks.
- Inline completions.
- Copilot Chat in the Activity Bar / Auxiliary Bar after the user installs Copilot.
- Copilot Chat commands that open the contained chat view.

Keep suppressed:

- VS Code Chat command center takeover.
- VS Code Chat titlebar control.
- Chat status bar entry.
- First-run setup badge that appears without user intent.
- Copilot debug containers (`copilot-chat` / "Chat Debug" and `context-inspector`) unless the user explicitly enables their debug settings.

Build CSS should be split accordingly: hiding `copilot-chat` debug surfaces can stay, but hiding `workbench-panel-chat` will probably block the intended Chat view and should be removed or gated when Copilot support is enabled.

## Implementation Options After Investigation

### Option 1: Minimal Core Chat Restore (recommended)

Restore only Chat view registration, product metadata, auth trust, proposed API allow-listing, and Copilot-related default settings. Keep Ritemark AI default and keep setup/status/titlebar/command-center suppressed.

Expected outcome: Marketplace Copilot can authenticate, inline completions can run, and Copilot Chat can open beside Ritemark AI.

Risk: Copilot sign-in may still require a narrow setup/auth flow if `ChatSetupContribution` turns out to be mandatory.

### Option 2: Inline First, Chat Second

Only add product metadata/auth/proposed API support and stop disabling inline Copilot. Leave Chat view disabled until inline completions are proven.

Expected outcome: lower UI risk, faster proof that Marketplace Copilot loads.

Risk: does not satisfy the current product decision that Copilot Chat should ship in the same sprint unless followed immediately by Option 1.

### Option 3: Broad Upstream Chat Restore

Restore `ChatSetupContribution`, `ChatTeardownContribution`, status/titlebar/command-center surfaces, and upstream Chat defaults.

Expected outcome: closest to stock VS Code behavior.

Risk: high. This likely violates the requirement that Ritemark AI remains the primary agentic UI and may reintroduce the exact activity bar/setup badge problems that Ritemark patches removed.

### Option 4: Ritemark-Owned Copilot Launcher

Restore the core Chat view but expose it through a contained Ritemark command such as "Open GitHub Copilot Chat" instead of relying on upstream setup surfaces.

Expected outcome: clear user path without broad upstream UI restoration.

Risk: still needs Option 1's core Chat view and product metadata, so this is polish/containment rather than a replacement for the minimum restore.

## Validation Matrix

### Flag off

- Ritemark boots as today.
- No Copilot / VS Code Chat activity bar item appears.
- Ritemark AI auxiliary bar is default.
- Existing Claude/Codex sidebar works.

### Flag on, Copilot not installed

- Ritemark does not show broken UI.
- User can install GitHub Copilot from the Marketplace.

### Flag on, Copilot installed or bundled

- GitHub sign-in can be initiated.
- Auth completes for an account with Copilot entitlement.
- Inline completions appear in a normal editor.
- Copilot context menu items do not overwhelm Ritemark document UI.
- Copilot Chat opens in its own Activity Bar / Auxiliary Bar surface without hiding or replacing Ritemark AI.
- Marketplace uninstall removes Copilot access without requiring a Ritemark-specific setting.
- Ritemark AI side panel remains accessible and unchanged.

### Build validation

- `./scripts/apply-patches.sh --dry-run`
- `./scripts/validate-qa.sh`
- macOS dev smoke if UI code changes.
- Windows packaging check if bundled Copilot removal is changed.

## Product Decisions Answered

- Install path: Marketplace-installed Copilot. Bundled Copilot is out of scope for Sprint 71.
- Copilot Chat: in scope for the same sprint.
- User-facing setting: no extra Ritemark setting. Marketplace install/uninstall is the control.
- Access point: Activity Bar access is acceptable when the user installed the extension.
- Primary UI: Ritemark AI Chat Panel remains the primary agentic UI; Copilot can live next to it but must not overtake or hide it.

## Remaining Open Questions

- What is the smallest automated/dev-smoke validation that proves Copilot and Ritemark AI can coexist in the Activity Bar / Auxiliary Bar?

## Implementation Update: 2026-05-18

Option 1 is now the selected and implemented path for the first validation pass.

Implemented:

- Added Copilot compatibility metadata to `branding/product.json` using the local installed VS Code product defaults as the source for `defaultChatAgent`.
- Added GitHub/GHE-scoped trusted auth access for `github.copilot` and `github.copilot-chat`.
- Added `extensionEnabledApiProposals["github.copilot-chat"]` with the 60 proposals declared by the local VS Code 1.117 Copilot Chat package.
- Verified all 60 proposal names exist in the local VS Code proposal registry.
- Changed Ritemark defaults so Marketplace-installed Copilot is not disabled by default:
  - `chat.agent.enabled: true`
  - `github.copilot.enable: { "*": true }`
  - `github.copilot.editor.enableAutoCompletions: true`
  - `github.copilot.editor.enableCodeActions: true`
- Kept `chat.commandCenter.enabled: false`.
- Updated patch 003 so the core Chat view registration remains intact while the Chat container stays non-default.
- Kept `ChatSetupContribution`, `ChatTeardownContribution`, chat status bar behavior, titlebar, and command-center suppression intact.
- Updated production build CSS so it no longer hides the intended `workbench-panel-chat` surface; it only keeps Copilot debug containers hidden.
- Kept production stripping of bundled `extensions/copilot`, because Sprint 71 supports Marketplace-installed Copilot first.

Resolved during implementation:

- Product metadata source: copied exact required fields from installed VS Code product metadata, including `tokenEntitlementUrl`, `mcpRegistryDataUrl`, output channel id, and Copilot git command ids.
- Proposed API allow-list: copied from the compatible local Copilot Chat package and checked against the local VS Code proposal registry.
- CSS split: removed the `workbench-panel-chat` hide rule and retained `copilot-chat` debug-container hiding.
- Marketplace visibility: restored the Extensions view open command so users can reach the Marketplace path for Copilot.
- Disabled-state migration: skipped VS Code's builtin chat enablement migration, because Ritemark intentionally disables `ChatSetupContribution` and otherwise Marketplace-installed Copilot Chat gets written to `extensionsIdentifiers/disabled`.
- Sign-in command path: added a narrow `ChatSetupActionsContribution` that registers Copilot's setup/sign-in commands without restoring the full `ChatSetupContribution` surface.
- Auxiliary Bar order: assigned `ritemark-ai` order `0` for new profiles and added a profile-storage migration for `workbench.auxiliarybar.pinnedPanels`, so existing profiles move Ritemark AI before Copilot Chat and Terminal while preserving the remaining relative order.

Still requires smoke validation:

- Marketplace-installed Copilot Chat activation in Ritemark.
- GitHub sign-in with a Copilot-entitled account.
- Inline completions in a normal editor.
- Copilot Chat opens beside Ritemark AI without replacing or hiding `ritemark-ai`; Ritemark AI should remain the first Auxiliary Bar icon.
- Whether sign-in needs any narrower setup/auth restoration after product metadata and trusted auth access.

Main checkout validation update:

- The branch was moved from the separate Copilot worktree to `/Users/jarmotuisk/Projects/ritemark-native` because the separate worktree lacked dependencies and could not initialize `vscode` due to low disk space.
- `./scripts/apply-patches.sh --dry-run` passes in the main checkout.
- `cd extensions/ritemark && npm run compile` passes.
- `./scripts/validate-qa.sh` passes.
- Local `vscode/product.json` and patched `chatParticipant.contribution.ts` were synced for validation so the dev checkout matches the committed patch/product intent.
- Auxiliary Bar order smoke passed in the default dev profile after restart: storage moved `workbench.view.extension.ritemark-ai` to order `0`, and CDP reported visual icon order as `Ritemark AI`, `Chat`, `Terminal`.

Dev smoke follow-up from the Marketplace screenshot:

- GitHub Copilot Chat was visible in Marketplace as `github.copilot-chat`.
- It appeared as disabled globally because the dev profile had `extensionsIdentifiers/disabled = [{"id":"github.copilot-chat"}]`.
- The matching migration marker was `builtinChatExtensionEnablementMigration = true`.
- This came from `ExtensionEnablementService`'s builtin chat enablement migration, which disables the builtin chat extension when chat setup is incomplete.
- That migration is incompatible with Ritemark's deliberate `ChatSetupContribution` suppression, so patch 003 now skips it while leaving broader VS Code Chat takeover surfaces suppressed.
- The next smoke revealed that Copilot's `Sign In` button calls `workbench.action.chat.triggerSetupForceSignIn`; with full `ChatSetupContribution` disabled, that command was missing.
- Patch 007 now registers only an action-only setup contribution for the command path, avoiding setup agents, titlebar sign-in, account menus, editor context menu additions, and setup badges.

## Sources

- Local issue: [#68](https://github.com/ProductoryHQ/ritemark-native/issues/68)
- Ritemark suppressions:
  - `scripts/build-prod.sh`
  - `scripts/build-windows-local.ps1`
  - `extensions/ritemark/package.json`
  - `patches/vscode/003-ritemark-menu-cleanup.patch`
  - `patches/vscode/007-ritemark-vscode-1117-compat.patch`
  - `patches/vscode/008-ritemark-windows-binary-strip.patch`
- Local upstream Copilot extension:
  - `/Users/jarmotuisk/Projects/ritemark-native/vscode/extensions/copilot/package.json`
  - `/Users/jarmotuisk/Projects/ritemark-native/vscode/extensions/copilot/CONTRIBUTING.md`
- Official docs:
  - [VS Code: Set up GitHub Copilot](https://code.visualstudio.com/docs/copilot/setup?ref_product=copilot&ref_style=text)
  - [VS Code: Get started with GitHub Copilot](https://code.visualstudio.com/docs/copilot/getting-started)

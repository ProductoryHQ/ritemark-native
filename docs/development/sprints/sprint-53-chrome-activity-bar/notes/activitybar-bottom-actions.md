# Activity Bar Bottom Actions

Date: 2026-04-25

## Decision

- Hide the Accounts/User action in the Activity Bar bottom rail until Ritemark ships signed-in user functionality.
- Keep one bottom action: Settings.
- Settings opens the branded Ritemark Settings webview through `ritemark.aiSettings`, not the upstream VS Code settings UI.
- Activity Bar product icons use the Phosphor icon font path, registered as a 200-weight face for Sprint 53 chrome consistency.

## Implementation Notes

- `GlobalCompositeBar` no longer pushes the accounts action into the bottom action bar, and storage changes cannot re-add it.
- `GlobalActivityActionViewItem` keeps right-click/context-menu behavior from the base class, but left-click and keyboard activation run `ritemark.aiSettings`.
- `settings-view-bar-icon` now resolves to the Ritemark Phosphor settings glyph, with a product icon theme override for the same icon id.
- Product icon theme font source moved from `Phosphor-Thin.woff2` to `Phosphor-Light.woff2` and registers it as `phosphor-200`.

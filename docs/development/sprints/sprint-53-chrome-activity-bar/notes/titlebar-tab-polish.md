# Titlebar + Tab Polish

Date: 2026-04-25

## User Request

- Remove left/right visual striping from inactive editor tabs.
- Hide the noisy action cluster on the right side of the editor/title area.
- Place the primary sidebar and auxiliary bar toggles immediately to the right of the macOS window controls.

## Implementation

- `tab.border` and `tab.lastPinnedBorder` are transparent in both Ritemark themes so inactive tabs no longer draw vertical separators.
- The editor title action toolbar is hidden visually through the VS Code chrome patch, while commands remain available through menus and keybindings.
- `workbench.editor.editorActionsLocation` defaults to `hidden` for new/default Ritemark profiles.
- The custom layout toolbar now attaches to `titlebar-left` instead of `titlebar-right`; on native macOS it receives a left margin so the buttons sit after the traffic-light controls.
- The LayoutControl menu now contains only the primary sidebar and auxiliary bar toggles for this titlebar slot.

## Validation

- `git -C vscode apply --check --reverse ../patches/vscode/002-ritemark-ui-layout.patch`
- `./scripts/validate-chrome-fast.sh`

# Layout Invariants

These layout rules are enforced by patch `002-ritemark-ui-layout.patch` and must remain true after every upstream sync. Breaking any of them is visible to users immediately.

## Required positions

| Element | Required position | Enforced by |
| --- | --- | --- |
| Ritemark AI panel | Right sidebar (auxiliary bar) | `viewDescriptorService.ts` deletes the cached override for `workbench.view.extension.ritemark-ai` |
| Terminal | Right sidebar (auxiliary bar) | `terminal.contribution.ts`: `ViewContainerLocation.AuxiliaryBar` |
| Terminal editor area | Never used in Ritemark | `terminalConfigurationService.ts` ignores `terminal.integrated.defaultLocation = editor`; `terminalEditorSerializer.ts` restores old terminal editors into the terminal view instead of editor tabs |
| Titlebar action toolbar | Right side of titlebar; canonical icon list owned by patches 002 + 003 (read those patch headers, not this file) | `titlebarPart.ts` toolbar position + chat/activity menu suppressions |
| `auxiliarybar` keyword in extension package.json | Supported by core | `viewsExtensionPoint.ts`: `case 'auxiliarybar'` added |

## Key technical facts

- **Container ID prefixing.** Extension container IDs get prefixed automatically: `ritemark-ai` becomes `workbench.view.extension.ritemark-ai`. Reference the prefixed form when reaching into VS Code state.
- **View positions are persisted in SQLite.** VS Code caches view positions in `views.customizations` (state DB). The `package.json` value is only the default — once a user (or older Ritemark version) moved a view, the cache wins on next launch. Patch 002's deletion of the cached override is what restores the default reliably.
- **Terminal placement has three control surfaces.** Layout alone is not enough. Guard ALL three: view container location, `terminal.integrated.defaultLocation` setting handling, and terminal editor restore/serialization. Skipping any one lets the terminal end up in the editor tabs after a session restart.
- **Chat icon is a moving target.** Every upstream sync may add a new entry surface (`MenuId.TitleBar`, `MenuId.CommandCenter`, etc.). On each sync, re-grep for `Codicon.chatSparkle` registrations and extend patch 003 if needed. Ignoring this brings the chat icon back into the titlebar between releases.

## When patching layout

1. Always check the cached state, not just the default. View positions in particular.
2. If you remove a UI surface, also remove its registrations across ALL the menu IDs it could be added to.
3. After commenting out code, **always remove unused imports** — VS Code's strict TypeScript build fails after 22 minutes otherwise (see SKILL.md ## Gotchas).

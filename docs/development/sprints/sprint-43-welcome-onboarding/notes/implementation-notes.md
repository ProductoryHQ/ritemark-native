# Implementation Notes

## Current technical baseline

The Welcome implementation now spans two active surfaces:

| Surface | Purpose | Key files |
| --- | --- | --- |
| VS Code core welcome | Hero, recent list, launch check, hero links, split-button UI | `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`, `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStartedGuide.css`, `vscode/product.json` |
| Extension bridge | New document/table/flow actions, health/auth status, settings integration | `extensions/ritemark/src/extension.ts`, `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts`, `extensions/ritemark/src/ritemarkEditor.ts`, `extensions/ritemark/src/flows/FlowStorage.ts` |

## Implemented behavior

| Area | Implemented result |
| --- | --- |
| Startup routing | Empty windows open the Welcome main page instead of the first walkthrough detail |
| Hero CTA | `New document` creates a real markdown draft in `~/Documents/Ritemark` and opens it in the Ritemark editor |
| New table | `New table` creates a real CSV draft in `~/Documents/Ritemark`, prefilled with a 10x20 starter table |
| New flow | Creates a starter flow in a project folder, or shows a guided folder-first modal when no folder is open |
| Launch check | Reads real ChatGPT, Claude, Git, and Node state through `ritemark.getHealthStatus` |
| Hero links | Support/blog links open external URLs with Welcome-specific UTM tags |
| Settings copy | Codex settings no longer reference non-existent Flow node support |

## Important runtime note

- `openToWelcomeMainPage: true` in `vscode/product.json` is required.
- Without it, first-run behavior falls into the default walkthrough detail view instead of the Ritemark Welcome home.

## Cleanup still pending

| Item | Why it still matters |
| --- | --- |
| Release validation | Dev behavior is working, but prod parity still needs to be checked during `1.5.0` testing |

## Follow-up notes

- Claude Code authentication still needs a more user-friendly product flow. Treat this as separate follow-up work, likely in another sprint.
- Codex Flow nodes are not implemented yet. Keep Codex-related UI and copy free of Flow-node claims until that exists.

# Sprint 47: Extension Recommendations - Research Findings

**Branch:** `claude/custom-extensions-marketplace-ctho5`
**Date:** 2026-03-28

---

## Goal

Surface a curated list of hand-picked VS Code extensions to Ritemark users. The full VS Code
extensions marketplace is already functional (serviceUrl configured in product.json), but the
Extensions panel is intentionally hidden from the View menu (patch 003). We need a simple,
focused UI that shows Jarmo-curated recommendations without rebuilding anything in the VS Code
core.

---

## What Already Works

### Marketplace API is Live

`branding/product.json` has a fully configured `extensionsGallery` block:

```json
"extensionsGallery": {
  "serviceUrl": "https://marketplace.visualstudio.com/_apis/public/gallery",
  "cacheUrl": "https://vscode.blob.core.windows.net/gallery/index",
  "itemUrl": "https://marketplace.visualstudio.com/items",
  "controlUrl": "",
  "recommendationsUrl": ""
}
```

VS Code's gallery service is therefore active. Extensions **can** be installed via the
standard VS Code command `workbench.extensions.installExtension`.

### Extensions Panel is Hidden, Not Removed

Patch `003-ritemark-menu-cleanup.patch` comments out the `openCommandActionDescriptor` for the
Extensions viewlet in `extensions.contribution.ts`. The **view container still exists** and is
registered — it is just not reachable from the menu. The VIEWLET_ID (`workbench.view.extensions`)
remains registered.

This means:
- `vscode.commands.executeCommand('workbench.extensions.installExtension', 'publisher.name')` works.
- `vscode.commands.executeCommand('workbench.view.extensions')` could open the full panel (we
  choose not to expose this).
- `vscode.extensions.getExtension('publisher.name')` works for installed-state checks.

### `extensions.ignoreRecommendations` is Set to `true`

In `extensions/ritemark/package.json` `configurationDefaults`:

```json
"extensions.ignoreRecommendations": true
```

This suppresses VS Code's built-in recommendation popups — correct for Ritemark. It does NOT
prevent us from building our own curated recommendations UI.

---

## Approaches Evaluated

### Option A: Use `product.json` `recommendationsUrl`

The `recommendationsUrl` field in `extensionsGallery` is currently empty. In VS Code OSS this
URL is fetched to pull dynamic recommendations from the VS Code backend service. Populating it
would require hosting a compatible recommendations endpoint and reverse-engineering the API
contract. This is high complexity for unclear gain — VS Code's built-in recommendation UI is
also the generic popup we want to avoid. **Rejected.**

### Option B: `.vscode/extensions.json` Workspace Recommendations

VS Code supports a `recommendations` array in `.vscode/extensions.json`. When present, the
Extensions panel shows a "Recommended" tab. Because we hide the Extensions panel, users would
never see this. Also, workspace recommendations require a workspace folder to be open.
**Rejected** — wrong surface.

### Option C: Full Marketplace Rebuild Inside Extension

Building a custom marketplace from scratch (fetching gallery API, rendering search results,
managing pagination). Very high effort, no clear advantage over the built-in view which already
works. **Rejected.**

### Option D: Curated Recommendations Panel (WebviewPanel) - RECOMMENDED

A custom `WebviewPanel` opened via a command (and linked from Settings), rendering a
hand-curated list of extensions. Each card shows:
- Extension name, publisher, short description
- "Install" button (calls `workbench.extensions.installExtension` via postMessage)
- Installed badge (checks `vscode.extensions.getExtension(id)` on load)
- "View in Marketplace" link (opens `itemUrl/publisher.name` externally)

**This is the simplest effective approach.** Key advantages:
- Zero VS Code core changes — no new patches needed.
- The curated list is a simple TypeScript array in the extension source — Jarmo edits one file
  to add/remove/reorder recommendations.
- Uses the same webview infrastructure already established for Settings and the editor.
- Fits into the existing `main.tsx` routing (`data-editor-type="extensions"`) pattern.
- Full control over design — can match Ritemark's clean aesthetic.

---

## Technical Architecture (Option D)

### Extension Side

**New file:** `extensions/ritemark/src/extensions/ExtensionRecommendationsProvider.ts`

- Singleton `WebviewPanel` (same pattern as `RitemarkSettingsProvider`).
- On open: queries installed state for each curated extension via `vscode.extensions.getExtension`.
- Handles messages:
  - `install`: calls `workbench.extensions.installExtension`.
  - `openMarketplace`: calls `vscode.env.openExternal` with the marketplace item URL.
  - `ready`: sends installed states to webview.

**New file:** `extensions/ritemark/src/extensions/curatedExtensions.ts`

- Plain TypeScript array. One object per recommendation:
  ```typescript
  export interface CuratedExtension {
    id: string;           // e.g. "esbenp.prettier-vscode"
    name: string;
    publisher: string;
    description: string;
    iconUrl?: string;     // Static URL or bundled asset
    tags?: string[];      // e.g. ["formatting", "markdown"]
    marketplaceUrl: string;
  }
  ```
- Jarmo edits this file to curate the list.

### Webview Side

**New component:** `extensions/ritemark/webview/src/components/extensions/ExtensionsPanel.tsx`

- Grid of extension cards, each with install/installed state.
- Uses existing Tailwind/shadcn patterns from Settings.
- Triggered from `main.tsx` via `editorType === 'extensions'`.

### Registration in `extension.ts`

```typescript
import { ExtensionRecommendationsProvider } from './extensions/ExtensionRecommendationsProvider';
let extensionRecommendationsProvider: ExtensionRecommendationsProvider | null = null;
// ... in activate():
extensionRecommendationsProvider = new ExtensionRecommendationsProvider(context);
context.subscriptions.push(
  vscode.commands.registerCommand('ritemark.openExtensions', () => {
    extensionRecommendationsProvider?.open();
  })
);
```

### Entry Points

The panel can be opened from multiple places:
1. A command `ritemark.openExtensions` ("Browse Recommended Extensions").
2. A link in the Settings page ("Get recommended extensions").
3. Optionally, a menu item under "Help" or a Welcome page card.

---

## VS Code API Compatibility

| API | Status | Notes |
|-----|--------|-------|
| `vscode.extensions.getExtension(id)` | Available | Returns `undefined` when not installed |
| `executeCommand('workbench.extensions.installExtension', id)` | Available | Triggers standard install flow with progress |
| `vscode.env.openExternal(uri)` | Available | Opens marketplace page in browser |
| `vscode.window.createWebviewPanel(...)` | Available | Same as Settings panel |

The `workbench.extensions.installExtension` command is registered in VS Code core's extension
management contribution and is not removed by any of our patches. It will trigger the standard
install UI including the confirm dialog and progress notification.

---

## Curated Extensions — Initial Candidates

These are extensions commonly used alongside markdown-based note-taking and writing workflows.
Jarmo will make final curation decisions in the sprint plan.

| Extension ID | Name | Category |
|---|---|---|
| `yzhang.markdown-all-in-one` | Markdown All in One | Markdown |
| `DavidAnson.vscode-markdownlint` | markdownlint | Quality |
| `esbenp.prettier-vscode` | Prettier | Formatting |
| `streetsidesoftware.code-spell-checker` | Code Spell Checker | Writing |
| `ms-vsliveshare.vsliveshare` | Live Share | Collaboration |
| `eamodio.gitlens` | GitLens | Git |
| `ms-python.python` | Python | Code |
| `dbaeumer.vscode-eslint` | ESLint | Code |
| `bradlc.vscode-tailwindcss` | Tailwind CSS IntelliSense | Code |
| `humao.rest-client` | REST Client | HTTP |
| TBD | Pencil.dev | Design/Drawing |

---

## Feature Flag Consideration

This feature is:
- Available on all platforms (the marketplace API works cross-platform)
- Not experimental — it is a simple read-only UI with an optional install action
- Not a large download
- Does not need a kill-switch

**Conclusion: No feature flag needed.** The command is always registered; the panel only appears
when explicitly opened.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `workbench.extensions.installExtension` command not available in Ritemark build | Low | Patch 003 only hides the menu entry; the command itself is registered by VS Code's extensions contribution which we do not remove. Can verify with a quick test. |
| Extension icon URLs are slow/unavailable | Low | Don't depend on remote icon URLs; start with text-only cards or use a default icon. Icons are progressive enhancement. |
| Install command triggers full Extensions panel opening | Low | The command only installs; it does not force-open the Extensions view. The panel stays on screen. |
| `vscode.extensions.getExtension` reflects stale data after install | Low | Re-query state after each install message, or listen to `vscode.extensions.onDidChange`. |

---

## Implementation Estimate

| Phase | Effort |
|---|---|
| Extension provider + curated list | ~2 hours |
| Webview panel (React component) | ~3 hours |
| Wiring (package.json, extension.ts, main.tsx) | ~1 hour |
| Polish + testing | ~1 hour |

**Total: ~1 sprint day**

---

## Decision

Proceed with **Option D** (custom WebviewPanel with curated list). This is the simplest path
that delivers real user value with zero VS Code core changes and minimal maintenance overhead.

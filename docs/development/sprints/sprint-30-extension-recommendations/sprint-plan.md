# Sprint 30: Curated Extension Recommendations

## Goal

Add a clean, curated extension recommendations panel that surfaces Jarmo's hand-picked VS Code
extensions to users, with one-click install via the existing marketplace integration.

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - Platform-specific? No — marketplace works on all platforms.
  - Experimental? No — it is a simple read-only panel.
  - Large download? No.
  - Premium? No.
  - Kill-switch needed? No.
  - **Decision: No feature flag.** The command is always registered. The panel only opens when
    explicitly triggered — no background behavior.

## Success Criteria

- [ ] A `ritemark.openExtensions` command opens a webview panel titled "Recommended Extensions"
- [ ] The panel shows a curated list of extensions with name, publisher, and short description
- [ ] Each card has an "Install" button that triggers the standard VS Code install flow
- [ ] Cards show an "Installed" badge for extensions already installed
- [ ] "View in Marketplace" link opens the extension's marketplace page in the browser
- [ ] The curated list lives in one file (`curatedExtensions.ts`) — easy for Jarmo to edit
- [ ] The panel fits Ritemark's design language (Tailwind, clean, minimal)
- [ ] No VS Code core changes (no new patches)
- [ ] The panel is accessible from the Ritemark Settings page ("Get recommended extensions" link)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `curatedExtensions.ts` | Plain TS array of curated extension metadata. Jarmo edits this to curate. |
| `ExtensionRecommendationsProvider.ts` | WebviewPanel provider with install/status logic |
| `ExtensionsPanel.tsx` | React component — grid of extension cards |
| `ritemark.openExtensions` command | Registered in package.json and extension.ts |
| Settings page link | "Get recommended extensions" button in Settings |

## Implementation Checklist

### Phase 1: Extension Backend

- [ ] Create `extensions/ritemark/src/extensions/curatedExtensions.ts` with initial curated list
- [ ] Create `extensions/ritemark/src/extensions/ExtensionRecommendationsProvider.ts`
  - [ ] Singleton WebviewPanel (same pattern as RitemarkSettingsProvider)
  - [ ] On open: query installed state for all curated extensions
  - [ ] Handle `ready` message: send extension list + installed states to webview
  - [ ] Handle `install` message: call `workbench.extensions.installExtension`
  - [ ] Handle `openMarketplace` message: call `vscode.env.openExternal`
  - [ ] Listen to `vscode.extensions.onDidChange` to refresh installed states

### Phase 2: Webview Component

- [ ] Create `extensions/ritemark/webview/src/components/extensions/ExtensionsPanel.tsx`
  - [ ] Grid layout of extension cards
  - [ ] Card: name, publisher, description, tags
  - [ ] Install button / Installed badge per card
  - [ ] "View in Marketplace" link per card
  - [ ] Loading state while fetching initial installed states
  - [ ] Clean Ritemark style (Tailwind, no dev/code aesthetic)
- [ ] Add `editorType === 'extensions'` branch in `main.tsx`

### Phase 3: Wiring

- [ ] Register command `ritemark.openExtensions` in `extensions/ritemark/package.json`
- [ ] Register provider and command in `extensions/ritemark/src/extension.ts`
- [ ] Add activation event `onCommand:ritemark.openExtensions` to `package.json`
- [ ] Add "Get recommended extensions" button to the Settings page
  (`webview/src/components/settings/RitemarkSettings.tsx`)

### Phase 4: Curated List

- [ ] Populate `curatedExtensions.ts` with initial set (pending Jarmo's final curation decisions)
  - Markdown All in One (`yzhang.markdown-all-in-one`)
  - markdownlint (`DavidAnson.vscode-markdownlint`)
  - Code Spell Checker (`streetsidesoftware.code-spell-checker`)
  - Prettier (`esbenp.prettier-vscode`)
  - GitLens (`eamodio.gitlens`)
  - Additional extensions per Jarmo's direction

## Status

**Current Phase:** 1 - RESEARCH (complete)
**Approval Required:** YES — waiting for Jarmo's approval to proceed to Phase 3 (DEVELOP)

## Approval

- [ ] Jarmo approved this sprint plan

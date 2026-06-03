# Sprint 78: Browser UX — `browser_snapshot` tool + Annotation-Mode Screenshot Chip

Track: Plain full track
Branch: claude/github-issues-sprint-78-EDKa4
Status: Phase 5 (CLEANUP — awaiting webview bundle rebuild on build machine)

## Goal

Ship two focused browser UX improvements: add `browser_snapshot` to the MCP toolset so agents can re-observe page state without mixing servers (#88), and replace the misleading URL chip in the Composer with a screenshot preview chip when annotation mode is active (#73).

## Linked Issues

- #88 — Add `browser_snapshot` to `mcp__ritemark_browser__*` MCP toolset
- #73 — Show screenshot preview chip in Composer (not URL chip) when annotation mode is active

## Feature Flag Check

No new feature flags needed. Both changes extend existing flagged subsystems (`browser-agent-control` already gates the MCP server; annotation mode is already handled by the browser context pipeline). No user-visible setting toggle required.

## Success Criteria

- [ ] `mcp__ritemark_browser__browser_snapshot` is callable and returns the same ARIA outline as `browser_navigate` (URL + title + page summary)
- [ ] Agents declaring `allowed-tools: mcp__ritemark_browser__*` can call `browser_snapshot` without playwright fallback
- [ ] When annotation mode is active, the Composer shows a screenshot preview chip (thumbnail + dismiss) instead of the URL chip
- [ ] Screenshot preview chip is visually identical to a pasted image chip (same 56x56 thumbnail + x button)
- [ ] When annotation mode is NOT active, the existing URL chip behaviour is unchanged
- [ ] Pre-commit hook passes

## Implementation Checklist

### Issue #88 — `browser_snapshot` MCP tool

- [x] Add `BrowserSnapshot` command ID to patch 010 (`ritemarkBrowserActionFeature.ts`)
- [x] Implement `BrowserSnapshotAction` in patch 010 — calls `playwrightService.getSummary()` on the active tab (no consent prompt — snapshot is read-only; mirrors the `getActiveSummary` bridge)
- [x] Add `browserSnapshot()` function in `BrowserActionTools.ts`
- [x] Register `browser_snapshot` tool in `browserMcpServer.ts` (returns same text block as `browser_navigate`)
- [x] Add `ritemark_browser_snapshot` to `codexBrowserTools.ts` (dynamic tool schema + dispatcher case)
- [x] Update `BROWSER_TOOL_BARE_NAMES` and `CODEX_BROWSER_TOOL_NAMES`
- [x] Add test coverage for `browser_snapshot` in `browserActionTools.test.ts`

### Issue #73 — Screenshot preview chip in Composer

- [x] Add `screenshotPreview` field to `currentBrowserContext` shape in webview store (`{ dataUrl: string } | null`)
- [x] In `UnifiedViewProvider._sendActiveBrowserContext()`: when `annotationMode === true`, capture a fresh viewport screenshot and include it as `screenshotPreview.dataUrl` in the `active-browser-changed` message
- [x] Added screenshot cache (`_annotationScreenshotCache`) to avoid re-capturing on every 1500ms poll when URL hasn't changed
- [x] In `ChatInput.tsx`: when `annotationMode` is active (`currentBrowserContext.annotationMode && currentBrowserContext.screenshotPreview`), render a screenshot thumbnail chip instead of the URL globe chip
- [x] Screenshot chip uses the same 56×56 `<img>` + `×` dismiss button as the existing attachment strip (visually identical)
- [x] Dismissing the screenshot chip sets `hideBrowserContext = true` (same as dismissing the URL chip)

### Pending on build machine

- [ ] `cd extensions/ritemark/webview && npm run build` — rebuild webview bundle to include ChatInput.tsx changes
- [ ] Verify pre-commit hook passes (`npm run compile` in extensions/ritemark)

## Stretch: OpenCode model picker ignores already-configured BYOK keys

**Issue (reported by Jarmo, 2026-06-03):** The agent picker's OpenCode section shows
"Add API keys to use OpenCode" even when a Gemini (Google AI) key is already saved and
showing "Configured" in Settings. Expected: when a provider key exists, the picker shows
that provider's models (e.g. Gemini models for a Google key).

**Root cause:** The AI sidebar receives BYOK provider flags (`acpProviders`) only once,
in the `agent:config` message at webview load (`UnifiedViewProvider.ts`). Saving a key in
Settings happens in a *different* webview (`RitemarkSettingsProvider.ts` → `secrets.store()`)
and nothing notifies the AI sidebar — the `acp-providers` refresh message exists but is
never triggered by key changes. The picker stays stale until a full window reload.

**Fix:** `UnifiedViewProvider` subscribes to `SecretStorage.onDidChange`. When one of the
four BYOK secret names (`openai-api-key`, `google-ai-key`, `anthropic-api-key`,
`openrouter-api-key`) is stored or deleted, it calls `_sendAcpProviders()` so the sidebar's
model picker updates immediately — same pattern as the existing `apiKeyChanged` listener.

### Stretch checklist

- [x] Add `BYOK_SECRET_KEYS` constant to `src/acp/acpKeyEnv.ts` (single source for the four SecretStorage names) + export via `src/acp/index.ts`
- [x] Subscribe to `secrets.onDidChange` in `UnifiedViewProvider` constructor → `_sendAcpProviders()` on BYOK key change; dispose listener in `dispose()`
- [x] Test coverage in `acpKeyEnv.test.ts` for `BYOK_SECRET_KEYS`
- [x] Extension compiles; no webview change needed (webview already handles the `acp-providers` message)

### Stretch success criteria

- [ ] Saving a Google AI key in Settings makes Gemini models appear in the OpenCode picker section without reloading the window
- [ ] Removing the last BYOK key makes the picker fall back to the "Add API keys to use OpenCode" prompt without reloading

## Approval

- [x] Jarmo pre-approved this sprint (solo-build authorization granted)

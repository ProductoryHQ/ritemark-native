# Sprint 67 Technical Feasibility Audit — Browser-Aware AI Chat

_Date:_ 2026-05-11  
_Status:_ Feasible, but **not extension-only** if we want DOM + screenshot + browser-menu annotation control.

## Executive Summary

The broader Sprint 67 scope is technically viable because the integrated browser already has most of the hard primitives:

- Browser tab models expose URL/title/focus/navigation state in workbench code.
- Existing internal browser tools already read page state via `IPlaywrightService.getSummary(pageId)`.
- Existing internal browser tools already capture screenshots via `IBrowserViewModel.captureScreenshot(...)`.
- Browser menu/toolbar actions are registered through `MenuId.BrowserActionsToolbar`, the same place where DevTools lives.
- Existing sharing/consent infrastructure exists through `IBrowserViewModel.setSharedWithAgent(...)` and `sharedWithAgent` state.

The missing piece is **not capability**, but **bridge shape**: the Ritemark extension host cannot directly access workbench-only services like `IBrowserViewWorkbenchService` / `IPlaywrightService`. Sprint 67 should add a small Ritemark workbench command/API bridge that exposes active browser context to the extension side.

## Key Findings

### 1. BrowserView model already exposes useful active-page metadata

Relevant files:

- `vscode/src/vs/workbench/contrib/browserView/common/browserView.ts`
- `vscode/src/vs/workbench/contrib/browserView/common/browserEditorInput.ts`
- `vscode/src/vs/workbench/contrib/browserView/electron-browser/browserEditor.ts`

`IBrowserViewModel` already includes:

- `id`
- `url`
- `title`
- `favicon`
- `focused`
- `visible`
- `loading`
- `onDidNavigate`
- `onDidChangeTitle`
- `onDidChangeFocus`
- `onDidChangeVisibility`
- `captureScreenshot(...)`
- `setSharedWithAgent(...)`
- `sharedWithAgent`
- `getConsoleLogs()`
- `getElementData(...)`
- `getFocusedElementData()`

This means URL/title/navigation/focus state does not need to be reverse-engineered from tabs if the bridge runs inside workbench code.

### 2. DOM/page summary already exists via Playwright service

Relevant files:

- `vscode/src/vs/platform/browserView/common/playwrightService.ts`
- `vscode/src/vs/platform/browserView/node/playwrightService.ts`
- `vscode/src/vs/platform/browserView/node/playwrightTab.ts`
- `vscode/src/vs/workbench/contrib/browserView/electron-browser/tools/readBrowserTool.ts`

Existing internal read tool:

- tool id: `read_page`
- implementation: `ReadBrowserTool.invoke(...)`
- core call: `this.playwrightService.getSummary(params.pageId)`

`PlaywrightTab.getSummary(...)` returns structured text including:

- `Page Title: ...`
- `URL: ...`
- active dialogs / file chooser state
- recent console/event logs
- `Snapshot: ...` from `page.ariaSnapshot({ mode: 'ai' })`

This is very close to what Sprint 67 needs for normal browser-aware mode. It is already compact-ish and model-oriented, but Sprint 67 should still add hard caps and prompt framing before injecting it into Claude/Codex.

### 3. Screenshot path already exists

Relevant files:

- `vscode/src/vs/workbench/contrib/browserView/electron-browser/tools/screenshotBrowserTool.ts`
- `vscode/src/vs/workbench/contrib/browserView/common/browserView.ts`
- `vscode/src/vs/platform/browserView/common/browserView.ts`

Existing internal screenshot tool:

- tool id: `screenshot_page`
- uses `browserViewWorkbenchService.getBrowserViewModel(pageId)`
- then `browserViewModel.captureScreenshot({ pageRect: bounds })`
- returns `image/jpeg` data

For Sprint 67 annotation mode, the implementation can reuse `captureScreenshot(...)` directly in a workbench bridge command. It should support viewport screenshot first; element screenshot can remain follow-up unless cheap.

### 4. Browser menu placement is feasible

Relevant files:

- `vscode/src/vs/platform/actions/common/actions.ts`
- `vscode/src/vs/workbench/contrib/browserView/electron-browser/features/browserDevToolsFeature.ts`
- `vscode/src/vs/workbench/contrib/browserView/electron-browser/browserViewActions.ts`

DevTools is registered as an `Action2` with:

- command id: `workbench.action.browser.toggleDevTools`
- menu id: `MenuId.BrowserActionsToolbar`
- group: `actions`
- order: `3`

Therefore Jarmo’s UX preference is feasible: add an “Annotation Mode” / “Share Page with AI” action in the same `BrowserActionsToolbar` menu/toolbar area as DevTools. It can be `toggled` through a context key similar to `browserDevToolsOpen`.

### 5. Existing consent/sharing model should be reused, not reinvented

Relevant files:

- `vscode/src/vs/workbench/contrib/browserView/common/browserView.ts`
- `vscode/src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorChatFeatures.ts`

`BrowserViewModel.setSharedWithAgent(true)` already:

- checks `IAgentNetworkFilterService` before sharing
- prompts “Share with Agent?”
- stores optional “Don’t ask again” preference
- calls `playwrightService.startTrackingPage(this.id)`
- sets `sharedWithAgent`

`browserEditorChatFeatures.ts` also has a separate warning for attaching untrusted page content. Sprint 67 should align with these existing consent semantics. Recommended interpretation:

- Normal mode may use bounded page summary **only if page is shared/allowed**, or should trigger the existing consent flow before first DOM-content sharing.
- Annotation mode should require explicit browser-menu toggle/action and should reflect `sharedWithAgent` state.
- Chat chip should mirror state, not be the primary toggle.

### 6. Extension-host injection points are straightforward after bridge exists

Relevant files:

- Claude: `extensions/ritemark/src/agent/AgentRunner.ts`
- Codex: `extensions/ritemark/src/views/UnifiedViewProvider.ts`
- Webview chip: `extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx`
- Webview store: `extensions/ritemark/webview/src/components/ai-sidebar/store.ts`

Existing injection points:

- Claude uses `buildClaudeSystemAppend(...)` once when starting SDK session, and `buildClaudeTurnPrompt(...)` per turn.
- Codex currently prepends `CODEX_TURN_REMINDER` and active-file context in `_handleCodexExecution(...)`.
- `ChatInput.tsx` already has an active-file chip pattern (`hideActiveFile`, `showActiveFileChip`) that can be mirrored.

Recommendation: inject browser context **per turn**, not only at Claude session start, because browser state changes during a long chat session.

## Feasible Implementation Shape

### Workbench-side bridge

Add a Ritemark-owned browser context contribution under the browserView workbench area, e.g.:

```text
vscode/src/vs/workbench/contrib/browserView/electron-browser/features/ritemarkBrowserContextFeature.ts
```

Register internal commands callable via `vscode.commands.executeCommand(...)` from the extension host:

```ts
workbench.action.browser.getActiveContext
workbench.action.browser.getActiveSummary
workbench.action.browser.captureActiveViewport
workbench.action.browser.toggleAnnotationMode
workbench.action.browser.getAnnotationMode
```

Returned data should be plain JSON / buffers only, for extension-host compatibility.

Suggested DTO:

```ts
type RitemarkBrowserContext = {
  pageId: string;
  url: string;
  title: string;
  focused: boolean;
  visible: boolean;
  sharedWithAgent: boolean;
  annotationMode: boolean;
  summary?: string;
  summaryTruncated?: boolean;
  screenshot?: { mimeType: 'image/jpeg'; base64: string };
  error?: string;
};
```

### Active browser lookup

Inside workbench, use `IEditorService.activeEditorPane`. If active pane is a `BrowserEditor`, its `model` gives direct access to page ID, URL, title, and screenshot. This is more reliable than extension-host `tabGroups` heuristics.

### Normal mode

- Browser menu action “Share Browser Context with AI” / “Annotation Mode” manages sharing state.
- Extension asks bridge for active context before each AI turn.
- Bridge returns URL/title + bounded summary if sharing is enabled/allowed.
- Extension injects a compact browser-context block into Claude/Codex prompts.

### Annotation mode

- Toggle lives in BrowserActionsToolbar near DevTools if feasible.
- When enabled for current/active browser tab, bridge includes viewport screenshot and richer visible-page metadata.
- The chat chip mirrors this with e.g. `Browser: <title> · Annotation on`.
- If screenshot attachment cannot be sent to a runtime, bridge writes temp image or returns base64, and injection includes a clear limitation/path. Codex already accepts image data URLs in `turnStart`; Claude SDK path needs verification during implementation.

## Risks / Unknowns

| Risk | Notes | Recommended mitigation |
|---|---|---|
| Extension cannot access workbench services directly | Confirmed architecture boundary | Add workbench command bridge |
| Existing `getSummary()` may be large | It uses ARIA snapshot and can include logs | Add hard cap and truncation marker before prompt injection |
| Consent semantics could be confusing | Existing `sharedWithAgent` means agent can read/interact; Sprint 67 is read/context | Reuse existing dialog text if acceptable, or add Ritemark-specific copy for browser context sharing |
| Screenshot support differs by runtime | Codex image data URL path exists; Claude SDK path must be checked | Implement text/summary first, then verify image attachments per runtime |
| Active/focused browser tracking | Extension `tabGroups` is best-effort; workbench `activeEditorPane instanceof BrowserEditor` is reliable | Put active lookup in workbench bridge |
| Browser menu toggle persistence | Need decide per-tab vs per-turn | Prefer per-tab sharing state + per-turn chat chip dismiss; annotation can reset after send if extension owns turn semantics |

## Recommendation

Proceed with the expanded Sprint 67, but treat it as a **full app / workbench patch sprint**.

Recommended implementation order:

1. Add workbench bridge command for active browser URL/title/pageId/focus only.
2. Add bridge summary using existing `IPlaywrightService.getSummary(pageId)` behind existing sharing consent.
3. Add extension-side `BrowserContextStore` wrapper that calls bridge before each turn.
4. Inject compact context into Claude and Codex per turn.
5. Add chip mirror in ChatInput.
6. Add BrowserActionsToolbar annotation toggle near DevTools.
7. Add viewport screenshot path for annotation mode.
8. Run dev smoke with local fixture + external site + Claude/Codex content question.

## Decision

**Feasible:** Yes.  
**Extension-only:** No, not for DOM/screenshot/menu-quality implementation.  
**Best path:** Reuse existing BrowserView + Playwright internals, expose a minimal Ritemark bridge, and keep prompt context bounded/consented.

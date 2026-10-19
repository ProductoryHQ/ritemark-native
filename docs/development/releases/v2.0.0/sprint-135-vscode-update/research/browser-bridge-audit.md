# Browser bridge audit (2c): patches 009 and 010 on VS Code 1.142.0

Read-only audit for Sprint 135, Workstream 2c. Pin: 1.117.0 (`10c8e557`). Target: 1.142.0 (`d956e8a6`). Line numbers below are in the target unless they say "pin".

How the rejects were measured: the three upstream files at the target were copied to a scratch repository with the pin's blobs added, then 009 and 010 were applied with `git apply --reject`, and 009 again with `--3way`. Result: 009 rejects 7 of 9 hunks (6 in workbench `common/browserView.ts`, 1 in `browserView.contribution.ts`). 010, on top of what 009 applied, rejects 9 of 12 (5 and 4). `--3way` leaves 7 conflict regions in `common/browserView.ts` and 1 in the contribution. This matches `notes/drift.md`.

## Summary

The re-cut is moderate work, not a redesign. Every command name, argument and result shape the extension uses can stay the same. Three upstream changes drive it:

1. **Sharing is now an "audience" on the main-process view, not Playwright page tracking.** `sharedWithAgent` / `onDidChangeSharedWithAgent` are gone. `IPlaywrightService.startTrackingPage` / `isPageTracked` are gone. The model has `sharingState` and `setSharedWithAgent()` calls `setAudience()`.
2. **`sharingState` says `Unavailable` whenever VS Code's own chat is off** (no active default chat agent, `chat.agent.enabled` off, or `workbench.browser.enableChatTools` off). At the pin the model's flag did not depend on chat. Ritemark's AI does not use VS Code's chat. So Ritemark must read the audience itself (`ritemarkSharedWithAgent`), not `sharingState`. This is the one design decision in the re-cut.
3. **Playwright is per session.** `getSummary` and `invokeFunction` take a `sessionId` first. Ritemark uses one fixed session ID for reading and acting.

Mechanical changes: `browserViewActions.ts` is deleted (`BrowserActionCategory` moved to `browserEditor.ts`). The editor contribution hooks are renamed. The `BrowserEditorInput` constructor changed. The toolbar groups changed.

Upstream now has its own chat tools for the browser and its own `.html` opener. It does not offer a drop-in replacement for the bridge without changing the extension's contract (see §3). One 010 hunk is dropped because upstream does it now: the `generateUuid` import.

No blocker found.

### Per-hunk table

Classes are from spec R2. "Applies" is the result on 1.142.0 before any fix.

| Hunk | File | What it does | Applies? | Class | Re-cut in one line |
|---|---|---|---|---|---|
| 009-1 | platform `common/browserView.ts` | 6 command IDs in `BrowserViewCommandId` | yes, offset +20 | **carried** | none |
| 009-2 | workbench `common/browserView.ts` | interface: `annotationMode`, `onDidChangeAnnotationMode` | no | **re-cut** | next to `sharingState` / `onDidChangeSharingState`; also add `ritemarkSharedWithAgent` |
| 009-3 | same | interface: `setAnnotationMode` | no | **re-based** | after `setSharedWithAgent(): Promise<IBrowserViewModel \| undefined>` |
| 009-4 | same | interface: `ritemarkSharesWithoutAsking`, `shareWithAgentAnswered` | no | **re-based** | at the interface's end, after `setDevice` |
| 009-5 | same | class: `_annotationMode` field and emitter | no | **re-based** | after `_lastSharingState`; emitter after `_onDidChangeSharingState` |
| 009-6 | same | class: `annotationMode` getter | no | **re-cut** | plus a `ritemarkSharedWithAgent` getter that reads `_audiences` |
| 009-7 | same | class: `ritemarkSharesWithoutAsking`, `shareWithAgentAnswered`, clear annotation on unshare, `setAnnotationMode` | no | **re-cut** | `setAudience` instead of Playwright tracking; the 1.142 Allow path; the unshare hook moves to an audience listener |
| 009-7b (new) | same, constructor | listener on `_remoteEvents.onDidChangeAudiences` | n/a | **re-cut** (replaces the `_setSharedWithAgent` part of 009-7) | one `_register(...)` line after upstream's own audience listener |
| 009-8 | `browserView.contribution.ts` | `import './features/ritemarkBrowserContextFeature.js'` | no | **re-based** | after `browserRemoteFeatures.js` |
| 009-9 | new `features/ritemarkBrowserContextFeature.ts` | the 6 commands, annotation context key, Browser Recent push | yes (new file), does not compile | **re-cut** | new import paths, renamed hooks, session ID, `ritemarkSharedWithAgent`, toolbar group |
| 010-1 | platform `common/browserView.ts` | 7 command IDs | yes, offset +20 | **carried** | none |
| 010-2 | workbench `common/browserView.ts` | interface: `sharedWithAgentForControl` and its event | no | **re-based** (on re-cut 009-2) | beside 009-2's lines |
| 010-3 | same | interface: `setSharedWithAgentForControl` | no | **re-based** | beside 009-3 |
| 010-4 | same | class: control field and emitter | no | **re-based** | beside 009-5 |
| 010-5 | same | class: control getter | no | **re-based** | beside 009-6 |
| 010-6 | same | class: revoke control on unshare; `setSharedWithAgentForControl` | no | **re-cut** | revoke goes into 009-7b's handler; check the model `setSharedWithAgent` returns |
| 010-7 | `browserView.contribution.ts` | `import { generateUuid }` | yes, but duplicates line 18 | **dropped, upstream** | proof: target line 18 imports it; applying 010 gives two imports (lines 7 and 19) |
| 010-8 | same | `import { IEditorService }` | no | **re-based** | after line 23 (`logBrowserOpen`); its anchor `import './browserViewActions.js'` is gone |
| 010-9 | same | `import './features/ritemarkBrowserActionFeature.js'` | no | **cascade** | its anchor is 009-8's line; place after it |
| 010-10 | same | constructor gets `@IEditorService` | no | **re-based** | after `@ITelemetryService telemetryService` (line 71) |
| 010-11 | same | `.html` / `.htm` open in the browser by default, reusing a tab | no | **re-cut** | `getOrCreateLazy` instead of `createInstance(BrowserEditorInput, …)`; new NLS key; after upstream's loop (line 146) |
| 010-12 | new `features/ritemarkBrowserActionFeature.ts` | control consent and the 7 agent actions | yes (new file), does not compile | **re-cut** | new import path, `sessionId` argument, `ritemarkSharedWithAgent` |

After the re-cut, 009 has 10 hunks in 4 files and 010 has 11 hunks in 4 files. The file lists do not change.

## 1. What upstream changed in `browserView` (pin → target)

105 files changed under `workbench/contrib/browserView` and `platform/browserView` (`git diff --stat`, +24,463 / −3,746).

### Files moved or deleted

- `electron-browser/browserViewActions.ts` is **deleted**. Its actions moved into `features/*` (for example `browserNavigationFeatures.ts`, `browserTabManagementFeatures.ts`). `BrowserActionCategory` now lives in `electron-browser/browserEditor.ts:41`. A new `BrowserActionGroup` enum is at `browserEditor.ts:44-50`.
- `electron-browser/siteInfoWidget.ts` and `platform/.../electron-main/browserViewElementInspector.ts` are deleted.
- New features: `webContentsViewRendererFeature`, `browserNavigationFeatures`, `browserWelcomeFeature`, `browserFavoritesFeature`, `browserHistoryFeature`, `browserPermissionsFeature`, `browserEditorErrorFeatures`, `browserEditorEmulationFeatures`, `browserAutoReloadFeatures`, `browserSearchFeatures`, `browserRemoteFeatures` (`browserView.contribution.ts:26-42`).
- New platform files: `common/browserHistory.ts`, `common/browserPermissions.ts`, `common/browserChatToolReferenceNames.ts`, `electron-main/browserSessionHistory.ts`, `browserSessionPermissions.ts`, `browserSessionRemote.ts`, `browserViewInspector.ts`, `browserViewFrameInspector.ts`, `browserViewEmulator.ts`, `browserViewAccessibility.ts`.

### The model (`IBrowserViewModel`, workbench `common/browserView.ts:396-480`)

- Created by `BrowserViewWorkbenchService` with its initial state (`createBrowserView`, `getOrCreateLazy` at `browserViewWorkbenchService.ts:413`). The pin's `initialize(create)` and `setInitialURL` are gone.
- Events come from emitters the service fills (`createBrowserViewEventEmitters`, lines 484-508; the model reads `this._remoteEvents`, line 580). The pin's `browserViewService.onDynamicDid*(id)` getters are gone.
- New: `owner` (`user`, or `agent` with a `sessionId`, platform `browserView.ts:240-242`), `host`, `associatedResource`, `history`, `permissions`, `device`, `getAccessibilitySnapshot()` (line 459).
- Removed: `sharedWithAgent`, `onDidChangeSharedWithAgent`, `onDidRequestNewPage`, `getElementData`, `getFocusedElementData`.

### Events Ritemark uses

Kept, same shapes: `onDidNavigate` (`IBrowserViewNavigationEvent { url, title, canGoBack, canGoForward, certificateError }`, platform line 368), `onDidChangeTitle` (`{ title }`, line 423), `onDidChangeFavicon` (`{ favicon }`, line 427), `onDidChangeLoadingState`, and the model's `url`, `title`, `favicon`, `error`, `storageScope`, `loading`, `focused`, `visible`. New: `onWillNavigate` (line 429), `onDidChangeOwner`, `onDidRequestPermission`.

### Sharing with the agent

- `BrowserViewSharingState` (lines 73-82): `Shared`, `Available`, `BlockedByNetworkPolicy`, `Unavailable`.
- The getter (lines 757-768) returns `Unavailable` first when `isSharingAvailable` is false. Then it returns `Shared` when the view has an agent audience.
- `isSharingAvailable` (`browserViewWorkbenchService.ts:99-112`) needs `chatIsEnabled`, `chat.agent.enabled` and `workbench.browser.enableChatTools`. `chatIsEnabled` is set only when a default chat agent has an implementation (`chatAgents.ts:322`, `408-409`).
- Sharing is stored in the main process as audiences: `IBrowserViewAgentAudience { type: 'agent', sessionId? }` (platform lines 247-252), set with `IBrowserViewService.setAudience(id, audience, enabled)` (line 618; main side at `browserViewMainService.ts:193-199`).
- `setSharedWithAgent(shared)` (lines 962-1050) now returns `Promise<IBrowserViewModel | undefined>`. The Allow path is: (a) the network-policy notice when `sharingState` is `BlockedByNetworkPolicy`; (b) when the view is not directly shareable (network filter on and storage not `Agent`), it asks "Open a New Tab for Sharing?" and returns a **new** isolated tab's model; (c) the "Share with Agent?" dialog unless `browserView.shareWithAgent.dontAskAgain` is stored (same key and PROFILE scope as the pin, line 960); (d) `setAudience(id, { type: 'agent' }, true)`.
- The main process revokes agent audiences only when the network filter turns on (`browserViewMainService.ts:535-552`). Chat being off revokes nothing.
- The pin also hid the upstream share button when chat was off (pin `browserEditorChatFeatures.ts:162-166`, `220`), but the pin's model flag did not depend on chat (pin `common/browserView.ts:365`, `580-645`). The target keeps the button rule (`browserEditorChatFeatures.ts:341`) and adds chat gating to the model's state.

### Playwright

- `IPlaywrightService` (platform `common/playwrightService.ts:36-117`) lost `startTrackingPage`, `stopTrackingPage`, `isPageTracked`, `getTrackedPages`, `openPage` and `onDidChangeTrackedPages`. Every method now takes `sessionId` first.
- Each session gets its own CDP group whose filter is `{ audience: { type: 'agent', sessionId } }` (`node/playwrightService.ts:140-151`). A view joins when one of its audiences matches with `matchesBrowserViewAudience(filter, viewAudience)` (`common/browserViewGroup.ts:37-41`). A user share sets `{ type: 'agent' }` with no `sessionId`, which is a wildcard (platform lines 262-265). So a shared page is visible to **any** session ID, Ritemark's included.
- Sessions are dropped after 30 minutes idle (`node/playwrightService.ts:32`) and when a chat session ends.
- `aria-ref=<ref>` locators are still how upstream clicks and types (`tools/clickBrowserTool.ts:103-104`, `tools/typeBrowserTool.ts:128-129`). Function code is still compiled with `vm.compileFunction` and called as `(page, ...args)`.

### The editor and its contributions

- `BrowserEditorContribution.subscribeToModel(model, store)` → `onModelAttached(model, store, isNew)`. `clear()` → `onModelDetached()` (`browserEditor.ts:66-89`; pin `browserEditor.ts:67-90`). New optional members: `prerenderInput`, `widgets`, `urlRenderers`, `urlSuggestionProviders`.
- `BrowserEditor.registerContribution`, `editor.model` and `onDidChangeModel` stay (`browserEditor.ts:404-431`).
- `MenuId.BrowserActionsToolbar` stays. Its items now use `BrowserActionGroup` and all render inline (`browserNavigationFeatures.ts:120-131`). Developer Tools is `Tools`, order 2 (`browserDevToolsFeature.ts:58-62`). "Add to Chat" is `Tools`, order 1 (`browserEditorChatFeatures.ts:1106-1118`). The pin's `'actions'` group is gone.
- `BrowserEditorInput`'s constructor now needs a model-resolving callback (`browserEditorInput.ts:88-99`). Inputs come from `IBrowserViewWorkbenchService.getOrCreateLazy`.

### Opening `.html`

Upstream now registers `file:/**/*.{html,htm,mhtml,mht}` for the browser editor (`browserView.contribution.ts:111-146`), at **`option`** priority. The label is `localize('browser.htmlEditorLabel', "Integrated Browser")` (line 116). The tab is resource-backed (`associatedResource`):
- reopening the same file reuses the tab (`browserEditorInput.ts:298-301`);
- the address bar is read-only (`browserNavigationFeatures.ts:114`);
- a load outside the file opens a child tab instead (`electron-main/browserView.ts:764-775`).

Upstream also adds `workbench.action.browser.openFile` ("Open in Integrated Browser").

### Chat tools and context

The pin already had chat tools. The target makes them session-aware and adds `list_browser_pages`. The tools are `open_browser_page`, `read_page`, `screenshot_page`, `navigate_page`, `click_element`, `drag_element`, `hover_element`, `type_in_page`, `run_playwright_code`, `handle_dialog` and `list_browser_pages` (`tools/browserTools.contribution.ts:95-119`). They are `ILanguageModelToolsService` tools, registered only while `isSharingAvailable` (lines 82-92). Shared pages are also pushed to chat as workspace context `browserView.trackedPages` (lines 185-192). New chat commands: `AddScreenshotToChat`, `AddAreaScreenshotToChat`, `AddFullPageScreenshotToChat`, `AddElementCommentToChat` (platform lines 47-53).

### History

Upstream keeps its own browser history and favorites: the model's `history` store, `electron-main/browserSessionHistory.ts`, the `ShowHistory` command and suggestions in the address bar (`browserHistoryFeature.ts`). They are not exposed to extensions. They live next to Ritemark's Browser Recent. Whether to show both belongs to the surfaces audit (2d), not to this bridge.

## 2. Hunk by hunk: what each does, where its anchor went, the re-cut

Paths are short: "workbench `browserView.ts`" means `src/vs/workbench/contrib/browserView/common/browserView.ts`.

### 009 (context bridge)

**009-1: carried.** Six IDs between `ToggleDevTools` and `// Storage`. The enum grew above them, so the hunk lands at offset +20 and applies cleanly.

**009-2: re-cut.** It added `annotationMode` after `sharedWithAgent`, and `onDidChangeAnnotationMode` after `onDidChangeSharedWithAgent`. Both anchors are gone. Re-cut in `IBrowserViewModel`:
```ts
	readonly isDirectlyShareable: boolean;                 // upstream, line 418
	/** Ritemark: the page has an agent audience. Unlike sharingState, this does not depend on VS Code's chat. */
	readonly ritemarkSharedWithAgent: boolean;
	readonly annotationMode: boolean;
	…
	readonly onDidChangeSharingState: Event<BrowserViewSharingState>;  // upstream, line 427
	readonly onDidChangeAnnotationMode: Event<boolean>;
```

**009-3: re-based.** `setAnnotationMode(annotate: boolean): Promise<void>;` goes after `setSharedWithAgent(shared: boolean): Promise<IBrowserViewModel | undefined>;` (line 466). Only the anchor's return type changed.

**009-4: re-based.** Its anchor (`getElementData`, `getFocusedElementData`) was removed upstream. Put the two Ritemark members at the end of the interface, after `setDevice(...)` (line 479). The members do not change.

**009-5: re-based.** `private _annotationMode = false;` goes after `_lastSharingState` (line 530). The emitter pair goes after `_onDidChangeSharingState` (lines 561-562). The anchors `_isEphemeral`, `_sharedWithAgent` and `_onDidChangeSharedWithAgent` are gone.

**009-6: re-cut.** The anchor `get sharedWithAgent()` is gone. Add after `get isRemoteSession()` (line 756):
```ts
	get ritemarkSharedWithAgent(): boolean { return this._audiences.some(audience => audience.type === 'agent'); }
	get annotationMode(): boolean { return this._annotationMode; }
```

**009-7: re-cut.** Its anchors (`_setSharedWithAgent`, `_cancellationIdPool`) are gone, and so is `playwrightService` in the model. Place the methods after `setSharedWithAgent` (before `_updateSharingState`, line 1052):
```ts
	get ritemarkSharesWithoutAsking(): boolean {
		return this.storageService.getBoolean(BrowserViewModel.SHARE_DONT_ASK_KEY, StorageScope.PROFILE) === true;
	}

	/** Ritemark (Sprint 134, R20): what Allow does in setSharedWithAgent, without the dialog. */
	async shareWithAgentAnswered(withoutAsking: boolean): Promise<void> {
		if (this.ritemarkSharedWithAgent) {
			return;
		}
		// The network policy's notice first. This is the sharingState getter's own test,
		// because sharingState reads Unavailable while VS Code's chat is off.
		if (!this.isDirectlyShareable && this._url && !this.agentNetworkFilterService.isUriAllowed(URI.parse(this._url))) {
			const uri = URI.parse(this._url);
			await this.dialogService.info(localize('browserView.shareBlocked.title', "Cannot Share with Agent"), this.agentNetworkFilterService.formatError(uri));
			return;
		}
		if (!this.isDirectlyShareable) {
			// The network filter is on: upstream shares an isolated copy and asks first. Keep upstream's path.
			await this.setSharedWithAgent(true);
			return;
		}
		if (withoutAsking) {
			this.storageService.store(BrowserViewModel.SHARE_DONT_ASK_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
		}
		this.telemetryService.publicLog2<IntegratedBrowserShareWithAgentEvent, IntegratedBrowserShareWithAgentClassification>(
			'integratedBrowser.shareWithAgent', { shared: true, dontAskAgain: withoutAsking });
		await this.browserViewService.setAudience(this.id, { type: 'agent' }, true);
	}

	/** Ritemark: annotation mode (and 010's control) need the share; losing the share clears them. */
	private _ritemarkSharingChanged(): void {
		if (!this.ritemarkSharedWithAgent && this._annotationMode) {
			this._annotationMode = false;
			this._onDidChangeAnnotationMode.fire(false);
		}
	}

	async setAnnotationMode(annotate: boolean): Promise<void> {
		if (annotate && !this.ritemarkSharedWithAgent) {
			const shared = await this.setSharedWithAgent(true);   // upstream's dialog stays here (Sprint 134)
			if (shared !== this || !this.ritemarkSharedWithAgent) {
				return;   // denied, blocked, or shared as a copy in another tab
			}
		}
		if (annotate !== this._annotationMode) {
			this._annotationMode = annotate;
			this._onDidChangeAnnotationMode.fire(annotate);
		}
	}
```
The behaviour change from main's 009: the pin's notice fired on any blocked address. At the target, only a view that is not directly shareable can be blocked (the getter's rule, lines 764-766). A view in `Agent` storage enforces the policy itself. This follows upstream's Allow path, which is what `update-vscode.sh` step 4 asks for. Record it in `notes/rebase.md`.

**009-7b (new hunk): re-cut** of the "clear annotation on unshare" part of 009-7. The pin hooked `_setSharedWithAgent`. At the target, sharing changes arrive as audience events. Add in the constructor after upstream's audience listener (lines 726-729):
```ts
		this._register(this._remoteEvents.onDidChangeAudiences.event(() => this._ritemarkSharingChanged()));
```
Upstream's listener is registered first, so `_audiences` is already updated when this runs.

**009-8: re-based.** The import list grew (lines 26-42). Put `import './features/ritemarkBrowserContextFeature.js';` after `import './features/browserRemoteFeatures.js';` (line 42). `--3way` shows this as the only conflict in the file. Keep both sides.

**009-9: re-cut.** The new file applies, but it does not compile at the target. Changes, all inside the file:
1. `import { BrowserActionCategory } from '../browserViewActions.js'` → import `BrowserActionCategory` and `BrowserActionGroup` from `'../browserEditor.js'`. Merge this with the two existing `browserEditor.js` imports.
2. In both contributions: `protected override subscribeToModel(model, store)` → `protected override onModelAttached(model, store, _isNew)`, and `override clear()` → `override onModelDetached()`. `RitemarkBrowserHistoryContribution` keeps sending one `navigate` on every attach, as before.
3. `dtoFromModel`: `sharedWithAgent: model.ritemarkSharedWithAgent`. The DTO field name does not change.
4. `GetActiveBrowserSummaryAction`: test `model.ritemarkSharedWithAgent`; call `playwrightService.getSummary(RITEMARK_PLAYWRIGHT_SESSION, model.id)`. Add `export const RITEMARK_PLAYWRIGHT_SESSION = 'ritemark';` to this file, so 010 imports the same session. Use one constant: summaries and actions must share a session so the `aria-ref` refs match. Do not use upstream's `'<default>'` (`browserToolHelpers.ts:31-33`), so Ritemark never shares Playwright state with VS Code's chat.
5. `ToggleBrowserAnnotationModeAction` menu: `group: 'actions', order: 4` → `group: BrowserActionGroup.Tools, order: 3` (after Add to Chat 1 and Developer Tools 2). The `'actions'` group no longer exists, so the item would otherwise sort to the end on its own.
6. `EnsureActiveBrowserSharedAction`: `model.sharedWithAgent` → `model.ritemarkSharedWithAgent` (both places). Keep `await model.setSharedWithAgent(true)` on the share-without-asking path; with the stored choice it opens no dialog (lines 1005-1046). Return `dtoFromModel(model)` as today.
7. Keep the line `const RITEMARK_BROWSER_DID_NAVIGATE_COMMAND = 'ritemark.browser.didNavigate';` exactly as it is. `browserNavigationRecorder.test.ts:273-281` reads the patch text for it.
8. Optional: `ephemeral: isInMemoryStorageScope(model.storageScope)` instead of `=== BrowserViewStorageScope.Ephemeral` (platform line 473). The target adds an `Agent` storage scope, which is also in memory. It is used by tabs that VS Code's chat opens, and by the isolated copies a share opens when the network filter is on. Without this change Recent records those tabs. This is a choice, not a fix. If taken, note it in `notes/rebase.md`.

### 010 (action bridge)

**010-1: carried.** Seven IDs after 009-1's lines, at offset +20.

**010-2 to 010-5: re-based.** They use 009's lines as context, and upstream removed `sharedWithAgent` beside them. After 009's re-cut they go next to it: the interface members after `annotationMode` / `onDidChangeAnnotationMode` and `setAnnotationMode`; the field and emitter after 009-5's; the getter after `annotationMode`. Their text does not change.

**010-6: re-cut.** The hunk had two parts. (a) Revoking control in `_setSharedWithAgent` moves into `_ritemarkSharingChanged`:
```ts
		if (!this.ritemarkSharedWithAgent && this._sharedWithAgentForControl) {
			this._sharedWithAgentForControl = false;
			this._onDidChangeSharedWithAgentForControl.fire(false);
		}
```
(b) In `setSharedWithAgentForControl`, the same guard as `setAnnotationMode`: `const shared = await this.setSharedWithAgent(true); if (shared !== this || !this.ritemarkSharedWithAgent) { return; }`.

**010-7: dropped, upstream.** The target already imports `generateUuid` at line 18 for its own `.html` opener. Applying the hunk makes a second import (scratch apply: lines 7 and 19), which does not compile.

**010-8: re-based.** `import { IEditorService } from '../../../services/editor/common/editorService.js';` goes after line 23. Its anchor `import './browserViewActions.js'` was deleted.

**010-9: cascade.** It failed because 009-8's line was missing. Put it after 009-8's import.

**010-10: re-based.** The constructor now injects `IBrowserViewWorkbenchService` and `ITelemetryService`; `IInstantiationService` is gone (lines 68-72). Add `@IEditorService editorService: IEditorService,` last.

**010-11: re-cut.** It registers `**/*.{html,htm}` at `default` priority, reuses a tab already showing the file, and opens a plain address tab. `instantiationService.createInstance(BrowserEditorInput, { id, url })` no longer compiles (`browserEditorInput.ts:88-95`). Re-cut, after upstream's loop (line 146):
```ts
		// Ritemark (Sprint 69): .html/.htm open in the browser by default, as a plain page; reuse a tab showing the same file.
		editorResolverService.registerEditor(
			'**/*.{html,htm}',
			{ id: BrowserEditorInput.EDITOR_ID, label: localize('ritemark.browser.htmlEditorLabel', "Ritemark Browser"), priority: RegisteredEditorPriority.default },
			{ canSupportResource: resource => resource.scheme === Schemas.file && /\.html?$/i.test(resource.path), singlePerResource: false },
			{
				createEditorInput: ({ resource, options }) => {
					const fileUrl = resource.toString();
					const existing = editorService.editors.find((input): input is BrowserEditorInput => input instanceof BrowserEditorInput && input.url === fileUrl);
					if (existing) {
						return { editor: existing, options: { ...options, pinned: true } };
					}
					const browserInput = browserViewWorkbenchService.getOrCreateLazy({ id: generateUuid(), url: fileUrl });
					void browserInput.resolve();
					return { editor: browserInput, options: { ...options, pinned: true } };
				},
			},
		);
```
- Rename the NLS key. `'browser.htmlEditorLabel'` is now upstream's key in the same file with a different message ("Integrated Browser", line 116). Two messages for one key in one file is unsafe. Whether the build rejects it was not tested.
- Upstream's entry has a different glob, so the resolver keeps both entries apart (it merges only the same id **and** glob, `editorResolverService.ts:496-526`). Ours wins on priority (`findMatchingEditors` sorts by priority, lines 654-663).
- Alternative, not recommended for this sprint: drop 010-11 and raise upstream's `.html`/`.htm` entry to `default` (one line in its loop, or `"*.html": "workbench.editor.browser"` in `branding/product.json`'s `editorAssociations`, which 013 applies). That changes behaviour. The tab becomes resource-backed: a read-only address bar, links outside the file open new tabs, and the AI's navigate on such a tab is redirected to a child tab (see Risks). It needs the Experience lead's view, so it is not a rebase item.

**010-12: re-cut.** The new file applies but does not compile. Changes:
1. `BrowserActionCategory` from `'../browserEditor.js'` (as 009-9).
2. Import `RITEMARK_PLAYWRIGHT_SESSION` from `'./ritemarkBrowserContextFeature.js'`. Pass it first to `playwrightService.getSummary(...)` (navigate, snapshot) and `playwrightService.invokeFunction(...)` (click, fill, type, scroll).
3. `BrowserSnapshotAction`: `model.sharedWithAgent` → `model.ritemarkSharedWithAgent`.
4. `ensureControlConsent`, the four function bodies (`aria-ref=` locators), `isNavigationAbortError` and the argument and result types stay as they are.
5. `getOrCreateBrowserModelFromEditorService` still compiles (`BrowserViewUri.forId`, `openEditor({ resource, options: { viewState: { url } } })` is how upstream's own Open command does it, `browserTabManagementFeatures.ts:336`). Optional: open in `await browserViewService.getPreferredGroup()` instead of `ACTIVE_GROUP`, as upstream's Open does (line 296). That follows `workbench.browser.newTabPlacement` and modal editors.

## 3. Can we use upstream's API instead?

| Ritemark adds | Upstream at 1.142.0 | Use it? |
|---|---|---|
| Read-share flag and sharing (009) | `setSharedWithAgent` / audiences | **Yes, inside the patch.** `shareWithAgentAnswered` and the stored-choice path now call upstream's `setAudience` / `setSharedWithAgent`. The flag reads audiences, not `sharingState` (chat gating). |
| Page summary (`getActiveSummary`, `agentSnapshot`) | `read_page` chat tool; `model.getAccessibilitySnapshot()` | **No.** `read_page` is a language-model tool. Extensions could reach it only through `vscode.lm.invokeTool`. It is registered only while VS Code's chat is on (`browserTools.contribution.ts:82-92`) and returns `LanguageModelToolResult` parts. `getAccessibilitySnapshot` has no `aria-ref` refs, so the agent could not act on what it read. |
| Screenshot (`captureActiveViewport`) | `screenshot_page` tool; `AddScreenshotToChat` | **No**, for the same reasons. `model.captureScreenshot` is still the right call (JPEG by default, platform lines 203-212). |
| Agent actions (010) | `navigate_page`, `click_element`, `type_in_page`, `run_playwright_code`… | **No.** Same contract change. They are chat-gated and take an explicit `pageId` where Ritemark's commands act on the active tab. Upstream's helpers confirm that `aria-ref=` and `invokeFunction` are still the right building blocks. |
| Navigation push for Browser Recent | Upstream's own history (main process) | **No.** It is not exposed to extensions. The push keeps using `onDidNavigate` / `onDidChangeTitle` / `onDidChangeFavicon`, which kept their shapes. |
| `.html` opens in the browser (010-11) | `file:/**/*.{html,…}` at `option` priority, resource-backed | **Not this sprint.** The behaviour differs (§2, 010-11). The `generateUuid` import is upstream's now (010-7, dropped). |

Using upstream's chat tools would change every command name, argument and result the extension uses. It would also tie Ritemark's AI to VS Code's chat being on. So the bridge stays, and the re-cut builds on upstream's sharing primitives.

## 4. The extension-facing contract

Everything below can stay identical after the re-cut. The extension needs no change.

| # | Name | Direction | Payload | Used in | After the re-cut |
|---|---|---|---|---|---|
| 1 | `workbench.action.browser.getActiveContext` | ext → workbench | () → `{ pageId, url, title, focused, visible, loading, sharedWithAgent, annotationMode }` or `{ error }` | `BrowserContextStore.ts:4,125` | same; `sharedWithAgent` from audiences |
| 2 | `workbench.action.browser.getActiveSummary` | ext → workbench | () → DTO + `summary`, or DTO + `error` when not shared | `BrowserContextStore.ts:5,249` | same; session `'ritemark'` |
| 3 | `workbench.action.browser.captureActiveViewport` | ext → workbench | () → DTO + `screenshot { mimeType: 'image/jpeg', base64 }` | `BrowserContextStore.ts:6,270`; `UnifiedViewProvider.ts:3172` | same |
| 4 | `workbench.action.browser.toggleAnnotationMode` | toolbar, palette | () → DTO | toolbar item "Include Screenshot in AI Chat Context" | same; group `Tools` |
| 5 | `workbench.action.browser.getAnnotationMode` | ext → workbench | () → DTO | none found in `extensions/ritemark/src` | same |
| 6 | `workbench.action.browser.ensureActiveBrowserShared` | ext → workbench | () or `{ pageId, answer: 'share' \| 'notNow', withoutAsking }` → DTO + `needsAnswer` / `stale` | `BrowserContextStore.ts:7,161,192` | same |
| 7 | `ritemark.browser.didNavigate` | workbench → ext | `{ kind: 'navigate' \| 'title' \| 'favicon', pageId, url, title, failed, ephemeral, favicon? }` | `browserNavigationRecorder.ts:14`; registered `extension.ts:896`; patch-text test | same (unless 009-9 item 8 is taken: `ephemeral` then also covers `Agent` storage) |
| 8 | `ritemarkBrowserAnnotationMode` | context key | boolean | the toggle's `toggled` only; not in `package.json` | same |
| 9 | `workbench.action.browser.ensureActiveBrowserControlShared` | ext → workbench | () → `{ pageId, url, title }` or `+ error` | `BrowserContextStore.ts:8,225`; `BrowserActionTools.ts:18` | same |
| 10–15 | `…agentNavigate` `{ url?, type? }`, `…agentClick` `{ ref?, selector?, button?, dblClick? }`, `…agentFill` `{ ref?, selector?, value }`, `…agentType` `{ text?, key? }`, `…agentScroll` `{ direction?, amount?, ref?, selector? }`, `…agentSnapshot` () | ext → workbench | → `{ pageId?, url?, title?, summary?, error? }` | `BrowserActionTools.ts:19-24` → `runtime/ritemarkTools.ts` → all three runtimes and the OpenCode MCP adapter | same; session `'ritemark'` |
| 16 | `.html` / `.htm` editor resolver (id `workbench.editor.browser`, label "Ritemark Browser", `default`) | implicit | n/a | `extension.ts:878-882` (comment); `ritemark.browser.openAsText` bypasses it with `'default'` (`extension.ts:979`) | same behaviour; label key renamed |

The extension also calls upstream commands that are not in the patches: `workbench.action.browser.open` with `{ url, openToSide }`, `goBack`, `goForward`, `reload` and `openExternal` (`IntegratedBrowser.ts:3-7`). All still exist. `Open` still takes `string | { url?, openToSide?, reuseUrlFilter? }` (`browserTabManagementFeatures.ts:265-296`).

Found while reading, and not caused by the update: `BrowserContextStore.isControlConsented()` reads `sharedWithAgentForControl`, which no command returns (`dtoFromModel` has no such field). Its only caller, `ensureControlConsentForActiveTab`, is not called anywhere in `src`. The agent actions ask for control consent themselves, so nothing breaks. No rebase action.

## 5. Risks, and what S26 and S55–S57 must check

### Risks

1. **The chat gate (high, design).** If the re-cut reads `sharingState` instead of the audiences, the AI gets no page context whenever VS Code's chat is off: Copilot Chat disabled or not yet active, or `chat.agent.enabled` / `workbench.browser.enableChatTools` off. Sprint 134's S55 starts from "a fresh profile with Claude signed in", where Copilot may be off. Use `ritemarkSharedWithAgent`. Test with Copilot Chat disabled and with it enabled.
2. **Playwright sessions (medium).** The first call in a session creates a CDP group and connects Playwright, so the first summary is slower. After 30 idle minutes the session is dropped (`node/playwrightService.ts:32`), and `aria-ref` refs from before stop working. The AI must snapshot again. The tool texts already say to re-observe; check that the error reads clearly.
3. **Audience timing (low, unproven).** `shareWithAgentAnswered`, `setAnnotationMode` and `setSharedWithAgentForControl` read `ritemarkSharedWithAgent` right after `await setAudience(...)`. Main fires the audience event before its call returns (`electron-main/browserView.ts:653-666`), and the service passes it to the model at once (`browserViewWorkbenchService.ts:491`). So `_audiences` should already be updated, but this was not run. If a test shows it is not, wait for one `onDidChangeAudiences` before reading.
4. **Network filter on (low, policy only).** With `chat.agent.networkFilter` on (default off, `chat.shared.contribution.ts:1570-1573`), sharing a normal tab opens an isolated copy in a new tab with a new `pageId`. The sheet's question was about the old page, so the chip stays "not shared". This is upstream's model. Note it; don't fix it in this sprint.
5. **Two `.html` entries (low).** "Open With…" may list both "Ritemark Browser" and "Integrated Browser". A tab opened through upstream's entry or `workbench.action.browser.openFile` is resource-backed: there `agentNavigate`'s `loadURL` to another address opens a child tab (`electron-main/browserView.ts:764-775`), and the action reads the old page. Check that our entry is the default; leave the rest for a follow-up.
6. **Compile traps (caught by the type-check).** The `generateUuid` duplicate (010-7), the deleted `browserViewActions.js`, the renamed hooks, `getSummary` / `invokeFunction` arity, `model.sharedWithAgent`, and the `BrowserEditorInput` constructor all fail the compile. None of them fails silently. The NLS key collision (010-11) might not fail the compile. Rename it.
7. **Toolbar placement (low).** Without the group change, the annotation toggle lands at the end of the toolbar, where the responsive toolbar may fold it first.
8. **Browser Recent and in-memory tabs (low).** Tabs in `Agent` storage are recorded unless 009-9 item 8 is taken.
9. **Upstream history next to Recent (surfaces, not bridge).** Upstream's own History and Favorites now appear in the browser's toolbar and address bar. Audit 2d decides whether Ritemark shows them.

### S26 after the rebase (the page in the AI, a click, a fill, Recent)

Run on a fresh profile with Claude signed in. Run it **twice**: once with Copilot Chat disabled and once with it enabled.
- Open a page from the +, answer Share on the AI's sheet, and ask about the page. The chip shows "shared". The trace shows the URL, title and summary (`getActiveSummary` returns `summary`, not "not shared").
- Ask the AI to click a link. The control-consent dialog appears once for the tab. After Allow the page navigates. The tool result has the new page's summary.
- Ask it to fill a field. The value appears. Typing into nothing focused returns the "no editable element" error.
- `browser_snapshot` works on the shared page. On an unshared tab it returns the "not shared" error.
- Ask it to open a URL with no browser tab open. A tab opens on the desk, not in a side group, and the summary comes back.
- Browser Recent shows each page with its title and icon. A private (ephemeral) tab adds nothing.
- Run once with each runtime: Claude Code, Codex, and OpenCode (through the MCP adapter).
- The screenshot toggle sits in the browser toolbar beside Developer Tools. Turning it on shows the screenshot chip. With Copilot Chat enabled, "Stop Sharing with Agent" on upstream's button clears the toggle and the chip.
- A `.html` file from Documents opens in the browser, a second open reuses the tab, and "Open as Text" opens text.

### S55–S57 after the rebase (the share question on the AI's sheet)

- **S55:** no dialog opens for the question. Picking Share this page shares the page (`ritemarkSharedWithAgent` true, chip shared). With Copilot Chat disabled too.
- **S56:** Not now shares nothing, and the page is not asked about again in the session. With the box ticked, `browserView.shareWithAgent.dontAskAgain` is stored (PROFILE). The next page is shared without a question and without upstream's dialog (the stored-choice path, lines 1005-1046). This survives a restart.
- **S57:** before an answer, the turn has no address, title or content (`getActiveContext` says `sharedWithAgent: false`, `buildTurnContext` returns null). Moving to another page makes an old answer `stale`, and the old page is not shared.
- **Also:** the screenshot toggle on an unshared page still shows upstream's "Share with Agent?" dialog (Sprint 134 kept it), and Deny leaves the toggle off.

### `update-vscode.sh` step 4

Its line about `setSharedWithAgent` / `shareWithAgentAnswered` was right to warn: upstream changed the Allow path. After the rebase the line could name what to compare against: `setSharedWithAgent`'s notice, the isolated copy, the stored choice and `setAudience`. It could also name the `sharingState` chat gate that `ritemarkSharedWithAgent` works around. This audit did not edit the script.

# Sprint 131 Technical Plan

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Spec:** [spec.md](./spec.md) · **Audit:** [research/current-state-audit.md](./research/current-state-audit.md)

Code below shows proposed shapes, not final code. If the code needs to differ, this plan is updated first.

## Architecture Overview

```
 Electron main (upstream)           Workbench renderer (patch 009)                  Extension host (extensions/ritemark)
 ────────────────────────           ──────────────────────────────                  ────────────────────────────────────
 did-navigate ┐                     BrowserEditor pane (one per group)
 did-navigate-in-page ├─ onDidNavigate ─►  RitemarkBrowserHistoryContribution
 did-fail-load┘                       (BrowserEditorContribution, same file
 page-title-updated ── onDidChangeTitle ─►  as the annotation contribution)
                                        │  executeCommand('ritemark.browser.didNavigate',
                                        │    { kind, pageId, url, title, failed, ephemeral })
                                        └─────────────────────────────────────────────► BrowserNavigationRecorder.handle()
                                                                                         (validate → filter → dedupe)
                                                                                              │ record(url, title) / setTitle(url, title)
                                                                                              ▼
                                                                                         BrowserHistoryStore (globalState, MRU 25)
                                                                                              │ onDidChange
                                                                                              ▼
                                                                                         BrowserPanelProvider → "Recent" webview
                                                                                           (titles; prune missing file:// on show)
```

This is the first **push** from the workbench into the extension in the browser bridge. Every other bridge command (009, 010) is a pull: the extension calls a `workbench.action.browser.*` command. Using an extension-owned command for the push keeps the contract to one string and needs no new API proposal or IPC channel. `architecture.md` records it (W5).

Release tier: **shell** by path (`patches/vscode/009-*`). The extension half is extension-tier by path, but it depends on the patch. It cannot ship ahead of the v1.14.0 app: `release-extension-preflight.sh` diffs against the last app-release tag and refuses when `patches/` changed, and every extension update requires its own app version (`minimumAppVersion`).

## W0: Dev environment and Phase 0 probes (first, before extension code)

1. Sprint worktree `.claude/worktrees/sprint-131-browser-recent` on branch `sprint-131-browser-recent` from `origin/main` (memory: sprint worktree mechanics).
2. `vscode/` by APFS copy-on-write clone from the main checkout, then a canonical patched tree: `npm ci` in `extensions/ritemark`, `git -C vscode reset --hard HEAD && git -C vscode clean -fd -e extensions/ritemark && ./scripts/apply-patches.sh`, then `npm run transpile-client` in `vscode/` (memory: CoW-clone vscode for worktree dev). Disk check first (27 GB free on 2026-10-12).
3. Write the W1 contribution first, with a temporary trace of every event it sends. Run the patched workbench with the **unmodified** extension (command not registered yet). This proves that a missing listener is silent (S27) and records the raw event stream for:
   - **P1:** typo host (`.invalid`). Is `model.error` set when the navigate listener runs? (S13)
   - **P2:** `getTitle()` at `did-navigate` for a page with a title, without one, and for a `file://` page. (R5, S21, S23)
   - **P3:** Cmd-click link into a background tab, then switch to it. Is `model.url` the final address on first show? (S10)
   - **P4:** Reload Window with a browser tab open. Is the first send delivered after activation, with no notification? (S11)
   - **P5:** Back/forward, reload, `#anchor`, `pushState`. Which events arrive, with which URLs? (S4, S14, S15, S3)
4. Write the observed sequences into `research/phase0-findings.md`. A probe that fails within the rules changes W2's rules; record it. A probe that needs a different patch shape (P1 or P4) goes to Jarmo before W1 is finalised (see spec Open Questions).

## W1: Patch 009, the navigation bridge

**File:** `vscode/src/vs/workbench/contrib/browserView/electron-browser/features/ritemarkBrowserContextFeature.ts` (created by 009; no other file changes).

```ts
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { BrowserViewCommandId, BrowserViewStorageScope } from '../../../../../platform/browserView/common/browserView.js';

/** Extension command that keeps Browser Recent (extensions/ritemark/src/browser/browserNavigationRecorder.ts). */
const RITEMARK_BROWSER_DID_NAVIGATE_COMMAND = 'ritemark.browser.didNavigate';

interface IRitemarkBrowserNavigationDto {
	readonly kind: 'navigate' | 'title';
	readonly pageId: string;
	readonly url: string;
	readonly title: string;
	readonly failed: boolean;     // main-frame load failed (did-fail-load path)
	readonly ephemeral: boolean;  // tab browses in an ephemeral (private) session
}

class RitemarkBrowserHistoryContribution extends BrowserEditorContribution {
	constructor(
		editor: BrowserEditor,
		@ICommandService private readonly commandService: ICommandService,
		@ILogService private readonly logService: ILogService,
	) {
		super(editor);
	}

	protected override subscribeToModel(model: IBrowserViewModel, store: DisposableStore): void {
		// A tab opened in the background loaded while no pane listened; report what it shows now.
		// The extension ignores a repeat of the page's last address (tab switches).
		this.send(model, 'navigate', model.url, model.title);
		store.add(model.onDidNavigate(e => this.send(model, 'navigate', e.url, e.title)));
		store.add(model.onDidChangeTitle(e => this.send(model, 'title', model.url, e.title)));
	}

	private send(model: IBrowserViewModel, kind: 'navigate' | 'title', url: string, title: string): void {
		if (!url) {
			return;
		}
		const dto: IRitemarkBrowserNavigationDto = {
			kind,
			pageId: model.id,
			url,
			title,
			failed: model.error !== undefined,
			ephemeral: model.storageScope === BrowserViewStorageScope.Ephemeral,
		};
		this.commandService.executeCommand(RITEMARK_BROWSER_DID_NAVIGATE_COMMAND, dto).catch(err => {
			this.logService.trace('[Ritemark] Browser Recent: navigation not delivered', err);
		});
	}
}

BrowserEditor.registerContribution(RitemarkBrowserHistoryContribution);
```

Notes:
- `failed` relies on the model's own loading-state listener running first. The main process fires the loading event before the navigate event for a failed load, and both arrive in order over the same IPC channel (audit). P1 proves it.
- Every editor pane gets its own contribution instance (one pane per group, auxiliary windows included), so every visible browser tab is covered.
- The header of `009-ritemark-browser-context-bridge.patch` gets a seventh item ("pushes top-level navigations and title changes to the extension for Browser Recent, Sprint 131"), and its `Purpose` line widens accordingly.
- Regenerate 009 from the patched tree with the same 4-file list (`git -C vscode diff` over exactly 009's four paths, with `--` paths; the new file via `git add -N` first). Never regenerate from a working-tree subset (PATCH-RULES §8).

Verification (S29):
- `grep '^diff --git' patches/vscode/009-*.patch | wc -l` → 4, same paths as before.
- `git diff main -- patches/vscode/009-*.patch` shows changes only inside the new-file hunk and the header.
- From pristine (`reset --hard` + `clean -fd -e extensions/ritemark`): `./scripts/apply-patches.sh --dry-run` (read the Can apply / Conflicts counts, not Check 8's label), then a real apply, then a second run of `apply-patches.sh` on the patched tree.
- `npm run compile-check-ts-native` in `vscode/` (tsgo) is clean; no "declared but never read".
- Patch 010 applies on top (covered by the full-stack apply above).

## W2: Extension recorder and store

### New: `extensions/ritemark/src/browser/browserNavigationRecorder.ts`

No `vscode` import, so it is unit-testable without a stub.

```ts
export const DID_NAVIGATE_COMMAND = 'ritemark.browser.didNavigate';
export const MAX_URL_LENGTH = 8192;
export const MAX_TITLE_LENGTH = 300;
export const TITLE_SETTLE_MS = 10_000;
export const SETTLE_MS = 1_000;
const MAX_TRACKED_PAGES = 200;

export interface BrowserNavigationEvent {
  kind: 'navigate' | 'title';
  pageId: string;
  url: string;
  title: string;
  failed: boolean;
  ephemeral: boolean;
}

/** Validates the command argument; undefined for anything malformed (R8). */
export function parseNavigationEvent(raw: unknown): BrowserNavigationEvent | undefined;

/** http/https/file only, WHATWG-normalized (`new URL(raw).href`), ≤ MAX_URL_LENGTH (R3, R4). */
export function normalizeHistoryUrl(raw: string): string | undefined;

/** One line, trimmed, ≤ MAX_TITLE_LENGTH; undefined when empty or just the address (R5). */
export function cleanTitle(raw: string, url: string): string | undefined;

/** Same document = equal ignoring the #fragment (R3). */
export function sameDocument(a: string, b: string): boolean;

export interface HistorySink {
  record(url: string, title?: string): Promise<void>;
  setTitle(url: string, title: string): Promise<void>;
}

export class BrowserNavigationRecorder {
  /** pageId → the tab's current document: address, navigation time, title, waiting timer; capped at MAX_TRACKED_PAGES (oldest dropped). */
  private readonly tabs = new Map<string, TabState>();

  constructor(private readonly sink: HistorySink, private readonly clock: RecorderClock = realClock) {}

  handle(raw: unknown): void;
  dispose(): void;   // records every waiting navigation
}
```

Rules in `handle` (order matters):

| Event | Rule | Spec |
|---|---|---|
| any | `parseNavigationEvent` fails → ignore | R8 |
| any | `ephemeral` → ignore | R3 |
| navigate | `failed` → ignore | R3 |
| navigate | `normalizeHistoryUrl` undefined (scheme, length, unparsable) → ignore | R3 |
| navigate | `sameDocument(url, tab.url)` → no new entry; handled as a title update (below) | R3 (reload, tab switch, `#anchor`) |
| navigate | otherwise → a waiting tab navigation that has not settled is dropped (R1 revised); new tab state `{ url, at: now, title: cleanTitle(...), recorded: false }`; after `SETTLE_MS` (1 s) → `record(url, title)`, `recorded = true` | R1, R2 |
| title (and same-document navigate) | tab not tracked, or `!sameDocument(url, tab.url)`, or `now - tab.at > TITLE_SETTLE_MS` → ignore | R5 |
| title (and same-document navigate) | `cleanTitle(...)` empty → ignore; tab still waiting → its title is replaced; already recorded → `setTitle(tab.url, title)` | R5 |
| dispose | every waiting navigation is recorded at once | R1 revised |

*(revised 2026-10-12 after Phase 0 — [phase0-findings.md](./research/phase0-findings.md))*: the 1 s settle step and the wider `cleanTitle` (the scheme-less address and a local file's name are Chromium fallbacks) come from P2 and the meta-refresh observation. The timer is injected (`schedule(fn, ms) → cancel`) so the tests need no real time.

An in-page navigation that changes more than the fragment (pushState) is a new entry and restarts the title window, so single-page sites get the route's title.

Loopback hosts (`localhost`, `127.0.0.1`, `[::1]`) get no special case anywhere in these rules: they pass the scheme check as `http`/`https` and are recorded like any web page (R7, S26). A unit test pins this so a later "skip dev servers" change is a deliberate spec change, not a drift.

### Changed: `extensions/ritemark/src/browser/BrowserHistoryStore.ts`

- `BrowserHistoryEntry` gains `title?: string`. Entries saved by earlier versions stay valid.
- `record(url, title?)`: dedupe by `historyKey(url)` (`normalizeHistoryUrl(url) ?? url`, without its `#fragment`; revised 2026-10-12 after QA, S31), so entries saved by earlier versions merge (R4, S19). A missing title keeps the entry's existing title, so revisiting a page does not briefly drop its title.
- New `setTitle(url, title)`: updates the matching entry in place. No reorder, no `visitedAt` change, no write when unchanged.
- New `pruneMissingFiles(isMissing: (url: string) => Promise<boolean>)`: checks only `file:` entries and does at most one write (R6).
- `getAll`, `remove`, `clear`, the cap of 25 and the storage key are unchanged.

### Changed: `extensions/ritemark/src/extension.ts`

- Next to the store wiring (`:811-823`): create `BrowserNavigationRecorder(browserHistoryStore)` and register `DID_NAVIGATE_COMMAND` → `recorder.handle(arg)`. The command is not added to `package.json` `contributes.commands`, so it stays out of the Command Palette. Activation is already `*`.
- Remove the `setBrowserHistoryStore(...)` call and its dispose entry.

### Changed: `extensions/ritemark/src/browser/IntegratedBrowser.ts`

- Remove `historyStore`, `setBrowserHistoryStore` and the `record` call in `openInIntegratedBrowser` (`:10-14, 36`). Opening is unchanged; the page is recorded by the bridge when it loads (R2). This moves the record source rather than removing a feature: every open that used to record still records.

## W3: The Recent panel

**File:** `extensions/ritemark/src/browser/BrowserPanelProvider.ts`

- `describe(url, title?)`:

| Address | With title | Without title (as today) |
|---|---|---|
| `http(s)` | name = title; description = host + path (path omitted when `/`) | name = host incl. a non-default port (revised 2026-10-12, QA); description = path |
| `file:` | name = title; description = decoded path | name = basename; description = decoded path |

- `RecentItem` stays `{ url, name, description, visitedAt }`; the row HTML and CSS do not change. Tooltip stays the full URL.
- Prune on show: on the webview's `ready` message and on `onDidChangeVisibility` when it becomes visible, call `history.pruneMissingFiles(fileIsMissing)`. The store's `onDidChange` re-posts the items.
- `fileIsMissing(url)`: `vscode.workspace.fs.stat(vscode.Uri.parse(url))`. It returns true only for `vscode.FileSystemError` with `code === 'FileNotFound'`; every other error keeps the entry (R6, S25).

No new UI elements. The empty-state text ("Pages you visit in Ritemark Browser appear here.") becomes true and stays.

## W4: Tests and QA

Unit tests (`npx tsx`, `node:assert`, same style as `browserActionTools.test.ts`), added to the `test` script in `extensions/ritemark/package.json`:

- `src/browser/browserNavigationRecorder.test.ts`: parse/validate (S28); scheme allowlist, failed, ephemeral, overlong (S12, S13, S16–S18); fragment-only, reload and tab switch (S14, S15, S10 repeat); pushState as a new entry (S3); 1 s settle drops a redirect's intermediate page and flushes on dispose (S30); loopback hosts recorded like any page (R7, S26); title window with an injected clock (S21, S22); address-as-title (S23); tracked-page cap; **contract test**: reads `patches/vscode/009-ritemark-browser-context-bridge.patch` and asserts it contains `'ritemark.browser.didNavigate'` (R8).
- `src/browser/BrowserHistoryStore.test.ts` (in-memory `Memento` + `vscode.EventEmitter` stub): legacy entry merge (S19); cap 25 (S20); title kept on revisit; `setTitle` no reorder and no write when unchanged; `pruneMissingFiles` removes only "missing" `file:` entries and keeps others (S24, S25).
- `npm run compile` (tsc + esbuild) clean.

Dev-instance QA (CDP via the `ritemark-automation` skill; isolation rules from memory: own CDP port, short `--user-data-dir` under `$TMPDIR`, fresh `--extensions-dir`, quit only your own instance):

- Local fixture server (`python3 -m http.server` in a scratch dir) serving: a titled page, an untitled page, a page with `#section` links, a `pushState` page, a ticking-title page and a `meta refresh` redirect. The same server covers S26 (`localhost`).
- Plus one real site for S1/S5 (`ritemark.app`, `http://github.com`).
- Drive: type in the address bar (workbench DOM), click links in the page target, Cmd-click for a background tab (S10), Reload Window (S11), delete a fixture file (S24).
- Read: evaluate in the `ritemark.browserView` webview target (`purpose=webviewView`) and collect each `.item`'s name, description and `data-url` after every step; screenshot the panel at the end. Evidence goes into `qa-evidence.md` in this folder.
- Run the full scenarios S1–S26 against the patched build. S27 is exercised in W0 (patched workbench, unmodified extension). S18, S25 and S28 are unit-level.

Windows: the patch is platform-neutral TypeScript and the extension code uses no platform paths except `file:` URIs via `vscode.Uri`. The Windows CI build compiles the patch once it is on main. The Windows check (S1, S2, S6, S10 with Ctrl-click, S24) is part of the v1.14.0 release test on the signed installer; it is added to the release plan's test list.

## W5: Documentation

- `docs/development/architecture.md`: browser subsystem, one paragraph on the workbench→extension push (`ritemark.browser.didNavigate`), its DTO and the "rules in the extension" split; update-log row for the sprint.
- `CLAUDE.md` patch table: 009's purpose row gains "pushes navigations to Browser Recent". (The current row text is inaccurate anyway: it says "integrated browser panel"; it should say "extension host".) The Codex harness picks it up through the harness equalizer.
- `.claude/skills/vscode-development/PATCH-RULES.md` needs no change.
- Release notes draft line for v1.14.0, and the v1.8.6 "Known issues" entry for #195 marked fixed in the v1.14.0 notes.
- Release plan row and test-list line (this PR adds the row; the sprint updates its status).
- Issue #195: comment with the plan link; closes with the v1.14.0 release (post-release issue sweep).

## Files to change

| File | Change | Tier |
|---|---|---|
| `patches/vscode/009-ritemark-browser-context-bridge.patch` | New contribution in the file 009 creates; header | shell |
| `extensions/ritemark/src/browser/browserNavigationRecorder.ts` | **New** (rules, validation) | extension (depends on shell) |
| `extensions/ritemark/src/browser/browserNavigationRecorder.test.ts` | **New** | — |
| `extensions/ritemark/src/browser/BrowserHistoryStore.test.ts` | **New** | — |
| `extensions/ritemark/src/browser/BrowserHistoryStore.ts` | title, normalized dedupe, `setTitle`, `pruneMissingFiles` | extension |
| `extensions/ritemark/src/browser/BrowserPanelProvider.ts` | titles in rows, prune on show | extension |
| `extensions/ritemark/src/browser/IntegratedBrowser.ts` | drop the record call and its plumbing | extension |
| `extensions/ritemark/src/extension.ts` | register the command; drop `setBrowserHistoryStore` | extension |
| `extensions/ritemark/package.json` | two tests in the `test` script | extension |
| `docs/development/architecture.md`, `CLAUDE.md`, release plan, release notes draft | W5 | docs |

No webview bundle change (the Recent panel is inline HTML in the provider), no new dependency, no esbuild external, no feature flag, no new patch file.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A failed load is recorded because the error arrives after the navigate event | Low (ordering argument in the audit) | P1 in W0; fallback is sending `failed` from the loading-state event (patch change → Jarmo) |
| A noisy site (redirect chains, OAuth hops) pushes real pages out of the 25 | Medium | Accepted: Recent records what the browser showed, like browser history. Remove/Clear all exist. Revisit only with evidence from use |
| A restored tab raises "command not found" before activation | Low (`executeCommand` waits for `*` activation) | P4; errors are caught and logged at trace level |
| Patch regeneration drops a file or a hunk | Low with the checks | 4-file count, `git diff main` on the patch, pristine apply + re-run (W1) |
| Another v1.14.0 sprint edits the same files | Certain for small text, none for code | Checked 2026-10-12: neither #399 (Sprint 129) nor #409 (Sprint 130) touches `patches/`, `src/browser/` or `extension.ts`. Both add lines to `package.json`'s test scripts, and #399 edits the CLAUDE.md patch-table row next to 009's row. Those are text merges; rebase before merge and check again |

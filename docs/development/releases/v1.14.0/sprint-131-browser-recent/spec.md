# Sprint 131 Spec: Browser Recent records the pages you visit

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Issue:** [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195)

## Purpose

The Browser's **Recent** list should show the pages the user actually visited in Ritemark's browser. Today it records only pages opened by a command, so it fills up with old local HTML files and never shows the sites the user typed or clicked to. After this sprint, every page the browser shows is recorded once, by its real address and title. Failed loads, blank tabs and in-page jumps stay out, and so do local files that no longer exist.

## Principles

- **Record what the browser showed, from one source.** The workbench says what was shown; the extension decides what counts. The old "record on open command" call goes away so there are not two sources disagreeing on the address.
- **The patch is a pipe, the rules are in the extension.** Patch 009 only forwards events with the facts only the workbench knows (failed load, private session). Every filtering rule lives in extension code, where it is unit-tested and can change in an extension release.
- **No new UI.** The existing rows carry the title. Nothing is added to the panel, and no setting or flag is added.
- **Surgical.** One new contribution in the file patch 009 already creates; no new hunk in upstream VS Code files; one new extension module plus its test.

## Requirements

### R1: Browsing inside the browser is recorded
As a user, I want the pages I reach by typing an address or clicking a link to appear in Recent, so I can get back to them.

Acceptance criteria:
- Typing an address in the browser's address bar and loading it puts that page at the top of Recent.
- Clicking a link that loads in the same tab puts the new page at the top of Recent.
- A same-tab route change on a single-page site (address changes without a full reload, for example GitHub file navigation) is recorded as its own entry.
- Back and forward to a page record it again (it moves to the top).
- The recorded address is the address the page ended on (after redirects), as shown in the address bar.

*(revised 2026-10-12, Phase 0 finding — [phase0-findings.md](./research/phase0-findings.md))*: client-side redirects (meta refresh, script) arrive as separate navigations a few milliseconds apart, so "the address the page ended on" needs a rule:
- A navigation is recorded once the tab has stayed on it for 1 second. A page the same tab leaves for another document within that second is not recorded: a redirect's intermediate page, an OAuth hop, or a page clicked through at once. A title that arrives in that second is recorded with it.
- If the extension shuts down while a navigation waits, it is recorded at once.

### R2: Pages opened any other way are recorded once, by their real address
As a user, I want pages opened from a file, a terminal link, the Recent list itself or by the AI agent to appear in Recent the same way.

Acceptance criteria:
- "Open in integrated browser" on a file, opening an `.html` file, a terminal link, `ritemark.browser.openUrl` and clicking a Recent row each produce exactly one entry, at the address the page ended on. (Today an opened `ritemark.app` is recorded as `https://ritemark.app`; the page's own address is `https://ritemark.app/`.)
- A page the AI agent navigates to in the visible tab is recorded like a page the user opened.
- A link opened in a background tab is recorded when the user first switches to that tab, with the address the tab is showing then.
- `openInIntegratedBrowser()` no longer writes to the store itself.

### R3: What is not recorded
As a user, I want Recent free of noise.

Acceptance criteria:
- Only `http:`, `https:` and `file:` addresses are recorded. `about:blank` (a new empty tab), `data:`, `blob:`, `chrome-error:` and every other scheme are not.
- A page that failed to load (unknown host, offline, connection refused, certificate error) is not recorded.
- A change of only the `#fragment` within the same tab (an anchor jump) is not a new entry.
- Reloading a page, or switching back to a tab whose page was already recorded, does not move that page in the list.
- Tabs that browse in a private (ephemeral) session record nothing. This is VS Code's `workbench.browser.dataStorage: ephemeral`, which untrusted workspaces always use.
- An address longer than 8,192 characters is not recorded.

### R4: One entry per address
As a user, I want each page once.

Acceptance criteria:
- `https://site` and `https://site/`, and two addresses that differ only in host letter case or a default port, are the same entry. This also holds for entries saved by earlier versions.
- Most recent first, at most 25 entries (unchanged).

*(revised 2026-10-12, dev-instance QA)*: two addresses that differ only in their `#fragment` are the same entry. Going Back to `page.html#section` from another page made a second row for the same page next to `page.html`. The entry keeps the address of the latest visit, fragment included, so clicking it returns to that spot.

### R5: Page titles in the list
As a user, I want to recognise pages by their title, not only by host name.

Acceptance criteria:
- When the page has a title, the row's first line is the title and the second line is the address without the scheme: host plus path for web pages, the file path for local files. The tooltip stays the full address.
- When there is no title, the row looks as it does today (host or file name, then path). Entries saved by earlier versions have no title and show as today until visited again.
  *(revised 2026-10-12, dev-instance QA)*: the name line shows a non-default port (`localhost:8765`, not `localhost`), so two local dev servers can be told apart. For ordinary sites nothing changes.
- Titles that change on their own after the page has loaded (unread counters, clocks) do not keep rewriting the entry. Only title changes within 10 seconds of the navigation are taken.
- A "title" that is just the address (Chromium's fallback for pages without a title) is ignored.
  *(revised 2026-10-12, Phase 0 finding)*: Chromium's fallback is the address without its scheme for web pages (`localhost:8765/titled.html`) and the file's name for local files (`report.html`). The title is ignored when it equals the address, the address without its scheme (with or without a trailing slash), or a local file's name.
- Titles are trimmed to one line and at most 300 characters.

### R6: Local files that are gone drop out of the list
As a user, I don't want dead entries for deleted local files.

Acceptance criteria:
- When Recent is shown (the panel opens, or becomes visible again), every `file://` entry whose file no longer exists is removed from the list.
- An entry is removed only when the file is reported as not found. Other errors (no permission, a disconnected drive, an unreachable network share) keep the entry.

### R7: Local dev-server pages are recorded like any other page
As a user who runs local sites (often ones an AI agent built), I want `localhost` pages in Recent so I can reopen them.

Acceptance criteria:
- `http://localhost:5173/` and other loopback addresses are recorded under the same rules as any web page. They get no marker and no separate handling.

### R8: The bridge is safe across versions and patches
As the release owner, I want the bridge to fail quietly and leave the patch stack intact.

Acceptance criteria:
- The workbench forwards events through one internal extension command, `ritemark.browser.didNavigate`. It is not listed in the Command Palette.
- If the extension is not listening (not yet active, or an older copy), the workbench drops the event. It logs at trace level and shows no error or notification.
- The extension accepts only well-formed input (known `kind`, string `pageId`/`url`/`title`, boolean flags). Anything else is ignored.
- Patch 009 keeps its 4 files and changes only the file it creates (`ritemarkBrowserContextFeature.ts`) plus its header. Patch 010 still applies on top, both in a dry run and in a real apply from a pristine tree. A re-run of `apply-patches.sh` on the patched tree also passes.
- The workbench and extension agree on the command name. A unit test reads patch 009 and fails if the name drifts.

## Non-Requirements

- No history search, grouping by day, or a "full history" view. Recent stays an MRU list of 25.
- No setting to turn recording off. Per-row remove and "Clear all" remain the controls.
- Pages loading in tabs no editor pane is showing are not recorded while hidden (only redirects or scripts can navigate there). The tab's page is recorded when the user first looks at it.
- No live sync of the list between two open windows. Each window records its own browsing into the shared list, and the other window shows it on its next change. Same as today.
- No favicon in the row (the globe icon stays).
- No change to the AI's browser context, share consent or the agent tools.

## Resolved Questions

- **Poll variant (extension-only) vs patch:** patch only. v1.14.0 is a full app release, so the poll would ship in the same build as the fix and add nothing. See [research](./research/current-state-audit.md#options-considered).
- **Where the rules live:** in the extension (`browserNavigationRecorder.ts`). The patch only sends `kind`, `pageId`, `url`, `title`, `failed` and `ephemeral`.
- **Removing the old record call:** safe. Extension updates for 1.14 require app 1.14 (`minimumAppVersion`), so the extension never runs without the bridge.
- **AI-agent navigation:** recorded (R2). The workbench cannot tell an agent's click from the user's, and the agent works in a tab the user is watching.

## Open Questions

None that block the plan. Phase 0 (technical plan W0) checks the five assumptions listed in the [audit](./research/current-state-audit.md#not-verified-yet). If one fails, the fix is a rule change inside W2, except for two cases. If failed loads cannot be told apart, the fallback is to send `failed` from the loading-state event. If a restored tab raises an error notification, the fallback is to delay the first send until the extension is up. Either one is a change to the patch, and I will tell Jarmo before making it.

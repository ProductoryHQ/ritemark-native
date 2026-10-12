# Sprint 131 Scenarios

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Spec:** [spec.md](./spec.md)

These are the dev-instance QA matrix (tasks T4.4). "Recent" means the Browser container's Recent list. "Top" means the first row. Each scenario starts from a cleared Recent ("Clear all") unless it says otherwise.

## Feature: browsing inside the browser is recorded (R1)

### S1: Typed address
Given an empty browser tab
When the user types `ritemark.app` in the address bar and presses Enter
Then Recent's top row shows the page's title over `ritemark.app`
And hovering it shows `https://ritemark.app/`

### S2: Same-tab link click
Given `https://ritemark.app/` is open
When the user clicks a link to another page on the site that opens in the same tab
Then that page is the top row and `ritemark.app` is the second

### S3: Single-page-site route change
Given `https://github.com/ProductoryHQ/ritemark-native` is open
When the user clicks a folder in the file list (the address changes without a full reload)
Then the folder's address is the top row, with its title

### S4: Back and forward
Given the user went from page A to page B in one tab
When the user presses Back
Then A moves back to the top

### S5: Redirected address
Given an empty tab
When the user loads `http://github.com` (the server redirects to `https://github.com/`)
Then Recent has one entry, `https://github.com/`, and no `http://` entry

## Feature: pages opened any other way (R2)

### S6: Open in integrated browser from the file explorer
Given a workspace file `report.html` with `<title>Q3 report</title>`
When the user picks "Open in integrated browser"
Then the top row reads "Q3 report" over the file's path, exactly once

### S7: HTML file opener
Given `report.html` in the explorer
When the user opens it with a plain double-click (patch 010's resolver opens it in the browser)
Then the top row is that file, exactly once

### S8: Clicking a Recent row
Given Recent lists A (top) and B
When the user clicks B
Then B opens and moves to the top, and the list still has two entries

### S9: AI agent navigation
Given the browser tab is shared with the agent for control
When the agent navigates the tab to `https://example.com/`
Then `example.com` is the top row

### S10: Link opened in a background tab
Given page A is open
When the user Cmd-clicks (Ctrl-clicks on Windows) a link to page B, and B opens as a background tab
Then Recent does not change yet
When the user switches to B's tab
Then B is the top row, at the address B's tab shows
When the user switches back to A and then to B again
Then the order does not change

### S11: Restored tab after Reload Window
Given a browser tab showing page A, with A not the top of Recent
When the user runs "Reload Window"
Then A moves to the top once (the page loads again in front of the user)
And no error notification appears

## Feature: what is not recorded (R3), negative cases

### S12: New empty tab
When the user opens a new browser tab (blank page)
Then Recent does not change

### S13: Typo host
When the user types `https://no-such-host-ritemark.invalid` and presses Enter (the error page shows)
Then Recent does not change

### S14: Anchor jump
Given a page with a table of contents is open
When the user clicks an in-page `#section` link
Then Recent does not change (the page is still one entry, no `#section` entry)

### S15: Reload
Given page A is open and page B is the top row (B was opened in another tab after A)
When the user reloads A's tab
Then the order does not change

### S16: Private session
Given `workbench.browser.dataStorage` is `ephemeral`
When the user browses to any page
Then Recent does not change

### S17: Other schemes
When a page navigates the tab to a `data:` address
Then Recent does not change

### S18: Overlong address
When the extension receives a navigation whose address is longer than 8,192 characters (unit test)
Then nothing is recorded

## Feature: one entry per address (R4)

### S19: Saved entry from an earlier version
Given Recent holds `https://ritemark.app` saved by v1.13.0 (no trailing slash, no title)
When the user visits `https://ritemark.app/`
Then Recent holds one entry for it, at the top, with the page title

### S20: Cap
Given Recent holds 25 entries
When the user visits a new page
Then the new page is the top row, the oldest entry is gone, and there are still 25

## Feature: titles (R5)

### S21: Title arrives after the address
Given a page whose title is set when the page finishes loading
When the user visits it
Then within a second or two of loading, the row shows the title instead of the host name

### S22: Changing title
Given a page whose title counts seconds ("00:01", "00:02", …)
When the user stays on it for a minute
Then the row keeps the title it had within 10 seconds of loading

### S23: Page without a title
Given a local HTML file without a `<title>`
When the user opens it
Then the row shows the file name over its path (as today), not the address as a title

## Feature: deleted local files (R6)

### S24: Deleted file drops out
Given Recent lists local file `old.html` and a web page
When the user deletes `old.html` and then opens the Browser container (or it becomes visible again)
Then `old.html` is gone from the list and the web page remains

### S25: Unavailable but not deleted
Given Recent lists a file on a network share that is disconnected
When Recent is shown
Then the entry stays (unit test: a stat error other than "not found" keeps the entry)

## Feature: localhost (R7)

### S26: Dev server page
Given a local server on `http://localhost:5173/`
When the user opens it and clicks to `/about`
Then both are in Recent like any web pages, the newer on top

## Feature: bridge safety (R8)

### S27: Extension not listening
Given the patched workbench and an extension without the command (unit-level: the command is not registered)
When the user browses
Then nothing is shown to the user and the workbench trace log has the dropped event

### S28: Malformed input
When `ritemark.browser.didNavigate` is called with a missing `url`, a non-string `title` or an unknown `kind` (unit test)
Then the store does not change and nothing throws

### S29: Patch stack
Given a pristine VS Code tree at the pinned commit
When all patches are applied in order, and `apply-patches.sh` is run a second time
Then every patch applies (dry-run counts show no conflicts), patch 009 has 4 files, and patch 010 applies on top of it

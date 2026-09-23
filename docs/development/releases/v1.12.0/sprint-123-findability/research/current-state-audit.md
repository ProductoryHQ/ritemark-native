# Sprint 123 Phase 0 — transcripts and tab rows today

Read on `sprint-123-findability`, branched from `origin/main` `f55dbebe`
(2026-09-23), plus a live check in a dev build. Every claim is a line of code or a
reading from the running app.

## 1. The transcript has no search

`webview/src/components/transcribe/workbench/Workbench.tsx` renders **every**
segment (`segments.map(SegmentRow)`, no virtualization — the code notes 600+
segments for an hour-long meeting). Nothing searches them, and no webview in the
extension enables VS Code's own find widget (`enableFindWidget` appears nowhere in
`src/`).

What a search has to live with:

| Existing behaviour | Where |
|---|---|
| **Follow playback**: while audio plays, the playing line is scrolled to the centre | `followPlayback` state, effect on `[activeIndex, followPlayback, playing]` |
| Scrolling the transcript with the wheel pauses following | `onWheel={() => setFollowPlayback(false)}` |
| Clicking a line seeks there and resumes following | `seek()` sets `followPlayback` back to `true` |
| **No visible way** to resume following except clicking a line | — |
| Space / ← / → drive the player, but not while focus is in an input, button or other control | `isInteractivePlaybackTarget` |
| A segment renders as plain text, or — only when it has low-confidence words — as one span per word with a dotted underline | `SegmentText` |

So a search field will not fight the player's keys, highlighting must work across
both renderings (a match can span several word spans), and "pause following when a
result is chosen" already has a mechanism — it lacks only a visible resume.

## 2. Browser tabs already use the page title

The integrated browser is VS Code's own editor (`workbench.action.browser.open`),
not a Ritemark webview. Its tab label comes from
`vscode/src/vs/workbench/contrib/browserView/common/browserEditorInput.ts`:

| Method | Returns | Used for |
|---|---|---|
| `getName()` | the page title, **cut to 30 characters**; the host name if there is no title yet | the tab's label |
| `getDescription()` | the URL without its query (medium) or with it (long) | shown beside the label only when needed — see below |
| `getTitle()` | `title (URL)` | the tab's hover and the window title |

`multiEditorTabsControl.ts` with Ritemark's default `workbench.editor.labelFormat`
(Ritemark does not set it) hides the description unless two tabs share a name, and
then shows a **shortened** distinguishing part of the URL, not the whole URL.

Live, in a dev build: a tab on `https://example.com` reads **"Example Domain"**,
with no description; its accessible name is "Example Domain (example.com)"; the
window title is "Example Domain (example.com) — workspace".

So the issue's first tab requirement is already met by the VS Code version Ritemark
ships (1.117). Nothing in Ritemark appends the URL; the only Ritemark browser
surface, `BrowserPanelProvider`, is the history list in the sidebar, not the tabs.

## 3. Long file names still make wide tabs

Ritemark sets no tab-sizing default, so VS Code's `workbench.editor.tabSizing:
"fit"` applies: a tab is as wide as its full name, and a crowded row scrolls
sideways instead of fitting. (Live: `launch-plan.md` 150 px, `brief.md` 120 px.)

`"shrink"` keeps names whole while there is room and cuts them with an ellipsis
only when the row is full, down to a minimum width. The full name stays in the
hover and in the open-editors list.

## 4. No VS Code patch is needed

The plan asked whether compact tab labels need a patch, which would make v1.12.0 a
full-app release. They do not:

- the browser label already is the page title;
- tab sizing is a window-scoped setting, and VS Code lets an extension contribute
  defaults for window-scoped settings
  (`configurationExtensionPoint.ts`: machine-overridable, window, resource and
  language-overridable scopes). Ritemark's extension already contributes
  `workbench.*` defaults this way (`workbench.editor.editorActionsLocation`, …).

A middle-truncated tab label would need a patch; end truncation, which VS Code
already does, is what the plan allows ("middle- or end-truncation appropriate to
the content").

## What this means for the sprint

- **Workstream A (transcript search)** is the real work: a new search bar,
  highlighting across both segment renderings, result navigation that cooperates
  with Follow playback, and a visible way to resume following.
- **Workstream B (tabs)** shrinks to one extension default
  (`workbench.editor.tabSizing: "shrink"`) and verification. Extension tier.
- Windows cannot be checked here; the tab behaviour is VS Code's own and identical
  on both platforms, so it joins the v1.12.0 Windows gate as a checklist line.

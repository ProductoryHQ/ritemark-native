# Sprint 122: Agent conversation clarity

Track: Lightweight (three workstreams, one shared surface)<br>
Release tier: extension

**Status:** Implemented and RunDev-validated 2026-09-23 — closing (QA, PR).<br>
**Branch:** `sprint-122-conversation-clarity`<br>
**Issue:** [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282)<br>
**Worktree:** `.claude/worktrees/sprint-122-conversation-clarity`, branched from main `04231de2`<br>
**Release:** [v1.12.0](../release-plan.md)

## Goal

You can always see which conversation you are in and act on it from there; a long
prompt is comfortable to write; and every link in a reply either does something
or says why it cannot.

## Phase 0 — done

[research/current-state-audit.md](./research/current-state-audit.md). In short:
the active conversation is named only in a hover tooltip; the composer is capped
at 120 px although Sprint 117 already built the primitive that fixes it; and of
the link cases, an unsupported scheme and a directory target do nothing at all,
while a file outside the project is a dead end.

## Scope

**A. Active-conversation header.** A persistent header above the transcript with
the conversation title and the same three actions History already has — pin or
unpin, rename, delete with confirmation. Same words, same icons, same five-pin
limit. A long title truncates on screen and stays complete for a
screen reader.

**B. A composer you can make taller.** Replace `ChatInput`'s 120 px cap with
Sprint 117's `ResizableComposer`: a 2-row floor, a `min(8 rows, 40vh)` ceiling,
Send / Stop / model controls outside the scrolling area so they stay reachable
at the narrowest supported sidebar width and at 200 % zoom.

**C. One link policy, four outcomes.** Extend `chatLinks` to classify a target
as project file, other local file or folder, web URL, or unsupported. An
ordinary click does the safest likely thing; a context menu offers the rest —
Reveal in project, Locate in Finder, Open externally, Copy. Nothing is inert:
a missing target, a directory, and an unsupported scheme each say what happened.

## Proposed behaviour for C (the part with real choices)

| Target | Click does | Context menu also offers |
| --- | --- | --- |
| File inside the project | opens in Ritemark's editor (as today) | Reveal in project, Copy path |
| Folder inside the project | reveals it in the project tree (today: silence) | Locate in Finder, Copy path |
| File or folder outside the project | **Locate in Finder** — never a silent editor open of a model-authored path | Copy path |
| Web URL | opens in the browser (as today) | Copy link |
| Unsupported scheme (`mailto:`, `vscode:`, `command:`, …) | says the link type is not supported (today: nothing) | Copy link |
| Target does not exist | says so, naming the path (as today) | Copy path |

The workspace confinement stays exactly as it is: no new privileged scheme, no
filesystem access moved into the webview, and an out-of-project path is revealed
rather than opened.

## Deliverables

| Deliverable | Description |
|---|---|
| Conversation header | Title plus pin/rename/delete, reusing History's store actions and wording |
| Resizable agent composer | `ResizableComposer` applied to `ChatInput`, controls outside the scroll area |
| Link policy | One classifier, four outcomes, a context menu, and explicit feedback in every case |
| Tests | Classifier and header-action unit tests; a bridge test for each host outcome |
| Docs and release notes | `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md`, the v1.12.0 test checklist |

## Definition of Done

- [x] The header names the current conversation at all times, and long titles truncate while keeping their full accessible name.
- [x] Pin/unpin, rename and delete behave and read exactly as in History, including the five-pin limit and the running-conversation confirm (one shared model and dialogs; the running confirm is covered by test, not exercised live).
- [x] The composer can be made taller and shorter; Send, Stop and the model control stay visible at every height and at ~207 % zoom (the narrowest drag width of the sidebar was not set separately).
- [x] Every row of the table above is what actually happens, verified in a dev build — except that the web link's click was not exercised (it would open a browser on this machine) and Finder's window could not be observed.
- [x] No supported link is inert, and no unsupported scheme is opened.
- [x] `npm test` and `./scripts/validate-qa.sh` pass.

## Out of Scope

- A general-purpose file manager, or browsing outside the project.
- Per-conversation browser instances.
- New URL schemes, `command:` links, or any privileged execution from chat.
- An archive concept — the issue's "delete or archive" is met by History's existing delete-with-confirm.

## Decision

The table above was proposed with one open choice: an out-of-project file is
revealed with **Locate in Finder** rather than opened, because a path in a reply
is written by the model, not by you.

**Decided 2026-09-23 (Jarmo: "plaan on ok — Finderi valik sobib").** The table
stands as written.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-23 | Header actions reuse History's pin/rename/delete exactly; no archive concept | The issue's "delete or archive" is met by the existing delete-with-confirm; a second vocabulary would contradict History |
| 2026-09-23 | The composer uses Sprint 117's `ResizableComposer` | Built for this and says so in its docblock; no second primitive |
| 2026-09-23 | Out-of-project file or folder: click = Locate in Finder | A chat path is model-authored; the workspace confinement stays |
| 2026-09-23 | The header's rename / pin / delete sit behind one ⋮ menu, not three icon buttons | Jarmo, on the first build: "need pane : (kebab) meny alla". The title keeps the width; the menu items keep History's words and icons |
| 2026-09-23 | The chat composer shares Sprint 117's *bounds and session height*, not the `ResizableComposer` component | The component carries the comment box's own field styling and footer layout; the chat composer has chips, attachments and pickers around its field. `composerBounds` and the per-surface session height are now exported from the same file and used by both |
| 2026-09-23 | Everything clickable in the webview shows the pointing hand, as one zero-specificity global rule | Jarmo's standing rule for every web UI; the webview had none, and the new menu items needed it |
| 2026-09-23 | The chat composer is also capped by the room left in the sidebar column | RunDev at ~207 % zoom showed a long prompt pushing Send off screen; the vh ceiling alone cannot account for the header, banners and disclosure |
| 2026-09-23 | Shift+F10 and the Menu key open a link's menu | macOS has no context-menu key, so without this the link menu was mouse-only |

## Planning Approval

- [x] Jarmo approves this sprint plan. *("plaan on ok — Finderi valik sobib", 2026-09-23)*
- [x] GitHub issue exists. ([#282](https://github.com/ProductoryHQ/ritemark-native/issues/282))
- [x] Worktree and branch created. (`sprint-122-conversation-clarity`, from main `04231de2`)

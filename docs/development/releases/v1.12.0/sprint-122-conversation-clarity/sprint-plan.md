# Sprint 122: Agent conversation clarity

Track: Lightweight (three workstreams, one shared surface)<br>
Release tier: extension

**Status:** Plan — awaiting Jarmo's approval. No code until then.<br>
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
unpin, rename, delete with confirmation. Same words, same icons, same disabled
rule for pinning. A long title truncates on screen and stays complete for a
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

- [ ] The header names the current conversation at all times, and long titles truncate while keeping their full accessible name.
- [ ] Pin/unpin, rename and delete behave and read exactly as in History, including the one-pin rule and the running-conversation confirm.
- [ ] The composer can be made taller and shorter; Send, Stop and the model control stay visible at every height, at the minimum sidebar width and at 200 % zoom.
- [ ] Every row of the table above is what actually happens, verified in a dev build.
- [ ] No supported link is inert, and no unsupported scheme is opened.
- [ ] `npm test` and `./scripts/validate-qa.sh` pass.

## Out of Scope

- A general-purpose file manager, or browsing outside the project.
- Per-conversation browser instances.
- New URL schemes, `command:` links, or any privileged execution from chat.
- An archive concept — the issue's "delete or archive" is met by History's existing delete-with-confirm.

## Open decision for Jarmo

The table above is my proposal, and the one place I am guessing at your intent is
the out-of-project file: I chose **Locate in Finder** over opening it, because a
path in a reply is written by the model, not by you. Say the word if you would
rather it opened in Ritemark.

## Planning Approval

- [ ] Jarmo approves this sprint plan.
- [x] GitHub issue exists. ([#282](https://github.com/ProductoryHQ/ritemark-native/issues/282))
- [x] Worktree and branch created. (`sprint-122-conversation-clarity`, from main `04231de2`)

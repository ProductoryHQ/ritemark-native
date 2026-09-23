# Sprint 122 QA evidence

Dev build from this worktree (`sprint-122-conversation-clarity`, CoW-cloned VS Code
shell, clean profile, Claude Code signed in), 2026-09-23. Readings come from the
running sidebar's DOM and the workbench, not from screenshots alone.

Fixture: a project with `notes/brief.md`, `notes/designs/`, and `notes/launch-plan.md`,
and a real conversation whose reply contains six links —
`notes/brief.md`, `notes/designs`, `/Users/Shared/harbor-notes.md` (does not exist),
`https://example.com/carrier-api`, `mailto:pilot@example.com`, `notes/old-plan.md`
(does not exist).

## Header (Phase 1)

| Check | Result |
| --- | --- |
| Empty conversation | header reads "New conversation", no menu |
| Saved conversation | header shows the host title, ⋮ menu with Rename, Pin, Delete (Delete in red, after a separator) |
| Pin from the menu | rail shows the conversation as Pinned; the menu now says Unpin |
| Rename from the menu | History's dialog opens with focus in the field and the title pre-filled; after Save the header reads "Harbor launch links" |
| Delete from the menu | History's dialog, word for word: "Delete conversation? / “Harbor launch links” will be removed from this project. / Cancel / Delete"; Escape cancels |
| Keyboard | Enter on ⋮ opens the menu on Rename, ↓ moves to Unpin, Escape closes and returns focus to ⋮ |
| History after the refactor | lists, renames and unpins as before; its rename, pin and delete buttons now have tooltips |
| Pointer | the ⋮ button reports `cursor: pointer` through the new global rule |

## Composer (Phase 2)

| Check | Result |
| --- | --- |
| Floor, empty | 62 px (two lines) |
| Long prompt at 100 % | grows to 189 px (eight lines at 13 px), then scrolls; the controls row stays below it |
| After Send | back to the floor |
| Real drag on the grip | 62 → 102 px; typing and clearing the text both keep 102 px |
| ~207 % zoom (View: Zoom In ×4), long prompt | the field is capped by the room the column has left (82 px) and scrolls; **model control and Send stay on screen** |
| Back to 100 % | the dragged 102 px is still there — the zoom's temporary cap was not mistaken for a drag |

The zoom check found a real defect in the first build: with a long prompt at ~207 %
zoom the field pushed the controls row off the bottom of the sidebar. Fixed by also
capping the field by the column's remaining room, and by recording a drag only when
the press starts on the resize grip.

## Links (Phase 3)

| Link | Click | Right-click menu |
| --- | --- | --- |
| `notes/brief.md` (project file) | opens `brief.md` in the editor | Open · Reveal in project · Copy path |
| `notes/designs` (project folder) | selects `designs` in the project tree — **was silent** | Reveal in project · Locate in Finder · Copy path |
| `/Users/Shared/harbor-notes.md` (missing) | "File not found: /Users/Shared/harbor-notes.md" | Copy path |
| `https://example.com/carrier-api` (web) | not clicked, to avoid opening a browser on this machine; the path is unchanged from before | Open in browser · Copy link |
| `mailto:pilot@example.com` (unsupported) | "Ritemark doesn't open mailto: links from chat." with **Copy link** — **was silent** | Copy link |
| `notes/old-plan.md` (missing) | "File not found: notes/old-plan.md" | Copy path |
| a file outside the project that exists | the file is **not** opened in Ritemark, no error; `revealFileInOS` runs. Finder's window itself could not be observed from the session (another app was in front) | Locate in Finder · Copy path |

- **Copy path** on `brief` put `notes/brief.md` on the clipboard (the clipboard was saved before and restored after the check).
- **Keyboard:** Shift+F10 on a focused link opens its menu directly under the link; ↓ moves, Escape returns focus to the link. macOS has no context-menu key of its own, so this is handled in the sidebar.
- The model refused to write an out-of-project absolute link in a reply, so the outside-file row was checked by adding that link to the rendered reply and clicking it with the real mouse — the same webview and host path.

## Automated

| Suite | Result |
| --- | --- |
| `conversationActionsModel.test.ts` | pass |
| `composerBounds.test.ts` | pass (the comment box's bounds are byte-identical to Sprint 117's) |
| `chatLinks.test.ts` | pass (unsupported schemes named, menu per destination) |
| `src/views/chatLinkTargets.test.ts` | pass (realpath confinement, `..`, a symlink that leads out, a sibling folder sharing the prefix, permission errors, the action gate) |
| `threadStatus.test.ts`, `threadRail.test.ts` | pass |
| webview and extension `tsc --noEmit` | clean |
| `npm test` (full) | see Phase 5 |

## Found while validating, out of scope

- A conversation auto-titled in Dutch ("Carrier ontvoering en piloten") from an English prompt. Filed separately.
- A long unbroken path in a *user* prompt bubble overflows the transcript horizontally. Pre-existing, not touched.
- At ~200 % zoom the AI disclosure card takes most of the sidebar's height; it has "Don't show again". Not changed.

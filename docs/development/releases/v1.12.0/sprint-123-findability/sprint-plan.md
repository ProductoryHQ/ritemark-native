# Sprint 123: Findability across long work

Track: Lightweight (two workstreams)<br>
Release tier: extension — Phase 0 found no VS Code patch is needed

**Status:** Implementation — plan approved 2026-09-23.<br>
**Branch:** `sprint-123-findability`<br>
**Issue:** [#283](https://github.com/ProductoryHQ/ritemark-native/issues/283)<br>
**Worktree:** `.claude/worktrees/sprint-123-findability`, branched from main `f55dbebe`<br>
**Release:** [v1.12.0](../release-plan.md)

## Goal

You can find a word in an hour-long transcript without losing your place in the
recording, and a crowded tab row stays readable.

## Phase 0 — done

[research/current-state-audit.md](./research/current-state-audit.md). In short:

- The transcript has no search. It renders every segment, has Follow playback
  (wheel pauses it, clicking a line resumes it), and no visible way to resume
  following.
- **Browser tabs already use the page title**, cut to 30 characters, with the URL
  only in the hover — VS Code 1.117's own browser editor does that. Verified live:
  "Example Domain", hover "Example Domain (example.com)".
- **Long file names make wide tabs**, because VS Code's default tab sizing is
  `fit`.
- **No VS Code patch is needed**, so the release tier stays extension.

## Scope

**A. Search in the transcript.** A search field above the transcript:

- case-insensitive, matches across the text as shown (including words the engine
  was unsure about);
- a count ("3 of 12"), **Previous** / **Next** buttons, Enter / Shift+Enter;
- every match highlighted, the current one more strongly;
- "No matches" when there are none;
- Escape or clearing the field returns the transcript to normal;
- Cmd/Ctrl+F in the workbench puts focus in the field;
- nothing about the session changes — search only reads what is loaded.

Going to a match scrolls it into view and **pauses Follow playback**, so the
playing line does not drag you away. A small **Back to playing line** button
appears whenever following is paused while the audio plays — after a search, and
also after scrolling with the wheel, which today has no visible way back.

**B. A tab row that fits.** Add `workbench.editor.tabSizing: "shrink"` to the
extension's configuration defaults: names stay whole while there is room and
shorten with an ellipsis only when the row is full. The full name stays in the
hover and in the open-editors list. Browser tab labels need no change.

## Deliverables

| Deliverable | Description |
|---|---|
| Transcript search | Search bar, highlighting in both segment renderings, navigation, count, empty state, keyboard |
| Follow-playback resume | "Back to playing line" when following is paused during playback |
| Tab sizing default | One `configurationDefaults` entry in the extension, checked on a fresh profile |
| Tests | Match finding and highlight splitting as pure functions |
| Docs and release notes | CHANGELOG, release notes, the v1.12.0 test checklist; architecture note if the workbench structure changes |

## Definition of Done

- [x] Searching a long transcript shows the count, moves between matches with the buttons and with Enter / Shift+Enter, and highlights the current match distinctly.
- [x] A match inside a word the engine was unsure about is found and highlighted, and the unsure-word marking remains.
- [x] Going to a match pauses Follow playback; "Back to playing line" resumes it; playback and speaker controls keep working while searching.
- [x] Escape and clearing the field restore the normal transcript; "No matches" is shown when nothing matches.
- [x] Browser tab labels show the page title without the URL (already true; verified on the same VS Code build).
- [x] On a fresh profile, a crowded tab row fits by shrinking long names, and the hover still shows the full name. *(Clipped with a fade, not an ellipsis; close button on hover, including the active tab — see Product Decisions.)*
- [x] `npm test` and `./scripts/validate-qa.sh` pass.

## Out of Scope

- Searching across all transcripts or the workspace.
- A redesign of the tab system, or middle-truncated tab labels (that would need a VS Code patch).
- Browser favourites or recents.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-23 | No VS Code patch; the release tier stays extension | Browser tabs already show the page title; tab sizing is an extension-contributable default |
| 2026-09-23 | **Back to playing line** also appears after a wheel scroll, not only after a search | That pause had no visible way back either. Approved with the plan (Jarmo: "plaan on ok, alusta") |
| 2026-09-23 | The search bar sits in its own row above the scrolling transcript, not as a sticky header inside it | Jarmo on the first build: "layout errors - top gap and right gap"; the sticky header let text show through and did not reach the edges. Re-checked: "nüüd on korras" |
| 2026-09-23 | In shrink mode long tab names are clipped with a fade (not an ellipsis), and the close button shows on hover, the active tab included | VS Code's own shrink-mode rules; changing either would need a VS Code patch. Cmd+W still closes the active tab. Confirmed by Jarmo on PR #342: "jah, sobib" |

## Planning Approval

- [x] Jarmo approves this sprint plan. *("plaan on ok, alusta", 2026-09-23)*
- [x] GitHub issue exists. ([#283](https://github.com/ProductoryHQ/ritemark-native/issues/283))
- [x] Worktree and branch created. (`sprint-123-findability`, from main `f55dbebe`)

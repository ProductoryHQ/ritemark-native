# PR 2's proof: Decks on main behind the flag

All runs are dev windows of this branch's dev build (`scripts/qa/dev-launch-isolated.sh`), each on a fresh short profile with throwaway AI homes and `--use-mock-keychain`, driven over CDP. Not signed in to anything. The window is 1440 × 900 (the shots are at 2×).

## The first frame with the flag off: the fault, then the fix

- **The fault** (`first-frame-fault-flag-off.txt`, `.png`). This is the Decks branch merged with main, without PR 1 and without the place's setting: `project-check.mjs --first-frame new-profile`, extension host held 10 s. FAIL: the Slide library placeholder is place 4 at the first frame, Transcribe is pushed into More, and at +0.34 s the Slide library goes and three places move.
- **This branch, flag off** (`first-frame-flag-off.txt`, `.png`: nothing held; `first-frame-flag-off-held.txt`, `.png`: extension host held 10 s). Both PASS, 14 boxes kept their place. The settled boxes are identical, byte for byte, to main's run (PR 1's `first-frame-new-profile.txt`): Home, Documents, Tasks, Browser, Agents, Transcribe, More; Home and the Task board.

## A deck with the flag off

- **It opens as a document** (`deck-flag-off-as-document.png`): each slide is a code block of `key: value` lines, its notes a code block under it, and the handout the text between them.
- **Saving changes only what was typed** (`deck-flag-off-save.diff.txt`): " Bring a laptop." typed at the end of a paragraph, then File: Save. The diff against the file before is that one line, with the words added.

## The AI with the flag off

`ai-tools-flag-off-main.json` and `ai-tools-flag-off-branch.json` are identical. They were made by `ai-tools-snapshot.mts.txt` from main's extension sources and from this branch's, with the decks host set as `decksHost.ts` sets it with the flag off. For browser and board each on and off, they hold the tool groups, the Codex tool names, the MCP tool definitions and `toolSetKey`. For the three runtimes they hold the capability instructions (hash, length, and no DECKS section).

## The flag on, live

- **The place** (`flag-on-live-place-after-tasks.png`): turned on in settings.json in a running window, the Slide library comes after Tasks. The row holds six, so Transcribe moves into More.
- **A deck already open stays a document; reopened, it opens as a deck** (`flag-on-deck-opens-as-deck.png`).
- **The Slide library open** (`flag-on-slide-library-open.png`); then the flag turned off live, and the left column goes to Documents, the row back to main's (`flag-off-live-back-to-documents.png`).

## The guards: a deck page only for a panel that opened as a deck

`deck-probe.js.txt` posts a `deck/assets` request from inside the deck's editor webview, as the deck view does, and lists what the host answers within 2 s. `open-deck.sh.txt` opens the deck through Go to File.

| Step | Before the guards (the merge, 0d5855c8) | With them |
| --- | --- | --- |
| Flag off, the deck opened as a document | no answer | no answer |
| Flag turned on, the same document panel | answers `deck/assets` | no answer |
| Flag on, the file changed on disk (another program appends a line) | the document view turns into a deck view mid-session | stays a document, with the new line |
| Flag on, the deck closed and opened again | (as with them) | a deck view; answers `deck/assets` |

## The restore edge (PR 1's layout statement), in a clean window

The flag is on and the Slide library open. Reload Window is sent, and the flag is written off the moment the page unloads (PR 1's `edge-run.sh.txt`). Nothing is held this time.

- **Before PR 1's statement** (`edge-before-fix-first.png`): the first sample shows the Slide library checked in More's slot with an empty column; Documents follows at +0.33 s.
- **With it** (`edge-fixed-first.png`): Documents is checked from the first sample.

## Seen and not this PR's

- **The dev tree's built-in Copilot Chat** fails to activate ("the default value for setting chat.cli.planExitMode.enabled is different"). It comes from the copied dev tree, not from Ritemark.
- **"Extension host did not start in 10 seconds"** appears only in the held runs (`--inspect-brk-extensions`).

## Round one's fixes: each panel keeps the flag it opened with, and the file is read live

`round1-check.sh.txt`, in a dev window, opens a deck with the flag on. It then turns the flag off and probes the deck view, then rewrites the file to `deck: 2` the way another program would and probes again, then rewrites it back to `deck: 1`.

- **On the reviewed head** (`round1-mode-before-fix.txt`):
  - With the flag off, the deck view stays a deck, but no request of its is answered: no pictures, theme or saves.
  - After the rewrite it stays a deck view, so its next save would write this build's blocks over a newer file.
- **With the fixes** (`round1-mode-fixed.txt`):
  - With the flag off, the deck view is still served.
  - The `deck: 2` file falls back to a document and is not rewritten.
  - It is a deck again at `deck: 1`.

## Round two's fixes

- **`round2-mode-fixed.txt`** (`round2-check.sh.txt`; `library-probe.js.txt` posts `deck/library-topics`):
  - A deck opened with the flag on still answers its own requests after the flag is turned off, but refuses the Slide library's then (`deck/library-failed`). While the flag is on it answers them.
  - A `deck: 2` rewrite shows as a document: it is not served and not rewritten. At `deck: 1` it is a deck again.
- **The library and the AI's tools refuse to write a deck or topic in a later format.** `DeckLibrary.test.ts` covers insert, update, add-to-library and the `from:` line, and checks that each file is left byte for byte.
- **`guards-final.txt`** (`guard-check.sh.txt`): the flag-off guards, re-run on the final code.

## Main at 114da368 (Sprint 160's PRs)

After merging it, the AI's tools, instructions and `toolSetKey` with the flag off were made again from main's sources and from this branch's. They are identical, and main's are unchanged by Sprint 160 (`ai-tools-flag-off-*.json` stand). The extension's `npm test` passes, `test:decks` included.

# Sprint 137 QA evidence

26 October 2026, on the Mac (Apple Silicon). The app runs are a dev build of this worktree: VS Code 1.142.0 at the pin with all 18 patches, the extension compiled and both webview bundles rebuilt, started hidden (`open -n -g`) with `--use-mock-keychain`, an isolated `--user-data-dir`, `--shared-data-dir` and `--extensions-dir` under `$TMPDIR`, `RITEMARK_BUILD_CHANNEL=test`, analytics and telemetry off, CDP on port 9231, auto-save as shipped. The workspace is a copy of the corpus. Files are opened from the Documents tree with the mouse; typing is `execCommand('insertText')` inside the editor's webview (ProseMirror sees DOM input) or CDP `Input.insertText` in a text editor; an agent's edit is a shell write of a changed copy of the file, 250 ms after the typing.

Tools: `scripts/qa/markdown-roundtrip-check.mjs` (open, edit, save, read the bytes back), the session's conflict probes (type, write from outside, watch VS Code's notifications and the document's bar for 8 s), and the unit and corpus tests.

## Automated

| Check | Result |
|---|---|
| `npm run test:editor-sync` files, one by one (state, protocol, delivery, save receipt, front matter, the reducer, the reconciler, the task-list, tilde, strikethrough, ordered-list, image-path, comment and security round trips, `markdownAsWritten`, `markdownFidelity`, `linkEdit`, `documentUpdate`, the acknowledgement check, Save as Markdown, the card file, agent front matter) | 24 of 24 pass |
| The corpus test (`markdownFidelity.test.ts`) | 31 kept files (with `brackets-around-marks.md`, added after QA's B1) byte-identical after one and two saves, the one-word edit changes one line in each, CRLF and BOM kept; 13 known outputs and the cleanup output pinned and stable; no link, mark or image lost (one listed exception); the look baseline equal apart from R6's listed exceptions; no trailing whitespace |
| Webview and extension `tsc --noEmit` | exit 0, exit 0 |
| `npm run compile` (extension), `npm run build` (webview, both modes) | exit 0 |
| VS Code: `./scripts/test.sh --grep "Ritemark save conflict\|TextFileEditorModel"` | 55 passing |
| VS Code: `npm run typecheck-client`, `npm run build-fast -- --client-only` | exit 0 |
| Patches from the pin: dry run, apply, a second run, the stacking check | 18 / 18 / 0 applied (18 already) / OK ([notes/patches-before.md](notes/patches-before.md)) |
| Pre-commit validator, by hand with `CLAUDE_PROJECT_DIR` on the worktree | passed |
| QA's bracket fuzz (85,410 cases: a mark between bracket sequences), and the same widened to strike, code, a link and a comment mark with four characters after (567,575 cases) | 0 regressions against `main` in either, after the split-bracket fix; 112 before it (QA on #553) |
| Corpus measures, before and after ([notes/corpus-before.md](notes/corpus-before.md)) | repository 4% → 71%, team documents 3% → 89%, READMEs 4% → 16% byte-identical after one save |

## Scenarios

**App** = run in the dev build. **Test** = pinned by a unit or corpus test (named). **Not run** = with the reason.

| Scenario | How | Result |
|---|---|---|
| S1 #270's own fixture | App, `--mode word --expect word` | One line changed. Also `meeting-notes.md` and `breaks.md` |
| S2 markers and spacing | App, `--mode touch --saves 2` on `lists-markers.md`; Test | Byte-identical after two saves |
| S3 loose and tight | App (`lists-tightness.md`); Test | Byte-identical |
| S4 nested lists, spaces and a tab | App (`lists-nested.md`, `obsidian-note.md`); Test | Byte-identical |
| S5 a list under a line | App (`lists-under-a-line.md`, `meeting-notes.md`); Test | Byte-identical |
| S6 tasks and plain items | App (`tasks-mixed.md`); Test | Byte-identical |
| S7 editing a list | Test (`markdownAsWritten.test.ts`: a new `*` item, a deleted `+` item) | Only those lines change |
| S8 renumbering | Test (`markdownAsWritten.test.ts`) | `1. a` / `2. c` |
| S9 a break inside a task | App (`tasks-mixed.md`); Test | Byte-identical |
| S10 the agent's soft break | App (`issue-270-soft-break.md`) | Byte-identical; on `main` it was written as two trailing spaces ([research/fidelity-audit.md](research/fidelity-audit.md)) |
| S11 hard breaks keep their form | App (`breaks.md`); Test | Byte-identical |
| S12 a typed break | Test (`markdownAsWritten.test.ts`: `Line one\` / `Line two`) | A backslash, nothing after it. Not typed with Shift+Enter in the app: keyboard input does not reach a hidden window |
| S13 soft breaks in a quote | Test; the corpus | Byte-identical |
| S14 `git diff --check` | The corpus test (no trailing whitespace); the measures (0 files with new trailing whitespace in the repository and team corpora) | Quiet |
| S15 empty lines are empty | The corpus test; the cleanup fixture | Empty |
| S16 code keeps its spaces | App (`code-spaces.md`); Test | Byte-identical |
| S17 a ChatGPT answer | App (`chatgpt-answer.md`, `claude-answer.md`) | Byte-identical |
| S18 web addresses bare | App (`links.md`, `meeting-notes.md`); Test | Byte-identical |
| S19 underscores, brackets, numbers | App (`escapes-left-alone.md`); Test | Byte-identical |
| S20 escapes that matter | App (`escapes-negative.md`); Test | Byte-identical |
| S21 table alignment and spacing | App (`tables.md`); Test | Byte-identical |
| S22 a table edited | Test (`markdownAsWritten.test.ts`) | Old columns keep their alignment, the new one `---` |
| S23 thematic breaks | App (`thematic-breaks.md`); Test | Byte-identical |
| S24 Obsidian front matter | App (`obsidian-note.md`, `front-matter.md`, `front-matter-tight.md`); Test (`frontMatter.test.ts`) | Byte-identical |
| S25 a property changed | Test (`frontMatter.test.ts`) | Written as before |
| S26 a task card's page | Test (`cardFile.test.ts`, unchanged) | Pass. Not opened in the app |
| S27 a link into a folder | App (`links.md`) | The editor shows the link; the file keeps it after two saves |
| S28 setting a link into a folder | App (#502 probe: Edit Link from the link's end edge, `notes/report.md`); Test (`linkEdit.test.ts`) | `[old report](https://example.com/new)` after an edit; the folder address set |
| S29 links and marks around code | App (`links.md`) | The link around code and the bold around code show and are kept |
| S30 a row of screenshots | App (`images-row.md`) | Three images, one per paragraph, after two saves |
| S31 dangerous addresses | Test (`markdownAsWritten.test.ts`: `javascript:`, `vbscript:`, `data:`, `file:` refused) | Refused |
| S32 familiar documents side by side | Test (the look baseline from `main`) | Equal apart from R6's exceptions. **Not run:** the Light and Dark screenshots of `main` and the branch for the Experience lead |
| S33 editing feels the same | Partly: typing, deleting and the link dialog in the app runs | **Not run as its own pass:** Enter, Backspace, the list input rules, undo, paste, drag and drop, the slash menu |
| S34 a new list | Test (`markdownAsWritten.test.ts`) | `- item`, tight |
| S35 a new item in an old list | Test (`markdownAsWritten.test.ts`, S7's case) | Takes the list's form |
| S36 Save as Markdown from Word | Test (`markdownAsWritten.test.ts`, the shared service) | The same forms. **Not run in the app** with a `.docx` |
| S37 the corpus test | Test | Pass |
| S38 Windows line endings and a BOM | App on the Mac (`windows-crlf.md`, `utf8-bom.md`); Test | Byte-identical. **Not run on Windows** (the Windows round, E5) |
| S39 a file 2.0.1 saved | App (`saved-by-2-0-1.md`, two saves); Test (the cleanup fixture) | Equal to the pinned cleanup after two saves: the spaces on blank lines and the needless escapes (`\[1\]`, `## 1\.`) go once; markers and blank lines stay |
| S40 the agent changes the document | App | Review changes at 0.4 s; no VS Code notification in 8 s (on `main`: both, at 0.4 s and 0.8 s) |
| S41 Keep my version, then type | App | File = the person's text; tab clean; the next word auto-saved with no question |
| S42 Use disk version, then type | App | File = the outside text; tab clean; the next word auto-saved with no question |
| S43 the tab behind another | App (the document behind `tables.md`) | One Ritemark notification at 0.8 s: "\"google-docs-export.md\" changed on disk while you were editing it.", Review changes; choosing it brought the document forward with "Document changed in two places" open; no VS Code notification |
| S44 the same file in a text editor too | App (the Ritemark tab and a text editor tab of the same file, typing in the text editor) | Ritemark's notification for the file; no VS Code notification for it |
| S45 only VS Code's text editor | App (an editor association opening the file in the text editor) | VS Code's own "The content of the file is newer" notification at 1.2 s, as before |
| S46 Ritemark not running | **Not run as its own launch.** With no Ritemark editor the hand-over is never consulted, which is S45's path; the missing-command path is read in code ([research/save-conflict-audit.md](research/save-conflict-audit.md) §4) |
| S47 a sync client touches the file | App: the same text rewritten with CRLF while typing | No question; the file holds the person's text (with the model's line endings); tab clean. A date-only touch never reaches the handler (VS Code compares sizes) |
| S48 a synced folder | **Not run:** no OneDrive, iCloud or Google Drive folder here; the Windows round |
| S49 the disk already has the person's text | App, twice | Byte-identical write: VS Code let the save through itself. The person's text with CRLF line endings (other bytes): the save was refused, Ritemark answered `overwrite`, no question, the tab clean, the file the person's text |

## The smoke test (/rundev, the final build)

The last build of the branch, a fresh copy of the corpus, one launch:

- **One word edited and saved** in twelve real-looking files (meeting notes, a consultant's proposal, an analyst's report, a trainer's handout, ChatGPT's and Claude's answers, an Obsidian note, a Google Docs export, Ritemark's Save as Markdown, #270's list, a CRLF file and a BOM file): in each, `diff` shows exactly one changed line, the line with the word. The CRLF file keeps CRLF on all 21 lines, the BOM file its BOM. No question and no Retry in the bar. (The check's verdict first flagged the analyst's report and the CRLF file: the word went inside the closing `*…*` and before the `\r`, as typing there does; the check now allows both, and both pass.)
- **The other 18 kept files** touched and saved twice: byte-identical, no question, no Retry. The editor shows every link (`notes/report.md`, `../shared/brief.md`, `AGENTS.md` around code), the bold around code and the three images in a row.
- **The cleanup file and two known files** (`html.md`, `marks-nesting.md`) after two saves: equal to their pinned outputs.

## Adjacent fixes

| Fix | How | Result |
|---|---|---|
| #502 the link dialog edits the link | App (probe: the dialog's title and button say Edit; the file gets the new address); Test (`linkEdit.test.ts`) | Pass |
| #512 a false Retry document update | App (an outside write while the editor's animation frames are suspended, the one property of a window behind others that CDP can give it) | The new text shows, no Retry in 12 s. On `main`, Retry at 5.5 s. A real occluded window was not used |
| Brackets a mark splits (QA's B1 on #553): `[**x**]: y` reopened as a definition and the paragraph was gone | Test (`markdownAsWritten.test.ts`, 11 cases: bold, italics, strike, code, a comment mark, brackets inside a link's text); the corpus (`kept/brackets-around-marks.md`); the two fuzzes | Pass |
| The editor freeze on an overlapping diff | Test (`documentUpdate.test.ts`: a removed paragraph that ends like its neighbour); App (the touch-and-delete runs over the kept set, where `main`'s editor froze) | No freeze |

## Not run here, and why

- **Windows** (S38, S40–S48 on Windows, #454 as reported): the Development manager's Windows round from main after the merge (E5).
- **A real occluded window for #512:** Electron has no CDP call to hide a window; the run suspends animation frames instead.
- **Real Google Docs and Obsidian exports, and Jarmo's own folder** (decision 5): see the fidelity audit, §2.
- **S32's screenshots for the Experience lead, S33's full editing pass, S36 in the app, S46's own launch, S48.**
- **After the merge (E5):** a production build from a clean-room worktree at the merged commit; the drift check of patch 014 on the newest VS Code release.

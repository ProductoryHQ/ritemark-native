# Sprint 145 Spec: 2.1's loose ends

## Purpose

Twelve faults that 2.1's gates and first days found, or that the milestone carried: one that can lose a person's words (#588), two on the Task board, three small ones in Flows, the AI's sheet and Settings, two in the release's logs and project switch, two Windows and keyboard cases that have not been reproduced by hand, and the Electron security update. Each is reproduced first, then fixed or, where no reproduction exists, left as it is with the evidence. Each fix has a check that fails before it and passes after.

## Principles

- **Reproduce first.** Each requirement names how its fault is shown ([technical-plan.md](technical-plan.md#phase-1-reproductions-and-audits)). Where a cause isn't shown, the fix is called hardening, not the cause, and its issue closes only when its own check passes (no unproven diagnoses).
- **#588 gets the most care.** It is the only one that loses what a person wrote. It has the longest reproduction, a false-positive set, its own PR and a higher review level than its paths set (decision 2). Since 1 November its PR is shell-tier (the reload participant in patch 014), so High by paths.
- **No code without a reproduction** for #507, #501 and #569's patch half, as in 2.1.
- **The smallest change in the existing pattern.** For #588 (revised 1 November), a merge that asks only about a block both changed, through the document bar's existing Review changes and `DocumentConflictDialog`, and a shell hook in patch 014's own pattern; `StepNeedsKeyError` for #580; the board's own delete question and Trash for #596; the shared Button and Tooltip for every new control; no new subsystem.
- **The person's files are theirs.** Remove sends a card's file to the Trash and never deletes it; a guard that can't tell what was lost asks, never discards. For #588 (1 November): both changes stay; where both changed a block, the person's text stays in the document.
- **Records are untouched.** No card, flow, conversation or document format changes (E2).

## Requirements

### R1 (revised 2026-11-01): Both changes stay; no word is ever lost (#588)

**Revised by Jarmo's decision of 1 November 2026** (ritemark-dev decision log `735b186`; [#588's comment](https://github.com/ProductoryHQ/ritemark-native/issues/588#issuecomment-6556475375)), drawn by the Experience lead as **experience 44, *Editing alongside the AI*** (ritemark-dev `product/design/experience/experiences/alongside/README.md`, `ec25356`). The question is no longer whose version wins: both changes stay, as when two people edit in Google Docs or Word. The 31 October version is kept below as history. **Approved by Jarmo on 1 November** (decision log `819c63f`), with unsaved text merged too.

As someone typing in a document while an AI or another app writes the same file, I want both my words and the other writer's changes to stay, and to be asked only about a paragraph we both changed.

What is known: on `main`, a writer that saves a copy made from an older version replaces the person's newer words silently: 10 of 10 on the Mac, whether it writes 0.3 or 15 s after the last auto-save; ⌘Z doesn't bring them back ([research/stale-write-repro.md](research/stale-write-repro.md)). In those runs the writer's copy differs from the save it read only in the writer's own paragraph ([research/merge-checks.md](research/merge-checks.md), check 1). VS Code reloads a clean document from disk by itself, often before Ritemark's sync looks; the place to ask Ritemark first is `TextFileEditorModel.resolveFromFile`, reached through patch 014's own pattern (check 2).

Acceptance criteria:
- **Reproduced first** (done, A1; the Windows run waits): the stale write loses the later words on `main`.
- **The base.** When a clean document's file changes and the new text isn't Ritemark's own save, Ritemark finds the saved version the copy started from: the remembered save (or the text Ritemark last read or imported) from which the copy differs in the fewest blocks. Line endings, a byte order mark and a date-only touch are not differences.
- **The merge, by block** (a Markdown block: a paragraph, a heading, a whole list, a table, a code block, the front matter; a CSV row), three ways against the base:
  - a block only the writer changed takes the writer's text;
  - a block only the person changed keeps the person's;
  - blocks the writer or the person added or removed are added or removed;
  - a block both changed keeps **the person's** text, and the writer's version waits for Review changes.
- **Where it runs: the shell asks first.** VS Code asks Ritemark before it reloads a clean document Ritemark's editor holds, and uses the text Ritemark returns: the document never holds the writer's copy, so there is no race with VS Code's reload. When the merged text differs from the file, the document is dirty with it and VS Code's auto-save writes it. No answer within the budget (3 s, as patch 014's) means VS Code's own reload, then the fallback below. Ritemark's own poll or watcher, when it sees the change first, uses the same merge.
- **Nothing moves under the person** (experience 44): no highlight where the writer's change lands (experience 1, Jarmo 15 October: "NEVER MARK THOSE!"); the caret, the selection and the part of the page in view stay where they are, also when text above the view grows or shrinks (the page keeps its place by the caret's block). The document bar keeps saying Saved when nothing waits.
- **Both changed a block: the document bar's Review changes.** The existing button takes Saved's place, never takes the focus, never blocks typing. Its tooltip, and the notification when the tab isn't in front, are experience 44's words (the AI by name, ChatGPT, OpenCode or Claude, only when Ritemark knows that AI made the write in that turn; otherwise "another app"; a plural form for two or more blocks). Opening it scrolls to the block and opens `DocumentConflictDialog` in its paragraph mode: the title "A paragraph changed in two places", a first line saying what happened, the two blocks in full ("Yours, in the document" and the writer's), [Use Claude's] at the far left and [Keep mine] primary and the default; for two or more, "1 of 2" and one at a time. No warning icon. The button goes when every held block is chosen or both versions of each become the same; if the document closes first, the person's text is what was saved.
- **The button's one restyle, for every conflict:** ink with a hairline (`--r-hairline-strong`) and the `arrows-split` icon instead of the amber warning. The failed-sync kind keeps its look.
- **The merge is one undo step** in the editor the person uses: one ⌘Z undoes the whole merge (the writer's changes it brought in), not part of it. (Today Ritemark's editor takes host updates out of its history; that changes for the merge.)
- **The fallback, only when no base is found** (a whole-file rewrite that changed blocks everywhere, a reformat, a base older than the memory, or no answer from Ritemark in time): #605's whole-document question stays, with its window of 30 s from the person's last save of the words, its held import, its words, and the Experience lead's three changes (#605's comment of 1 November): the second paragraph "…Compare the changes, keep your version, or use the disk version." (and "Ritemark has preserved both versions. Compare the changes, keep your version, or use the disk version." for the dirty-document case); Use disk version `secondary`, not red; Use disk version alone at the footer's far left, then Compare changes and Keep my version, Keep my version primary and the default, Tab in screen order. A copy outside the window with no base still replaces the words, as in 2.1 (S8).
- **No question where nothing conflicts:** a writer that read the latest save (S2), or that rewrote the sentence just typed after reading it (S4), lands as written; line endings, a byte order mark and a date-only touch change nothing (S5, S6); Ritemark's own saves, a typo fix or undo of words just saved, and an edit from a text editor of the same file are never merged as a writer.
- **It is logged:** the sync log names the merge (blocks taken from the writer, blocks held, never the words) and the fallback.
- **The AIs' own tools are audited, not changed** (A2); the AI's edits stream straight into the document; no suggestions mode in 2.2 (#609).
- Markdown, CSV and files with front matter or CRLF endings behave the same.
- **Patch 014 changes** (corrected from the 31 October version): it gains the reload participant beside its save-conflict route. The save receipt and the save-conflict route are unchanged.

**Unsaved text is merged too** (Jarmo, 1 November, decision log `819c63f`: "salvestamata tekst samuti kokkupanekusse"). A writer that saves while the document has unsaved typing (S3, #454's path) is merged the same way, with the last save as the base and the document's text as the person's side; the merged text is saved over the writer's file (the refused save goes through, since the disk holds the copy Ritemark merged). #454's whole-document question stays only as the fallback when no base is found.

**As built (1 November), where it differs from the criteria above** (#605; each one is in [scenarios.md](scenarios.md)):
- **S4 asks, for Jarmo to confirm.** A writer that read the sentence just typed and rewrote it, and a writer that rewrote the same paragraph from the version before the sentence, write the same kind of copy: it shares every other block with both saves, so the two bases tie. Unless the copy carries more than half of the words the newer save added (then the writer read it: it rewrote a paragraph the person had just added, which lands as written), Ritemark takes the older one, so the person's sentence counts as the person's change, never as something the writer deleted: the person's paragraph stays and Review changes waits for it (Use the other copy puts the writer's in, one undo step). Taking the newer base would land S4 as the criterion says, and would silently drop the person's sentence in the second case, which is S1's loss. The criterion "or that rewrote the sentence just typed after reading it (S4), lands as written" doesn't hold; that is the cost of never losing words.
- **A copy that is exactly an earlier version** (a Discard of an AI's change, a checkout, a rewind) has no edit of its own to merge: merging it would keep the person's text and drop the writer's whole intent without a word. It takes the fallback: within 30 s of the save it leaves out, the whole-document question; after that, it replaces the words, as in 2.1.
- **The base** needs a third of the copy's blocks in common, in order (`MIN_BASE_LIKENESS`); below that, no base (the fallback). Unsaved text with no base gets #454's question, never the copy. Blocks are cut by blank lines, a fenced code block and the front matter each one block, a CSV record one block, a quoted field's newlines inside it (`src/editorSync/merge.ts`, not `marked`'s lexer: a list or a table has no blank line inside, so it is one block either way).
- **The writer is always "another app" in 2.2.** The host can tell which AI wrote a file through its own file tools, but no runtime event reaches the sync yet ([research/who-wrote-it.md](research/who-wrote-it.md), A10); the words take the AI's name when that is wired (a follow-up). S56–S58's "Claude" reads "another app" / "The other copy" until then.
- **No answer in time (S64)** isn't the fallback: VS Code reloads, and Ritemark merges from its own sighting a moment later (the views get the merge, never the writer's copy alone). The question comes only without a base.
- **Typing while a merge lands:** a keystroke from a view that hasn't shown the merge yet is merged on top of it (the view's last text as the base), never refused.
- **The notification** behind a hidden tab is an information notification, not a warning: the person's text is kept.
- **A kill switch** (Codex's review of #605): the flag `editor-sync-merge`, `stable` (on). Set to `disabled` in an extension release, Ritemark answers the shell nothing and the sync is 2.1's, with #454's question for a dirty document.
- **No warning icon on the fallback question either** (the Experience lead, ritemark-dev `8408035`): its header is the title alone, as the paragraph dialog's.

#### R1 as approved on 31 October 2026 (superseded on 1 November)

R1's title then: *Words a person typed and saved are never silently replaced by an older copy.*

As someone typing in a document while an AI or another app writes the same file, I want the words I typed and saved to stay unless I choose otherwise.

What is known: on Windows, with no AI involved, a writer that read the file after one auto-save, and wrote its copy (line 1 changed) after the person typed and auto-saved again, replaced the document with its copy while the document was clean. The later words were gone from the editor and the file, with no question and nothing logged. A writer that read the latest save, or that wrote while the document was dirty, was handled (#454). Last write wins on the file, as in 2.0.1 and in VS Code itself ([issue](https://github.com/ProductoryHQ/ritemark-native/issues/588)).

Acceptance criteria:
- **Reproduced first.** The issue's steps run on this Mac with no AI (a scripted dev instance and a plain file write as the "writer"), and on Windows through the test overlay, and lose the later words on `main`. The record says how long after the last save the stale write came, whether Ctrl+Z brings the words back after the reload, and for the Markdown, CSV and front-matter cases.
- **The guard.** When a clean document's file changes on disk, and the new text no longer contains words that Ritemark's own recent save wrote, the change is not imported silently. The document is a conflict: the editor keeps the person's text and Review changes is the question (Keep my version, Use disk, Compare), as for a dirty document.
- **"Recent" and "words the save wrote" are defined in the technical plan** and fixed from the reproduction's numbers, not guessed. What the guard can't cover (a stale write long after the last save) is stated in plain words (S8).
- **No new question where no words are lost.** A writer that read the latest save and changed another line is imported silently, as today. So are a rewrite of line endings or a byte order mark, and a sync client touching the file's date (#454's R11).
- **Both sides stay available.** Whichever Review changes answer is chosen, the other text can be seen (Compare) until then.
- **It is logged.** The sync log says when the guard held an import, and why, so the next sighting is not silent.
- **The AIs' own tools are audited, not changed.** For Claude Code, Codex and OpenCode, the record says what each does when the file changed since it read it, and what the 27 October sighting's write used. Findings go on the issue.
- Markdown, CSV and files with front matter or CRLF endings behave the same.
- **Patch 014 and the save receipt are unchanged.**

**R1 (revised 2026-10-31, after A1, [research/stale-write-repro.md](research/stale-write-repro.md)), also superseded on 1 November.** The original criteria stay; A1 adds what they assumed:
- **VS Code reloads a clean document from disk by itself.** On `main`, 8 of 10 S1 runs reached Ritemark's sync after VS Code had already put the writer's copy into the document (`converged`), 2 through Ritemark's own read (`external-only`). So the guard checks both, and "the editor keeps the person's text" means **the person's newest saved words are put back into the document** before Review changes asks.
- **Where the file sits while the question waits depends on who saw the change first.** When Ritemark sees it first (all 10 S1 runs on the branch), putting the words back makes the document dirty before VS Code reloads it; VS Code's auto-save is then refused as newer and the writer's copy stays on disk, as in #454. When VS Code reloaded first, the document is dirty against the writer's file and VS Code's auto-save writes the person's words back about a second later; the writer's copy is then kept in the question. Either way **Use disk version** ends with the writer's copy in the file and the editor, byte for byte, **Keep my version** with the person's words, and **Compare** shows both.
- **A second stale write while the question waits** is held the same way; the newest writer's copy becomes the question's disk side.
- **"Recent" is 30 s** from each of Ritemark's own saves, and "words the save wrote" are the runs of words a word alignment of the save with the text before it finds; one missing run asks (A1, *The window and the threshold*). Ritemark's own saves, including a typo fix or an undo of words just saved, and an edit made in a text editor of the same file are never held; a writer that only reformatted the words (a list marker, emphasis) isn't a loss (review rounds 1 and 2). A Discard of the file's changes, a checkout or an AI's checkpoint rewind within 30 s of typing in it is a writer too: it asks, and Use disk version completes it (the cost decision 1 names). S8's limit: a writer that saves its copy more than 30 s after Ritemark last saved the words still wins, as in 2.1.
- **The words** are the Experience lead's (issue #588, 31 October): the dialog's two sentences and the notification's one, for this case only. Review changes and its three buttons are unchanged.

### R2: A card the board can't read can be tried again or removed (#596)

As someone whose Task board lists a card it couldn't read, I want to try again, or remove it, and I want one plain sentence about what happened.

What is known: a row opens the file and does nothing else; the message says "Couldn't read" twice and shows the raw error (`ETIMEDOUT: connection timed out, read`). The cause of the three timeouts in the issue is not shown; the store lists a file it can't read as unreadable on purpose, so one stuck file doesn't empty the board (v1.14.0).

Acceptance criteria:
- **Reproduced first.** A file system whose read of three files times out (a unit test) lists them as the issue shows; a render test of the rows shows no action but opening. A running proof uses a file made unreadable on the Mac, and the Windows overlay a locked one.
- **Two kinds of row.** A file that couldn't be read gets **Try again** and **Remove**. A file whose front matter doesn't parse keeps **Open to fix it** and gets **Remove**.
- **Try again** reads that file again. If it reads, the card appears in its column and the row goes; if not, the row stays, unchanged, with no stacking and no flicker.
- **Remove** asks once, on the board, in plain words that name the file and say it goes to the Trash (Recycle Bin on Windows). It then moves the file there and never deletes it. If the Trash can't take it, the row stays and says why.
- **Only this board's card files can be removed this way:** a bare file name that is an unreadable entry in this board's folder. Any other name is refused.
- **The message** says what happened once, in plain words, without the error code (which goes to the log). The Experience lead's example: "Ritemark couldn't open this file in time. If this folder syncs from the cloud, the file may still be downloading."
- The rest of the board still loads when one file can't be read (the v1.14.0 behaviour stays; its test changes only for the new words).
- Every button is the shared Button with a tooltip that says what it does. The Experience lead draws the rows and the question first.

### R3: A dropped card moves at once (#597)

As someone dragging a card to another column, I want it to land where I let go, not a second later.

What is known: the webview sends `board/move` and keeps drawing the old snapshot until the host has read the board, ranked the card, written its file and rebuilt a full snapshot (with a file-exists check for every attached file). Where the second goes is not measured.

Acceptance criteria:
- **Measured first.** The time from the drop to the card's new place, and each host step's share (the read, the rank, the write, the snapshot, the file checks, the wait on the store's tail), with the real disk and with a slow file system. The table is in `research/` before any fix.
- **The card is in its new place in the same frame as the drop** (an optimistic move in the webview).
- **A refusal or a failed write puts the card back** where it was, and the notice says why in the host's words, as it does today (an agent is working on the card, Doing is full, the card is gone).
- **The same for Move to…, Mark done and Reopen** (the card menu and the card's page).
- **No flicker:** a snapshot that arrives while a move is pending, even one built before the move was written, does not put the card back in its old column.
- **If saving takes long**, a quiet sign on the card says it is being saved (the Experience lead draws it). It is not shown for a fast save.
- **If the snapshot is the slow part,** making the refresh cheaper is part of this, because it helps every surface. If a re-read of a stuck file holds the move, that is fixed too (R2's Try again must not hold the board either).
- The host stays the authority: the optimistic move is a guess that the answer confirms or undoes.

### R4: Selecting a Flow step doesn't save the flow (#571)

As someone looking at a Flow, I want the file left alone until I change something.

Acceptance criteria:
- **Reproduced first:** Sprint 144's headless harness shows `flow:save` after a click on a step on `main` (S27).
- Selection and measurement changes (`select`, `dimensions`) don't mark the flow dirty; moving, adding, removing and editing a step still do, and still save.
- Opening a flow writes nothing, and selecting a step leaves the file's modified time alone.
- A unit test of `onNodesChange` covers both.
- If the harness's save comes about 100 ms after the click, as the issue says, and the code's debounce is 500 ms, the second write path is found and closed too.

**R4 (revised 2026-10-31, after A9, [research/flow-save-timing.md](research/flow-save-timing.md)).** There is no second write path: the "about 100 ms after the click" is the save that opening the flow starts (500 ms after `flow:load`, with the harness clicking at 400 ms). Opening a flow with no click writes it once on `main`, and a click after that save is acknowledged writes it again 520 ms later. Both are the same cause and the same fix; "opening a flow writes nothing" is a check that fails on `main`.

### R5: A Flow step without its key says so in one sentence, with a link (#580)

As someone who builds a Flow, I want the same sentence and link on every step that needs a key, as the Google image step has.

The Experience lead's words (experience 31): the OpenAI image step and an AI step on OpenAI, "This step needs an OpenAI API key to run. Add it in Settings"; an AI step on Gemini, "This step needs a Google AI API key to run. Add it in Settings". In the panel, "Add it in Settings" is the link, with the tooltip "Open Settings at the OpenAI API key" or "Open Settings at the Google AI API key". In a run's error, plain text through `StepNeedsKeyError`.

Acceptance criteria:
- Each key has a copy object, and `StepNeedsKeyError` carries it; the four places that say something else today use it: `ImageNodeExecutor.ts` (OpenAI), `LLMNodeExecutor.ts` (OpenAI and Gemini), and the OpenAI image step's model list in `FlowEditorProvider.ts`, which the issue doesn't name.
- OpenAI gets its own Settings section id beside `google-ai-key`; the link opens Settings scrolled to that key's card.
- The step's panel shows the sentence and the link for the OpenAI image step, and for an AI step on either provider when its key is missing. The panel learns this from the host (an AI step has no such check today).
- A failed run shows the same sentence as plain text.
- The Google image step, and every step with its key set, behave as today.
- No key is read into the webview; the host only says whether one is missing.

### R6: A failed turn's done card has no green (#578)

As someone who sees a failed turn's card, I want green to mean only "ready".

Acceptance criteria:
- `TurnFailureCard` draws its done state in ink, as "You're all set!" does; the soft green background goes if the Experience lead says so.
- The other uses of the success colour are listed for the Experience lead, and none changes without the lead's word. Fixing one place of a class means finding the rest.
- A render test pins the done card's check and its colour. Screenshots in Light and Dark.

### R7: Settings shows the version people know (#595)

As someone reading Settings, I want "App 2.2.0 · Extension 2.2.0", not "Extension 2.2.0-0".

Acceptance criteria:
- The bundled extension keeps its floored version in `package.json` (`X.Y.Z-0`); only the label drops a bare `-0`.
- An update's own version (`2.2.0-ext.1`) shows as it is. Anything else, and an empty value, shows as it is.
- The helper is in the webview, where the label is drawn; the update comparison in `src/update/` keeps its floored version.
- A unit test covers the cases; Settings on a floored build shows the short version.

### R8: The release logs carry no avoidable error (#582)

As the person who reads the logs of a release candidate, I want two lines gone that mean nothing.

Acceptance criteria:
- **Shown first:** which request asks for `/phosphor.woff2` (the network list of a fresh hidden launch), and which module calls `url.parse()` (the stack of DEP0169).
- The font is asked for at its real place only; icons still draw (a screenshot). If the fix is in patch 001, it is a shell-tier change.
- DEP0169: if the caller is Ritemark's own bundle or a dependency we can move off it, it moves to `new URL()`, or the dependency is updated. If the caller is VS Code's own, the record says so, the log level question is answered, and nothing in VS Code changes without a reason.
- `main.log` and `exthost.log` of a fresh launch carry neither line, or the record says what stays and why.

**R8 (revised 2026-10-31, after A7, [research/log-lines.md](research/log-lines.md)).** The font request is Ritemark's own: patch 001's `iconRegistry.ts` registers `phosphor` with `URI.parse('phosphor.woff2')`, which VS Code writes into its icon style sheet as `vscode-file://vscode-app/phosphor.woff2`. The fix is in patch 001 (PR 5). DEP0169 did not reproduce in the dev build, whose built-in extensions don't start; Ritemark's bundle doesn't import Node's `url` module, so the caller is VS Code's or a built-in extension's, and finding it waits for PR 5's tree or the candidate. PR 2 has no DEP0169 item.

**R8 as built (PR 5, 1 November; [research/log-lines.md](research/log-lines.md)).** The registry's Phosphor font has no source and the icons' style sheet writes no `@font-face` for it; `codicon.css` declares the font at its real place in both builds. A fresh launch of PR 5's build logs no refused font, and `main`'s still does. DEP0169 is still not reproduced in a dev build (its built-in extensions don't start) and waits for the candidate (S41).

### R9: A project switch lays Home out once (#569)

As someone switching projects, I want Home to be laid out once, with the AI column already there or waiting for it.

What is known: measured on the 2.1.0 candidate, 9 of 10 switches showed a document for 429–492 ms before Home, and the AI column came 40–97 ms before Home (so Home drew beside it), except the first switch, whose project was left on Home: Home at 155 ms, the AI column 361 ms later. The 300 ms rule fails on both conditions.

Acceptance criteria:
- **Measured first:** `project-check.mjs --switch-to <folder> --measure 10` on `main`'s dev build and on the shipped 2.1.0, with markers that show who shows the AI column at about 500 ms (the workbench's restore or the extension), and whether the first switch of a launch is the outlier because of the project or because of the launch.
- After the fix, over 10 switches, in both directions (a project left on Home, a project left with a document): no document in front before Home, and the AI column within 300 ms of Home, either order.
- Home lays out once: the AI column keeps its place through the switch, or Home waits for it.
- If the cause is in the workbench (patch 002 or 018), the fix is in PR 5, the tier line stays shell, and Windows is proved at Gate 2.

**R9 as built (PR 5, 1 November; [research/switch-timing.md](research/switch-timing.md)).** The cause is the workbench's restore, in both parts. The AI column: patch 002 makes Ritemark AI the column's default, so its id is never stored, and the layout read the column's container before the extension's was registered, so it started the column hidden; patch 002 now restores Ritemark AI with the layout in a project window, and VS Code's "the column was empty before" rule no longer hides a new project's column. The document in front: the switch guard (patch 018) leaves a note when a switch reloads, and the new window's editor part puts Home's tab in front before it makes the grid, by the extension's own landing rule. While a column loads it shows the ground, not "Drag a view here to display." (018). `project-check.mjs --measure 10`: FAIL on `main`'s code, PASS 10 of 10 with PR 5's (Home first at once, the AI column in the same sample), the first switch included (S44).

### R10: The welcome, not a terminal, is in front on Windows' slow first start (#501)

As someone updating from 1.14 on a PC where the first start is slow, I want the welcome in front, not the terminal I had in 1.14's AI column.

What is known: on that start a restored terminal is in front for 6–14 s, then the welcome takes the front, and the terminal flashes in front again about 0.2 s later. 2.0.1 and 2.1.0 do the same. The warm second start is clean. The Mac doesn't show it.

Acceptance criteria:
- **Reproduced first on Windows,** with a 1.14 profile that has a terminal at quit, updated to the 2.1.0 installer: the times the terminal is in front before the welcome and after it. A slowed extension host on the Mac is tried too.
- **The second flash** (after the welcome) is fixed in the extension: the welcome keeps sending a restored terminal behind it for its whole first minute, not once.
- **The first wait** (before the welcome exists) is fixed only when the reproduction shows its cause. The direction is Jarmo's (decision 3); the recommended one keeps restored terminals behind until a document is in front, in patch 019.
- A terminal the person opens themselves still opens in front, named as before.
- Windows proof for the shell-tier half is 2.2's candidate at Gate 2.

**R10 as built (PR 5, 1 November; [research/first-start-terminal.md](research/first-start-terminal.md)).** Windows showed the cause (S45): patch 019's `moveToDesk(true)` opens a restored terminal `inactive` while the desk is still empty, and VS Code makes the first editor in an empty group the active one anyway (`editorGroupView.ts`). Restored terminals now wait in the panel for the desk's first editor that is not a terminal and open behind it, or open after a minute (VS Code's own limit for the extension host to start) when none comes. The Mac shows the same with the extension host held (S47), before and after. The second flash did not reproduce on Windows, and PR 2 made no extension change for it.

### R11: ⌘⇧P / Ctrl+Shift+P opens All commands on Home, every time (#507)

As someone on Home, I want the palette to open wherever the focus is on Home's page.

What is known: not reproduced with synthetic keys or by Jarmo's own keyboard on the Mac (ten presses per case at Gate 1). The films that showed it sent the key through a script, not a keyboard. The Windows run was never done by hand.

Acceptance criteria:
- **A person at a Windows keyboard** presses Ctrl+Shift+P, Ctrl+P and Ctrl+, ten times each in the cases of S48 (after a click on Home's title, after Tab to a control, in the line's input, after Home redraws, after coming back to Home's tab).
- If one fails, the cause is found (the record of the workbench's and Home's active element, and whether the key was forwarded) and a fix is planned under the scope-change protocol, in the place the cause names.
- If none fails, nothing changes in code, the evidence goes on #507, and it closes (decision 5), to reopen on a sighting. `scripts/qa/home-keys-check.mjs` is added either way so the next sighting has a reproducer.

### R12: The app ships on an Electron carrying Node 24.22.1 or later (#515)

As the owner of an app that talks to AI services, I want the Node security fixes of 21 October 2026 in the app.

What is known: on 27 October the newest Electron 43.x was 43.8.3 on Node 24.22.0; the fix to 24.22.1 was merged on Electron's 43 line and unpublished. Sprint 144 moved patch 020 to 43.8.3.

Acceptance criteria:
- **Availability is checked first,** at the start of the sprint and again before 2.2's candidate: the newest 43.x and its Node version, with the date.
- **If a 43.x with Node 24.22.1 or later exists,** patch 020 moves to it, as Sprint 144 did: `.npmrc`'s target, Electron's own `SHASUMS256.txt` byte for byte in `build/checksums/electron.txt`, the notices in `cgmanifest.json`. About shows the Node version; the build's checks and the native-module check pass; the extension host and the integrated browser start.
- **If none exists,** the risk is recorded in the release plan and on the issue, with Sprint 144's finding (one Node path to an outside address: Flows' Save File with an image URL), and decision 4 is Jarmo's.
- The extension host is checked again for any Node request to a URL a person or an agent supplies, because code has been added since 27 October.

**R12 (revised 2026-10-31, after A6, [research/electron-availability.md](research/electron-availability.md)).** A fixed Electron exists: 43.8.4 (27 October, 18:05 UTC, after Sprint 144 looked), 43.8.5 and 43.8.6 (30 October) are on Node 24.22.1. R12 takes its first branch: PR 6 moves patch 020 to the newest 43.x when it is made (43.8.6 today). Decision 4 applies only if PR 6 fails its checks. The extension host's Node network calls are unchanged since Sprint 144's list.

## Engineering requirements

### E1: Each fix has its check

Each requirement's check fails on `main` at the commit the branch starts from, and passes on the branch: a unit test where the cause is in code, a scripted run where it is in the running app. R11 and R12 (when nothing is published), which have nothing to fail, say so in the evidence. The evidence goes in `qa-evidence.md`.

### E2: Records and older versions

No conversation record, card file, flow, document or setting changes shape. R2 adds one optional field to an unreadable entry in the board's snapshot (its reason), re-words that entry's message, and adds two request types (try again, remove); a build that doesn't know them ignores them. A document, card or flow written by this build opens unchanged in 2.1.0.

### E3: Tier

Shell, by `patches/vscode/020-ritemark-electron-43.patch` and the expected changes to 001 and 019. The per-item tiers are in the sprint plan; the tier line changes first when an audit moves a fix. Since 1 November also `patches/vscode/014-ritemark-save-receipts.patch`: R1's reload participant (revised R1, approved).

### E4: Bundle

`media/webview.js` is measured before and after (`notes/bundle.md`).

### E5: Docs

`docs/development/architecture.md` where behaviour changes: the editor sync (the guard), the Task board (unreadable cards, the optimistic move), Flows (the key errors). `docs/CHANGELOG.md`. The release notes line for each user-visible change goes to the `release-notes` skill's draft, in plain words.

## Non-Requirements

- Changing an AI's own edit tool, or the order in which AIs read and write (R1 audits them).
- A guard on Flows' Save File image fetch (R12 records it; decision 4).
- Making a cloud drive's files arrive faster (R2 gives a way out, not a cure).
- A new element for #588 that the Experience lead hasn't drawn.
- The new Settings, the tooltip and focus-ring work, the card dialog over the board (Sprints 146–147).

## Decisions

**1 November 2026, Jarmo (decision log `735b186`):** #588's direction changes: both changes stay, merged by paragraph (R1, revised); the whole-document question is only the fallback; the AI's edits stream straight in, no suggestions in 2.2 (#609); the merge runs in the shell, next to patch 014. This supersedes decision 1 below, and decision 2's level is now High by paths. Approved on 1 November (`819c63f`), with unsaved text merged too.

Jarmo answered all five on 31 October 2026 ("agreed with all", in the Development manager session), each as recommended:

1. **#588: a question where there is silence today.** Yes. The guard asks (Review changes) when words saved in the last few seconds vanish from the file; the alternative is silent loss. It can also ask when an AI deliberately rewrites the sentence just typed.
2. **#588: the review level.** Decided by the Development manager (31 October): `/code-review` at high for this PR, though its paths set Standard.
3. **#501: the direction,** once Windows shows the cause. Restored terminals wait behind until a document is in front (patch 019), not a welcome that shows sooner than the extension.
4. **#515: no fixed Electron by the candidate.** Ship on 43.8.3 with the risk recorded; no guard on the Save File fetch.
5. **#507: no reproduction on Windows either.** Close with the evidence.

Still open:

- **For the Experience lead:** the rows and question for #596, the quiet sign for #597, the done card's background for #578. #588's words and look are drawn (experience 44, 1 November).
- ~~**For Jarmo:** whether a dirty document's writer (S3, #454) is merged too~~: yes (1 November, `819c63f`).

# Sprint 145 Spec: 2.1's loose ends

## Purpose

Twelve faults that 2.1's gates and first days found, or that the milestone carried: one that can lose a person's words (#588), two on the Task board, three small ones in Flows, the AI's sheet and Settings, two in the release's logs and project switch, two Windows and keyboard cases that have not been reproduced by hand, and the Electron security update. Each is reproduced first, then fixed or, where no reproduction exists, left as it is with the evidence. Each fix has a check that fails before it and passes after.

## Principles

- **Reproduce first.** Each requirement names how its fault is shown ([technical-plan.md](technical-plan.md#phase-1-reproductions-and-audits)). Where a cause isn't shown, the fix is called hardening, not the cause, and its issue closes only when its own check passes (no unproven diagnoses).
- **#588 gets the most care.** It is the only one that loses what a person wrote. It has the longest reproduction, a false-positive set, its own PR and a higher review level than its paths set (decision 2).
- **No code without a reproduction** for #507, #501 and #569's patch half, as in 2.1.
- **The smallest change in the existing pattern.** Review changes for #588; `StepNeedsKeyError` for #580; the board's own delete question and Trash for #596; the shared Button and Tooltip for every new control; no new subsystem.
- **The person's files are theirs.** Remove sends a card's file to the Trash and never deletes it; a guard that can't tell what was lost asks, never discards.
- **Records are untouched.** No card, flow, conversation or document format changes (E2).

## Requirements

### R1: Words a person typed and saved are never silently replaced by an older copy (#588)

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

**R1 (revised 2026-10-31, after A1, [research/stale-write-repro.md](research/stale-write-repro.md)).** The original criteria stay; A1 adds what they assumed:
- **VS Code reloads a clean document from disk by itself.** On `main`, 8 of 10 S1 runs reached Ritemark's sync after VS Code had already put the writer's copy into the document (`converged`), 2 through Ritemark's own read (`external-only`). So the guard checks both, and "the editor keeps the person's text" means **the person's newest saved words are put back into the document** before Review changes asks.
- **Where the file sits while the question waits depends on who saw the change first.** When Ritemark sees it first (all 10 S1 runs on the branch), putting the words back makes the document dirty before VS Code reloads it; VS Code's auto-save is then refused as newer and the writer's copy stays on disk, as in #454. When VS Code reloaded first, the document is dirty against the writer's file and VS Code's auto-save writes the person's words back about a second later; the writer's copy is then kept in the question. Either way **Use disk version** ends with the writer's copy in the file and the editor, byte for byte, **Keep my version** with the person's words, and **Compare** shows both.
- **A second stale write while the question waits** is held the same way; the newest writer's copy becomes the question's disk side.
- **"Recent" is 30 s** from each of Ritemark's own saves, and "words the save wrote" are the runs of words a word alignment of the save with the text before it finds; one missing run asks (A1, *The window and the threshold*). Ritemark's own saves, including a typo fix or an undo of words just saved, are never held (review round 1). S8's limit: a writer that saves its copy more than 30 s after Ritemark last saved the words still wins, as in 2.1.
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

### R9: A project switch lays Home out once (#569)

As someone switching projects, I want Home to be laid out once, with the AI column already there or waiting for it.

What is known: measured on the 2.1.0 candidate, 9 of 10 switches showed a document for 429–492 ms before Home, and the AI column came 40–97 ms before Home (so Home drew beside it), except the first switch, whose project was left on Home: Home at 155 ms, the AI column 361 ms later. The 300 ms rule fails on both conditions.

Acceptance criteria:
- **Measured first:** `project-check.mjs --switch-to <folder> --measure 10` on `main`'s dev build and on the shipped 2.1.0, with markers that show who shows the AI column at about 500 ms (the workbench's restore or the extension), and whether the first switch of a launch is the outlier because of the project or because of the launch.
- After the fix, over 10 switches, in both directions (a project left on Home, a project left with a document): no document in front before Home, and the AI column within 300 ms of Home, either order.
- Home lays out once: the AI column keeps its place through the switch, or Home waits for it.
- If the cause is in the workbench (patch 002 or 018), the fix is in PR 5, the tier line stays shell, and Windows is proved at Gate 2.

### R10: The welcome, not a terminal, is in front on Windows' slow first start (#501)

As someone updating from 1.14 on a PC where the first start is slow, I want the welcome in front, not the terminal I had in 1.14's AI column.

What is known: on that start a restored terminal is in front for 6–14 s, then the welcome takes the front, and the terminal flashes in front again about 0.2 s later. 2.0.1 and 2.1.0 do the same. The warm second start is clean. The Mac doesn't show it.

Acceptance criteria:
- **Reproduced first on Windows,** with a 1.14 profile that has a terminal at quit, updated to the 2.1.0 installer: the times the terminal is in front before the welcome and after it. A slowed extension host on the Mac is tried too.
- **The second flash** (after the welcome) is fixed in the extension: the welcome keeps sending a restored terminal behind it for its whole first minute, not once.
- **The first wait** (before the welcome exists) is fixed only when the reproduction shows its cause. The direction is Jarmo's (decision 3); the recommended one keeps restored terminals behind until a document is in front, in patch 019.
- A terminal the person opens themselves still opens in front, named as before.
- Windows proof for the shell-tier half is 2.2's candidate at Gate 2.

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

Shell, by `patches/vscode/020-ritemark-electron-43.patch` and the expected changes to 001 and 019. The per-item tiers are in the sprint plan; the tier line changes first when an audit moves a fix.

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

Jarmo answered all five on 31 October 2026 ("agreed with all", in the Development manager session), each as recommended:

1. **#588: a question where there is silence today.** Yes. The guard asks (Review changes) when words saved in the last few seconds vanish from the file; the alternative is silent loss. It can also ask when an AI deliberately rewrites the sentence just typed.
2. **#588: the review level.** Decided by the Development manager (31 October): `/code-review` at high for this PR, though its paths set Standard.
3. **#501: the direction,** once Windows shows the cause. Restored terminals wait behind until a document is in front (patch 019), not a welcome that shows sooner than the extension.
4. **#515: no fixed Electron by the candidate.** Ship on 43.8.3 with the risk recorded; no guard on the Save File fetch.
5. **#507: no reproduction on Windows either.** Close with the evidence.

Still open:

- **For the Experience lead:** the rows and question for #596, the quiet sign for #597, the done card's background for #578, the words (or a lighter button) for #588.

---
name: ritemark-visual-regression
description: Run a compact, evidence-backed visual regression session against Ritemark RUNDEV or an installed RC by acting like a real document user. Use for release-candidate testing, editor round-trip checks, or UI regression validation; do not use as a substitute for repository QA or release gates.
---

# Ritemark Visual Regression

Run ten completed end-to-end tests in the real desktop UI. Prefer a small finished matrix over a large unfinished plan.

## Required companions

- Use `computer-use` to operate an already-open installed RC.
- Use `ritemark-dev-smoke` or `ritemark-automation` to launch and drive RUNDEV.
- Use `macos-screenshots` for final evidence and inspect every screenshot before reporting a visual pass.
- For a release candidate, keep the `release-process` gates authoritative. This skill can block a release but cannot clear a release gate by itself.

## Windows host

`computer-use` and `macos-screenshots` do not exist there. The proven equivalent (v1.10.1 RC, 2026-09-10):

- Launch the installed RC a second time with its own port and profile: `Ritemark.exe --remote-debugging-port=9225 --user-data-dir=<scratch profile> <disposable workspace>`. The user's own window stays untouched, and a fresh profile gives a signed-out Claude state for free. This counts as an app launched with a dedicated debugging port.
- Drive it with CDP `Input.dispatchMouseEvent`, `Input.dispatchKeyEvent` and per-character typing, never DOM `.click()` or `execCommand`. Only real input proves which user action created a dirty state.
- Webview elements need page coordinates: add the webview `<iframe>` offset in the workbench, the `#active-frame` offset, and the element rect. Match the iframe by its `vscode-webview://<id>` segment. A title match is not enough, because "Ritemark" (the editor) and "Ritemark AI" share a prefix.
- In Git Bash, prefix every command whose arguments may start with `/` with `MSYS_NO_PATHCONV=1`. This is not testing-only: the same hazard silently broke Windows release signing verification in v1.11.0, where `signtool verify /pa /all` arrived with both flags rewritten to file paths. The release path now carries its own copy of this rule (`release` skill, cross-platform CI pitfalls) — a lesson recorded only here is invisible to release work, which never loads this skill. Otherwise a typed `/table` arrives as `C:/Program Files/Git/table`, straight inside the document.
- Capture evidence with `Page.captureScreenshot` and keep it in the session scratchpad, not `/tmp`.
- Count line endings at byte level. Git Bash `grep` strips `CR`, so `grep | cat -A` reports LF for a CRLF file.

## Test identity and isolation

Before editing, record:

- RUNDEV or installed RC;
- visible version/source when available;
- workspace path;
- evidence directory under `/tmp/ritemark-visual-regression/<timestamp>/`.

Use a disposable or explicitly approved project. Create all material under one clearly named folder such as `docs/qa-rc-X.Y.Z/`. Do not modify unrelated documents. Never silently reuse a previous run's files as fresh evidence.

## Ten-test core matrix

Complete these tests in order, adapting document names and copy to the user's project:

1. Open the intended project and confirm the editor, File Browser, and AI sidebar render.
2. Create a QA folder and a Markdown document through File Browser. Click into the new editor before typing. After the inline name box closes, focus can stay in the File Browser tree, and keystrokes then go to tree navigation instead of the document.
3. In the empty file, type `# ` before any body text, finish the H1, and confirm it renders as H1.
4. Create an H2 and a bulleted or numbered list; confirm keyboard continuation and exit behavior.
5. Insert a task list through the slash menu, add at least two items, and check one item.
6. Insert and fill a 3x3 table using Tab navigation.
7. Save explicitly; confirm no disk-conflict or stale-file warning appears.
8. Create a second document, use multiple tabs, then close and reopen the first document.
9. Inspect model, permission, and effort controls; when AI access is available, run one read-only active-document request and confirm completion without file edits. A disabled effort control carrying the tooltip "This model chooses its own thinking effort." is correct, not a failure. When the release touches agent runtimes or editor sync, add one write task on the open document: the change must appear in that editor without reopening, with no conflict or "changed on disk" warning, and only that file may change.
10. Execute the round-trip gate below and compare both UI and disk state.

If a product area is unavailable, replace it with a comparable real-user action and record the substitution. Do not count a planned or partially executed case as completed.

## Mandatory round-trip gate

For structural Markdown—especially task lists, tables, nested lists, comments, or images—validate the full lifecycle:

```text
create in UI -> save -> inspect disk -> close tab -> reopen -> inspect UI
-> make a harmless edit -> save -> inspect disk again
```

Capture the raw Markdown before close and after the post-reopen save. A visual match without disk preservation is not a pass. A disk match without reopening and visually inspecting the editor is not a pass.

For task lists, assert all of these:

- unchecked and checked items render as checkboxes after reopening;
- checked state survives;
- a valid loose GFM fixture (`- [ ] A`, blank line, `- [x] B`) also reopens as checkboxes;
- record the loose fixture's disk hash before opening it; opening alone must neither change the hash nor mark the tab dirty;
- perform one real visible checkbox click and confirm that this user action, not an editor-internal transaction, creates the dirty state;
- the first disk snapshot contains `- [ ]` and `- [x]`;
- the second disk snapshot still contains the same markers;
- an unrelated edit does not normalize task items into ordinary bullets.

Any silent content or structural loss is a release blocker.

`textContent` concatenates across `<br>`, so a hard break reads as merged words. Inspect `innerHTML` or the editor JSON before calling a paragraph merged. A soft line break coming back as a two-space hard break on save is known source rewriting ([#270](https://github.com/ProductoryHQ/ritemark-native/issues/270)). Record it, but do not count it as a new failure.

## Failure-envelope regression protocol

When a change touches AI terminal states, authentication recovery, or stored conversation migration, extend test 9 with a fixture copied from the real failing provider event. Redact user content and seed it only into an isolated RUNDEV profile; never edit the user's live conversation store.

Validate the complete envelope path rather than mocking the final card:

```text
provider event -> runtime normalization -> stored record decode
-> conversation projection -> rendered recovery UI -> reload -> rendered recovery UI
```

For an authentication failure, assert all of these before reporting a pass:

- the provider's structured failure signal (for example `is_error` or an explicit error field) produces a failed terminal event;
- the raw provider error is absent from the visible conversation;
- no successful `Done` state appears for the failed turn;
- the conversation title comes from the user's prompt instead of the error text;
- the recovery card has user-facing copy and a working sign-in action;
- the action bar follows the global convention: secondary actions left of the rightmost primary action;
- the same state survives a real workbench reload.

Use DOM or accessibility assertions for text absence, terminal state, and control geometry. Then capture the whole RUNDEV window and visually inspect wrapping, clipping, color, radius, spacing, and action alignment. Neither assertion layer replaces the other.

## Evidence protocol

For each test, keep a concise result: `PASS`, `FAIL`, or `BLOCKED`, the user action, and the observed outcome. Capture screenshots at meaningful state boundaries rather than every click. At minimum capture:

- empty-file H1 result;
- task list before close;
- task list after reopen;
- filled table;
- AI menus and completed response when tested;
- any failure-recovery card exercised under the failure-envelope protocol, both before and after reload;
- final results document.

Visually open every screenshot used as evidence. Do not infer a visual pass from accessibility text alone. Use accessibility state and raw files as additional deterministic evidence.

An agent turn is complete only when a standalone `Done` line is present, no Stop button is shown, and the composer is back at its idle placeholder. Progress labels such as `Done: commandExecution` also contain the word "Done". Run file-hash checks after that terminal state, never while the agent may still be working.

Check the editor tab's dirty marker at three points: it should be present after a user edit, absent after an explicit save, and must not reappear merely because a saved file was closed and reopened. Record an unexpected dirty marker even when document content is preserved.

If macOS locks during a RUNDEV session, continue only through the already-authorized local CDP connection. Capture screenshots from the RUNDEV page target and inspect them normally. Do not substitute accessibility text alone for visual evidence, and do not use this fallback to interact with an installed production app that was not launched with a dedicated debugging port.

Write `regression-results.md` inside the QA folder with the ten results, evidence paths, and release decision. Leave the app open on that report unless the user asks otherwise.

## Scripted packaged-build canary

`scripts/packaged-canary.sh <Ritemark.app> <out-dir>` drives a packaged build over CDP with an
isolated user-data directory and a seeded workspace, and prints one PASS/FAIL line per check:
no trust dialog; a typing burst with Enter in the middle of a list item on a plain and on a
front-matter document, followed by undo and redo; the saved file ending in exactly one newline
and front matter preserved; the task fixture opening without touching the file, checkbox and
text on one row, toggle + save persisting `- [x]`; Slash → Task List surviving autosave, save,
close and reopen as an empty checkbox; Home recents. It exits non-zero on any failure.

Run it before every Gate ask, on the app copied out of the signed DMG, never on RUNDEV. It
exists because the v1.10.1 candidate canary paused one to two seconds between steps and never
exercised the host echo window; typing at tool speed with autosave on is what exposed the
regression. Add a `window.__rmSyncTrace` probe (see the automation skill) when a result needs
explaining, not as a release gate.

## Stop conditions

Stop release progression and report `RELEASE BLOCKED` when any test shows data loss, stale editor state, a false disk-conflict warning, an unusable core control, or a crash. Preserve the failing fixture and screenshots. Do not notarize or dispatch paid multi-platform builds from a failed RC.

For non-blocking visual defects, finish the matrix and report severity separately.

## Continuous improvement

After each real session, update this skill only when observed evidence reveals a reusable missing check, false assumption, or more deterministic procedure. Keep the core matrix at ten tests unless the user explicitly changes the scope; improve the quality of the ten checks instead of growing an unbounded checklist.

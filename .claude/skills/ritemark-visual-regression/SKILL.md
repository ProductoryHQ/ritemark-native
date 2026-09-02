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
2. Create a QA folder and a Markdown document through File Browser.
3. In the empty file, type `# ` before any body text, finish the H1, and confirm it renders as H1.
4. Create an H2 and a bulleted or numbered list; confirm keyboard continuation and exit behavior.
5. Insert a task list through the slash menu, add at least two items, and check one item.
6. Insert and fill a 3x3 table using Tab navigation.
7. Save explicitly; confirm no disk-conflict or stale-file warning appears.
8. Create a second document, use multiple tabs, then close and reopen the first document.
9. Inspect model, permission, and effort controls; when AI access is available, run one read-only active-document request and confirm completion without file edits.
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

## Evidence protocol

For each test, keep a concise result: `PASS`, `FAIL`, or `BLOCKED`, the user action, and the observed outcome. Capture screenshots at meaningful state boundaries rather than every click. At minimum capture:

- empty-file H1 result;
- task list before close;
- task list after reopen;
- filled table;
- AI menus and completed response when tested;
- final results document.

Visually open every screenshot used as evidence. Do not infer a visual pass from accessibility text alone. Use accessibility state and raw files as additional deterministic evidence.

Check the editor tab's dirty marker at three points: it should be present after a user edit, absent after an explicit save, and must not reappear merely because a saved file was closed and reopened. Record an unexpected dirty marker even when document content is preserved.

If macOS locks during a RUNDEV session, continue only through the already-authorized local CDP connection. Capture screenshots from the RUNDEV page target and inspect them normally. Do not substitute accessibility text alone for visual evidence, and do not use this fallback to interact with an installed production app that was not launched with a dedicated debugging port.

Write `regression-results.md` inside the QA folder with the ten results, evidence paths, and release decision. Leave the app open on that report unless the user asks otherwise.

## Stop conditions

Stop release progression and report `RELEASE BLOCKED` when any test shows data loss, stale editor state, a false disk-conflict warning, an unusable core control, or a crash. Preserve the failing fixture and screenshots. Do not notarize or dispatch paid multi-platform builds from a failed RC.

For non-blocking visual defects, finish the matrix and report severity separately.

## Continuous improvement

After each real session, update this skill only when observed evidence reveals a reusable missing check, false assumption, or more deterministic procedure. Keep the core matrix at ten tests unless the user explicitly changes the scope; improve the quality of the ten checks instead of growing an unbounded checklist.

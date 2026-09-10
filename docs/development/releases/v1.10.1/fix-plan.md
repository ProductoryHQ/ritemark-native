# v1.10.1 fix plan — editor sync regression and task-list defects

**Status:** DRAFT, awaiting Jarmo's approval. No fix code is written before the approval phrase.<br>
**Decision already taken (Jarmo, 2026-09-10):** the current candidate artifacts (arm64 DMG `13c061d8…`, x64 DMG `d42d42f5…`, Windows installer `c4315264…`) are discarded. None is notarized or published. The version stays 1.10.1.<br>
**Approach:** patch, not rewrite. Both Claude and Codex reached the same conclusion independently: the sync subsystem (Sprint 115) is sound; the defects are two narrow conversion gaps and one CSS-visible parsing artifact.

## 1. Findings

### Bug 1 — the host pushes the document back into the editor on every change (typing-level regression)

Symptoms: periodic "clean and override" while typing; Enter inside a list sometimes does nothing; the first `Cmd+Z` does nothing and the second undoes (an invisible transaction in the undo history); newly created task items degrade to a bullet with literal `[ ]`.

Mechanism, proven parts:
- The webview's Markdown projection never ends in a newline (Turndown trims trailing whitespace).
- `serializeFrontMatter` in `ritemarkEditor.ts` writes that projection **plus one newline**: via `ensureTrailingNewline` (#254) when the document has no front matter, via `gray-matter` when it has.
- Logical equality in `editorSync` is `sha256(normalizeLogicalText(x))`, and `normalizeLogicalText` strips a BOM and folds CRLF but leaves a trailing newline significant. The two sides therefore never hash equal.
- A/B on RUNDEV (Jarmo, 2026-09-10): removing only the `ensureTrailingNewline` call made `plain.md` (no front matter) behave; `frontmatter.md` stayed broken. So the mechanism is older than #254 (front-matter documents had it in v1.10.0 too) and #254 extended it to every ordinary document. In scope it is a v1.10.1 regression.

Not yet pinned: the exact hop where the mismatch turns into a push, and why the push lands as a history-recorded transaction. Candidates: the `document:update` handling in `webview/src/App.tsx` (`setContent` around line 211 and `editor.commands.setContent(newHtml)` around line 437) and `webview/src/documentSyncReducer.ts`. The webview does hash content (`App.tsx`, `types/documentSync.ts`), so the first thing to check is whether its hash and the host's hash are computed over the same text.

### Bug 2 — task item checkbox renders above its text

Codex measurement (RUNDEV, 2026-09-10): the flex CSS applies (`display: flex`, `align-items: baseline`, the `li` carries `tiptap-task-item`); the task text node contains `" \nA"` and `white-space: break-spaces` renders that newline, so the checkbox aligns with an empty first line. Claude's measurement agrees (text block 24 px right of the label, not below it). The leading whitespace is left behind when the `[ ]` marker is removed in the Markdown → HTML → TipTap conversion (`webview/src/utils/taskListRoundTrip.ts`, `preprocessTaskListHTML`). Reproduces for items read from disk and for items created live. Almost certainly pre-existing: this code and the CSS are byte-identical to v1.10.0.

### Bug 3 — an empty task item degrades to a bullet with literal `[ ]`

Codex hypothesis, consistent with every observation: an empty task item serializes to `- [ ] `, the trailing space is trimmed, and `- [ ]` alone is not parsed as a task item on the way back, so it becomes a bullet whose text is `[ ]`; a later serialization escapes the brackets as text. Bug 1 exposes it (each push is a round trip), which is why it appears instantly after **Slash → Task List**. Without Bug 1 it would still bite on any save of an empty task item. Not yet proven with captured intermediate values.

### Verified not lost

Existing `- [ ] A` / `- [x] B` markers survive an unrelated edit, a save, close/reopen and a checkbox toggle (Codex, isolated v1.10.1 copy). No silent marker loss. Reading task lists from disk works.

### Out of scope, tracked separately

- List shape normalization on save: tight bullet lists become loose with `-   ` markers; loose task lists become tight. Turndown defaults, pre-existing. Separate issue.
- `store_url` host in `build-windows.yml`: before Partner Center, after publication.

## 2. Fix design

**F1a — one canonical logical text (host).** Define the canonical form once and hash it on both sides. Recommended: hashing ignores trailing newlines (`normalizeLogicalText(x).replace(/\n+$/, '')` inside `logicalHash`), leaving `normalizeLogicalText` itself untouched because `encodeDocumentBytes` uses it to write the file and must keep the newline. `ensureTrailingNewline` (#254) stays; it is correct, it only exposed the gap.

**F1b — silent, idempotent apply (webview).** A `document:update` whose payload is logically equal to the current editor content is a no-op. When it is not equal, apply it with `addToHistory: false` (the pattern already exists at `Editor.tsx:694`), preserve the selection where possible, and never apply while a local edit is in flight. This layer also protects the genuine external-change case and must not be skipped.

**F1c — shared contract.** The canonical-text rule lives in one place per package (`src/editorSync/state.ts`, `webview/src/types/documentSync.ts`) with an identical test-vector table in both test files, so the two packages cannot drift.

**F2 — task item parsing.** After removing the checkbox marker, strip the formatting whitespace it leaves (`" \n"`) from the first text node without touching real hard breaks or later paragraphs. Fixture set: tight, loose, nested, item with a hard break, item with two paragraphs.

**F3 — empty task item round trip.** Make the parser accept a bare `- [ ]` / `- [x]` as an empty task item and make the serializer keep the marker form stable, so create → save → reopen preserves an empty task item. Decide the exact on-disk form for an empty item and pin it in a test.

## 3. Workstreams — run in parallel

Agree the 10-line interface contract first (canonical text definition, `document:update` no-op rule, on-disk form of an empty task item). Then:

| WS | Scope | Owner (proposed) | Branch | Files | Must not touch |
| --- | --- | --- | --- | --- | --- |
| A | F1a + F1c host side; locate the push site | Codex | `fix/sync-canonical-hash` | `src/editorSync/state.ts`, `DocumentSyncCoordinator.ts`, `state.test.ts`, new coordinator test | anything under `webview/` |
| B | F1b + F1c webview side | Claude | `fix/sync-silent-apply` | `webview/src/App.tsx`, `documentSyncReducer.ts`, `types/documentSync.ts`, tests | `src/editorSync/*`, `taskListRoundTrip.ts` |
| C | F2 + F3 | Claude subagent or second Codex | `fix/task-item-roundtrip` | `webview/src/utils/taskListRoundTrip.ts`, `turndownService.ts`, their tests, CSS only if F2 proves insufficient | sync code in either package |
| D | Release harness and record | Claude | `docs/v1.10.1-release-record` (exists) | release worktree, CI dispatch, `TEST-CHECKLIST.md`, `CHANGELOG.md`, follow-up issues, skill update for canary speed | product code |

Dependencies: B and A share only the contract; C is independent of both; D starts immediately and waits only for the merged tip. Each workstream opens its own PR with a failing test first. Merge order A → B → C, then #267 (LF bundle + `.gitattributes`) rides the same train because the bundle is rebuilt anyway.

Environment: unit tests run in any worktree after `npm ci` in `extensions/ritemark` and `webview`. RUNDEV lives in the primary checkout; use it serially for canaries and leave `codex/ms-store-hosting`'s uncommitted store work alone. The final canary runs on the packaged arm64 build, never on RUNDEV.

## 4. Quality criteria — all must hold before the build commit is chosen

- **Q1 Hash parity.** For documents with and without front matter, after a webview edit is applied, the host's model hash equals the hash the webview computes for its own projection. Deterministic test, both packages, shared vectors.
- **Q2 Idempotent update.** A `document:update` logically equal to the current content changes nothing: no transaction, undo depth unchanged. Deterministic webview test.
- **Q3 Silent apply.** A genuinely different `document:update` is applied without adding an undo step; one `Cmd+Z` afterwards reverts the last **user** action. Deterministic webview test plus canary.
- **Q4 Typing race.** Automated typing at 20 ms per key, including Enter in the middle of a list item, with autosave on, produces exactly the typed text; no lost Enter; no phantom undo. Run against RUNDEV during development and against the packaged arm64 build before Gate 2. Front-matter and no-front-matter variants.
- **Q5 #254 still holds.** A saved no-front-matter document ends in exactly one `\n`; a front-matter document is byte-identical to today's output.
- **Q6 Task item geometry.** For tight, loose and nested fixtures, the first text node has no leading whitespace, and the checkbox and text bounding boxes are on one row (vertical delta under 4 px) measured over CDP; the screenshot is inspected by a person.
- **Q7 Empty task item round trip.** Slash → Task List → save immediately → reopen: still an unchecked, empty task item; then type text → save → the agreed on-disk form.
- **Q8 Data-loss gate.** `- [ ] A` / `- [x] B` survive unrelated edit, save, reopen, toggle, save; markers present in both disk snapshots; opening alone leaves the hash unchanged and the tab clean.
- **Q9 Suites green.** `npm run compile`, `npm test` (with the new tests appended to the chain), webview `typecheck` and `build`, pre-commit hook, Check 5 bundle freshness.
- **Q10 Release gates.** Fresh release worktree at the merged tip, `build-prod.sh` clean, mounted-DMG hard checks, packaged canary Q4 + Q6 + Q8, Gate 2 by Jarmo on the real artifacts, ≥60 min hardening before notarization, three assets and the update feed published together.

## 5. Sequence

1. Jarmo approves this plan and the contract choices (section 6).
2. WS-A, WS-B, WS-C in parallel; WS-D prepares the harness and the record.
3. PRs reviewed, merged A → B → C → #267 (admin merge by Jarmo).
4. WS-D: new release worktree at the merged tip; arm64 build; dispatch x64 and Windows CI against the same commit (repo private for the Windows runner, back to public after); extract, sign, DMG.
5. Packaged canary (Q4, Q6, Q8) on arm64; checklist updated; Gate 2 hand-off with all three artifacts.
6. Hardening, notarize both DMGs, publish three assets plus `update-feed.json` seeded from the v1.10.0 feed, CHANGELOG date, post-release issue sweep.

## 6. Decisions needed

- **D1** Approve the plan and the workstream owners.
- **D2** Canonical form for hashing: ignore trailing newlines (recommended) or require exactly one.
- **D3** On-disk form of an empty task item (`- [ ] ` with the space, or `- [ ]`), pinned by test.
- **D4** Include #267 in this train (recommended: yes, the bundle is rebuilt anyway and it closes the CRLF path).

## 7. Follow-ups filed separately

- Tight/loose list shape preservation on save.
- Visual-regression skill: the canary must type at human speed; paused steps hid this race.
- `store_url` host correction (`build-windows.yml`) before Partner Center.

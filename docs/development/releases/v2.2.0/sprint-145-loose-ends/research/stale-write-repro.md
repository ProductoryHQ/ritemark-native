# A1: The stale write, reproduced (R1, S1–S8, #588)

Run on 31 October 2026 on the Mac, on `main` at `39b4e37f`, in one hidden dev instance (a fresh profile under `/private/tmp`, scratch homes for the AIs, `--use-mock-keychain`, the three backgrounding flags, CDP on a port checked to be free; the shell is the copy-on-write VS Code 1.142 tree described in [log-lines.md](log-lines.md)). The profile keeps the shipped auto-save (`files.autoSave: afterDelay`, 1000 ms). No AI was involved: the writer is the check itself (`fs.readFileSync`, then `fs.writeFileSync`).

The check is [`scripts/qa/stale-write-check.mjs`](../../../../../../scripts/qa/stale-write-check.mjs): a new three-paragraph Markdown file per run, opened in Ritemark's editor with Quick Open, text typed over CDP at the end of the last paragraph, "auto-saved" when the words are on disk, the writer's read and write, and 4 s later the editor's text, the file, whether Review changes shows, and the `[EditorSync]` lines the extension host logged since the write. After a run that lost words it presses ⌘Z once in the editor.

```bash
node scripts/qa/stale-write-check.mjs --attach --port <port> --workspace <folder> --cases s1 --runs 2 --delay <ms>
node scripts/qa/stale-write-check.mjs --attach --port <port> --workspace <folder> --cases s2,s3,s4,s5crlf,s5bom,s6,s7fm,s7fm2,s7crlf,s7crlf2
```

Without `--attach` it starts and quits its own hidden instance. The Windows run (S1 through the test overlay, ten times) is the "Ritemark on Windows" session's: **waiting**.

## S1 on `main`: ten of ten lose the second sentence (measured)

| Delay from the second auto-save to the stale write | Runs | Result | Review changes | ⌘Z brings it back | Ritemark's path (`[EditorSync]` log) |
|---|---|---|---|---|---|
| 0.3 s | 2 | **lost** | no | no | `poll:external-only` (Ritemark's own 3 s poll saw the file first and imported it) |
| 1 s | 2 | **lost** | no | no | `model-change:converged` |
| 3 s | 2 | **lost** | no | no | `model-change:converged` |
| 8 s | 2 | **lost** | no | no | `model-change:converged` |
| 15 s | 2 | **lost** | no | no | `model-change:converged` |

Each time the editor and the file end with the writer's copy: line 1 changed, the first sentence kept (the writer had read it), the second sentence gone. No question, no notification. The only log lines are an ordinary transition and the update's delivery. How long after the last save the write comes doesn't matter.

## The false-positive set and S7 on `main` (measured, one run each unless stated)

| Case | What the writer did | Result on `main` |
|---|---|---|
| S2 (×3) | read the latest save, wrote it back 5 s later with line 1 changed | silent import, nothing lost (`model-change:converged`) |
| S3 | wrote while the person's second sentence was not yet saved (#454) | **Review changes** (`model-change:conflict`) |
| S4 | read the latest save and replaced the sentence just typed | silent import: the person's sentence replaced (`converged`) |
| S5, CRLF | rewrote the same words with CRLF endings | silent, nothing changed (`watcher:synced`) |
| S5, BOM | rewrote the same words with a UTF-8 byte order mark | silent, nothing changed (`watcher:synced`) |
| S6 | changed only the modified time | silent, no transition at all |
| S7, front matter | S1 on a file with front matter | **lost**, as S1 |
| S7, front matter | S2 on it | silent import |
| S7, CRLF file | S1 on a file with CRLF endings | **lost**, as S1 |
| S7, CRLF file | S2 on it | silent import |

CSV is covered by the coordinator-level test, not this check: typing into the table over CDP is a different editor.

## What the paths mean for the guard (measured)

**In 8 of the 10 S1 runs VS Code itself had already reloaded the clean document from disk before Ritemark's sync looked.** The log's `model-change:converged` is the coordinator seeing a document whose text already equals the new file: VS Code's text-file service reloads a clean (saved) model when its file changes, and Ritemark only sees the result. In the other 2 (the writer 0.3 s after the save), Ritemark's 3 s poll happened to read the file first and imported it itself (`external-only`), and VS Code's reload would have followed.

So the plan's branch alone (technical plan, W1: "in `reconcile`'s `external-only` case, before `applyText`") would hold 2 runs of 10. And not importing is not enough: VS Code puts the writer's copy into the document anyway. What this changes in R1 (`spec.md`, 31 October addendum):

1. The guard checks both `external-only` and `converged`.
2. Holding the import means **putting the person's saved words back into the document**, then asking. When Ritemark sees the change first, the same text is applied as an edit: the document turns dirty before VS Code reloads it, VS Code skips the reload, its auto-save is refused as newer and the writer's copy stays on disk while Review changes waits, as in #454. The guard runs before the sync's 25 ms wait for VS Code's reload, so on the branch this was every S1 run (below).
3. When VS Code reloaded first, the document is dirty with the person's words against the file VS Code just read, so VS Code's auto-save writes them back about a second later; nothing refuses it. The writer's copy is then kept in Review changes. Either way **Use disk version** ends with the writer's copy in the file and the editor (written back byte for byte when the file no longer holds it), **Keep my version** with the person's words, and **Compare** shows both.
4. If VS Code reloads a writer's copy again while the question waits (a second write), the person's words are put back again and the newest writer copy becomes the disk side of the question.

## The window and the threshold (chosen from these numbers)

- **The loss doesn't depend on the delay** (0.3–15 s all lose), so the window can't come from a failure boundary. It is a trade-off between a stale write that lands later (S8) and a question when a writer deliberately rewrites words the person saved earlier (decision 1). The Windows run and this one wrote within 0.3–15 s of the last save; the 27 October sighting's AI write landed in a pause between two typed sentences. **30 seconds** from each of Ritemark's own saves (`STALE_WRITE_WINDOW_MS`).
- **Threshold: one missing word run.** The words a save added are the run between what it shares with the text before it; a run counts as lost when the person's newest save still has it and the new file doesn't. Runs, not single words, so a common word elsewhere in the file doesn't hide a lost sentence, and a writer that removed a different occurrence of one of the person's words isn't a loss.
- **S8, the limit, in plain words:** if another app or an AI read the document earlier and saves its copy more than 30 seconds after Ritemark last saved your words, its copy still replaces them, as in 2.1.

## A second race: the save's receipt after the sync's reconcile (measured, found while fixing)

VS Code tells the extension host a saved document is clean (a change event with no content change) before it fires the save with patch 014's receipt. On the Mac the sync's reconcile of that change event often finished first: the transition after a save reads `model-change:converged` instead of `model-change:local-save-echo` (every S4 save on `main` and on the branch's first build, and about a third of the S1 saves). The first build of the guard then recorded such a save as adding nothing, so S4 (one save) was imported silently. The fix keeps what was on disk before a `converged` base for that save's receipt; the coordinator-level test plays both orders for every scenario.

## On the branch (measured, after the fix, same instance reloaded)

| Case | Runs | Result |
|---|---|---|
| S1, writer 0.3–15 s after the second save | 10 (2 per delay) | **Review changes, 10 of 10**; the editor keeps both sentences; the writer's copy stays on disk while the question waits (Ritemark saw the file first in every run: `watcher:held-import words=5`, then VS Code's auto-save was refused as newer, #454's path) |
| S1, then Keep my version | 1 | both sentences on disk and in the editor; the question gone |
| S1, then Use disk version | 1 | the file is the writer's copy byte for byte, and the editor shows it; the question gone |
| S1, then Compare changes | 1 | the diff opens (*My version ↔ Disk version*); the question stays |
| S2 | 1 (3 on the first build) | silent import |
| S3 | 1 | Review changes, the usual words (#454) |
| S4 | 1 | **Review changes** (the cost decision 1 names) |
| S5 CRLF, S5 BOM, S6 | 1 each | silent, nothing changed |
| S7 front matter, CRLF file | 1 each for S1 and S2 | S1 asks, S2 silent |

`node scripts/qa/stale-write-check.mjs … --expect fixed` exits 0 for the set. The review's words, as the Experience lead wrote them, are in [`../qa/r1-review-changes-held-import.png`](../qa/r1-review-changes-held-import.png). The toasts behind it in the full capture ("Activating extension 'vscode.…' failed: Cannot find module …/out/…") are this dev tree's: its built-in extensions were never compiled ([log-lines.md](log-lines.md)); they are not a product fault.

## The coordinator-level test

`extensions/ritemark/src/editorSync/DocumentSyncCoordinator.staleWrite.test.ts` drives the coordinator with `vscode` stubbed, a fake text document that behaves like VS Code's (auto-reload when clean, the clean notice before the save's receipt, save receipts as patch 014 gives them, a refused save handed to `answerSaveConflict`) and real temp files: S1 in both orders, S2, S3, S4, S5, S6, S7 (CSV, front matter, CRLF), S8, a second stale write while the question waits, the notification, and the three answers; each with the receipt before and after the reconcile (40 runs).

- **On `main`** (its `src/editorSync/` copied beside the test): 26 of 40 fail: every S1 run, S4 and S7's S1 half, in both orders. S2, S3, S5, S6 and S8 pass, as they should.
- **On the branch:** 40 of 40 pass, inside `npm run test:editor-sync`.

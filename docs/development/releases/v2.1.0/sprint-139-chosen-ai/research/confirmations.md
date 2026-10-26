# Confirmations (Phase 1)

26 October 2026, read in the code on `main` at `08761e71` unless a line says otherwise.

## The first reply's turn, and where `first_message_sent` moves

- **Moved.** 2.0 sent `first_message_sent` at the top of the `agent-execute` handler, before `acceptRuntimeTurn` saved the message; a save that failed posted "Could not save your message. Nothing was sent to the agent." and `break`s, after the count. It is now sent through `countTurnAccepted` once the turn is saved and its canonical conversation id is known (`UnifiedViewProvider`, after the save's try/catch), so the failed-save path never counts.
- **The turn's identity** is `<canonical conversation id>:<conversation turn id>`. The webview gives every turn an id and sends it again on a continuation, so the key holds across one.
- **`first_reply`** waits in memory (`TurnCounter.firstReplyTurn`) and is sent at that turn's terminal checkpoint: `onComplete` (Claude), `onCodexComplete` (ChatGPT, OpenCode), `onExit` (a runtime that dies), and a stop before the turn began (which ends through the same callbacks). A window closed first sends nothing.

## The paths that run `agent-execute`, and which are continuations

| Path | Runs as | Counted as |
|---|---|---|
| The composer (Claude, ChatGPT, OpenCode) | a chat turn | `agent_used`, `source: chat` |
| A comment task (`CommentTaskController` → the sheet's queue) | a chat turn in its conversation | `chat` |
| A task card's Give to… (`CardHandoffLedger` → the sheet's queue) | a chat turn | `chat` |
| Home's ready request (Sprint 140, not on main yet) | will run as a chat turn | `chat` |
| ChatGPT's Approve & continue after a plan review (`conversationContinuation: true`, same turn id) | a continuation | not a new turn (one `agent_used` per turn key) |
| An approval or a question inside a turn | the same turn, no new `agent-execute` | — |
| Claude's own turn after background work (`onRuntimeTurnStart`) | Claude's turn, not the person's | not counted |
| A Flow's Claude step, ChatGPT step | `FlowExecutor` | `agent_used`, `source: flow`, at the step's end |
| A Flow's LLM step | a provider API call | `feature_used: flow_llm_step` |

## Dictation and Transcribe

- **Dictation** puts text in through `dictation:transcription` messages; `DictationController.producedText` is set when one carries text. `stopDictation` ends with `flushHeld()` (deferred mode inserts there); after it, a dictation with `producedText` calls the new `onCaptured` dependency once. `ritemarkEditor.ts` gives each editor's controller one that counts the capture and remembers that editor's document.
- **Transcribe**: a job becomes text at `JobManager`'s `job-completed` (with the session's `segments`). `TranscribeViewProvider` counts it once when the job was started from its own panel (`_start`) and has segments; `input` is `recorded` when the audio came from the panel's own recorder (`stageImport` of the finished recording), else `file`. A Transcript Workbench re-run of the same recording is not a new capture. The transcript becomes a document when saved (`transcriptWorkbenchProvider` → `saveTranscriptTo`); that document joins the voice list then.
- Limit: a recording made before a restart and transcribed after it counts as `file` (the panel remembers its own recordings in memory).

## Who saves a document

- A Ritemark document is the `TextDocument` of a custom text editor, so `workspace.onDidSaveTextDocument` fires for it, under autosave too.
- The voice list counts "edited again" only for a document that had a content change (`onDidChangeTextDocument` with changes) before the save, on a later calendar day than the capture, within 30 days, once.
- The change can come from the person, from an agent editing through the open editor, or from the editor taking in a change on disk (an agent's write, a sync). A file changed on disk while it isn't open is not a save and is not counted. These limits go beside the insight (qa-evidence).

## The AI status item

`ai/connectivity.ts` draws "AI Ready" / "AI Offline" in 2.0's status bar (seen in this sprint's run, bottom right). The refusal's third state ("Claude needs a paid plan", the amber dot) belongs to the refusal card (W4), which waits for the Claude Free audit (A1); nothing changes in the status item in merge 1.

## OpenCode's catalog default

`bundledCatalog.ts` gives `opencode` `defaults: {}`, so there is no catalog default for OpenCode. The model card shows no button for OpenCode and says "Choose another model in the model menu below." (S28).

# A5: Transcribe a file… as a tab (R13; #517)

Read on 26 October 2026 from `main` at `84ea15db`. Recording wasn't run on screen: it asks for the microphone, which would put a system prompt on Jarmo's screen.

## What happens today

Record and Transcribe a file… take one path in `TranscribeViewProvider`:
1. A file comes in from Transcribe a file… or Add recording (`_pickFile()`), a drop (`transcribe:import`), or a finished recording (`RecordingController` → `stageImport`).
2. `_stageImport()` checks and measures it and holds it as pending. The panel then shows the engine choice, and nothing runs or uploads before that choice (R4/N2 of the Transcribe sprint).
3. The panel's Transcribe sends `transcribe:start`, and `_start()` enqueues the job.

**Nothing on this path opens a tab, for a recording made in the app or for a file.** The Transcript Workbench opens only from a row's click (`_openSession`, `vscode.openWith(audioPath, 'ritemark.transcriptWorkbench')`). #517's "as it already does for a recording made in the app" is experience 20's intent (frame 2), not what main does.

## What the workbench can show before a transcript

`TranscriptWorkbenchProvider` subscribes to the job manager and passes a job for its audio path to its page (`job ?? null`), so a tab opened at a job's start shows its progress and fills in when it finishes.

## Focus

`vscode.openWith` takes `TextEditorOpenOptions`:
- `preserveFocus` keeps the keyboard where it is;
- `background: true` maps to the editor's `inactive`, which opens the tab without bringing it forward (`extHostTypeConverters.ts`, `TextEditorOpenOptions.from`).

## Decision

- **`_start()` opens the workbench** on the job's audio path right after `enqueue`:
  - `preview: false` and `preserveFocus: true`;
  - `background: true` when a document has the keyboard (the active tab is a Ritemark or text document, and the window is focused).
- It is one place for both Record and a file, so they end the same way, matching experience 20.
- Cancelling the picker or the engine choice never reaches `_start()`, so nothing opens.
- A row's click still opens the tab, as now.

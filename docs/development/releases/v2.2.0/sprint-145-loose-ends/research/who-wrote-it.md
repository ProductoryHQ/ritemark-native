# A10: Can the host name the AI that wrote the file? (R1 revised: S56, S59)

1 November 2026, by reading the code on `sprint-145-loose-ends`. Nothing was measured in a run.

## The question

Experience 44 names the writer ("Claude also changed the paragraph you were writing in") only when Ritemark knows that an AI's turn in this project wrote this file; otherwise the words say "another app". This note asks whether the host knows.

## What each runtime knows today

| Runtime | Where a write shows | What it carries |
|---|---|---|
| Claude Code (`src/agent/AgentRunner.ts`) | the SDK's `tool_use` blocks: `Write` and `Edit` with `input.file_path` (around line 1917), collected in `filesModified` for the turn's progress lines | the path, at the moment the tool is called (not when the file lands) |
| Codex (`src/codex/CodexRuntime.ts`) | the app server's file-change approvals (`kind: 'file-write'`, `routed.fileChanges`, around line 1064) and its file-change items | the paths and the diff |
| OpenCode (ACP, `src/acp/AcpRuntime.ts`, `acpManager.ts`) | `session/request_permission`'s tool call and tool-call updates, `locations[0].path` (around lines 571 and 532) | the first path of the tool call |

A write made through a shell tool (`Bash` with `sed`, a script, `cat >`) carries no path in any of the three.

## What is missing

No event on the `AgentRuntime` interface says "this runtime wrote this path, in this turn". Each runtime turns its own events into progress lines for the sidebar; nothing reaches `src/editorSync/`. Naming the writer needs:

1. one event on the shared interface (`fileWritten(path, runtimeId)`), raised by each runtime from the events above, so no runtime-specific code reaches the sync (the interface is a locked decision: every runtime implements the same one);
2. a short memory in the coordinator, per document: the runtime that wrote its path in the current turn, cleared when the turn ends;
3. `document:paragraphs`' `writer` and the notification's words read from that memory.

## Answer

Yes, for writes made through each runtime's own file tools; no for writes through a shell. It is not wired in Sprint 145: the change spans the three runtimes and the shared interface, which is more than PR 1 should carry. 2.2's words say "another app" for every writer, as the technical plan's fallback says (*Risks*: "The AI isn't known as the writer"). The wiring is a follow-up issue; `paragraphReviewWords(count, writer)` and `document:paragraphs`' optional `writer` already take the name when it comes.

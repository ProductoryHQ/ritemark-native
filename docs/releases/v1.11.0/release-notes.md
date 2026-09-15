# Ritemark 1.11.0 Release Notes

## Runtime and model baseline

Sprint 116 refreshes the foundation used by Agent Chat and Flows:

- Claude Code 2.1.270 with Claude Agent SDK 0.3.270
- Codex 0.154.0 with its complete official app-server package
- OpenCode 1.18.30 with ACP SDK 1.4.0 and a bundled runtime-owned ripgrep
- GPT-6 Astra, Claude Fable 5.1, and current Gemini text choices in the model catalog
- GPT Image 2 and Gemini 3.1 Flash Image as defaults for new image Flows

Codex cancellation is more reliable when Stop is pressed immediately, and late events from an old explicit thread cannot be routed into another conversation. Successful OpenCode turns now end as **Done** instead of showing a false **Failed** marker after the answer and document edit completed. Runtime packaging verifies every archive and installed file across Apple Silicon, Intel macOS, and Windows; native Intel and Windows execution remains part of the release CI gate.

## Comments assigned to an agent

Sprint 117 rebuilds what happens after you type `@claude` in a margin note.

Before this release, assigning a comment to an agent was largely theatre. The margin flashed **Sent** the instant you clicked, regardless of what happened next, and the toolbar reported "Queued N tasks" before anything had actually been accepted. A standalone `<!-- -->` margin note was dispatched with no identity of its own, so it never showed status at all. The agent was told it was editing "the active document" rather than your actual file path. One finished turn marked every comment in that conversation done, a cancelled run was reported as completed, and the answer landed in a conversation you were never shown.

A comment task is now a real thing the extension host owns and tracks:

- It goes to the conversation currently open in the AI sidebar — a brand-new empty one counts — and the Send line names that conversation before you send. There is no confirmation dialog and no picker; the open conversation is the destination.
- It reports **queued** only once the work has genuinely been accepted. When it is not accepted, it says why, with the matching recovery: a signed-out agent, a full prompt queue, a document that has never been saved.
- Status survives reloading the document, reopening it, and restarting the app. A task cut short offers **Retry**.
- When it finishes, the agent's own sentence appears under your note with a link to the thread. Your note, the highlighted passage, and the Markdown file itself are never rewritten.
- If you address a comment to one agent but the open conversation is running a different one, the line above the Send button tells you beforehand that the agent you mentioned takes over.

Hovering the highlighted text opens its comment, and a finished comment offers **Mark as done** instead of a red trash can. This sprint also absorbed the comment ergonomics planned for v1.12.0: the comment composer resizes, the `@` picker opens immediately and uses the same agent-alias vocabulary as the comment collector, and collapsed comments no longer cover the text they annotate.

# A4: records 2.0.x can still read (E2)

26 October 2026.

## How it was checked

A script wrote a chat with this branch's own `ConversationStore` and `ConversationController`, then read and wrote it back with **2.0.1's own store code** (the `extensions/ritemark/src` tree exported from `b1ac84a7`, the 2.0.1 closeout), then read it again with this branch. The chat carried what 2.1 adds:
- `composerPreferences.modelByRuntime` for all three AIs (`codex: gpt-6-luna`, `claude-code: claude-sonnet-5`, `opencode: google/gemini-4-argon`), saved at accepted turns and by a pick;
- a failed boundary with `errorKind: model` and `errorDetail: { model: gpt-6.1-sol }`;
- a failed assistant message with `errorKind: network`.

The installed 2.0.1 app was not launched on a copy of the profile: the code-level check runs 2.0.1's exact decoder and store, which is what decides quarantine, and needs no extra app launch.

## Results

| Step | Result |
|---|---|
| 2.0.1's `decodeConversationRecordV1` reads the 2.1 record | Yes. It keeps `composerPreferences: { thinkingEffortByRuntime }` and drops the rest; every event decodes |
| 2.0.1's store lists and opens it | Listed as `verified`, opened; `quarantineCount` 0, `corruptCount` 0 |
| What 2.0.1 shows for the failed turns | The saved sentences: "ChatGPT couldn't use GPT-6.1 Sol. It isn't available in Ritemark right now." and "Ritemark couldn't reach Claude. Check your connection, then send your message again." (2.0.1's webview restores only "Failed" for a ChatGPT or OpenCode turn; that is 2.0.1's own behaviour) |
| 2.0.1 writes it back (a thinking-effort change, its one composer write) | Written; this branch then opens it with no quarantine |
| What a 2.0.1 write-back loses | `modelByRuntime` **and** `errorKind`/`errorDetail`: 2.0.1's decoders keep only the fields they know, and its store writes the decoded record. The sentences stay, so a failed turn shows its sentence without its card, and the chat starts again from today's model fallbacks |

So S57 holds with one correction to the scenario's last line: a chat that 2.0.1 writes back loses its saved model **and its cards' kinds**, never its text, and is never quarantined.

## Nothing compares a re-encoded record (#417's question)

- `ConversationStore` writes `JSON.stringify(record)` of the decoded record and reads by decoding; it never compares a re-encoded record with the bytes on disk.
- The index (`summarizeConversationRecord`) holds no new field.
- `LegacyConversationMigrator` fingerprints only runtime, kind and text (`fingerprintParts`), so new fields can't make a duplicate.
- Comment-task and task-card ledgers store their own records; they take the failure sentence (`safeFailureMessage`) and no conversation fields.

## The decoders, as built

- `errorKind`: kept only when it is one of this build's kinds (`isRuntimeErrorKind`); otherwise dropped with `errorDetail`. `failureKind` stays strict, as every 2.x build reads it.
- `errorDetail`: each field checked (`decodeRuntimeErrorDetail`); an unknown field or value is dropped.
- `modelByRuntime`: only `claude-code`, `codex` and `opencode` keys with a non-empty string of at most 256 characters; anything else is dropped. Not an object: dropped.

Unit tests: `src/conversations/types.test.ts` (future kinds, odd details and odd models dropped, `failureKind` still strict).

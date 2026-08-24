# Ritemark 1.10.0 — Durable Agent Conversations

Ritemark 1.10.0 turns Agent Chat from a row of temporary sidebar tabs into a
conversation system you can trust. Your chats belong to the project, survive a
restart, and can continue with another agent without making you reconstruct the
discussion from memory.

<!-- Draft through Sprint 111. Composer thinking effort is added in Sprint 112. -->

## Conversations you can return to

- **Every non-empty conversation is saved locally under its project.** Closing
  the sidebar—or closing Ritemark—does not turn a conversation into a mystery.
- **The conversation rail keeps working and recent chats close.** Up to five
  Pinned conversations stay put; **All conversations** opens the complete
  project list.
- **Opening a chat does not reshuffle your shortcuts.** Recents move only when
  there is real conversation activity. Pin/Unpin and Delete remain deliberate
  actions.
- **Titles become useful automatically.** A new conversation starts with a
  shortened version of the first prompt, gets a concise title after the first
  answer, and can always be renamed by you.

![Durable project conversations in the permanent rail](screenshots/1-10-0-conversation-reopened.png)

## Truthful continuation

- Reopening a conversation does not silently start an agent. On your next
  **Send**, Ritemark first tries the selected runtime's compatible saved session.
- Claude, Codex, and OpenCode can resume their audited native sessions. If the
  saved session is missing, rejected, incompatible, or unsafe after an
  interrupted turn, Ritemark starts a fresh session with a bounded text
  transcript—and says so.
- Transcript fallback carries canonical user requests and completed assistant
  answers. It does **not** replay tool state, approvals, partial output, plans,
  hidden instructions, provider history, or attachment contents.
- A request that received no saved answer remains visible to the next agent as
  labelled context. It is not silently dispatched again as a second command.

![One conversation retaining context across Claude and Codex](screenshots/1-10-0-transcript-context-restored.png)

## Simpler agent switching

Choose another agent and keep writing. The selection applies immediately, your
composer draft stays intact, and no new runtime work begins until you press
**Send**. There is no confirmation dialog to get through.

When Ritemark uses transcript fallback, one quiet line between the old and new
turns says which agent is continuing and that previous messages were included
as context. Another provider's private session identifier is never transferred,
and late output from the previous agent cannot overwrite the handoff.

![A quiet Claude to Codex handoff inside the conversation](screenshots/1-10-0-agent-switch-boundary.png)

## Refreshed built-in agents

Ritemark 1.10.0 refreshes all three bundled agent engines: Codex 0.149.0,
Claude Code 2.1.239, and OpenCode 1.18.21. Their matching SDK edges are pinned
to Claude Agent SDK 0.3.239 and ACP SDK 1.4.0, so an app update cannot quietly
combine an old client with a new engine.

The release build now rejects incomplete platform sets, checksum mismatches,
Claude binary/SDK drift, and stale runtime metadata before packaging. Existing
conversation continuation, approvals, cancellation, and parallel-conversation
isolation were rerun against this exact snapshot.

> Native continuation is intentionally version- and configuration-specific. “Previous messages were included” means transcript fallback, not complete private model memory.

Conversation history remains local to this Ritemark installation and profile.
Cloud sync, shared conversations, and account portability are not part of this
release.

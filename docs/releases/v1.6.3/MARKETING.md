# v1.6.3 Marketing — One Conversation, Many Runtimes

**Status:** Draft

## One-liner

Ritemark v1.6.3 lets you switch Claude and Codex per turn in the same conversation, and turns the Agent Library into a place where you can create, launch, and manage your own agents and skills.

## Social post (short)

Ritemark v1.6.3 is readying for launch: one conversation can now mix Claude + Codex turn-by-turn, every reply shows runtime/model provenance, and Agent Library got a major upgrade (create new helpers in-app, launch chat from an agent, live updates, icons, and AGENTS/.agents discovery).

## Social post (thread)

1/ Ritemark v1.6.3 is focused on agent workflows and conversation control.

2/ You can now switch runtime per turn in one thread (Claude ↔ Codex) without resetting context.

3/ Every assistant message shows runtime + model, so mixed-runtime threads stay understandable.

4/ Codex Plan/Edit is now a per-turn composer control, not a conversation-level lock-in.

5/ Agent Library now supports in-app creation of skills/agents, duplication, scope moves, and safe delete-to-trash flows.

6/ New **Launch Chat** action starts a chat with the selected agent pinned as hidden context.

7/ We now discover both `AGENTS.md` and `.agents/` (alongside `.claude/`) so Codex-style project layouts are first-class.

8/ Plus: refreshed Claude fallback model IDs and several UX reliability fixes.

## Changelog bullets

- Per-turn runtime switch in one conversation (Claude + Codex)
- Per-message runtime/model provenance line
- Codex Plan/Edit as per-turn composer setting
- Agent Library new-helper modal + section-header `+` creation affordances
- Agent row context menu operations (open, duplicate, reveal, move scope, delete to trash)
- Starter pack seeding on first run when `~/.claude/` is empty
- Agent/skill icon chips with frontmatter overrides (`icon`, `color`)
- Live sidebar refresh for `.claude/*` and `.agents/*` edits
- Launch Chat action from agent rows (pins agent context)
- `@mention` selection unified with pinned-agent chat flow
- Discovery support for root `AGENTS.md` and project `.agents/`
- Updated Claude fallback model IDs

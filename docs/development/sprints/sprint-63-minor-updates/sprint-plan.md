# Sprint 63: Minor Updates (Issues #38, #44, #49)

## Goal

Three focused improvements to the agent library: scan `.agents/` as a second project scope root, add a "Launch Chat" action on agent items, and update the Claude model fallback list.

## Feature Flag Check

No new user-visible features requiring a flag. All three changes are corrections or natural extensions of existing behaviour — they are either bug fixes (#38, #44) or a small additive affordance that belongs on by default (#49).

## Success Criteria

- [ ] `.agents/skills/` skills appear in the Agent Library panel alongside `.claude/skills/` skills
- [ ] `.agents/agents/` agents appear in the panel (if any exist)
- [ ] No duplicates when an id exists in both `.claude/` and `.agents/` roots (`.claude/` wins)
- [ ] "Launch Chat" in the agent item context menu opens the AI sidebar and pre-selects that agent
- [ ] Claude model fallback list matches current released models; verified against knowledge cutoff
- [ ] Extension TS compiles clean (`npm run compile` in `extensions/ritemark/`)
- [ ] Pre-commit hook passes on every commit

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `discovery.ts` patch | `discoverAgents()` and `discoverCommandsInRoot()` scan `.agents/` in addition to `.claude/`; dedup `Set` added to `discoverAgents()` |
| `AgentLibraryViewProvider.ts` patch | "Launch Chat" context-menu entry; posts `launchChatWithAgent` message; extension side handles it |
| `UnifiedViewProvider.ts` / `extension.ts` patch | Registers `ritemark.launchChatWithAgent` command; clears chat and pre-selects agent via existing `ai-select-agent` path |
| `claudeModels.ts` update | Current Claude model IDs (Opus 4-7, Sonnet 4-6, Haiku 4-5-20251001) |

## Design Decisions Requiring Jarmo's Input

1. **Issue #38 — scope merging.** Research confirmed `.agents/` only contains skills (under `.agents/skills/`), no `agents/` subdir. The simplest approach is to treat `.agents/` exactly like a second project-scope `.claude/` root: same `project` scope badge, `.claude/` wins on id collision. No new UI tab needed. Is this the right call, or do you want a separate "Agents dir" badge?

2. **Issue #49 — UI placement.** The agent item context menu already has Open / Duplicate / Reveal in Finder / Move scope / Delete. "Launch Chat" fits naturally as a first entry, above the separator. Alternatively it could be a primary-click action (clicking the item opens chat instead of opening the file). Recommendation: keep primary click = open file, add "Launch Chat" to the context menu (and the three-dot menu). Do you agree?

3. **Issue #44 — model IDs.** The current fallback list in `claudeModels.ts` has `claude-sonnet-4-5`, `claude-opus-4-6`, `claude-haiku-4-5`. Based on the issue scope and knowledge cutoff (August 2025), the correct IDs are `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`. The OpenAI/Gemini model list in `modelConfig.ts` is maintained separately and already looks current — no change needed there unless you spot something wrong. Confirm?

## Implementation Checklist

### Issue #38 — scan `.agents/` in discovery.ts

- [ ] In `discoverAgents()`: after scanning `workspacePath/.claude`, also scan `workspacePath/.agents` (if it exists) using `discoverAgentsInRoot()` with scope `'project'`; add a `seen` Set keyed on `id` so `.claude/` wins on collision
- [ ] In `discoverCommands()`: after scanning `workspacePath/.claude`, also scan `workspacePath/.agents` using `discoverCommandsInRoot()` with scope `'project'`; existing `seen` Set already deduplicates (`.claude/` wins)
- [ ] Compile and verify `.agents/skills/` items appear in the panel
- [ ] Commit: `fix(agent-library): scan .agents/ directory as second project-scope root (#38)`

### Issue #49 — Launch Chat from agent library

- [ ] In `AgentLibraryViewProvider.ts` webview script: add "Launch Chat" as first entry in `showContextMenu()` for agent items only (not skills/commands); posts `{ type: 'launchChatWithAgent', agentId: item.id }` to extension
- [ ] In `AgentLibraryViewProvider.ts` TS class: handle `launchChatWithAgent` message — execute `ritemark.launchChatWithAgent` VS Code command with `agentId`
- [ ] In `extension.ts`: register `ritemark.launchChatWithAgent` command; it focuses the unified view, updates `ritemark.ai.selectedAgent` setting to the given id, calls `unifiedViewProvider.clearChat()`, and sends `_sendAgentConfig()` (already a public or accessible method — check access)
- [ ] Verify: clicking "Launch Chat" on sprint-manager agent switches AI sidebar to claude-code + subagent routing, or whichever agent maps to the id
- [ ] Commit: `feat(agent-library): launch chat with pre-selected agent from library (#49)`

### Issue #44 — update Claude model fallback list

- [ ] Update `extensions/ritemark/src/agent/claudeModels.ts`: set ids to `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` with appropriate labels
- [ ] Compile clean
- [ ] Commit: `fix(ai): update Claude model fallback list to current versions (#44)`

## Status

**Track:** Full 6-phase (multi-file, webview + extension coordination, UI change)
**Current Phase:** 2 — Plan (awaiting approval)
**Approval Required:** Yes

## Approval

- [ ] Jarmo approved this sprint plan

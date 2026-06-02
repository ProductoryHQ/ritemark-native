# Agent Protocols Reference & Configurator Gap Analysis

> **Why this document exists:** During sprint-77 testing (2026-06-02) Jarmo found that the Agent
> Configurator panel does not reflect the actual tools declared in agent frontmatter, and that
> CLAUDE.md / AGENTS.md confusingly appear as "agents" without an editor pane. Root cause: the
> configurator was built on an **invented schema**, not the real agent protocols. This document is
> the verified reference for both protocols (Anthropic + OpenAI), the audit of what this repo
> actually uses, the complete gap analysis, and the corrected design.
>
> All protocol claims below were verified against official documentation on 2026-06-02.

---

## Part 1 — The actual protocols

### 1.1 Claude Code subagents (`.claude/agents/*.md`)

Source: https://code.claude.com/docs/en/sub-agents.md

A subagent is a markdown file with YAML frontmatter. The **body is the system prompt**.

| Field | Type | Required | Values / notes |
|---|---|---|---|
| `name` | string | **yes** | Unique id, lowercase + hyphens |
| `description` | string | **yes** | When to delegate — Claude uses this for routing |
| `tools` | **comma-separated string** or YAML list | no | Omitted = inherits ALL parent tools |
| `disallowedTools` | comma-separated string or YAML list | no | Deny-list, applied before `tools` |
| `model` | string | no | `sonnet` \| `opus` \| `haiku` \| full model ID \| `inherit` (default) |
| `permissionMode` | string | no | `default` \| `acceptEdits` \| `auto` \| `dontAsk` \| `bypassPermissions` \| `plan` |
| `maxTurns` | integer | no | Turn cap |
| `skills` | YAML list | no | Skills preloaded into subagent context |
| `mcpServers` | YAML list | no | MCP servers available to this subagent |
| `memory` | string | no | `user` \| `project` \| `local` — persistent memory scope |
| `background` | boolean | no | Always run as background task |
| `effort` | string | no | `low` \| `medium` \| `high` \| `xhigh` \| `max` |
| `isolation` | string | no | `worktree` |
| `color` | string | no | `red` \| `blue` \| `green` \| `yellow` \| `purple` \| `orange` \| `pink` \| `cyan` |
| `hooks` | YAML object | no | Subagent-scoped lifecycle hooks |
| `initialPrompt` | string | no | Auto-submitted first turn when run as main session |

**Canonical tool names (exact capitalization — PascalCase):**
`Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `NotebookEdit`,
`Skill`, `Agent`, `AskUserQuestion` (+ MCP tools via `mcpServers`).

**Scoping:** project `.claude/agents/` > user `~/.claude/agents/` (project wins on name clash).

### 1.2 CLAUDE.md — NOT an agent

Source: https://code.claude.com/docs/en/memory.md

- Persistent **instructions/memory file**, loaded into every session's context.
- **Has NO frontmatter and NO schema.** Pure markdown.
- Locations: `./CLAUDE.md` (project), `~/.claude/CLAUDE.md` (user), `./CLAUDE.local.md` (personal,
  git-ignored), nested `subdir/CLAUDE.md` (loaded on demand).
- Supports `@path/to/file` imports.
- **It is not a subagent.** It has no name, no tools, no model. It cannot be "configured" — only edited as text.

### 1.3 AGENTS.md — the open standard, also NOT an agent

Source: https://agents.md/ (stewarded by Agentic AI Foundation / Linux Foundation since Dec 2025)

- "A README for agents" — freeform markdown instructions for AI coding tools.
- **Has NO frontmatter and NO schema.** Verbatim from the spec: *"AGENTS.md is just standard
  Markdown. Use any headings you like; the agent simply parses the text you provide."*
- Nesting: nearest AGENTS.md in the directory tree wins (monorepo support).
- Read by: OpenAI Codex, Cursor, Jules, Gemini CLI, Amp, Zed, Copilot, etc.
  **Claude Code reads CLAUDE.md, not AGENTS.md** (convention: symlink or `@AGENTS.md` import).

### 1.4 OpenAI Codex subagents (`.codex/agents/*.toml`)

Source: https://developers.openai.com/codex/subagents

Codex DOES have named subagents, but the format is completely different:

- **TOML files**, not markdown: `.codex/agents/<name>.toml` (project) or `~/.codex/agents/` (user)
- Required keys: `name`, `description`, `developer_instructions`
- Optional: `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, `skills.config`
- **Not interchangeable** with Claude Code's `.claude/agents/*.md` format.

### 1.5 Skills

| | Claude Code | Codex |
|---|---|---|
| Location | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| Format | YAML frontmatter + markdown | YAML frontmatter + markdown |
| Key fields | `name`, `description`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `model`, `context`, `paths`, … | `name` (req), `description` (req) |

Note the directory distinction: **`.agents/skills/`** is the cross-tool/Codex skills dir,
**`.codex/agents/`** is Codex subagents. Easy to confuse; they are different things.

---

## Part 2 — What this repo actually uses

Audit of all 9 files in `.claude/agents/` (2026-06-02):

| Field | Coverage | Standard? | Notes |
|---|---|---|---|
| `name` | 9/9 | ✅ standard | kebab-case ids |
| `description` | 9/9 | ✅ standard | multi-line strings |
| `tools` | 9/9 | ✅ standard | **Always a comma-separated STRING** (quoted or unquoted), e.g. `'Read, Bash, Glob, Grep'` — never a YAML array |
| `model` | 9/9 | ✅ standard | `sonnet` / `opus` aliases |
| `priority` | 8/9 | ❌ NOT standard | Repo-local convention, ignored by Claude Code |
| `displayName` | 4/9 | ❌ NOT standard | Repo-local; used by Ritemark's own discovery.ts for display |
| `agent` | 1/9 | ❌ NOT standard | `agent: claude` in knowledge-builder.md — **written by the broken configurator UI** |

Tools referenced across repo agents (all PascalCase): `Read`, `Write`, `Edit`, `Bash`, `Glob`,
`Grep`, `WebFetch`, `WebSearch`.

Root files: `CLAUDE.md` and `AGENTS.md` exist, both **without frontmatter** (as the protocols dictate).

Codex side: `.agents/skills/` exists with 13 Codex skill folders. No `.codex/agents/` TOML subagents.

Agent-mode detection (`ritemarkEditor.ts:177`):
```ts
const isAgentMode = /[\/\\]\.claude[\/\\]agents[\/\\][^\/\\]+\.md$/.test(filePath);
```
→ Only `.claude/agents/*.md` triggers the configurator. CLAUDE.md / AGENTS.md do not (correct in
principle — they have nothing to configure — but the Library presents them identically to agents,
which creates the confusion).

---

## Part 3 — Gap analysis: configurator vs reality

Every discrepancy in `AgentConfiguratorPanel.tsx` as shipped in PR #99:

| # | Configurator assumes | Reality | Consequence |
|---|---|---|---|
| G1 | `fm.tools` is a YAML **array** (`Array.isArray(fm.tools)`) | `tools` is a **comma-separated string** in all 9 repo agents (and the common format in the wild) | **Tool checkboxes always show empty** ← the bug Jarmo saw |
| G2 | Tool ids are lowercase snake_case: `bash`, `read`, `write`, `edit`, `glob`, `grep`, `web_fetch`, `web_search`, `mcp` | Canonical names are PascalCase: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `WebSearch`; `mcp` is not a tool name | Toggling a checkbox would write **invalid tool names** into the agent file, silently breaking the agent's tool grants |
| G3 | `fm.agent` = "runtime" (claude / codex / openai) | No such field exists in the Claude Code spec. A `.claude/agents/*.md` file IS a Claude Code agent by definition. Codex agents are separate TOML files | Invented field; already polluted knowledge-builder.md with `agent: claude` |
| G4 | `model` is free text | Spec: `sonnet` \| `opus` \| `haiku` \| full ID \| `inherit` (default) | Should be a select with these options |
| G5 | `fm.skills` array editor | `skills` IS a real field (YAML list, preloads skills) ✅ | Concept OK — but serialization must produce a YAML list, and only Claude skills (`.claude/skills/`) qualify |
| G6 | `description` not editable in configurator | `description` is **required** and is how Claude routes to the agent | The single most important field is missing from the "agent editor" |
| G7 | No support for `memory`, `effort`, `color`, `permissionMode`, `maxTurns`, `disallowedTools`, `background`, `isolation` | All real, documented fields | Editor covers a fraction of the real schema |
| G8 | `routine` (flow link) presented as a peer of standard fields | Ritemark-specific extension | OK to keep, but must be visually marked as a Ritemark extension, not core protocol |
| G9 | Library lists CLAUDE.md / AGENTS.md in the same "Agents" section with the same row UI | They are **instruction files** with no frontmatter, not agents | Clicking them gives no configurator → feels broken. They need their own category ("Instructions") with different affordances |
| G10 | "Properties" (i) panel and "Agent" (robot) panel both show frontmatter, differently | One generic key-value view (correct data, raw presentation) + one structured view (wrong data) | Two views of the same file disagree → destroys trust |

**Verdict:** the configurator UI is visually fine but semantically wrong. It must be rebuilt on the
real schema (Part 1) and the real file contents (Part 2).

---

## Part 4 — Corrected design (proposal)

### 4.1 Data layer (the foundation — fix first)

1. **Tools parser/serializer**: read `tools` as comma-separated string OR YAML list → normalize to
   `string[]` of canonical PascalCase names; serialize back as comma-separated string (matching
   repo convention). Unknown names are preserved, never dropped.
2. **Field model**: typed `AgentFrontmatter` matching the real spec (Part 1.1) + marked Ritemark
   extensions (`routine`, `displayName`, `priority`).
3. **Kill the `agent:` runtime field**: remove from UI; offer one-time cleanup of
   knowledge-builder.md.

### 4.2 Configurator panel (rebuilt on real schema)

```
Agent (robot panel) — only for .claude/agents/*.md
├─ Description        (textarea — REQUIRED, routing text)
├─ Model              (select: inherit / sonnet / opus / haiku / custom ID)
├─ Tools              (checkboxes w/ canonical names: Read, Write, Edit, Bash,
│                      Glob, Grep, WebFetch, WebSearch + "Inherit all" when empty)
├─ Skills (preload)   (existing autocomplete — writes YAML list)
├─ Advanced ▸         (collapsed: effort, memory, color, permissionMode, maxTurns)
└─ Ritemark ▸         (Linked flow [routine] — marked as Ritemark extension)
```

Key semantics: empty `tools` = "inherits all tools" (show this state explicitly, not as
"no tools").

### 4.3 Library categorization

```
AGENT LIBRARY
├─ Instructions        ← CLAUDE.md, AGENTS.md (open as markdown, no configurator,
│                         distinct icon, subtitle "Loaded into every session")
├─ Agents              ← .claude/agents/*.md (configurator on click)
├─ Skills              ← .claude/skills/ (claude), .agents/skills/ (codex), merged w/ provenance
├─ Commands            ← .claude/commands/
└─ Flows               ← .ritemark/flows/
```

### 4.4 Out of scope (future, tracked separately)

- Codex TOML subagents (`.codex/agents/*.toml`) — different format, needs own editor (issue
  candidate)
- Scheduling — removed from sprint-77; waits for issue #100 (Flows → agent runtime)

---

## Part 5 — Implementation tasks (needs Jarmo approval)

| Task | Files | Size |
|---|---|---|
| T1. Tools string↔array parser + canonical name normalization | `discovery.ts` or new `agentSchema.ts`, unit test | S |
| T2. Rebuild configurator on real schema (4.2) | `AgentConfiguratorPanel.tsx` | M |
| T3. Model select (inherit/sonnet/opus/haiku/custom) | same | S |
| T4. Remove `agent:` runtime UI + chips; auth-status display moves out | same | S |
| T5. Library: "Instructions" category for CLAUDE.md/AGENTS.md | `AgentLibraryViewProvider.ts` | S |
| T6. Description editing in configurator | `AgentConfiguratorPanel.tsx`, `ritemarkEditor.ts` | S |
| T7. Advanced section (effort, memory, color) | `AgentConfiguratorPanel.tsx` | M |
| T8. Cleanup: `agent: claude` out of knowledge-builder.md | `.claude/agents/knowledge-builder.md` | XS |

---

*Sources: code.claude.com/docs/en/sub-agents.md, code.claude.com/docs/en/memory.md,
code.claude.com/docs/en/skills.md, agents.md, developers.openai.com/codex/subagents,
developers.openai.com/codex/guides/agents-md, developers.openai.com/codex/skills. Verified 2026-06-02.*

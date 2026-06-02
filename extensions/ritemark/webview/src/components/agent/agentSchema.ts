/**
 * Claude Code agent frontmatter schema — the REAL protocol.
 *
 * Source of truth: docs/development/sprints/sprint-77-unified-agent-library-p1/agent-protocols-reference.md
 * (verified against https://code.claude.com/docs/en/sub-agents.md on 2026-06-02).
 *
 * Key facts this module encodes:
 *  - `tools` is a comma-separated STRING of PascalCase tool names (may also be a YAML list).
 *  - An empty/missing `tools` field means the agent INHERITS ALL tools (not "no tools").
 *  - `model` is an alias (sonnet/opus/haiku), a full model ID, or `inherit` (default).
 */

/** Canonical Claude Code tool names (exact capitalization) with user-facing descriptions. */
export const CLAUDE_TOOLS: ReadonlyArray<{ name: string; description: string }> = [
  { name: 'Read', description: 'Read file contents' },
  { name: 'Write', description: 'Create and overwrite files' },
  { name: 'Edit', description: 'Make targeted edits to files' },
  { name: 'Bash', description: 'Run shell commands' },
  { name: 'Glob', description: 'Find files by pattern' },
  { name: 'Grep', description: 'Search file contents' },
  { name: 'WebFetch', description: 'Fetch and read web pages' },
  { name: 'WebSearch', description: 'Search the web' },
  { name: 'NotebookEdit', description: 'Edit Jupyter notebooks' },
  { name: 'Skill', description: 'Invoke skills' },
]

export const MODEL_ALIASES: readonly string[] = ['sonnet', 'opus', 'haiku']

export const EFFORT_OPTIONS: readonly string[] = ['low', 'medium', 'high', 'xhigh', 'max']

export const MEMORY_OPTIONS: readonly string[] = ['user', 'project', 'local']

export const COLOR_OPTIONS: readonly string[] = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan',
]

/**
 * Legacy lowercase/snake_case ids that the pre-fix configurator UI wrote into agent
 * files. Mapped back to canonical names so existing damage self-heals on next edit.
 */
const LEGACY_TOOL_MAP: Record<string, string> = {
  bash: 'Bash',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  glob: 'Glob',
  grep: 'Grep',
  web_fetch: 'WebFetch',
  web_search: 'WebSearch',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  notebookedit: 'NotebookEdit',
  skill: 'Skill',
}

/** Normalize a single tool name to its canonical form; unknown names pass through unchanged. */
export function canonicalizeToolName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const lower = trimmed.toLowerCase()
  if (LEGACY_TOOL_MAP[lower]) return LEGACY_TOOL_MAP[lower]
  const canonical = CLAUDE_TOOLS.find(t => t.name.toLowerCase() === lower)
  // Unknown names (e.g. MCP tool ids, future tools) are preserved, never dropped.
  return canonical ? canonical.name : trimmed
}

/**
 * Parse the `tools` frontmatter field into canonical tool names.
 * Accepts the conventional comma-separated string ('Read, Write, Edit') OR a YAML array.
 * Empty/missing → [] which means "inherits all tools".
 */
export function parseToolsField(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return []
  const items = Array.isArray(value)
    ? value.map(v => String(v))
    : String(value).split(',')
  return items.map(canonicalizeToolName).filter(Boolean)
}

/** Serialize tools back to the conventional comma-separated string format. */
export function serializeToolsField(tools: string[]): string {
  return tools.join(', ')
}

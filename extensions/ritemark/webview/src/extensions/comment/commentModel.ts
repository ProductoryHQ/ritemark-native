/**
 * Comment model — pure helpers shared by the load (`marked`) and save (Turndown)
 * paths for Sprint 94 margin comments (#81).
 *
 * Design rules (Codex review #4, accepted):
 *  - The comment BODY is the single source of truth. `@alias` / assigned state
 *    is *derived* from the body, never reconstructed from a cached attribute.
 *  - Body text is HTML-escaped before it is written into a `<ritemark-comment>`
 *    element or a `data-comment` attribute, so a body containing `<`, `>`, `"`,
 *    or `-->` cannot break out of its container or inject markup.
 *  - A literal `-->` in a body is rejected at input time (see hasCommentTerminator),
 *    never silently stripped — silent stripping is data loss.
 */

/** The agent aliases a comment may be assigned to. Order is not significant. */
export const COMMENT_AGENT_ALIASES = ['claude', 'codex', 'opencode'] as const
export type CommentAgentAlias = (typeof COMMENT_AGENT_ALIASES)[number]

/** Map a recognized alias to the runtime AgentId used by the AI sidebar. */
export const ALIAS_TO_AGENT_ID: Record<CommentAgentAlias, string> = {
  claude: 'claude-code',
  codex: 'codex',
  opencode: 'opencode',
}

// A note assigned to an agent starts with `@alias`; the colon is optional so
// both `@claude: fix this` and `@claude fix this` assign (matches the compose
// placeholder "… or @claude to assign"). Case-insensitive. The `(?=$|[\s:])`
// lookahead requires the alias to end at a space/colon/end — so `@claudex` and
// `@codex.com` do NOT assign (audit L-A).
const ALIAS_PATTERN = new RegExp(
  `^@(${COMMENT_AGENT_ALIASES.join('|')})(?=$|[\\s:])\\s*:?\\s*([\\s\\S]*)$`,
  'i',
)

export interface ParsedCommentBody {
  /** Recognized agent alias, or null for a plain (unassigned) note. */
  alias: CommentAgentAlias | null
  /** The instruction text after the alias prefix, or the whole body if none. */
  text: string
}

/**
 * Derive assignment from a comment body. `<!-- @claude: fix this -->` → alias
 * 'claude'. An unrecognized `@name` is treated as plain text (not assigned),
 * per R8's negative scenario.
 */
export function parseCommentBody(raw: string): ParsedCommentBody {
  const body = raw.trim()
  const m = ALIAS_PATTERN.exec(body)
  if (m) {
    return { alias: m[1].toLowerCase() as CommentAgentAlias, text: m[2].trim() }
  }
  return { alias: null, text: body }
}

/**
 * Detect which agent a comment is assigned to — the first `@claude`/`@codex`/
 * `@opencode` mention ANYWHERE in the body (case-insensitive), not just a leading
 * prefix. This drives the assigned state + the Send-to-AI action, so writing
 * `@claude` mid-note (or after editing) also assigns it.
 */
/** Matches an `@agent` mention followed by end/whitespace/colon — so `@codex.com`
 *  (a domain) does not count, but `@claude`, `@claude ` and `@claude:` do.
 *  Exported so the rail highlights exactly the mentions that assign. */
export const MENTION_SOURCE = `@(${COMMENT_AGENT_ALIASES.join('|')})(?=$|[\\s:])`

export function detectAgentAlias(body: string): CommentAgentAlias | null {
  const m = new RegExp(MENTION_SOURCE, 'i').exec(body)
  return m ? (m[1].toLowerCase() as CommentAgentAlias) : null
}

/**
 * Strip only the FIRST mention of the ASSIGNED agent (Codex review, PR #184) —
 * other mentions ("@claude compare with @codex notes") are meaningful context
 * for the task prompt and must survive.
 */
export function stripAssignmentMention(body: string, alias: CommentAgentAlias): string {
  return body
    .replace(new RegExp(`@(${alias})(?=$|[\\s:])\\s*:?`, 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Strip recognized `@agent` mentions from a note to build a clean AI prompt. */
export function stripAgentMentions(body: string): string {
  return body
    .replace(new RegExp(`${MENTION_SOURCE}\\s*:?`, 'gi'), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** True when a body contains the HTML-comment terminator; such a body must be
 *  rejected at input time because it cannot be stored inside `<!-- -->`. */
export function hasCommentTerminator(body: string): boolean {
  return body.includes('-->')
}

/** Escape text destined for element text content. */
export function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escape text destined for a double-quoted attribute value. */
export function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

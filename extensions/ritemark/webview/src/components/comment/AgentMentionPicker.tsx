/**
 * AgentMentionPicker — Sprint 117 R10 (#281): typing `@` in a comment offers
 * the agents that can actually be assigned.
 *
 * The list is built from `COMMENT_AGENT_ALIASES`, so what the picker inserts is
 * exactly what `detectAgentAlias` recognises: picker and collector share one
 * vocabulary and a comment can never be "assigned" to something dispatch will
 * not see. No availability hint is shown — the editor webview does not receive
 * runtime status, and availability is decided at acceptance with a specific
 * recovery rather than guessed here (D10).
 *
 * The caret maths and the key handling are pure functions below the component
 * so they can be tested without a DOM.
 */
import { useEffect, useRef } from 'react'
import {
  ALIAS_LABEL,
  COMMENT_AGENT_ALIASES,
  type CommentAgentAlias,
} from '../../extensions/comment/commentModel'

export interface AgentMentionOption {
  alias: CommentAgentAlias
  label: string
}

/** Every assignable agent, in the collector's own order. */
export const AGENT_MENTION_OPTIONS: AgentMentionOption[] = COMMENT_AGENT_ALIASES.map((alias) => ({
  alias,
  label: ALIAS_LABEL[alias],
}))

export interface MentionQuery {
  /** Index of the `@` in the text. */
  start: number
  /** What the user has typed after it, possibly empty. */
  query: string
}

/**
 * The mention the caret is inside, or null.
 *
 * Opens on the bare `@` (design: "opens the moment `@` is typed at a word
 * boundary"), keeps matching while only letters follow it, and closes as soon
 * as the caret leaves — which is what makes the inserted `@claude ` end the
 * session without any extra bookkeeping.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  if (caret < 0 || caret > text.length) return null
  let index = caret - 1
  while (index >= 0 && text[index] !== '@') {
    if (!/[A-Za-z]/.test(text[index])) return null
    index -= 1
  }
  if (index < 0) return null
  const before = index > 0 ? text[index - 1] : ''
  // `me@codex` is an address, not an assignment.
  if (before && !/\s/.test(before)) return null
  return { start: index, query: text.slice(index + 1, caret) }
}

/** Prefix filter on alias and display name; an empty query offers everything. */
export function filterAgentOptions(
  query: string,
  options: readonly AgentMentionOption[] = AGENT_MENTION_OPTIONS,
): AgentMentionOption[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...options]
  return options.filter(
    (option) => option.alias.startsWith(needle) || option.label.toLowerCase().startsWith(needle),
  )
}

/** Replace the in-progress mention with `@alias `, and say where the caret goes. */
export function insertMention(
  text: string,
  mention: MentionQuery,
  alias: string,
): { text: string; caret: number } {
  const head = text.slice(0, mention.start)
  const rest = text.slice(mention.start + 1 + mention.query.length)
  // The mention already ends in a space, so a space that was already there
  // would double up.
  const tail = rest.startsWith(' ') ? rest.slice(1) : rest
  const inserted = `@${alias} `
  return { text: `${head}${inserted}${tail}`, caret: head.length + inserted.length }
}

export type MentionKeyAction =
  | { kind: 'ignore' }
  | { kind: 'move'; index: number }
  | { kind: 'insert'; index: number }
  | { kind: 'close' }

/**
 * What a keystroke means while the picker is open. Returns `ignore` for
 * everything else so the composer's own Enter-to-save and Escape-to-cancel
 * keep working the moment the picker is closed.
 */
export function mentionKeyAction(
  key: string,
  state: { count: number; activeIndex: number },
): MentionKeyAction {
  const { count } = state
  if (count <= 0) return { kind: 'ignore' }
  const active = Math.min(Math.max(state.activeIndex, 0), count - 1)
  switch (key) {
    case 'ArrowDown':
      return { kind: 'move', index: (active + 1) % count }
    case 'ArrowUp':
      return { kind: 'move', index: (active - 1 + count) % count }
    case 'Enter':
    case 'Tab':
      return { kind: 'insert', index: active }
    case 'Escape':
      return { kind: 'close' }
    default:
      return { kind: 'ignore' }
  }
}

export function mentionOptionId(listId: string, alias: string): string {
  return `${listId}-${alias}`
}

/**
 * The listbox itself. It is anchored ABOVE the composer field, so it can never
 * cover Cancel / Comment / Send (R10), and it owns no focus: the textarea keeps
 * focus and points at the active option with `aria-activedescendant`.
 */
export function AgentMentionPicker({
  options,
  activeIndex,
  listId,
  onChoose,
  onActiveIndexChange,
}: {
  options: readonly AgentMentionOption[]
  activeIndex: number
  listId: string
  onChoose: (option: AgentMentionOption) => void
  onActiveIndexChange: (index: number) => void
}) {
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (options.length === 0) return null

  return (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label="Assign an agent"
      className="rm-mention-pop"
    >
      {options.map((option, index) => (
        <li
          key={option.alias}
          id={mentionOptionId(listId, option.alias)}
          role="option"
          aria-selected={index === activeIndex}
          data-active={index === activeIndex}
          className="rm-mention-opt"
          // Keep the caret where it is: the textarea must not lose focus.
          onMouseDown={(event) => {
            event.preventDefault()
            onChoose(option)
          }}
          onMouseEnter={() => onActiveIndexChange(index)}
        >
          <span className="rm-mention-opt-alias">@{option.alias}</span>
          <span className="rm-mention-opt-label">{option.label}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * commentIndex — Sprint 105 (#164) R1: the shared, ID-deduplicated document
 * comment index.
 *
 * ONE scan over the ProseMirror document is the source of truth for the
 * toolbar badge, the overview, and dispatch payloads — the same identity rules
 * the margin rail uses (multi-block fragments sharing a `data-comment-id`
 * count ONCE; id-less legacy marks fall back to positional identity; two
 * same-text comments with distinct ranges stay distinct).
 *
 * Pure over a minimal doc interface so it is unit-testable without TipTap.
 */

import { parseCommentBody, type CommentAgentAlias } from './commentModel'

/** The minimal ProseMirror surface the index needs (test-fakeable). */
export interface MinimalNode {
  isText: boolean
  text?: string
  type: { name: string }
  attrs: Record<string, unknown>
  marks: ReadonlyArray<{ type: { name: string }; attrs: Record<string, unknown> }>
  nodeSize: number
  descendants(cb: (node: MinimalNode, pos: number) => boolean | void): void
  textBetween(from: number, to: number, blockSeparator?: string): string
}

export interface IndexedComment {
  /** Stable identity: `c:<id>` | `m:<from>-<to>` | `n:<pos>` (rail-compatible). */
  key: string
  commentId?: string
  kind: 'mark' | 'node'
  /** Raw body text (source of truth for assignment). */
  note: string
  alias: CommentAgentAlias | null
  /** Instruction with the `@alias` prefix stripped. */
  instruction: string
  /** Anchored text across every fragment (marks only). */
  anchoredText?: string
  /** First fragment position — document order. */
  position: number
}

export interface CommentSummary {
  total: number
  assigned: number
  unassigned: number
  byAgent: Array<{ alias: CommentAgentAlias; comments: IndexedComment[] }>
}

interface MarkAccumulator {
  key: string
  commentId?: string
  note: string
  position: number
  ranges: Array<{ from: number; to: number }>
}

/** Collect every unique comment in document order. */
export function collectDocumentComments(doc: MinimalNode): IndexedComment[] {
  const markAcc = new Map<string, MarkAccumulator>()
  const nodes: IndexedComment[] = []

  doc.descendants((node, pos) => {
    if (node.type.name === 'commentNode') {
      const note = String(node.attrs.note ?? '')
      const parsed = parseCommentBody(note)
      nodes.push({
        key: `n:${pos}`,
        kind: 'node',
        note,
        alias: parsed.alias,
        instruction: parsed.text,
        position: pos,
      })
      return
    }
    if (!node.isText) return
    const mark = node.marks.find((m) => m.type.name === 'commentMark')
    if (!mark) return
    const id = (mark.attrs.id as string | null) || undefined
    const from = pos
    const to = pos + node.nodeSize
    // Identity: shared data-comment-id collapses fragments; id-less legacy
    // marks merge only ADJACENT ranges (same visual comment split by
    // formatting), matching the rail's positional identity.
    const existingByAdjacency = !id
      ? [...markAcc.values()].find((a) => !a.commentId && a.ranges.some((r) => r.to === from))
      : undefined
    const accKey = id ? `c:${id}` : existingByAdjacency?.key ?? `m:${from}-${to}`
    const acc = markAcc.get(accKey)
    if (acc) {
      acc.ranges.push({ from, to })
    } else {
      markAcc.set(accKey, {
        key: accKey,
        commentId: id,
        note: String(mark.attrs.note ?? ''),
        position: from,
        ranges: [{ from, to }],
      })
    }
  })

  const marks: IndexedComment[] = [...markAcc.values()].map((a) => {
    const parsed = parseCommentBody(a.note)
    return {
      key: a.key,
      commentId: a.commentId,
      kind: 'mark' as const,
      note: a.note,
      alias: parsed.alias,
      instruction: parsed.text,
      anchoredText: a.ranges
        .map((r) => doc.textBetween(r.from, r.to, ' '))
        .filter(Boolean)
        .join(' '),
      position: a.position,
    }
  })

  return [...marks, ...nodes].sort((a, b) => a.position - b.position)
}

/** Badge/overview rollup: totals + per-agent groups in document order. */
export function summarizeComments(comments: IndexedComment[]): CommentSummary {
  const byAgent = new Map<CommentAgentAlias, IndexedComment[]>()
  let unassigned = 0
  for (const c of comments) {
    if (c.alias) {
      const list = byAgent.get(c.alias) ?? []
      list.push(c)
      byAgent.set(c.alias, list)
    } else {
      unassigned += 1
    }
  }
  return {
    total: comments.length,
    assigned: comments.length - unassigned,
    unassigned,
    byAgent: [...byAgent.entries()].map(([alias, list]) => ({ alias, comments: list })),
  }
}

/**
 * Sprint 105 R3: ONE ordered task prompt per agent. Comments appear in
 * document order with their stable ids and anchored text so the agent can
 * work through them and reference each precisely. Dispatch-only wording —
 * the agent must not delete or resolve the comment carriers.
 */
export function buildAgentTaskPrompt(documentPath: string, comments: IndexedComment[]): string {
  const lines: string[] = [
    `The user assigned you ${comments.length === 1 ? 'this comment' : `these ${comments.length} comments`} in ${documentPath}. Work through ${comments.length === 1 ? 'it' : 'them in order'}.`,
    'Do NOT remove or rewrite the comment markers themselves (the <mark data-comment> wrappers / <!-- --> notes) unless a comment explicitly asks for that — the user clears their own comments.',
    '',
  ]
  comments.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.instruction || c.note}`)
    if (c.commentId) lines.push(`   Comment id: ${c.commentId}`)
    if (c.anchoredText) lines.push(`   Anchored to: "${c.anchoredText}"`)
    if (c.kind === 'node') lines.push('   (standalone note — not anchored to specific text)')
    lines.push('')
  })
  return lines.join('\n').trimEnd()
}

/**
 * Sprint 117 (#292) R10 — the `@` picker's caret maths and key handling.
 *
 * Pure logic only: the listbox itself is exercised on a running instance. The
 * rule under test is the one that keeps picker and collector honest — what the
 * picker inserts must be exactly what `detectAgentAlias` recognises.
 */
import assert from 'node:assert/strict'
import {
  AGENT_MENTION_OPTIONS,
  filterAgentOptions,
  findMentionQuery,
  insertMention,
  mentionKeyAction,
  mentionOptionId,
} from './AgentMentionPicker'
import { COMMENT_AGENT_ALIASES, detectAgentAlias } from '../../extensions/comment/commentModel'

// One vocabulary with the collector.
{
  assert.deepEqual(
    AGENT_MENTION_OPTIONS.map((o) => o.alias),
    [...COMMENT_AGENT_ALIASES],
  )
  for (const option of AGENT_MENTION_OPTIONS) {
    assert.ok(option.label.trim().length > 0, `${option.alias} has a display name`)
    const inserted = insertMention('', { start: 0, query: '' }, option.alias).text
    assert.equal(detectAgentAlias(inserted), option.alias, 'the inserted mention assigns')
  }
}

// `@` opens immediately, at the start and after whitespace.
{
  assert.deepEqual(findMentionQuery('@', 1), { start: 0, query: '' })
  assert.deepEqual(findMentionQuery('Please @', 8), { start: 7, query: '' })
  assert.deepEqual(findMentionQuery('@cla', 4), { start: 0, query: 'cla' })
  assert.deepEqual(findMentionQuery('tighten this @cod', 17), { start: 13, query: 'cod' })
  // A newline is a word boundary too.
  assert.deepEqual(findMentionQuery('one\n@c', 6), { start: 4, query: 'c' })
}

// It does not open mid-word, after a completed mention, or across a space.
{
  assert.equal(findMentionQuery('me@codex', 8), null, 'an address is not an assignment')
  assert.equal(findMentionQuery('@claude ', 8), null, 'the trailing space closes it')
  assert.equal(findMentionQuery('@claude do it', 13), null)
  assert.equal(findMentionQuery('no mention here', 15), null)
  assert.equal(findMentionQuery('@claude', 99), null, 'a caret past the end is not a query')
}

// Every keystroke filters; nothing matching closes the list.
{
  assert.equal(filterAgentOptions('').length, 3)
  assert.deepEqual(filterAgentOptions('c').map((o) => o.alias), ['claude', 'codex'])
  assert.deepEqual(filterAgentOptions('cla').map((o) => o.alias), ['claude'])
  assert.deepEqual(filterAgentOptions('CO').map((o) => o.alias), ['codex'])
  assert.deepEqual(filterAgentOptions('open').map((o) => o.alias), ['opencode'])
  assert.deepEqual(filterAgentOptions('zz'), [], 'no match → the picker closes')
}

// Insertion places `@alias ` at the caret and does not eat the rest of the note.
{
  const text = '@cla tighten this'
  const mention = findMentionQuery(text, 4)
  assert.ok(mention)
  const result = insertMention(text, mention, 'claude')
  assert.equal(result.text, '@claude tighten this')
  assert.equal(result.caret, '@claude '.length)

  const mid = 'compare with @cod please'
  const midMention = findMentionQuery(mid, 17)
  assert.ok(midMention)
  const midResult = insertMention(mid, midMention, 'codex')
  assert.equal(midResult.text, 'compare with @codex please')
  assert.equal(midResult.caret, 'compare with @codex '.length)

  // At the very end there is no tail space to absorb.
  const end = insertMention('do it @o', { start: 6, query: 'o' }, 'opencode')
  assert.equal(end.text, 'do it @opencode ')
  assert.equal(end.caret, end.text.length)
}

// Keyboard: arrows wrap, Enter and Tab insert, Escape closes.
{
  assert.deepEqual(mentionKeyAction('ArrowDown', { count: 3, activeIndex: 0 }), { kind: 'move', index: 1 })
  assert.deepEqual(mentionKeyAction('ArrowDown', { count: 3, activeIndex: 2 }), { kind: 'move', index: 0 })
  assert.deepEqual(mentionKeyAction('ArrowUp', { count: 3, activeIndex: 0 }), { kind: 'move', index: 2 })
  assert.deepEqual(mentionKeyAction('Enter', { count: 3, activeIndex: 1 }), { kind: 'insert', index: 1 })
  assert.deepEqual(mentionKeyAction('Tab', { count: 3, activeIndex: 2 }), { kind: 'insert', index: 2 })
  assert.deepEqual(mentionKeyAction('Escape', { count: 3, activeIndex: 0 }), { kind: 'close' })
  assert.deepEqual(mentionKeyAction('a', { count: 3, activeIndex: 0 }), { kind: 'ignore' })
  // With nothing listed the composer keeps its own Enter/Escape behaviour.
  assert.deepEqual(mentionKeyAction('Enter', { count: 0, activeIndex: 0 }), { kind: 'ignore' })
  // An out-of-range active index cannot insert an option that is not there.
  assert.deepEqual(mentionKeyAction('Enter', { count: 2, activeIndex: 7 }), { kind: 'insert', index: 1 })
  assert.deepEqual(mentionKeyAction('Enter', { count: 2, activeIndex: -3 }), { kind: 'insert', index: 0 })
}

// Option ids are stable and unique per list — `aria-activedescendant` needs that.
{
  const ids = AGENT_MENTION_OPTIONS.map((o) => mentionOptionId('rm-mention-1', o.alias))
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(ids[0], 'rm-mention-1-claude')
}

console.log('AgentMentionPicker: all assertions passed')

/**
 * Comment round-trip tests (Sprint 94 #81). Run with `npx tsx <this file>` — the
 * repo convention (node:assert at module top-level), same as the other webview
 * tests. Covers the `marked` (load) ↔ Turndown (save) string layer + the model
 * helpers. The TipTap `getHTML()` layer is exercised in dev-mode manual QA.
 */
import { strict as assert } from 'assert'
import { Marked } from 'marked'
import { createTurndownService } from '../../utils/turndownService'
import { commentMarkedExtension } from './commentMarkedExtension'
import { addCommentTurndownRules } from './commentTurndownRules'
import {
  parseCommentBody,
  hasCommentTerminator,
  detectAgentAlias,
  stripAgentMentions,
} from './commentModel'

function mdToHtml(md: string): string {
  const m = new Marked({ breaks: true, gfm: true })
  m.use(commentMarkedExtension as Parameters<typeof m.use>[0])
  return m.parse(md) as string
}
function roundTrip(md: string): string {
  const s = createTurndownService()
  addCommentTurndownRules(s)
  return s.turndown(mdToHtml(md))
}
const norm = (s: string) => s.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()

// ---- standalone notes ----
assert.equal(
  norm(roundTrip('Before.\n\n<!-- verify the launch date -->\n\nAfter.')),
  norm('Before.\n\n<!-- verify the launch date -->\n\nAfter.'),
  'single-line standalone round-trips',
)
assert.ok(mdToHtml('<!-- @claude: fix -->').includes('data-agent="claude"'), 'assigned derives data-agent')
assert.equal(
  norm(roundTrip('<!-- @claude: double-check these figures -->')),
  norm('<!-- @claude: double-check these figures -->'),
  'assigned standalone round-trips',
)
assert.match(roundTrip('<!--\nfirst line\nsecond line\n-->'), /first line\nsecond line/, 'multi-line keeps its line breaks')

// ---- code fence must NOT be converted (the Sprint 72 blocker) ----
{
  const html = mdToHtml('```\n<!-- not a comment -->\n```')
  assert.ok(!html.includes('<ritemark-comment'), 'comment inside a fenced code block is not converted')
  assert.ok(html.includes('&lt;!-- not a comment --&gt;'), 'fenced comment stays escaped in the code block')
}

// ---- XSS / escaping ----
{
  const html = mdToHtml('<!-- <script>alert(1)</script> -->')
  assert.ok(!html.includes('<script>'), 'script payload is escaped on load')
  assert.ok(roundTrip('<!-- <script>alert(1)</script> -->').includes('<script>alert(1)</script>'), 'body restored on round-trip')
}

// ---- anchored comment marks ----
assert.equal(
  norm(roundTrip('The <mark data-comment="verify with finance">margins</mark> line.')),
  norm('The <mark data-comment="verify with finance">margins</mark> line.'),
  'anchored mark round-trips',
)
assert.equal(
  norm(roundTrip('a <mark data-comment="">b</mark> c')),
  norm('a b c'),
  'empty-note mark is unwrapped, not persisted (audit M-A)',
)

// ---- shared comment id (#150): multi-block comment stays ONE comment ----
assert.match(
  roundTrip('The <mark data-comment="check" data-comment-id="c1">margins</mark> line.'),
  /data-comment-id="c1"/,
  'anchored mark preserves its shared id',
)
{
  // Two blocks whose fragments share one id must ALL keep that id, so on reload
  // the rail groups them into a single comment instead of one-per-block.
  const md =
    'First <mark data-comment="rethink" data-comment-id="c9">para</mark> here.\n\n' +
    'Second <mark data-comment="rethink" data-comment-id="c9">para</mark> too.'
  const ids = (roundTrip(md).match(/data-comment-id="c9"/g) || []).length
  assert.equal(ids, 2, 'every fragment of a multi-block comment keeps the same id')
}
assert.ok(
  !/data-comment-id/.test(roundTrip('The <mark data-comment="x">margins</mark> line.')),
  'a legacy id-less mark round-trips without inventing an id (back-compat)',
)

// ---- mention parsing ----
assert.equal(parseCommentBody('@claude: fix').alias, 'claude', 'colon form assigns')
assert.equal(parseCommentBody('@codex fix').alias, 'codex', 'no-colon form assigns')
assert.equal(parseCommentBody('@Claude fix').alias, 'claude', 'capitalized alias assigns (case-insensitive)')
assert.equal(parseCommentBody('@codex.com is our site').alias, null, '@codex.com is NOT an alias (audit L-A)')
assert.equal(parseCommentBody('ask @claude ok').alias, null, 'a mid-sentence mention is not an assignment')

// ---- agent detection (mention anywhere in the note assigns) ----
assert.equal(detectAgentAlias('@claude: fix'), 'claude', 'leading mention assigns')
assert.equal(detectAgentAlias('Väike kommentaar siia! @claude'), 'claude', 'a trailing mention assigns too')
assert.equal(detectAgentAlias('note @Codex here'), 'codex', 'a mid-note capitalized mention assigns')
assert.equal(detectAgentAlias('see @codex.com'), null, '@codex.com (a domain) does NOT assign')
assert.equal(detectAgentAlias('plain note'), null, 'no mention → not assigned')
assert.equal(stripAgentMentions('@claude: rewrite this'), 'rewrite this', 'leading mention stripped for the prompt')
assert.equal(stripAgentMentions('Väike kommentaar siia! @claude'), 'Väike kommentaar siia!', 'trailing mention stripped for the prompt')

// ---- terminator guard ----
assert.equal(hasCommentTerminator('oops --> broken'), true, 'a `-->` body is flagged')
assert.equal(hasCommentTerminator('fine note'), false, 'a clean body is not flagged')

console.log('commentRoundTrip.test.ts — all assertions passed')

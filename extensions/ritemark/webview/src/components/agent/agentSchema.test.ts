/**
 * Tests for agentSchema.ts — tools field parsing/serialization.
 * Run: npx tsx webview/src/components/agent/agentSchema.test.ts
 */
import assert from 'node:assert'
import { parseToolsField, serializeToolsField, canonicalizeToolName, CLAUDE_TOOLS } from './agentSchema'

// Repo convention: comma-separated string (this is what all 9 .claude/agents/*.md files use)
assert.deepStrictEqual(
  parseToolsField('Read, Write, Edit, Glob, Grep'),
  ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
  'comma-separated string with spaces'
)

// No spaces after commas
assert.deepStrictEqual(parseToolsField('Read,Bash'), ['Read', 'Bash'], 'comma-separated without spaces')

// YAML array form (also valid per spec)
assert.deepStrictEqual(parseToolsField(['Read', 'Write']), ['Read', 'Write'], 'YAML array')

// Legacy lowercase ids written by the old (broken) configurator → self-heal to canonical
assert.deepStrictEqual(
  parseToolsField(['bash', 'web_fetch', 'read']),
  ['Bash', 'WebFetch', 'Read'],
  'legacy lowercase ids are canonicalized'
)

// Case-insensitive matching against canonical names
assert.deepStrictEqual(parseToolsField('READ, webfetch'), ['Read', 'WebFetch'], 'case-insensitive')

// Unknown tool names (MCP tools, future tools) are preserved, never dropped
assert.deepStrictEqual(
  parseToolsField('Read, mcp__pencil__get_screenshot'),
  ['Read', 'mcp__pencil__get_screenshot'],
  'unknown names preserved'
)

// Empty/missing = inherit all
assert.deepStrictEqual(parseToolsField(undefined), [], 'undefined → []')
assert.deepStrictEqual(parseToolsField(null), [], 'null → []')
assert.deepStrictEqual(parseToolsField(''), [], 'empty string → []')

// Serialization roundtrip matches repo convention
assert.strictEqual(serializeToolsField(['Read', 'Write', 'Edit']), 'Read, Write, Edit', 'serialize')
assert.deepStrictEqual(
  parseToolsField(serializeToolsField(parseToolsField('Read, Write'))),
  ['Read', 'Write'],
  'roundtrip stable'
)

// Canonical list sanity
assert.ok(CLAUDE_TOOLS.length >= 8, 'has the core tools')
assert.strictEqual(canonicalizeToolName(' Bash '), 'Bash', 'trims whitespace')
assert.strictEqual(canonicalizeToolName(''), '', 'empty stays empty')

console.log('agentSchema tests passed ✅')

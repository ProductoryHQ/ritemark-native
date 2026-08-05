/**
 * chatLinks tests — chat markdown link classification.
 */
import assert from 'node:assert/strict'
import { classifyChatHref, stripLineSuffix } from './chatLinks'

// Workspace-relative and absolute paths are file targets.
assert.deepEqual(classifyChatHref('koondfail.md'), { kind: 'file', path: 'koondfail.md' })
assert.deepEqual(classifyChatHref('docs/plan.md'), { kind: 'file', path: 'docs/plan.md' })
assert.deepEqual(classifyChatHref('./notes/ideas.csv'), { kind: 'file', path: './notes/ideas.csv' })
assert.deepEqual(classifyChatHref('/tmp/ws/report.md'), { kind: 'file', path: '/tmp/ws/report.md' })

// Percent-encoded names decode ("minu%20fail.md" → "minu fail.md").
assert.deepEqual(classifyChatHref('minu%20fail.md'), { kind: 'file', path: 'minu fail.md' })

// Line suffixes strip; Windows drive letters do NOT lose ":\..." (only :NN at end).
assert.deepEqual(classifyChatHref('src/foo.ts:42'), { kind: 'file', path: 'src/foo.ts' })
assert.deepEqual(classifyChatHref('src/foo.ts:42:7'), { kind: 'file', path: 'src/foo.ts' })
assert.equal(stripLineSuffix('C:\\ws\\a.md'), 'C:\\ws\\a.md')

// Root-level paths WITH line suffixes are files, not schemes (Codex, PR #176).
assert.deepEqual(classifyChatHref('README.md:12'), { kind: 'file', path: 'README.md' })
assert.deepEqual(classifyChatHref('foo.ts:42'), { kind: 'file', path: 'foo.ts' })

// Web links stay external.
assert.deepEqual(classifyChatHref('https://ritemark.app/docs'), { kind: 'external', url: 'https://ritemark.app/docs' })
assert.deepEqual(classifyChatHref('HTTP://example.com'), { kind: 'external', url: 'HTTP://example.com' })

// file:// URLs resolve to their filesystem path.
assert.deepEqual(classifyChatHref('file:///tmp/ws/report.md'), { kind: 'file', path: '/tmp/ws/report.md' })

// Anchors, empty, and foreign schemes are ignored — especially the dangerous ones.
assert.deepEqual(classifyChatHref('#section'), { kind: 'none' })
assert.deepEqual(classifyChatHref(''), { kind: 'none' })
assert.deepEqual(classifyChatHref(undefined), { kind: 'none' })
assert.deepEqual(classifyChatHref('mailto:x@y.z'), { kind: 'none' })
assert.deepEqual(classifyChatHref('command:workbench.action.openSettings'), { kind: 'none' })
assert.deepEqual(classifyChatHref('javascript:alert(1)'), { kind: 'none' })
assert.deepEqual(classifyChatHref('vscode://file/etc/passwd'), { kind: 'none' })

console.log('chatLinks tests passed.')

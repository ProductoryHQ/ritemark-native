/**
 * chatLinks tests — chat markdown link classification.
 */
import assert from 'node:assert/strict'
import { chatLinkMenu, classifyChatHref, stripLineSuffix } from './chatLinks'

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

// Anchors and empty hrefs are not links to anything.
assert.deepEqual(classifyChatHref('#section'), { kind: 'none' })
assert.deepEqual(classifyChatHref(''), { kind: 'none' })
assert.deepEqual(classifyChatHref(undefined), { kind: 'none' })

// Foreign schemes are never followed — especially the dangerous ones — but
// since Sprint 122 (#282) they are named, so the click can say why nothing
// opened instead of doing nothing at all.
assert.deepEqual(classifyChatHref('mailto:x@y.z'), { kind: 'unsupported', href: 'mailto:x@y.z', scheme: 'mailto' })
assert.deepEqual(classifyChatHref('command:workbench.action.openSettings'), {
  kind: 'unsupported',
  href: 'command:workbench.action.openSettings',
  scheme: 'command',
})
assert.deepEqual(classifyChatHref('javascript:alert(1)'), { kind: 'unsupported', href: 'javascript:alert(1)', scheme: 'javascript' })
assert.deepEqual(classifyChatHref('vscode://file/etc/passwd'), { kind: 'unsupported', href: 'vscode://file/etc/passwd', scheme: 'vscode' })
assert.deepEqual(classifyChatHref('VSCODE://x'), { kind: 'unsupported', href: 'VSCODE://x', scheme: 'vscode' })
assert.equal(classifyChatHref('data:text/html,<b>x</b>').kind, 'unsupported')

// --- Sprint 122: the context menu per destination. The first item is what an
// ordinary click does; an out-of-project path is only revealed or copied.
const labels = (items: ReturnType<typeof chatLinkMenu>) => items.map((item) => `${item.action}:${item.label}`)

assert.deepEqual(labels(chatLinkMenu({ kind: 'local', local: 'project-file' }, 'mac')), [
  'open:Open',
  'reveal-in-project:Reveal in project',
  'copy:Copy path',
])
assert.deepEqual(labels(chatLinkMenu({ kind: 'local', local: 'project-folder' }, 'mac')), [
  'reveal-in-project:Reveal in project',
  'locate:Locate in Finder',
  'copy:Copy path',
])
for (const local of ['outside-file', 'outside-folder'] as const) {
  const items = chatLinkMenu({ kind: 'local', local }, 'mac')
  assert.deepEqual(labels(items), ['locate:Locate in Finder', 'copy:Copy path'])
  assert.ok(!items.some((item) => item.action === 'open'), `${local} is never opened from chat`)
}
assert.deepEqual(labels(chatLinkMenu({ kind: 'local', local: 'missing' }, 'mac')), ['copy:Copy path'])
assert.deepEqual(labels(chatLinkMenu({ kind: 'local', local: 'needs-folder' }, 'mac')), ['copy:Copy path'])
assert.deepEqual(labels(chatLinkMenu({ kind: 'local', local: 'inaccessible' }, 'mac')), ['copy:Copy path'])
assert.deepEqual(labels(chatLinkMenu({ kind: 'external' }, 'mac')), ['open-web:Open in browser', 'copy:Copy link'])
assert.deepEqual(labels(chatLinkMenu({ kind: 'unsupported' }, 'mac')), ['copy:Copy link'])

// Windows says File Explorer, not Finder.
assert.deepEqual(labels(chatLinkMenu({ kind: 'local', local: 'outside-file' }, 'other')), [
  'locate:Show in File Explorer',
  'copy:Copy path',
])

console.log('chatLinks tests passed.')

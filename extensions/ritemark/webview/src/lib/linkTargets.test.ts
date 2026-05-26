import { strict as assert } from 'assert';
import {
  canOpenExternally,
  classifyLinkTarget,
  isSafeRelativePath,
  normalizeExternalUrl,
} from './linkTargets';

assert.deepEqual(classifyLinkTarget('example.com'), {
  kind: 'external',
  href: 'https://example.com',
});

assert.deepEqual(classifyLinkTarget('HTTPS://example.com'), {
  kind: 'external',
  href: 'https://example.com',
});

assert.deepEqual(classifyLinkTarget('../briefs/q2-plan.md'), {
  kind: 'internal',
  href: '../briefs/q2-plan.md',
});

assert.deepEqual(classifyLinkTarget('follow-up.md'), {
  kind: 'internal',
  href: 'follow-up.md',
});

assert.equal(isSafeRelativePath('docs/notes/file with spaces.md'), true);
assert.equal(isSafeRelativePath('javascript:alert(1)'), false);
assert.equal(isSafeRelativePath('data:text/html,hi'), false);
assert.equal(isSafeRelativePath('/absolute/path.md'), false);
assert.equal(canOpenExternally('../briefs/q2-plan.md'), false);
assert.equal(canOpenExternally('https://example.com'), true);
assert.equal(normalizeExternalUrl('example.com'), 'https://example.com');

// Sprint 72 regression: bare same-directory file targets must classify as
// internal so the Add Link dialog hides the external-open icon. See
// docs/development/sprints/sprint-72-markdown-navigation-annotations/
// sprint-plan.md "Defect found during dev smoke".
assert.deepEqual(classifyLinkTarget('spec.md'), {
  kind: 'internal',
  href: 'spec.md',
});
assert.deepEqual(classifyLinkTarget('Notes.PDF'), {
  kind: 'internal',
  href: 'Notes.PDF',
});
assert.equal(canOpenExternally('spec.md'), false);
assert.equal(canOpenExternally('image.png'), false);
assert.equal(canOpenExternally('archive.tar.gz'), false);
// Sprint 72 R1 allowlist removal: source / config files picked from @-search
// must keep classifying as internal so the external-open icon stays hidden.
assert.deepEqual(classifyLinkTarget('test-utils.js'), {
  kind: 'internal',
  href: 'test-utils.js',
});
assert.deepEqual(classifyLinkTarget('module.ts'), {
  kind: 'internal',
  href: 'module.ts',
});
assert.deepEqual(classifyLinkTarget('config.yaml'), {
  kind: 'internal',
  href: 'config.yaml',
});
assert.equal(canOpenExternally('script.py'), false);
assert.equal(canOpenExternally('Cargo.toml'), false);
// Known TLD-only extensions still classify as external (regression guard).
assert.deepEqual(classifyLinkTarget('example.com'), {
  kind: 'external',
  href: 'https://example.com',
});
assert.deepEqual(classifyLinkTarget('foo.io'), {
  kind: 'external',
  href: 'https://foo.io',
});

// Codex review #1 (PR #89 / v1.7.2): hostnames with a path were falling
// through to the internal-link branch because `looksLikeExternalHost`
// rejected anything containing a `/`. With R7 internal-link navigation
// shipping in v1.7.2, that made Cmd-click try to open
// `example.com/docs/getting-started` as an on-disk file. The host portion
// is now extracted and tested in isolation.
assert.deepEqual(classifyLinkTarget('example.com/docs/getting-started'), {
  kind: 'external',
  href: 'https://example.com/docs/getting-started',
});
assert.deepEqual(classifyLinkTarget('subdomain.example.com/path/to/page'), {
  kind: 'external',
  href: 'https://subdomain.example.com/path/to/page',
});
assert.equal(canOpenExternally('example.com/docs/getting-started'), true);
// Single-segment first parts (no `.` in host) are still internal — a path
// like `not-a-host/file.md` is an in-workspace nested file, not a URL.
assert.deepEqual(classifyLinkTarget('not-a-host/file.md'), {
  kind: 'internal',
  href: 'not-a-host/file.md',
});
assert.deepEqual(classifyLinkTarget('path/to/file.md'), {
  kind: 'internal',
  href: 'path/to/file.md',
});

// Codex review #2 (PR #89 / v1.7.2): fragment-only hrefs (`#section`)
// were classifying as internal, which routed Cmd-click through the R7
// resolver — it stripped the fragment, resolved an empty path to the
// document directory, and `vscode.open`'d that directory. Anchor links
// are now their own kind so consumers can route them separately.
assert.deepEqual(classifyLinkTarget('#section-two'), {
  kind: 'anchor',
  href: '#section-two',
});
assert.deepEqual(classifyLinkTarget('#'), {
  kind: 'anchor',
  href: '#',
});
assert.equal(canOpenExternally('#section-two'), false);

// Self-discovered while fixing the above: an internal file path with a
// fragment (`plan.md#section`) was mis-classified as an external host
// because the file-extension check looked at `md#section` (not in
// KNOWN_FILE_EXTENSIONS) instead of `md`. The fragment / query are now
// stripped before the extension comparison.
assert.deepEqual(classifyLinkTarget('plan.md#section'), {
  kind: 'internal',
  href: 'plan.md#section',
});
assert.equal(canOpenExternally('plan.md#section'), false);
assert.deepEqual(classifyLinkTarget('docs/plan.md#section'), {
  kind: 'internal',
  href: 'docs/plan.md#section',
});

console.log('linkTargets tests passed');

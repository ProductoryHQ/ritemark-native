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

console.log('linkTargets tests passed');

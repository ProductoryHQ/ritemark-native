import * as assert from 'assert';
import * as path from 'path';
import {
  isMarkdownFile,
  isPathInside,
  resolveInternalLinkTarget,
} from './internalLinkResolver';

// Synthetic filesystem layout for the test cases. Keys are real paths that
// `realpath` should return; values are themselves. Symlink cases add extra
// keys that map to real targets elsewhere in the map.
//
// All paths are absolute and use the host separator.
const ROOT = path.join(path.sep, 'workspace');
const DOC = path.join(ROOT, 'docs', 'notes', 'meeting.md');
const DOC_DIR = path.dirname(DOC);

interface FakeFs {
  paths: Map<string, string>; // input lexical path → real path
  missing: Set<string>;
}

function makeRealpath(fs: FakeFs) {
  return async (p: string) => {
    if (fs.missing.has(p)) {
      const err: NodeJS.ErrnoException = new Error('ENOENT: no such file');
      err.code = 'ENOENT';
      throw err;
    }
    return fs.paths.get(p) ?? p;
  };
}

function fs(seed: {
  paths?: Record<string, string>;
  missing?: string[];
} = {}): FakeFs {
  return {
    paths: new Map(Object.entries(seed.paths ?? {})),
    missing: new Set(seed.missing ?? []),
  };
}

// --- isPathInside ---------------------------------------------------------

assert.equal(isPathInside(ROOT, ROOT), true, 'same path is inside itself');
assert.equal(
  isPathInside(path.join(ROOT, 'docs', 'a.md'), ROOT),
  true,
  'descendant is inside'
);
assert.equal(
  isPathInside(path.join(path.sep, 'workspace-other'), ROOT),
  false,
  'sibling prefix is NOT inside'
);
assert.equal(
  isPathInside(path.join(path.sep, 'etc', 'passwd'), ROOT),
  false,
  'unrelated path is NOT inside'
);

// --- isMarkdownFile -------------------------------------------------------

assert.equal(isMarkdownFile('plan.md'), true);
assert.equal(isMarkdownFile('plan.MD'), true);
assert.equal(isMarkdownFile('readme.markdown'), true);
assert.equal(isMarkdownFile('story.mdx'), true);
assert.equal(isMarkdownFile('diagram.png'), false);
assert.equal(isMarkdownFile('script.ts'), false);

// --- resolveInternalLinkTarget --------------------------------------------

async function run() {
  // 1) Sibling file in the same folder, inside workspace.
  {
    const target = path.join(DOC_DIR, 'follow-up.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: 'follow-up.md', workspaceFolderPath: ROOT },
      { realpath: makeRealpath(fs({ paths: { [target]: target, [ROOT]: ROOT } })) }
    );
    assert.equal(result.rejection, undefined, 'sibling: no rejection');
    assert.equal(result.realPath, target);
    assert.equal(result.containmentScope, 'workspace');
  }

  // 2) Sibling in another folder via `..`, still inside workspace.
  {
    const target = path.join(ROOT, 'docs', 'briefs', 'q2-plan.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: '../briefs/q2-plan.md', workspaceFolderPath: ROOT },
      { realpath: makeRealpath(fs({ paths: { [target]: target, [ROOT]: ROOT } })) }
    );
    assert.equal(result.rejection, undefined, '..-traversal inside workspace: no rejection');
    assert.equal(result.realPath, target);
  }

  // 3) Path traversal that escapes the workspace.
  {
    const escapedTarget = path.join(path.sep, 'etc', 'passwd');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: '../../../../etc/passwd', workspaceFolderPath: ROOT },
      { realpath: makeRealpath(fs({ paths: { [escapedTarget]: escapedTarget, [ROOT]: ROOT } })) }
    );
    assert.equal(result.rejection, 'out-of-workspace', 'escape attempt is rejected');
  }

  // 4) No workspace folder + target inside the doc parent.
  {
    const target = path.join(DOC_DIR, 'sibling.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: 'sibling.md' },
      { realpath: makeRealpath(fs({ paths: { [target]: target, [DOC_DIR]: DOC_DIR } })) }
    );
    assert.equal(result.rejection, undefined, 'no-workspace sibling: no rejection');
    assert.equal(result.containmentScope, 'document-parent');
  }

  // 5) No workspace folder + target escapes doc parent via `..`.
  {
    const escapedTarget = path.join(ROOT, 'docs', 'briefs', 'q2-plan.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: '../briefs/q2-plan.md' },
      { realpath: makeRealpath(fs({ paths: { [escapedTarget]: escapedTarget, [DOC_DIR]: DOC_DIR } })) }
    );
    assert.equal(result.rejection, 'out-of-workspace', 'no-workspace escape rejected');
  }

  // 6) Symlink inside workspace that points outside the workspace.
  {
    const symlinkLexical = path.join(DOC_DIR, 'escape.md');
    const realOutside = path.join(path.sep, 'somewhere-else', 'secrets.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: 'escape.md', workspaceFolderPath: ROOT },
      {
        realpath: makeRealpath(
          fs({
            paths: {
              [symlinkLexical]: realOutside,
              [ROOT]: ROOT,
            },
          })
        ),
      }
    );
    assert.equal(
      result.rejection,
      'out-of-workspace',
      'symlink to outside real path is rejected'
    );
    assert.equal(result.realPath, realOutside);
  }

  // 7) Missing target file → not-found.
  {
    const missingLexical = path.join(DOC_DIR, 'does-not-exist.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: 'does-not-exist.md', workspaceFolderPath: ROOT },
      {
        realpath: makeRealpath(
          fs({
            paths: { [ROOT]: ROOT },
            missing: [missingLexical],
          })
        ),
      }
    );
    assert.equal(result.rejection, 'not-found', 'missing file → not-found');
    assert.equal(result.realPath, missingLexical, 'lexical path used when realpath ENOENTs');
  }

  // 8) URL-encoded href (space + non-ascii) decodes correctly.
  {
    const target = path.join(DOC_DIR, 'q2 plan.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: 'q2%20plan.md', workspaceFolderPath: ROOT },
      { realpath: makeRealpath(fs({ paths: { [target]: target, [ROOT]: ROOT } })) }
    );
    assert.equal(result.rejection, undefined, 'url-encoded space resolves');
    assert.equal(result.realPath, target);
  }

  // 9) Fragment / query are stripped before resolve.
  {
    const target = path.join(DOC_DIR, 'plan.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: 'plan.md#section-two', workspaceFolderPath: ROOT },
      { realpath: makeRealpath(fs({ paths: { [target]: target, [ROOT]: ROOT } })) }
    );
    assert.equal(result.rejection, undefined, 'fragment stripped');
    assert.equal(result.realPath, target);
  }

  // 10) Symlinked workspace folder still matches when target resolves inside
  //     the *real* workspace location.
  {
    const symlinkedRoot = path.join(path.sep, 'workspace-link');
    const realRoot = ROOT;
    const target = path.join(realRoot, 'docs', 'notes', 'plan.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: DOC, href: 'plan.md', workspaceFolderPath: symlinkedRoot },
      {
        realpath: makeRealpath(
          fs({
            paths: {
              [target]: target,
              [symlinkedRoot]: realRoot,
            },
          })
        ),
      }
    );
    assert.equal(
      result.rejection,
      undefined,
      'symlinked workspace root still contains real target'
    );
  }

  // 11) Missing target whose lexical path lives under a symlinked parent.
  //     This mirrors the real-world macOS case where the workspace lives
  //     under `/tmp` (symlink to `/private/tmp`). The bug we fixed:
  //     without realpath-of-parent-chain, a missing file at
  //     `/tmp/ws/docs/notes/x.md` would be compared against a
  //     realpath'd root `/private/tmp/ws` and wrongly rejected as
  //     out-of-workspace instead of not-found.
  {
    const symlinkedRoot = path.join(path.sep, 'tmp', 'ws');
    const realRoot = path.join(path.sep, 'private', 'tmp', 'ws');
    const realDocDir = path.join(realRoot, 'docs', 'notes');
    const lexicalDocDir = path.join(symlinkedRoot, 'docs', 'notes');
    const lexicalDoc = path.join(lexicalDocDir, 'meeting.md');
    const lexicalMissing = path.join(lexicalDocDir, 'does-not-exist.md');
    const result = await resolveInternalLinkTarget(
      { documentPath: lexicalDoc, href: 'does-not-exist.md', workspaceFolderPath: symlinkedRoot },
      {
        realpath: makeRealpath(
          fs({
            paths: {
              // The workspace root is a symlink — realpath resolves to the
              // private-tmp location.
              [symlinkedRoot]: realRoot,
              // The parent directory exists (the doc itself sits there) and
              // realpath'ing it also resolves under the symlinked workspace.
              [lexicalDocDir]: realDocDir,
              [lexicalDoc]: path.join(realDocDir, 'meeting.md'),
            },
            missing: [lexicalMissing],
          })
        ),
      }
    );
    assert.equal(
      result.rejection,
      'not-found',
      'missing file under symlinked parent must classify as not-found, not out-of-workspace'
    );
    assert.equal(
      result.realPath,
      path.join(realDocDir, 'does-not-exist.md'),
      'realPath stitches realpath(parent) + tail'
    );
  }

  console.log('internalLinkResolver tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

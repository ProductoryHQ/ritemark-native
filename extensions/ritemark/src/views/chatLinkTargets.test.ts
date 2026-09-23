/**
 * Sprint 122 (#282) — what a local path in a chat reply points at, and the
 * gate every chat-link action passes on the host.
 *
 * What a person loses if this is wrong: a model-authored path opens a file
 * outside their project, or a symlink smuggles one in; or, the other way, a
 * link to their own folder does nothing and says nothing.
 *
 * Run with `npx tsx src/views/chatLinkTargets.test.ts`.
 */
import { strict as assert } from 'node:assert';
import * as path from 'path';
import {
  chatLinkMessage,
  clickActionFor,
  isChatLinkActionAllowed,
  resolveChatLocalTarget,
  unsupportedSchemeMessage,
  type ChatLinkAction,
  type ChatLinkFs,
  type ChatLocalTargetKind,
} from './chatLinkTargets';

const ROOT = '/work/harbor';

/** A tiny filesystem: files, folders, symlinks, and paths that refuse access. */
function fakeFs(entries: {
  files?: string[];
  folders?: string[];
  links?: Record<string, string>;
  denied?: string[];
}): ChatLinkFs {
  const files = new Set(entries.files ?? []);
  const folders = new Set(entries.folders ?? []);
  const links = entries.links ?? {};
  const denied = new Set(entries.denied ?? []);
  const fail = (code: string) => Object.assign(new Error(code), { code });
  return {
    realpath(p) {
      const normal = path.normalize(p);
      if (denied.has(normal)) throw fail('EACCES');
      const target = links[normal] ?? normal;
      if (files.has(target) || folders.has(target)) return target;
      throw fail('ENOENT');
    },
    isDirectory(p) {
      return folders.has(p);
    },
  };
}

const fs = fakeFs({
  files: [`${ROOT}/notes/brief.md`, '/Users/Shared/harbor-notes.md', '/etc/hosts'],
  folders: [ROOT, `${ROOT}/notes`, `${ROOT}/notes/designs`, '/Users/Shared'],
  links: { [`${ROOT}/notes/escape.md`]: '/etc/hosts' },
  denied: [`${ROOT}/private.md`],
});

const kindOf = (raw: string): ChatLocalTargetKind => resolveChatLocalTarget(raw, ROOT, fs).kind;
/** With no folder open. */
const kindWithoutFolder = (raw: string): ChatLocalTargetKind => resolveChatLocalTarget(raw, undefined, fs).kind;

{
  // --- inside the project
  assert.equal(kindOf('notes/brief.md'), 'project-file');
  assert.equal(kindOf('./notes/brief.md'), 'project-file');
  assert.equal(kindOf(`${ROOT}/notes/brief.md`), 'project-file', 'an absolute path inside the project is still the project');
  assert.equal(kindOf('notes/designs'), 'project-folder', 'a folder is a folder, not a silent no-op');
  assert.equal(kindOf('.'), 'project-folder', 'the project itself');
  assert.equal(resolveChatLocalTarget('notes/brief.md', ROOT, fs).fsPath, `${ROOT}/notes/brief.md`);
}

{
  // --- outside the project: never a project file, however it is spelled
  assert.equal(kindOf('/Users/Shared/harbor-notes.md'), 'outside-file');
  assert.equal(kindOf('/Users/Shared'), 'outside-folder');
  assert.equal(kindOf('../../etc/hosts'), 'outside-file', '`..` climbing out of the project is outside');
  assert.equal(kindOf('notes/escape.md'), 'outside-file', 'a symlink inside the project that leads outside is outside');
  assert.equal(resolveChatLocalTarget('notes/escape.md', ROOT, fs).fsPath, '/etc/hosts', 'and it is named by where it really is');
  assert.equal(kindOf('/work/harbor-old/plan.md'), 'missing', 'a sibling folder that merely shares the prefix is not the project');
}

{
  // --- nothing there, or nothing Ritemark may read
  assert.equal(kindOf('notes/old-plan.md'), 'missing');
  assert.equal(kindOf('private.md'), 'inaccessible', 'a permission error is not "not found"');
  assert.equal(kindOf(''), 'missing');
  assert.equal(kindWithoutFolder('notes/brief.md'), 'needs-folder', 'a relative path needs a folder to be relative to');
  assert.equal(kindWithoutFolder('/Users/Shared/harbor-notes.md'), 'outside-file', 'an absolute path can still be located without a folder open');
}

{
  // --- what a click does
  assert.equal(clickActionFor('project-file'), 'open');
  assert.equal(clickActionFor('project-folder'), 'reveal-in-project');
  assert.equal(clickActionFor('outside-file'), 'locate');
  assert.equal(clickActionFor('outside-folder'), 'locate');
  for (const kind of ['missing', 'inaccessible', 'needs-folder'] as const) {
    assert.equal(clickActionFor(kind), null, `${kind}: nothing to do, so the click explains`);
    assert.ok(chatLinkMessage(kind, 'notes/old-plan.md'), `${kind} has a message`);
  }
  assert.equal(chatLinkMessage('missing', 'notes/old-plan.md'), 'File not found: notes/old-plan.md');
  assert.equal(chatLinkMessage('project-file', 'x'), null);
}

{
  // --- the gate: only a project file is ever opened
  const allowed = (action: ChatLinkAction) =>
    (['project-file', 'project-folder', 'outside-file', 'outside-folder', 'missing', 'inaccessible', 'needs-folder'] as const)
      .filter((kind) => isChatLinkActionAllowed(action, kind));

  assert.deepEqual(allowed('open'), ['project-file']);
  assert.deepEqual(allowed('reveal-in-project'), ['project-file', 'project-folder']);
  assert.deepEqual(allowed('locate'), ['project-file', 'project-folder', 'outside-file', 'outside-folder']);
  assert.equal(allowed('copy').length, 7, 'copying a path is always allowed');
}

{
  // --- unsupported schemes are named, and nothing odd is echoed back
  assert.equal(unsupportedSchemeMessage('mailto'), "Ritemark doesn't open mailto: links from chat.");
  assert.equal(unsupportedSchemeMessage('VSCODE'), "Ritemark doesn't open vscode: links from chat.");
  assert.equal(unsupportedSchemeMessage('<img src=x>'), "Ritemark doesn't open this kind of link from chat.");
}

console.log('chatLinkTargets.test.ts: all tests passed');

/**
 * Sprint 108 R11 — export path rules.
 *
 * These decide where the user's transcript ends up, and the automatic export
 * (the D5 mitigation) runs without anyone watching — so "never clobber" and
 * "never write somewhere unfindable" are the properties under test.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_EXPORT_FOLDER,
  resolveExportDir,
  uniqueExportPath,
  writeTranscriptMarkdown,
} from './exportTranscript';
import type { TranscriptSession } from './types';

function session(overrides: Partial<TranscriptSession> = {}): TranscriptSession {
  return {
    id: 'client-call-abc',
    audioPath: '/Users/j/Recordings/client-call.m4a',
    audioFingerprint: '1:2',
    durationSec: 2852,
    createdAt: '2026-08-12T09:30:00.000Z',
    updatedAt: '2026-08-12T09:30:00.000Z',
    engine: 'elevenlabs',
    language: 'en',
    speakerSeparation: 'diarized',
    speakers: [{ id: 'speaker_0', label: 'Kadri', colorIndex: 0 }],
    segments: [{ id: 's0', start: 14, end: 22, text: 'Hello there.', speaker: 'speaker_0' }],
    peaks: [],
    ...overrides,
  };
}

async function run(): Promise<void> {
  // ── where it lands ──

  assert.equal(
    resolveExportDir({
      audioPath: '/Users/j/Recordings/call.m4a',
      workspaceRoot: '/Users/j/Notes',
      folderSetting: DEFAULT_EXPORT_FOLDER,
    }),
    path.join('/Users/j/Notes', 'Transcripts'),
    'with a workspace open, exports go into it',
  );

  assert.equal(
    resolveExportDir({
      audioPath: '/Users/j/Recordings/call.m4a',
      workspaceRoot: undefined,
      folderSetting: DEFAULT_EXPORT_FOLDER,
    }),
    '/Users/j/Recordings',
    'with no workspace, the transcript lands beside the recording rather than somewhere unfindable',
  );

  assert.equal(
    resolveExportDir({
      audioPath: '/Users/j/Recordings/call.m4a',
      workspaceRoot: '/Users/j/Notes',
      folderSetting: '/Volumes/Archive/Transcripts',
    }),
    '/Volumes/Archive/Transcripts',
    'an absolute setting is honoured as-is',
  );

  assert.equal(
    resolveExportDir({ audioPath: '/a/b.m4a', workspaceRoot: '/ws', folderSetting: '   ' }),
    path.join('/ws', DEFAULT_EXPORT_FOLDER),
    'a blank setting falls back to the default rather than the workspace root',
  );

  assert.equal(
    resolveExportDir({ audioPath: '/a/b.m4a', workspaceRoot: '/ws', folderSetting: 'Notes/Calls' }),
    path.join('/ws', 'Notes/Calls'),
    'nested relative folders are supported',
  );

  // ── never clobber ──

  const taken = new Set(['/x/call.md', '/x/call-2.md']);
  assert.equal(uniqueExportPath('/x/call.md', (p) => taken.has(p)), path.join('/x', 'call-3.md'));
  assert.equal(uniqueExportPath('/x/fresh.md', (p) => taken.has(p)), '/x/fresh.md');
  assert.equal(
    uniqueExportPath('/x/call.md', () => false),
    '/x/call.md',
    'nothing in the way means the plain name is used',
  );

  // ── writing for real ──

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-export-'));
  try {
    const audioDir = path.join(dir, 'Recordings');
    fs.mkdirSync(audioDir);
    const audioPath = path.join(audioDir, 'client-call.m4a');
    fs.writeFileSync(audioPath, 'audio');

    const workspace = path.join(dir, 'Notes');
    fs.mkdirSync(workspace);

    const first = await writeTranscriptMarkdown({
      session: session({ audioPath }),
      workspaceRoot: workspace,
      folderSetting: DEFAULT_EXPORT_FOLDER,
      collision: 'unique',
    });

    assert.equal(path.basename(first.filePath), 'client-call.md');
    assert.ok(first.filePath.startsWith(path.join(workspace, 'Transcripts')), 'written into the workspace folder');
    assert.equal(first.overwritten, false);
    assert.ok(fs.existsSync(first.filePath), 'the folder is created if missing');

    const contents = fs.readFileSync(first.filePath, 'utf-8');
    assert.ok(contents.includes('**Kadri**'), 'the renamed speaker reaches the file');
    assert.ok(contents.includes('speakers: [Kadri]'));

    // The automatic export must never replace a file the user may have edited.
    const second = await writeTranscriptMarkdown({
      session: session({ audioPath }),
      workspaceRoot: workspace,
      folderSetting: DEFAULT_EXPORT_FOLDER,
      collision: 'unique',
    });
    assert.equal(path.basename(second.filePath), 'client-call-2.md', 'auto-export writes a sibling, never clobbers');
    assert.equal(second.overwritten, false);
    assert.ok(fs.existsSync(first.filePath), 'and the first export survives untouched');

    // The manual button, after confirmation, updates the file the user knows.
    const third = await writeTranscriptMarkdown({
      session: session({ audioPath, exportPath: first.filePath, speakers: [{ id: 'speaker_0', label: 'Merike', colorIndex: 0 }] }),
      workspaceRoot: workspace,
      folderSetting: DEFAULT_EXPORT_FOLDER,
      collision: 'overwrite',
    });
    assert.equal(third.filePath, first.filePath, 'a re-export updates the known file');
    assert.equal(third.overwritten, true);
    assert.ok(
      fs.readFileSync(first.filePath, 'utf-8').includes('**Merike**'),
      'and the new rename is what is on disk',
    );

    // No workspace: beside the recording.
    const beside = await writeTranscriptMarkdown({
      session: session({ audioPath }),
      workspaceRoot: undefined,
      folderSetting: DEFAULT_EXPORT_FOLDER,
      collision: 'unique',
    });
    assert.equal(path.dirname(beside.filePath), audioDir, 'no workspace means beside the audio');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('exportTranscript.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

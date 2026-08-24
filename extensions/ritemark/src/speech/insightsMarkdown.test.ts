import assert from 'node:assert/strict';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  InsightsTargetError,
  insightsToMarkdown,
  normalizeInsightsTargetPath,
  suggestedInsightsFileName,
  validateInsightsFileName,
  validateInsightsTargetPath,
  writeInsightsDocumentExclusive,
} from './insightsMarkdown';
import type { TranscriptInsights, TranscriptSession } from './types';

function session(overrides: Partial<TranscriptSession> = {}): TranscriptSession {
  return {
    id: 'session-1',
    audioPath: '/recordings/client-call.m4a',
    audioFingerprint: '1:2',
    durationSec: 60,
    createdAt: '2026-08-24T09:00:00.000Z',
    updatedAt: '2026-08-24T09:00:00.000Z',
    engine: 'elevenlabs',
    language: 'et',
    speakerSeparation: 'diarized',
    speakers: [{ id: 'speaker_0', label: 'Jarmo Tuisk', colorIndex: 0 }],
    segments: [],
    peaks: [],
    ...overrides,
  };
}

const insights: TranscriptInsights = {
  generatedAt: '2026-08-24T10:00:00.000Z',
  model: 'claude-sonnet-5',
  language: {
    selected: { kind: 'auto' },
    resolved: { kind: 'known', code: 'et' },
  },
  summary: 'Kohtumine käsitles aruandlust.',
  items: [
    { kind: 'decision', text: 'Raport valmib esmaspäeval.', at: 12 },
    { kind: 'action', text: 'Draft the memo.', owner: 'Jarmo Tuisk', at: 41 },
    { kind: 'quote', text: 'Honestly, timing.', owner: 'Jarmo Tuisk', at: 41 },
  ],
};

assert.equal(suggestedInsightsFileName(session()), 'client-call-insights.md');
assert.equal(
  suggestedInsightsFileName(session({ exportPath: '/notes/board-meeting.md' })),
  'board-meeting-insights.md',
);
assert.equal(path.basename(normalizeInsightsTargetPath('/notes/memo')), 'memo.md');
assert.equal(path.basename(normalizeInsightsTargetPath('/notes/memo.MD')), 'memo.MD');
assert.throws(() => normalizeInsightsTargetPath('/notes/trailing.'), InsightsTargetError);
assert.throws(() => normalizeInsightsTargetPath('/notes/CON'), InsightsTargetError);

for (const invalid of ['CON.md', 'nul.MD', 'bad?.md', 'trailing .md.']) {
  assert.throws(() => validateInsightsFileName(`/notes/${invalid}`), InsightsTargetError);
}

const markdown = insightsToMarkdown(session({ exportPath: '/notes/client-call.md' }), insights);
assert.ok(markdown.includes('# Insights — client-call'));
assert.ok(markdown.includes('- Primary transcript: client-call.md'));
assert.ok(markdown.includes('- Insights language: Auto · Estonian'));
assert.ok(markdown.includes('## Decisions'));
assert.ok(markdown.includes('**00:12** Raport valmib esmaspäeval.'));
assert.ok(markdown.includes('Jarmo Tuisk — Draft the memo.'));
assert.ok(markdown.includes('> “Honestly, timing.” — Jarmo Tuisk · 00:41'));
assert.ok(insightsToMarkdown(session(), { ...insights, language: undefined }).includes('English (legacy)'));

async function run(): Promise<void> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ritemark-insights-'));
  try {
    const transcript = path.join(dir, 'meeting.md');
    const target = path.join(dir, 'meeting-insights.md');
    await fsp.writeFile(transcript, 'PRIMARY', 'utf-8');
    const before = await fsp.stat(transcript);

    await validateInsightsTargetPath(target, transcript);
    await writeInsightsDocumentExclusive(target, markdown);
    assert.equal(await fsp.readFile(transcript, 'utf-8'), 'PRIMARY');
    assert.equal((await fsp.stat(transcript)).mtimeMs, before.mtimeMs);
    assert.equal(await fsp.readFile(target, 'utf-8'), markdown);

    await assert.rejects(validateInsightsTargetPath(target, transcript), (error: unknown) =>
      error instanceof InsightsTargetError && error.code === 'exists');
    await assert.rejects(validateInsightsTargetPath(transcript, transcript), (error: unknown) =>
      error instanceof InsightsTargetError && error.code === 'primary-transcript');
    await assert.rejects(
      validateInsightsTargetPath(path.join(dir, 'MEETING.md'), transcript, 'win32'),
      (error: unknown) => error instanceof InsightsTargetError && error.code === 'primary-transcript',
    );

    const existing = path.join(dir, 'existing.md');
    await fsp.writeFile(existing, 'KEEP', 'utf-8');
    await assert.rejects(writeInsightsDocumentExclusive(existing, 'REPLACE'));
    assert.equal(await fsp.readFile(existing, 'utf-8'), 'KEEP');

    const partial = path.join(dir, 'partial.md');
    await assert.rejects(writeInsightsDocumentExclusive(partial, 'PARTIAL', async (handle) => {
      await handle.writeFile('PARTIAL', 'utf-8');
      throw new Error('disk full');
    }));
    await assert.rejects(fsp.access(partial));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }

  console.log('insightsMarkdown.test.ts: all tests passed');
}

void run();

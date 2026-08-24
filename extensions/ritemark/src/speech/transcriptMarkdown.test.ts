/**
 * Sprint 108 R11 — the markdown export.
 *
 * This output is what survives a reinstall (sessions live in hidden app
 * storage, D5), so its shape is load-bearing.
 */
import assert from 'node:assert/strict';
import { sessionToMarkdown, formatTimestamp, formatDuration, titleFor, exportFileName } from './transcriptMarkdown';
import type { TranscriptSession } from './types';

function baseSession(overrides: Partial<TranscriptSession> = {}): TranscriptSession {
  return {
    id: 'client-call-abc',
    audioPath: '/Users/j/Notes/client-call.m4a',
    audioFingerprint: '123:456',
    durationSec: 2852,
    createdAt: '2026-08-12T09:30:00.000Z',
    updatedAt: '2026-08-12T09:30:00.000Z',
    engine: 'elevenlabs',
    language: 'en',
    speakerSeparation: 'diarized',
    speakers: [
      { id: 'speaker_0', label: 'Kadri', colorIndex: 0 },
      { id: 'speaker_1', label: 'Jarmo', colorIndex: 1 },
    ],
    segments: [
      { id: 's0', start: 14, end: 22, text: 'So the reason we wanted this call is the reporting piece.', speaker: 'speaker_0' },
      { id: 's1', start: 22, end: 30, text: 'It is still spreadsheets every Monday.', speaker: 'speaker_0' },
      { id: 's2', start: 41, end: 52, text: 'Is that a data problem or a timing problem?', speaker: 'speaker_1' },
    ],
    peaks: [0.1, 0.9],
    ...overrides,
  };
}

async function run(): Promise<void> {
  // ── formatting helpers ──

  assert.equal(formatTimestamp(0), '00:00');
  assert.equal(formatTimestamp(74), '01:14');
  assert.equal(formatTimestamp(3734), '1:02:14', 'past an hour the hour is shown');
  assert.equal(formatTimestamp(-5), '00:00', 'negatives clamp rather than print nonsense');

  assert.equal(formatDuration(2852), '48 min');
  assert.equal(formatDuration(4340), '1 h 12 min');
  assert.equal(formatDuration(22), '22 s');

  assert.equal(titleFor(baseSession()), 'Client call');
  assert.equal(
    titleFor(baseSession({ audioPath: '/x/2026-08-12_board-review.m4a' })),
    '2026 08 12 board review',
  );
  assert.equal(exportFileName(baseSession()), 'client-call.md');

  // ── diarized export ──

  const markdown = sessionToMarkdown(baseSession());

  assert.ok(markdown.startsWith('---\n'), 'front matter comes first');
  assert.ok(markdown.includes('speakers: [Kadri, Jarmo]'), 'renamed speakers reach the export');
  assert.ok(markdown.includes('source: /Users/j/Notes/client-call.m4a'));
  assert.ok(markdown.includes('duration: 48 min'));
  assert.ok(markdown.includes('# Client call'));
  assert.ok(markdown.includes('## Transcript'));

  assert.ok(markdown.includes('**Kadri** · `00:14`'), 'a speaker turn is labelled with its timestamp');
  assert.ok(markdown.includes('**Jarmo** · `00:41`'));

  // The second Kadri segment repeats the timestamp but not the name.
  const kadriMentions = markdown.match(/\*\*Kadri\*\*/g) ?? [];
  assert.equal(kadriMentions.length, 1, 'a name repeats only when the speaker changes');
  assert.ok(markdown.includes('`00:22`'), 'the follow-on segment still carries its timestamp');

  assert.ok(markdown.endsWith('\n'), 'file ends with a newline');
  assert.ok(!markdown.includes('undefined'), 'no undefined leaked into the document');

  const fullNames = sessionToMarkdown(baseSession({
    speakers: [
      { id: 'speaker_0', label: 'Jarmo Tuisk', colorIndex: 0 },
      { id: 'speaker_1', label: 'Õie-Kärt Žuravljov', colorIndex: 1 },
    ],
  }));
  assert.ok(fullNames.includes('speakers: [Jarmo Tuisk, "Õie-Kärt Žuravljov"]'));
  assert.ok(fullNames.includes('**Jarmo Tuisk** · `00:14`'));
  assert.ok(fullNames.includes('**Õie-Kärt Žuravljov** · `00:41`'));

  // ── non-diarized export states why ──

  const local = sessionToMarkdown(
    baseSession({
      engine: 'whisper-local',
      speakerSeparation: 'none',
      speakers: [],
      segments: [{ id: 's0', start: 14, end: 22, text: 'One continuous track.' }],
    }),
  );

  assert.ok(
    local.includes('speakers: none — this engine cannot separate speakers'),
    'the absence of speakers is explained, not left blank (D3)',
  );
  assert.ok(!local.includes('**Speaker'), 'no invented speaker labels');
  assert.ok(local.includes('`00:14`'), 'timestamps still anchor the text');

  // ── insights ──

  const withInsights = sessionToMarkdown(
    baseSession({
      insights: {
        generatedAt: '2026-08-12T10:00:00.000Z',
        model: 'claude-opus-5',
        summary: 'Reporting is trusted on Monday and untrusted by Wednesday.',
        items: [
          { kind: 'decision', text: 'Reframed as versioning, not data quality', at: 768 },
          { kind: 'action', text: 'Draft a one-page proposal', at: 1867, owner: 'Jarmo' },
          { kind: 'question', text: 'Is the September date fixed?', at: 2400 },
        ],
      },
    }),
  );

  assert.ok(withInsights.includes('## Summary'));
  assert.ok(withInsights.includes('## Decisions'));
  assert.ok(withInsights.includes('- **Jarmo** — Draft a one-page proposal `31:07`'), 'owner and timestamp survive');
  assert.ok(withInsights.includes('## Open questions'));
  assert.ok(
    withInsights.includes('generated by claude-opus-5'),
    'generated content is labelled with the model that wrote it (R10)',
  );
  assert.ok(
    withInsights.indexOf('## Summary') < withInsights.indexOf('## Transcript'),
    'the deliverable sits above the raw material',
  );

  console.log('transcriptMarkdown.test.ts: all tests passed');
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

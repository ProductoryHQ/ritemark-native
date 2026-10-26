/**
 * Sprint 139 (R10, #473): voice captures and notes edited again.
 *
 * Run: npx tsx src/analytics/voiceNotes.test.ts
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { daysBetween, localDay, MAX_VOICE_NOTES, VoiceNotes, type VoiceNotesState } from './voiceNotes';

function harness(options: { maySend?: boolean } = {}) {
  let stored: unknown;
  let today = '2026-11-02';
  let maySend = options.maySend ?? true;
  let salts = 0;
  const sent: Array<{ name: string; properties: Record<string, unknown> }> = [];
  const notes = new VoiceNotes({
    read: () => stored,
    write: async (state) => { stored = state === undefined ? undefined : JSON.parse(JSON.stringify(state)); },
    maySend: () => maySend,
    track: async (name, properties) => {
      if (!maySend) return false;
      sent.push({ name, properties: properties as Record<string, unknown> });
      return true;
    },
    today: () => today,
    randomSalt: () => `salt-${++salts}`,
    hash: (salt, text) => createHash('sha256').update(`${salt}\0${text}`).digest('hex'),
  });
  return {
    notes,
    sent,
    stored: () => stored as VoiceNotesState | undefined,
    setToday: (day: string) => { today = day; },
    setMaySend: (value: boolean) => { maySend = value; },
  };
}

const doc = 'file:///Users/someone/Notes/idea.md';

async function run(): Promise<void> {
  assert.equal(daysBetween('2026-11-02', '2026-11-03'), 1);
  assert.equal(daysBetween('2026-10-31', '2026-11-30'), 30);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2, 'a daylight-saving change is still two days');
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');

  // S48: captures, with input only for Transcribe.
  {
    const { notes, sent } = harness();
    await notes.captured('dictation');
    await notes.captured('transcribe', 'recorded');
    await notes.captured('transcribe', 'file');
    assert.deepEqual(sent, [
      { name: 'voice_captured', properties: { source: 'dictation' } },
      { name: 'voice_captured', properties: { source: 'transcribe', input: 'recorded' } },
      { name: 'voice_captured', properties: { source: 'transcribe', input: 'file' } },
    ]);
  }

  // The list keeps a code, never the name or the path.
  {
    const { notes, stored } = harness();
    await notes.remember(doc, 'dictation');
    const text = JSON.stringify(stored());
    assert.doesNotMatch(text, /idea|Notes|someone|file:/, 'no name, no path');
    assert.equal(stored()?.entries.length, 1);
    assert.equal(stored()?.entries[0].day, '2026-11-02');
    assert.equal(notes.watches(doc), true);
    assert.equal(notes.watches('file:///other.md'), false);
  }

  // S49/S50: same day: nothing; a later day: once, with the days; then nothing more.
  {
    const { notes, sent, setToday, stored } = harness();
    await notes.remember(doc, 'dictation');
    await notes.changedAndSaved(doc);
    assert.deepEqual(sent, [], 'a save on the capture day is not "edited again"');
    setToday('2026-11-03');
    await notes.changedAndSaved(doc);
    assert.deepEqual(sent, [{ name: 'voice_note_edited', properties: { source: 'dictation', days_since_capture: 1 } }]);
    await notes.changedAndSaved(doc);
    assert.equal(sent.length, 1, 'once per capture');
    assert.equal(stored(), undefined, 'the entry is forgotten once its event is sent');
  }

  // A second capture of the same document keeps the first day.
  {
    const { notes, sent, setToday } = harness();
    await notes.remember(doc, 'transcribe');
    setToday('2026-11-04');
    await notes.remember(doc, 'dictation');
    await notes.changedAndSaved(doc);
    assert.deepEqual(sent, [{ name: 'voice_note_edited', properties: { source: 'transcribe', days_since_capture: 2 } }]);
  }

  // S50: older than 30 days: forgotten, nothing sent.
  {
    const { notes, sent, setToday, stored } = harness();
    await notes.remember(doc, 'dictation');
    setToday('2026-12-03');
    await notes.changedAndSaved(doc);
    assert.deepEqual(sent, []);
    assert.equal(stored(), undefined);
    await notes.remember(doc, 'dictation');
    setToday('2027-01-10');
    await notes.prune();
    assert.equal(stored(), undefined, 'activation drops what is old');
  }

  // At most 200; the oldest go first.
  {
    const { notes, stored } = harness();
    for (let index = 0; index < MAX_VOICE_NOTES + 5; index += 1) await notes.remember(`file:///n${index}.md`, 'dictation');
    assert.equal(stored()?.entries.length, MAX_VOICE_NOTES);
    assert.equal(notes.watches('file:///n0.md'), false);
    assert.equal(notes.watches(`file:///n${MAX_VOICE_NOTES + 4}.md`), true);
  }

  // S47/S50: usage data off: nothing remembered, nothing sent; turning it off clears the list, salt and all.
  {
    const { notes, sent, stored, setMaySend } = harness({ maySend: false });
    await notes.remember(doc, 'dictation');
    await notes.captured('dictation');
    assert.equal(stored(), undefined, 'nothing kept while usage data is off');
    assert.deepEqual(sent, []);
    setMaySend(true);
    await notes.remember(doc, 'dictation');
    assert.ok(stored());
    setMaySend(false);
    await notes.prune();
    assert.equal(stored(), undefined, 'turning usage data off clears the list');
  }

  // A damaged list is dropped, never trusted.
  {
    const { notes, stored } = harness();
    await notes.remember(doc, 'dictation');
    const damaged = { salt: 7, entries: 'x' };
    const fresh = harness();
    await (fresh.notes as unknown as { deps: { write(state: unknown): Promise<void> } }).deps.write(damaged as never);
    await fresh.notes.prune();
    assert.equal(fresh.stored(), undefined);
    assert.ok(stored(), 'the healthy list stays');
  }

  console.log('voiceNotes.test.ts: all tests passed');
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});

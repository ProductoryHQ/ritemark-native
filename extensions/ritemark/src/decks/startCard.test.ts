/**
 * Sprint 159 (16 November, the Experience lead's frame 20): the handout's start card. When it shows and with which rows,
 * Draft's one message, and the marks kept in the window's workspace state. Run with `npx tsx src/decks/startCard.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { deckStarted, draftRequest, freshDeckMarks, sendDraft, startCardRows, type DraftSteps } from './startCard';
import { decodeDeckRequest, DeckProtocolError } from './deckProtocol';

async function main(): Promise<void> {
  // When the card shows
  const fresh = { fresh: true, dismissed: false, slideCount: 1, handoutHasText: false, aiReady: true, earlierCount: 4 };
  assert.deepEqual(startCardRows(fresh), { ask: true, copy: true }, 'a fresh deck: both rows');
  assert.equal(startCardRows({ ...fresh, slideCount: 2 }), null, 'a second slide: gone');
  assert.equal(startCardRows({ ...fresh, handoutHasText: true }), null, 'handout text: gone');
  assert.equal(startCardRows({ ...fresh, dismissed: true }), null, '× pressed: gone');
  assert.equal(startCardRows({ ...fresh, fresh: false }), null, 'a deck New did not make (or whose card went): none');
  assert.deepEqual(startCardRows({ ...fresh, aiReady: false }), { ask: false, copy: true }, 'no AI signed in: no Ask row');
  assert.deepEqual(startCardRows({ ...fresh, earlierCount: 0 }), { ask: true, copy: false }, 'no earlier decks: no copy row');
  assert.equal(startCardRows({ ...fresh, aiReady: false, earlierCount: 0 }), null, 'both hidden: no card');
  // The title alone (slide 1, no handout text) keeps it; an empty deck being read is not started either
  assert.equal(deckStarted(1, false), false);
  assert.equal(deckStarted(0, false), false);
  assert.equal(deckStarted(2, false), true);
  assert.equal(deckStarted(1, true), true);

  // Draft: one message, the person's words as a request to draft this deck, sent at once through the AI's sheet's own
  // path (which opens a folded AI column, with the deck in front attached); the deck is saved first, and the card goes
  // only once the message is on its way.
  {
    const log: string[] = [];
    const steps: DraftSteps = {
      ai: async () => ({ id: 'claude-code', name: 'Claude' }),
      forget: async () => { log.push('forget'); },
      save: async () => { log.push('save'); },
      startChat: async request => { log.push(`startChat ${JSON.stringify(request)}`); },
      notice: text => { log.push(`notice ${text}`); },
    };
    assert.equal(await sendDraft('  A 3-hour training for the bank\'s staff  ', steps), true);
    assert.deepEqual(log, ['save', `startChat ${JSON.stringify({ runtimeId: 'claude-code', text: "Draft this deck: A 3-hour training for the bank's staff", send: true })}`, 'forget']);
    assert.equal(log.filter(entry => entry.startsWith('startChat')).length, 1, 'one message');
    // The AI's sheet couldn't take it: the card stays (no forget), and the bar says so
    log.length = 0;
    assert.equal(await sendDraft('Anything', { ...steps, startChat: async () => { throw new Error('no sheet'); } }), false);
    assert.deepEqual(log, ['save', 'notice The message could not be sent to Claude.']);
    // No AI signed in (it signed out after the card was drawn): nothing is sent, the card stays the host's, and the bar says why
    log.length = 0;
    assert.equal(await sendDraft('Anything', { ...steps, ai: async () => null }), false);
    assert.deepEqual(log, ['notice No AI is signed in, so nothing was sent.']);
    assert.equal(draftRequest('For managers'), 'Draft this deck: For managers');
  }

  // The marks: in the workspace state, never in the file; the newest 3 kept here; a mark goes once
  {
    const state = new Map<string, unknown>();
    const store = { get: <T>(key: string) => state.get(key) as T | undefined, update: async (key: string, value: unknown) => { state.set(key, value); } };
    const marks = freshDeckMarks(store, 'fresh', 3);
    assert.equal(marks.has('/p/Untitled.deck.md'), false);
    await marks.add('/p/Untitled.deck.md');
    await marks.add('/p/Untitled 2.deck.md');
    await marks.add('/p/Untitled.deck.md');
    assert.deepEqual(state.get('fresh'), ['/p/Untitled 2.deck.md', '/p/Untitled.deck.md']);
    await marks.add('/p/a.deck.md');
    await marks.add('/p/b.deck.md');
    assert.deepEqual(state.get('fresh'), ['/p/Untitled.deck.md', '/p/a.deck.md', '/p/b.deck.md']);
    await marks.remove('/p/a.deck.md');
    assert.equal(marks.has('/p/a.deck.md'), false);
    assert.equal(marks.has('/p/b.deck.md'), true);
    // Something else in the state under the key: read as no marks
    state.set('fresh', 'garbage');
    assert.equal(marks.has('/p/b.deck.md'), false);
  }

  // The card's requests are decoded with exact fields
  assert.deepEqual(decodeDeckRequest({ type: 'deck/start-card' }), { type: 'deck/start-card' });
  assert.deepEqual(decodeDeckRequest({ type: 'deck/start-card-gone' }), { type: 'deck/start-card-gone' });
  assert.deepEqual(decodeDeckRequest({ type: 'deck/start-draft', text: 'For managers' }), { type: 'deck/start-draft', text: 'For managers' });
  assert.deepEqual(decodeDeckRequest({ type: 'deck/start-copy', source: 'Clients/A.deck.md' }), { type: 'deck/start-copy', source: 'Clients/A.deck.md' });
  assert.throws(() => decodeDeckRequest({ type: 'deck/start-card', extra: 1 }), DeckProtocolError);
  assert.throws(() => decodeDeckRequest({ type: 'deck/start-draft', text: '   ' }), DeckProtocolError, 'no words');
  assert.throws(() => decodeDeckRequest({ type: 'deck/start-draft', text: 'x'.repeat(4001) }), DeckProtocolError, 'too long');
  assert.throws(() => decodeDeckRequest({ type: 'deck/start-copy', source: 'Brief.md' }), DeckProtocolError, 'a deck only');

  console.log('startCard: passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

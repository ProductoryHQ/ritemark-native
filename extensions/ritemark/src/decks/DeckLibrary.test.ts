/**
 * Sprint 157: the Slide library, with an in-memory project. Run with `npx tsx src/decks/DeckLibrary.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { parseFrom, parseSlideBody } from './deckFormat';
import { slidesOfText } from './deckLibraryFormat';
import { DeckLibrary, isTopicPath, type DeckFiles } from './DeckLibrary';

function project(files: Record<string, string>): DeckFiles & { files: Record<string, string> } {
  return {
    files,
    async list() { return Object.keys(files).filter(path => path.endsWith('.deck.md')).map((path, index) => ({ path, modified: index })); },
    async read(path) { return files[path] ?? null; },
    async write(path, text, options) {
      if (options?.create && path in files) throw new Error('exists');
      files[path] = text;
    },
  };
}

const TOPIC = '---\ndeck: 1\n---\n\n```slide boxes\nid: a1\ntitle: Four parts\nimage: images/four.png\nitems:\n- heading: Instructions\n```\n\nSet up once. See ![x](images/s.png).\n\n```slide statement\nid: a2\ntitle: Assistant or agent?\n```\n\nAn agent is given a goal.\n';
const DECK = '---\ndeck: 1\n---\n\n```slide title\nid: t1\ntitle: Harbour\n```\n\nWelcome.\n';

async function run() {
  assert.ok(isTopicPath('Slide library/AI assistants.deck.md'));
  assert.ok(!isTopicPath('Slide library/Themes/x.deck.md'));
  assert.ok(!isTopicPath('Clients/Deck.deck.md'));

  const files = project({ 'Slide library/AI assistants.deck.md': TOPIC, 'Clients/Harbour/Harbour.deck.md': DECK });
  const library = new DeckLibrary(files);

  // List: topics first; a query finds slides by their words and handouts.
  const all = await library.listDecks();
  assert.deepEqual(all.map(deck => [deck.name, deck.topic, deck.slides.length]), [['AI assistants', true, 2], ['Harbour', false, 1]]);
  assert.deepEqual((await library.listDecks({ query: 'goal' })).map(deck => deck.slides.map(slide => slide.id)), [['a2']]);
  assert.deepEqual((await library.listDecks({ where: 'other' })).map(deck => deck.name), ['Harbour']);

  // A copy: a new id, the from line with the source's stamp, paths rebased, no notes.
  const [copy] = await library.copies('Slide library/AI assistants.deck.md', ['a1'], 'Clients/Harbour/Harbour.deck.md', ['t1']);
  const data = parseSlideBody(copy.body);
  assert.notEqual(data.id, 'a1');
  assert.equal(parseFrom(data.from)?.path, 'Slide library/AI assistants.deck.md');
  assert.equal(parseFrom(data.from)?.id, 'a1');
  assert.equal(data.image, '../../Slide library/images/four.png');
  assert.equal(copy.handout, 'Set up once. See ![x](<../../Slide library/images/s.png>).');

  // Its state as copied: unchanged, nothing newer.
  const state = async (body: string, handout: string) => (await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: data.id!, from: parseSlideBody(body).from!, kind: copy.kind, body, handout }]))[0];
  assert.deepEqual(await state(copy.body, copy.handout), { id: data.id, library: true, sourceName: 'AI assistants', sourcePath: 'Slide library/AI assistants.deck.md', changed: false, newer: false, missing: false });

  // Changed here: the copy's words or handout.
  const changedBody = copy.body.replace('title: Four parts', 'title: Four parts, again');
  assert.equal((await state(changedBody, copy.handout)).changed, true);
  assert.equal((await state(copy.body, copy.handout + ' More.')).changed, true, 'a handout change counts (answer 2)');

  // Update the library: the source slide by id, every other byte kept; the copy's new from line matches it.
  const before = files.files['Slide library/AI assistants.deck.md'];
  const update = await library.updateLibrarySlide('Clients/Harbour/Harbour.deck.md', { kind: copy.kind, body: changedBody, handout: copy.handout });
  const after = files.files['Slide library/AI assistants.deck.md'];
  assert.equal(after, before.replace('title: Four parts\n', 'title: Four parts, again\n'), 'only the changed line, paths back in the library\'s folder');
  const updatedBody = changedBody.replace(/^from: .*$/m, `from: ${update.from}`);
  assert.deepEqual(await state(updatedBody, copy.handout), { ...(await state(updatedBody, copy.handout)), changed: false, newer: false });

  // Another deck using the old version sees a newer one, and Use it brings it, keeping its own id.
  const olderCopy = await state(copy.body, copy.handout);
  assert.equal(olderCopy.newer, true);
  assert.equal(olderCopy.changed, false);
  const used = await library.useSource('Clients/Harbour/Harbour.deck.md', copy.body);
  assert.equal(parseSlideBody(used.body).id, data.id);
  assert.equal(parseSlideBody(used.body).title, 'Four parts, again');
  assert.equal((await state(used.body, used.handout)).newer, false);

  // Undo of the library write puts the topic back, while nothing else changed it.
  assert.equal(await library.undoWrite(update), true);
  assert.equal(files.files['Slide library/AI assistants.deck.md'], before);

  // Add to library: a new topic, with the built-in theme's file; and to an existing topic, appended.
  const own = { kind: 'statement', body: 'id: t9\ntitle: Our own\nskip: true', handout: 'Mine, with [brief](Brief.md).' };
  const added = await library.addToLibrary('Clients/Harbour/Harbour.deck.md', 'Working with data', own);
  assert.ok(files.files['Slide library/Themes/Evening.theme.md'].startsWith('---\nname: Evening'));
  const topic = files.files['Slide library/Working with data.deck.md'];
  assert.ok(topic.startsWith('---\ndeck: 1\ntheme: Slide library/Themes/Evening.theme.md\n---\n\n```slide statement\n'));
  const addedSlide = slidesOfText(topic)[0];
  assert.equal(addedSlide.data.skip, undefined, 'the library keeps no skip');
  assert.equal(addedSlide.handout, 'Mine, with [brief](../Clients/Harbour/Brief.md).');
  assert.equal(parseFrom(added.from)?.id, addedSlide.data.id);
  await library.addToLibrary('Clients/Harbour/Harbour.deck.md', 'Slide library/AI assistants.deck.md', own);
  assert.equal(slidesOfText(files.files['Slide library/AI assistants.deck.md']).length, 3);

  // A missing source.
  const missing = await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'x1', from: 'Slide library/Gone.deck.md#a1 @aaaaaa', kind: 'title', body: 'id: x1', handout: '' }]);
  assert.equal(missing[0].missing, true);

  // A from: that names no deck (a deck from someone else can carry any) is no source: nothing reads or writes it.
  files.files['notes.md'] = '```slide title\nid: a1\ntitle: Kept\n```\n';
  assert.deepEqual(await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'x1', from: 'notes.md#a1 @aaaaaa', kind: 'title', body: 'id: x1', handout: '' }]), []);
  await assert.rejects(library.updateLibrarySlide('Clients/Harbour/Harbour.deck.md', { kind: 'title', body: 'id: x1\nfrom: notes.md#a1 @aaaaaa', handout: '' }));
  await assert.rejects(library.updateLibrarySlide('Clients/Harbour/Harbour.deck.md', { kind: 'title', body: 'id: x1\nfrom: Slide library/../notes.deck.md#a1 @aaaaaa', handout: '' }));
  assert.equal(files.files['notes.md'], '```slide title\nid: a1\ntitle: Kept\n```\n');

  console.log('DeckLibrary: passed');
}

void run().catch(error => {
  console.error(error);
  process.exit(1);
});

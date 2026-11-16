/**
 * Sprint 157: the Slide library, with an in-memory project. Run with `npx tsx src/decks/DeckLibrary.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { isTextHandout, parseFrom, slideDataOf } from './deckFormat';
import { slideStamps, slidesOfText } from './deckLibraryFormat';
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

  // A copy: a new id, the from line with the source's stamp, paths rebased, no notes. Since Sprint 161's PR 2 it goes in
  // as a block slide: the picture its old layout didn't draw is a comment at the end of its handout, never lost.
  const [copy] = await library.copies('Slide library/AI assistants.deck.md', ['a1'], 'Clients/Harbour/Harbour.deck.md', ['t1']);
  assert.equal(copy.kind, '', 'a block slide');
  const data = slideDataOf(copy.kind, copy.body);
  assert.notEqual(data.id, 'a1');
  assert.equal(parseFrom(data.from)?.path, 'Slide library/AI assistants.deck.md');
  assert.equal(parseFrom(data.from)?.id, 'a1');
  assert.equal(data.markdown, '# Four parts\n\n:::: boxes\n::: box\n### Instructions\n:::\n::::');
  assert.equal(copy.handout, 'Set up once. See ![x](<../../Slide library/images/s.png>).\n\n<!-- Hidden by the old layout: picture ../../Slide library/images/four.png -->');

  // Its state as copied: unchanged, nothing newer.
  const state = async (body: string, handout: string) => (await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: data.id!, from: slideDataOf(copy.kind, body).from!, kind: copy.kind, body, handout }]))[0];
  assert.deepEqual(await state(copy.body, copy.handout), { id: data.id, library: true, sourceName: 'AI assistants', sourcePath: 'Slide library/AI assistants.deck.md', changed: false, newer: false, missing: false });

  // Changed here: the copy's words or handout.
  const changedBody = copy.body.replace('# Four parts', '# Four parts, again');
  assert.equal((await state(changedBody, copy.handout)).changed, true);
  assert.equal((await state(copy.body, copy.handout + ' More.')).changed, true, 'a handout change counts (answer 2)');

  // Update the library: the source slide by id, every other byte kept; the copy's new from line matches it.
  const before = files.files['Slide library/AI assistants.deck.md'];
  const update = await library.updateLibrarySlide('Clients/Harbour/Harbour.deck.md', { kind: copy.kind, body: changedBody, handout: copy.handout });
  const after = files.files['Slide library/AI assistants.deck.md'];
  // The topic gets the slide as a block slide (and says deck: 2); its other slide stays byte for byte.
  assert.ok(after.startsWith('---\ndeck: 2\n---\n\n```slide\n---\nid: a1\n---\n# Four parts, again\n\n:::: boxes\n'), after);
  assert.ok(after.includes('Set up once. See ![x](images/s.png).'), 'paths back in the library\'s folder');
  assert.equal(after.slice(after.indexOf('```slide statement')), before.slice(before.indexOf('```slide statement')), 'the other slide as it was');
  const updatedBody = changedBody.replace(/^from: .*$/m, `from: ${update.from}`);
  assert.deepEqual(await state(updatedBody, copy.handout), { ...(await state(updatedBody, copy.handout)), changed: false, newer: false });

  // Another deck using the old version sees a newer one, and Use it brings it, keeping its own id.
  const olderCopy = await state(copy.body, copy.handout);
  assert.equal(olderCopy.newer, true);
  assert.equal(olderCopy.changed, false);
  const used = await library.useSource('Clients/Harbour/Harbour.deck.md', copy.body, copy.kind);
  assert.equal(slideDataOf(used.kind, used.body).id, data.id);
  assert.equal(slideDataOf(used.kind, used.body).title, 'Four parts, again');
  assert.equal((await state(used.body, used.handout)).newer, false);

  // Undo of the library write puts the topic back, while nothing else changed it.
  assert.equal(await library.undoWrite(update), true);
  assert.equal(files.files['Slide library/AI assistants.deck.md'], before);

  // Add to library: a new topic, with the built-in theme's file; and to an existing topic, appended.
  const own = { kind: 'statement', body: 'id: t9\ntitle: Our own\nskip: true', handout: 'Mine, with [brief](Brief.md).' };
  const added = await library.addToLibrary('Clients/Harbour/Harbour.deck.md', 'Working with data', own);
  assert.ok(files.files['Slide library/Themes/Evening.theme.md'].startsWith('---\nname: Evening'));
  const topic = files.files['Slide library/Working with data.deck.md'];
  assert.ok(topic.startsWith('---\ndeck: 2\ntheme: Slide library/Themes/Evening.theme.md\n---\n\n```slide\n---\nid: '), topic);
  assert.ok(topic.includes('# Our own'), 'the library gets it as a block slide');
  const addedSlide = slidesOfText(topic)[0];
  assert.equal(addedSlide.data.skip, undefined, 'the library keeps no skip');
  assert.equal(addedSlide.handout, 'Mine, with [brief](../Clients/Harbour/Brief.md).');
  assert.equal(parseFrom(added.from)?.id, addedSlide.data.id);
  await library.addToLibrary('Clients/Harbour/Harbour.deck.md', 'Slide library/AI assistants.deck.md', own);
  assert.equal(slidesOfText(files.files['Slide library/AI assistants.deck.md']).length, 3);
  assert.ok(files.files['Slide library/AI assistants.deck.md'].startsWith('---\ndeck: 2\n'), 'an older topic says deck: 2 with it');

  // A missing source.
  const missing = await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'x1', from: 'Slide library/Gone.deck.md#a1 @aaaaaa', kind: 'title', body: 'id: x1', handout: '' }]);
  assert.equal(missing[0].missing, true);

  // A from: that names no deck (a deck from someone else can carry any) is no source: nothing reads or writes it.
  files.files['notes.md'] = '```slide title\nid: a1\ntitle: Kept\n```\n';
  assert.deepEqual(await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'x1', from: 'notes.md#a1 @aaaaaa', kind: 'title', body: 'id: x1', handout: '' }]), []);
  await assert.rejects(library.updateLibrarySlide('Clients/Harbour/Harbour.deck.md', { kind: 'title', body: 'id: x1\nfrom: notes.md#a1 @aaaaaa', handout: '' }));
  await assert.rejects(library.updateLibrarySlide('Clients/Harbour/Harbour.deck.md', { kind: 'title', body: 'id: x1\nfrom: Slide library/../notes.deck.md#a1 @aaaaaa', handout: '' }));
  assert.equal(files.files['notes.md'], '```slide title\nid: a1\ntitle: Kept\n```\n');

  // The AI's insert_slides: after slide 1 of a closed deck, written to its file; through an open view when there is one.
  const inserted = await library.insertCopies('Slide library/AI assistants.deck.md', ['a2'], 'Clients/Harbour/Harbour.deck.md', 0);
  assert.deepEqual(inserted, { first: 1, count: 1 });
  const harbour = slidesOfText(files.files['Clients/Harbour/Harbour.deck.md']);
  assert.equal(harbour[0].data.title, 'Assistant or agent?');
  assert.equal(parseFrom(harbour[0].data.from)?.id, 'a2');
  // Making a part writes its heading (16 November): the topic's part had none, so the copy opens with its title as an
  // H2, and the copy is still the library's (the heading is no change to it).
  assert.equal(harbour[0].handout, '## Assistant or agent?\n\nAn agent is given a goal.');
  // The deck had no `handout: text` mark: its own part gets its heading, and the mark comes with them (16 November).
  assert.equal(isTextHandout(files.files['Clients/Harbour/Harbour.deck.md']), true, 'the mark is written with the headings');
  assert.equal(harbour[1].handout, '## Harbour\n\nWelcome.', "the deck's own part gets the heading it showed");
  const insertedStates = await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: harbour[0].data.id!, from: harbour[0].data.from!, kind: harbour[0].kind, body: harbour[0].body, handout: harbour[0].handout }]);
  assert.equal(insertedStates[0].changed, false, 'a copy with its heading written is not changed');
  // A copy made before 16 November of a source whose handout opens with a heading: its from: stamp counted the heading,
  // and the copy and the source, both untouched, are still as they were.
  files.files['Slide library/Headed.deck.md'] = '---\ndeck: 1\n---\n\n```slide statement\nid: h1\ntitle: Headed\n```\n\n## Headed\n\nWords.\n';
  const oldStamp = slideStamps('statement', { id: 'h1', title: 'Headed' }, '## Headed\n\nWords.', 'Slide library')[1];
  const legacyStates = await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'c9', from: `Slide library/Headed.deck.md#h1 @${oldStamp}`, kind: 'statement', body: 'id: c9\ntitle: Headed', handout: '## Headed\n\nWords.' }]);
  assert.deepEqual([legacyStates[0].changed, legacyStates[0].newer], [false, false], 'an older from: stamp still matches');
  // Codex on #750: under that older stamp, a heading-only edit of the copy, or of the source, shows nothing either.
  const copyHeadingEdited = await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'c9', from: `Slide library/Headed.deck.md#h1 @${oldStamp}`, kind: 'statement', body: 'id: c9\ntitle: Headed', handout: '## Headed, for Harbour\n\nWords.' }]);
  assert.deepEqual([copyHeadingEdited[0].changed, copyHeadingEdited[0].newer], [false, false], "the copy's heading edited");
  files.files['Slide library/Headed.deck.md'] = files.files['Slide library/Headed.deck.md'].replace('## Headed', '## Headed, renamed');
  const sourceHeadingEdited = await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'c9', from: `Slide library/Headed.deck.md#h1 @${oldStamp}`, kind: 'statement', body: 'id: c9\ntitle: Headed', handout: '## Headed\n\nWords.' }]);
  assert.deepEqual([sourceHeadingEdited[0].changed, sourceHeadingEdited[0].newer], [false, false], "the source's heading edited");
  // A real change still shows.
  const wordsEdited = await library.sourceStates('Clients/Harbour/Harbour.deck.md', [{ id: 'c9', from: `Slide library/Headed.deck.md#h1 @${oldStamp}`, kind: 'statement', body: 'id: c9\ntitle: Headed', handout: '## Headed\n\nOther words.' }]);
  assert.equal(wordsEdited[0].changed, true);
  let viewed: { count: number; afterIndex: number } | null = null;
  const beforeView = files.files['Clients/Harbour/Harbour.deck.md'];
  const viaView = await library.insertCopies('Slide library/AI assistants.deck.md', ['a1', 'a2'], 'Clients/Harbour/Harbour.deck.md', 99, async (parts, afterIndex) => {
    viewed = { count: parts.length, afterIndex };
    return true;
  });
  assert.equal(files.files['Clients/Harbour/Harbour.deck.md'], beforeView, 'an open deck is changed through its view');
  assert.deepEqual(viewed, { count: 2, afterIndex: harbour.length - 1 });
  assert.equal(viaView.first, harbour.length + 1);
  await assert.rejects(library.insertCopies('Slide library/AI assistants.deck.md', ['a1'], 'notes.md', 0));

  // Sprint 159 (PR 2): a deck or a topic in a later `deck:` format (a newer Ritemark wrote it) is never rewritten in
  // this build's format: inserting into it, updating it, adding to it and a from: line's write are refused, the file
  // left byte for byte.
  {
    const LATER = '---\ndeck: 3\n---\n\n```slide title\nid: n1\ntitle: Newer\n```\n';
    const newer = project({ 'Slide library/AI assistants.deck.md': TOPIC, 'Slide library/Newer.deck.md': LATER.replace('id: n1', 'id: a1'), 'Clients/Newer.deck.md': LATER, 'Clients/Harbour/Harbour.deck.md': DECK });
    const later = new DeckLibrary(newer);
    const refused = /newer deck format/;
    await assert.rejects(later.insertCopies('Slide library/AI assistants.deck.md', ['a1'], 'Clients/Newer.deck.md', 1), refused);
    const [copyOfNewer] = await later.copies('Slide library/Newer.deck.md', ['a1'], 'Clients/Harbour/Harbour.deck.md', ['t1']);
    await assert.rejects(later.updateLibrarySlide('Clients/Harbour/Harbour.deck.md', copyOfNewer), refused);
    await assert.rejects(later.addToLibrary('Clients/Harbour/Harbour.deck.md', 'Newer', copyOfNewer), refused);
    await assert.rejects(later.setFrom('Clients/Newer.deck.md', 'n1', 'Slide library/AI assistants.deck.md#a1 @x'), refused);
    assert.equal(newer.files['Clients/Newer.deck.md'], LATER);
    assert.equal(newer.files['Slide library/Newer.deck.md'], LATER.replace('id: n1', 'id: a1'));
  }

  console.log('DeckLibrary: passed');
}

void run().catch(error => {
  console.error(error);
  process.exit(1);
});

/**
 * Sprint 165 PR 0 (#830): a throwaway research script, never shipped (it lives under docs/, outside the bundle).
 * It writes synthetic projects of decks with the real deck format (the same writer, copy and parser the app uses),
 * then measures candidate "same slide" and "most decks" rules against the truth the generator knows.
 * Synthetic decks only: it reads and writes no file on disk. Run from the repo root (any checkout's tsx):
 *   extensions/ritemark/node_modules/.bin/tsx docs/development/releases/v2.3.0/sprint-165-slide-library/research/library-rules.ts
 */
import { newId, parseDeck, slideDataOf, writeFrom, parseFrom, writeScalar, type SlideData } from '../../../../../../extensions/ritemark/src/decks/deckFormat';
import { partText, newTopicText, slideStamp, folderOf } from '../../../../../../extensions/ritemark/src/decks/deckLibraryFormat';
// newDeck.ts's copiedDeckText returns the text as written when both decks are in one folder (as every family here
// is); importing it pulls the slide renderer and `marked`, so the script uses that same-folder result directly.
const copiedDeckText = (text: string, fromFolder: string, toFolder: string) => { if (fromFolder !== toFolder) throw new Error('cross-folder copy not modelled'); return text; };

// ---------- seeded random ----------
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
const WORDS = 'goal team client plan risk value data step review market user test price story change lead build learn share trust focus metric habit idea'.split(' ');
const sentence = (n = 5) => Array.from({ length: n }, () => pick(WORDS)).join(' ');

// ---------- the deck format, through the app's own writer and parser ----------
interface Slide { id: string; from?: string; title: string; items: string[] }
const THEME = 'Slide library/Themes/Plain.theme.md';
const LIBRARY = 'Slide library/Every training.deck.md';
function body(slide: Slide): string {
  const lines = [`id: ${slide.id}`];
  if (slide.from) lines.push(`from: ${writeScalar(slide.from)}`);
  lines.push(`title: ${writeScalar(slide.title)}`, 'items:', ...slide.items.map(text => `- text: ${writeScalar(text)}`));
  return lines.join('\n');
}
function deckText(slides: Slide[]): string {
  const [first, ...rest] = slides.map(slide => partText('points', body(slide), ''));
  return rest.reduce((text, part) => `${text.replace(/\s+$/, '')}\n\n${part}\n`, newTopicText(THEME, first));
}
function slidesOf(text: string): Array<Slide & { data: SlideData }> {
  return parseDeck(text).slides.map(block => {
    const data = slideDataOf(block.kind, block.body);
    return { id: data.id!, from: data.from, title: data.title ?? '', items: (data.items ?? []).map(item => item.text ?? ''), data };
  });
}

// ---------- the synthetic project ----------
// 'balanced': families of 7, 4, 3 and 2 decks and three decks alone. 'dominant': one course copied 12 times, one of 3, three alone.
const SHAPE = process.argv[2] === 'dominant' ? 'dominant' : 'balanced';
interface Deck { path: string; text: string; family: string }
interface World { decks: Deck[]; library: string; truth: Map<string, string>; recurring: Set<string> }
const key = (path: string, id: string) => `${path}#${id}`;

function buildWorld(s: number): World {
  seed = s * 7919 + 13;
  const truth = new Map<string, string>(); // path#id -> the concept the slide really is
  const recurringDefs: Record<string, { title: string; items: string[] }> = {
    break: { title: 'Coffee break', items: ['Back in 15 minutes'] },
    contact: { title: 'Get in touch', items: ['name@example.com', 'Slides and notes follow by email'] },
    questions: { title: 'Questions?', items: ['Ask anything about today'] },
    reflect: { title: 'Exercise: reflect in pairs', items: ['What will you try on Monday?', 'Share one sentence with your partner'] },
  };
  const thanks = { title: 'Thank you', items: ['See you next time'] }; // typed by hand in every deck that has it, never copied
  const recurring = new Set([...Object.keys(recurringDefs), 'thanks']);
  const libSlides: Slide[] = Object.entries(recurringDefs).map(([concept, def], index) => {
    const id = `l${index}aa`;
    truth.set(key(LIBRARY, id), concept);
    return { id, ...def, items: [...def.items] };
  });
  const library = deckText(libSlides);
  const librarySlides = slidesOf(library);
  const decks: Deck[] = [];
  let conceptCounter = 0;
  const fresh = (prefix: string) => `${prefix}-${conceptCounter++}`;
  const taken = (slides: Slide[]) => slides.map(slide => slide.id);

  const insertRecurring = (path: string, slides: Slide[], concept: string) => {
    const lib = librarySlides.find(slide => truth.get(key(LIBRARY, slide.id)) === concept)!;
    const id = newId(taken(slides), rnd);
    if (rnd() < 0.15) {
      // re-typed by hand: a new id, no from, the same words (half the time one word added, half the time lower case)
      const items = [...lib.items];
      if (rnd() < 0.5) items[0] = `${items[0]} ${pick(WORDS)}`;
      slides.push({ id, title: rnd() < 0.5 ? lib.title.toLowerCase() : lib.title, items });
    } else {
      // the library's insert: a new id and `from: <topic>#<id> @<stamp>`, as DeckLibrary.copies writes it
      const stamp = slideStamp('points', lib.data, '', folderOf(LIBRARY));
      slides.push({ id, from: writeFrom({ path: LIBRARY, id: lib.id, stamp }), title: lib.title, items: [...lib.items] });
    }
    truth.set(key(path, id), concept);
  };
  const addOneOff = (path: string, slides: Slide[], prefix: string, title?: string) => {
    const id = newId(taken(slides), rnd);
    slides.push({ id, title: title ?? `${pick(WORDS)} ${pick(WORDS)}`, items: [sentence(), sentence()] });
    truth.set(key(path, id), fresh(prefix));
  };
  const addRecurringSet = (path: string, slides: Slide[]) => {
    for (const concept of Object.keys(recurringDefs)) if (rnd() < 0.75) insertRecurring(path, slides, concept);
    if (rnd() < 0.7) {
      const id = newId(taken(slides), rnd);
      slides.push({ id, title: thanks.title, items: [...thanks.items] });
      truth.set(key(path, id), 'thanks');
    }
  };

  // families of decks copied from each other: 7, 4, 3 and 2 decks, and three decks on their own
  const families: Array<[string, number, string]> = SHAPE === 'dominant'
    ? [['Leadership', 12, 'Clients/Northwind'], ['Sales', 3, 'Clients/Contoso'], ['Solo1', 1, 'Talks'], ['Solo2', 1, 'Talks'], ['Solo3', 1, 'Talks']]
    : [['Leadership', 7, 'Clients/Northwind'], ['Sales', 4, 'Clients/Contoso'], ['Product', 3, 'Trainings'], ['Coaching', 2, 'Trainings'], ['Solo1', 1, 'Talks'], ['Solo2', 1, 'Talks'], ['Solo3', 1, 'Talks']];
  for (const [family, size, folder] of families) {
    const members: Deck[] = [];
    for (let m = 0; m < size; m++) {
      const path = `${folder}/${family} ${m + 1}.deck.md`;
      let slides: Slide[];
      if (m === 0) {
        slides = [];
        addOneOff(path, slides, `${family}-title`, `${family} training`);
        addOneOff(path, slides, `${family}-agenda`, 'Agenda'); // every course has its own "Agenda": a title-only trap
        for (let i = 0; i < 9; i++) addOneOff(path, slides, `${family}-core`);
        addRecurringSet(path, slides);
      } else {
        // New → Deck, "copy an earlier deck": the app's own copy (ids and from: lines kept as written)
        const source = pick(members);
        const copied = copiedDeckText(source.text, folderOf(source.path), folderOf(path));
        slides = slidesOf(copied).map(({ id, from, title, items }) => {
          truth.set(key(path, id), truth.get(key(source.path, id))!);
          return { id, from, title, items };
        });
        // edits: drop slides, small word edits, sometimes one slide rewritten into another, new one-offs, a slide from another family
        for (let d = Math.floor(rnd() * 3); d > 0 && slides.length > 4; d--) slides.splice(2 + Math.floor(rnd() * (slides.length - 2)), 1);
        for (let e = 1 + Math.floor(rnd() * 2); e > 0; e--) { const slide = pick(slides); slide.items = [...slide.items]; slide.items[0] = `${slide.items[0]} ${pick(WORDS)}`; }
        slides[0] = { ...slides[0], items: [`For ${pick(['Acme', 'Globex', 'Initech', 'Umbrella'])}`] };
        if (rnd() < 0.5) {
          const victim = slides[2 + Math.floor(rnd() * (slides.length - 2))];
          victim.title = `${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)}`;
          victim.items = [sentence(), sentence(), sentence()];
          truth.set(key(path, victim.id), fresh(`${family}-repurposed`)); // the same id, now a different slide
        }
        for (let a = 1 + Math.floor(rnd() * 3); a > 0; a--) addOneOff(path, slides, `${family}-oneoff`);
        const others = decks.filter(deck => deck.family !== family);
        if (rnd() < 0.3 && others.length) {
          const other = pick(others);
          const src = pick(slidesOf(other.text).slice(2));
          const id = newId(taken(slides), rnd);
          slides.push({ id, from: writeFrom({ path: other.path, id: src.id, stamp: slideStamp('points', src.data, '', folderOf(other.path)) }), title: src.title, items: [...src.items] });
          truth.set(key(path, id), truth.get(key(other.path, src.id))!);
        }
      }
      const deck = { path, text: deckText(slides), family };
      members.push(deck);
      decks.push(deck);
    }
  }
  return { decks, library, truth, recurring };
}

// ---------- union-find ----------
class UF {
  p = new Map<string, string>();
  find(x: string): string { if (!this.p.has(x)) this.p.set(x, x); const r = this.p.get(x)!; if (r === x) return x; const root = this.find(r); this.p.set(x, root); return root; }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

interface Instance { node: string; path: string; id: string; from?: string; text: string; title: string; words: Set<string> }
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}@.\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const jaccard = <T>(a: Set<T>, b: Set<T>) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 1; };

function instancesOf(world: World): { all: Instance[]; decks: Instance[] } {
  const all: Instance[] = [];
  for (const [path, text] of [[LIBRARY, world.library], ...world.decks.map(d => [d.path, d.text])]) {
    for (const slide of slidesOf(text)) {
      const t = norm([slide.title, ...slide.items].join(' '));
      all.push({ node: key(path, slide.id), path, id: slide.id, from: slide.from, text: t, title: norm(slide.title), words: new Set(t.split(' ')) });
    }
  }
  return { all, decks: all.filter(i => i.path !== LIBRARY) };
}

type Label = (node: string) => string;
type Rule = (all: Instance[]) => Label;
function lineage(all: Instance[], o: { id?: boolean; from?: boolean; guard?: number; text?: boolean; title?: boolean }): Label {
  const uf = new UF();
  const nodes = new Map(all.map(i => [i.node, i]));
  const guard = o.guard ?? 0;
  const ok = (a: Instance, b: Instance | undefined) => !b || jaccard(a.words, b.words) >= guard;
  if (o.id) {
    const groups = new Map<string, Instance[]>();
    for (const i of all) groups.set(i.id, [...(groups.get(i.id) ?? []), i]);
    for (const g of groups.values()) for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) if (ok(g[x], g[y])) uf.union(g[x].node, g[y].node);
  }
  if (o.from) for (const i of all) { const src = parseFrom(i.from); if (src) { const n = key(src.path, src.id); if (ok(i, nodes.get(n))) uf.union(i.node, n); } }
  if (o.text || o.title) {
    const seen = new Map<string, string>();
    for (const i of all) { const k = o.title ? i.title : i.text; if (seen.has(k)) uf.union(i.node, seen.get(k)!); else seen.set(k, i.node); }
  }
  return (node: string) => uf.find(node);
}
const RULES: Array<[string, Rule]> = [
  ['A. same id', all => lineage(all, { id: true })],
  ['B. from chain only', all => lineage(all, { from: true })],
  ['C. same id or from chain', all => lineage(all, { id: true, from: true })],
  ['D. same normalized title and body', all => lineage(all, { text: true })],
  ['E. same title only (strawman)', all => lineage(all, { title: true })],
  ['F. C or D', all => lineage(all, { id: true, from: true, text: true })],
  ['G. C with a words guard (Jaccard >= 0.3), or D', all => lineage(all, { id: true, from: true, guard: 0.3, text: true })],
];
const G = RULES[6][1];

type Score = { tp: number; fp: number; fn: number };
function pairScore(world: World, decks: Instance[], label: Label): Score {
  let tp = 0, fp = 0, fn = 0;
  for (let x = 0; x < decks.length; x++) for (let y = x + 1; y < decks.length; y++) {
    const same = world.truth.get(decks[x].node) === world.truth.get(decks[y].node);
    const merged = label(decks[x].node) === label(decks[y].node);
    if (same && merged) tp++; else if (merged) fp++; else if (same) fn++;
  }
  return { tp, fp, fn };
}

// ---------- "most decks" ----------
type Offer = (decks: Instance[], label: Label) => string[];
function deckSets(decks: Instance[], label: Label) {
  const sets = new Map<string, Set<string>>();
  for (const i of decks) { if (!sets.has(i.path)) sets.set(i.path, new Set()); sets.get(i.path)!.add(label(i.node)); }
  return sets;
}
function familiesOf(sets: Map<string, Set<string>>, t: number) {
  const uf = new UF(); const paths = [...sets.keys()];
  for (let x = 0; x < paths.length; x++) for (let y = x + 1; y < paths.length; y++) if (jaccard(sets.get(paths[x])!, sets.get(paths[y])!) >= t) uf.union(paths[x], paths[y]);
  return new Map(paths.map(p => [p, uf.find(p)]));
}
const top6 = (counts: Map<string, number>, min: number) => [...counts].filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l);
const naive = (share: number): Offer => (decks, label) => {
  const sets = deckSets(decks, label); const counts = new Map<string, number>();
  for (const s of sets.values()) for (const l of s) counts.set(l, (counts.get(l) ?? 0) + 1);
  return top6(counts, Math.max(2, Math.ceil(share * sets.size)));
};
const byFamilies = (t: number, share: number, minFamilies: number): Offer => (decks, label) => {
  const sets = deckSets(decks, label); const fam = familiesOf(sets, t); const nFam = new Set(fam.values()).size;
  const where = new Map<string, Set<string>>();
  for (const [path, s] of sets) for (const l of s) { if (!where.has(l)) where.set(l, new Set()); where.get(l)!.add(fam.get(path)!); }
  return top6(new Map([...where].map(([l, f]) => [l, f.size])), Math.max(minFamilies, Math.ceil(share * nFam)));
};
const OFFERS: Array<[string, Offer]> = [
  ['N1. in half the decks or more', naive(0.5)],
  ['N2. in a third of the decks or more', naive(1 / 3)],
  ['F1. families at Jaccard >= 0.5, in half the families', byFamilies(0.5, 0.5, 2)],
  ['F2. families at Jaccard >= 0.3, in half the families', byFamilies(0.3, 0.5, 2)],
  ['F3. families at Jaccard >= 0.5, in 3 families or more', byFamilies(0.5, 0, 3)],
  ['F4. families at Jaccard >= 0.5, in a third of the families and at least 3', byFamilies(0.5, 1 / 3, 3)],
];
function offerScore(world: World, decks: Instance[], label: Label, offered: string[]): Score {
  // An offered group is right when most of its slides are one recurring slide; each recurring slide counts once.
  const conceptOf = (l: string) => {
    const c = new Map<string, number>();
    for (const i of decks) if (label(i.node) === l) { const t = world.truth.get(i.node)!; c.set(t, (c.get(t) ?? 0) + 1); }
    return [...c].sort((a, b) => b[1] - a[1])[0][0];
  };
  const hit = new Set<string>(); let fp = 0;
  for (const l of offered) { const c = conceptOf(l); if (world.recurring.has(c) && !hit.has(c)) hit.add(c); else fp++; }
  return { tp: hit.size, fp, fn: world.recurring.size - hit.size };
}

// ---------- run ----------
const SEEDS = 30;
const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const add = (m: Map<string, Score>, k: string, s: Score) => { const o = m.get(k) ?? { tp: 0, fp: 0, fn: 0 }; m.set(k, { tp: o.tp + s.tp, fp: o.fp + s.fp, fn: o.fn + s.fn }); };
const same = new Map<string, Score>();
const most = new Map<string, Score>();
let deckCount = 0, slideCount = 0, idClashes = 0;
for (let s = 1; s <= SEEDS; s++) {
  const world = buildWorld(s);
  const { all, decks } = instancesOf(world);
  deckCount += world.decks.length; slideCount += decks.length;
  // ids shared by slides that are not one lineage (chance clashes of the 4-character ids)
  const byId = new Map<string, Set<string>>();
  for (const i of decks) { if (!byId.has(i.id)) byId.set(i.id, new Set()); byId.get(i.id)!.add(world.truth.get(i.node)!.replace(/-repurposed-\d+$/, '')); }
  for (const set of byId.values()) if (set.size > 1) idClashes++;
  for (const [name, rule] of RULES) add(same, name, pairScore(world, decks, rule(all)));
  const labels: Array<[string, Label]> = [['the truth', n => world.truth.get(n)!], ['rule G', G(all)], ['rule A', RULES[0][1](all)]];
  for (const [lname, lab] of labels) for (const [name, offer] of OFFERS) add(most, `${name} | ${lname}`, offerScore(world, decks, lab, offer(decks, lab)));
}
console.log(`Shape ${SHAPE}: ${SEEDS} synthetic projects, ${deckCount / SEEDS} decks and ${(slideCount / SEEDS).toFixed(0)} slides each on average; ids shared by unrelated slides (incl. repurposed): ${idClashes}.\n`);
console.log('SAME SLIDE (pairs of slides in decks)\n\n| Rule | Precision | Recall | False merges | Missed pairs |\n|---|---|---|---|---|');
for (const [k, v] of same) console.log(`| ${k} | ${fmt(v.tp / (v.tp + v.fp))} | ${fmt(v.tp / (v.tp + v.fn))} | ${v.fp} | ${v.fn} |`);
console.log('\nMOST DECKS (5 truly recurring slides per project; up to 6 offered)\n\n| Rule | Grouped by | Precision | Recall | Wrong offers | Missed |\n|---|---|---|---|---|---|');
for (const [k, v] of most) { const [r, l] = k.split(' | '); console.log(`| ${r} | ${l} | ${fmt(v.tp / (v.tp + v.fp))} | ${fmt(v.tp / (v.tp + v.fn))} | ${v.fp} | ${v.fn} |`); }

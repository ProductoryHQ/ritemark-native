/**
 * Sprint 145 R1 (revised 1 November, #588): both changes stay.
 *
 * When a writer (an AI or another app) saves a copy made from an older version of a document the person is writing
 * in, Ritemark finds the version the copy started from (the base) and merges the two by block: a block only the
 * writer changed takes the writer's text, a block only the person changed keeps theirs, and a block both changed
 * keeps the person's text and is listed for Review changes. Pure: no VS Code, no file system.
 */
import { normalizeLogicalText } from './state';

export type BlockKind = 'markdown' | 'csv';

/** A text cut into blocks; joining every block with its separator gives the text back. */
export interface Blocks {
  blocks: string[];
  /** What follows each block: blank lines, a newline, or '' after the last. */
  separators: string[];
}

/**
 * Markdown: blocks are separated by blank lines, a fenced code block (``` or ~~~) is one block whatever it holds,
 * and front matter at the top is one block. A list or a table has no blank lines inside, so it is one block.
 * CSV: one block per row. Compared as logical text: line endings and a byte order mark are not content.
 */
export function splitBlocks(text: string, kind: BlockKind): Blocks {
  const source = normalizeLogicalText(text);
  const blocks: string[] = [];
  const separators: string[] = [];
  if (source.length === 0) return { blocks, separators };
  if (kind === 'csv') {
    const rows = source.split('\n');
    // A final newline ends the last row; it is not an empty row of its own.
    const ends = rows.length > 1 && rows[rows.length - 1] === '';
    if (ends) rows.pop();
    rows.forEach((row, index) => {
      blocks.push(row);
      separators.push(index < rows.length - 1 || ends ? '\n' : '');
    });
    return { blocks, separators };
  }
  const lines = source.split('\n');
  // Each block is a run of lines; what lies between two blocks (the newline after a block and the blank or
  // whitespace-only lines) is the first block's separator, exactly as written, so the blocks rebuild the text.
  const ranges: Array<[number, number]> = [];
  let index = 0;
  // Front matter: '---' on the first line with YAML right under it, closed by the next '---' or '...'. A '---'
  // followed by a blank line is a thematic break.
  if (lines[0] === '---' && lines.length > 1 && lines[1].trim() !== '') {
    const close = lines.findIndex((line, at) => at > 0 && (line === '---' || line === '...'));
    if (close > 0) {
      ranges.push([0, close]);
      index = close + 1;
    }
  }
  let start = -1;
  let fence: string | null = null;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length && line.trim() === opener[1]) fence = null;
      continue;
    }
    if (opener) {
      if (start < 0) start = index;
      fence = opener[1];
      continue;
    }
    if (line.trim() === '') {
      if (start >= 0) {
        ranges.push([start, index - 1]);
        start = -1;
      }
      continue;
    }
    if (start < 0) start = index;
  }
  if (start >= 0) ranges.push([start, lines.length - 1]);
  if (ranges.length === 0) return { blocks: [''], separators: [source] };
  ranges.forEach(([first, last], at) => {
    blocks.push(lines.slice(first, last + 1).join('\n'));
    const next = at + 1 < ranges.length ? ranges[at + 1][0] : lines.length;
    const between = lines.slice(last + 1, next);
    separators.push(at + 1 < ranges.length
      ? `\n${between.map(line => `${line}\n`).join('')}`
      : between.length ? `\n${between.join('\n')}` : '');
  });
  // Blank lines before the first block: an empty block whose separator is them.
  if (ranges[0][0] > 0) {
    blocks.unshift('');
    separators.unshift(lines.slice(0, ranges[0][0]).map(line => `${line}\n`).join(''));
  }
  return { blocks, separators };
}

/** For each element of `a`, the index of its match in `b` (longest common subsequence), or -1. */
function alignment(a: readonly string[], b: readonly string[]): number[] {
  const match = new Array<number>(a.length).fill(-1);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) { match[start] = start; start += 1; }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA -= 1; endB -= 1; match[endA] = endB; }
  const n = endA - start;
  const m = endB - start;
  if (n === 0 || m === 0) return match;
  if (n * m > 4_000_000) return match; // Too large to align: the middle counts as changed on both sides.
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] = a[start + i] === b[start + j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) { match[start + i] = start + j; i += 1; j += 1; }
    else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i += 1;
    else j += 1;
  }
  return match;
}

/** How alike two block lists are: blocks in common over the longer list (0 to 1). */
function likeness(a: readonly string[], b: readonly string[]): number {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  return alignment(a, b).filter(index => index >= 0).length / longer;
}

/** Words, for comparing: letters and digits only, in lower case. */
function wordsOf(blocks: readonly string[]): string[] {
  return blocks.join(' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * For a tie between an older and a newer candidate: does the writer's copy carry the words the newer one added (more
 * than half of them, in the blocks it doesn't share with the newer one)? Then the writer read the newer save: it
 * rewrote a paragraph the person had just added. A copy that rewrote the person's new words away (S4) carries few
 * of them, and the older base stays.
 */
function readTheNewer(older: readonly string[], newer: readonly string[], theirs: readonly string[]): boolean {
  const unmatched = (blocks: readonly string[], other: readonly string[]) => {
    const match = alignment(blocks, other);
    return blocks.filter((_, index) => match[index] < 0);
  };
  const remaining = new Map<string, number>();
  for (const word of wordsOf(unmatched(older, theirs))) remaining.set(word, (remaining.get(word) ?? 0) + 1);
  const added: string[] = [];
  for (const word of wordsOf(unmatched(newer, theirs))) {
    const count = remaining.get(word) ?? 0;
    if (count > 0) remaining.set(word, count - 1);
    else added.push(word);
  }
  if (added.length === 0) return false;
  const theirWords = new Map<string, number>();
  for (const word of wordsOf(unmatched(theirs, newer))) theirWords.set(word, (theirWords.get(word) ?? 0) + 1);
  let carried = 0;
  for (const word of added) {
    const count = theirWords.get(word) ?? 0;
    if (count > 0) {
      theirWords.set(word, count - 1);
      carried += 1;
    }
  }
  return carried * 2 > added.length;
}

/**
 * Below this likeness to every candidate, a copy has no base and the merge doesn't run (the fallback decides). A
 * third: in a three-paragraph note a writer that rewrote two paragraphs still shares one in place with the save it
 * read; a copy that shares nothing in order with anything remembered is not merged.
 */
export const MIN_BASE_LIKENESS = 1 / 3;

/**
 * The base: the candidate the writer's copy shares the most blocks with, at least `MIN_BASE_LIKENESS`. On a tie,
 * the older, unless the copy carries most of the words the newer one added (`readTheNewer`): a base older than the
 * true one only makes more blocks look changed by the writer or by both, which keeps the person's words (a block
 * both changed waits for Review changes); a newer one would make the person's later words look deleted by the
 * writer. So when Ritemark can't tell whether the writer saw the person's latest words in a block it rewrote, the
 * person's words stay and the writer's version waits. `candidates` are oldest first. Returns the index, or -1.
 */
export function findBase(candidates: readonly string[], theirs: string, kind: BlockKind): number {
  const theirBlocks = splitBlocks(theirs, kind).blocks;
  let best = -1;
  let bestBlocks: string[] = [];
  let bestLikeness = MIN_BASE_LIKENESS;
  candidates.forEach((candidate, index) => {
    const blocks = splitBlocks(candidate, kind).blocks;
    // An upper bound first: a candidate whose block count alone can't reach the best is not aligned at all.
    const longer = Math.max(blocks.length, theirBlocks.length);
    if (longer > 0 && Math.min(blocks.length, theirBlocks.length) / longer < bestLikeness) return;
    const value = likeness(blocks, theirBlocks);
    if (value <= 0 || value < bestLikeness) return;
    if (best >= 0 && value === bestLikeness && !readTheNewer(bestBlocks, blocks, theirBlocks)) return;
    best = index;
    bestBlocks = blocks;
    bestLikeness = value;
  });
  return best;
}

/** Whether two texts have the same blocks (the space between them aside). */
export function sameBlocks(a: string, b: string, kind: BlockKind): boolean {
  const left = splitBlocks(a, kind).blocks.filter(block => block.trim() !== '');
  const right = splitBlocks(b, kind).blocks.filter(block => block.trim() !== '');
  return left.length === right.length && left.every((block, index) => block === right[index]);
}

/** The alignment of two block lists, for `trackRange` (one per change, shared by every place). */
export function alignBlocks(before: readonly string[], after: readonly string[]): number[] {
  return alignment(before, after);
}

/** Where a tracked run is now, and the stretch between the blocks kept on each side of it (`gap`). */
export interface TrackedRange {
  at: number;
  length: number;
  gapAt: number;
  gapLength: number;
}

/**
 * Where a run of blocks went when the text changed (`match` from `alignBlocks(before, after)`): the same blocks if
 * they are all still there in a row. Otherwise, between the blocks kept on each side (the gap): all of it when
 * nothing else there changed and it didn't grow (the person rewrote or joined the run); the run's own share when
 * the counts match one for one; otherwise the run of as many blocks there that is most like the old one, so
 * neither a changed neighbour nor a block added beside it is ever taken in. An empty run (a block the person
 * removed) stays empty, at its place: what was typed there since is in the gap.
 */
export function trackRange(before: readonly string[], after: readonly string[], at: number, length: number, match: readonly number[] = alignment(before, after)): TrackedRange {
  const own = match.slice(at, at + length);
  if (length > 0 && own.every((index, offset) => index >= 0 && index === own[0] + offset)) return { at: own[0], length, gapAt: own[0], gapLength: length };
  let previousOld = -1;
  for (let index = Math.min(at, before.length) - 1; index >= 0; index -= 1) {
    if (match[index] >= 0) { previousOld = index; break; }
  }
  let nextOld = before.length;
  for (let index = at + length; index < before.length; index += 1) {
    if (match[index] >= 0) { nextOld = index; break; }
  }
  const first = previousOld >= 0 ? match[previousOld] + 1 : 0;
  const last = nextOld < before.length ? match[nextOld] : after.length;
  const region = Math.max(0, last - first);
  const left = at - (previousOld + 1);
  const right = nextOld - (at + length);
  const gap = { gapAt: first, gapLength: region };
  if (length === 0) return { at: Math.min(first + left, last), length: 0, ...gap };
  if (left === 0 && right === 0 && region <= length) return { at: first, length: region, ...gap };
  if (region === left + length + right) return { at: first + left, length, ...gap };
  const wanted = new Map<string, number>();
  for (const word of wordsOf(before.slice(at, at + length))) wanted.set(word, (wanted.get(word) ?? 0) + 1);
  const size = Math.min(length, region);
  let best = first;
  let bestScore = -1;
  for (let start = first; start + size <= first + region; start += 1) {
    const remaining = new Map(wanted);
    let score = 0;
    for (const word of wordsOf(after.slice(start, start + size))) {
      const count = remaining.get(word) ?? 0;
      if (count > 0) { remaining.set(word, count - 1); score += 1; }
    }
    if (score > bestScore) { best = start; bestScore = score; }
  }
  return { at: best, length: size, ...gap };
}

/** The text with blocks [at, at + length) replaced by `replacement`'s blocks ('' removes them). */
export function replaceBlocks(text: string, kind: BlockKind, at: number, length: number, replacement: string): string {
  const source = splitBlocks(text, kind);
  const joiner = kind === 'csv' ? '\n' : '\n\n';
  const added = replacement === '' ? [] : splitBlocks(replacement, kind).blocks;
  const last = source.blocks.length - 1;
  const parts = [
    ...source.blocks.slice(0, at).map((block, index) => ({ block, separator: index === last ? joiner : source.separators[index] || joiner })),
    ...added.map(block => ({ block, separator: joiner })),
    ...source.blocks.slice(at + length).map((block, offset) => {
      const index = at + length + offset;
      return { block, separator: index === last ? joiner : source.separators[index] || joiner };
    }),
  ];
  if (parts.length === 0) return '';
  parts[parts.length - 1].separator = source.separators[last] ?? '';
  return parts.map(part => part.block + part.separator).join('');
}

/** A place where both changed: the person's blocks (kept in the merge) and the writer's. */
export interface BlockConflict {
  mine: string;
  theirs: string;
  /** Where the person's blocks are in the merged text's blocks, and how many (0: the person removed them). */
  at: number;
  length: number;
}

export interface MergeResult {
  text: string;
  conflicts: BlockConflict[];
  /** Blocks taken from the writer (changed, added or removed), for the log. */
  takenFromTheirs: number;
}

/**
 * A three-way merge of block lists. Blocks unchanged on both sides are stable. Between two stable blocks, each side's
 * changes are grouped: the base blocks a side removed or rewrote between two blocks it kept, with what it put there
 * (an insertion with nothing removed is a group too). A group only one side has is taken from that side. Groups of
 * both sides that touch the same base block are one place both changed: the person's blocks stay, and it is a
 * conflict (or nothing, when both wrote the same). Insertions both sides made at one place are such a place too
 * (the same insertion is taken once). The text keeps the person's separators (and line endings `eol`).
 */
export function mergeBlocks(base: string, mine: string, theirs: string, kind: BlockKind, eol: '\n' | '\r\n' = '\n'): MergeResult {
  const b = splitBlocks(base, kind);
  const m = splitBlocks(mine, kind);
  const t = splitBlocks(theirs, kind);
  const toMine = alignment(b.blocks, m.blocks);
  const toTheirs = alignment(b.blocks, t.blocks);
  const joiner = kind === 'csv' ? '\n' : '\n\n';
  const out: Array<{ block: string; separator: string }> = [];
  const conflicts: BlockConflict[] = [];
  let takenFromTheirs = 0;
  // A source's last block is followed by the end of its text; anywhere but last in the merge it takes a block break.
  const push = (source: Blocks, index: number) => out.push({
    block: source.blocks[index],
    separator: index === source.blocks.length - 1 ? joiner : (source.separators[index] || joiner),
  });

  interface Group { side: 'mine' | 'theirs'; removed: number[]; inserted: number[]; position: number }
  /** One side's groups in a region of base blocks [b0, b1) and that side's blocks [s0, s1). */
  const groupsOf = (side: 'mine' | 'theirs', match: number[], b0: number, b1: number, s0: number, s1: number): Group[] => {
    const groups: Group[] = [];
    let base = b0;
    let at = s0;
    const close = (nextKeptBase: number, nextKeptSide: number) => {
      const removed: number[] = [];
      for (let index = base; index < nextKeptBase; index += 1) removed.push(index);
      const inserted: number[] = [];
      for (let index = at; index < nextKeptSide; index += 1) inserted.push(index);
      if (removed.length || inserted.length) {
        groups.push({ side, removed, inserted, position: removed.length ? removed[0] : nextKeptBase - 0.5 });
      }
    };
    for (let index = b0; index < b1; index += 1) {
      if (match[index] >= s0 && match[index] < s1) {
        close(index, match[index]);
        base = index + 1;
        at = match[index] + 1;
      }
    }
    close(b1, s1);
    // A group that rewrote as many blocks as it removed rewrote them one for one: split it, so a neighbour the
    // other side changed doesn't make the whole group one place both changed.
    return groups.flatMap(group => (group.removed.length > 1 && group.removed.length === group.inserted.length
      ? group.removed.map((removed, index) => ({ side, removed: [removed], inserted: [group.inserted[index]], position: removed }))
      : [group]));
  };

  const region = (b0: number, b1: number, m0: number, m1: number, t0: number, t1: number) => {
    const groups = [...groupsOf('mine', toMine, b0, b1, m0, m1), ...groupsOf('theirs', toTheirs, b0, b1, t0, t1)];
    // Groups of both sides that remove the same base block are one place both changed.
    const parent = groups.map((_, index) => index);
    const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
    const owner = new Map<number, number>();
    // Insertions both sides made at one place (nothing removed) are one place too: the same insertion is taken
    // once, two different ones keep the person's and list the writer's.
    const insertedAt = new Map<number, number>();
    groups.forEach((group, index) => {
      for (const removed of group.removed) {
        const other = owner.get(removed);
        if (other === undefined) owner.set(removed, index);
        else parent[find(index)] = find(other);
      }
      if (group.removed.length === 0) {
        const other = insertedAt.get(group.position);
        if (other === undefined) insertedAt.set(group.position, index);
        else if (groups[other].side !== group.side) parent[find(index)] = find(other);
      }
    });
    // An insertion between two base blocks one place removed or rewrote is part of that place, so the person's
    // blocks there come out in the person's order.
    groups.forEach((group, index) => {
      if (group.removed.length !== 0) return;
      const before = owner.get(Math.floor(group.position));
      const after = owner.get(Math.ceil(group.position));
      if (before !== undefined && after !== undefined && find(before) === find(after)) parent[find(index)] = find(before);
    });
    const components = new Map<number, Group[]>();
    groups.forEach((group, index) => {
      const root = find(index);
      components.set(root, [...(components.get(root) ?? []), group]);
    });
    const ordered = [...components.values()].sort((left, right) => {
      const l = Math.min(...left.map(group => group.position));
      const r = Math.min(...right.map(group => group.position));
      if (l !== r) return l - r;
      return (left[0].side === 'mine' ? 0 : 1) - (right[0].side === 'mine' ? 0 : 1);
    });
    for (const component of ordered) {
      const hasMine = component.some(group => group.side === 'mine');
      const hasTheirs = component.some(group => group.side === 'theirs');
      // Each side's view of the place: what it put there, and the base blocks there that it kept.
      const span = component.flatMap(group => group.removed);
      const view = (side: 'mine' | 'theirs', match: number[], s0: number, s1: number) => [...new Set([
        ...component.filter(group => group.side === side).flatMap(group => group.inserted),
        ...span.map(index => match[index]).filter(index => index >= s0 && index < s1),
      ])].sort((left, right) => left - right);
      const mineBlocks = view('mine', toMine, m0, m1);
      const theirBlocks = view('theirs', toTheirs, t0, t1);
      const at = out.length;
      if (hasMine) mineBlocks.forEach(index => push(m, index));
      else theirBlocks.forEach(index => push(t, index));
      if (!hasMine) {
        takenFromTheirs += Math.max(theirBlocks.length, component.reduce((sum, group) => sum + group.removed.length, 0));
      } else if (hasTheirs) {
        const mineText = mineBlocks.map(index => m.blocks[index]).join(joiner);
        const theirText = theirBlocks.map(index => t.blocks[index]).join(joiner);
        if (mineText !== theirText) conflicts.push({ mine: mineText, theirs: theirText, at, length: mineBlocks.length });
      }
    }
  };

  let bi = 0;
  let mi = 0;
  let ti = 0;
  for (let index = 0; index < b.blocks.length; index += 1) {
    const inMine = toMine[index];
    const inTheirs = toTheirs[index];
    if (inMine < mi || inTheirs < ti) continue;
    region(bi, index, mi, inMine, ti, inTheirs);
    push(m, inMine);
    bi = index + 1;
    mi = inMine + 1;
    ti = inTheirs + 1;
  }
  region(bi, b.blocks.length, mi, m.blocks.length, ti, t.blocks.length);
  // The text ends as the person's ended (a trailing newline or not).
  if (out.length > 0) out[out.length - 1].separator = m.separators[m.separators.length - 1] ?? t.separators[t.separators.length - 1] ?? '';
  const text = out.map(part => part.block + part.separator).join('');
  return { text: eol === '\n' ? text : text.replace(/\n/g, '\r\n'), conflicts, takenFromTheirs };
}

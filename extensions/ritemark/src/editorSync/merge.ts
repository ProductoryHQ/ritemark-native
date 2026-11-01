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
    rows.forEach((row, index) => {
      blocks.push(row);
      separators.push(index < rows.length - 1 ? '\n' : '');
    });
    return { blocks, separators };
  }
  const lines = source.split('\n');
  let index = 0;
  let current: string[] = [];
  const flush = (separator: string) => {
    blocks.push(current.join('\n'));
    separators.push(separator);
    current = [];
  };
  // Front matter: '---' on the first line, closed by the next '---' or '...'.
  if (lines[0] === '---') {
    const close = lines.findIndex((line, at) => at > 0 && (line === '---' || line === '...'));
    if (close > 0) {
      current = lines.slice(0, close + 1);
      index = close + 1;
    }
  }
  let fence: string | null = null;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      current.push(line);
      if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length && line.trim() === opener[1]) fence = null;
      continue;
    }
    if (opener) fence = opener[1];
    if (line.trim() === '' && !fence) {
      if (current.length === 0) {
        // Blank lines before the first block, or several in a row: part of the previous separator.
        if (separators.length > 0) separators[separators.length - 1] += '\n';
        else { blocks.push(''); separators.push('\n'); }
        continue;
      }
      flush('\n\n');
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) flush('');
  // The last separator is what follows the last block in the text (a trailing newline, or nothing).
  if (separators.length > 0) {
    const rebuilt = blocks.map((block, at) => block + separators[at]).join('');
    if (rebuilt !== source) {
      // Exactness first: the final separator absorbs whatever the split left over at the end.
      const lastStart = rebuilt.length - separators[separators.length - 1].length;
      separators[separators.length - 1] = source.slice(lastStart);
    }
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

/**
 * Below this likeness to every candidate, a copy has no base and the merge doesn't run (the fallback decides). A
 * third: in a three-paragraph note a writer that rewrote two paragraphs still shares one in place with the save it
 * read; a copy that shares nothing in order with anything remembered is not merged.
 */
export const MIN_BASE_LIKENESS = 1 / 3;

/**
 * The base: the candidate the writer's copy shares the most blocks with, at least `MIN_BASE_LIKENESS`. On a tie
 * the oldest wins: a base older than the true one only makes more blocks look changed by the writer or by both,
 * which keeps the person's words (a block both changed waits for Review changes); a newer one would make the
 * person's later words look deleted by the writer. So when Ritemark can't tell whether the writer saw the person's
 * latest words in a block it rewrote, the person's words stay and the writer's version waits.
 * `candidates` are oldest first. Returns the candidate's index, or -1.
 */
export function findBase(candidates: readonly string[], theirs: string, kind: BlockKind): number {
  const theirBlocks = splitBlocks(theirs, kind).blocks;
  let best = -1;
  let bestLikeness = MIN_BASE_LIKENESS;
  candidates.forEach((candidate, index) => {
    const value = likeness(splitBlocks(candidate, kind).blocks, theirBlocks);
    if (value > 0 && (value > bestLikeness || (best < 0 && value >= bestLikeness))) {
      best = index;
      bestLikeness = value;
    }
  });
  return best;
}

/** A place where both changed: the person's blocks (kept in the merge) and the writer's. */
export interface BlockConflict {
  mine: string;
  theirs: string;
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
 * conflict (or nothing, when both wrote the same). Insertions both sides made at one place are both kept, the
 * person's first. The text keeps the person's separators (and line endings `eol`).
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
    groups.forEach((group, index) => {
      for (const removed of group.removed) {
        const other = owner.get(removed);
        if (other === undefined) owner.set(removed, index);
        else parent[find(index)] = find(other);
      }
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
      if (hasMine) mineBlocks.forEach(index => push(m, index));
      else theirBlocks.forEach(index => push(t, index));
      if (!hasMine) {
        takenFromTheirs += Math.max(theirBlocks.length, component.reduce((sum, group) => sum + group.removed.length, 0));
      } else if (hasTheirs) {
        const mineText = mineBlocks.map(index => m.blocks[index]).join(joiner);
        const theirText = theirBlocks.map(index => t.blocks[index]).join(joiner);
        if (mineText !== theirText) conflicts.push({ mine: mineText, theirs: theirText });
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

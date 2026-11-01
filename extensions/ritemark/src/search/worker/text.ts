/**
 * Sprint 148 (R5): words, their folded forms, and the rule for capitals and marks.
 *
 * A word is a run of letters, digits and combining marks in NFC text. It is kept
 * as written, with two keys:
 * - its folded form: capitals folded by the find bars' own `foldCase`, so the list
 *   and a preview's find bar agree on what a capital is;
 * - its base: the folded form with its marks removed ("Käsi" → "kasi").
 *
 * The marks rule (the Experience lead, question 7, 1 November): a letter typed
 * without its mark finds it with one ("kasi" finds "käsi"); a letter typed with a
 * mark finds only itself ("käsi" doesn't find "kasi"). Capitals are folded unless
 * Match capital letters is on. Pure; runs in the worker and in tests.
 */
import { foldCase } from '../../../webview/src/utils/textSearch';

/** A word: letters, digits and the marks that belong to them. */
const WORD = /[\p{L}\p{N}\p{M}]+/gu;
const MARK = /\p{M}/u;
const MARKS = /\p{M}/gu;

export { foldCase };

export function normalizeText(text: string): string {
  return text.normalize('NFC');
}

/** The base of a (folded) word: its marks removed. */
export function baseOf(word: string): string {
  return word.normalize('NFD').replace(MARKS, '');
}

const WORD_CHAR = /^[\p{L}\p{N}\p{M}]$/u;
/** Per UTF-16 code unit outside ASCII: 0 not known yet, 1 a word's, 2 not. */
const wordUnit = new Uint8Array(0x10000);

function isWordUnit(code: number): boolean {
  if (code < 128) return (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57);
  let known = wordUnit[code];
  if (known === 0) {
    known = WORD_CHAR.test(String.fromCharCode(code)) ? 1 : 2;
    wordUnit[code] = known;
  }
  return known === 1;
}

/**
 * The words of NFC text, with where each starts and ends: the runs `WORD` matches. A character loop (ASCII
 * by its code, other letters through a cache) rather than the regular expression, which was a third of the
 * time to read a project.
 */
export function forEachWord(text: string, visit: (word: string, start: number, end: number) => void): void {
  let start = -1;
  const length = text.length;
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);
    let inWord: boolean;
    let width = 1;
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < length) {
      // A letter outside the BMP: judged by its code point, kept whole.
      const point = text.codePointAt(i)!;
      inWord = WORD_CHAR.test(String.fromCodePoint(point));
      width = point > 0xffff ? 2 : 1;
    } else {
      inWord = isWordUnit(code);
    }
    if (inWord) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      visit(text.slice(start, i), start, i);
      start = -1;
    }
    i += width - 1;
  }
  if (start >= 0) visit(text.slice(start), start, length);
}

/** The regular expression `forEachWord` stands for, for its test. */
export function forEachWordByPattern(text: string, visit: (word: string, start: number, end: number) => void): void {
  WORD.lastIndex = 0;
  for (let match = WORD.exec(text); match; match = WORD.exec(text)) {
    visit(match[0], match.index, match.index + match[0].length);
  }
}

export function wordsOf(text: string): string[] {
  const words: string[] = [];
  forEachWord(normalizeText(text), (word) => words.push(word));
  return words;
}

/**
 * A word's letters, each with the marks that follow it: "käsi" → ["k", "ä", "s", "i"],
 * and a decomposed "a" + U+0308 is one letter too.
 */
export function lettersOf(word: string): string[] {
  const letters: string[] = [];
  for (const char of word) {
    if (letters.length > 0 && MARK.test(char)) letters[letters.length - 1] += char;
    else letters.push(char);
  }
  return letters;
}

function hasMark(letter: string): boolean {
  return MARK.test(letter.normalize('NFD'));
}

/** One query word, ready to be compared with the index's words. */
export interface QueryWord {
  /** As typed, NFC. */
  text: string;
  folded: string;
  base: string;
  /** The folded letters, or the typed ones with Match capital letters. */
  letters: string[];
  /** Whether any letter carries a mark: then the base alone doesn't decide. */
  marked: boolean;
}

export function queryWord(text: string, matchCase: boolean): QueryWord {
  const nfc = normalizeText(text);
  const folded = foldCase(nfc);
  const letters = lettersOf(matchCase ? nfc : folded);
  return { text: nfc, folded, base: baseOf(folded), letters, marked: letters.some(hasMark) };
}

/**
 * How a query word meets a word of the index: null when it doesn't; otherwise
 * whether the letters were exact (marks as typed, capitals as typed or folded)
 * and how many characters of the written word the match covers, for the marks
 * in a passage.
 */
export interface LetterMatch {
  exact: boolean;
  length: number;
}

/**
 * `written` is a word as it stands in the text (NFC). A prefix match unless
 * `whole`; capitals folded unless `matchCase`.
 */
export function matchWord(query: QueryWord, written: string, matchCase: boolean, whole: boolean): LetterMatch | null {
  const compared = lettersOf(matchCase ? written : foldCase(written));
  if (compared.length < query.letters.length) return null;
  if (whole && compared.length !== query.letters.length) return null;
  let exact = true;
  let length = 0;
  for (let i = 0; i < query.letters.length; i++) {
    const typed = query.letters[i];
    const found = compared[i];
    if (typed === found) {
      length += found.length;
      continue;
    }
    if (hasMark(typed)) return null; // a typed mark finds only itself
    if (baseOf(typed) !== baseOf(found)) return null;
    exact = false;
    length += found.length;
  }
  // `length` counts the folded letters; folding keeps each character's length.
  return { exact, length };
}

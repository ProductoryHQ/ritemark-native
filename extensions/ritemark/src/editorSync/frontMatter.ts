/**
 * A Markdown document's front matter on open and on save (Sprint 137, R5).
 *
 * Opening splits the YAML front matter from the body with `gray-matter`; the
 * body goes to the editor, the properties to the Properties panel. Saving joins
 * them again. When the person has not changed a property, the front matter is
 * written back exactly as it was — its comments, quoting, key order, date forms,
 * inline lists and the blank lines after the closing `---` — instead of being
 * re-stringified on every body save. When a property changed, `gray-matter`
 * writes it, as before (keeping YAML's form through an edit is outside the
 * sprint).
 *
 * Pure: no `vscode`, so the corpus test drives the same split and join as the
 * editor provider.
 */
import matter from 'gray-matter';
import { splitCardText } from '../taskBoard/cardFile';
import { canonicalJson, ensureTrailingNewline, normalizeLogicalText } from './state';

export interface DocumentProperties {
  [key: string]: unknown;
}

export interface SplitMarkdown {
  content: string;
  properties: DocumentProperties;
  hasProperties: boolean;
}

/** Split front matter (YAML) from a Markdown document's text. */
export function splitFrontMatter(rawContent: string): SplitMarkdown {
  try {
    const parsed = matter(rawContent);
    return {
      content: parsed.content,
      properties: parsed.data as DocumentProperties,
      hasProperties: Object.keys(parsed.data).length > 0,
    };
  } catch {
    // If parsing fails, return content as-is with empty properties
    return {
      content: rawContent,
      properties: {},
      hasProperties: false,
    };
  }
}

/**
 * The properties as the webview holds them: they reach it through
 * `postMessage`'s JSON, so a YAML date (`2026-10-20`, a `Date` to gray-matter)
 * comes back as its ISO string.
 */
function asTheViewHoldsThem(properties: unknown): unknown {
  return JSON.parse(JSON.stringify(properties ?? {}));
}

/**
 * Join properties and the editor's Markdown body into the document's text.
 *
 * `currentText` is the document's text before this save. When it has front
 * matter and `properties` are the ones it holds, its front matter and the
 * newlines after it are kept byte for byte (R5). Otherwise: no properties → the
 * body with one trailing newline; properties → `gray-matter`'s stringify.
 */
export function joinFrontMatter(
  properties: DocumentProperties | undefined,
  content: string,
  currentText?: string,
): string {
  const hasProperties = !!properties && Object.keys(properties).length > 0;
  if (hasProperties && currentText !== undefined) {
    const current = normalizeLogicalText(currentText);
    const split = splitCardText(current);
    if (split) {
      let currentProperties: unknown = null;
      try {
        currentProperties = matter(current).data;
      } catch {
        currentProperties = null;
      }
      if (currentProperties !== null
        && canonicalJson(asTheViewHoldsThem(currentProperties)) === canonicalJson(asTheViewHoldsThem(properties))) {
        const blankLines = /^\n*/.exec(split.body)?.[0] ?? '';
        return split.head + blankLines + ensureTrailingNewline(content);
      }
      // A plain one-word key added or taken out (a deck's `handout: text`, 16 November): only that line changes.
      const head = currentProperties !== null && typeof currentProperties === 'object'
        ? headWithPlainKeyChanges(split.head, currentProperties as Record<string, unknown>, properties as Record<string, unknown>)
        : null;
      if (head !== null) {
        const blankLines = /^\n*/.exec(split.body)?.[0] ?? '';
        return head + blankLines + ensureTrailingNewline(content);
      }
    }
  }

  // If no properties or empty properties, return content only
  if (!hasProperties) {
    return ensureTrailingNewline(content);
  }

  // Use gray-matter to stringify with YAML front-matter
  return matter.stringify(content, properties as Record<string, unknown>);
}

const PLAIN_KEY = /^[A-Za-z_][\w-]{0,63}$/;
const PLAIN_WORD = /^[A-Za-z][\w-]{0,63}$/;

/** A value written as one plain word or number on its key's line (`text`, `2`). */
const plainValue = (value: unknown) => (typeof value === 'string' && PLAIN_WORD.test(value)) || (typeof value === 'number' && Number.isInteger(value) && value >= 0);

/**
 * Sprint 162: a deck's theme path (`Slide library/Themes/Fern Hollow.theme.md`), written on its key's line as it is,
 * or in the quotes the line already has. Letters, digits, spaces and `_ . / ( ) + -` only, so YAML reads it back as the
 * same string with or without quotes.
 */
const THEME_LINE = /^[\p{L}\p{N}][\p{L}\p{N} _./()+-]*\.theme\.md$/u;
const themeLineValue = (value: unknown): value is string => typeof value === 'string' && THEME_LINE.test(value);
const lineValue = (value: unknown) => plainValue(value) || themeLineValue(value);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A front matter's head (`---` … `---`, LF) with only plain keys added, taken out or changed, each a one-word string or a
 * whole number (`handout: text`; Sprint 161's `deck: 1` → `deck: 2` and back), when that is the whole change between
 * `current` and `next`: every other line stays byte for byte, its comments and quoting with it, and so do the blank
 * lines after it. Null for any other change, which `gray-matter` writes.
 */
export function headWithPlainKeyChanges(head: string, current: Record<string, unknown>, next: Record<string, unknown>): string | null {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const key of new Set([...Object.keys(current), ...Object.keys(next)])) {
    const was = Object.prototype.hasOwnProperty.call(current, key);
    const is = Object.prototype.hasOwnProperty.call(next, key);
    if (was && is) {
      if (canonicalJson(asTheViewHoldsThem(current[key])) === canonicalJson(asTheViewHoldsThem(next[key]))) continue;
      if (!PLAIN_KEY.test(key) || !lineValue(current[key]) || !lineValue(next[key])) return null;
      changed.push(key);
      continue;
    }
    const value = is ? next[key] : current[key];
    if (!PLAIN_KEY.test(key) || !lineValue(value)) return null;
    (is ? added : removed).push(key);
  }
  if (added.length === 0 && removed.length === 0 && changed.length === 0) return null;
  const lines = head.split('\n');
  const close = lines.length - (lines[lines.length - 1] === '' ? 2 : 1);
  if (close < 1 || !/^---[ \t]*$/.test(lines[close]) || !/^---[ \t]*$/.test(lines[0])) return null;
  const inner = lines.slice(1, close);
  for (const key of removed) {
    const at = inner.findIndex(line => new RegExp(`^${key}:[ \\t]`).test(line));
    // Only a key on one line of its own is taken out here; anything else is gray-matter's.
    if (at < 0 || (at + 1 < inner.length && /^[ \t-]/.test(inner[at + 1]))) return null;
    inner.splice(at, 1);
  }
  for (const key of changed) {
    const at = inner.findIndex(line => new RegExp(`^${key}:[ \\t]`).test(line));
    if (at < 0 || (at + 1 < inner.length && /^[ \t-]/.test(inner[at + 1]))) return null;
    // The line read back must be the value it held: a quoted or commented line is gray-matter's to write. A theme path
    // (Sprint 162) keeps the quotes its line has, so a pick and its Undo give back the same bytes.
    const quotes = themeLineValue(current[key]) && themeLineValue(next[key]) ? `(["']?)` : '()';
    const held = new RegExp(`^${key}:[ \\t]+${quotes}${escapeRegExp(String(current[key]))}\\1[ \\t]*$`).exec(inner[at]);
    if (!held) return null;
    inner[at] = `${key}: ${held[1]}${String(next[key])}${held[1]}`;
  }
  for (const key of added) inner.push(`${key}: ${String(next[key])}`);
  const written = [lines[0], ...inner, ...lines.slice(close)].join('\n');
  // Read back, the head must hold exactly `next`: anything else is gray-matter's to write.
  try {
    if (canonicalJson(asTheViewHoldsThem(matter(`${written}\n`).data)) !== canonicalJson(asTheViewHoldsThem(next))) return null;
  } catch {
    return null;
  }
  return written;
}

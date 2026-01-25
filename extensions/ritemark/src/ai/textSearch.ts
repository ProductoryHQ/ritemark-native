/**
 * Text Search Utilities
 * Copied from ritemark-app with adaptations for VS Code extension
 *
 * Provides 3-tier progressive fallback search:
 * 1. Exact case-insensitive match
 * 2. Markdown-normalized match (removes escapes)
 * 3. Unicode-normalized match (handles special chars)
 */

export interface Position {
  from: number;
  to: number;
}

/**
 * Normalize markdown text for fuzzy matching
 * Removes escape characters and normalizes whitespace
 * Fixes issues with markdown escapes like \. \* \_
 */
export function normalizeMarkdown(text: string): string {
  return text
    .replace(/\\\./g, '.')      // Remove escaped dots (## 1\. → ## 1.)
    .replace(/\\\*/g, '*')      // Remove escaped asterisks
    .replace(/\\_/g, '_')       // Remove escaped underscores
    .replace(/\\#/g, '#')       // Remove escaped hashes
    .replace(/\\\[/g, '[')      // Remove escaped brackets
    .replace(/\\\]/g, ']')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\s+/g, ' ')       // Normalize multiple spaces to single
    .trim();
}

/**
 * Normalize Unicode characters for consistent matching
 * Handles special characters like õ, ü, ä, ñ, etc.
 */
export function normalizeUnicode(text: string): string {
  // NFD (Canonical Decomposition) normalizes é → e + combining accent
  // Then toLowerCase() for case-insensitive matching
  return text.normalize('NFD').toLowerCase();
}

/**
 * Find text in document and return position
 * Uses progressive fallback strategy:
 * 1. Exact match (case-insensitive)
 * 2. Markdown-normalized match (removes escapes)
 * 3. Unicode-normalized match (handles special chars)
 *
 * @param plainText Full document text (rendered, not markdown source)
 * @param searchText Text to find (case-insensitive)
 * @returns Position { from, to } or null if not found
 */
export function findTextInDocument(
  plainText: string,
  searchText: string
): Position | null {
  // Strategy 1: Try exact case-insensitive match first
  const lowerPlainText = plainText.toLowerCase();
  const lowerSearchText = searchText.toLowerCase();
  let textOffset = lowerPlainText.indexOf(lowerSearchText);

  if (textOffset !== -1) {
    return { from: textOffset, to: textOffset + searchText.length };
  }

  // Strategy 2: Try markdown-normalized search (removes escapes)
  const normalizedDoc = normalizeMarkdown(lowerPlainText);
  const normalizedSearch = normalizeMarkdown(lowerSearchText);
  textOffset = normalizedDoc.indexOf(normalizedSearch);

  if (textOffset !== -1) {
    return { from: textOffset, to: textOffset + searchText.length };
  }

  // Strategy 3: Try Unicode-normalized search (handles õ, ü, ä, etc.)
  const unicodeDoc = normalizeUnicode(normalizeMarkdown(plainText));
  const unicodeSearch = normalizeUnicode(normalizeMarkdown(searchText));
  textOffset = unicodeDoc.indexOf(unicodeSearch);

  if (textOffset !== -1) {
    return { from: textOffset, to: textOffset + searchText.length };
  }

  return null; // Text not found
}

/**
 * Find all occurrences of text in document
 * @param plainText Full document text
 * @param searchText Text to find
 * @param matchCase Whether to match case
 * @returns Array of positions
 */
export function findAllInDocument(
  plainText: string,
  searchText: string,
  matchCase: boolean = false
): Position[] {
  const positions: Position[] = [];
  const searchIn = matchCase ? plainText : plainText.toLowerCase();
  const toFind = matchCase ? searchText : searchText.toLowerCase();

  let startIndex = 0;
  let index: number;

  while ((index = searchIn.indexOf(toFind, startIndex)) !== -1) {
    positions.push({
      from: index,
      to: index + searchText.length
    });
    startIndex = index + 1; // Move past this match
  }

  return positions;
}

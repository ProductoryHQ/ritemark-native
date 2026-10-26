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
    }
  }

  // If no properties or empty properties, return content only
  if (!hasProperties) {
    return ensureTrailingNewline(content);
  }

  // Use gray-matter to stringify with YAML front-matter
  return matter.stringify(content, properties as Record<string, unknown>);
}

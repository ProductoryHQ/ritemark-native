/**
 * RenderedMarkdown — renders markdown to HTML using `marked`.
 *
 * Includes scoped CSS for tables, code blocks, links, headings, and lists
 * that integrate with VS Code's theme variables.
 */

import { useMemo, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { cn } from '../../lib/utils';
import { vscode } from '../../lib/vscode';

// Configure marked for safety + good defaults
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Configure DOMPurify to allow safe HTML from markdown rendering
// while stripping XSS vectors (event handlers, javascript: URIs, etc.)
const purifyConfig: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'a', 'strong', 'em', 'code', 'pre',
    'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'del', 'input', 'span', 'div', 'sup', 'sub',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class',
    'type', 'checked', 'disabled', // for task list checkboxes
    'align', 'colspan', 'rowspan', // for tables
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

interface RenderedMarkdownProps {
  content: string;
  className?: string;
}

export function RenderedMarkdown({ content, className }: RenderedMarkdownProps) {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      const rawHtml = marked.parse(content) as string;
      return DOMPurify.sanitize(rawHtml, purifyConfig);
    } catch {
      return DOMPurify.sanitize(content, purifyConfig);
    }
  }, [content]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Only handle clicks on <code> elements that are NOT inside <pre> (not code blocks)
    if (target.tagName !== 'CODE' || target.closest('pre')) return;

    const text = target.textContent?.trim();
    if (!text) return;

    // Detect file paths: contains / or starts with common path patterns
    // Match patterns like: src/foo.ts, ./bar.js, /absolute/path, file.ts:42
    if (text.includes('/') || /^\w+\.\w+/.test(text)) {
      e.preventDefault();
      // Strip trailing line number (file.ts:42 → file.ts)
      const filePath = text.replace(/:\d+$/, '');
      vscode.postMessage({ type: 'open-source', filePath });
    }
  }, []);

  if (!html) return null;

  return (
    <div
      className={cn('rendered-markdown', className)}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Inline CSS for rendered markdown.
 * Injected once at the root level (AISidebar) via a <style> tag.
 */
export const markdownStyles = `
.rendered-markdown {
  font-size: var(--chat-font-size, 13px);
  line-height: 1.6;
  color: var(--vscode-foreground);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.rendered-markdown > *:first-child { margin-top: 0; }
.rendered-markdown > *:last-child { margin-bottom: 0; }

/* Headings */
.rendered-markdown h1,
.rendered-markdown h2,
.rendered-markdown h3,
.rendered-markdown h4,
.rendered-markdown h5,
.rendered-markdown h6 {
  margin: 12px 0 6px;
  font-weight: 600;
  line-height: 1.3;
}
.rendered-markdown h1 { font-size: 1.3em; }
.rendered-markdown h2 { font-size: 1.15em; }
.rendered-markdown h3 { font-size: 1.05em; }
.rendered-markdown h4 { font-size: 1em; }

/* Paragraphs */
.rendered-markdown p {
  margin: 8px 0;
}
.rendered-markdown p + p {
  margin-top: 10px;
}

/* Links */
.rendered-markdown a {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
}
.rendered-markdown a:hover {
  text-decoration: underline;
}

/* Bold & italic */
.rendered-markdown strong { font-weight: 600; }
.rendered-markdown em { font-style: italic; }

/* Inline code */
.rendered-markdown code {
  background: var(--vscode-textCodeBlock-background);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family);
  font-size: 0.9em;
}

/* Clickable file path codes (inline only, not inside pre) */
.rendered-markdown > *:not(pre) code:hover,
.rendered-markdown > code:hover {
  cursor: pointer;
  text-decoration: underline;
  color: var(--vscode-textLink-foreground);
}

/* Code blocks */
.rendered-markdown pre {
  background: var(--vscode-textCodeBlock-background);
  padding: 10px 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 8px 0;
}
.rendered-markdown pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 0.9em;
  line-height: 1.5;
}

/* Lists */
.rendered-markdown ul,
.rendered-markdown ol {
  margin: 6px 0;
  padding-left: 20px;
}
.rendered-markdown li {
  margin: 2px 0;
}
.rendered-markdown li > p {
  margin: 2px 0;
}

/* Tables */
.rendered-markdown table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 0.9em;
}
.rendered-markdown th,
.rendered-markdown td {
  border: 1px solid var(--vscode-panel-border);
  padding: 4px 8px;
  text-align: left;
}
.rendered-markdown th {
  background: var(--vscode-input-background);
  font-weight: 600;
}
.rendered-markdown tr:nth-child(even) td {
  background: var(--vscode-textCodeBlock-background);
}

/* Blockquotes */
.rendered-markdown blockquote {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--vscode-textBlockQuote-border);
  color: var(--vscode-descriptionForeground);
}

/* Horizontal rules */
.rendered-markdown hr {
  border: none;
  border-top: 1px solid var(--vscode-panel-border);
  margin: 12px 0;
}

/* Images */
.rendered-markdown img {
  max-width: 100%;
  border-radius: 4px;
}
`;

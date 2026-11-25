import type { Token, Tokens } from 'marked';
import { isLineBreakTag } from './lineBreakTag';
import { isEmptyLabel, labelParagraphOf } from './labelBlock';

export const SLIDE_EMPTY_LINE = '<br>';

export function isInvisibleSlideBlock(token: Token): boolean {
  if (token.type === 'space' || token.type === 'def' || token.type === 'ritemarkComment') return true;
  if (token.type === 'html') return /^\s*(?:<!--[\s\S]*?-->\s*)+$/.test(token.raw);
  const label = token.type === 'paragraph' ? labelParagraphOf(token as Tokens.Paragraph) : null;
  return !!label && isEmptyLabel(label.words);
}

/** Only the outer slide edges suppress spacers. Container edges can hold editable lines. */
export function markSlideEmptyLines(tokens: Token[]): void {
  const blocks = tokens.filter(token => token.type !== 'html' && !isInvisibleSlideBlock(token));
  const first = blocks.findIndex(token => token.type !== 'slideEmptyLines');
  let last = blocks.length - 1;
  while (last >= 0 && blocks[last].type === 'slideEmptyLines') last--;
  blocks.forEach((token, index) => {
    if (token.type === 'slideEmptyLines' && (index < first || index > last)) (token as Tokens.Generic).count = 0;
  });
}

export function slideEmptyLineExtension(editor: boolean) {
  return {
    name: 'slideEmptyLines',
    level: 'block' as const,
    // Consume the break lines before Marked can absorb the following Markdown
    // into a raw HTML block. Its block lexer then resumes on the remaining source,
    // including when lexing a list item, quote, fenced div or tab pane.
    tokenizer(src: string): Tokens.Generic | undefined {
      let length = 0;
      let count = 0;
      for (const line of src.matchAll(/[^\n]*(?:\n|$)/g)) {
        if (!isLineBreakTag(line[0]) || /^ {4}|^\t/.test(line[0])) break;
        length += line[0].length;
        count++;
      }
      return count ? { type: 'slideEmptyLines', raw: src.slice(0, length), count } : undefined;
    },
    renderer: (token: Tokens.Generic) =>
      (editor ? '<p data-slide-empty-line></p>\n' : '<p class="blk-empty-line" aria-hidden="true"><br></p>\n').repeat(token.count ?? 0),
  };
}

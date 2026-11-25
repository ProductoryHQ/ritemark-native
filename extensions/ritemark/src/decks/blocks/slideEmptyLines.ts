import type { Token, Tokens } from 'marked';
import { isLineBreakTag } from './lineBreakTag';

export const SLIDE_EMPTY_LINE = '<br>';

/** Only the slide's top-level blocks interpret standalone break tags as empty lines. */
export function markSlideEmptyLines(tokens: Token[]): void {
  const pending: Array<{ token: Tokens.Generic; count: number }> = [];
  let hasBlock = false;
  tokens.forEach((token, index) => {
    if (token.type === 'html') {
      const lines = token.raw.trim().split('\n');
      if (lines.every(isLineBreakTag)) {
        const spacer = { type: 'slideEmptyLines', raw: token.raw, count: 0 };
        tokens[index] = spacer;
        if (hasBlock) pending.push({ token: spacer, count: lines.length });
      }
      return;
    }
    if (token.type === 'space' || token.type === 'ritemarkComment' || token.type === 'def') return;

    for (const { token: spacer, count } of pending) spacer.count = count;
    pending.length = 0;
    hasBlock = true;
  });
}

/** The editor gets ordinary editable paragraphs. The other surfaces give each one a text line's height. */
export function slideEmptyLineExtension(editor: boolean) {
  return {
    name: 'slideEmptyLines',
    renderer: (token: Tokens.Generic) =>
      (editor ? '<p></p>\n' : '<p class="blk-empty-line" aria-hidden="true"></p>\n').repeat(token.count ?? 0),
  };
}

/**
 * Sprint 159 PR 4: the Publish sheet's What goes and What stays rows for a deck's page, in the brief's words:
 *
 *   What goes:  "14 slides and their handout, 6 prompts with Copy, and the pictures they use. Nothing else from the project."
 *   What stays: "On your computer: speaker notes on 9 slides, and 2 skipped slides."
 *
 * A count of one is singular ("1 slide and its handout", "1 prompt"), and a part that is 0 is left out. With no notes
 * and no skipped slides, What stays reads "Nothing: this deck has no speaker notes or skipped slides." The sheet draws
 * What goes' last sentence, "Nothing else from the project.", as its own quiet line (`NOTHING_ELSE`), as it does for
 * any page.
 *
 * Pure: counted from the deck's text, with `publicDeck` deciding what is shown and `lexHandout` reading the prompts
 * the way the page draws them.
 */
import { parseDeck, parseSlideBody } from '../deckFormat';
import type { DeckTheme } from '../deckTheme';
import { lexHandout } from './pageHtml';
import { publicDeck } from './publicDeck';

export interface DeckSheetRows {
  /** What goes, without "Nothing else from the project." (the sheet's own quiet line). */
  goes: string;
  stays: string;
}

export interface DeckCounts {
  /** Slides shown on the page. */
  slides: number;
  /** Prompts with Copy on the page. */
  prompts: number;
  /** Slides, shown or skipped, with speaker notes. */
  notes: number;
  skipped: number;
}

const PRIVATE_LANGS: ReadonlySet<string> = new Set(['notes', 'slide']);

/** How many prompts a handout's Markdown draws: its code blocks, as the page reads them (never a notes block). */
function promptsIn(markdown: string): number {
  if (!markdown) return 0;
  let count = 0;
  for (const token of walk(lexHandout(markdown))) {
    if (token.type !== 'code') continue;
    const lang = String((token as { lang?: string }).lang ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (!PRIVATE_LANGS.has(lang)) count++;
  }
  return count;
}

/** Every token, nested ones too (a prompt in a list item or a quote). */
function* walk(tokens: ReadonlyArray<{ type: string; tokens?: unknown; items?: unknown }>): Generator<{ type: string }> {
  for (const token of tokens) {
    yield token;
    if (Array.isArray(token.tokens)) yield* walk(token.tokens as never);
    if (Array.isArray(token.items)) for (const item of token.items as Array<{ tokens?: unknown }>) if (Array.isArray(item.tokens)) yield* walk(item.tokens as never);
  }
}

/** The deck's counts for the sheet. */
export function deckCounts(text: string, theme: DeckTheme): DeckCounts {
  const parsed = parseDeck(text.replace(/^\uFEFF/, ''));
  const deck = publicDeck(text, { folderName: '', deckName: '', theme });
  return {
    slides: deck.slides.length,
    prompts: [deck.preamble, ...deck.slides.map(slide => slide.handout)].reduce((sum, markdown) => sum + promptsIn(markdown), 0),
    notes: parsed.slides.filter(slide => (slide.notes ?? '').trim() !== '').length,
    skipped: parsed.slides.filter(slide => parseSlideBody(slide.body).skip === true).length,
  };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The two rows' words, from the counts. */
export function deckSheetRows(counts: DeckCounts): DeckSheetRows {
  const goes = [
    counts.slides > 0 ? (counts.slides === 1 ? '1 slide and its handout' : `${counts.slides} slides and their handout`) : null,
    counts.prompts > 0 ? `${count(counts.prompts, 'prompt', 'prompts')} with Copy` : null,
  ].filter((part): part is string => part !== null);
  const pictures = counts.slides === 1 ? 'the pictures it uses' : 'the pictures they use';
  const goesLine = goes.length ? `${goes.join(', ')}, and ${pictures}.` : 'The handout\'s text, and the pictures it uses.';
  const stays = [
    counts.notes > 0 ? `speaker notes on ${count(counts.notes, 'slide', 'slides')}` : null,
    counts.skipped > 0 ? count(counts.skipped, 'skipped slide', 'skipped slides') : null,
  ].filter((part): part is string => part !== null);
  const staysLine = stays.length ? `On your computer: ${stays.join(', and ')}.` : 'Nothing: this deck has no speaker notes or skipped slides.';
  return { goes: goesLine, stays: staysLine };
}

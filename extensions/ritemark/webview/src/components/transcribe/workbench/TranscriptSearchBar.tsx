/**
 * Sprint 123 (#283) — the search bar above the transcript.
 *
 * One line: the field, the count, Previous / Next, and — when the playing line
 * is no longer being followed — Back to playing line. Enter and Shift+Enter
 * move between matches, Escape clears the field (a second Escape leaves it).
 * The count is a polite live region, so a screen reader hears "3 of 12" or
 * "No matches" without the focus moving.
 */
import { forwardRef, type KeyboardEvent } from 'react';
import { Button } from '../../ui/button';
import { Icon } from '../../ui/Icon';
import { Tooltip } from '../../ui/tooltip';
import { WORKBENCH_LAYOUT_CLASSES } from './layout';

export interface TranscriptSearchBarProps {
  query: string;
  countLabel: string;
  hasMatches: boolean;
  showBackToPlaying: boolean;
  onQueryChange: (query: string) => void;
  onStep: (direction: 1 | -1) => void;
  onLeave: () => void;
  onBackToPlaying: () => void;
}

export const TranscriptSearchBar = forwardRef<HTMLInputElement, TranscriptSearchBarProps>(function TranscriptSearchBar(
  { query, countLabel, hasMatches, showBackToPlaying, onQueryChange, onStep, onLeave, onBackToPlaying },
  inputRef,
) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (hasMatches) onStep(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (query) onQueryChange('');
      else onLeave();
    }
  };

  return (
    <div className={WORKBENCH_LAYOUT_CLASSES.transcriptSearch} data-transcript-search>
      <div className="mx-auto flex min-w-0 max-w-3xl items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Icon name="magnifying-glass" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search transcript"
            aria-label="Search transcript"
            spellCheck={false}
            className="h-8 w-full min-w-0 rounded-md border border-hairline-strong bg-surface pl-8 pr-2 font-ui text-[13px] text-ink-strong outline-none placeholder:text-ink-faint focus:border-accent focus:ring-[4px] focus:ring-[var(--r-ring-color)] [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <span role="status" aria-live="polite" className="min-w-[4.5rem] shrink-0 text-right font-ui text-[11px] tabular-nums text-ink-muted">
          {countLabel}
        </span>

        <Tooltip label="Previous match (Shift+Enter)">
          <Button type="button" variant="ghost" size="icon-sm" className="size-8" aria-label="Previous match" disabled={!hasMatches} onClick={() => onStep(-1)}>
            <Icon name="caret-up" size={14} />
          </Button>
        </Tooltip>
        <Tooltip label="Next match (Enter)">
          <Button type="button" variant="ghost" size="icon-sm" className="size-8" aria-label="Next match" disabled={!hasMatches} onClick={() => onStep(1)}>
            <Icon name="caret-down" size={14} />
          </Button>
        </Tooltip>
        {query && (
          <Tooltip label="Clear search (Escape)">
            <Button type="button" variant="ghost" size="icon-sm" className="size-8" aria-label="Clear search" onClick={() => onQueryChange('')}>
              <Icon name="x" size={14} />
            </Button>
          </Tooltip>
        )}

        {showBackToPlaying && (
          <Tooltip label="Scroll back to the line that is playing and keep following it">
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 whitespace-nowrap" onClick={onBackToPlaying}>
              <Icon name="play" size={14} />
              Back to playing line
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
});

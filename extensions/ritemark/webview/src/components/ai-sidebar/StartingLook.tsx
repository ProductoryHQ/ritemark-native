/**
 * StartingLook — Sprint 152 (R5, #624): what the AI view draws until it knows its settled look, and when it can't
 * start. The Experience lead's answer 5 (ritemark-dev `releases/v2.2.0/analysis/2026-11-01-sprint-152-experience-answers.md`).
 *
 * The turning mark itself is the page's own (`src/views/aiStartingMark.ts`): it is drawn before this script runs, at the
 * shell's place, and stays the same element while this look lasts, so it never jumps or starts its second again. This
 * component adds only what comes after 10 s of the view's own check: one line under the mark, by the AI's own name,
 * and a ghost Try again, which takes the line away and starts the 10 s over. If the page's mark is gone (the view
 * failed and the person tried again), it draws the same mark itself, a second after that click.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { AI_STARTING_MARK_ID, AI_STARTING_WORDS } from '../../../../src/views/aiStartingMark';
import { Button } from '../ui/button';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';
import { START_SLOW_AFTER_MS } from './startLook';

interface StartingLookProps {
  /** The chosen AI's name once the view has read it (ChatGPT, Claude, OpenCode); null before. */
  aiName: string | null;
  /** Checks again: the AI's check when the AI is known, the view's start when it isn't. */
  onTryAgain: () => void;
}

export function StartingLook({ aiName, onTryAgain }: StartingLookProps) {
  const [pageMarkGone] = useState(() => !document.getElementById(AI_STARTING_MARK_ID));
  const [checkStartedAt, setCheckStartedAt] = useState(() => Date.now());
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (slow) return;
    const timeout = window.setTimeout(() => setSlow(true), Math.max(0, checkStartedAt + START_SLOW_AFTER_MS - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [slow, checkStartedAt]);

  const line = aiName ? `Still checking whether ${aiName} is ready.` : 'The AI is taking longer than usual to start.';
  const tooltip = aiName ? `Check again whether ${aiName} is ready` : 'Start the AI again';

  return (
    <div className="flex-1 min-h-0" data-ai-start="starting">
      {pageMarkGone && (
        <div
          className="rm-ai-starting"
          role="status"
          aria-label={AI_STARTING_WORDS}
          style={{ '--rm-ai-starting-wait': '1000ms', '--rm-ai-starting-turn': '1000ms' } as CSSProperties}
        />
      )}
      {slow && (
        // 12 under the mark (its centre is the window's, its half-height 8), the button 12 under the line
        <div className="fixed left-1/2 top-[calc(50%+20px)] flex w-[280px] max-w-[calc(100%-32px)] -translate-x-1/2 flex-col items-center gap-3 text-center">
          <p className="text-[13px] leading-[18px] text-[var(--r-ink-muted)]">{line}</p>
          <Tooltip label={tooltip}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSlow(false);
                setCheckStartedAt(Date.now());
                onTryAgain();
              }}
            >
              Try again
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

interface StartFailureProps {
  onTryAgain: () => void;
}

/**
 * The view couldn't start (`agent:bootstrap-error`): a settled look of its own, in the Experience lead's words (her check
 * of #632). One of the column's cards: its edges at the column's 12, radius 12, no shadow, centred on the mark's height.
 */
export function StartFailure({ onTryAgain }: StartFailureProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-3" data-ai-start="failed">
      <div className="w-full rounded-xl border border-[var(--r-hairline)] bg-[var(--r-surface)] p-5 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--r-surface-soft)] text-[var(--r-ink-muted)]">
          <Icon name="warning" size={20} />
        </div>
        <h2 className="text-sm font-semibold text-[var(--r-ink-strong)]">The AI couldn't start</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--r-ink-muted)]">Try again. If it keeps happening, restart Ritemark.</p>
        <div className="mt-4 flex justify-center">
          <Tooltip label="Start the AI again">
            <Button type="button" size="sm" onClick={onTryAgain}>
              <Icon name="arrows-clockwise" size={12} tone="inherit" />
              Try again
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

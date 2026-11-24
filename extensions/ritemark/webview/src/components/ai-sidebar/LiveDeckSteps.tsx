import type { LiveDeckStep } from '../../../../src/conversations/types';
import { Icon } from '../ui/Icon';

export function LiveDeckSteps({ steps }: { steps?: LiveDeckStep[] }) {
  return steps?.map(({ type, message }, index) => {
    const updated = type === 'live_deck_updated';
    return (
      <div key={index} className="flex min-h-6 items-start gap-1.5 px-1 py-1 text-[12px] text-[var(--r-ink-muted)]">
        <Icon name={updated ? 'globe' : 'pause'} size={14} tone="inherit"
          className={`mt-px shrink-0 ${updated ? 'text-[var(--r-live-page-updated-icon)]' : 'text-[var(--r-live-page-paused-icon)]'}`} />
        <span className="min-w-0 break-words">{message}</span>
      </div>
    );
  });
}

import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

// The rail opens its tooltips to the left, into the sidebar. A button inside the conversations
// panel has no such room on either side, so it asks for "top": a tooltip above its button slides
// sideways to stay in view. The webview's edge cuts whatever reaches past it, so a tooltip is
// never wider than the room Radix measures for it and keeps 8px clear of the edge.
export function ConversationTooltip({ label, side = 'left', children }: { label: string; side?: 'left' | 'top'; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={10}
            collisionPadding={8}
            className="z-[100] max-w-[min(240px,var(--radix-tooltip-content-available-width,240px))] rounded-[8px] bg-[var(--r-ink-strong)] px-3 py-2 text-[12px] leading-[1.35] text-[var(--r-surface)] shadow-lg"
          >
            {label}
            <Tooltip.Arrow className="fill-[var(--r-ink-strong)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

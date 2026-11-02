import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { TOOLTIP_SURFACE } from '../ui/tooltip';

// The rail opens its tooltips to the left, into the sidebar. A button inside the conversations
// panel has no such room on either side, so it asks for "top": a tooltip above its button slides
// sideways to stay in view. The webview's edge cuts whatever reaches past it, so a tooltip is
// never wider than the room Radix measures for it and keeps 8px clear of the edge.
// Sprint 146 (#576): the one tooltip look (ui/tooltip.tsx's `TOOLTIP_SURFACE`), with no arrow.
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
            className={cn(TOOLTIP_SURFACE, 'max-w-[min(240px,var(--radix-tooltip-content-available-width,240px))]')}
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

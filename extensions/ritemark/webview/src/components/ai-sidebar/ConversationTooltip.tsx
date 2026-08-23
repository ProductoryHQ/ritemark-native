import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function ConversationTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="left"
            sideOffset={10}
            className="z-[100] max-w-[240px] rounded-[8px] bg-[var(--r-ink-strong)] px-3 py-2 text-[12px] leading-[1.35] text-[var(--r-surface)] shadow-lg"
          >
            {label}
            <Tooltip.Arrow className="fill-[var(--r-ink-strong)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

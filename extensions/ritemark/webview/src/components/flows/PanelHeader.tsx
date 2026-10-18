/**
 * The head of the Flow editor's right column (kit: .props .top): what the
 * column shows, and close. The step settings, the schedule and the run panel
 * all use it, so the column reads the same whichever is open.
 */

import type { ReactNode } from 'react';
import { Button } from '../ui/button';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';

export function PanelHeader({
  lead,
  title,
  children,
  onClose,
}: {
  /** a chip or an icon before the title */
  lead?: ReactNode;
  title: string;
  /** anything after the title, such as a status pill */
  children?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mb-3.5 mt-3 flex h-7 flex-shrink-0 items-center gap-2 px-4 text-[13px] font-semibold leading-7 text-[var(--r-ink-strong)]">
      {lead}
      <span className="min-w-0 truncate">{title}</span>
      {children}
      <span className="flex-1" />
      <Tooltip label="Close">
        <Button type="button" variant="ghost" size="icon-sm" className="size-6 rounded-md text-[var(--r-ink-muted)]" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={12} tone="inherit" />
        </Button>
      </Tooltip>
    </div>
  );
}

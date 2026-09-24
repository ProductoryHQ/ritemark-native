/**
 * Sprint 124 (#284) R4 — the toolbar of the page-based previews (Word, PDF).
 *
 * One vocabulary for both: page N / M with previous and next, zoom − / % / +
 * with fit width and fit page, an optional search field, and the file actions.
 * The file name is not repeated here: the tab and the breadcrumbs show it. Every button is a shadcn Button with a tooltip; labels stay on
 * one line, and the bar wraps on a narrow pane instead of squeezing them.
 */
import { forwardRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { Icon, type PhosphorIconName as IconName } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';
import { pageLabel, zoomLabel, type FitMode } from './viewerLayout';

export function ViewerToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline bg-surface px-3 py-1" data-viewer-toolbar>
      {children}
    </div>
  );
}

export function ToolbarSpacer() {
  return <div className="min-w-0 flex-1" />;
}

export function ToolbarGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-0.5">
      {children}
    </div>
  );
}

export function ToolbarIconButton({
  icon,
  label,
  tooltip,
  onClick,
  disabled,
  pressed,
}: {
  icon: IconName;
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <Tooltip label={tooltip}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={pressed ? 'size-8 bg-surface-muted text-ink-strong' : 'size-8'}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon name={icon} size={16} />
      </Button>
    </Tooltip>
  );
}

export function ToolbarTextButton({
  icon,
  label,
  tooltip,
  onClick,
  disabled,
}: {
  icon?: IconName;
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip label={tooltip}>
      <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 whitespace-nowrap" disabled={disabled} onClick={onClick}>
        {icon && <Icon name={icon} size={14} />}
        {label}
      </Button>
    </Tooltip>
  );
}

export function PageControls({ current, total, onStep }: { current: number; total: number; onStep: (direction: 1 | -1) => void }) {
  return (
    <ToolbarGroup label="Pages">
      <ToolbarIconButton icon="caret-up" label="Previous page" tooltip="Previous page" disabled={current <= 0} onClick={() => onStep(-1)} />
      <span className="min-w-[4rem] text-center font-ui text-[12px] tabular-nums text-ink-muted" aria-live="polite">
        {pageLabel(current, total)}
      </span>
      <ToolbarIconButton icon="caret-down" label="Next page" tooltip="Next page" disabled={current >= total - 1} onClick={() => onStep(1)} />
    </ToolbarGroup>
  );
}

export function ZoomControls({
  zoom,
  fit,
  onStep,
  onFit,
}: {
  zoom: number;
  fit: FitMode;
  onStep: (direction: 1 | -1) => void;
  onFit: (mode: 'width' | 'page') => void;
}) {
  return (
    <ToolbarGroup label="Zoom">
      <ToolbarIconButton icon="minus" label="Zoom out" tooltip="Zoom out" onClick={() => onStep(-1)} />
      <span className="min-w-[3rem] text-center font-ui text-[12px] tabular-nums text-ink-muted">{zoomLabel(zoom)}</span>
      <ToolbarIconButton icon="plus" label="Zoom in" tooltip="Zoom in" onClick={() => onStep(1)} />
      <ToolbarIconButton
        icon="arrows-out-line-horizontal"
        label="Fit width"
        tooltip="Fit the page width to the window"
        pressed={fit === 'width'}
        onClick={() => onFit('width')}
      />
      <ToolbarIconButton icon="corners-out" label="Fit page" tooltip="Show one whole page" pressed={fit === 'page'} onClick={() => onFit('page')} />
    </ToolbarGroup>
  );
}

export interface DocumentSearchFieldProps {
  query: string;
  countLabel: string;
  hasMatches: boolean;
  onQueryChange: (query: string) => void;
  onStep: (direction: 1 | -1) => void;
  onLeave: () => void;
}

/** The search field: Enter / Shift+Enter move between matches, Escape clears (a second Escape leaves). */
export const DocumentSearchField = forwardRef<HTMLInputElement, DocumentSearchFieldProps>(function DocumentSearchField(
  { query, countLabel, hasMatches, onQueryChange, onStep, onLeave },
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
    <div className="flex flex-none items-center gap-0.5" data-document-search>
      <div className="relative w-44">
        <Icon name="magnifying-glass" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search"
          aria-label="Search the document"
          spellCheck={false}
          className="h-8 w-full min-w-0 rounded-md border border-hairline-strong bg-surface pl-8 pr-2 font-ui text-[13px] text-ink-strong outline-none placeholder:text-ink-faint focus:border-accent focus:ring-[4px] focus:ring-[var(--r-ring-color)] [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      <span role="status" aria-live="polite" className={`${countLabel ? 'min-w-[4.5rem] px-1' : ''} shrink-0 text-right font-ui text-[11px] tabular-nums text-ink-muted`}>
        {countLabel}
      </span>
      <ToolbarIconButton icon="caret-up" label="Previous match" tooltip="Previous match (Shift+Enter)" disabled={!hasMatches} onClick={() => onStep(-1)} />
      <ToolbarIconButton icon="caret-down" label="Next match" tooltip="Next match (Enter)" disabled={!hasMatches} onClick={() => onStep(1)} />
      {query && <ToolbarIconButton icon="x" label="Clear search" tooltip="Clear search (Escape)" onClick={() => onQueryChange('')} />}
    </div>
  );
});

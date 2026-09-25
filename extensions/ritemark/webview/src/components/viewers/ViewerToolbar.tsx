/**
 * Sprint 124 (#284) R4 — the toolbar of the page-based previews (Word, PDF).
 *
 * Built from what a reader does. Reading and scrolling is nearly everything, so
 * the bar stays quiet: where you are (Page 3 of 28), how big it is (− Fit width ▾ +),
 * and, on the right, the one thing you leave the preview for (Open in Word ▾, with
 * Save as Markdown as its second action). Search is not a field on the bar: the
 * magnifier and Cmd/Ctrl+F open the same floating find bar as the Markdown editor.
 * The file name is not repeated: the tab and the breadcrumbs show it.
 *
 * Every button is a shadcn Button with a tooltip; labels stay on one line. Under
 * 560 px the labels shorten to icons (with their tooltips) instead of wrapping.
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Icon, type PhosphorIconName as IconName } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { ZOOM_PRESETS, zoomLabel, type FitMode } from './viewerLayout'

const COMPACT_BELOW_PX = 560
const CompactContext = createContext(false)

export function ViewerToolbar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setCompact(el.clientWidth < COMPACT_BELOW_PX)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <CompactContext.Provider value={compact}>
      <div
        ref={ref}
        className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline bg-surface px-3"
        data-viewer-toolbar
        data-compact={compact || undefined}
      >
        {children}
      </div>
    </CompactContext.Provider>
  )
}

export function ToolbarSpacer() {
  return <div className="min-w-0 flex-1" />
}

/** A one-line notice under the toolbar: a deleted file, content the preview cannot show. */
export function Notice({ icon, children, onDismiss }: { icon: 'warning' | 'info' | 'circle-notch'; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 border-b border-hairline bg-surface-soft px-3 py-1.5 font-ui text-[12px] text-ink-strong">
      <Icon name={icon} size={14} className={icon === 'circle-notch' ? 'animate-spin' : undefined} />
      <span className="min-w-0 flex-1">{children}</span>
      {onDismiss && <ToolbarIconButton icon="x" label="Dismiss" tooltip="Hide this notice" onClick={onDismiss} />}
    </div>
  )
}

/** "Page 3 of 28" (or "Slide 3 of 24") — orientation, not a control. */
export function PageIndicator({ current, total, noun = 'Page' }: { current: number; total: number; noun?: string }) {
  const compact = useContext(CompactContext)
  const text = total <= 0 ? '' : compact ? `${current + 1} / ${total}` : `${noun} ${current + 1} of ${total}`
  return (
    <span className="shrink-0 whitespace-nowrap px-1 font-ui text-[12px] tabular-nums text-ink-muted" aria-live="polite">
      {text}
    </span>
  )
}

export function ToolbarIconButton({
  icon,
  label,
  tooltip,
  onClick,
  pressed,
}: {
  icon: IconName;
  label: string;
  tooltip: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <Tooltip label={tooltip}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={pressed ? 'size-8 bg-surface-soft text-ink-strong' : 'size-8 text-ink-body'}
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
      >
        <Icon name={icon} size={16} tone="inherit" />
      </Button>
    </Tooltip>
  )
}

/** A text button that becomes its icon (keeping the tooltip) on a narrow bar. */
export function ToolbarTextButton({
  icon,
  label,
  tooltip,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const compact = useContext(CompactContext)
  return (
    <Tooltip label={tooltip}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 whitespace-nowrap text-ink-strong"
        aria-label={compact ? label : undefined}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon name={icon} size={14} tone="inherit" />
        {!compact && label}
      </Button>
    </Tooltip>
  )
}

export interface ZoomControlsProps {
  zoom: number;
  fit: FitMode;
  onStep: (direction: 1 | -1) => void;
  onFit: (mode: 'width' | 'page') => void;
  onSet: (zoom: number) => void;
  /** The whole-page fit's name: "Fit page", or "Fit slide" for a deck. */
  fitPageLabel?: string;
}

/** − [Fit width ▾] + : the menu holds the two fits and the usual sizes. */
export function ZoomControls({ zoom, fit, onStep, onFit, onSet, fitPageLabel = 'Fit page' }: ZoomControlsProps) {
  const compact = useContext(CompactContext)
  const current = compact ? zoomLabel(zoom) : fit === 'width' ? 'Fit width' : fit === 'page' ? fitPageLabel : zoomLabel(zoom)
  const check = (on: boolean) => <Icon name="check" size={14} tone="inherit" className={on ? undefined : 'invisible'} />
  return (
    <div role="group" aria-label="Zoom" className="flex shrink-0 items-center gap-0.5">
      <Tooltip label="Zoom out">
        <Button type="button" variant="ghost" size="icon-sm" className="size-8 text-ink-body" aria-label="Zoom out" onClick={() => onStep(-1)}>
          <Icon name="minus" size={16} tone="inherit" />
        </Button>
      </Tooltip>
      <DropdownMenu modal={false}>
        <Tooltip label="Fit the page to the window, or choose a size">
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 justify-center gap-1 px-2 font-ui text-[12px] tabular-nums text-ink-strong ${compact ? '' : 'min-w-[5.75rem]'}`}
              aria-label={`Zoom: ${current}`}
            >
              {current}
              <Icon name="caret-down" size={12} tone="inherit" />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" className="min-w-[9rem]">
          <DropdownMenuItem onSelect={() => onFit('width')}>
            {check(fit === 'width')}
            Fit width
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onFit('page')}>
            {check(fit === 'page')}
            {fitPageLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {ZOOM_PRESETS.map((preset) => (
            <DropdownMenuItem key={preset} onSelect={() => onSet(preset)}>
              {check(!fit && Math.abs(zoom - preset) < 0.001)}
              {zoomLabel(preset)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip label="Zoom in">
        <Button type="button" variant="ghost" size="icon-sm" className="size-8 text-ink-body" aria-label="Zoom in" onClick={() => onStep(1)}>
          <Icon name="plus" size={16} tone="inherit" />
        </Button>
      </Tooltip>
    </div>
  )
}

export interface SplitAction {
  icon: IconName;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * The primary action with its second action behind a caret — the pattern of the
 * spreadsheet toolbar's "Open in Excel ▾". Without second actions it is one button.
 */
export function SplitButton({
  icon,
  label,
  tooltip,
  onClick,
  menuLabel,
  actions,
}: {
  icon: IconName;
  label: string;
  tooltip: string;
  onClick: () => void;
  menuLabel: string;
  actions: SplitAction[];
}) {
  const compact = useContext(CompactContext)
  return (
    <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border border-hairline-strong bg-surface">
      <Tooltip label={tooltip}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-full rounded-none whitespace-nowrap px-2.5 text-ink-strong"
          aria-label={compact ? label : undefined}
          onClick={onClick}
        >
          <Icon name={icon} size={14} tone="inherit" />
          {!compact && label}
        </Button>
      </Tooltip>
      {actions.length > 0 && (
        <>
          <div className="w-px bg-hairline-strong" aria-hidden />
          <DropdownMenu modal={false}>
            <Tooltip label={menuLabel}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" className="h-full w-7 rounded-none text-ink-body" aria-label={menuLabel}>
                  <Icon name="caret-down" size={12} tone="inherit" />
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end">
              {actions.map((action) => (
                <DropdownMenuItem key={action.label} disabled={action.disabled} onSelect={action.onSelect}>
                  <Icon name={action.icon} size={14} tone="inherit" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

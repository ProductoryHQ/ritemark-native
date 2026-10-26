/**
 * Sprint 124 (#284) R4 — the toolbar of the page-based previews (Word, PDF).
 *
 * Built from what a reader does. Reading and scrolling is nearly everything, so
 * the bar stays quiet: where you are (Page 3 of 28), how big it is (− Fit width ▾ +),
 * and, on the right, the one thing you leave the preview for (Open in Word ▾, with
 * Make an editable copy as its second action). Search is not a field on the bar: the
 * magnifier and Cmd/Ctrl+F open the same floating find bar as the Markdown editor.
 * The file name is not repeated: the tab and the breadcrumbs show it.
 *
 * Sprint 134 (R19): the PDF and Word bars end in Share, as the document's bar
 * does (`comparison/after-pdf.png`, `after-word.png`); its items are `viewerShare.ts`'s.
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
import { SHARE_LABEL, shareTooltip, type ShareMenuItem } from './viewerShare'

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
        className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline bg-surface px-3" /* a hairline under the bar, over the page canvas (Ritemark 2.0) */
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
  // Sprint 142 (R5d, #557): one button, in one tone (framework §3): the shared outline frame (index.css .rm-split),
  // hover and press on the whole button, the menu open in its rest tone
  const split = actions.length > 0
  return (
    <div className="rm-split h-8 shrink-0" data-tone="outline">
      <Tooltip label={tooltip} className="rm-split-slot">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`rm-split-part ${split ? 'rm-split-main' : ''} h-full whitespace-nowrap px-2.5 text-ink-strong`}
          aria-label={compact ? label : undefined}
          onClick={onClick}
        >
          <Icon name={icon} size={14} tone="inherit" />
          {!compact && label}
        </Button>
      </Tooltip>
      {split && (
        <>
          <DropdownMenu modal={false}>
            <Tooltip label={menuLabel} className="rm-split-slot">
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" className="rm-split-part rm-split-more h-full w-7 text-ink-body" aria-label={menuLabel}>
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

/** A short upright hairline between the bar's last action and Share, as drawn (the kit's docbar .sep). */
export function ToolbarDivider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-hairline" aria-hidden="true" data-toolbar-divider />
}

/**
 * Share at the end of a PDF's or a Word file's bar (Sprint 134, R19): an outlined
 * "Share" that opens its two items, each with what it is for. Share stays a word
 * on a narrow bar: it is short, and the bar's other labels shorten first.
 */
export function ShareMenu({ items, onSelect }: { items: readonly ShareMenuItem[]; onSelect: (item: ShareMenuItem) => void }) {
  return (
    <DropdownMenu modal={false}>
      <Tooltip label={shareTooltip(items)}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            // The document bar's Share (DocumentHeader): outlined, the accent's soft fill while open.
            className="h-7 shrink-0 whitespace-nowrap rounded-md bg-surface px-2.5 font-ui text-[13px] font-medium text-ink-strong shadow-none data-[state=open]:border-transparent data-[state=open]:bg-accent-soft"
            data-viewer-share
          >
            {SHARE_LABEL}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        {items.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => onSelect(item)} className="items-start">
            <Icon name={item.icon} size={14} tone="inherit" className="mt-0.5" />
            <span className="flex min-w-0 flex-col">
              <span className="whitespace-nowrap">{item.label}</span>
              <span className="text-[12px] text-ink-muted">{item.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

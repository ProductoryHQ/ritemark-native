/** Responsive containment shared by the transcript and Insights panes. */
export const WORKBENCH_LAYOUT_CLASSES = {
  root: 'flex h-screen max-h-screen min-h-0 min-w-0 flex-col outline-none',
  chrome:
    'min-h-0 shrink-0 max-h-[50%] overflow-y-auto overscroll-contain md:max-h-none md:overflow-visible',
  panes:
    'grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:flex md:flex-row',
  transcript:
    'min-h-0 min-w-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 md:flex-1',
  insights:
    'flex min-h-0 min-w-0 flex-col border-t border-hairline bg-surface-muted md:w-72 md:flex-none md:border-l md:border-t-0',
  insightsScroller:
    'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 [overflow-wrap:anywhere]',
  regenerate:
    'rounded-sm text-[10.5px] font-semibold text-accent outline-none hover:underline focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)]',
} as const;

/**
 * Sprint 124 (#284) R4 — zoom, fit and page position for the page-based
 * previews (Word, PDF). Pure functions; the viewers measure, these decide.
 */

/** The zoom ladder − and + walk, as in a browser. */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

export type FitMode = 'width' | 'page' | null;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The next step up or down from `current`, which may sit between steps after a fit. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const eps = 0.001;
  if (direction === 1) return ZOOM_STEPS.find((z) => z > current + eps) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((z) => z < current - eps) ?? MIN_ZOOM;
}

/** "88%" */
export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** Zoom that makes a page as wide as the viewport, less a gutter on each side. */
export function fitWidthZoom(pageWidth: number, viewportWidth: number, gutter = 24): number {
  if (pageWidth <= 0 || viewportWidth <= 0) return 1;
  return clampZoom((viewportWidth - gutter * 2) / pageWidth);
}

/** Zoom that shows one whole page. */
export function fitPageZoom(pageWidth: number, pageHeight: number, viewportWidth: number, viewportHeight: number, gutter = 24): number {
  if (pageHeight <= 0 || viewportHeight <= 0) return fitWidthZoom(pageWidth, viewportWidth, gutter);
  return clampZoom(Math.min(fitWidthZoom(pageWidth, viewportWidth, gutter), (viewportHeight - gutter * 2) / pageHeight));
}

/**
 * The page being read: the last one whose top has passed a line a third of the
 * way down the viewport. `pageTops` are relative to the viewport's top.
 */
export function pageAtScroll(pageTops: readonly number[], viewportHeight: number): number {
  const line = viewportHeight / 3;
  let index = 0;
  for (let i = 0; i < pageTops.length; i++) {
    if (pageTops[i] <= line) index = i;
    else break;
  }
  return index;
}

/** "3 / 12" — the same form as the PDF viewer's counter. */
export function pageLabel(current: number, total: number): string {
  return total > 0 ? `${current + 1} / ${total}` : '…';
}

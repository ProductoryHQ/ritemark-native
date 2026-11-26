/** Resolve the slide on each measurement because changing its layout can replace the stage's slide element. */
export function stageSettingsAnchor(stage: { readonly current: HTMLElement | null }) {
  return {
    getBoundingClientRect: () => stage.current?.querySelector('.deck-big')?.getBoundingClientRect() ?? new DOMRect(),
  }
}

/** Native scrollbar presses target the stage itself, beyond its client area. */
export function isStageScrollbarPress(
  stage: HTMLElement | null,
  event: Pick<PointerEvent, 'target' | 'offsetX' | 'offsetY'>,
): boolean {
  return stage !== null && event.target === stage &&
    (event.offsetX >= stage.clientWidth || event.offsetY >= stage.clientHeight)
}

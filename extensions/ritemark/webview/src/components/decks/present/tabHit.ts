/**
 * The tab a click hits: its Tabs block's place among the slide's Tabs blocks and its own place in the band,
 * as the renderer numbers them.
 */
export function tabHit(target: EventTarget | null): { block: number; tab: number } | null {
  const tab = target instanceof Element ? target.closest('.blk-tab') : null
  const block = tab?.closest('.blk-tabs')
  if (!tab || !block) return null
  const index = Number(block.getAttribute('data-tabs-index'))
  const place = Array.from(tab.parentElement?.children ?? []).indexOf(tab)
  return Number.isInteger(index) && index >= 0 && place >= 0 ? { block: index, tab: place } : null
}

/** Only the shown slide can take a wall tab click, and only when there is no presenter view. */
export function wallTabHit(target: EventTarget | null, slide: Element | null, presenterOn: boolean): ReturnType<typeof tabHit> {
  return !presenterOn && target instanceof Element && slide?.contains(target) ? tabHit(target) : null
}

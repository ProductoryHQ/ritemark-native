/**
 * Sprint 163 (the Experience lead on PR 2): a tab is never cut. A Tabs block's band fits its tabs in this order, in the
 * editor, on the wall and on the page alike: first the tabs' side padding goes from 16 to 10 (slide units), then the
 * label steps down, 14.5, 13, 12; only if they still don't fit does the band scroll sideways, with its soft fade at the
 * cut edge (`slide.css`). Each step is a `data-fit` value on the block (1 to 3), drawn by the CSS; this only measures.
 *
 * `PAGE_TABS_FIT` is the same rule as plain JavaScript for the published page's one script.
 */

/** The steps after the band as drawn: tighter padding, then 13, then 12. */
export const TAB_FIT_STEPS = 3;

/** Fit every Tabs block's band under `root` (the block itself included). Measures only blocks that are laid out. */
export function fitTabBands(root: ParentNode & { querySelectorAll: Document['querySelectorAll'] }): void {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.blk-tabs'));
  if ((root as Element).classList?.contains('blk-tabs')) blocks.unshift(root as HTMLElement);
  for (const block of blocks) {
    const band = block.querySelector<HTMLElement>(':scope > .blk-tabbar');
    if (!band || !band.clientWidth) continue;
    let step = 0;
    block.removeAttribute('data-fit');
    while (band.scrollWidth > band.clientWidth + 1 && step < TAB_FIT_STEPS) {
      step += 1;
      block.setAttribute('data-fit', String(step));
    }
  }
}

/** The same rule for the published page's script (`pageScript.ts`): run once the page has drawn, and once its fonts are in. */
export const PAGE_TABS_FIT = String.raw`
  function fitTabBands() {
    var blocks = document.querySelectorAll('.blk-tabs');
    for (var index = 0; index < blocks.length; index++) {
      var block = blocks[index], band = block.querySelector(':scope > .blk-tabbar');
      if (!band || !band.clientWidth) continue;
      var step = 0;
      block.removeAttribute('data-fit');
      while (band.scrollWidth > band.clientWidth + 1 && step < 3) { step += 1; block.setAttribute('data-fit', String(step)); }
    }
  }
  fitTabBands();
  window.addEventListener('load', fitTabBands);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTabBands);
`;

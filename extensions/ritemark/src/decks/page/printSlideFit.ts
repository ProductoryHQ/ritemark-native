import { BLOCK_FIT_STEPS } from '../blocks/slideRenderer';
import { WORD_BOXES } from '../../../webview/src/components/decks/blocks/slideFit';

/**
 * Quick Look's hidden print page has no editor to report fit steps. Start
 * at step zero and use the wall's vertical and sideways overflow checks
 * (slideFit.ts) on the same block markup, in the 960 × 540 print layout.
 */
export const PRINT_SLIDE_FIT = `
(() => {
  const steps = ${JSON.stringify(BLOCK_FIT_STEPS)};
  const wordBoxes = ${JSON.stringify(WORD_BOXES)};
  const px = value => parseFloat(value) || 0;
  function inFlow(style) {
    return style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed';
  }
  function* drawnChildren(element) {
    for (const child of element.children) {
      const style = getComputedStyle(child);
      if (style.display === 'contents') yield* drawnChildren(child);
      else if (inFlow(style)) yield child;
    }
  }
  function overflows(flow) {
    let top = Infinity;
    let bottom = 0;
    for (const child of flow.children) {
      const style = getComputedStyle(child);
      if (!inFlow(style)) continue;
      top = Math.min(top, child.offsetTop - px(style.marginTop));
      bottom = Math.max(bottom, child.offsetTop + child.offsetHeight + px(style.marginBottom));
      if (child.offsetLeft + child.offsetWidth > flow.clientWidth + 1) return true;
    }
    const room = flow.clientHeight;
    if (top !== Infinity && (bottom - top > room + 2 || flow.scrollHeight > room + 2)) return true;
    const scale = flow.getBoundingClientRect().width / (flow.offsetWidth || 1) || 1;
    for (const box of flow.querySelectorAll(wordBoxes)) {
      if (box.scrollWidth > box.clientWidth + 1) return true;
      const style = getComputedStyle(box);
      const inner = box.getBoundingClientRect().right - (px(style.paddingRight) + px(style.borderRightWidth)) * scale;
      for (const child of drawnChildren(box)) {
        if (child.getBoundingClientRect().right > inner + scale) return true;
      }
    }
    return false;
  }
  function fit() {
    for (const flow of document.querySelectorAll('.layer.flow .blk-flow')) {
      for (const step of steps) {
        flow.style.setProperty('--fit', String(step));
        if (!overflows(flow)) break;
      }
    }
  }
  // Electron waits for fonts and images before printing. Measure synchronously
  // at beforeprint as well, after the final font, image and tab layout.
  fit();
  window.addEventListener('beforeprint', fit);
})();
`;

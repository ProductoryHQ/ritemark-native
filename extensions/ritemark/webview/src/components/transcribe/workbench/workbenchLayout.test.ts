import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WORKBENCH_LAYOUT_CLASSES } from './layout';

const railSource = readFileSync(
  fileURLToPath(new URL('./InsightsRail.tsx', import.meta.url)),
  'utf-8',
);

const languageControl = railSource.indexOf('<Select\n');
const regenerate = railSource.indexOf('Regenerate');
assert.ok(languageControl >= 0, 'the language selector is rendered');
assert.ok(regenerate > languageControl, 'the language selector precedes Regenerate in DOM/tab order');
assert.ok(railSource.includes('data-insights-scroller'), 'the Insights pane exposes its bounded scroller');

for (const className of ['h-screen', 'max-h-screen', 'min-h-0']) {
  assert.ok(
    WORKBENCH_LAYOUT_CLASSES.root.includes(className),
    `the workbench root is bounded to the viewport with ${className}`,
  );
}
assert.ok(
  !WORKBENCH_LAYOUT_CLASSES.root.includes('overflow-hidden'),
  'the viewport bound is not implemented by hiding root overflow',
);
for (const className of ['max-h-[50%]', 'overflow-y-auto', 'overscroll-contain', 'md:max-h-none']) {
  assert.ok(
    WORKBENCH_LAYOUT_CLASSES.chrome.includes(className),
    `the narrow workbench chrome yields a bounded pane region with ${className}`,
  );
}

for (const className of [
  'grid',
  'min-w-0',
  'grid-rows-[minmax(0,1fr)_minmax(0,1fr)]',
  'md:flex',
  'md:flex-row',
]) {
  assert.ok(
    WORKBENCH_LAYOUT_CLASSES.panes.includes(className),
    `the pane container keeps narrow responsive class ${className}`,
  );
}
for (const className of ['min-w-0', 'md:w-72', 'md:flex-none']) {
  assert.ok(
    WORKBENCH_LAYOUT_CLASSES.insights.includes(className),
    `the Insights rail keeps narrow responsive class ${className}`,
  );
}
for (const className of ['min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain']) {
  assert.ok(
    WORKBENCH_LAYOUT_CLASSES.insightsScroller.includes(className),
    `the Insights content keeps its bounded pane-scroller class ${className}`,
  );
}
for (const className of [
  'outline-none',
  'focus-visible:ring-[4px]',
  'focus-visible:ring-[var(--r-ring-color)]',
]) {
  assert.ok(
    WORKBENCH_LAYOUT_CLASSES.regenerate.includes(className),
    `Regenerate uses the approved focus-visible contract ${className}`,
  );
}

console.log('workbenchLayout.test.ts: all tests passed');

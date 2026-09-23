/**
 * Sprint 122 (#282) — resizing the chat composer from its top edge.
 *
 * What a person loses if this is wrong: dragging the edge moves the box the
 * wrong way, lets it swallow the Send row, or lets it collapse below two lines.
 *
 * Run with `npx tsx webview/src/components/ai-sidebar/composerResize.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { clampHeight, dragCeiling, dragHeight, keyboardHeight } from './composerResize';

const bounds = { min: 62, max: 400 };

{
  // --- dragging the top edge: up is taller, down is shorter
  assert.equal(dragHeight(100, 500, 400, bounds), 200, 'pointer 100 px up → 100 px taller');
  assert.equal(dragHeight(200, 400, 450, bounds), 150, 'pointer 50 px down → 50 px shorter');
  assert.equal(dragHeight(100, 500, 0, bounds), 400, 'never taller than the room');
  assert.equal(dragHeight(100, 500, 900, bounds), 62, 'never shorter than two lines');
  assert.equal(dragHeight(100, 500, 499.4, bounds), 101, 'whole pixels');
}

{
  // --- the keyboard, on the focused handle
  const line = 21;
  assert.equal(keyboardHeight('ArrowUp', 100, bounds, line), 121);
  assert.equal(keyboardHeight('ArrowDown', 100, bounds, line), 79);
  assert.equal(keyboardHeight('PageUp', 100, bounds, line), 163);
  assert.equal(keyboardHeight('PageDown', 100, bounds, line), 62, 'clamped to the floor');
  assert.equal(keyboardHeight('Home', 300, bounds, line), 62);
  assert.equal(keyboardHeight('End', 100, bounds, line), 400);
  assert.equal(keyboardHeight('Enter', 100, bounds, line), null, 'other keys are left alone');
  assert.equal(keyboardHeight('a', 100, bounds, line), null);
}

{
  // --- how tall it may be dragged
  assert.equal(dragCeiling(548, 62, 72), 476, 'the room, less a strip of conversation');
  assert.equal(dragCeiling(82, 62, 72), 62, 'at 200 % zoom the floor still holds');
  assert.equal(dragCeiling(null, 62, 72), 62, 'before the room is measured, only the floor');
  assert.equal(clampHeight(500, { min: 62, max: 40 }), 62, 'a ceiling below the floor yields the floor');
}

console.log('composerResize.test.ts: all tests passed');

/**
 * Sprint 122 (#282) — the chat composer's top edge, as a resize handle.
 *
 * Drag it up to make the message box taller, down to make it shorter; with
 * focus, ↑/↓ change it a line at a time (Page Up/Down three lines, Home/End
 * the extremes). Double-click returns the box to fitting its text. It is an
 * ARIA window splitter (`role="separator"` with a value), the pattern screen
 * readers announce as a resizable boundary.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Tooltip } from '../ui/tooltip';
import { dragHeight, keyboardHeight, type HeightBounds } from './composerResize';

export function ComposerResizeHandle({
  currentHeight,
  valueNow,
  bounds,
  lineStep,
  onResize,
  onCommit,
  onReset,
}: {
  /** The box's height as shown now, read at the start of a drag or key press. */
  currentHeight: () => number;
  /** The height to announce: the chosen one, or the fitted one when none is chosen. */
  valueNow: number;
  bounds: HeightBounds;
  lineStep: number;
  onResize: (height: number) => void;
  /** The drag or key press is over: remember the height. */
  onCommit: (height: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ startY: number; startHeight: number; last: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startHeight = currentHeight();
    drag.current = { startY: event.clientY, startHeight, last: startHeight };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const next = dragHeight(drag.current.startHeight, drag.current.startY, event.clientY, bounds);
    drag.current.last = next;
    onResize(next);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { last } = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onCommit(last);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyboardHeight(event.key, currentHeight(), bounds, lineStep);
    if (next === null) return;
    event.preventDefault();
    onResize(next);
    onCommit(next);
  };

  return (
    <Tooltip label="Drag to resize. Double-click to fit the text." side="top" className="absolute inset-x-0 top-0 z-10">
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Message box height"
        aria-valuemin={Math.round(bounds.min)}
        aria-valuemax={Math.round(Math.max(bounds.min, bounds.max))}
        aria-valuenow={Math.round(valueNow)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onReset}
        onKeyDown={onKeyDown}
        className="group flex h-2.5 w-full touch-none cursor-row-resize select-none justify-center outline-none"
      >
        <span
          aria-hidden="true"
          className="mt-[3px] h-[3px] w-8 rounded-full bg-[var(--r-hairline-strong)] transition-colors motion-reduce:transition-none group-hover:bg-[var(--r-accent)] group-focus-visible:bg-[var(--r-accent)] group-active:bg-[var(--r-accent)]"
        />
      </div>
    </Tooltip>
  );
}

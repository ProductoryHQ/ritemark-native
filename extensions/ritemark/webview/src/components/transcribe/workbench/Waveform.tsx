/**
 * Sprint 108 R7 — the waveform scrubber.
 *
 * Canvas drawn from the peaks computed once at import (audioPrep), NOT from a
 * waveform library: the webview bundle is already ~8 MB (#107) and this needs
 * about forty lines.
 *
 * On Windows there are no peaks — they come from an `afconvert` pass that only
 * exists on macOS — so this falls back to a plain progress bar. Same seeking,
 * no pretence of a waveform that was never computed.
 */

import { useCallback, useEffect, useRef } from 'react';
import { resamplePeaks } from './playback';

const BAR_WIDTH = 3;
const BAR_GAP = 1;

export function Waveform({
  peaks,
  durationSec,
  currentTime,
  onSeek,
}: {
  peaks: number[];
  durationSec: number;
  currentTime: number;
  onSeek: (seconds: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ratio = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.body);
    const played = styles.getPropertyValue('--r-accent').trim() || '#4338CA';
    const ahead = styles.getPropertyValue('--r-hairline-strong').trim() || '#CBD5E1';

    const bars = Math.max(1, Math.floor(width / (BAR_WIDTH + BAR_GAP)));
    const values = resamplePeaks(peaks, bars);
    const progress = durationSec > 0 ? currentTime / durationSec : 0;

    values.forEach((value, index) => {
      // A floor, so silence still reads as a track rather than a gap.
      const barHeight = Math.max(2, value * height);
      const x = index * (BAR_WIDTH + BAR_GAP);
      const y = (height - barHeight) / 2;
      ctx.fillStyle = index / values.length <= progress ? played : ahead;
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
      ctx.fill();
    });
  }, [peaks, durationSec, currentTime]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const observer = new ResizeObserver(() => draw());
    if (wrapRef.current) observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [draw]);

  const seekFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current;
    if (!wrap || durationSec <= 0) return;
    const rect = wrap.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(fraction * durationSec);
  };

  if (peaks.length === 0) {
    const progress = durationSec > 0 ? Math.min(100, (currentTime / durationSec) * 100) : 0;
    return (
      <div
        ref={wrapRef}
        className="h-9 flex-1 cursor-pointer select-none py-3.5"
        onClick={seekFromEvent}
        title="Seek"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-hairline-strong">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="h-9 flex-1 cursor-pointer select-none" onClick={seekFromEvent} title="Seek">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

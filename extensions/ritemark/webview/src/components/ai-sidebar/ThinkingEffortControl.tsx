import { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type {
  ExplicitThinkingEffort,
  ThinkingEffort,
  ThinkingEffortCapability,
} from './types';

const LABELS: Record<ThinkingEffort, string> = {
  auto: 'Auto',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra',
  max: 'Max',
  ultra: 'Ultra',
};

// The range input is inset 12px and its 26px thumb contributes another 13px
// to the endpoint center. The 2px accent ring makes the visible envelope 15px.
const RANGE_ENDPOINT_CENTER_PX = 25;
const RANGE_THUMB_ENVELOPE_RADIUS_PX = 15;

interface ThinkingEffortControlProps {
  runtimeLabel: string;
  modelLabel: string;
  capability: ThinkingEffortCapability | null;
  value: ThinkingEffort;
  onChange: (value: ThinkingEffort) => void;
  running: boolean;
}

export function ThinkingEffortControl({
  runtimeLabel,
  modelLabel,
  capability,
  value,
  onChange,
  running,
}: ThinkingEffortControlProps) {
  const levels = capability?.selectable ?? [];
  const supported = levels.length > 0;
  const fallbackManual = capability?.defaultLevel && levels.includes(capability.defaultLevel)
    ? capability.defaultLevel
    : levels[Math.min(Math.floor(levels.length / 2), Math.max(0, levels.length - 1))];
  const [lastManual, setLastManual] = useState<ExplicitThinkingEffort | undefined>(
    value === 'auto' ? fallbackManual : value,
  );

  useEffect(() => {
    if (value !== 'auto' && levels.includes(value)) setLastManual(value);
    if (lastManual && !levels.includes(lastManual)) setLastManual(fallbackManual);
  }, [fallbackManual, lastManual, levels, value]);

  const manual = value === 'auto' ? lastManual ?? fallbackManual : value;
  const selectedIndex = Math.max(0, manual ? levels.indexOf(manual) : 0);
  const fillPercent = levels.length <= 1 ? 0 : (selectedIndex / (levels.length - 1)) * 100;
  const disabledReason = capability?.source === 'runtime-live'
    ? 'Thinking effort becomes available after OpenCode advertises supported levels for this conversation.'
    : 'This model chooses its own thinking effort.';
  const triggerLabel = !supported
    ? 'Effort · Auto'
    : value === 'auto'
      ? 'Effort'
      : `Effort · ${LABELS[value]}`;
  const currentLabel = value === 'auto' ? 'Auto' : LABELS[value];

  const stopPositions = useMemo(() => levels.map((level, index) => ({
    level,
    left: levels.length <= 1 ? 50 : (index / (levels.length - 1)) * 100,
  })), [levels]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-disabled={!supported}
          aria-label={`${runtimeLabel}, ${modelLabel}, thinking effort ${currentLabel}`}
          title={supported ? `Thinking effort: ${currentLabel}` : disabledReason}
          onClick={(event) => {
            if (!supported) event.preventDefault();
          }}
          className="h-6 shrink-0 whitespace-nowrap rounded-md border border-transparent bg-transparent px-1.5 text-[11px] font-medium text-[var(--r-ink-muted)] hover:bg-[var(--r-surface-soft)] hover:text-[var(--r-ink-strong)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)] aria-disabled:cursor-default aria-disabled:opacity-55 aria-disabled:hover:bg-transparent"
        >
          {triggerLabel}
        </button>
      </Popover.Trigger>

      {supported ? (
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={8}
            className="z-[90] w-[min(300px,calc(100vw-16px))] rounded-[10px] border border-[var(--r-hairline)] bg-[var(--r-surface)] p-3 shadow-[0_10px_28px_rgba(26,24,67,0.18)] focus:outline-none"
          >
            <div className="flex items-center justify-between gap-3 text-[13px] font-medium text-[var(--r-ink-strong)]">
              <span>Thinking effort</span>
              <span>{currentLabel}</span>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[var(--r-ink-muted)]">
              <span>Faster</span>
              <span>More thorough</span>
            </div>

            <div className={`relative mt-2 h-10 ${value === 'auto' ? 'opacity-60' : ''}`}>
              <div className="absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-full border border-[var(--r-hairline)] bg-[var(--r-surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--r-accent)]"
                  style={{
                    width: `calc(${RANGE_ENDPOINT_CENTER_PX + RANGE_THUMB_ENVELOPE_RADIUS_PX}px + (100% - ${RANGE_ENDPOINT_CENTER_PX * 2}px) * ${fillPercent / 100})`,
                  }}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{ insetInline: RANGE_ENDPOINT_CENTER_PX }}
              >
                {stopPositions.map(({ level, left }) => (
                  <span
                    key={level}
                    title={LABELS[level]}
                    aria-hidden="true"
                    className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--r-surface)] opacity-60"
                    style={{ left: `${left}%` }}
                  />
                ))}
              </div>
              <input
                type="range"
                className="thinking-effort-range absolute inset-x-3 inset-y-0 cursor-grab touch-none bg-transparent active:cursor-grabbing"
                min={0}
                max={Math.max(0, levels.length - 1)}
                step={1}
                value={selectedIndex}
                aria-label="Manual thinking effort"
                aria-valuetext={manual ? LABELS[manual] : undefined}
                title={manual ? LABELS[manual] : undefined}
                onChange={(event) => {
                  const index = Number(event.currentTarget.value);
                  const next = levels[index];
                  if (!next) return;
                  setLastManual(next);
                  onChange(next);
                }}
              />
            </div>

            <div className="mt-3 border-t border-[var(--r-hairline)] pt-3">
              <label className="flex min-h-7 cursor-pointer items-center gap-2 text-[12px] font-medium text-[var(--r-ink-body)]">
                <input
                  type="checkbox"
                  checked={value === 'auto'}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange('auto');
                    } else if (manual) {
                      onChange(manual);
                    }
                  }}
                  className="h-4 w-4 rounded border-[var(--r-hairline-strong,var(--r-hairline))] accent-[var(--r-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder)]"
                />
                Auto
              </label>
              <p className="sr-only" aria-live="polite">
                {running ? 'Changes apply to the next message, not the turn already running.' : ''}
              </p>
            </div>
          </Popover.Content>
        </Popover.Portal>
      ) : null}
    </Popover.Root>
  );
}

// The 26px thumb contributes 13px and its 2px accent ring another 2px.
// Insetting the input by 2px makes the ring's outer edge flush with the track.
export const THINKING_EFFORT_ENDPOINT_CENTER_PX = 15;

const PROGRESS_OVERHANG_PX = 8;

export function getThinkingEffortFillWidth(levelCount: number, selectedIndex: number): string {
  if (levelCount <= 0) return '0%';
  if (levelCount === 1) return `calc(50% + ${PROGRESS_OVERHANG_PX}px)`;
  if (selectedIndex === levelCount - 1) return '100%';

  const fillPercent = selectedIndex / (levelCount - 1);
  return `calc(${THINKING_EFFORT_ENDPOINT_CENTER_PX + PROGRESS_OVERHANG_PX}px + (100% - ${THINKING_EFFORT_ENDPOINT_CENTER_PX * 2}px) * ${fillPercent})`;
}

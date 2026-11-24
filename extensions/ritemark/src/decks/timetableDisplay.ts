import type { Timetable, TimetableSlide } from './timetable';

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)} h${remainder ? ` ${remainder} min` : ''}`;
}

export function slideMinutesText(slide: TimetableSlide | undefined): string | null {
  const minutes = slide?.minutes ?? (slide?.sectionMinutes || null);
  return minutes === null ? null : `${minutes} min`;
}

export function timetableStatus(timetable: Timetable): { text: string; over: boolean; tooltip: string } | null {
  const { slides, totalMinutes, sessionMinutes, untimedCount } = timetable;
  if (!slides.some(slide => slide.minutes !== null)) return null;
  const delta = sessionMinutes === null ? 0 : totalMinutes - sessionMinutes;
  const comparison = sessionMinutes === null ? ''
    : delta === 0 ? ` · fits ${duration(sessionMinutes)}`
    : ` · ${duration(Math.abs(delta))} ${delta > 0 ? 'over' : 'under'} ${duration(sessionMinutes)}`;
  return {
    text: `${slides.length} ${slides.length === 1 ? 'slide' : 'slides'} · ${duration(totalMinutes)}${comparison}`,
    over: delta > 0,
    tooltip: untimedCount === 0 ? 'Deck length' : untimedCount === 1
      ? '1 slide has no time yet' : `${untimedCount} slides have no time yet`,
  };
}

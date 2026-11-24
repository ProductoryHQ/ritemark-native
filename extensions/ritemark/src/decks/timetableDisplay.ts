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

export function slideCountWithMinutes(count: string, slide: TimetableSlide | undefined): string {
  const minutes = slideMinutesText(slide);
  return minutes === null ? count : `${count} · ${minutes}`;
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

/** Clock times wrap at midnight. Elapsed starts keep counting hours. */
export function timetableTime(minutes: number, clock = false): string {
  const value = clock ? minutes % 1440 : minutes;
  const hours = String(Math.floor(value / 60)).padStart(clock ? 2 : 1, '0');
  return `${hours}:${String(value % 60).padStart(2, '0')}`;
}

export function timetableRows({ slides, sessionStart }: Timetable) {
  return slides.map(slide => ({
    ...slide,
    start: slide.sectionMinutes === null
      ? timetableTime((sessionStart ?? 0) + slide.startMinutes, sessionStart != null)
      : null,
  }));
}

export function nextMinutesRow(slides: readonly TimetableSlide[], index: number, backwards: boolean): number | null {
  const step = backwards ? -1 : 1;
  for (let at = index + step; at >= 0 && at < slides.length; at += step) {
    if (slides[at].sectionMinutes === null) return at;
  }
  return null;
}

export function timetableFoot({ slides, totalMinutes, sessionStart, sessionMinutes, untimedCount }: Timetable) {
  const delta = sessionMinutes === null ? null : totalMinutes - sessionMinutes;
  return {
    count: `${slides.length} ${slides.length === 1 ? 'slide' : 'slides'}`,
    total: duration(totalMinutes),
    start: sessionStart == null ? null : timetableTime(sessionStart, true),
    end: sessionMinutes === null ? null : timetableTime((sessionStart ?? 0) + sessionMinutes, true),
    comparison: delta === null ? null : delta === 0 ? 'fits' : `${duration(Math.abs(delta))} ${delta > 0 ? 'over' : 'under'}`,
    over: delta !== null && delta > 0,
    untimed: untimedCount === 0 ? null : untimedCount === 1 ? '1 slide has no time yet' : `${untimedCount} slides have no time yet`,
  };
}

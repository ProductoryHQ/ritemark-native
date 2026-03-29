import type { FlowSchedule, IsoWeekday } from './stores/flowEditorStore';

function parseScheduleTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
    return null;
  }

  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

function isValidMinute(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 59;
}

function isValidIntervalMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 59;
}

function getIsoWeekday(date: Date): IsoWeekday {
  const weekday = date.getDay();
  return (weekday === 0 ? 7 : weekday) as IsoWeekday;
}

function toSlotDate(base: Date, hours: number, minutes: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

function toHourSlotDate(base: Date, minutes: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    base.getHours(),
    minutes,
    0,
    0
  );
}

function startOfDay(base: Date): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    0,
    0,
    0,
    0
  );
}

function isAllowedOnDate(schedule: FlowSchedule, date: Date): boolean {
  const weekday = getIsoWeekday(date);

  if (schedule.type === 'daily') {
    return true;
  }

  if (schedule.type === 'weekdays') {
    return weekday >= 1 && weekday <= 5;
  }

  return (schedule.days ?? []).includes(weekday);
}

function isClockSchedule(
  schedule: FlowSchedule
): schedule is FlowSchedule & { type: 'daily' | 'weekdays' | 'weekly'; time: string } {
  return (
    schedule.type === 'daily' ||
    schedule.type === 'weekdays' ||
    schedule.type === 'weekly'
  );
}

export function getNextScheduledRun(
  schedule: FlowSchedule | null,
  now: Date = new Date()
): Date | null {
  if (!schedule?.enabled) {
    return null;
  }

  if (isClockSchedule(schedule)) {
    const parsedTime = parseScheduleTime(schedule.time);
    if (!parsedTime) {
      return null;
    }

    for (let offset = 0; offset < 8; offset += 1) {
      const candidateDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
        0,
        0,
        0,
        0
      );

      if (!isAllowedOnDate(schedule, candidateDay)) {
        continue;
      }

      const candidate = toSlotDate(candidateDay, parsedTime.hours, parsedTime.minutes);
      if (candidate.getTime() >= now.getTime()) {
        return candidate;
      }
    }

    return null;
  }

  if (schedule.type === 'hourly') {
    if (!isValidMinute(schedule.minuteOfHour ?? -1)) {
      return null;
    }

    const currentHourSlot = toHourSlotDate(now, schedule.minuteOfHour ?? 0);
    if (currentHourSlot.getTime() >= now.getTime()) {
      return currentHourSlot;
    }

    return new Date(currentHourSlot.getTime() + 60 * 60 * 1000);
  }

  if (!isValidIntervalMinutes(schedule.intervalMinutes ?? -1)) {
    return null;
  }

  const intervalMs = (schedule.intervalMinutes ?? 1) * 60 * 1000;
  const dayStart = startOfDay(now);
  const elapsedMs = now.getTime() - dayStart.getTime();
  const nextSlotIndex = Math.ceil(elapsedMs / intervalMs);
  return new Date(dayStart.getTime() + nextSlotIndex * intervalMs);
}

export function formatScheduleSummary(schedule: FlowSchedule | null): string {
  if (!schedule) {
    return 'Add schedule';
  }

  if (!schedule.enabled) {
    return 'Schedule disabled';
  }

  if (schedule.type === 'daily') {
    return `Daily at ${schedule.time}`;
  }

  if (schedule.type === 'weekdays') {
    return `Weekdays at ${schedule.time}`;
  }

  if (schedule.type === 'hourly') {
    const minute = schedule.minuteOfHour ?? 0;
    return `Hourly at :${String(minute).padStart(2, '0')}`;
  }

  if (schedule.type === 'interval') {
    const interval = schedule.intervalMinutes ?? 1;
    return `Every ${interval} min`;
  }

  const dayCount = schedule.days?.length ?? 0;
  if (dayCount === 1) {
    return `Weekly at ${schedule.time}`;
  }

  return `Weekly (${dayCount} days) at ${schedule.time}`;
}

export function formatScheduleDateTime(date: Date | null): string {
  if (!date) {
    return 'Not scheduled';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const timePart = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (dayDiff === 0) {
    return `Today ${timePart}`;
  }

  if (dayDiff === 1) {
    return `Tomorrow ${timePart}`;
  }

  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

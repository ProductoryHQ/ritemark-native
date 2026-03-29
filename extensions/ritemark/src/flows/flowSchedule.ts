import type { FlowSchedule, IsoWeekday } from './types';

export const SCHEDULE_TICK_MS = 30_000;
export const SCHEDULE_GRACE_MS = 5 * 60 * 1000;

export interface ParsedScheduleTime {
  hours: number;
  minutes: number;
}

function isValidHour(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}

function isValidMinute(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 59;
}

function isValidIntervalMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 59;
}

export function parseScheduleTime(value: string): ParsedScheduleTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!isValidHour(hours) || !isValidMinute(minutes)) {
    return null;
  }

  return { hours, minutes };
}

export function getIsoWeekday(date: Date): IsoWeekday {
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

function isClockSchedule(
  schedule: FlowSchedule
): schedule is FlowSchedule & { type: 'daily' | 'weekdays' | 'weekly'; time: string } {
  return (
    schedule.type === 'daily' ||
    schedule.type === 'weekdays' ||
    schedule.type === 'weekly'
  );
}

function isScheduleAllowedOnDate(schedule: FlowSchedule, date: Date): boolean {
  const weekday = getIsoWeekday(date);

  if (schedule.type === 'daily') {
    return true;
  }

  if (schedule.type === 'weekdays') {
    return weekday >= 1 && weekday <= 5;
  }

  const days = schedule.days ?? [];
  return days.includes(weekday);
}

export function isValidFlowSchedule(schedule: FlowSchedule): boolean {
  if (!schedule.enabled) {
    return true;
  }

  if (isClockSchedule(schedule)) {
    if (!schedule.time || !parseScheduleTime(schedule.time)) {
      return false;
    }

    if (schedule.type !== 'weekly') {
      return true;
    }

    if (!schedule.days || schedule.days.length === 0) {
      return false;
    }

    const uniqueDays = new Set(schedule.days);
    if (uniqueDays.size !== schedule.days.length) {
      return false;
    }

    return schedule.days.every((day) => day >= 1 && day <= 7);
  }

  if (schedule.type === 'hourly') {
    return isValidMinute(schedule.minuteOfHour ?? -1);
  }

  return isValidIntervalMinutes(schedule.intervalMinutes ?? -1);
}

export function getNextScheduledRun(
  schedule: FlowSchedule,
  now: Date
): Date | null {
  if (!schedule.enabled || !isValidFlowSchedule(schedule)) {
    return null;
  }

  if (isClockSchedule(schedule)) {
    const parsedTime = parseScheduleTime(schedule.time);
    if (!parsedTime) {
      return null;
    }

    for (let offset = 0; offset < 8; offset += 1) {
      const candidateDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
        0,
        0,
        0,
        0
      );

      if (!isScheduleAllowedOnDate(schedule, candidateDate)) {
        continue;
      }

      const candidate = toSlotDate(
        candidateDate,
        parsedTime.hours,
        parsedTime.minutes
      );

      if (candidate.getTime() >= now.getTime()) {
        return candidate;
      }
    }

    return null;
  }

  if (schedule.type === 'hourly') {
    const currentHourSlot = toHourSlotDate(now, schedule.minuteOfHour ?? 0);
    if (currentHourSlot.getTime() >= now.getTime()) {
      return currentHourSlot;
    }

    return new Date(currentHourSlot.getTime() + 60 * 60 * 1000);
  }

  const intervalMinutes = schedule.intervalMinutes ?? 1;
  const intervalMs = intervalMinutes * 60 * 1000;
  const dayStart = startOfDay(now);
  const elapsedMs = now.getTime() - dayStart.getTime();
  const nextSlotIndex = Math.ceil(elapsedMs / intervalMs);
  return new Date(dayStart.getTime() + nextSlotIndex * intervalMs);
}

export function getDueScheduledRun(
  schedule: FlowSchedule,
  now: Date,
  lastScheduledFor?: string | null,
  graceMs: number = SCHEDULE_GRACE_MS
): Date | null {
  if (!schedule.enabled || !isValidFlowSchedule(schedule)) {
    return null;
  }

  let currentSlot: Date | null = null;

  if (isClockSchedule(schedule)) {
    const parsedTime = parseScheduleTime(schedule.time);
    if (!parsedTime) {
      return null;
    }

    const todaySlot = toSlotDate(now, parsedTime.hours, parsedTime.minutes);
    if (!isScheduleAllowedOnDate(schedule, todaySlot)) {
      return null;
    }

    currentSlot = todaySlot;
  } else if (schedule.type === 'hourly') {
    currentSlot = toHourSlotDate(now, schedule.minuteOfHour ?? 0);
  } else {
    const intervalMinutes = schedule.intervalMinutes ?? 1;
    const intervalMs = intervalMinutes * 60 * 1000;
    const dayStart = startOfDay(now);
    const elapsedMs = now.getTime() - dayStart.getTime();
    const slotIndex = Math.floor(elapsedMs / intervalMs);
    currentSlot = new Date(dayStart.getTime() + slotIndex * intervalMs);
  }

  const nowTime = now.getTime();
  const slotTime = currentSlot.getTime();

  if (slotTime > nowTime) {
    return null;
  }

  if (nowTime - slotTime > graceMs) {
    return null;
  }

  if (lastScheduledFor === currentSlot.toISOString()) {
    return null;
  }

  return currentSlot;
}

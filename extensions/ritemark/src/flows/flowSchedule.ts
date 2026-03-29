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

  if (!parseScheduleTime(schedule.time)) {
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

export function getNextScheduledRun(
  schedule: FlowSchedule,
  now: Date
): Date | null {
  if (!schedule.enabled || !isValidFlowSchedule(schedule)) {
    return null;
  }

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

export function getDueScheduledRun(
  schedule: FlowSchedule,
  now: Date,
  lastScheduledFor?: string | null,
  graceMs: number = SCHEDULE_GRACE_MS
): Date | null {
  if (!schedule.enabled || !isValidFlowSchedule(schedule)) {
    return null;
  }

  const parsedTime = parseScheduleTime(schedule.time);
  if (!parsedTime) {
    return null;
  }

  const todaySlot = toSlotDate(now, parsedTime.hours, parsedTime.minutes);
  if (!isScheduleAllowedOnDate(schedule, todaySlot)) {
    return null;
  }

  const nowTime = now.getTime();
  const slotTime = todaySlot.getTime();

  if (slotTime > nowTime) {
    return null;
  }

  if (nowTime - slotTime > graceMs) {
    return null;
  }

  if (lastScheduledFor === todaySlot.toISOString()) {
    return null;
  }

  return todaySlot;
}

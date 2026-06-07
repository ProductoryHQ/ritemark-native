import type { ScheduleConfig } from './ScheduledTask';

/**
 * Parse a `schedule:` frontmatter block from agent file content.
 * Returns undefined if no valid schedule block is found.
 *
 * Accepts:
 *   schedule:
 *     cron: "0 9 * * 1-5"
 *     label: "Daily brief"
 *     enabled: true
 */
export function parseScheduleFromFrontmatter(content: string): ScheduleConfig | undefined {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return undefined;
  }

  const fm = fmMatch[1];

  // Extract the schedule block — supports both inline and block scalar
  const scheduleBlockMatch = fm.match(/^schedule:\s*\n((?:[ \t]+.+\n?)*)/m);
  if (!scheduleBlockMatch) {
    return undefined;
  }

  const block = scheduleBlockMatch[1];

  const cronMatch = block.match(/^\s+cron:\s*["']?([^"'\n]+)["']?/m);
  const labelMatch = block.match(/^\s+label:\s*["']?([^"'\n]+)["']?/m);
  const enabledMatch = block.match(/^\s+enabled:\s*(true|false)/m);

  if (!cronMatch) {
    return undefined;
  }

  const cron = cronMatch[1].trim();
  const label = labelMatch ? labelMatch[1].trim() : undefined;
  const enabled = enabledMatch ? enabledMatch[1] === 'true' : true;

  if (!isValidCron(cron)) {
    return undefined;
  }

  return { cron, label: label ?? '', enabled };
}

/** Basic 5-field cron validation (minute hour dom month dow). */
function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }
  const fieldPattern = /^(\*|[0-9,\-*/]+)$/;
  return parts.every(p => fieldPattern.test(p));
}

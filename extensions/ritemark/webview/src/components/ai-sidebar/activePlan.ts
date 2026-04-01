import type { CodexPlanStep } from './types';
import { extractPlanDisplayText } from './planText';

export type ActivePlanStepStatus = 'pending' | 'inProgress' | 'completed';

export interface ActivePlanStep {
  label: string;
  status: ActivePlanStepStatus;
}

export interface ActivePlanViewModel {
  summary: string;
  steps: ActivePlanStep[];
}

function cleanPlanLine(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^[A-Z][.)]\s+/, '')
    .replace(/^\[[ xX]\]\s+/, '')
    .replace(/^(?:✅|☑️|✔️|✓)\s+/, '')
    .replace(/^(?:▶️|🔄|⏳)\s+/, '')
    .replace(/^(?:⬜|☐|◻️)\s+/, '')
    .trim();
}

function parsePlanLineStatus(line: string): ActivePlanStepStatus {
  const trimmed = line.trim();
  if (/^(?:[-*+]\s+)?\[[xX]\]\s+/.test(trimmed)) {
    return 'completed';
  }
  if (/^(?:[-*+]\s+)?\[\s\]\s+/.test(trimmed)) {
    return 'pending';
  }
  if (/^(?:[-*+]\s+)?(?:✅|☑️|✔️|✓)\s+/.test(trimmed)) {
    return 'completed';
  }
  if (/^(?:[-*+]\s+)?(?:▶️|🔄|⏳)\s+/.test(trimmed)) {
    return 'inProgress';
  }
  if (/^(?:[-*+]\s+)?(?:⬜|☐|◻️)\s+/.test(trimmed)) {
    return 'pending';
  }
  return 'pending';
}

function extractChecklistBlock(planText: string): string {
  const normalized = planText.trim();
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n');
  const checklistLinePattern = /^(?:\s*[-*+]\s+)?(?:\[[ xX]\]|✅|☑️|✔️|✓|▶️|🔄|⏳|⬜|☐|◻️)\s+/;

  const firstChecklistIndex = lines.findIndex((line) => checklistLinePattern.test(line.trim()));
  if (firstChecklistIndex === -1) {
    return '';
  }

  let start = firstChecklistIndex;
  const previousLine = lines[firstChecklistIndex - 1]?.trim() || '';
  if (previousLine && /checklist|tööseis/i.test(previousLine)) {
    start = firstChecklistIndex - 1;
  }

  let end = lines.length;
  for (let i = firstChecklistIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      end = i;
      break;
    }
    if (!checklistLinePattern.test(trimmed) && !/checklist|tööseis/i.test(trimmed)) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n').trim();
}

function parsePlanTextToSteps(planText: string): ActivePlanStep[] {
  const displayText = extractChecklistBlock(planText) || extractPlanDisplayText(planText);
  if (!displayText) {
    return [];
  }

  const lines = displayText
    .split('\n')
    .map((rawLine) => ({
      label: cleanPlanLine(rawLine),
      status: parsePlanLineStatus(rawLine),
    }))
    .filter((line) => line.label.length > 0)
    .filter((line) => !/^plan:?$/i.test(line.label))
    .filter((line) => !/^working checklist:?$/i.test(line.label))
    .filter((line) => !/^checklist:?$/i.test(line.label))
    .filter((line) => !/^lühike checklist:?$/i.test(line.label))
    .filter((line) => !/^töö-?checklist:?$/i.test(line.label))
    .filter((line) => !/^tööseis/i.test(line.label))
    .filter((line) => !/^i will not /i.test(line.label))
    .filter((line) => !/^do not /i.test(line.label));

  return lines.slice(0, 6);
}

function summarizeSteps(steps: ActivePlanStep[]): string {
  const completed = steps.filter((step) => step.status === 'completed').length;
  const inProgress = steps.filter((step) => step.status === 'inProgress').length;
  const pending = steps.filter((step) => step.status === 'pending').length;

  const parts: string[] = [];
  if (inProgress > 0) {
    parts.push(`${inProgress} in progress`);
  }
  if (pending > 0) {
    parts.push(`${pending} pending`);
  }
  if (completed > 0) {
    parts.push(`${completed} done`);
  }

  return parts.join(' · ') || 'Plan ready';
}

export function buildActivePlanViewModel(
  planText: string,
  planSteps?: CodexPlanStep[],
  isRunning = false,
  allCompleted = false
): ActivePlanViewModel | null {
  const normalizedSteps = (planSteps || [])
    .map((step) => ({
      label: step.step.trim(),
      status: step.status,
    }))
    .filter((step) => step.label.length > 0);

  const fallbackSteps = normalizedSteps.length > 0 ? normalizedSteps : parsePlanTextToSteps(planText);
  if (fallbackSteps.length === 0) {
    return null;
  }

  const steps = fallbackSteps.map((step, index) => {
    if (allCompleted && normalizedSteps.length === 0) {
      return {
        ...step,
        status: 'completed' as const,
      };
    }
    if (isRunning && !fallbackSteps.some((candidate) => candidate.status === 'inProgress' || candidate.status === 'completed')) {
      return {
        ...step,
        status: (index === 0 ? 'inProgress' : 'pending') as ActivePlanStepStatus,
      };
    }
    return step;
  });

  return {
    summary: summarizeSteps(steps),
    steps,
  };
}

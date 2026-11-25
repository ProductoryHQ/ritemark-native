import { splitFileName } from '../../../../src/decks/deckFileName';
import { documentStepKind, isDocumentReadTool, type ToolStep } from '../../../../src/runtime/toolStep';
import type { AgentProgress } from './types';

const names = {
  word: ['Word document', 'Word documents'],
  pdf: ['PDF', 'PDFs'],
  powerpoint: ['PowerPoint deck', 'PowerPoint decks'],
} as const;

type DocumentKind = keyof typeof names;
const icons = { word: 'file-doc', pdf: 'file-pdf', powerpoint: 'file-ppt' } as const;

function basename(path: string): string {
  return path.replace(/[/\\]+$/, '').split(/[/\\]/).pop()?.replace(/[\r\n\u2028\u2029]/g, ' ') ?? '';
}

function documentCounts(paths: Iterable<string>): string {
  const kinds = new Map<DocumentKind, number>();
  for (const path of paths) {
    const kind = documentStepKind(path);
    if (kind) kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  return [...kinds].map(([kind, count]) => `${count} ${names[kind][count === 1 ? 0 : 1]}`).join(', ');
}

/** Structured document steps and subagent/plan events have their own presentation. */
export function isHiddenToolActivity(activity: AgentProgress): boolean {
  return !activity.step && !isDocumentReadTool(activity.tool)
    && (activity.type === 'tool_use' || activity.type === 'subagent_progress')
    && /^(?:(?:ToolSearch|TodoWrite|Task|Agent|EnterPlanMode|ExitPlanMode)$|mcp__)/i.test(activity.tool ?? '');
}

function stepOf(activity: AgentProgress): Omit<ToolStep, 'id'> | undefined {
  if (activity.step) return activity.step;
  // Older transcripts did not persist the step payload.
  if (/^(?:Bash|shell|terminal|commandExecution)$/i.test(activity.tool ?? '')) {
    return { kind: 'shell', command: activity.message, status: activity.type === 'done' ? 'completed' : undefined };
  }
  if (activity.tool === 'Read' || isDocumentReadTool(activity.tool)) return { kind: 'read', path: activity.file };
  if (activity.tool === 'Glob' || activity.tool === 'LS') return { kind: 'folder', path: activity.file, command: activity.message };
}

export function stepLabel(activity: AgentProgress) {
  const step = stepOf(activity);
  if (!step) return;
  const { path, command, status } = step;
  const warning = status === 'failed';
  const detail = [path, command].filter(Boolean).join('\n');
  if (step.kind === 'shell') {
    const documents = /\.(?:docx?|pdf|pptx?)(?=$|[\s"'\x60,;)\]])/i.test(command ?? '');
    const label = documents ? 'Reading documents' : status === 'completed' ? 'Ran a command' : 'Running a command';
    return { label, detail, warning, icon: 'terminal' as const };
  }
  if (step.kind === 'folder') {
    const folder = basename(path ?? '');
    const where = folder && folder !== '.' && folder !== '..' && !folder.includes(':') ? folder : 'the project folder';
    const counts = status === 'completed' && documentCounts(step.listing ?? []);
    const label = warning ? `Couldn't look in ${where}` : status === 'completed' ? `Looked in ${where}` : `Looking in ${where}`;
    return { label: counts ? `${label}: ${counts}` : label, detail, warning, icon: 'folder-simple' as const };
  }
  const base = basename(path ?? '');
  const file = base === '.' || base === '..' || /^[a-z]:$/i.test(base) ? '' : base;
  const kind = documentStepKind(file);
  const name = (kind ? splitFileName(file).name : file) || 'document';
  const verb = warning ? "Couldn't open" : status === 'completed' ? 'Read' : 'Reading';
  const note = warning ? step.warning : step.units;
  return {
    label: `${verb} ${name}${note ? ` · ${note}` : ''}`,
    detail,
    warning,
    icon: kind ? icons[kind] : 'file-text' as const,
  };
}

export function updateStep(activities: AgentProgress[], incoming: AgentProgress): AgentProgress[] {
  if (isHiddenToolActivity(incoming)) return activities;
  const step = incoming.step;
  const index = step ? activities.findIndex((a) => a.step?.id === step.id) : -1;
  if (!step || index < 0) return [...activities, incoming];
  const previous = activities[index];
  const next = [...activities];
  next[index] = {
    ...previous,
    step: {
      ...step,
      path: step.path ?? previous.step?.path,
      command: step.command ?? previous.step?.command,
    },
  };
  return next;
}

export function readSummary(activities: AgentProgress[], activeMs = 0): string | undefined {
  const paths = new Set<string>();
  for (const { step } of activities) {
    if (step?.kind === 'read' && step.status === 'completed' && step.path) {
      paths.add(step.path.replace(/\\/g, '/').replace(/^\.\//, ''));
    }
  }
  const counts = documentCounts(paths);
  if (counts) return `Read ${counts}${activeMs > 0 ? ` · ${Math.round(activeMs / 1000)} s` : ''}`;
}

export function activityHeadline(activity?: AgentProgress): string {
  return activity && !isHiddenToolActivity(activity) ? stepLabel(activity)?.label ?? activity.message : '';
}

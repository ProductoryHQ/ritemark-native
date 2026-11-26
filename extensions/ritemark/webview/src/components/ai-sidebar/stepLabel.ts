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
  const { command, status } = step;
  const path = step.path?.trim() ? step.path : step.kind === 'read' ? activity.file : undefined;
  const warning = status === 'failed';
  const reason = step.warning?.trim();
  const detail = [path, command].filter(Boolean).join('\n');
  if (step.kind === 'shell') {
    const documents = /\.(?:docx?|pdf|pptx?)(?=$|[\s"'\x60,;)\]])/i.test(command ?? '');
    const label = warning ? "Couldn't run the command" : documents ? 'Reading documents' : status === 'completed' ? 'Ran a command' : 'Running a command';
    const note = reason || (command
      ? 'the command failed. Open step details to check the command'
      : 'the command failed. Try the request again');
    return {
      label: warning ? `${label} · ${note}` : label,
      detail, warning, icon: 'terminal' as const,
    };
  }
  if (step.kind === 'folder') {
    const folder = basename(path ?? '');
    const where = folder && folder !== '.' && folder !== '..' && !folder.includes(':') ? folder : 'the project folder';
    const counts = status === 'completed' && documentCounts(step.listing ?? []);
    const label = warning ? `Couldn't look in ${where}` : status === 'completed' ? `Looked in ${where}` : `Looking in ${where}`;
    const note = warning ? reason || 'check that the folder exists and you can open it' : undefined;
    return {
      label: note ? `${label} · ${note}` : counts ? `${label}: ${counts}` : label,
      detail, warning, icon: 'folder-simple' as const,
    };
  }
  const base = basename(path ?? '');
  const file = base === '.' || base === '..' || /^[a-z]:$/i.test(base) ? '' : base;
  const kind = documentStepKind(file);
  const name = (kind ? splitFileName(file).name : file) || 'document';
  const verb = warning ? "Couldn't open" : status === 'completed' ? 'Read' : 'Reading';
  const note = warning
    ? reason || (path ? 'check that the file exists and you can open it' : 'choose a file inside the project to try again')
    : step.units;
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
  if (previous.step?.status && !step.status) return activities;
  const next = [...activities];
  next[index] = {
    ...previous,
    step: {
      ...step,
      path: step.path ?? previous.step?.path ?? incoming.file,
      command: step.command ?? previous.step?.command,
    },
  };
  if (previous.step?.status === 'failed' && step.status === 'completed') {
    let end = index + 1;
    while (next[end]?.type === 'thinking') end++;
    next.splice(index + 1, end - index - 1);
  }
  return next;
}

export function isTurnLifecycleActivity(activity: AgentProgress): boolean {
  // Model notices have their own type. Codex also uses "done" for completed tool calls, which are still steps.
  return activity.type === 'init' || (activity.type === 'done' && !activity.tool && !activity.step);
}

function retryKey(activity: AgentProgress): string | undefined {
  const { step } = activity;
  if (!step) return;
  if (step.kind === 'shell') return step.command ? JSON.stringify([step.kind, step.command]) : undefined;
  const target = step.path?.trim() || activity.file?.trim();
  if (target) {
    return JSON.stringify([step.kind, target.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')]);
  }
}

/** Remove superseded attempts from the turn's visible steps. */
export function visibleStepActivities(activities: AgentProgress[]): AgentProgress[] {
  const rows = activities.filter((activity) => !isTurnLifecycleActivity(activity) && !isHiddenToolActivity(activity));
  const superseded = new Set<number>();
  const outcomes = new Set<string>();
  let nextAction: AgentProgress | undefined;
  for (let index = rows.length - 1; index >= 0; index--) {
    const activity = rows[index];
    if (activity.type === 'thinking') continue;
    const key = retryKey(activity);
    if (activity.step?.status === 'failed') {
      // A rejected read without a target can only be matched to the next
      // document call. Never use an unrelated success to hide a known refusal.
      const missingTargetRetry = !key && !activity.step.warning
        && isDocumentReadTool(activity.tool) && isDocumentReadTool(nextAction?.tool)
        && Boolean(nextAction?.step?.status);
      if ((key && outcomes.has(key)) || missingTargetRetry) {
        superseded.add(index);
        if (missingTargetRetry || (nextAction && retryKey(nextAction) === key)) {
          for (let next = index + 1; rows[next]?.type === 'thinking'; next++) superseded.add(next);
        }
      }
    }
    if (key && activity.step?.status) outcomes.add(key);
    nextAction = activity;
  }

  const visible: AgentProgress[] = [];
  const folders = new Map<string, number>();
  for (const [index, activity] of rows.entries()) {
    if (superseded.has(index)) continue;
    const { step } = activity;
    if (step?.kind !== 'folder' || step.status !== 'completed') {
      visible.push(activity);
      continue;
    }
    const folder = (step.path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\.\//, '');
    const key = folder === '.' ? '' : folder;
    const previous = folders.get(key);
    if (previous !== undefined && !visible[previous].step?.listing?.length) {
      visible[previous] = activity;
    } else if (previous === undefined || step.listing?.length) {
      folders.set(key, visible.length);
      visible.push(activity);
    }
  }
  return visible;
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

/** Strip formatting before shortening a Thinking preview, including a link cut by an older runtime. */
export function thinkingText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]\n]+)\]\((?:[^()\n]|\([^()\n]*\))*(?:\)|$)/g, (_link, label: string) => {
      const text = label.replace(/%20/gi, ' ');
      return documentStepKind(text) ? basename(text) : text;
    })
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/(?<!\w)([*_])([^\n]+?)\1(?!\w)/g, '$2')
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function activityHeadline(activity?: AgentProgress): string {
  if (!activity || isHiddenToolActivity(activity)) return '';
  return activity.type === 'thinking' ? thinkingText(activity.message) : stepLabel(activity)?.label ?? activity.message;
}

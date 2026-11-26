import { documentStepKind, type ToolStep } from './toolStep';

/** App-server v2 commandActions and the legacy parsed_cmd use different list tags. */
interface CommandAction {
  type: 'read' | 'listFiles' | 'list_files' | 'search' | 'unknown';
  path?: string | null;
}

// Recognize only literal arguments of a single command. Shell expansions,
// redirects, compound commands and unsupported switches stay visible as shell steps.
function literalWords(command: string): string[] {
  if (/[\r\n;&|<>`$\\]/.test(command)) return [];
  const words = command.trim().match(/"[^"]*"|'[^']*'|[^\s"'*?\[\]{}~#]+/g) ?? [];
  if (words.join(' ') !== command.trim().replace(/("[^"]*"|'[^']*')|\s+/g, (_part, quoted) => quoted ?? ' ')) return [];
  return words.map((word) => word.replace(/^(['"])(.*)\1$/, '$2'));
}

function readOnlyTarget(command: string): { kind: 'folder' | 'read'; path?: string } | undefined {
  const words = literalWords(command);
  const shell = /^(?:\/bin\/)?(?:bash|zsh|sh)$/.test(words[0]);
  const [program, ...args] = shell && words.length === 3 && /^-l?c$/.test(words[1])
    ? literalWords(words[2]) : words;
  const operand = (value?: string): value is string => !!value && !value.startsWith('-');
  if (program === 'ls') {
    const paths = args.filter(operand);
    if (paths.length <= 1 && args.every((arg) => operand(arg) || /^-[aAlhR1]+$/.test(arg))) {
      return { kind: 'folder', path: paths[0] };
    }
  }
  if (program === 'find' && operand(args[0])) {
    const filters = args.slice(1);
    if (filters.length >= 2 && filters.length % 2 === 0 && filters.every((arg, i) =>
      i % 2 === 1 || (arg === '-type' && filters[i + 1] === 'f')
      || (arg === '-maxdepth' && /^\d+$/.test(filters[i + 1]))
      || (['-name', '-iname'].includes(arg) && operand(filters[i + 1])))) {
      return { kind: 'folder', path: args[0] };
    }
  }
  if (program === 'rg') {
    const paths: string[] = [];
    let files = false;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--files') files = true;
      else if (['-g', '--glob', '-t', '--type', '-T', '--type-not'].includes(arg) && operand(args[i + 1])) i++;
      else if (/^(?:-[inlSHs]+|--hidden|--no-ignore|--ignore-case|--fixed-strings)$/.test(arg)) continue;
      else if (operand(arg)) paths.push(arg);
      else return;
    }
    if (files ? paths.length <= 1 : paths.length >= 1 && paths.length <= 2) {
      return { kind: 'folder', path: paths[files ? 0 : 1] };
    }
  }
  if (program === 'grep') {
    const paths = args.filter(operand);
    if (paths.length === 2 && args.every((arg) => operand(arg) || /^-[rRinlF]+$/.test(arg))) {
      return { kind: 'folder', path: paths[1] };
    }
  }
  const file = program === 'cat' && args.length === 1 ? args[0]
    : ['head', 'tail'].includes(program) && args.length === 1 ? args[0]
    : ['head', 'tail'].includes(program) && args.length === 3 && args[0] === '-n' && /^\d+$/.test(args[1]) ? args[2]
    : program === 'sed' && args.length === 3 && args[0] === '-n' && /^\d+(?:,\d+)?p$/.test(args[1]) ? args[2]
    : program === 'textutil' && args.length === 4 && args[0] === '-convert' && args[1] === 'txt'
      && args.slice(2).includes('-stdout') ? args.slice(2).find(operand) : undefined;
  if (operand(file) && documentStepKind(file)) return { kind: 'read', path: file };
}

/** Shared by Codex and OpenCode. Parsed actions supply the target when available. */
export function commandStep(
  step: ToolStep,
  actions?: readonly CommandAction[],
  cwd?: string,
  workspace?: string,
): ToolStep {
  const target = readOnlyTarget(step.command ?? '');
  if (!target) return step;
  if ((actions?.length ?? 0) > 1) return step;
  const action = actions?.[0]?.type === 'unknown' ? undefined : actions?.[0];
  if (action && (target.kind === 'read' ? action.type !== 'read'
    : !['listFiles', 'list_files', 'search'].includes(action.type))) return step;

  const path = action?.path || target.path || '.';
  const slash = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
  const root = workspace && slash(workspace);
  const absolute = /^(?:[/\\]|[a-z]:)/i;
  const normalized = slash(cwd && !absolute.test(path) ? `${slash(cwd)}/${path}` : path)
    .replace(/^(?:\.\/)+/, '').replace(/\/\.(?=\/|$)/g, '') || '.';
  const projectPath = root && normalized === root ? '.'
    : root && normalized.startsWith(root + '/') ? normalized.slice(root.length + 1) : normalized;
  // Outside the project (an absolute path or one through ".."), a folder or a read keeps its honest command row:
  // a step's label never shows a path.
  if (/(?:^|[/\\])\.\.(?:[/\\]|$)|^(?:[/\\]|[a-z]:)/i.test(projectPath)) return step;
  if (target.kind === 'read' && !documentStepKind(projectPath)) return step;
  return { ...step, kind: target.kind, path: projectPath };
}

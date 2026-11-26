import { documentStepKind, type ToolStep } from './toolStep';

/** App-server v2 commandActions and the legacy parsed_cmd use different list tags. */
interface CommandAction {
  type: 'read' | 'listFiles' | 'list_files' | 'search' | 'unknown';
  path?: string | null;
}

// Tokenize literal words and the two supported separators. Any shell syntax
// outside this grammar leaves the original step visible.
function commandParts(command: string): string[][] | undefined {
  if (/[\r\n|`$<>]/.test(command)) return;
  // The shell argument may be several quoted pieces joined without a space: Codex
  // writes `"… \\) "'! -name …'`, single-quoting the `!` that double quotes would expand.
  const wrapper = /^(?:\/bin\/)?(?:bash|zsh|sh)\s+-l?c\s+((?:'[^']*'|"(?:[^"\\]|\\.)*")+)$/.exec(command.trim());
  if (wrapper) {
    command = [...wrapper[1].matchAll(/'([^']*)'|"((?:[^"\\]|\\.)*)"/g)]
      .map(([, single, double]) => single ?? double.replace(/\\([\\"])/g, '$1')).join('');
  }

  const token = /\s+|&&|;|"[^"\\]*"|'[^'\\]*'|\\[()]|[^\s"'*?\[\]{}~#\\();&]+/y;
  const parts: string[][] = [[]];
  let needsSpace = false;
  for (let i = 0; i < command.length; i = token.lastIndex) {
    token.lastIndex = i;
    const word = token.exec(command)?.[0];
    if (!word) return;
    if (/^\s/.test(word)) {
      needsSpace = false;
    } else if (word === ';' || word === '&&') {
      if (!parts[parts.length - 1].length) return;
      parts.push([]);
      needsSpace = false;
    } else {
      if (needsSpace) return;
      parts[parts.length - 1].push(word.replace(/^(['"])(.*)\1$/, '$2').replace(/^\\([()])$/, '$1'));
      needsSpace = true;
    }
  }
  if (parts[parts.length - 1].length) return parts;
}

const operand = (value?: string): value is string => !!value && !value.startsWith('-');
const absolute = /^(?:[/\\]|[a-z]:)/i;
const outside = /(?:^|[/\\])\.\.(?:[/\\]|$)|^(?:[/\\]|[a-z]:)/i;

function readOnlyFind(filters: string[]): boolean {
  let depth = 0;
  for (let i = 0; i < filters.length; i++) {
    const arg = filters[i];
    if (arg === '(') depth++;
    else if (arg === ')') {
      if (--depth < 0) return false;
    } else if (['-o', '-or', '-a', '-and', '!', '-not', '-prune', '-print', '-print0'].includes(arg)) {
      continue;
    } else if (['-name', '-iname', '-path', '-ipath'].includes(arg)) {
      if (!operand(filters[++i])) return false;
    } else if (arg === '-type') {
      if (!/^[fdl]$/.test(filters[++i])) return false;
    } else if (arg === '-maxdepth' || arg === '-mindepth') {
      if (!/^\d+$/.test(filters[++i])) return false;
    } else return false;
  }
  return depth === 0;
}

function readOnlyTarget([program, ...args]: string[]): { kind: 'folder' | 'read'; path?: string } | undefined {
  if (program === 'ls') {
    const paths = args.filter(operand);
    if (paths.length <= 1 && args.every((arg) => operand(arg) || /^-[aAlhR1]+$/.test(arg))) {
      return { kind: 'folder', path: paths[0] };
    }
  }
  if (program === 'find' && operand(args[0]) && !['(', ')', '!'].includes(args[0]) && !outside.test(args[0])
    && readOnlyFind(args.slice(1))) {
    return { kind: 'folder', path: args[0] };
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
  const parts = commandParts(step.command ?? '');
  if (!parts) return step;
  const slash = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
  const root = workspace && slash(workspace);
  const projectPathFor = (path: string) => {
    const normalized = slash(cwd && !absolute.test(path) ? `${slash(cwd)}/${path}` : path)
      .replace(/^(?:\.\/)+/, '').replace(/\/\.(?=\/|$)/g, '') || '.';
    return root && normalized === root ? '.'
      : root && normalized.startsWith(root + '/') ? normalized.slice(root.length + 1) : normalized;
  };

  if (parts.length > 1) {
    let folder = '.';
    let listsProject = false;
    for (const words of parts) {
      const target = readOnlyTarget(words);
      if (target?.kind !== 'folder' || outside.test(target.path ?? '.')) return step;
      const path = projectPathFor(target.path ?? '.');
      if (outside.test(path) || (path !== '.' && folder !== '.' && path !== folder)) return step;
      if (path === '.') listsProject = true;
      else folder = path;
    }
    return { ...step, kind: 'folder', path: listsProject ? '.' : folder };
  }

  const target = readOnlyTarget(parts[0]);
  if (!target || (actions?.length ?? 0) > 1) return step;
  const action = actions?.[0]?.type === 'unknown' ? undefined : actions?.[0];
  if (action && (target.kind === 'read' ? action.type !== 'read'
    : !['listFiles', 'list_files', 'search'].includes(action.type))) return step;

  const projectPath = projectPathFor(action?.path || target.path || '.');
  // Outside the project, a folder or a read keeps its command row.
  if (outside.test(projectPath)) return step;
  if (target.kind === 'read' && !documentStepKind(projectPath)) return step;
  return { ...step, kind: target.kind, path: projectPath };
}

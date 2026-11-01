/**
 * Sprint 148 (R1, A4): the folder walk, and what search leaves out.
 *
 * Documents are `.md`, `.markdown`, `.docx`, `.pdf` and `.csv` files in each
 * folder of the project. Left out:
 * - every file and folder whose name starts with a dot (`.ritemark`, `.claude`,
 *   `.git`, `.github` …) and `node_modules`;
 * - what the project's `.gitignore` files and `.git/info/exclude` ignore, through
 *   `ignore` (Git's own rules, whether or not Git is installed): each file's rules
 *   relative to its folder, a deeper file before a shallower one, and nothing
 *   inside an ignored folder;
 * - the person's `files.exclude` (Ritemark's defaults there leave out `.ritemark` and `.claude/worktrees` too);
 * - folders reached through a symbolic link;
 * - Office's lock files (`~$name.docx`);
 * - the root `CLAUDE.md` while it is only Ritemark's pointer line, as Documents hides it.
 *
 * A file kept only online is listed, never read (cloudFiles.ts); `.gitignore`
 * files and the pointer check obey the same rule.
 */
import ignore, { type Ignore } from 'ignore';
import * as nodePath from 'node:path';
import type { DocumentFormat } from '../protocol';
import { cloudState, inOneDriveFolder, type CloudState } from './cloudFiles';
import { documentName, formatOf } from './readers';

export interface WalkDirent {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface WalkStat {
  size: number;
  mtimeMs: number;
  blocks: number;
  isFile(): boolean;
  isDirectory(): boolean;
}

export interface WalkFs {
  readdir(dir: string): Promise<WalkDirent[]>;
  stat(target: string): Promise<WalkStat>;
  /** At most `maxBytes` from the start of the file. */
  readHead(target: string, maxBytes: number): Promise<Uint8Array>;
}

export interface WalkRoot {
  path: string;
  name: string;
}

export interface WalkRules {
  platform: string;
  oneDriveRoots: string[];
  /** `files.exclude` patterns that are on, per root path. */
  filesExclude: Record<string, string[]>;
}

export interface FoundDocument {
  path: string;
  rootPath: string;
  /** Relative to its root, with `/`. */
  relativePath: string;
  name: string;
  /** The folder's name; null at the project's root. */
  where: string | null;
  format: DocumentFormat;
  size: number;
  mtimeMs: number;
  cloud: CloudState;
}

export interface WalkResult {
  documents: FoundDocument[];
  /** Stopped at `maxNames`. */
  limited: boolean;
}

const POINTER = '@agents.md';
/** Patch 018 names the root AGENTS.md so. */
export const ABOUT_THIS_PROJECT = 'About this project';

// ── files.exclude ───────────────────────────────────────────────────────────

function escapeRegExp(text: string): string {
  return text.replace(/[.+^$()|\\]/g, '\\$&');
}

/** A VS Code glob as a regular expression over a root-relative path with `/`. */
export function globToRegExp(glob: string, ignoreCase = false): RegExp {
  let source = '';
  let i = 0;
  let braces = 0;
  const pattern = glob.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        const atStart = i === 0 || pattern[i - 1] === '/';
        const slashAfter = pattern[i + 2] === '/';
        if (atStart && slashAfter) {
          source += '(?:.*/)?';
          i += 3;
          continue;
        }
        source += '.*';
        i += 2;
        continue;
      }
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '{') {
      braces++;
      source += '(?:';
    } else if (char === '}' && braces > 0) {
      braces--;
      source += ')';
    } else if (char === ',' && braces > 0) {
      source += '|';
    } else if (char === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close < 0) source += '\\[';
      else {
        const body = pattern.slice(i + 1, close).replace(/^!/, '^').replace(/\\/g, '\\\\');
        source += `[${body}]`;
        i = close;
      }
    } else if (char === '/' && pattern.slice(i) === '/**') {
      source += '(?:/.*)?';
      i += 3;
      continue;
    } else {
      source += escapeRegExp(char);
    }
    i++;
  }
  while (braces-- > 0) source += ')';
  try {
    return new RegExp(`^${source}$`, ignoreCase ? 'i' : '');
  } catch {
    // A pattern VS Code's glob reads but a regular expression can't (a range like [z-a]): matched as written.
    const literal = pattern.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
    return new RegExp('^' + literal + '$', ignoreCase ? 'i' : '');
  }
}

// ── The rules for one project ───────────────────────────────────────────────

interface GitMatcher {
  /** The folder its rules are relative to: root-relative with `/`, '' at the root. */
  base: string;
  ig: Ignore;
}

function relativeTo(base: string, relative: string): string | null {
  if (base === '') return relative;
  return relative.startsWith(`${base}/`) ? relative.slice(base.length + 1) : null;
}

/** Everything search leaves out of one root, for the walk and for the watcher's events. */
export class RootRules {
  private readonly excludes: RegExp[];
  /** Shallow first; `.git/info/exclude` before the root's `.gitignore`. */
  readonly git = new Map<string, GitMatcher[]>();
  private readonly matchers: GitMatcher[] = [];

  constructor(
    readonly root: WalkRoot,
    patterns: readonly string[],
    readonly rules: WalkRules,
  ) {
    // Windows paths don't care about capitals; the Mac's and Linux's globs do, as VS Code's do.
    this.excludes = patterns.map((pattern) => globToRegExp(pattern, rules.platform === 'win32'));
  }

  addGitRules(base: string, text: string): void {
    const matcher = { base, ig: ignore({ allowRelativePaths: true }).add(text) };
    this.matchers.push(matcher);
    this.matchers.sort((a, b) => a.base.split('/').length - b.base.split('/').length);
  }

  /** Whether a root-relative path (with `/`) is left out. Its folders are checked too. */
  excluded(relative: string, isDirectory: boolean): boolean {
    const segments = relative.split('/');
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i];
      if (name.startsWith('.') || name === 'node_modules') return true;
      const prefix = segments.slice(0, i + 1).join('/');
      const dir = i < segments.length - 1 || isDirectory;
      if (this.excludes.some((pattern) => pattern.test(prefix))) return true;
      if (this.gitIgnored(prefix, dir)) return true;
    }
    return false;
  }

  /** Git's rules for one path: the deepest file with an opinion wins. */
  gitIgnored(relative: string, isDirectory: boolean): boolean {
    for (let i = this.matchers.length - 1; i >= 0; i--) {
      const matcher = this.matchers[i];
      const inside = relativeTo(matcher.base, relative);
      if (inside === null || inside === '') continue;
      const result = matcher.ig.test(isDirectory ? `${inside}/` : inside);
      if (result.ignored) return true;
      if (result.unignored) return false;
    }
    return false;
  }

  /** May this root's files be read at all (Windows, OneDrive: not until A4)? */
  get readable(): boolean {
    return !(this.rules.platform === 'win32' && inOneDriveFolder(this.root.path, this.rules.oneDriveRoots));
  }
}

function toRelative(rootPath: string, target: string): string {
  return nodePath.relative(rootPath, target).split(nodePath.sep).join('/');
}

const decoder = new TextDecoder();

async function readSmallText(fs: WalkFs, target: string, platform: string, oneDriveRoots: string[]): Promise<string | null> {
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile() || cloudState(target, stat, platform, oneDriveRoots)) return null;
    return decoder.decode(await fs.readHead(target, 256 * 1024));
  } catch {
    return null;
  }
}

/** Is this the root's pointer-only CLAUDE.md (its whole text `@AGENTS.md`, with an AGENTS.md beside it)? */
async function isPointer(fs: WalkFs, target: string, rules: WalkRules): Promise<boolean> {
  const text = await readSmallText(fs, target, rules.platform, rules.oneDriveRoots);
  return text !== null && text.replace(/^﻿/, '').trim().toLowerCase() === POINTER;
}

export function nameOf(fileName: string, relativePath: string): string {
  if (relativePath.toLowerCase() === 'agents.md') return ABOUT_THIS_PROJECT;
  return documentName(fileName);
}

/**
 * Walks every root. `pause` lets the worker answer queries between folders.
 * `rulesOut` receives each root's rules, kept for the watcher's events.
 */
export async function walkProject(
  roots: readonly WalkRoot[],
  rules: WalkRules,
  fs: WalkFs,
  maxNames: number,
  pause: () => Promise<void>,
  rulesOut?: Map<string, RootRules>,
): Promise<WalkResult> {
  const documents: FoundDocument[] = [];
  let limited = false;
  for (const root of roots) {
    const rootRules = new RootRules(root, rules.filesExclude[root.path] ?? [], rules);
    rulesOut?.set(root.path, rootRules);
    if (rootRules.readable) {
      const exclude = await readSmallText(fs, nodePath.join(root.path, '.git', 'info', 'exclude'), rules.platform, rules.oneDriveRoots);
      if (exclude) rootRules.addGitRules('', exclude);
    }
    const queue: string[] = [root.path];
    let visited = 0;
    while (queue.length > 0) {
      const dir = queue.shift()!;
      if (++visited % 50 === 0) await pause();
      let entries: WalkDirent[];
      try {
        entries = await fs.readdir(dir);
      } catch {
        continue;
      }
      const relativeDir = dir === root.path ? '' : toRelative(root.path, dir);
      const gitignore = entries.find((entry) => entry.name === '.gitignore' && entry.isFile());
      if (gitignore && rootRules.readable) {
        const text = await readSmallText(fs, nodePath.join(dir, '.gitignore'), rules.platform, rules.oneDriveRoots);
        if (text) rootRules.addGitRules(relativeDir, text);
      }
      const hasAgents = relativeDir === '' && entries.some((entry) => entry.name.toLowerCase() === 'agents.md');
      for (const entry of entries) {
        const name = entry.name;
        if (name.startsWith('.') || name === 'node_modules') continue;
        const target = nodePath.join(dir, name);
        const relative = relativeDir ? `${relativeDir}/${name}` : name;
        let isDirectory = entry.isDirectory();
        let isFile = entry.isFile();
        if (entry.isSymbolicLink()) {
          // A linked folder is left out; a linked file is a file.
          try {
            const stat = await fs.stat(target);
            isDirectory = false;
            isFile = stat.isFile();
          } catch {
            continue;
          }
        }
        if (isDirectory) {
          if (!rootRules.excluded(relative, true)) queue.push(target);
          continue;
        }
        if (!isFile || name.startsWith('~$')) continue;
        const format = formatOf(name);
        if (!format || rootRules.excluded(relative, false)) continue;
        if (hasAgents && name.toLowerCase() === 'claude.md' && (await isPointer(fs, target, rules))) continue;
        let stat: WalkStat;
        try {
          stat = await fs.stat(target);
        } catch {
          continue;
        }
        const cloud = rootRules.readable ? cloudState(target, stat, rules.platform, rules.oneDriveRoots) : 'cloud-folder';
        documents.push({
          path: target,
          rootPath: root.path,
          relativePath: relative,
          name: nameOf(name, relative),
          where: relativeDir ? nodePath.basename(dir) : null,
          format,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          cloud,
        });
        if (documents.length >= maxNames) {
          limited = true;
          break;
        }
      }
      if (limited) break;
    }
    if (limited) break;
  }
  return { documents, limited };
}

/** Checks one path from the watcher against its root's rules: its document, or null when search leaves it out. */
export async function classifyPath(
  target: string,
  rootRules: RootRules,
  fs: WalkFs,
): Promise<FoundDocument | null> {
  const relative = toRelative(rootRules.root.path, target);
  if (!relative || relative.startsWith('..')) return null;
  const name = nodePath.basename(target);
  const format = formatOf(name);
  if (!format || name.startsWith('~$') || rootRules.excluded(relative, false)) return null;
  let stat: WalkStat;
  try {
    stat = await fs.stat(target);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  const dir = nodePath.dirname(target);
  if (!relative.includes('/') && name.toLowerCase() === 'claude.md') {
    try {
      const siblings = await fs.readdir(dir);
      if (siblings.some((entry) => entry.name.toLowerCase() === 'agents.md') && (await isPointer(fs, target, rootRules.rules))) return null;
    } catch {
      return null;
    }
  }
  const { rules } = rootRules;
  return {
    path: target,
    rootPath: rootRules.root.path,
    relativePath: relative,
    name: nameOf(name, relative),
    where: relative.includes('/') ? nodePath.basename(dir) : null,
    format,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    cloud: rootRules.readable ? cloudState(target, stat, rules.platform, rules.oneDriveRoots) : 'cloud-folder',
  };
}

/** Is this path a `.gitignore` (or `.git/info/exclude`) of a root? Then the root is walked again (R4). */
export function isRuleFile(target: string, rootPath: string): boolean {
  const relative = toRelative(rootPath, target);
  if (!relative || relative.startsWith('..')) return false;
  return nodePath.basename(target) === '.gitignore' || relative === '.git/info/exclude';
}

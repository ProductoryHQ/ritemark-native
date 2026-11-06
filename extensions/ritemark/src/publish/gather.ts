/**
 * The gather: what goes up when a page is published (Sprint 149, R3, R4, W3).
 *
 * The page, and only the local files it uses, inside the project. Each reference is resolved as the browser resolves
 * it (against the page, its `<base href>`, or the stylesheet or module that makes it), then checked twice, as written
 * and by real path, so `..`, an absolute path, `file://`, a drive letter, a UNC path and a symlink that leave the
 * project are all **outside**. Never a path with a segment starting with `.`, nothing in `node_modules`, nothing Git
 * ignores (or can't answer for), no other page, and no file the page only links to (`<a href="notes.md">`: R3 sends
 * the files a page uses, not the documents it points to). Each is left out and named. Remote references stay where
 * they are.
 *
 * Linked stylesheets (and their `@import`s) and module scripts are followed; a file left out is never followed, so
 * nothing it names can come in through it. Every file that goes is hashed, and every text file is scanned for things
 * that look like keys (`secretScan.ts`).
 *
 * Pure but for the file system and Git, both injectable; no `vscode` import. `pagePath` and `projectFolder` are real
 * paths, as `localPage.locatePage` returns them for a project page.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isInside, isPagePath } from '../browser/localPage';
import { gitIgnored as defaultGitIgnored, GitIgnoredFn } from './gitIgnore';
import { cssReferences, moduleReferences, pageReferences, Reference, scriptBuildsReferences } from './references';
import { isText, scanText } from './secretScan';
import {
  FileKind,
  GatheredFile,
  GatheredPlan,
  KeyHit,
  LeftOut,
  LeftOutReason,
  MAX_FILE_BYTES,
  MAX_FILES,
  PublishPlan,
} from './types';

export interface GatherOptions {
  platform?: NodeJS.Platform;
  realpath?: (p: string) => Promise<string>;
  stat?: (p: string) => Promise<{ isFile(): boolean; size: number }>;
  readFile?: (p: string) => Promise<Buffer>;
  gitIgnored?: GitIgnoredFn;
}

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  '.png': 'picture', '.jpg': 'picture', '.jpeg': 'picture', '.gif': 'picture', '.webp': 'picture', '.avif': 'picture',
  '.svg': 'picture', '.ico': 'picture', '.bmp': 'picture', '.apng': 'picture', '.tif': 'picture', '.tiff': 'picture',
  '.css': 'style',
  '.js': 'script', '.mjs': 'script', '.cjs': 'script',
  '.woff': 'font', '.woff2': 'font', '.ttf': 'font', '.otf': 'font', '.eot': 'font',
};

export function kindOf(p: string): FileKind {
  if (isPagePath(p)) return 'page';
  return KIND_BY_EXTENSION[path.extname(p).toLowerCase()] ?? 'other';
}

/** A Windows drive path or a backslash UNC path, written as a reference: never a file of the project. */
const WINDOWS_ABSOLUTE = /^(?:[a-zA-Z]:[\\/]|\\\\)/;

type Resolved =
  | { kind: 'skip' }
  | { kind: 'outside'; display: string }
  | { kind: 'file'; fsPath: string };

/** A reference as the sheet names it: as written, with no query or fragment (a query may carry a token). */
function displayOf(value: string): string {
  const cut = value.split(/[?#]/)[0];
  let shown = cut;
  try {
    shown = decodeURIComponent(cut);
  } catch {
    // keep it as written
  }
  return shown.length > 80 ? `${shown.slice(0, 77)}…` : shown;
}

function resolveRef(value: string, base: URL, pagePath: string, platform: NodeJS.Platform): Resolved {
  if (!value || value.startsWith('#')) return { kind: 'skip' };
  if (WINDOWS_ABSOLUTE.test(value)) return { kind: 'outside', display: displayOf(value) };
  // `//cdn…` is a web address on the published page (protocol-relative): it stays where it is, as R3 says
  if (/^[\\/][\\/]/.test(value)) return { kind: 'skip' };
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return { kind: 'skip' };
  }
  if (url.protocol !== 'file:') return { kind: 'skip' }; // remote, data:, mailto:, javascript:… stay where they are
  // `file://server/…` is a UNC path: `fileURLToPath` refuses it off Windows, and on Windows the boundary check below
  // finds it outside the project
  url.search = '';
  url.hash = '';
  let fsPath: string;
  try {
    fsPath = fileURLToPath(url.href.replace(/^file:\/\/localhost\//i, 'file:///'));
  } catch {
    return { kind: 'outside', display: displayOf(value) };
  }
  const same = platform === 'win32' ? fsPath.toLowerCase() === pagePath.toLowerCase() : fsPath === pagePath;
  if (same) return { kind: 'skip' };
  return { kind: 'file', fsPath };
}

function segmentsOf(rel: string): string[] {
  return rel.split(/[\\/]+/).filter(Boolean);
}

function toSlash(p: string): string {
  return p.split(path.sep).join('/').replace(/\\/g, '/');
}

interface Pending {
  fsPath: string;
  realPath: string;
  size: number;
  as: Reference['as'];
  display: string;
}

/** The deepest folder that holds every path. */
function commonFolder(paths: string[], p: typeof path.posix | typeof path.win32): string {
  let common = p.dirname(paths[0]);
  for (const one of paths.slice(1)) {
    const dir = p.dirname(one);
    while (!isInside(dir, common, p === path.win32 ? 'win32' : 'darwin')) {
      const up = p.dirname(common);
      if (up === common) break;
      common = up;
    }
  }
  return common;
}

/** Every plan `gatherPage` made, by identity. A plan written by hand, or copied, is not among them. */
const gatheredPlans = new WeakSet<object>();

/** Whether a plan is one `gatherPage` made (and froze), so PR 4's upload can refuse anything else. */
export function isGatheredPlan(plan: unknown): plan is GatheredPlan {
  return typeof plan === 'object' && plan !== null && gatheredPlans.has(plan);
}

function frozenPlan(plan: PublishPlan): GatheredPlan {
  for (const list of [plan.files, plan.leftOut, plan.tooBig, plan.keyHits] as object[][]) {
    for (const item of list) Object.freeze(item);
    Object.freeze(list);
  }
  Object.freeze(plan);
  gatheredPlans.add(plan);
  return plan as GatheredPlan;
}

export async function gatherPage(pagePath: string, projectFolder: string, options: GatherOptions = {}): Promise<GatheredPlan> {
  const platform = options.platform ?? process.platform;
  const p = platform === 'win32' ? path.win32 : path.posix;
  const realpath = options.realpath ?? ((x: string) => fs.promises.realpath(x));
  const stat = options.stat ?? ((x: string) => fs.promises.stat(x));
  const readFile = options.readFile ?? ((x: string) => fs.promises.readFile(x));
  const gitIgnoredFn = options.gitIgnored ?? defaultGitIgnored;
  const key = (x: string) => (platform === 'win32' ? x.toLowerCase() : x);

  const pageBytes = await readFile(pagePath);
  const pageText = pageBytes.toString('utf8');
  const page = pageReferences(pageText);
  const pageUrl = pathToFileURL(pagePath);
  let base: URL = pageUrl;
  if (page.base) {
    try {
      base = new URL(page.base, pageUrl);
    } catch {
      // an unreadable <base> changes nothing, as in a browser
    }
  }

  const accepted: Pending[] = [];
  const seen = new Set<string>([key(pagePath)]);
  const leftOut: LeftOut[] = [];
  const leftOutSeen = new Set<string>();
  const addLeftOut = (display: string, reason: LeftOutReason) => {
    const k = `${reason}\0${key(display)}`;
    if (leftOutSeen.has(k)) return;
    leftOutSeen.add(k);
    leftOut.push({ display, reason });
  };
  let scriptBuilt = page.builtAttribute || page.inlineScripts.some(scriptBuildsReferences);
  /**
   * Files the page only links to, named after the walk unless the page also uses them (`<a href="a.png">` beside
   * `<img src="a.png">` sends the picture). A link never marks a file seen, so it can't keep a used file back.
   */
  const linked: { lexical: string; real: string; display: string }[] = [];
  const linkedSeen = new Set<string>();

  // The first level: the page's own references, against its base (a stylesheet's and a module's resolve against
  // their own file).
  let level: { ref: Reference; base: URL }[] = [
    ...page.refs.map((ref) => ({ ref, base })),
    ...page.inlineCss.flatMap((css) => cssReferences(css)).map((ref) => ({ ref, base })),
    ...page.inlineModules.flatMap((js) => moduleReferences(js)).map((ref) => ({ ref, base })),
  ];

  while (level.length > 0 && accepted.length <= MAX_FILES) {
    const candidates: Pending[] = [];
    for (const { ref, base: from } of level) {
      const resolved = resolveRef(ref.value, from, pagePath, platform);
      if (resolved.kind === 'skip') continue;
      if (resolved.kind === 'outside') {
        addLeftOut(resolved.display, 'outside');
        continue;
      }
      const lexical = resolved.fsPath;
      const isLink = ref.as === 'link';
      if (seen.has(key(lexical))) continue;
      if (!isLink) seen.add(key(lexical));
      if (!isInside(lexical, projectFolder, platform)) {
        addLeftOut(displayOf(ref.value), 'outside');
        continue;
      }
      let real: string;
      let info: { isFile(): boolean; size: number };
      try {
        real = await realpath(lexical);
        info = await stat(real);
      } catch {
        continue; // missing: nothing to send, and nothing to name
      }
      if (!info.isFile()) continue;
      if (!isInside(real, projectFolder, platform)) {
        addLeftOut(displayOf(ref.value), 'outside');
        continue;
      }
      const relLexical = p.relative(projectFolder, lexical);
      const relReal = p.relative(projectFolder, real);
      const shown = toSlash(relLexical);
      const segments = [...segmentsOf(relLexical), ...segmentsOf(relReal)];
      if (segments.some((s) => s.startsWith('.'))) {
        addLeftOut(shown, 'hidden');
        continue;
      }
      if (segments.some((s) => s.toLowerCase() === 'node_modules')) {
        addLeftOut(shown, 'toolFolder');
        continue;
      }
      if (isPagePath(lexical) || isPagePath(real)) {
        addLeftOut(shown, 'otherPage');
        continue;
      }
      if (isLink) {
        if (!linkedSeen.has(key(lexical))) {
          linkedSeen.add(key(lexical));
          linked.push({ lexical, real, display: shown });
        }
        continue;
      }
      candidates.push({ fsPath: lexical, realPath: real, size: info.size, as: ref.as, display: shown });
    }

    // Git decides for the whole level at once, before anything in it is followed
    let ignored = new Set<string>();
    let unchecked = new Set<string>();
    if (candidates.length > 0) {
      // Both paths: a name the page uses can be a symlink to a file Git ignores, or the other way round
      const asked = [...new Set(candidates.flatMap((c) => [c.fsPath, c.realPath]))];
      const answer = await gitIgnoredFn(projectFolder, asked);
      ignored = new Set([...answer.ignored].map(key));
      unchecked = new Set([...answer.unchecked].map(key));
    }
    const next: { ref: Reference; base: URL }[] = [];
    for (const c of candidates) {
      if (ignored.has(key(c.fsPath)) || ignored.has(key(c.realPath))) {
        addLeftOut(c.display, 'gitIgnored');
        continue;
      }
      if (unchecked.has(key(c.fsPath)) || unchecked.has(key(c.realPath))) {
        addLeftOut(c.display, 'gitUnchecked');
        continue;
      }
      accepted.push(c);
      if (c.size > MAX_FILE_BYTES) continue;
      const ext = p.extname(c.fsPath).toLowerCase();
      const fileBase = pathToFileURL(c.fsPath);
      const isStyle = c.as === 'style' || ext === '.css';
      if (!isStyle && c.as !== 'module' && ext !== '.mjs') continue;
      // a file that grew past the limit since its stat goes as too big (below) and is not followed
      const bytes = await readFile(c.realPath);
      if (bytes.length > MAX_FILE_BYTES) continue;
      const text = bytes.toString('utf8');
      for (const ref of isStyle ? cssReferences(text) : moduleReferences(text)) next.push({ ref, base: fileBase });
    }
    level = next;
  }

  // Links to files the page doesn't also use: named, never sent
  const acceptedKeys = new Set(accepted.flatMap((c) => [key(c.fsPath), key(c.realPath)]));
  for (const l of linked) {
    if (!acceptedKeys.has(key(l.lexical)) && !acceptedKeys.has(key(l.real))) addLeftOut(l.display, 'link');
  }

  // Sizes, hashes and the key scan, over the page and every file that goes
  const pageReal = pagePath;
  const all: { lexical: string; real: string; size: number }[] = [
    { lexical: pagePath, real: pageReal, size: pageBytes.length },
    ...accepted.map((c) => ({ lexical: c.fsPath, real: c.realPath, size: c.size })),
  ];
  const root = commonFolder(all.map((f) => f.lexical), p);
  const files: GatheredFile[] = [];
  const tooBig: PublishPlan['tooBig'] = [];
  const keyHits: KeyHit[] = [];
  for (const f of all) {
    const projectPath = toSlash(p.relative(projectFolder, f.lexical));
    const file: GatheredFile = {
      relPath: toSlash(p.relative(root, f.lexical)),
      projectPath,
      realPath: f.real,
      kind: f.real === pageReal && f.lexical === pagePath ? 'page' : kindOf(f.lexical),
      size: f.size,
    };
    if (f.size > MAX_FILE_BYTES) {
      tooBig.push({ projectPath, size: f.size });
      files.push(file);
      continue;
    }
    const bytes = f.lexical === pagePath ? pageBytes : await readFile(f.real);
    file.size = bytes.length;
    // A file can grow between its stat and this read: the limit holds for the bytes read, which are what would go
    if (bytes.length > MAX_FILE_BYTES) {
      tooBig.push({ projectPath, size: bytes.length });
      files.push(file);
      continue;
    }
    file.sha256 = createHash('sha256').update(bytes).digest('hex');
    if (isText(bytes)) {
      const text = bytes.toString('utf8');
      for (const hit of scanText(text)) {
        keyHits.push({ projectPath, realPath: f.real, line: hit.line, column: hit.column, endColumn: hit.endColumn, rule: hit.rule });
      }
      if (file.kind === 'script' && scriptBuildsReferences(text)) scriptBuilt = true;
    }
    files.push(file);
  }

  // Frozen and remembered: what the sheet showed is exactly what the upload reads (PR 4)
  return frozenPlan({
    pagePath,
    projectFolder,
    root,
    files,
    leftOut,
    scriptBuilt,
    tooBig,
    tooMany: files.length > MAX_FILES,
    keyHits,
    contentHash: contentHashOf(files),
  });
}

/** sha256 over each file's published path and hash, sorted: equal exactly when the same bytes go to the same places. */
export function contentHashOf(files: readonly Pick<GatheredFile, 'relPath' | 'sha256'>[]): string {
  const lines = files.map((f) => `${f.relPath}\0${f.sha256 ?? ''}`).sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

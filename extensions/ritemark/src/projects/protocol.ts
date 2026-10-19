/**
 * Home's and the projects list's protocol (Sprint 134, E2): the typed boundary
 * between their pages (`webview/src/components/home/`) and the extension host.
 *
 * `decodeHomeRequest` and `decodeProjectsRequest` are the only places webview
 * JSON becomes a request: every field is checked and unknown fields are
 * refused, as the welcome's and the task board's protocols do. Names, titles
 * and paths travel as text and are drawn as text (R4). No `vscode` import: the
 * webview imports the types.
 */

export type HomePlatform = 'darwin' | 'win32' | 'linux';
export type AiName = 'Claude' | 'ChatGPT' | 'OpenCode';

export type HomeWaitingKind = 'needs-you' | 'decision' | 'review' | 'failed' | 'approval' | 'question' | 'plan-review' | 'reply';

export interface HomeWaitingItem {
  /** Opaque: the host maps it back to a card or a chat. */
  id: string;
  source: 'card' | 'chat';
  kind: HomeWaitingKind;
  /** The card's or the chat's title, drawn as text. */
  title: string;
  /** What the AI asks, when it is known (a chat's question), drawn as text. */
  detail: string | null;
  /** The AI a chat runs with, for "Claude asks…". */
  ai: AiName | null;
  /** When it started waiting (ISO). */
  since: string;
}

export type RecentKind = 'markdown' | 'pdf' | 'word' | 'sheet' | 'slides' | 'drawing' | 'flow' | 'other';

export interface HomeRecentItem {
  id: string;
  /** The file's name without its extension, or "About this project" for the project's AGENTS.md. */
  name: string;
  /** ".md", drawn muted; empty for About this project. */
  extension: string;
  /** The folder it is in, inside the project ("Modules"); null at the top. */
  folder: string | null;
  kind: RecentKind;
  about: boolean;
  /** When it last changed (ISO). */
  changedAt: string;
}

export interface HomeProject {
  name: string;
  mark: string;
  /** The folder as a person reads it: "~/Documents/Leadership programme", "Documents\\…". */
  place: string;
  line: string;
  /** A webview URI for the cover, or null for Ritemark's own. */
  coverUrl: string | null;
}

export interface HomeState {
  platform: HomePlatform;
  project: HomeProject;
  /** Undefined count: something couldn't be read, so no number is shown. */
  waiting: { count: number | null; items: HomeWaitingItem[] };
  /** Other projects with something waiting, in the list's order; null when unknown. */
  others: { name: string; count: number }[] | null;
  /** Null until the first look at the project's files has finished. */
  recent: HomeRecentItem[] | null;
  /** No documents at all: experience 29, frame 1. */
  empty: boolean;
  boardEnabled: boolean;
  /** Experience 32, frame 5: shown once on a profile updated from Ritemark 1. */
  whatMoved: boolean;
  /** "Switched to … Go back": the project this window came from. */
  switchedFrom: { name: string } | null;
  /** A project of the list whose folder is not found, chosen from the list (experience 33). */
  missing: { id: string; name: string; mark: string; place: string } | null;
  /** One line at the top: a file that can't be read, a change that couldn't be saved. */
  notice: string | null;
}

/** Host → Home. */
export type HomeMessage = { type: 'home/state'; state: HomeState };

export type StartKind = 'text' | 'table' | 'web';

/** Home → host. */
export type HomeRequest =
  | { type: 'home/ready' }
  | { type: 'home/open-documents' }
  | { type: 'home/set-line'; line: string }
  | { type: 'home/change-cover' }
  | { type: 'home/open-waiting'; id: string }
  | { type: 'home/start'; kind: StartKind }
  | { type: 'home/open-recent'; id: string }
  | { type: 'home/what-moved-seen' }
  | { type: 'home/go-back' }
  | { type: 'home/dismiss-switched' }
  | { type: 'home/find-missing'; id: string }
  | { type: 'home/remove-missing'; id: string }
  | { type: 'home/dismiss-missing' }
  | { type: 'home/add-files' }
  | { type: 'home/drop-files'; uris: string[] }
  | { type: 'home/dismiss-notice' };

export interface ProjectRow {
  id: string;
  name: string;
  mark: string;
  /** What waits in it; null when unknown, 0 when nothing does. */
  count: number | null;
  open: boolean;
  missing: boolean;
  /** Where it lives, for the row's tooltip (the old path when not found). */
  place: string;
}

export interface ProjectsState {
  platform: HomePlatform;
  projects: ProjectRow[];
}

/** Host → the projects list. */
export type ProjectsMessage = { type: 'projects/state'; state: ProjectsState };

/** The projects list → host. */
export type ProjectsRequest =
  | { type: 'projects/ready' }
  | { type: 'projects/open'; id: string; newWindow: boolean }
  | { type: 'projects/remove'; id: string }
  | { type: 'projects/reveal'; id: string }
  | { type: 'projects/open-folder' }
  | { type: 'projects/new-project' };

export type Decoded<T> = { ok: true; request: T } | { ok: false; reason: string };

const MAX_TEXT = 4096;
const MAX_URIS = 200;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(message: Record<string, unknown>, allowed: readonly string[]): string | null {
  for (const key of Object.keys(message)) {
    if (!allowed.includes(key)) return `unexpected field "${key}"`;
  }
  for (const key of allowed) {
    if (!(key in message)) return `missing field "${key}"`;
  }
  return null;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_TEXT;
const isId = (value: unknown): value is string => typeof value === 'string' && /^[a-z]+:[A-Za-z0-9_-]{1,128}$/.test(value);

export function decodeHomeRequest(raw: unknown): Decoded<HomeRequest> {
  if (!isObject(raw) || typeof raw.type !== 'string') return { ok: false, reason: 'not a Home request' };
  const fail = (reason: string): Decoded<HomeRequest> => ({ ok: false, reason: `${String(raw.type)}: ${reason}` });
  const check = (keys: readonly string[]): string | null => exactKeys(raw, ['type', ...keys]);
  let problem: string | null;
  switch (raw.type) {
    case 'home/ready':
    case 'home/open-documents':
    case 'home/change-cover':
    case 'home/what-moved-seen':
    case 'home/go-back':
    case 'home/dismiss-switched':
    case 'home/dismiss-missing':
    case 'home/add-files':
    case 'home/dismiss-notice':
      problem = check([]);
      return problem ? fail(problem) : { ok: true, request: { type: raw.type } };
    case 'home/set-line':
      problem = check(['line']);
      if (problem) return fail(problem);
      if (!isText(raw.line)) return fail('line must be text');
      return { ok: true, request: { type: 'home/set-line', line: raw.line } };
    case 'home/open-waiting':
    case 'home/open-recent':
    case 'home/find-missing':
    case 'home/remove-missing':
      problem = check(['id']);
      if (problem) return fail(problem);
      if (!isId(raw.id)) return fail('id is not one Home sent');
      return { ok: true, request: { type: raw.type, id: raw.id } };
    case 'home/start':
      problem = check(['kind']);
      if (problem) return fail(problem);
      if (raw.kind !== 'text' && raw.kind !== 'table' && raw.kind !== 'web') return fail('kind must be text, table or web');
      return { ok: true, request: { type: 'home/start', kind: raw.kind } };
    case 'home/drop-files': {
      problem = check(['uris']);
      if (problem) return fail(problem);
      if (!Array.isArray(raw.uris) || raw.uris.length === 0 || raw.uris.length > MAX_URIS) return fail(`uris must hold 1 to ${MAX_URIS} addresses`);
      if (!raw.uris.every((uri) => isText(uri) && uri.startsWith('file:'))) return fail('uris must be file addresses');
      return { ok: true, request: { type: 'home/drop-files', uris: raw.uris as string[] } };
    }
    default:
      return fail('unknown type');
  }
}

export function decodeProjectsRequest(raw: unknown): Decoded<ProjectsRequest> {
  if (!isObject(raw) || typeof raw.type !== 'string') return { ok: false, reason: 'not a projects request' };
  const fail = (reason: string): Decoded<ProjectsRequest> => ({ ok: false, reason: `${String(raw.type)}: ${reason}` });
  const check = (keys: readonly string[]): string | null => exactKeys(raw, ['type', ...keys]);
  let problem: string | null;
  switch (raw.type) {
    case 'projects/ready':
    case 'projects/open-folder':
    case 'projects/new-project':
      problem = check([]);
      return problem ? fail(problem) : { ok: true, request: { type: raw.type } };
    case 'projects/open':
      problem = check(['id', 'newWindow']);
      if (problem) return fail(problem);
      if (!isId(raw.id)) return fail('id is not one the list sent');
      if (typeof raw.newWindow !== 'boolean') return fail('newWindow must be true or false');
      return { ok: true, request: { type: 'projects/open', id: raw.id, newWindow: raw.newWindow } };
    case 'projects/remove':
    case 'projects/reveal':
      problem = check(['id']);
      if (problem) return fail(problem);
      if (!isId(raw.id)) return fail('id is not one the list sent');
      return { ok: true, request: { type: raw.type, id: raw.id } };
    default:
      return fail('unknown type');
  }
}

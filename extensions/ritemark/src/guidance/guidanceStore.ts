/**
 * Sprint 140 (E2): what the first day's guidance remembers, in one key of this
 * computer's global state, `ritemark.guidance.v1`. Nothing is ever written in a
 * project's folder, so "Nothing in this folder was moved or changed" stays true.
 *
 * The Memento keeps ready requests, saved days, and the old week question.
 * Its separate AI and ready-card count keys still share one value that a
 * different window can overwrite. Home presentations and Star live in the
 * home-presentations folder in extension global storage.
 * No `vscode` import: it takes a Memento-shaped store.
 */

import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { AgentId } from '../agent/types';
import { testChannelRequested } from '../analytics/consent';
import { localDay, releaseOf, withSavedDay, SAVED_DAYS_FOR_FEEDBACK } from './guidanceState';
import type { ReadyGone, ReadyRecord } from './readyRequest';

export const GUIDANCE_KEY = 'ritemark.guidance.v1';

export interface MementoLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

export interface GuidanceStateV1 {
  v: 1;
  projects: Record<string, ReadyRecord>;
  readyShownOn?: string;
  savedDays: string[];
  positiveReaction?: true;
  /** null means an earlier build already ran on this profile. */
  firstAppRun?: string | null;
  release?: { id: string; savedDays: string[]; feedback?: 'sent' | 'not-now' };
}

interface HomePresentation {
  day: string;
  appRun: string;
  dismissed?: true;
}

const AGENTS: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];
const GONE: readonly ReadyGone[] = ['answered', 'chat', 'hidden'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isDay = (value: unknown): value is string => typeof value === 'string' && DAY.test(value);
const daysOf = (value: unknown): string[] => Array.isArray(value) ? value.filter(isDay) : [];

function decodeHomeHistory(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const { presentations, starred } = value as Record<string, unknown>;
  const history: Array<HomePresentation & { releaseId: string }> = [];
  if (Array.isArray(presentations)) {
    for (const entry of presentations) {
      if (entry && typeof entry.releaseId === 'string' && isDay(entry.day)) {
        history.push({ releaseId: entry.releaseId, day: entry.day, appRun: '', ...(entry.dismissed === true ? { dismissed: true } : {}) });
      }
    }
  }
  return { presentations: history, ...(starred === true ? { starred: true } : {}) };
}

/** A stored value read defensively: anything malformed is dropped, never trusted. */
export function decodeGuidanceState(raw: unknown): GuidanceStateV1 {
  const empty: GuidanceStateV1 = { v: 1, projects: {}, savedDays: [] };
  if (!raw || typeof raw !== 'object') return empty;
  const value = raw as Record<string, unknown>;
  const projects: Record<string, ReadyRecord> = {};
  if (value.projects && typeof value.projects === 'object') {
    for (const [uri, entry] of Object.entries(value.projects as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      projects[uri] = {
        ...(GONE.includes(record.gone as ReadyGone) ? { gone: record.gone as ReadyGone } : {}),
        ...(typeof record.chatId === 'string' && record.chatId.length <= 128 ? { chatId: record.chatId } : {}),
        ...(AGENTS.includes(record.ai as AgentId) ? { ai: record.ai as AgentId } : {}),
      };
    }
  }
  const release = value.release as Record<string, unknown> | undefined;
  return {
    v: 1,
    projects,
    savedDays: [...new Set(daysOf(value.savedDays ?? release?.savedDays))].sort().slice(-SAVED_DAYS_FOR_FEEDBACK),
    ...(value.positiveReaction === true ? { positiveReaction: true } : {}),
    ...(typeof value.firstAppRun === 'string' || value.firstAppRun === null ? { firstAppRun: value.firstAppRun } : {}),
    ...(typeof value.readyShownOn === 'string' && DAY.test(value.readyShownOn) ? { readyShownOn: value.readyShownOn } : {}),
    ...(release && typeof release.id === 'string'
      ? {
          release: {
            id: release.id,
            savedDays: daysOf(release.savedDays),
            ...(release.feedback === 'sent' || release.feedback === 'not-now' ? { feedback: release.feedback } : {}),
          },
        }
      : {}),
  };
}

export interface HomeEligibility {
  day: string;
  appRun: string;
  whatMoved?: boolean;
  readyRequest?: boolean;
}

const RELEASE_MARKER = /^(?:\d(?:[\da-z.+-]{0,126}[\da-z])?|release-[a-f0-9]{64})$/;

function markerName(release: string): string {
  return RELEASE_MARKER.test(release) ? release : `release-${createHash('sha256').update(release).digest('hex')}`;
}

function hasCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException)?.code === code;
}

async function readPresentation(file: string): Promise<HomePresentation | undefined> {
  const stat = await fs.stat(file).catch((error) => {
    if (hasCode(error, 'ENOENT')) return undefined;
    throw error;
  });
  if (!stat?.isFile()) return undefined;
  try {
    const entry = JSON.parse(await fs.readFile(file, 'utf8'));
    if (isDay(entry?.day) && typeof entry.appRun === 'string') {
      return { day: entry.day, appRun: entry.appRun, ...(entry.dismissed === true ? { dismissed: true } : {}) };
    }
  } catch {
    // The exclusive create itself consumes the presentation.
  }
  return { day: localDay(stat.mtime), appRun: '' };
}

async function replacePresentation(file: string, entry: HomePresentation): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(entry), { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

// Orders read-modify-write for stores sharing one Memento.
const pendingWrites = new WeakMap<MementoLike, Promise<unknown>>();

export class GuidanceStore {
  private readonly homeFolder?: string;
  private readonly legacyHome;
  private homeMigration?: Promise<void>;

  constructor(
    private readonly memento: MementoLike,
    readonly version: string,
    private readonly appRelease = version,
    globalStoragePath?: string,
  ) {
    this.homeFolder = globalStoragePath && join(globalStoragePath, 'home-presentations');
    this.legacyHome = decodeHomeHistory(memento.get<{ home?: unknown }>(GUIDANCE_KEY)?.home);
  }

  read(): GuidanceStateV1 {
    return decodeGuidanceState(this.memento.get(GUIDANCE_KEY));
  }

  private serialize<T>(operation: (state: GuidanceStateV1) => Promise<T>): Promise<T> {
    const result = (pendingWrites.get(this.memento) ?? Promise.resolve()).then(async () => {
      await this.migrateHome();
      return operation(this.read());
    });
    pendingWrites.set(this.memento, result.catch(() => undefined));
    return result;
  }

  private async change(update: (state: GuidanceStateV1) => GuidanceStateV1): Promise<void> {
    await this.serialize(async (state) => {
      const next = update(state);
      if (next !== state) await this.memento.update(GUIDANCE_KEY, next);
    });
  }

  /** The existing week question's per-release view. */
  release(state = this.read()): NonNullable<GuidanceStateV1['release']> {
    const id = releaseOf(this.version);
    return state.release?.id === id ? state.release : { id, savedDays: [] };
  }

  project(folderUri: string): ReadyRecord {
    return this.read().projects[folderUri] ?? {};
  }

  async updateProject(folderUri: string, change: (record: ReadyRecord) => ReadyRecord): Promise<ReadyRecord> {
    return this.serialize(async (state) => {
      const next = change(state.projects[folderUri] ?? {});
      await this.memento.update(GUIDANCE_KEY, { ...state, projects: { ...state.projects, [folderUri]: next } });
      return next;
    });
  }

  noteReadyShown(day: string): Promise<void> {
    return this.change((state) => state.readyShownOn === day ? state : { ...state, readyShownOn: day });
  }

  noteDocumentSaved(scheme: string, at: Date, hasProjectGuidance: boolean): Promise<void> {
    return scheme === 'file' && hasProjectGuidance ? this.noteSavedDay(localDay(at)) : Promise.resolve();
  }

  noteSavedDay(day: string): Promise<void> {
    if (!isDay(day)) return Promise.resolve();
    return this.change((state) => {
      const savedDays = state.savedDays.length >= SAVED_DAYS_FOR_FEEDBACK || state.savedDays.includes(day)
        ? state.savedDays : withSavedDay(state.savedDays, day);
      const release = this.release(state);
      if (!release.savedDays.includes(day) && release.savedDays.length < SAVED_DAYS_FOR_FEEDBACK) {
        return { ...state, savedDays, release: { ...release, savedDays: withSavedDay(release.savedDays, day) } };
      }
      return savedDays === state.savedDays ? state : { ...state, savedDays };
    });
  }

  answerFeedback(answer: 'sent' | 'not-now'): Promise<void> {
    return this.change((state) => ({ ...state, release: { ...this.release(state), feedback: answer } }));
  }

  initializeAppRun(appRun: string | undefined, previouslyActivated: boolean): Promise<void> {
    return this.change((state) => {
      if (state.firstAppRun === undefined) return { ...state, firstAppRun: previouslyActivated ? null : appRun ?? '' };
      if (state.firstAppRun !== null && appRun && state.firstAppRun !== appRun) return { ...state, firstAppRun: null };
      return state;
    });
  }

  private migrateHome(): Promise<void> | undefined {
    const folder = this.homeFolder;
    const history = this.legacyHome;
    if (!folder || !history) return;
    return this.homeMigration ??= (async () => {
      await fs.mkdir(folder, { recursive: true });
      for (const { releaseId, ...entry } of history.presentations) {
        const file = join(folder, markerName(releaseId));
        try {
          await fs.writeFile(file, JSON.stringify(entry), { flag: 'wx' });
        } catch (error) {
          if (!hasCode(error, 'EEXIST')) throw error;
          // Older builds created empty markers alongside their Memento entries.
          if ((await fs.stat(file)).size === 0) await replacePresentation(file, entry);
        }
      }
      if (history.starred) await this.writeStar(folder);
    })().catch((error) => {
      this.homeMigration = undefined;
      throw error;
    });
  }

  private async writeStar(folder: string): Promise<void> {
    await fs.writeFile(join(folder, 'starred'), '', { flag: 'wx' }).catch((error) => {
      if (!hasCode(error, 'EEXIST')) throw error;
    });
  }

  async homeEligible(input: HomeEligibility): Promise<boolean> {
    await this.migrateHome();
    const state = this.read();
    if (!input.appRun || state.firstAppRun === undefined || state.firstAppRun === input.appRun) return false;
    if (input.whatMoved || (input.readyRequest && state.readyShownOn === input.day)) return false;
    if (!state.positiveReaction && state.savedDays.length < SAVED_DAYS_FOR_FEEDBACK) return false;

    const folder = this.homeFolder;
    if (!folder) return true;
    const files = await fs.readdir(folder).catch((error): string[] => {
      if (hasCode(error, 'ENOENT')) return [];
      throw error;
    });
    if (files.includes('starred') || files.includes(markerName(this.appRelease))) return false;
    // The previous calendar year's matching day has aged out of the allowance.
    const cutoff = `${Number(input.day.slice(0, 4)) - 1}${input.day.slice(4)}`;
    const history = await Promise.all(files.filter((file) => RELEASE_MARKER.test(file))
      .map((file) => readPresentation(join(folder, file))));
    return history.filter((entry) => entry && entry.day > cutoff && entry.day <= input.day).length < 3;
  }

  async openHomePresentation(appRun: string): Promise<HomePresentation | undefined> {
    await this.migrateHome();
    if (!this.homeFolder || !appRun) return undefined;
    const entry = await readPresentation(join(this.homeFolder, markerName(this.appRelease)));
    return entry?.appRun === appRun && !entry.dismissed ? entry : undefined;
  }

  async reserveHomePresentation(input: HomeEligibility): Promise<boolean> {
    let createdFile: string | undefined;
    try {
      if (!await this.homeEligible(input)) return false;
      if (!this.homeFolder) throw new Error('Global storage path is unavailable');
      await fs.mkdir(this.homeFolder, { recursive: true });
      const file = join(this.homeFolder, markerName(this.appRelease));
      const marker = await fs.open(file, 'wx').catch((error) => {
        if (!hasCode(error, 'EEXIST')) throw error;
      });
      if (!marker) return false;
      createdFile = file;
      try {
        await marker.writeFile(JSON.stringify({ day: input.day, appRun: input.appRun }));
      } finally {
        await marker.close();
      }
      return true;
    } catch (error) {
      console.warn('Ritemark: Could not reserve a Home presentation', error);
      return createdFile ? await fs.stat(createdFile).then((stat) => stat.isFile(), () => false) : false;
    }
  }

  /** Call only for Not now or an accepted Star handoff. */
  async endHomePresentation(action: 'dismiss' | 'star'): Promise<void> {
    const folder = this.homeFolder;
    if (!folder) return;
    await this.migrateHome();
    if (action === 'star') {
      await fs.mkdir(folder, { recursive: true });
      await this.writeStar(folder);
      return;
    }
    const file = join(folder, markerName(this.appRelease));
    const entry = await readPresentation(file);
    if (entry && !entry.dismissed) await replacePresentation(file, { ...entry, dismissed: true });
  }
}

// ── The AI last seen ready (Sprint 156; experience 35, "With no AI ready") ──

export const LAST_READY_AI_KEY = 'ritemark.guidance.lastReadyAi';

/**
 * A test launch's stand-in for the AI last seen ready, so a lapsed Claude can be staged for screenshots (the
 * Experience lead's approval, #690). Read only in the test channel (`RITEMARK_BUILD_CHANNEL=test`, as #681's test keys
 * in `ai/providerKeys.ts`); in every other channel it is never read.
 */
export const TEST_LAST_READY_AI_ENV = 'RITEMARK_TEST_LAST_READY_AI';

const isAgentId = (value: unknown): value is AgentId => AGENTS.includes(value as AgentId);

/** The AI last seen ready; anything else stored is ignored. */
export function readLastReadyAi(memento: MementoLike): AgentId | undefined {
  const value = memento.get<unknown>(LAST_READY_AI_KEY);
  return isAgentId(value) ? value : undefined;
}

/** An AI was seen usable (the status bar's AI, a sign-in from Home, the welcome): remember it, writing only a change. */
export async function noteLastReadyAi(memento: MementoLike, ai: AgentId): Promise<void> {
  if (readLastReadyAi(memento) === ai) return;
  await memento.update(LAST_READY_AI_KEY, ai);
}

/**
 * A sign-out pressed in Ritemark succeeded: forget the AI last seen ready, only when it is the one signed out. Any
 * other sign-out (in a terminal, a token that ended) counts as lapsed, because Ritemark can't tell them apart.
 */
export async function clearLastReadyAi(memento: MementoLike, signedOut: AgentId): Promise<boolean> {
  if (readLastReadyAi(memento) !== signedOut) return false;
  await memento.update(LAST_READY_AI_KEY, undefined);
  return true;
}

/** In the test channel only: `RITEMARK_TEST_LAST_READY_AI` (an AI's id) becomes the AI last seen ready. */
export async function seedLastReadyAiForTest(memento: MementoLike, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  if (!testChannelRequested(env)) return false;
  const value = env[TEST_LAST_READY_AI_ENV]?.trim();
  if (!isAgentId(value)) return false;
  await memento.update(LAST_READY_AI_KEY, value);
  return true;
}

// ── #926: the projects whose ready card was counted ──

export const READY_CARD_COUNTED_KEY = 'ritemark.guidance.readyCardCounted';
/** The most projects remembered; the oldest go first (a profile meets far fewer). */
const READY_CARD_COUNTED_MAX = 500;

function readyCardCountedList(memento: MementoLike): string[] {
  const value = memento.get<unknown>(READY_CARD_COUNTED_KEY);
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** `ready_card_shown` was sent for this project (its folder's normalized URI). */
export function readyCardCounted(memento: MementoLike, folderUri: string): boolean {
  return readyCardCountedList(memento).includes(folderUri);
}

/** Remember that `ready_card_shown` was sent for this project, in its own key, never rewritten by the guidance record. */
export async function noteReadyCardCounted(memento: MementoLike, folderUri: string): Promise<void> {
  const list = readyCardCountedList(memento);
  if (list.includes(folderUri)) return;
  await memento.update(READY_CARD_COUNTED_KEY, [...list, folderUri].slice(-READY_CARD_COUNTED_MAX));
}

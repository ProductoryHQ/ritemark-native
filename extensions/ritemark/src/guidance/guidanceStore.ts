/**
 * Sprint 140 (E2): what the first day's guidance remembers, in one key of this
 * computer's global state, `ritemark.guidance.v1`. Nothing is ever written in a
 * project's folder, so "Nothing in this folder was moved or changed" stays true.
 *
 * Per project (by its folder's normalized URI): the ready request's record.
 * Per release (major.minor): the days a document was saved, and the feedback
 * card's answer. And the last day the ready request showed on Home (D1).
 *
 * Sprint 156: the AI last seen ready on this profile, in a key of its own,
 * `ritemark.guidance.lastReadyAi`, holding only the AI's id. It is kept apart
 * from `ritemark.guidance.v1`, which a window rewrites whole, so one window's
 * write can't undo another's record.
 * No `vscode` import: it takes a Memento-shaped store.
 */

import type { AgentId } from '../agent/types';
import { testChannelRequested } from '../analytics/consent';
import { releaseOf, withSavedDay } from './guidanceState';
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
  release?: { id: string; savedDays: string[]; feedback?: 'sent' | 'not-now' };
}

const AGENTS: readonly AgentId[] = ['claude-code', 'codex', 'opencode'];
const GONE: readonly ReadyGone[] = ['answered', 'chat', 'hidden'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A stored value read defensively: anything malformed is dropped, never trusted. */
export function decodeGuidanceState(raw: unknown): GuidanceStateV1 {
  const empty: GuidanceStateV1 = { v: 1, projects: {} };
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
    ...(typeof value.readyShownOn === 'string' && DAY.test(value.readyShownOn) ? { readyShownOn: value.readyShownOn } : {}),
    ...(release && typeof release.id === 'string'
      ? {
          release: {
            id: release.id,
            savedDays: Array.isArray(release.savedDays) ? release.savedDays.filter((day): day is string => typeof day === 'string' && DAY.test(day)) : [],
            ...(release.feedback === 'sent' || release.feedback === 'not-now' ? { feedback: release.feedback } : {}),
          },
        }
      : {}),
  };
}

export class GuidanceStore {
  constructor(private readonly memento: MementoLike, readonly version: string) {}

  read(): GuidanceStateV1 {
    return decodeGuidanceState(this.memento.get(GUIDANCE_KEY));
  }

  /** This release's part: a new release starts with no saved days and no answer. */
  release(): { id: string; savedDays: string[]; feedback?: 'sent' | 'not-now' } {
    const id = releaseOf(this.version);
    const current = this.read().release;
    return current?.id === id ? current : { id, savedDays: [] };
  }

  project(folderUri: string): ReadyRecord {
    return this.read().projects[folderUri] ?? {};
  }

  async updateProject(folderUri: string, change: (record: ReadyRecord) => ReadyRecord): Promise<ReadyRecord> {
    const state = this.read();
    const next = change(state.projects[folderUri] ?? {});
    await this.memento.update(GUIDANCE_KEY, { ...state, projects: { ...state.projects, [folderUri]: next } });
    return next;
  }

  async noteReadyShown(day: string): Promise<void> {
    const state = this.read();
    if (state.readyShownOn === day) return;
    await this.memento.update(GUIDANCE_KEY, { ...state, readyShownOn: day });
  }

  async noteSavedDay(day: string): Promise<void> {
    const state = this.read();
    const release = this.release();
    if (release.savedDays.includes(day)) return;
    await this.memento.update(GUIDANCE_KEY, { ...state, release: { ...release, savedDays: withSavedDay(release.savedDays, day) } });
  }

  async answerFeedback(answer: 'sent' | 'not-now'): Promise<void> {
    const state = this.read();
    await this.memento.update(GUIDANCE_KEY, { ...state, release: { ...this.release(), feedback: answer } });
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

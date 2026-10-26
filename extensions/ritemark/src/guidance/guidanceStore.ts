/**
 * Sprint 140 (E2): what the first day's guidance remembers, in one key of this
 * computer's global state, `ritemark.guidance.v1`. Nothing is ever written in a
 * project's folder, so "Nothing in this folder was moved or changed" stays true.
 *
 * Per project (by its folder's normalized URI): the ready request's record.
 * Per release (major.minor): the days a document was saved, and the feedback
 * card's answer. And the last day the ready request showed on Home (D1).
 * No `vscode` import: it takes a Memento-shaped store.
 */

import type { AgentId } from '../agent/types';
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

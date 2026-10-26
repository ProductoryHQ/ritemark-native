/**
 * Sprint 139 (R10, #473): voice captures, and the notes that grow from them.
 *
 * The bet "Speaking is thinking" asks whether spoken notes become documents.
 * Ritemark counts a capture (`voice_captured`) and, once per captured
 * document, a change saved on a later calendar day within 30 days
 * (`voice_note_edited`, with how many days later).
 *
 * To know which documents those are, the list below stays on this computer:
 * each document is a salted hash (a code that can't be turned back into a name
 * or a path), with the capture's day and source. At most 200; each forgotten
 * after 30 days or once its event is sent. Nothing is kept while usage data is
 * off, and turning usage data off clears the list, salt and all.
 *
 * Pure apart from its injected storage, clock and hash.
 */

import type { EventPayloads, VoiceSource } from './events';

export const VOICE_NOTES_KEY = 'ritemark.analytics.voiceNotes.v1';
export const MAX_VOICE_NOTES = 200;
export const VOICE_NOTE_DAYS = 30;

export interface VoiceNoteEntry {
  /** The salted hash of the document's URI. */
  id: string;
  /** The capture's local calendar day, `YYYY-MM-DD`. */
  day: string;
  source: VoiceSource;
}

export interface VoiceNotesState {
  salt: string;
  entries: VoiceNoteEntry[];
}

type VoiceEvent = 'voice_captured' | 'voice_note_edited';

export interface VoiceNotesDeps {
  read(): unknown;
  write(state: VoiceNotesState | undefined): Promise<void>;
  maySend(): boolean;
  track<T extends VoiceEvent>(name: T, properties: EventPayloads[T]): Promise<boolean>;
  /** Today's local calendar day, `YYYY-MM-DD`. */
  today(): string;
  randomSalt(): string;
  /** A one-way hash of salt and text. */
  hash(salt: string, text: string): string;
}

/** Whole calendar days from `from` to `to` (both `YYYY-MM-DD`), or NaN. */
export function daysBetween(from: string, to: string): number {
  const parse = (day: string): number => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : Number.NaN;
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

/** A local calendar day, `YYYY-MM-DD`. */
export function localDay(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function decodeState(value: unknown): VoiceNotesState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as { salt?: unknown; entries?: unknown };
  if (typeof input.salt !== 'string' || !input.salt || !Array.isArray(input.entries)) return undefined;
  const entries = input.entries.filter((entry): entry is VoiceNoteEntry => (
    Boolean(entry) && typeof entry === 'object'
    && typeof (entry as VoiceNoteEntry).id === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(String((entry as VoiceNoteEntry).day))
    && ((entry as VoiceNoteEntry).source === 'dictation' || (entry as VoiceNoteEntry).source === 'transcribe')
  ));
  return { salt: input.salt, entries };
}

export class VoiceNotes {
  /** Notes whose event is on its way, so two quick saves send it once. */
  private readonly sending = new Set<string>();

  constructor(private readonly deps: VoiceNotesDeps) {}

  /** A capture happened: a dictation put text in a document, or a Transcribe job became text. */
  async captured(source: VoiceSource, input?: 'recorded' | 'file'): Promise<void> {
    await this.deps.track('voice_captured', source === 'transcribe' && input ? { source, input } : { source });
  }

  /**
   * Watch this document for a change on a later day. Only while usage data is
   * on; a document already watched keeps its first capture's day.
   */
  async remember(documentUri: string, source: VoiceSource): Promise<void> {
    if (!this.deps.maySend()) return;
    const today = this.deps.today();
    const state = this.fresh(decodeState(this.deps.read()), today) ?? { salt: this.deps.randomSalt(), entries: [] };
    const id = this.deps.hash(state.salt, documentUri);
    if (state.entries.some((entry) => entry.id === id)) {
      await this.deps.write(state);
      return;
    }
    const entries = [...state.entries, { id, day: today, source }];
    await this.deps.write({ salt: state.salt, entries: entries.slice(-MAX_VOICE_NOTES) });
  }

  /** A watched document was saved with a change. */
  async changedAndSaved(documentUri: string): Promise<void> {
    const stored = decodeState(this.deps.read());
    if (!stored) return;
    const today = this.deps.today();
    const state = this.fresh(stored, today);
    if (!state) {
      await this.deps.write(undefined);
      return;
    }
    const id = this.deps.hash(state.salt, documentUri);
    const entry = state.entries.find((candidate) => candidate.id === id);
    const days = entry ? daysBetween(entry.day, today) : Number.NaN;
    if (!entry || !(days >= 1 && days <= VOICE_NOTE_DAYS) || !this.deps.maySend()) {
      if (state.entries.length !== stored.entries.length) await this.deps.write(state);
      return;
    }
    // Once per capture: the entry goes once its event was sent. A send that didn't go keeps it for the next save.
    if (this.sending.has(id)) return;
    this.sending.add(id);
    try {
      if (!(await this.deps.track('voice_note_edited', { source: entry.source, days_since_capture: days }))) return;
      const latest = this.fresh(decodeState(this.deps.read()), today);
      const remaining = latest?.entries.filter((candidate) => candidate.id !== id) ?? [];
      await this.deps.write(latest && remaining.length > 0 ? { salt: latest.salt, entries: remaining } : undefined);
    } finally {
      this.sending.delete(id);
    }
  }

  /** At activation and whenever usage data changes: drop what is old, or everything when usage data is off. */
  async prune(): Promise<void> {
    const stored = decodeState(this.deps.read());
    if (stored === undefined) {
      if (this.deps.read() !== undefined) await this.deps.write(undefined);
      return;
    }
    if (!this.deps.maySend()) {
      await this.deps.write(undefined);
      return;
    }
    const state = this.fresh(stored, this.deps.today());
    if (!state) await this.deps.write(undefined);
    else if (state.entries.length !== stored.entries.length) await this.deps.write(state);
  }

  /** Is this document watched? (A cheap check before the event path.) */
  watches(documentUri: string): boolean {
    const state = decodeState(this.deps.read());
    if (!state || state.entries.length === 0) return false;
    const id = this.deps.hash(state.salt, documentUri);
    return state.entries.some((entry) => entry.id === id);
  }

  /** The list without entries older than 30 days; undefined when nothing is left. */
  private fresh(state: VoiceNotesState | undefined, today: string): VoiceNotesState | undefined {
    if (!state) return undefined;
    const entries = state.entries.filter((entry) => {
      const age = daysBetween(entry.day, today);
      return age >= 0 && age <= VOICE_NOTE_DAYS;
    });
    return entries.length > 0 ? { salt: state.salt, entries } : undefined;
  }
}

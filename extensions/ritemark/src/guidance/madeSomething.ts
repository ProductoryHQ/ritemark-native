/**
 * Sprint 140 (R15): `made_something`, once per way in this window's session: a
 * new document saved in the project, a document exported, or one published;
 * and whether a ready request was used in the session first. Only Ritemark's
 * own creates, successful exports and publishes, and files written during an
 * AI turn are reported here, never a sync client's downloads. No `vscode`
 * import: the export, publish and document hooks call it, and the guidance
 * host sets where it goes.
 */

export type MadeHow = 'new_document' | 'export' | 'publish';

type Sink = (how: MadeHow, afterReadyRequest: boolean) => void;

export class MadeSomethingTracker {
  private readonly counted = new Set<MadeHow>();
  private readyRequestUsed = false;
  private sink: Sink | null = null;

  setSink(sink: Sink | null): void {
    this.sink = sink;
  }

  private readonly drafts = new Set<string>();

  noteReadyRequestUsed(): void {
    this.readyRequestUsed = true;
  }

  /** A document Ritemark's New (Text, Table) just made: it counts when it is first saved. */
  noteDraft(fsPath: string): void {
    this.drafts.add(fsPath);
  }

  /** A save: a new document made in this session counts once. */
  noteSaved(fsPath: string): boolean {
    if (!this.drafts.delete(fsPath)) return false;
    return this.note('new_document');
  }

  /** The first of each way in the session is reported; later ones are not. True when it was reported. */
  note(how: MadeHow): boolean {
    if (this.counted.has(how)) return false;
    this.counted.add(how);
    this.sink?.(how, this.readyRequestUsed);
    return true;
  }
}

/** This window's tracker: one per extension host. */
export const madeSomething = new MadeSomethingTracker();

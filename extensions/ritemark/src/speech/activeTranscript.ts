/**
 * Sprint 108 — what the AI sidebar should treat as "the active file" when a
 * Transcript Workbench tab is in front.
 *
 * The workbench's document is an AUDIO file, so without this the agent is handed
 * the path to an `.m4a` it cannot read — worse than no context, because it looks
 * like context. What the user means by "this recording" is the transcript.
 *
 * A registered resolver rather than a direct import: `UnifiedViewProvider` has
 * no business knowing how the speech subsystem stores sessions, and the speech
 * subsystem is flag-gated and may not exist at all.
 */

export const TRANSCRIPT_WORKBENCH_VIEW_TYPE = 'ritemark.transcriptWorkbench';

type Resolver = (audioPath: string) => string | null;

let resolver: Resolver | null = null;

export function setTranscriptDocumentResolver(fn: Resolver): void {
  resolver = fn;
}

/** The saved document for a recording, or null when it has not been saved. */
export function transcriptDocumentFor(audioPath: string): string | null {
  try {
    return resolver?.(audioPath) ?? null;
  } catch {
    return null;
  }
}

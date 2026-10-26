/**
 * Sprint 140 (R8, R1): the AI's empty sheet offers starting points by what is
 * open. This module decides the kind of place, from what the desk shows in
 * front and the project's kind. Pure: no `vscode` import.
 */

import * as path from 'path';
import type { ReadyKind } from './readyRequest';

/** The `starting_point_used` event's `place` (R15). */
export type StartingPlace = 'project' | 'empty_project' | 'word_or_pdf' | 'short_text' | 'long_text' | 'table' | 'sample';

/** Every place, for checking what the sheet says against (the webview keeps the same list in its store). */
export const STARTING_PLACES: readonly StartingPlace[] = ['project', 'empty_project', 'word_or_pdf', 'short_text', 'long_text', 'table', 'sample'];

/** A place the sheet named, if it is one of Ritemark's; anything else is dropped, never passed on. */
export function startingPlaceFrom(value: unknown): StartingPlace | undefined {
  return STARTING_PLACES.find((place) => place === value);
}

/** A text document is short below this many words (R8). */
export const SHORT_TEXT_WORDS = 300;

/**
 * The #497 spike's gate (R1, R8; research/word-spike.md): the Word-or-PDF
 * starting points are offered for a kind only when every AI passed it. On
 * 26 October only ChatGPT could be run (it passed both), so both stay closed
 * until Claude and OpenCode are run; a Word file or PDF in front gets the
 * project's starting points meanwhile.
 */
export const READ_KINDS_EVERY_AI_PASSED: Readonly<{ word: boolean; pdf: boolean }> = { word: false, pdf: false };

export interface FrontEditor {
  /** The custom editor's view type, or undefined for VS Code's own text editor. */
  viewType: string | undefined;
  /** The file's name, with its extension. */
  fileName: string;
  /** A text document's words, when it is one. */
  words?: number;
}

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

/** The project's own starting points: what an empty desk (Home or the Task board) gets. */
export function projectPlace(kind: ReadyKind): StartingPlace {
  return kind === 'sample' ? 'sample' : kind === 'empty' ? 'empty_project' : 'project';
}

/**
 * The place for what is in front: a Word file or PDF (if the gate allows its
 * kind), a text document by its length, a table (a CSV, or a spreadsheet in the
 * table editor); anything else (a web page, a picture, a presentation, a flow,
 * a transcript), or nothing but Home and the Task board, gets the project's.
 */
export function startingPlaceOf(front: FrontEditor | null, project: ReadyKind, passed = READ_KINDS_EVERY_AI_PASSED): StartingPlace {
  if (!front) return projectPlace(project);
  const extension = path.extname(front.fileName).toLowerCase();
  if (front.viewType === 'ritemark.docxViewer' || extension === '.docx') return passed.word ? 'word_or_pdf' : projectPlace(project);
  if (front.viewType === 'ritemark.pdfViewer' || extension === '.pdf') return passed.pdf ? 'word_or_pdf' : projectPlace(project);
  if (front.viewType === 'ritemark.excelViewer' || extension === '.csv') return 'table';
  if ((front.viewType === 'ritemark.editor' || front.viewType === undefined) && TEXT_EXTENSIONS.has(extension)) {
    return (front.words ?? 0) < SHORT_TEXT_WORDS ? 'short_text' : 'long_text';
  }
  return projectPlace(project);
}

/** Words in a Markdown text, for the short/long rule: front matter, markup and links' targets left out. */
export function wordCount(text: string): number {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/\]\([^)]*\)/g, ']');
  const words = body.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}

/**
 * Sprint 140 (R8, R1): the AI's empty sheet offers starting points by what is
 * open. This module decides the kind of place, from what the desk shows in
 * front and the project's kind. Pure: no `vscode` import.
 */

import * as path from 'path';
import type { AgentId } from '../agent/types';
import type { ReadyKind } from './readyRequest';

/** The `starting_point_used` event's `place` (R15). */
export type StartingPlace = 'project' | 'empty_project' | 'word_or_pdf' | 'short_text' | 'long_text' | 'table' | 'sample' | 'theme';

/** Every place, for checking what the sheet says against (the webview keeps the same list in its store). */
export const STARTING_PLACES: readonly StartingPlace[] = ['project', 'empty_project', 'word_or_pdf', 'short_text', 'long_text', 'table', 'sample', 'theme'];

/** A place the sheet named, if it is one of Ritemark's; anything else is dropped, never passed on. */
export function startingPlaceFrom(value: unknown): StartingPlace | undefined {
  return STARTING_PLACES.find((place) => place === value);
}

/** A text document is short below this many words (R8). */
export const SHORT_TEXT_WORDS = 300;

type ReadingPlatform = 'darwin' | 'win32';
export type ReadingGate = Readonly<Record<AgentId, Readonly<Record<ReadingPlatform, boolean>>>>;
export type StartingPlacesByAgent = Readonly<Record<AgentId, StartingPlace>>;

/** Sprint 173 (G2): enable Word and PDF together after this AI passes on this platform. */
export const READ_KINDS_PASSED: ReadingGate = {
  // Sprint 173 G1: 3 of 3 on the Mac on 11819457 (research/reading-test.md, Claude on Mac, set 3).
  'claude-code': { darwin: true, win32: false },
  codex: { darwin: false, win32: false },
  opencode: { darwin: false, win32: false },
};

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
 * chosen AI on this platform), a text document by its length, a table (a CSV, or a spreadsheet in the
 * table editor); anything else (a web page, a picture, a presentation, a flow,
 * a transcript), or nothing but Home and the Task board, gets the project's.
 */
export function startingPlaceOf(front: FrontEditor | null, project: ReadyKind, agent: AgentId, platform: NodeJS.Platform, passed = READ_KINDS_PASSED): StartingPlace {
  if (!front) return projectPlace(project);
  const extension = path.extname(front.fileName).toLowerCase();
  if (front.viewType === 'ritemark.docxViewer' || extension === '.docx' ||
      front.viewType === 'ritemark.pdfViewer' || extension === '.pdf') {
    const canRead = (platform === 'darwin' || platform === 'win32') && passed[agent][platform];
    return canRead ? 'word_or_pdf' : projectPlace(project);
  }
  if (front.viewType === 'ritemark.excelViewer' || extension === '.csv') return 'table';
  // Sprint 162 PR 5 (frame 11): a theme's tab keeps the colour check's starting point
  if (front.viewType === 'ritemark.editor' && /\.theme\.md$/i.test(front.fileName)) return 'theme';
  if ((front.viewType === 'ritemark.editor' || front.viewType === undefined) && TEXT_EXTENSIONS.has(extension)) {
    return (front.words ?? 0) < SHORT_TEXT_WORDS ? 'short_text' : 'long_text';
  }
  return projectPlace(project);
}

/** Resolve all choices on the host so switching AIs needs no new message. */
export function startingPlacesForAgents(
  front: FrontEditor | null,
  project: ReadyKind,
  platform: NodeJS.Platform,
  passed = READ_KINDS_PASSED,
): StartingPlacesByAgent {
  return {
    'claude-code': startingPlaceOf(front, project, 'claude-code', platform, passed),
    codex: startingPlaceOf(front, project, 'codex', platform, passed),
    opencode: startingPlaceOf(front, project, 'opencode', platform, passed),
  };
}

/** Words in a Markdown text, for the short/long rule: front matter, markup and links' targets left out. */
export function wordCount(text: string): number {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/\]\([^)]*\)/g, ']');
  const words = body.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}

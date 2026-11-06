/**
 * The Publish sheet's messages and model (Sprint 149, R4, R5): what the host sends the sheet, and the only things the
 * sheet can answer.
 *
 * The model holds names, folders, reasons and line numbers. It never holds a key's value, a token or a full path, and
 * the sheet can't name a file to open: it answers with an index into the host's own list of hits.
 *
 * No Node import: the webview imports these types too (`sheetModel.ts` builds the model on the host).
 */

import type { FileKind, LeftOutReason } from './types';

export interface SheetFileRow {
  name: string;
  /** The folder as Search's rows show it: its path in the project, or the project's name at the top. */
  folder: string;
  kind: FileKind;
}

export interface SheetLeftOutRow {
  /** The file's name, first in its row as in the sent rows ("budget.png · outside this project"). Empty when folded. */
  name: string;
  /**
   * Where it is, for the row's tooltip: its path in the project, or the reference as the page writes it when it is
   * outside (`../../secrets/budget.png`). Never a real path from the disk. Empty when folded.
   */
  display: string;
  reason: LeftOutReason;
  /** Several other pages folded into one row (A3, finding 3). */
  count?: number;
}

export interface SheetKeyHit {
  /** Index into the host's list, the only way the sheet names a hit back. */
  index: number;
  fileName: string;
  line: number;
}

export interface PublishSheetModel {
  /** The page's name without `.html`: "Publish Harbour programme". */
  title: string;
  /** The page first. */
  files: SheetFileRow[];
  leftOut: SheetLeftOutRow[];
  scriptBuilt: boolean;
  keyHits: SheetKeyHit[];
  tooBig: { name: string; size: number }[];
  tooMany: boolean;
  /** Where it goes (PR 4 fills it from the account): "Your Cloudflare", "Productory account". */
  destination?: { name: string; detail: string };
  /**
   * The address (PR 4): the page part and the account's fixed end (`.pages-4821.workers.dev`). `editable` on a first
   * publish, frame 3's field: made web-safe as typed, its random end kept (decision 3). An update keeps its address.
   */
  address?: { page: string; suffix: string; editable?: boolean };
  /**
   * The workers.dev name row (PR 4, the lead's answer 5): only in the first sheet while the account has none, with
   * the host's suggestion ("pages" and four digits). The address's suffix then follows what is typed.
   */
  nameRow?: { suggestion: string };
}

/** Frame 2, the first Publish with nothing set up (PR 4): Set up is the token path in 2.2 (the lead, 5 November). */
export interface PublishSetupModel {
  /** The host's password box is open: Set up waits. */
  waiting: boolean;
  /** A plain line from the host, or null. Never a token or a value. */
  line: string | null;
}

/** Why the host kept the sheet open after Publish (PR 4); the sheet shows the line and Publish waits. */
export type SheetRefusal = 'nameTaken' | 'addressTaken' | 'addressInvalid';

export type PublishSheetHostMessage =
  | { type: 'publish:sheet'; model: PublishSheetModel }
  | { type: 'publish:setup'; setup: PublishSetupModel }
  | { type: 'publish:refused'; reason: SheetRefusal };

export type PublishSheetWebviewMessage =
  | { type: 'publish:sheetReady' }
  | { type: 'publish:cancel' }
  /**
   * `anyway`: the second, explicit press past a key warning (decision 2). `pagePart` and `subdomain` are what the
   * person typed in frame 3's field and the name row; the host checks both again before anything is named.
   */
  | { type: 'publish:confirm'; anyway: boolean; pagePart?: string; subdomain?: string }
  | { type: 'publish:openHit'; index: number }
  /** Frame 2's Set up: carries no value; the host opens its own password box. */
  | { type: 'publish:setUp' };

/**
 * A workers.dev name, and a Worker's: lowercase letters, digits and dashes, 1–63, no dash at either end. Shared by
 * the host and the sheet (no Node import here).
 */
export const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** The random end of a page's part, `-7f3a2c` (decision 3): a guessed name doesn't find the page. */
export const RANDOM_END_PATTERN = /-[0-9a-f]{6}$/;

/** A page part the host accepts (PR 3's blocking item): web-safe, 63 at most, its random end kept. */
export function isValidPagePart(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 63 && NAME_PATTERN.test(value) && RANDOM_END_PATTERN.test(value);
}

export function isSheetWebviewMessage(value: unknown): value is PublishSheetWebviewMessage {
  const m = value as PublishSheetWebviewMessage;
  if (!m || typeof m !== 'object' || typeof m.type !== 'string') return false;
  switch (m.type) {
    case 'publish:sheetReady':
    case 'publish:cancel':
      return true;
    case 'publish:confirm':
      return (
        typeof m.anyway === 'boolean' &&
        (m.pagePart === undefined || (typeof m.pagePart === 'string' && m.pagePart.length <= 200)) &&
        (m.subdomain === undefined || (typeof m.subdomain === 'string' && m.subdomain.length <= 200))
      );
    case 'publish:openHit':
      return Number.isInteger(m.index) && m.index >= 0;
    case 'publish:setUp':
      return true;
    default:
      return false;
  }
}

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
  /** The address (PR 4): the editable page part and the account's fixed end. */
  address?: { page: string; suffix: string };
}

export type PublishSheetHostMessage = { type: 'publish:sheet'; model: PublishSheetModel };

export type PublishSheetWebviewMessage =
  | { type: 'publish:sheetReady' }
  | { type: 'publish:cancel' }
  /** `anyway`: the second, explicit press past a key warning (decision 2). */
  | { type: 'publish:confirm'; anyway: boolean; pagePart?: string }
  | { type: 'publish:openHit'; index: number };

export function isSheetWebviewMessage(value: unknown): value is PublishSheetWebviewMessage {
  const m = value as PublishSheetWebviewMessage;
  if (!m || typeof m !== 'object' || typeof m.type !== 'string') return false;
  switch (m.type) {
    case 'publish:sheetReady':
    case 'publish:cancel':
      return true;
    case 'publish:confirm':
      return typeof m.anyway === 'boolean' && (m.pagePart === undefined || typeof m.pagePart === 'string');
    case 'publish:openHit':
      return Number.isInteger(m.index) && m.index >= 0;
    default:
      return false;
  }
}

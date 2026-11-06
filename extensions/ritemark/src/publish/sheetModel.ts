/**
 * The Publish sheet's model for a plan (Sprint 149, R5), built on the host: file names and folders as the project
 * shows them, other pages folded into one row, hits by index. No real path leaves the host.
 */

import * as path from 'node:path';
import type { PublishSheetModel, SheetFileRow, SheetLeftOutRow, SheetRefusal } from './sheetProtocol';
import type { PublishPlan } from './types';

/** A file's name from a path or a reference as written (either slash, or a `file:` URL): what its row starts with. */
export function nameOf(display: string): string {
  const parts = display.split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : display;
}

/** The sheet's model for a plan. `projectName` names the files at the project's top. */
export function sheetModelOf(plan: PublishPlan, projectName: string): PublishSheetModel {
  const files: SheetFileRow[] = plan.files.map((f) => {
    const folder = path.posix.dirname(f.projectPath);
    return { name: path.posix.basename(f.projectPath), folder: folder === '.' ? projectName : folder, kind: f.kind };
  });
  const pages = plan.leftOut.filter((l) => l.reason === 'otherPage');
  const leftOut: SheetLeftOutRow[] = plan.leftOut
    .filter((l) => l.reason !== 'otherPage')
    .map((l) => ({ name: nameOf(l.display), display: l.display, reason: l.reason }));
  if (pages.length === 1) leftOut.push({ name: nameOf(pages[0].display), display: pages[0].display, reason: 'otherPage' });
  else if (pages.length > 1) leftOut.push({ name: '', display: '', reason: 'otherPage', count: pages.length });
  const page = plan.files[0];
  const title = path.posix.basename(page.projectPath).replace(/\.html?$/i, '');
  return {
    title,
    files,
    leftOut,
    scriptBuilt: plan.scriptBuilt,
    keyHits: plan.keyHits.map((h, index) => ({ index, fileName: path.posix.basename(h.projectPath), line: h.line })),
    tooBig: plan.tooBig.map((t) => ({ name: path.posix.basename(t.projectPath), size: t.size })),
    tooMany: plan.tooMany,
  };
}

// ------------------------------------------------------------------ PR 4: the sheet's flow, host side

/** What PR 4 adds to a plan's sheet: where, the address, and the name row. */
export interface SheetOptions {
  destination?: PublishSheetModel['destination'];
  address?: PublishSheetModel['address'];
  nameRow?: PublishSheetModel['nameRow'];
}

/** The person's press of Publish, as the sheet sent it. Checked again by the host before anything is named. */
export interface SheetConfirm {
  anyway: boolean;
  pagePart?: string;
  subdomain?: string;
}

/** The host's answer to a press of Publish, before the sheet closes. */
export type SheetConfirmReply =
  /** The sheet closes and publishing starts. */
  | { kind: 'close' }
  /** The line shows ("This name is taken. Try another."), and Publish waits. */
  | { kind: 'refuse'; reason: SheetRefusal }
  /** The sheet's address changed (the account had a workers.dev name after all): shown again; Publish waits. */
  | { kind: 'update'; options: SheetOptions }
  /** The sheet closes without publishing; the host says why on its own. */
  | { kind: 'stop' };

/** Frame 2's Set up: the plan's sheet once connected; null while not connected (frame 2 stays); `stop` closes it. */
export type SheetSetupResult = { plan: PublishPlan; options: SheetOptions } | { stop: true } | null;

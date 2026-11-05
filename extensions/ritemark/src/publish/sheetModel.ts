/**
 * The Publish sheet's model for a plan (Sprint 149, R5), built on the host: file names and folders as the project
 * shows them, other pages folded into one row, hits by index. No real path leaves the host.
 */

import * as path from 'node:path';
import type { PublishSheetModel, SheetFileRow, SheetLeftOutRow } from './sheetProtocol';
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

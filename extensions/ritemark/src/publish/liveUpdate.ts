import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { isInside } from '../browser/localPage';
import type { LivePause, LivePauseKind } from './publishRecords';
import type { GatheredPlan } from './types';

export type LiveResult =
  | { kind: 'updated'; pictures: string[] }
  | { kind: 'unchanged' | 'stopped' }
  | { kind: 'paused'; pause: LivePause }
  | { kind: 'offline'; detail: string }
  | { kind: 'busy'; until?: Promise<void> };

export interface LiveIssue {
  kind: LivePauseKind;
  detail: string;
  scope?: string;
  outsideFiles?: LivePause['outsideFiles'];
  slide?: number;
  location?: LivePause['location'];
}

/** Sprint 149's project boundary still applies even after the person presses Go on. */
export function liveIssue(plan: GatheredPlan, acceptedScope?: string): LiveIssue | undefined {
  if (plan.keyHits.length) return { kind: 'key', detail: "The page's text has what looks like a key." };
  if (plan.tooMany || plan.tooBig.length) return { kind: 'limits', detail: 'The page uses more files or larger files than Cloudflare allows.' };
  if (plan.leftOut.some(row => row.reason === 'outside')) return { kind: 'outside', detail: 'The page refers to a file outside this project.' };
  const folder = path.dirname(plan.pagePath);
  const outside = plan.files.filter(file => !isInside(file.realPath, folder)
    || !isInside(path.resolve(plan.projectFolder, file.projectPath), folder));
  if (outside.length) {
    const scope = createHash('sha256').update(JSON.stringify(outside.map(file => [file.projectPath, file.realPath, file.sha256]).sort())).digest('hex');
    if (scope !== acceptedScope) return {
      kind: 'outside', scope, detail: "The page uses a file outside the deck's folder.",
      outsideFiles: [...new Set(outside.map(file => file.projectPath))].sort(),
    };
  }
  if (plan.leftOut.some(row => row.reason === 'uncleanable')) return { kind: 'picture', detail: "A picture's metadata couldn't be removed." };
  if (plan.leftOut.some(row => row.reason === 'gitUnchecked')) return { kind: 'unchecked', detail: "Ritemark couldn't check whether a file can go." };
  return undefined;
}

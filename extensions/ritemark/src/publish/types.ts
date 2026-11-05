/**
 * What goes when a page is published (Sprint 149, R3, R4, W3): the shared types of `src/publish/`.
 *
 * Kept small on purpose: PR 4's Cloudflare client reads a `PublishPlan` and nothing else from the gather. No `vscode`
 * import, so every part that decides what becomes public is tested under plain Node.
 */

/** What kind of file a gathered file is, for the sheet's line ("This page and its 2 pictures"). */
export type FileKind = 'page' | 'picture' | 'style' | 'script' | 'font' | 'other';

/** A file that goes up. */
export interface GatheredFile {
  /** Its path as the page reaches it, from the publish root, with `/` separators. The published tree's layout. */
  relPath: string;
  /** Its path from the project folder, with `/` separators (for the sheet's folder and for the records). */
  projectPath: string;
  /** The file on disk, by real path: the bytes that are read and uploaded. */
  realPath: string;
  kind: FileKind;
  size: number;
  /** sha256 of its bytes, hex. Absent only for a file over the size limit, which is never read. */
  sha256?: string;
}

/**
 * Why a reference the page makes is left out, as the sheet names it (the Experience lead, answer 3):
 * - `outside`: it leaves the project (by `..`, an absolute path, `file://`, a drive letter, a UNC path or a symlink);
 * - `hidden`: a path segment starts with `.` (`.env`, `.git`, `.claude`…);
 * - `toolFolder`: inside `node_modules`;
 * - `gitIgnored`: Git ignores it in the project;
 * - `otherPage`: another `.html` page (one page per publish), so its link won't work;
 * - `link`: a file the page only links to (`<a href="notes.md">`), not one it uses (R3; Opus review of #669);
 * - `gitUnchecked`: Git can't say whether it ignores the path (a path behind a linked folder), so it stays behind
 *   (fail closed, one file at a time).
 */
export type LeftOutReason = 'outside' | 'hidden' | 'toolFolder' | 'gitIgnored' | 'otherPage' | 'link' | 'gitUnchecked';

export interface LeftOut {
  /** What the person recognises: the reference as written for `outside`, else its path in the project. Never a query. */
  display: string;
  reason: LeftOutReason;
}

/** A place in a file that goes up that looks like a key or password. Never carries the value. */
export interface KeyHit {
  /** Which file, as `GatheredFile.projectPath`. */
  projectPath: string;
  realPath: string;
  /** 1-based. */
  line: number;
  /**
   * Where the key starts and ends on its line (0-based, in UTF-16 units as the text editor counts them), so Open can
   * select it as Find does. Positions only: never the text.
   */
  column?: number;
  endColumn?: number;
  /** Which rule matched (`secretScan.ts`), for tests and review; never shown with the value. */
  rule: string;
}

/** Everything the sheet shows and PR 4 uploads, decided on this computer before anything is sent. */
export interface PublishPlan {
  /** The page, by real path. */
  pagePath: string;
  projectFolder: string;
  /** The deepest folder holding the page and every gathered file (inside the project): the published tree's root. */
  root: string;
  /** The page first, then the files it uses, in the order the page reaches them. */
  files: GatheredFile[];
  leftOut: LeftOut[];
  /** The page builds file names in its scripts, so some files it loads can't be seen (A3, finding 2). */
  scriptBuilt: boolean;
  /** Files over the free plan's 25 MiB limit; nothing is sent while there are any. */
  tooBig: { projectPath: string; size: number }[];
  /** More files than the free plan's 20,000; nothing is sent. */
  tooMany: boolean;
  keyHits: KeyHit[];
  /** sha256 over every file's path and hash: what "changed since publishing" compares. */
  contentHash: string;
}

declare const gatheredBrand: unique symbol;

/**
 * A plan as `gatherPage` made it, frozen there and remembered (`isGatheredPlan`). The only kind PR 4's `publishPage`
 * takes, so no caller can hand the upload a list that skipped the gather and the key scan.
 */
export type GatheredPlan = PublishPlan & { readonly [gatheredBrand]: true };

/** The free plan's limits (R3). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 20_000;

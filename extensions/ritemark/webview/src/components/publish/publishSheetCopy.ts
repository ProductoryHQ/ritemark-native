/**
 * The Publish sheet's words (Sprint 149, R4, R5; the Experience lead's answers 3 and 4, 3 November 2026). Pure, so
 * every line is tested (`publishSheetCopy.test.ts`). Plain words: never "HTML", "deploy", "Worker" or "host".
 */

import type { FileKind, LeftOutReason } from '../../../../src/publish/types'
import type { SheetKeyHit, SheetLeftOutRow } from '../../../../src/publish/sheetProtocol'

const NOUNS: Partial<Record<FileKind, [string, string]>> = {
  picture: ['picture', 'pictures'],
  style: ['style', 'styles'],
  script: ['script', 'scripts'],
  font: ['font', 'fonts'],
}

/**
 * The line: "This page and its 2 pictures" when every other file is one of the four kinds; "This page and 4 files"
 * when they're mixed; "This page, one file" when it uses nothing else. `files` is the page first, then its files.
 */
export function whatGoesLine(files: readonly { kind: FileKind }[]): string {
  const others = files.slice(1)
  if (others.length === 0) return 'This page, one file'
  const kinds = new Set(others.map((f) => f.kind))
  const only = kinds.size === 1 ? NOUNS[others[0].kind] : undefined
  if (only) return others.length === 1 ? `This page and its ${only[0]}` : `This page and its ${others.length} ${only[1]}`
  return others.length === 1 ? 'This page and one file' : `This page and ${others.length} files`
}

export const NOTHING_ELSE = 'Nothing else from the project.'
export const SEE_THE_FILES = 'See the files'
export const SCRIPT_BUILT_LINE = "This page loads some files from its script. Ritemark can't see which, so they won't go."
export const WHO_CAN_SEE = "Anyone with the link can open the page. It isn't listed or searchable, and you can unpublish it any time."
export const SUBTITLE = 'People see it in their browser as you see it on the desk.'

/** The reason a file is left out, in a few words (answer 3). */
export function reasonWords(row: Pick<SheetLeftOutRow, 'reason' | 'count'>): string {
  const words: Record<LeftOutReason, string> = {
    outside: 'outside this project',
    hidden: 'a hidden file',
    toolFolder: "a tool's folder",
    gitIgnored: 'Git ignores it',
    otherPage: "another page, so its link won't work",
  }
  return words[row.reason]
}

/** A left-out row's name; several other pages fold into one row (A3, finding 3). */
export function leftOutName(row: SheetLeftOutRow): string {
  if (row.reason === 'otherPage' && row.count && row.count > 1) return `${row.count} other pages`
  return row.display
}

export function leftOutReasonFor(row: SheetLeftOutRow): string {
  if (row.reason === 'otherPage' && row.count && row.count > 1) return "so their links won't work"
  return reasonWords(row)
}

/** "2 left out": how many references are left out, counting folded pages one by one. */
export function leftOutCount(rows: readonly SheetLeftOutRow[]): number {
  return rows.reduce((n, r) => n + (r.count ?? 1), 0)
}

export interface KeyWarning {
  /** The line before the places, or the whole sentence for one place. */
  lead: string
  /** Up to three places: "script.js, line 12". */
  places: { hit: SheetKeyHit; words: string }[]
  /** "and 2 more", or empty. */
  more: string
  tail: string
}

/**
 * The key warning (answer 4): "This looks like a key or password: script.js, line 12. Anyone with the link could
 * read it and use it." With more than one: "3 things look like keys or passwords:", up to three places, "and 2 more".
 * Never the value: the sheet has none to show.
 */
export function keyWarning(hits: readonly SheetKeyHit[]): KeyWarning | null {
  if (hits.length === 0) return null
  const place = (h: SheetKeyHit) => `${h.fileName}, line ${h.line}`
  if (hits.length === 1) {
    return {
      lead: 'This looks like a key or password:',
      places: [{ hit: hits[0], words: place(hits[0]) }],
      more: '',
      tail: 'Anyone with the link could read it and use it.',
    }
  }
  const shown = hits.slice(0, 3)
  return {
    lead: `${hits.length} things look like keys or passwords:`,
    places: shown.map((hit) => ({ hit, words: place(hit) })),
    more: hits.length > 3 ? `and ${hits.length - 3} more` : '',
    tail: 'Anyone with the link could read them and use them.',
  }
}

/** "Open script.js": opens the file at that line. */
export function openWords(hit: SheetKeyHit): string {
  return `Open ${hit.fileName}`
}

export function sizeWords(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`
}

/** Over a free-plan limit: one plain line, and nothing is sent (R3, S15). */
export function limitLine(tooBig: readonly { name: string; size: number }[], tooMany: boolean): string | null {
  if (tooMany) return 'This page uses more than 20,000 files, too many to publish.'
  if (tooBig.length === 1) return `${tooBig[0].name} is too big to publish (${sizeWords(tooBig[0].size)}). A file can be up to 25 MB.`
  if (tooBig.length > 1) return `${tooBig.length} files are too big to publish. A file can be up to 25 MB.`
  return null
}

export interface SheetButtons {
  /** The sheet's main button: Publish, or Cancel when something looks like a key (decision 2). */
  main: 'publish' | 'cancel'
  publishWords: 'Publish' | 'Publish anyway'
  publishDisabled: boolean
  publishTip: string
  cancelTip: string
}

export function sheetButtons(hasKeyHits: boolean, overLimit: boolean): SheetButtons {
  if (overLimit) {
    return {
      main: 'cancel',
      publishWords: 'Publish',
      publishDisabled: true,
      publishTip: "Can't publish: a file is over the limit. Nothing has been sent.",
      cancelTip: 'Close without publishing. Nothing is sent.',
    }
  }
  if (hasKeyHits) {
    return {
      main: 'cancel',
      publishWords: 'Publish anyway',
      publishDisabled: false,
      publishTip: 'Publish with what looks like a key in it. Anyone with the link could read it.',
      cancelTip: 'Close without publishing, so you can take the key out first. Nothing is sent.',
    }
  }
  return {
    main: 'publish',
    publishWords: 'Publish',
    publishDisabled: false,
    publishTip: 'Put this page online. Anyone with the link can open it.',
    cancelTip: 'Close without publishing. Nothing is sent.',
  }
}

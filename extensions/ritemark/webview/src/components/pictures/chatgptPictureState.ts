/**
 * Pictures with ChatGPT: the picture maker's states and messages, pure (no React, no bridge), so they are tested on
 * their own (`chatgptPicture.test.ts`). The view and the hook are `ChatgptPicture.tsx`.
 */

import { savedDeckPictureFolder } from '../../../../src/decks/deckFileName'

export type PictureMode = 'new' | 'change'

/** The place a picture is made for: a picture in an editor's words (followed through edits), or a slide's side. */
export type PicturePlaceRef =
  | {
    kind: 'flow'
    pos: number
    /** The picture's path there now, as written. */
    path?: string
    /** Which of the words' pictures with that path, in their order: how the place is found again when its editor went. */
    nth?: number
  }
  /** The slide's own beside or behind; `path`: the picture there when its editor went ('' an empty place). */
  | { kind: 'side'; path?: string }

export interface PictureAsk {
  place: PicturePlaceRef
  mode: PictureMode
  /** The words the field starts with (the slide's title for a new picture on a slide). */
  suggestion: string
  /** Change this picture…: its path as the document writes it. */
  source?: string
  /** On a slide: its words, sent as context. */
  words?: string
  /** The file's name before cleaning: the slide's title. */
  name?: string
}

export type MakerPhase =
  | { phase: 'idle' }
  | { phase: 'checking'; ask: PictureAsk }
  | { phase: 'asking'; ask: PictureAsk }
  | { phase: 'making'; ask: PictureAsk; description: string; requestId: string }
  /** `undo`: the strip's Undo for a picture that came while its editor was gone (`picturesAway.ts`). */
  | { phase: 'done'; ask: PictureAsk; description: string; folder?: string; undo?: () => void }
  | { phase: 'failed'; ask: PictureAsk; description: string; problem: string }
  | { phase: 'sign-in'; ask: PictureAsk }

/** The words the strip says when ChatGPT is done (experience 46 and 49). */
export function doneWords(mode: PictureMode, folder?: string, source?: string): string {
  if (mode === 'new') return `ChatGPT made the picture. It's in ${folder ?? 'images/'}.`
  if (!folder) return 'ChatGPT changed the picture. The old one is still in images/.'

  let oldPath = (source ?? '').replace(/[?#].*$/, '')
  try {
    oldPath = decodeURI(oldPath)
  } catch {
    // A path with a stray % is read as written, as on the host.
  }
  oldPath = pictureKey(oldPath)
  const oldFolder = oldPath.startsWith('images/') ? 'images/' : oldPath.slice(0, Math.max(0, oldPath.lastIndexOf('/')))
  return `ChatGPT changed the picture. The old one is still ${oldFolder ? `in ${oldFolder}` : 'there'}.`
}

/** Who gets what, under the field: the person's words, the slide's words, the picture to change. Never other files. */
export function sentWords(ask: Pick<PictureAsk, 'mode' | 'words'>): string {
  if (ask.mode === 'change') return ask.words ? 'ChatGPT gets these words, this picture and the slide\'s words.' : 'ChatGPT gets these words and this picture.'
  return ask.words ? 'ChatGPT gets these words and the slide\'s words.' : 'ChatGPT gets these words.'
}

/**
 * The made picture's description (the Experience lead on #800): the words ChatGPT was given, so a screen reader and
 * the page have it, unless the person has written their own. `madeWith`: the words of the request that made the
 * picture standing there now, when ChatGPT made it; a description that still holds them is ChatGPT's, and a change
 * replaces it. Never more than one line.
 */
export function madeDescription(current: string, asked: string, madeWith?: string): string {
  const words = asked.replace(/[\r\n]+/g, ' ').trim()
  const now = current.trim()
  if (!now) return words
  if (madeWith !== undefined && now === madeWith.replace(/[\r\n]+/g, ' ').trim()) return words
  return current
}

/** A picture's path as a key: `./images/a.png` and `images/a.png` are the same file. */
export function pictureKey(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '')
}

/** The `picture/make` message for a request: the words, and what the place adds (the slide, the picture to change). */
export function makeMessage(ask: PictureAsk, description: string, requestId: string, slideId?: string): Record<string, unknown> {
  return {
    requestId,
    mode: ask.mode,
    description,
    ...(ask.words ? { words: ask.words } : {}),
    ...(ask.mode === 'change' && ask.source ? { source: ask.source } : {}),
    ...(ask.name ? { name: ask.name } : {}),
    ...(slideId ? { slideId } : {}),
  }
}

/**
 * The state after the host's `picture/status`: the check's answer opens the field (or says to sign in); the request's
 * answer is done, failed, sign-in or over. Undefined: not this state's answer (another request's, or a late one).
 */
export function phaseAfterStatus(current: MakerPhase, message: { requestId?: unknown; state?: unknown; problem?: unknown; path?: unknown; url?: unknown }, checking: string | null): MakerPhase | undefined {
  if (typeof message.requestId !== 'string') return undefined
  if (current.phase === 'checking') {
    if (message.requestId !== checking) return undefined
    if (message.state === 'ready') return { phase: 'asking', ask: current.ask }
    // ChatGPT can't make pictures here (an API key, a check that failed): said, with nothing to try again.
    if (message.state === 'failed') return { phase: 'failed', ask: current.ask, description: '', problem: typeof message.problem === 'string' ? message.problem : 'ChatGPT couldn\'t be checked. Try again.' }
    return { phase: 'sign-in', ask: current.ask }
  }
  if (current.phase !== 'making' || message.requestId !== current.requestId) return undefined
  if (message.state === 'made' && typeof message.path === 'string' && typeof message.url === 'string') {
    // The place now holds the made picture: it is followed by that picture's path (a slide's side too, so Try another
    // replaces the made one).
    const place = current.ask.place.kind === 'flow' || current.ask.place.path !== undefined ? { ...current.ask.place, path: message.path } : current.ask.place
    const folder = savedDeckPictureFolder(message.path)
    return { phase: 'done', ask: { ...current.ask, place }, description: current.description, ...(folder ? { folder } : {}) }
  }
  if (message.state === 'sign-in') return { phase: 'sign-in', ask: current.ask }
  if (message.state === 'failed') {
    return { phase: 'failed', ask: current.ask, description: current.description, problem: typeof message.problem === 'string' ? message.problem : 'ChatGPT couldn\'t make the picture. Try again.' }
  }
  return { phase: 'idle' }
}

/**
 * Where a made picture goes: the place as it was asked for, with the path of the picture standing there (the editor
 * checks it is still that picture), not the done state's place, which already follows the made picture's path.
 */
export function placeOfMade(current: MakerPhase, next: MakerPhase): PicturePlaceRef {
  if (current.phase === 'making') return current.ask.place
  return next.phase === 'idle' ? { kind: 'side' } : next.ask.place
}

/** What `followPicture` reads of a ProseMirror document and mapping. */
export interface PictureDoc { content: { size: number }; nodeAt: (pos: number) => { type: { name: string }; attrs?: Record<string, unknown> } | null | undefined }
export interface PictureMapping { mapResult: (pos: number, assoc?: number) => { pos: number; deleted: boolean } }

/**
 * Where a picture being made for (or just made) stands after an edit, or null when it's gone. An edit elsewhere moves
 * it; a slide's sync that writes the picture's block again (the made picture coming back from the deck) puts a picture
 * back where it stood, which is still its place.
 */
export function followPicture(doc: PictureDoc, mapping: PictureMapping, pos: number, isSame?: (attrs: Record<string, unknown>) => boolean): number | null {
  const mapped = mapping.mapResult(pos, 1)
  if (!mapped.deleted) return mapped.pos
  // Only the same picture (its path) counts: another picture that moved up into the place is not this one.
  if (!isSame) return null
  for (const at of [mapped.pos, mapping.mapResult(pos, -1).pos, pos]) {
    if (at < 0 || at >= doc.content.size) continue
    const node = doc.nodeAt(at)
    if (node?.type.name === 'image' && isSame(node.attrs ?? {})) return at
  }
  return null
}

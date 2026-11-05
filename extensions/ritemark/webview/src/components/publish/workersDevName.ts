/**
 * The workers.dev name row's and the address field's rules (Sprint 149, PR 4; spec R5; the Experience lead's answer
 * 5), and frame 2's words, kept apart from the sheet so they test under plain Node. The host checks the name and the
 * page part again (`isValidPagePart`, `chooseSubdomain`); these only shape what the person types and what Publish
 * waits for.
 */

import { isValidPagePart, NAME_PATTERN, type SheetRefusal } from '../../../../src/publish/sheetProtocol'

export const NAME_ROW = {
  label: 'Your pages’ addresses end in',
  help: 'The same for all your pages. You can change it in Cloudflare later.',
  taken: 'This name is taken. Try another.',
} as const

/** As typed, made web-safe: lowercase letters, digits and dashes, 63 at most. Empty when nothing usable is left. */
export function webSafeName(typed: string): string {
  return typed.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 63)
}

/** Whether Publish may go: a name of 1–63, no dash at either end (the host's own rule). */
export function nameReady(name: string): boolean {
  return NAME_PATTERN.test(name)
}

/** Frame 3's address field as typed: web-safe at once, 63 at most (the host's limit for a page's part). */
export function webSafePagePart(typed: string): string {
  return typed.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 63)
}

/** Whether Publish may go with this page part: the host's own check, its random end kept (decision 3). */
export function pagePartReady(part: string): boolean {
  return isValidPagePart(part)
}

/** The line under the address or the name when the host kept the sheet open (answer 5's words for the name). */
export function refusalLine(reason: SheetRefusal, randomEnd: string): string {
  switch (reason) {
    case 'nameTaken': return NAME_ROW.taken
    case 'addressTaken': return 'This address is taken. Try another.'
    case 'addressInvalid': return addressHint(randomEnd)
  }
}

/** Shown while the page part has lost its random end, and Publish waits. */
export function addressHint(randomEnd: string): string {
  return `Keep an end like ${randomEnd || '-7f3a2c'}, so a guessed address doesn't find the page.`
}

/** The random end the host suggested (`-7f3a2c`), from the page part it sent. */
export function randomEndOf(part: string): string {
  return /-[0-9a-f]{6}$/.exec(part)?.[0] ?? ''
}

/**
 * Frame 2, the first Publish with nothing set up. In 2.2 Set up is the token path, as Settings' Set up (the lead,
 * 5 November): "Sign in" reads Set up, its line names Cloudflare's page, and "Have an API token? Add it in
 * Settings" goes.
 */
export const SETUP_COPY = {
  title: 'Where should your web pages go?',
  lede: 'Ritemark puts them in an account of your own, never in a cloud of ours. You set it up once. Nothing goes until you press Publish.',
  host: 'Cloudflare',
  line: 'Free. No account yet? You can make one on Cloudflare’s page.',
  button: 'Set up',
  buttonTip: 'Opens Cloudflare’s token page and a box to paste the token in',
  waiting: 'Paste the token in the box Ritemark opened. Cloudflare’s page opened in your browser.',
  waitingTip: 'Ritemark is waiting for the token',
  cancelTip: 'Close without setting anything up. Nothing is sent.',
} as const

/** The Address row below it, as the person types (answer 5): `harbour-programme-7f3a2c.pages-4821.workers.dev`. */
export function addressPreview(pagePart: string, name: string): string {
  return `${pagePart}.${name || 'pages'}.workers.dev`
}

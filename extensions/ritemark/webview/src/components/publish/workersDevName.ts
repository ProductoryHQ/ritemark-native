/**
 * The workers.dev name row's rules (Sprint 149, PR 4; spec R5; the Experience lead's answer 5), kept apart from the
 * row so they test under plain Node. The host checks the name again and registers it (`chooseSubdomain`); these only
 * shape what the person types and the address shown under it.
 */

export const NAME_ROW = {
  label: 'Your pages’ addresses end in',
  help: 'The same for all your pages. You can change it in Cloudflare later.',
  taken: 'This name is taken. Try another.',
} as const

/** As typed, made web-safe: lowercase letters, digits and dashes, 63 at most. Empty when nothing usable is left. */
export function webSafeName(typed: string): string {
  return typed.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 63)
}

/** Whether Publish may go: a name of 1–63, no dash at either end. */
export function nameReady(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name)
}

/** The Address row below it, as the person types (answer 5): `harbour-programme-7f3a2c.pages-4821.workers.dev`. */
export function addressPreview(pagePart: string, name: string): string {
  return `${pagePart}.${name || 'pages'}.workers.dev`
}

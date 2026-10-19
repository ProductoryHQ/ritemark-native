/**
 * Sprint 134 (R19) — the words on the PDF and Word bars, and what their Share holds.
 *
 * Save as Markdown is now Make an editable copy (decided with Jarmo, 14 October):
 * same handler, same `save-as-markdown-from-preview` flag. Each bar ends in Share,
 * as the document's bar does. On a PDF or a Word file Share holds two items (the
 * Experience lead, 19 October), and no Export or Google Docs:
 *   - Show in Finder (Show in File Explorer on Windows), so the file can be
 *     attached to an email or a message: the host runs `revealFileInOS`;
 *   - Open in Preview for a PDF ("Open in default app" on Windows, confirmations
 *     §8), or Open in Word for a Word file, with the label the host sends
 *     (`openStatus.openLabel`), where the system's own Share is.
 *
 * The webview does not know the system; the host sends it in `openStatus`
 * (`platform`), answering the viewer's `getOpenStatus`.
 */
import type { PhosphorIconName } from '../ui/Icon'

export type HostPlatform = 'darwin' | 'win32' | 'linux'
export type ShareFileKind = 'pdf' | 'docx'

/** What a Share item posts to the host. */
export type ShareHostMessage = 'revealInOS' | 'openInExternalApp'

export interface ShareMenuItem {
  id: 'reveal' | 'open'
  label: string
  /** The muted second line: what the item is for. */
  description: string
  icon: PhosphorIconName
  message: ShareHostMessage
}

export const SHARE_LABEL = 'Share'
export const EDITABLE_COPY_LABEL = 'Make an editable copy'
export const EDITABLE_COPY_BUSY_LABEL = 'Converting…'
export const EDITABLE_COPY_ICON: PhosphorIconName = 'note-pencil'

/** The bar's button, or the Open in Word menu's item: "Make an editable copy", or "Converting…" while it works. */
export function editableCopyLabel(busy: boolean): string {
  return busy ? EDITABLE_COPY_BUSY_LABEL : EDITABLE_COPY_LABEL
}

export function editableCopyTooltip(kind: ShareFileKind, busy: boolean): string {
  const noun = kind === 'pdf' ? 'PDF' : 'Word document'
  return busy
    ? `Converting the ${noun} to a Markdown document`
    : `Save a copy of this ${noun} as a Markdown document you can edit (a best-effort conversion)`
}

/** The system the host reports; anything else is not one. */
export function parsePlatform(value: unknown): HostPlatform | null {
  return value === 'darwin' || value === 'win32' || value === 'linux' ? value : null
}

/** Until the host answers: the system the webview's browser reports. */
export function guessPlatform(navigatorPlatform: string | undefined): HostPlatform {
  if (navigatorPlatform && /Mac/i.test(navigatorPlatform)) return 'darwin'
  if (navigatorPlatform && /Win/i.test(navigatorPlatform)) return 'win32'
  return 'linux'
}

/** VS Code's `revealFileInOS` shows the file in its folder: Finder, File Explorer, or the file manager. */
export function revealLabel(platform: HostPlatform): string {
  if (platform === 'darwin') return 'Show in Finder'
  if (platform === 'win32') return 'Show in File Explorer'
  return 'Show in folder'
}

/** A PDF opens in Preview on the Mac; elsewhere in the default app for PDFs. */
export function pdfOpenLabel(platform: HostPlatform): string {
  return platform === 'darwin' ? 'Open in Preview' : 'Open in default app'
}

/**
 * Share's two items, in order. `openLabel` is the Word bar's own label from the
 * host ("Open in Word", "Open in Pages" or "Open in default app"); a PDF ignores it.
 */
export function shareMenuItems(kind: ShareFileKind, platform: HostPlatform, openLabel = 'Open in Word'): ShareMenuItem[] {
  return [
    {
      id: 'reveal',
      label: revealLabel(platform),
      description: 'To attach it to an email or a message',
      icon: 'folder-open',
      message: 'revealInOS',
    },
    {
      id: 'open',
      label: kind === 'pdf' ? pdfOpenLabel(platform) : openLabel,
      description: 'To share it from there',
      icon: 'arrow-square-out',
      message: 'openInExternalApp',
    },
  ]
}

/** Share's tooltip names both items: "Show in Finder, or open in Preview". */
export function shareTooltip(items: readonly ShareMenuItem[]): string {
  const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
  return items.map((item, i) => (i === 0 ? item.label : lower(item.label))).join(', or ')
}

/** Posts the item's message to the host; `send` is the bridge's `sendToExtension`. */
export function postShareItem(item: ShareMenuItem, send: (type: string) => void): void {
  send(item.message)
}

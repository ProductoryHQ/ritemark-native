/**
 * Google Docs publishing in the document's Share menu (Sprint 119, W6; 2.0's
 * words in Sprint 134, R12).
 *
 * The host owns every fact; this file only turns the host's redacted
 * projection into the Share menu's Google Docs group. It mirrors
 * `GoogleDocsDocumentProjection` from `src/googleDocs/types.ts` — the webview
 * has no import path to host code.
 *
 * Each state keeps 1.x's actions and messages: Connect… and Reconnect… open
 * Settings, Create and Sync publish, Open opens the Google Doc, Remove link…
 * asks the host to forget it. Only the words changed (experience 26: Publish
 * to Google Docs, Update the Google Doc, Open in Google Docs). What 1.x showed
 * as a native tooltip is now the item's second line. Each line stays single.
 */
import type { PhosphorIconName } from '../ui/Icon'

export type GoogleDocsDocumentState =
  | 'hidden'
  | 'unavailable'
  | 'not-connected'
  | 'unbound'
  | 'bound'
  | 'account-mismatch'
  | 'busy'

export type GoogleDocsStage = 'preparing' | 'uploading-images' | 'writing' | 'verifying'

export interface GoogleDocsProjection {
  state: GoogleDocsDocumentState
  docUrl: string | null
  title: string | null
  lastSyncedAt: string | null
  boundAccountEmail: string | null
  stage: GoogleDocsStage | null
}

export type GoogleDocsAction = 'publish' | 'open' | 'unlink' | 'settings'

export interface GoogleDocsMenuItem {
  action: GoogleDocsAction | null
  label: string
  /** The second line, under the label. */
  detail: string | null
  icon: Extract<PhosphorIconName, 'google-logo' | 'arrows-clockwise' | 'arrow-square-out' | 'link-break' | 'sign-in' | 'circle-notch'>
  disabled?: boolean
}

const STAGE_TEXT: Record<GoogleDocsStage, string> = {
  preparing: 'Preparing…',
  'uploading-images': 'Uploading images…',
  writing: 'Writing to Google Docs…',
  verifying: 'Checking…',
}

/** "Last updated 5 min ago", from the binding's last publish; null when unknown. */
export function formatLastUpdate(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000)
  if (minutes < 1) return 'Last updated just now'
  if (minutes < 60) return `Last updated ${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Last updated ${hours} h ago`
  return `Last updated ${then.toLocaleDateString()}`
}

export function googleDocsMenuItems(projection: GoogleDocsProjection | null, now: Date = new Date()): GoogleDocsMenuItem[] {
  if (!projection) return []
  switch (projection.state) {
    case 'hidden':
    case 'unavailable':
      return []
    case 'not-connected':
      // Today's connect step: Settings, where the account is connected. Then
      // the same item publishes.
      return [{ action: 'settings', label: 'Publish to Google Docs', detail: 'Connect your Google account first', icon: 'google-logo' }]
    case 'unbound':
      return [{ action: 'publish', label: 'Publish to Google Docs', detail: 'One Google Doc you update from here', icon: 'google-logo' }]
    case 'account-mismatch':
      return [{
        action: 'settings',
        label: 'Reconnect your Google account',
        detail: projection.boundAccountEmail
          ? `Published with ${projection.boundAccountEmail}`
          : 'Published with another Google account',
        icon: 'sign-in',
      }]
    case 'busy':
      return [{ action: null, label: projection.stage ? STAGE_TEXT[projection.stage] : 'Publishing…', detail: null, icon: 'circle-notch', disabled: true }]
    case 'bound':
      return [
        { action: 'publish', label: 'Update the Google Doc', detail: formatLastUpdate(projection.lastSyncedAt, now) ?? 'Sends this version', icon: 'arrows-clockwise' },
        { action: 'open', label: 'Open in Google Docs', detail: projection.title, icon: 'arrow-square-out' },
        { action: 'unlink', label: 'Remove the link…', detail: 'The Google Doc is not deleted', icon: 'link-break' },
      ]
  }
}

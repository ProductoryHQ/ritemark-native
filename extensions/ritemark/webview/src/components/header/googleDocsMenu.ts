/**
 * Google Docs publishing in the editor's Export menu (Sprint 119, W6).
 *
 * The host owns every fact; this file only turns the host's redacted
 * projection into menu items. It mirrors `GoogleDocsDocumentProjection` from
 * `src/googleDocs/types.ts` — the webview has no import path to host code.
 * Labels are single-line by rule: no hint text inside a button.
 */

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
  icon: 'cloud-arrow-up' | 'arrows-clockwise' | 'arrow-square-out' | 'link-break' | 'sign-in' | 'circle-notch'
  disabled?: boolean
  /** Accessible description; also shown as the native tooltip. */
  description?: string
}

const STAGE_TEXT: Record<GoogleDocsStage, string> = {
  preparing: 'Preparing…',
  'uploading-images': 'Uploading images…',
  writing: 'Writing to Google Docs…',
  verifying: 'Checking…',
}

export function formatSyncedAt(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const minutes = Math.round((now.getTime() - then.getTime()) / 60_000)
  if (minutes < 1) return 'synced just now'
  if (minutes < 60) return `synced ${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `synced ${hours} h ago`
  return `synced ${then.toLocaleDateString()}`
}

export function googleDocsMenuItems(projection: GoogleDocsProjection | null, now: Date = new Date()): GoogleDocsMenuItem[] {
  if (!projection) return []
  switch (projection.state) {
    case 'hidden':
    case 'unavailable':
      return []
    case 'not-connected':
      return [{ action: 'settings', label: 'Connect Google Docs…', icon: 'sign-in', description: 'Connect a Google account in Settings to publish this document to Google Docs' }]
    case 'unbound':
      return [{ action: 'publish', label: 'Create Google Doc', icon: 'cloud-arrow-up', description: 'Publish this document as a new Google Doc and remember it for later Sync' }]
    case 'account-mismatch':
      return [{
        action: 'settings',
        label: 'Reconnect Google account…',
        icon: 'sign-in',
        description: projection.boundAccountEmail
          ? `This document was published with ${projection.boundAccountEmail}. Connect that account to sync it.`
          : 'This document was published with a different Google account.',
      }]
    case 'busy':
      return [{ action: null, label: projection.stage ? STAGE_TEXT[projection.stage] : 'Publishing…', icon: 'circle-notch', disabled: true }]
    case 'bound': {
      const synced = formatSyncedAt(projection.lastSyncedAt, now)
      return [
        {
          action: 'publish',
          label: 'Sync Google Doc',
          icon: 'arrows-clockwise',
          description: [`Replace "${projection.title ?? 'the Google Doc'}" with this version`, synced].filter(Boolean).join(' · '),
        },
        { action: 'open', label: 'Open Google Doc', icon: 'arrow-square-out', description: projection.title ?? undefined },
        { action: 'unlink', label: 'Remove Google Docs link…', icon: 'link-break', description: 'Forget which Google Doc this file is published to. The Google Doc is not deleted.' },
      ]
    }
  }
}

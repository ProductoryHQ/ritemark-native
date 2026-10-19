/**
 * Share on the document's bar (Sprint 134, R12; experience 26, frame 1): what
 * its menu holds, in the drawing's order, and which handler each item runs.
 *
 * 1.x's Export menu held Export PDF, Export Word, the Google Docs items and
 * Copy as Markdown. Every one keeps its handler and message here; only the
 * words and the order change ("Share, not Export").
 */
import type { PhosphorIconName } from '../ui/Icon'
import { googleDocsMenuItems, type GoogleDocsAction, type GoogleDocsProjection } from './googleDocsMenu'

/** The Share button carries this attribute, so the menu finds it when it opens without a click (File ▸ Share). */
export const SHARE_BUTTON_ATTRIBUTE = 'data-share-button'

export const SHARE_FOOT = 'The document stays on this computer. Sharing sends a copy.'

export type ShareRun =
  | { kind: 'pdf' }
  | { kind: 'word' }
  | { kind: 'markdown' }
  | { kind: 'google-docs'; action: GoogleDocsAction }

export interface ShareMenuItem {
  id: string
  label: string
  /** The second line under the label, or (`detailBeside`) the quiet words at the row's end. */
  detail: string | null
  detailBeside?: boolean
  icon: PhosphorIconName
  /** null: a line that only says what is happening (a publish under way). */
  run: ShareRun | null
  disabled?: boolean
  busy?: boolean
}

export interface ShareMenuGroup {
  id: 'send-a-copy' | 'google-docs' | 'copy'
  title: string | null
  items: ShareMenuItem[]
}

export interface ShareMenuModel {
  groups: ShareMenuGroup[]
  foot: string
}

export interface ShareHandlers {
  onExportPDF: (templateId?: string) => void
  onExportWord: (templateId?: string) => void
  onCopyAsMarkdown: () => void
  onGoogleDocsAction?: (action: GoogleDocsAction) => void
}

/**
 * The menu for a document. `googleDocs` is the host's projection (null until
 * it arrives); without a Google Docs handler, or while the host hides the
 * feature, the group is left out, as Export did.
 */
export function shareMenuModel(
  googleDocs: GoogleDocsProjection | null,
  options: { googleDocs: boolean; now?: Date },
): ShareMenuModel {
  const groups: ShareMenuGroup[] = [
    {
      id: 'send-a-copy',
      title: 'Send a copy',
      items: [
        // The icons stand in for the drawing's file-pdf and google-logo, which ui/Icon.tsx does not carry yet.
        { id: 'pdf', label: 'PDF', detail: 'For reading and printing', icon: 'file-pdf', run: { kind: 'pdf' } },
        { id: 'word', label: 'Word document', detail: 'For people who edit in Word', icon: 'file-doc', run: { kind: 'word' } },
      ],
    },
  ]

  const googleDocsItems = options.googleDocs ? googleDocsMenuItems(googleDocs, options.now) : []
  if (googleDocsItems.length > 0) {
    groups.push({
      id: 'google-docs',
      title: 'Google Docs',
      items: googleDocsItems.map((item, index) => ({
        id: `google-docs-${item.action ?? 'busy'}-${index}`,
        label: item.label,
        detail: item.detail,
        icon: item.icon,
        run: item.action ? { kind: 'google-docs', action: item.action } : null,
        disabled: item.disabled,
        busy: item.icon === 'circle-notch' || undefined,
      })),
    })
  }

  groups.push({
    id: 'copy',
    title: null,
    items: [{ id: 'markdown', label: 'Copy as Markdown', detail: 'For email and chat', detailBeside: true, icon: 'copy', run: { kind: 'markdown' } }],
  })

  return { groups, foot: SHARE_FOOT }
}

/** Runs an item with 1.x's handler: PDF and Word with the "clean" template, as Export did. */
export function runShareItem(run: ShareRun, handlers: ShareHandlers): void {
  switch (run.kind) {
    case 'pdf': handlers.onExportPDF('clean'); return
    case 'word': handlers.onExportWord('clean'); return
    case 'markdown': handlers.onCopyAsMarkdown(); return
    case 'google-docs': handlers.onGoogleDocsAction?.(run.action); return
  }
}

import type { DocumentConflictReason, DocumentParagraphConflict } from '../../../../src/editorSync/protocol'
import {
  Dialog,
  DialogBody,
  DialogButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { paragraphReviewWords } from './paragraphReviewWords'

interface DocumentConflictDialogProps {
  isOpen: boolean
  filename: string
  /** Sprint 145 R1 (#588): `held-import`, a writer's copy that left out words Ritemark had just saved. */
  reason?: DocumentConflictReason
  onClose: () => void
  onCompare: () => void
  onKeepLocal: () => void
  onUseDisk: () => void
}

/**
 * Explicit three-way conflict resolution for the whole document. Both versions stay preserved until a choice is
 * made. Since Sprint 145 (#588) it is only the fallback, for a writer's copy whose base can't be found; the
 * Experience lead's three changes (#605, 1 November): the words match the buttons, Use disk version is a quiet
 * secondary button standing apart at the left, Keep my version is primary and the default, Tab follows the screen.
 */
export function DocumentConflictDialog({
  isOpen,
  filename,
  reason,
  onClose,
  onCompare,
  onKeepLocal,
  onUseDisk,
}: DocumentConflictDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[520px]">
        <DocumentConflictHeader onClose={onClose} />

        <DialogBody>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
              {reason === 'held-import' ? (
                // The Experience lead's words for this case (issue #588, 31 October; second sentence, #605, 1 November).
                <>
                  <p className="m-0">
                    Something else saved <strong className="text-ink-strong">{filename}</strong> just after you did, and its copy leaves out words you had just written.
                  </p>
                  <p className="m-0">
                    Ritemark kept your words on the page. Compare the changes, keep your version, or use the disk version.
                  </p>
                </>
              ) : (
                <>
                  <p className="m-0">
                    Your edits and the disk version of <strong className="text-ink-strong">{filename}</strong> both changed.
                  </p>
                  <p className="m-0">
                    Ritemark has preserved both versions. Compare the changes, keep your version, or use the disk version.
                  </p>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogBody>

        <DialogFooter className="flex-wrap">
          <DialogButton variant="secondary" className="mr-auto" onClick={onUseDisk}>
            Use disk version
          </DialogButton>
          <DialogButton variant="secondary" onClick={onCompare}>
            Compare changes
          </DialogButton>
          <DialogButton variant="primary" autoFocus onClick={onKeepLocal}>
            Keep my version
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The fallback question's header (the Experience lead, ritemark-dev `8408035`): the title alone, with no warning
 * icon, as the paragraph dialog's. A conflict is a question, not an alarm.
 */
export function DocumentConflictHeader({ onClose }: { onClose: () => void }) {
  return (
    <DialogHeader onClose={onClose}>
      <DialogTitle>Document changed in two places</DialogTitle>
    </DialogHeader>
  )
}

interface ParagraphConflictDialogProps {
  isOpen: boolean
  /** The places both changed; the dialog shows the first, "1 of N". */
  items: readonly DocumentParagraphConflict[]
  /** Which of `items` this is, counting from 1, for "1 of 2". */
  position: number
  total: number
  writer?: string
  onClose: () => void
  onKeepMine: (id: number) => void
  onUseTheirs: (id: number) => void
}

/**
 * Sprint 145 R1 (#588, experience 44's frame 3 as redrawn, ritemark-dev `5336968`): one of the two paragraphs, a plain
 * quoted block, not a field: a soft fill, no border, its label inside at the top, the paragraph in the editor's own
 * font at its full length. It can be selected and copied, never edited.
 */
export function ParagraphQuote({ label, text }: { label: string; text: string }) {
  return (
    <figure className="m-0 select-text rounded-[8px] bg-[var(--r-surface-soft)] px-3 py-[10px]">
      <figcaption className="m-0 mb-1 font-ui text-[11px] font-semibold uppercase leading-[14px] tracking-[0.5px] text-[var(--r-ink-muted)]">
        {label}
      </figcaption>
      {/* A plain paragraph, not a <blockquote>: VS Code's webview stylesheet gives blockquotes a fill of their own. */}
      <p className="m-0 select-text whitespace-pre-wrap break-words font-editor text-[14px] leading-[22px] text-[var(--r-ink-strong)]">
        {text}
      </p>
    </figure>
  )
}

/**
 * Sprint 145 R1 (revised 1 November, #588): Review changes for one paragraph both the person and a writer changed,
 * experience 44's frame 3. The person's paragraph is in the document; the writer's waits here. No warning icon:
 * it is a question, not an alarm.
 */
export function ParagraphConflictDialog({ isOpen, items, position, total, writer, onClose, onKeepMine, onUseTheirs }: ParagraphConflictDialogProps) {
  const item = items[0]
  const words = paragraphReviewWords(total, writer)
  return (
    <Dialog open={isOpen && !!item} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader onClose={onClose}>
          <DialogTitle>
            {words.title}
            {total > 1 ? <span className="ml-2 font-normal text-ink-muted">{position} of {total}</span> : null}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
              <p className="m-0">{words.line}</p>
              <ParagraphQuote label={words.mineLabel} text={item?.mine ?? ''} />
              <ParagraphQuote label={words.theirsLabel} text={item?.theirs ?? ''} />
            </div>
          </DialogDescription>
        </DialogBody>
        <DialogFooter className="flex-wrap">
          <DialogButton variant="secondary" className="mr-auto" onClick={() => item && onUseTheirs(item.id)}>
            {words.useTheirs}
          </DialogButton>
          <DialogButton variant="primary" autoFocus onClick={() => item && onKeepMine(item.id)}>
            {words.keepMine}
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

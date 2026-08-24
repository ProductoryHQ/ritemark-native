import { Icon } from '../ui/Icon'
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

interface DocumentConflictDialogProps {
  isOpen: boolean
  filename: string
  onClose: () => void
  onCompare: () => void
  onKeepLocal: () => void
  onUseDisk: () => void
}

/** Explicit three-way conflict resolution. Both versions stay preserved until a choice is made. */
export function DocumentConflictDialog({
  isOpen,
  filename,
  onClose,
  onCompare,
  onKeepLocal,
  onUseDisk,
}: DocumentConflictDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader
          icon={<Icon name="warning" size={20} className="text-[var(--r-warning)]" />}
          onClose={onClose}
        >
          <DialogTitle>Document changed in two places</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
              <p className="m-0">
                Your edits and the disk version of <strong className="text-ink-strong">{filename}</strong> both changed.
              </p>
              <p className="m-0">
                Ritemark has preserved both versions. Compare them first, keep your version, or replace it with the disk version.
              </p>
            </div>
          </DialogDescription>
        </DialogBody>

        <DialogFooter className="flex-wrap">
          <DialogButton variant="secondary" onClick={onCompare}>
            Compare changes
          </DialogButton>
          <DialogButton variant="danger" onClick={onUseDisk}>
            Use disk version
          </DialogButton>
          <DialogButton variant="primary" onClick={onKeepLocal}>
            Keep my version
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

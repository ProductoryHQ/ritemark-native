import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogButton,
} from '../ui/dialog'

interface ConflictDialogProps {
  isOpen: boolean
  filename: string
  onDiscard: () => void
  onCancel: () => void
  isDiskConflict?: boolean
}

/**
 * Conflict Dialog - Warn user about unsaved changes before refresh
 *
 * Two variants:
 * 1. True conflict (isDiskConflict=true): Both local and disk changes
 * 2. Simple discard (isDiskConflict=false): Only local changes
 */
export function ConflictDialog({
  isOpen,
  filename,
  onDiscard,
  onCancel,
  isDiskConflict = false,
}: ConflictDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader icon={<AlertTriangle size={18} className="text-[var(--vscode-editorWarning-foreground)]" />} onClose={onCancel}>
          <DialogTitle>{isDiskConflict ? 'Unsaved Changes Conflict' : 'Unsaved Changes'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {isDiskConflict ? (
            <div className="text-sm text-[var(--vscode-descriptionForeground)] leading-relaxed space-y-3">
              <p className="m-0">You have unsaved edits in Ritemark.</p>
              <p className="m-0">
                The file <strong className="text-[var(--vscode-foreground)]">{filename}</strong> has also been modified on disk by another program.
              </p>
              <p className="m-0">Refreshing will discard your changes and load the version from disk.</p>
            </div>
          ) : (
            <div className="text-sm text-[var(--vscode-descriptionForeground)] leading-relaxed space-y-3">
              <p className="m-0">You have unsaved changes.</p>
              <p className="m-0">Refreshing will discard them.</p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogButton variant="secondary" onClick={onCancel}>
            {isDiskConflict ? 'Keep Editing' : 'Cancel'}
          </DialogButton>
          <DialogButton variant="danger" onClick={onDiscard}>
            {isDiskConflict ? 'Discard My Changes' : 'Discard & Refresh'}
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * DeleteConfirm — "Delete this task?" (Sprint 130). The card file goes to the
 * system trash with its history; its page, if open, closes with it. Enter
 * confirms and Escape cancels (Jarmo, 2026-10-13).
 */

import type { BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { Dialog, DialogButton, DialogContent, DialogFooter, DialogTitle } from '../ui/dialog'
import { act, useBoardUi } from './boardUi'

export function DeleteConfirm({ snapshot }: { snapshot: BoardSnapshot }) {
  const cardId = useBoardUi((state) => state.confirmDeleteId)
  const askDelete = useBoardUi((state) => state.askDelete)
  const card = snapshot.cards.find((item) => item.id === cardId) ?? snapshot.archived.find((item) => item.id === cardId)
  if (!card) return null
  const confirm = () => {
    askDelete(null)
    void act({ type: 'board/delete', cardId: card.id })
  }
  return (
    <Dialog open onOpenChange={(open) => !open && askDelete(null)}>
      <DialogContent
        className="max-w-[400px]"
        aria-describedby={undefined}
        role="alertdialog"
        onKeyDown={(event) => {
          // A focused button answers Enter itself (Cancel cancels).
          if (event.key !== 'Enter' || (event.target as HTMLElement).closest('button')) return
          event.preventDefault()
          confirm()
        }}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <DialogTitle>Delete this task?</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-ink-muted">“{card.title}” moves to the system trash with its history. You can restore the file from there.</p>
        </div>
        <DialogFooter>
          <DialogButton variant="secondary" onClick={() => askDelete(null)}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger" onClick={confirm}>
            Delete
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

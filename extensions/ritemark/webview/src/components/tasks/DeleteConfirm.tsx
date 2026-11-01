/**
 * DeleteConfirm — the board's one question before something leaves it
 * (Sprint 130). "Delete this task?": the card file goes to the system trash
 * with its history; its page, if open, closes with it. "Remove <file>?"
 * (Sprint 145, #596; experience 41): a file the board couldn't read goes to the
 * system trash, the Recycle Bin on Windows. Enter confirms and Escape cancels
 * (Jarmo, 2026-10-13).
 */

import { useEffect } from 'react'
import type { BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { isWindows } from '../../hooks/usePlatform'
import { Dialog, DialogBody, DialogButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { act, removeFile, useBoardUi } from './boardUi'
import { unreadableFileWords } from './taskCopy'

export function DeleteConfirm({ snapshot }: { snapshot: BoardSnapshot }) {
  const cardId = useBoardUi((state) => state.confirmDeleteId)
  const askDelete = useBoardUi((state) => state.askDelete)
  const fileName = useBoardUi((state) => state.confirmRemoveFile)
  const askRemoveFile = useBoardUi((state) => state.askRemoveFile)
  const card = snapshot.cards.find((item) => item.id === cardId) ?? snapshot.archived.find((item) => item.id === cardId)
  const file = fileName ? snapshot.unreadable.find((item) => item.fileName === fileName) : undefined
  // A file that was read (or went) while its question was open: the question goes, and doesn't come back later
  // if the same name can't be read again.
  useEffect(() => {
    if (fileName && !file) askRemoveFile(null)
  }, [fileName, file, askRemoveFile])
  if (card) {
    return (
      <Question
        title="Delete this task?"
        body={`“${card.title}” moves to the system trash with its history. You can restore the file from there.`}
        confirmLabel="Delete"
        onCancel={() => askDelete(null)}
        onConfirm={() => {
          askDelete(null)
          void act({ type: 'board/delete', cardId: card.id })
        }}
      />
    )
  }
  if (file) {
    const words = unreadableFileWords(file.fileName, isWindows)
    return (
      <Question
        title={words.question}
        body={words.questionBody}
        confirmLabel="Remove"
        onCancel={() => askRemoveFile(null)}
        onConfirm={() => {
          askRemoveFile(null)
          void removeFile(file.fileName, file.message)
        }}
      />
    )
  }
  return null
}

function Question({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-w-[400px]"
        role="alertdialog"
        onKeyDown={(event) => {
          // A focused button answers Enter itself (Cancel cancels).
          if (event.key !== 'Enter' || (event.target as HTMLElement).closest('button')) return
          event.preventDefault()
          onConfirm()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>{body}</DialogDescription>
        </DialogBody>
        <DialogFooter>
          <DialogButton variant="secondary" onClick={onCancel}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

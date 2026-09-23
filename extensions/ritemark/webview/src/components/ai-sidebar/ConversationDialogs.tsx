/**
 * Rename and delete for a conversation — the dialogs History has always used,
 * moved here unchanged so the conversation header (Sprint 122, #282) opens the
 * very same ones. `useConversationDialogs()` owns their state and the store
 * calls; a surface only asks for a rename or a delete and renders `dialogs`.
 */
import { useState, type ReactNode } from 'react';
import type { ConversationSummaryV1 } from '../../../../src/conversations/types';
import {
  Dialog,
  DialogBody,
  DialogButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { deleteConfirmLabel, isConversationRunning } from './conversationActionsModel';
import { useAISidebarStore } from './store';

export interface DeleteTarget {
  summary: ConversationSummaryV1;
  /** An "earlier" conversation with no known project, from History's recovery list. */
  recovery: boolean;
}

// Radix portals into the full webview, which also contains the permanent 56px rail.
// The 56px ThreadRail used to paint over dialogs (z-60 vs z-50), so this
// dialog shifted and shrank to dodge it. The dialog now sits at z-80, so only
// the max-width remains — and below 640px DialogContent goes full bleed anyway.
const CONVERSATION_DIALOG_LAYOUT = 'max-w-[320px]';
const CONVERSATION_DIALOG_FOOTER_LAYOUT = 'flex-col gap-2 px-4 min-[280px]:flex-row min-[280px]:gap-2.5 min-[280px]:px-5';
const CONVERSATION_DIALOG_ACTION_LAYOUT = 'w-full min-[280px]:w-auto';

function RenameConversationDialog({
  target,
  title,
  onTitleChange,
  onClose,
  onSave,
}: {
  target: ConversationSummaryV1 | null;
  title: string;
  onTitleChange: (title: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={CONVERSATION_DIALOG_LAYOUT}>
        <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
          <DialogHeader><DialogTitle>Rename conversation</DialogTitle></DialogHeader>
          <DialogBody>
            <DialogDescription className="sr-only">Choose a new title for this conversation.</DialogDescription>
            <label className="block text-[12px] font-medium text-[var(--r-ink-body)]" htmlFor="conversation-title">Title</label>
            <input
              id="conversation-title"
              autoFocus
              maxLength={80}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="mt-1.5 w-full rounded-[6px] border border-[var(--r-hairline-strong)] bg-[var(--r-surface)] px-3 py-2 text-[13px] text-[var(--r-ink-strong)] outline-none focus:border-[var(--r-accent)] focus:ring-4 focus:ring-[var(--r-ring-color)]"
            />
          </DialogBody>
          <DialogFooter className={CONVERSATION_DIALOG_FOOTER_LAYOUT}>
            <DialogButton type="button" variant="secondary" className={CONVERSATION_DIALOG_ACTION_LAYOUT} onClick={onClose}>Cancel</DialogButton>
            <DialogButton type="submit" className={CONVERSATION_DIALOG_ACTION_LAYOUT} disabled={!title.trim()}>Save</DialogButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConversationDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={CONVERSATION_DIALOG_LAYOUT}>
        <DialogHeader><DialogTitle>Delete conversation?</DialogTitle></DialogHeader>
        <DialogBody className="min-w-0">
          <DialogDescription className="break-words">“{target?.summary.title}” will be removed from {target?.recovery ? 'earlier conversations' : 'this project'}.</DialogDescription>
        </DialogBody>
        <DialogFooter className={CONVERSATION_DIALOG_FOOTER_LAYOUT}>
          <DialogButton type="button" variant="secondary" className={CONVERSATION_DIALOG_ACTION_LAYOUT} onClick={onClose}>Cancel</DialogButton>
          <DialogButton type="button" variant="danger" className={CONVERSATION_DIALOG_ACTION_LAYOUT} onClick={onConfirm}>{target ? deleteConfirmLabel(target.summary) : 'Delete'}</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConversationDialogs(): {
  requestRename: (summary: ConversationSummaryV1) => void;
  requestDelete: (summary: ConversationSummaryV1, recovery?: boolean) => void;
  dialogs: ReactNode;
} {
  const rename = useAISidebarStore((state) => state.renameHostConversation);
  const remove = useAISidebarStore((state) => state.deleteHostConversation);
  const [renameTarget, setRenameTarget] = useState<ConversationSummaryV1 | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const saveRename = () => {
    if (!renameTarget || !renameTitle.trim()) return;
    rename(renameTarget.conversationId, renameTitle);
    setRenameTarget(null);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove(deleteTarget.summary.conversationId, isConversationRunning(deleteTarget.summary), deleteTarget.recovery);
    setDeleteTarget(null);
  };

  return {
    requestRename: (summary) => {
      setRenameTarget(summary);
      setRenameTitle(summary.title);
    },
    requestDelete: (summary, recovery = false) => setDeleteTarget({ summary, recovery }),
    dialogs: (
      <>
        <RenameConversationDialog target={renameTarget} title={renameTitle} onTitleChange={setRenameTitle} onClose={() => setRenameTarget(null)} onSave={saveRename} />
        <DeleteConversationDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      </>
    ),
  };
}

/**
 * ThreadCapDialog — Sprint 99 (R11 + Resolved Gaps 2 and 3).
 *
 * The soft cap is FIVE open threads, and "soft" is the whole point: this dialog
 * offers idle threads to close when there are any, and when every thread is busy
 * it explains the cost and opens the new thread anyway. A cap that blocked the
 * user when all their agents were working would punish exactly the workflow this
 * sprint exists to enable.
 *
 * Reopening from History goes through the same gate (Gap 3) — a reopened thread
 * is an open thread, and exempting it would be an easy way to reach ten.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogButton,
} from '../ui/dialog';
import { Icon } from '../ui/Icon';
import { useAISidebarStore } from './store';
import {
  SOFT_THREAD_CAP,
  canCloseThread,
  deriveThreadStatus,
  deriveThreadTitle,
  runtimeOfConversation,
} from './threadStatus';

export function ThreadCapDialog() {
  const pendingThreadOpen = useAISidebarStore((s) => s.pendingThreadOpen);
  const conversations = useAISidebarStore((s) => s.conversations);
  const promptQueues = useAISidebarStore((s) => s.promptQueues);
  const closeConversation = useAISidebarStore((s) => s.closeConversation);
  const confirmThreadOpen = useAISidebarStore((s) => s.confirmThreadOpen);
  const cancelThreadOpen = useAISidebarStore((s) => s.cancelThreadOpen);

  if (!pendingThreadOpen) return null;

  const closable = Object.values(conversations)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({
      id: c.id,
      title: deriveThreadTitle(c),
      runtime: runtimeOfConversation(c),
      status: deriveThreadStatus(c),
      hasQueuedPrompt: (promptQueues[c.id]?.length ?? 0) > 0,
    }))
    .filter((t) => canCloseThread(t.status, t.hasQueuedPrompt));

  const handleCloseThenOpen = (id: string) => {
    closeConversation(id);
    confirmThreadOpen();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) cancelThreadOpen(); }}>
      <DialogContent>
        <DialogHeader icon={<Icon name="robot" size={20} />} onClose={cancelThreadOpen}>
          <DialogTitle>You have {SOFT_THREAD_CAP} threads open</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {closable.length > 0 ? (
            <>
              <p className="text-[13px] text-[var(--r-ink-body)]">
                Close one you are finished with to keep things manageable — its conversation
                stays in History.
              </p>
              <div className="mt-3 flex flex-col gap-1">
                {closable.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => handleCloseThenOpen(thread.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-[var(--r-surface-soft)]"
                  >
                    <span className="flex shrink-0" style={{ color: 'var(--r-accent)' }}>
                      <Icon name="robot" size={14} tone="inherit" />
                    </span>
                    <span className="flex-1 min-w-0 truncate text-[13px]">{thread.title}</span>
                    <span className="shrink-0 text-[11px] text-[var(--r-ink-muted)]">Close</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-[var(--r-ink-body)]">
              Every open thread is still working or waiting on you, so there is nothing to
              close. You can open another one anyway — running many agents at once will make
              each of them slower.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogButton variant="secondary" onClick={cancelThreadOpen}>Cancel</DialogButton>
          <DialogButton onClick={confirmThreadOpen}>Open anyway</DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

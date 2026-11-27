import { useEffect, useRef } from 'react';
import { FEEDBACK_COPY } from '../../../../src/feedback/feedbackCopy';
import { Button } from '../ui/button';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/tooltip';
import { ANSWER_FEEDBACK_COPY as copy } from './answerFeedbackCopy';
import { FeedbackLink } from './FeedbackLink';
import { answerFeedbackStore, feedbackEntry, type AnswerTarget } from './answerFeedbackState';

export function AnswerFeedbackControls({
  target, openForm, closeForm,
}: {
  target: AnswerTarget; openForm(): void; closeForm(): void;
}) {
  const { reaction, pendingReaction, markSent, wordsSent } = answerFeedbackStore((state) => feedbackEntry(state, target));
  const mark = pendingReaction ?? reaction;
  return (
    <div data-answer-feedback-controls className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-ink-muted">
      {(wordsSent || (mark === 'up' && reaction === 'up' && markSent)) && <span role="status">{copy.thanks}</span>}
      {mark === 'up' && !wordsSent && <FeedbackLink onClick={openForm}>{copy.tellUsMore}</FeedbackLink>}
      {(['up', 'down'] as const).map((thumb) => {
        if (mark !== 'none' && mark !== thumb) return null;
        const pressed = mark === thumb;
        const label = pressed ? copy.takeBack : thumb === 'up' ? copy.goodAnswer : copy.notRight;
        return (
          <Tooltip key={thumb} label={label} asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={`size-6 ${pressed ? 'text-ink-strong' : 'text-ink-muted'}`}
              aria-label={label}
              aria-pressed={pressed}
              aria-disabled={pendingReaction !== undefined || undefined}
              onClick={() => {
                if (!answerFeedbackStore.getState().react(target, pressed ? 'none' : thumb)) return;
                if (pressed) closeForm();
                else if (thumb === 'down') openForm();
              }}
            >
              <Icon name={thumb === 'up' ? 'thumbs-up' : 'thumbs-down'} size={14} className="size-3.5" tone="inherit" weight={pressed ? 'fill' : 'regular'} />
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function AnswerFeedbackForm({ target, close }: { target: AnswerTarget; close(): void }) {
  const { text, sending, failed } = answerFeedbackStore((state) => feedbackEntry(state, target));
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const { conversationId, turnId } = target;
  const omitted = !text.trim();
  const send = <Button type="submit" size="sm" disabled={sending || omitted}>{copy.send}</Button>;

  useEffect(() => {
    const trigger = document.activeElement;
    const restoreFocus = (sent = false) => {
      if (!(trigger instanceof HTMLElement) || !form.current?.contains(document.activeElement)) return;
      const thumb = sent && trigger.closest('[data-answer-feedback-controls]')
        ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      (thumb || trigger).focus({ preventScroll: true });
    };
    input.current?.focus({ preventScroll: true });
    input.current?.scrollIntoView({ block: 'nearest' });
    const onPointerDown = (event: PointerEvent) => {
      if (!form.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      restoreFocus();
      close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    const unsubscribe = answerFeedbackStore.subscribe((next, previous) => {
      const scopedTarget = { conversationId, turnId };
      const before = feedbackEntry(previous, scopedTarget);
      const after = feedbackEntry(next, scopedTarget);
      if (before.sending && !after.sending && !after.failed) {
        restoreFocus(true);
        close();
      }
    });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      unsubscribe();
    };
  }, [close, conversationId, turnId]);

  return (
    <form
      ref={form}
      className="ml-auto w-[312px] max-w-full rounded-lg bg-surface p-2 ring-1 ring-hairline"
      onSubmit={(event) => {
        event.preventDefault();
        answerFeedbackStore.getState().send(target);
      }}
    >
      <textarea
        ref={input}
        rows={2}
        maxLength={2000}
        aria-label={copy.placeholder}
        placeholder={copy.placeholder}
        value={text}
        readOnly={sending}
        onChange={(event) => answerFeedbackStore.getState().edit(target, event.currentTarget.value)}
        className="block min-h-[52px] w-full resize-none rounded-md border border-hairline bg-surface px-2 py-1 text-[13px] leading-5 text-ink-body outline-none placeholder:text-ink-muted focus:border-[var(--r-focus-ring)] focus:ring-1 focus:ring-[var(--r-focus-ring)] [field-sizing:content]"
      />
      {failed && <p role="alert" className="mt-1 text-[12px] text-[var(--r-error)]">{FEEDBACK_COPY.card.failed}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <FeedbackLink onClick={() => {
          if (sending) return;
          answerFeedbackStore.getState().openWithAnswer(target);
          close();
        }}>{copy.addAnswer}</FeedbackLink>
        {omitted ? <Tooltip label={copy.writeFirst}>{send}</Tooltip> : send}
      </div>
    </form>
  );
}

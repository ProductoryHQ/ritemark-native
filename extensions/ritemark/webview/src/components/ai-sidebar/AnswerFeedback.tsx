import { useEffect, useRef } from 'react';
import { FEEDBACK_COPY } from '../../../../src/feedback/feedbackCopy';
import { focusTrigger, useDismissOnOutside } from '../../lib/dismissOnOutside';
import { Button } from '../ui/button';
import { Icon } from '../ui/Icon';
import { Textarea } from '../ui/textarea';
import { Tooltip } from '../ui/tooltip';
import { ANSWER_FEEDBACK_COPY as copy } from './answerFeedbackCopy';
import { FeedbackLink } from './FeedbackLink';
import { answerFeedbackStore, feedbackEntry, type AnswerTarget } from './answerFeedbackState';

export function AnswerFeedbackControls({
  target, openForm, closeForm,
}: {
  target: AnswerTarget; openForm(trigger: () => HTMLButtonElement | null): void; closeForm(): void;
}) {
  const { reaction, pendingReaction, markSent, wordsSent } = answerFeedbackStore((state) => feedbackEntry(state, target));
  const mark = pendingReaction ?? reaction;
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  return (
    <div data-answer-feedback-controls className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-ink-muted">
      {(wordsSent || (mark === 'up' && reaction === 'up' && markSent)) && <span role="status">{copy.thanks}</span>}
      {mark === 'up' && !wordsSent && <FeedbackLink onClick={() => openForm(() => up.current)}>{copy.tellUsMore}</FeedbackLink>}
      {(['up', 'down'] as const).map((thumb) => {
        if (mark !== 'none' && mark !== thumb) return null;
        const pressed = mark === thumb;
        const label = pressed ? copy.takeBack : thumb === 'up' ? copy.goodAnswer : copy.notRight;
        return (
          <Tooltip key={thumb} label={label} side="top" asChild>
            <Button
              ref={thumb === 'up' ? up : down}
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
                else if (thumb === 'down') openForm(() => down.current);
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

export function AnswerFeedbackForm({ target, close, trigger }: {
  target: AnswerTarget; close(): void; trigger?: () => HTMLButtonElement | null;
}) {
  const { text, sending, failed, openingSheet } = answerFeedbackStore((state) => feedbackEntry(state, target));
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const { conversationId, turnId } = target;
  const omitted = !text.trim();
  const busy = sending || openingSheet !== undefined;
  const send = <Button type="submit" size="sm" disabled={busy || omitted}>{copy.send}</Button>;
  useDismissOnOutside(form, close, { trigger });

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.scrollIntoView({ block: 'nearest' });
    return answerFeedbackStore.subscribe((next, previous) => {
      const scopedTarget = { conversationId, turnId };
      const before = feedbackEntry(previous, scopedTarget);
      const after = feedbackEntry(next, scopedTarget);
      const sent = before.sending && !after.sending;
      const opened = before.openingSheet !== undefined && after.openingSheet === undefined;
      if (!after.failed && (sent || opened)) {
        if (form.current?.contains(document.activeElement)) focusTrigger(trigger?.());
        close();
      }
    });
  }, [close, conversationId, turnId, trigger]);

  return (
    <form
      ref={form}
      className="ml-auto w-[312px] max-w-full rounded-lg bg-surface p-2 ring-1 ring-hairline"
      onSubmit={(event) => {
        event.preventDefault();
        answerFeedbackStore.getState().send(target);
      }}
    >
      <Textarea
        ref={input}
        rows={2}
        maxLength={2000}
        aria-label={copy.placeholder}
        placeholder={copy.placeholder}
        value={text}
        readOnly={busy}
        onChange={(event) => answerFeedbackStore.getState().edit(target, event.currentTarget.value)}
        className="block min-h-[52px] resize-none rounded-md border-hairline bg-surface px-2 py-1 text-[13px] leading-5 text-ink-body placeholder:text-ink-muted [field-sizing:content]"
      />
      {failed && <p role="alert" className="mt-1 text-[12px] text-[var(--r-error)]">{FEEDBACK_COPY.card.failed}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <FeedbackLink disabled={busy} onClick={() => answerFeedbackStore.getState().openWithAnswer(target)}>{copy.addAnswer}</FeedbackLink>
        {omitted ? <Tooltip label={copy.writeFirst}>{send}</Tooltip> : send}
      </div>
    </form>
  );
}

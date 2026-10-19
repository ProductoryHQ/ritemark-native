/**
 * The browser's share question, on the AI's sheet above the message box
 * (Sprint 134, R20; experience 28, frame 1). It replaces upstream's modal
 * "Share with Agent?" dialog, which blocked the window (#455): the tabs stay
 * usable while it waits. Nothing about the page reaches the AI before Share.
 */

import { useId, useState } from 'react'
import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'

export function shareQuestionWords(aiName: string) {
  return {
    title: `Share this page with ${aiName}?`,
    line: `${aiName} reads the page you have open, so you can ask about it. It cannot click or type on it without asking.`,
    share: 'Share this page',
    shareTip: `Let ${aiName} read this page`,
    notNow: 'Not now',
    notNowTip: `${aiName} won't read this page`,
    withoutAsking: 'Share pages I open in Ritemark without asking',
  }
}

export function ShareQuestionCard({ aiName, pageTitle, onAnswer }: {
  aiName: string
  /** The page asked about, read out before the line. */
  pageTitle: string
  onAnswer: (answer: 'share' | 'notNow', withoutAsking: boolean) => void
}) {
  const words = shareQuestionWords(aiName)
  const [withoutAsking, setWithoutAsking] = useState(false)
  const titleId = useId()
  const boxId = useId()
  return (
    <section
      role="region"
      aria-labelledby={titleId}
      className="mx-3 mb-2 rounded-[10px] bg-[var(--r-surface)] px-3.5 py-3 font-ui text-[13px] leading-[19px] text-[var(--r-ink-body)] shadow-[0_0_0_1px_var(--r-hairline),0_4px_12px_-4px_rgba(30,27,75,0.12)]"
    >
      <h2 id={titleId} className="m-0 mb-0.5 text-[13px] font-semibold leading-[19px] text-[var(--r-ink-strong)]">{words.title}</h2>
      <p className="m-0"><span className="sr-only">{pageTitle}. </span>{words.line}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Tooltip label={words.shareTip}>
          <Button size="sm" className="h-7 whitespace-nowrap px-2.5" onClick={() => onAnswer('share', withoutAsking)}>{words.share}</Button>
        </Tooltip>
        <Tooltip label={words.notNowTip}>
          <Button size="sm" variant="ghost" className="h-7 whitespace-nowrap px-2" onClick={() => onAnswer('notNow', false)}>{words.notNow}</Button>
        </Tooltip>
      </div>
      <label htmlFor={boxId} className="mt-2 flex cursor-pointer items-center gap-1.5 text-[12px] leading-4 text-[var(--r-ink-muted)]">
        <input
          id={boxId}
          type="checkbox"
          checked={withoutAsking}
          onChange={(event) => setWithoutAsking(event.target.checked)}
          className="m-0 size-3.5 cursor-pointer accent-[var(--r-accent)]"
        />
        {words.withoutAsking}
      </label>
    </section>
  )
}

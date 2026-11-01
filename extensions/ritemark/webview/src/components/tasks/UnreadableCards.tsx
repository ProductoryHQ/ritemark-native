/**
 * UnreadableCards — files in the task folder the board can't use (Sprint 130,
 * spec R4; Sprint 145, #596, experience 41). They are never written to. Each
 * row says once, in plain words, what happened (the host's sentence), and its
 * buttons say what the file allows:
 *   - a file that couldn't be read: Try again and Remove;
 *   - a card whose front matter has a mistake: Open to fix it and Remove (the
 *     whole row also opens the file, as before);
 *   - a card a newer Ritemark wrote: Remove only.
 * Remove asks once (DeleteConfirm) and moves the file to the system trash.
 *
 * The board draws the rows as quiet cards below the columns; the Tasks side
 * bar draws the same rows narrower, the buttons under the sentence.
 */

import { useEffect } from 'react'
import type { BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { isWindows } from '../../hooks/usePlatform'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { notify } from './boardClient'
import { forgetFileStates, retryFile, useBoardUi } from './boardUi'
import { SECTION } from './CardParts'
import { unreadableFileWords } from './taskCopy'

type UnreadableFile = BoardSnapshot['unreadable'][number]

export function UnreadableCards({ snapshot, variant = 'list' }: { snapshot: BoardSnapshot; variant?: 'board' | 'list' }) {
  // A row that went (read, fixed, removed elsewhere) takes what it carried with it.
  const listed = snapshot.unreadable.map((file) => file.fileName).join('\n')
  useEffect(() => {
    forgetFileStates(new Set(listed ? listed.split('\n') : []))
  }, [listed])
  if (!snapshot.unreadable.length) return null
  return (
    <div className="mb-1">
      <div className={SECTION}>
        <span>Couldn’t read</span>
        <span className="font-semibold normal-case tracking-normal">· {snapshot.unreadable.length}</span>
      </div>
      <div className={variant === 'board' ? 'px-4 pt-0.5' : undefined}>
        {snapshot.unreadable.map((file) => (
          <UnreadableRow key={file.fileName} file={file} variant={variant} />
        ))}
      </div>
    </div>
  )
}

function UnreadableRow({ file, variant }: { file: UnreadableFile; variant: 'board' | 'list' }) {
  const state = useBoardUi((ui) => ui.files[file.fileName])
  const askRemoveFile = useBoardUi((ui) => ui.askRemoveFile)
  const words = unreadableFileWords(file.fileName, isWindows)
  // A build that sends no reason gets the row it always had: Open to fix it.
  const reason = file.reason ?? 'format'
  const busy = state?.busy
  const board = variant === 'board'
  const open = () => notify({ type: 'board/open-card', fileName: file.fileName })
  const button = cn('gap-1.5 px-[9px] text-[12.5px] has-[>svg]:px-[9px]', board ? 'h-[26px]' : 'h-6 px-2 text-[12px] has-[>svg]:px-2')

  const actions = (
    <div className={cn('pointer-events-auto relative z-10 flex items-center', board ? 'shrink-0 gap-1' : '-ml-2 mt-1 flex-wrap gap-0.5')}>
      {reason === 'read' ? (
        <Tooltip label={busy === 'retrying' ? words.tryingTip : words.tryAgainTip}>
          <Button
            type="button"
            variant={board ? 'outline' : 'ghost'}
            className={cn(button, !board && 'text-ink-body')}
            disabled={Boolean(busy)}
            onClick={() => void retryFile(file.fileName)}
          >
            {busy === 'retrying' ? <Icon name="circle-notch" size={12} tone="inherit" className="tb-spin size-3" /> : null}
            {busy === 'retrying' ? 'Trying…' : 'Try again'}
          </Button>
        </Tooltip>
      ) : reason === 'format' ? (
        <Tooltip label={words.openTip}>
          <Button type="button" variant={board ? 'outline' : 'ghost'} className={cn(button, !board && 'text-ink-body')} disabled={Boolean(busy)} onClick={open}>
            Open to fix it
          </Button>
        </Tooltip>
      ) : null}
      <Tooltip label={busy === 'retrying' ? words.waitTip : busy === 'removing' ? words.removingTip : words.removeTip}>
        <Button
          type="button"
          variant="ghost"
          className={cn(button, 'text-ink-body')}
          disabled={Boolean(busy)}
          onClick={() => askRemoveFile(file.fileName)}
        >
          Remove
        </Button>
      </Tooltip>
    </div>
  )

  // The trash's refusal stands in for the row's own sentence until that sentence changes.
  const note = state?.note !== undefined && state.sentence === file.message ? state.note : null
  const sentence = note ?? file.message
  return (
    <div
      className={cn(
        'group relative',
        board ? 'mb-2 flex items-start gap-2.5 rounded-lg bg-surface px-3 py-2.5 shadow-[0_0_0_1px_var(--r-hairline)]' : 'flex items-start gap-2 px-4 pb-3',
        reason === 'format' && 'hover:bg-surface-soft',
      )}
    >
      {reason === 'format' ? (
        // The whole row opens the file, as it always did: a card with a mistake is fixed in the file itself.
        <Tooltip label={words.openTip} className="absolute inset-0">
          <button
            type="button"
            className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            aria-label={`${file.fileName}: ${file.message}`}
            onClick={open}
          />
        </Tooltip>
      ) : null}
      <span className="pointer-events-none relative inline-flex shrink-0 text-ink-muted">
        <Icon name="file-dashed" size={board ? 16 : 14} tone="inherit" className={board ? 'mt-px size-4' : 'mt-0.5 size-3.5'} />
      </span>
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className={cn('truncate text-ink-strong', board ? 'text-[13px] font-semibold leading-[18px]' : 'text-[13px] font-medium leading-[18px]')}>{file.fileName}</div>
        <div
          className={cn(
            'mt-0.5 [text-wrap:pretty]',
            note ? 'text-ink-strong' : 'text-ink-body',
            board ? 'text-[12px] leading-[17px]' : 'line-clamp-2 text-[11.5px] leading-4',
          )}
        >
          {sentence}
        </div>
        {board ? null : actions}
      </div>
      {board ? actions : null}
    </div>
  )
}

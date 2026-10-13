/**
 * UnreadableCards — card files whose front matter does not read (Sprint 130,
 * spec R4). They are never written to; clicking one opens the file as a plain
 * document, where the broken front matter can be fixed.
 */

import type { BoardSnapshot } from '../../../../src/taskBoard/protocol'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { notify } from './boardClient'
import { SECTION } from './CardParts'

export function UnreadableCards({ snapshot }: { snapshot: BoardSnapshot }) {
  if (!snapshot.unreadable.length) return null
  return (
    <div className="mb-1">
      <div className={SECTION}>
        <span>Couldn’t read</span>
        <span className="font-semibold normal-case tracking-normal">· {snapshot.unreadable.length}</span>
      </div>
      {snapshot.unreadable.map((file) => (
        <div key={file.fileName} className="group relative flex items-start gap-2.5 px-4 py-2.5 hover:bg-surface-soft">
          <Tooltip label={`Open ${file.fileName} to fix it`} className="absolute inset-0">
            <button
              type="button"
              className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              aria-label={`${file.fileName}, couldn’t read this card`}
              onClick={() => notify({ type: 'board/open-card', fileName: file.fileName })}
            />
          </Tooltip>
          <span className="inline-flex shrink-0 tone-amber">
            <Icon name="warning" size={16} tone="inherit" className="tb-glyph" />
          </span>
          <div className="pointer-events-none relative min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink-strong">{file.fileName}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px] text-ink-muted">Couldn’t read this card. {file.message}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Notice — a short line at the bottom of a board surface when the host refused
 * something (Sprint 130): "Only the user marks a card done.", "ChatGPT is signed
 * out. Sign in and try again." It goes by itself after a few seconds.
 */

import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { useBoardUi } from './boardUi'

export function Notice() {
  const notice = useBoardUi((state) => state.notice)
  const showNotice = useBoardUi((state) => state.showNotice)
  if (!notice) return null
  return (
    <div className="tb-toast" role="status" aria-live="polite">
      <span className="flex-1">{notice}</span>
      <Tooltip label="Dismiss">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          className="size-5 text-inherit opacity-70 hover:bg-transparent hover:text-inherit hover:opacity-100"
          onClick={() => showNotice(null)}
        >
          <Icon name="x" size={14} tone="inherit" className="size-3.5" />
        </Button>
      </Tooltip>
    </div>
  )
}

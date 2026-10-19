/**
 * TasksPanel — the Tasks side bar (Sprint 130, design.md §3), under the
 * project's head since Sprint 134 (R16–R17). Without a folder it offers one;
 * with the board turned off it says so; otherwise it shows the list
 * (`TasksList.tsx`): the head's New task and Search, and the tasks in the
 * order work moves.
 */

import { useEffect } from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { notify, startBoard, useBoardSnapshot } from './boardClient'
import { TasksList } from './TasksList'
import './tasks.css'

export function TasksPanel() {
  const snapshot = useBoardSnapshot()
  useEffect(() => startBoard('sidebar'), [])
  if (!snapshot) return null
  if (snapshot.folder === null) {
    return (
      <div className="flex h-full flex-col font-ui text-ink-strong">
        <div className="px-4 py-6 text-center">
          <div className="text-[13px] font-semibold text-ink-strong">Open a folder to keep a task board</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">Tasks stay in the folder, so they travel with your project.</p>
          <div className="mt-3 flex justify-center">
            <Tooltip label="Choose a project folder">
              <Button type="button" size="sm" onClick={() => notify({ type: 'board/recover', action: 'open-folder' })}>
                <Icon name="folder-open" size={16} tone="inherit" />
                Open folder…
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    )
  }
  if (!snapshot.enabled) {
    return <p className="px-4 py-6 text-center font-ui text-xs leading-relaxed text-ink-muted">The task board is turned off.</p>
  }
  return <TasksList snapshot={snapshot} />
}

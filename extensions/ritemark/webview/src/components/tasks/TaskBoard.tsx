/**
 * TaskBoard — the Task board tab in the editor area (Sprint 130, design.md §4):
 * Your calls · Board · Ideas · Log under one heading. The header pill says how
 * many tasks wait on the user, how long the oldest has waited and whether an
 * agent is blocked; it opens Your calls. The open view survives a restart
 * (`vscode.setState`).
 */

import { useEffect, useState } from 'react'
import type { BoardSnapshot, BoardTab } from '../../../../src/taskBoard/protocol'
import { vscode } from '../../lib/vscode'
import { cn } from '../../lib/utils'
import { Icon } from '../ui/Icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Tooltip } from '../ui/tooltip'
import { BoardColumns } from './BoardColumns'
import { onFocus, startBoard, useBoardSnapshot } from './boardClient'
import { CallsView } from './CallsView'
import { DeleteConfirm } from './DeleteConfirm'
import { useNow } from './CardParts'
import { IdeasView } from './IdeasView'
import { LogView } from './LogView'
import { Notice } from './Notice'
import { waited } from './taskCopy'
import './tasks.css'

function savedTab(): BoardTab {
  const state = vscode.getState() as { tab?: BoardTab } | null
  return state?.tab ?? 'board'
}

export function TaskBoard() {
  const snapshot = useBoardSnapshot()
  const [tab, setTab] = useState<BoardTab>(savedTab)
  useEffect(() => startBoard('panel'), [])
  useEffect(() => {
    vscode.setState({ ...((vscode.getState() as object | null) ?? {}), tab })
  }, [tab])
  useEffect(
    () =>
      onFocus((target) => {
        if (target.tab) setTab(target.tab)
      }),
    [],
  )
  if (!snapshot) return null
  if (snapshot.folder === null || !snapshot.enabled) {
    return (
      <div className="px-6 py-8 font-ui text-[13px] text-ink-muted">
        {snapshot.folder === null ? 'Open a folder to keep a task board.' : 'The task board is turned off.'}
      </div>
    )
  }
  return <Board snapshot={snapshot} tab={tab} setTab={setTab} />
}

function Board({ snapshot, tab, setTab }: { snapshot: BoardSnapshot; tab: BoardTab; setTab: (tab: BoardTab) => void }) {
  const now = useNow()
  const ideas = snapshot.cards.filter((card) => card.stage === 'idea' && !card.dropped).length
  const { count, blocked, oldestSince } = snapshot.attention
  return (
    <div className="flex h-full flex-col font-ui text-ink-strong">
      <Tabs value={tab} onValueChange={(value) => setTab(value as BoardTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="tb-board-head">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-ink-strong">Task board</h1>
            <span className="text-[13px] text-ink-muted">{snapshot.folder}</span>
            {count ? (
              <Tooltip label="Open Your calls" className="ml-auto">
                <button type="button" className={cn('tb-waitpill', blocked && 'blocked')} onClick={() => setTab('calls')}>
                  <Icon name={blocked ? 'warning' : 'hand-pointing'} size={14} tone="inherit" />
                  <b>
                    {count} wait{count === 1 ? 's' : ''} on you
                  </b>
                  <span>
                    · oldest {waited(oldestSince, now)}
                    {blocked ? ` · ${blocked} agent${blocked > 1 ? 's' : ''} blocked` : ''}
                  </span>
                </button>
              </Tooltip>
            ) : null}
          </div>
          <TabsList aria-label="Board views" className="mt-3">
            <TabsTrigger value="calls">
              Your calls<span className={cn('tb-count', count && 'hot')}>{count}</span>
            </TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="ideas">
              Ideas<span className="tb-count">{ideas}</span>
            </TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>
        </div>
        <div className="tb-scroll min-h-0 flex-1" style={{ overflow: 'auto' }}>
          <TabsContent value="calls">
            <CallsView snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="board">
            <BoardColumns snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="ideas">
            <IdeasView snapshot={snapshot} />
          </TabsContent>
          <TabsContent value="log">
            <LogView snapshot={snapshot} />
          </TabsContent>
        </div>
      </Tabs>
      <DeleteConfirm snapshot={snapshot} />
      <Notice />
    </div>
  )
}

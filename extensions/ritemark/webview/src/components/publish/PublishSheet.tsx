/**
 * The Publish sheet (Sprint 149, R4, R5; frame 3, the Experience lead's answers 3 and 4).
 *
 * One small sheet that says exactly what will be public before anything goes: where (PR 4), the address (PR 4), what
 * goes (the line, See the files folded, Left out with its reasons; nothing to untick), the key warning when the scan
 * found something, and who can see it. Cancel sends nothing. With a key-shaped hit, Cancel is the main button and
 * Publish reads "Publish anyway", the quiet one: the second, explicit press of decision 2.
 *
 * It shows only what the host sent: names, folders, reasons, line numbers. It holds no value, path or token, and it
 * answers with `publish:cancel`, `publish:confirm` or `publish:openHit` (an index into the host's own list).
 */

import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../ui/dialog'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { vscode } from '../../lib/vscode'
import type { PublishSheetHostMessage, PublishSheetModel, PublishSheetWebviewMessage } from '../../../../src/publish/sheetProtocol'
import {
  NOTHING_ELSE,
  SCRIPT_BUILT_LINE,
  SEE_THE_FILES,
  SUBTITLE,
  WHO_CAN_SEE,
  keyWarning,
  leftOutCount,
  leftOutName,
  leftOutReasonFor,
  limitLine,
  openWords,
  sheetButtons,
  whatGoesLine,
} from './publishSheetCopy'

function send(message: PublishSheetWebviewMessage): void {
  vscode.postMessage(message)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-t border-hairline py-3">
      <div className="w-[76px] flex-none pt-px text-[12px] font-medium leading-4 text-ink-muted">{label}</div>
      <div className="min-w-0 flex-1 text-[13px] leading-[18px] text-ink-strong">{children}</div>
    </div>
  )
}

export function PublishSheetView({ model, onAnswer }: { model: PublishSheetModel; onAnswer: (m: PublishSheetWebviewMessage) => void }) {
  const [open, setOpen] = useState(false)
  const warning = keyWarning(model.keyHits)
  const limit = limitLine(model.tooBig, model.tooMany)
  const buttons = sheetButtons(model.keyHits.length > 0, limit !== null)
  const left = leftOutCount(model.leftOut)

  const cancel = (
    <Tooltip label={buttons.cancelTip}>
      <Button
        variant={buttons.main === 'cancel' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onAnswer({ type: 'publish:cancel' })}
      >
        Cancel
      </Button>
    </Tooltip>
  )
  const publish = (
    <Tooltip label={buttons.publishTip}>
      <Button
        variant={buttons.main === 'publish' ? 'default' : 'ghost'}
        size="sm"
        disabled={buttons.publishDisabled}
        onClick={() => onAnswer({ type: 'publish:confirm', anyway: model.keyHits.length > 0, pagePart: model.address?.page })}
      >
        <Icon name="globe-simple" size={16} />
        {buttons.publishWords}
      </Button>
    </Tooltip>
  )

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onAnswer({ type: 'publish:cancel' }) }}>
      <DialogContent className="max-w-[440px]" aria-describedby="publish-sheet-subtitle">
        <div className="px-5 pt-4 pb-1">
          <DialogTitle className="text-[15px] font-semibold leading-5">Publish {model.title}</DialogTitle>
          <DialogDescription id="publish-sheet-subtitle" className="mt-1 text-[13px] leading-[18px]">{SUBTITLE}</DialogDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-1">
          {model.destination && (
            <Row label="To">
              <span className="block">{model.destination.name}</span>
              <span className="block text-[12px] leading-4 text-ink-muted">{model.destination.detail}</span>
            </Row>
          )}
          {model.address && (
            // Shown as it will read; PR 4 makes the page's part editable, with the account's name row (R5)
            <Row label="Address">
              <span className="block truncate">
                {model.address.page}
                <span className="text-ink-muted">{model.address.suffix}</span>
              </span>
            </Row>
          )}
          <Row label="What goes">
            <span className="block">{whatGoesLine(model.files)}</span>
            <span className="block text-[12px] leading-4 text-ink-muted">{NOTHING_ELSE}</span>
            {model.scriptBuilt && <span className="mt-1 block text-[12px] leading-4 text-ink-muted">{SCRIPT_BUILT_LINE}</span>}
            <Tooltip label={open ? 'Hide the list of files' : 'List every file that goes, and what is left out'} className="mt-1 inline-flex">
              <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-[12px] text-ink-body" aria-expanded={open} onClick={() => setOpen(!open)}>
                <Icon name={open ? 'caret-down' : 'caret-right'} size={12} tone="inherit" />
                {left > 0 ? `${SEE_THE_FILES} · ${left} left out` : SEE_THE_FILES}
              </Button>
            </Tooltip>
            {open && (
              <div className="mt-1">
                <ul className="m-0 list-none p-0">
                  {model.files.map((f, i) => (
                    <li key={`${f.folder}/${f.name}/${i}`} className="flex min-w-0 items-baseline gap-1.5 py-0.5 text-[12px] leading-4">
                      <span className="max-w-[65%] flex-none truncate text-ink-strong">{f.name}</span>
                      <span className="flex-none text-ink-muted">·</span>
                      <span className="min-w-0 truncate text-ink-muted">{f.folder}</span>
                    </li>
                  ))}
                </ul>
                {left > 0 && (
                  <>
                    <div className="mt-2 text-[12px] font-medium leading-4 text-ink-muted">{left} left out</div>
                    <ul className="m-0 list-none p-0">
                      {model.leftOut.map((l, i) => (
                        <li key={`${l.reason}/${l.display}/${i}`} className="flex min-w-0 items-baseline gap-1.5 py-0.5 text-[12px] leading-4">
                          <span className="max-w-[60%] flex-none truncate text-ink-strong">{leftOutName(l)}</span>
                          <span className="flex-none text-ink-muted">·</span>
                          <span className="min-w-0 text-ink-muted">{leftOutReasonFor(l)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </Row>
          {limit && (
            <div className="mt-1 flex items-start gap-2.5 rounded-md bg-surface-soft px-3 py-2.5 text-[12px] leading-[18px] text-ink-strong">
              <Icon name="warning" size={16} tone="inherit" className="mt-px flex-none" />
              <span>{limit} Nothing has been sent.</span>
            </div>
          )}
          {warning && (
            <div role="alert" className="mt-1 flex items-start gap-2.5 rounded-md border border-hairline-strong bg-surface px-3 py-2.5 text-[12px] leading-[18px] text-ink-strong">
              <Icon name="shield-warning" size={16} tone="inherit" className="mt-px flex-none" />
              <div className="min-w-0">
                {warning.places.length === 1 ? (
                  <span>
                    {warning.lead} {warning.places[0].words}. {warning.tail}{' '}
                  </span>
                ) : (
                  <span className="block">{warning.lead}</span>
                )}
                {warning.places.length > 1 && (
                  <ul className="m-0 mt-0.5 list-none p-0">
                    {warning.places.map((p) => (
                      <li key={p.hit.index} className="flex min-w-0 items-baseline gap-2">
                        <span className="min-w-0 truncate">{p.words}</span>
                        <OpenHit hit={p.hit} onAnswer={onAnswer} short />
                      </li>
                    ))}
                    {warning.more && <li className="text-ink-muted">{warning.more}</li>}
                  </ul>
                )}
                {warning.places.length === 1 ? (
                  <OpenHit hit={warning.places[0].hit} onAnswer={onAnswer} />
                ) : (
                  <span className="mt-0.5 block">{warning.tail}</span>
                )}
              </div>
            </div>
          )}
          <div className="my-3 flex items-start gap-2.5 rounded-md bg-surface-soft px-3 py-2.5 text-[12px] leading-[18px] text-ink-body">
            <Icon name="link-simple" size={16} tone="inherit" className="mt-px flex-none" />
            <span>{WHO_CAN_SEE}</span>
          </div>
        </div>
        <DialogFooter className="border-t-0 pt-1 pb-4">
          {buttons.main === 'cancel' ? <>{publish}{cancel}</> : <>{cancel}{publish}</>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "Open script.js" after one place; "Open" beside each of several, its tooltip naming the file. */
function OpenHit({ hit, onAnswer, short = false }: { hit: { index: number; fileName: string; line: number }; onAnswer: (m: PublishSheetWebviewMessage) => void; short?: boolean }) {
  return (
    <Tooltip label={`Open ${hit.fileName} at line ${hit.line}, so you can take it out`} className="inline-flex flex-none">
      <Button variant="link" size="sm" className="h-auto p-0 text-[12px] font-medium" onClick={() => onAnswer({ type: 'publish:openHit', index: hit.index })}>
        {short ? 'Open' : openWords(hit)}
      </Button>
    </Tooltip>
  )
}

/** The sheet's page: waits for the host's model, then shows the sheet. */
export function PublishSheet() {
  const [model, setModel] = useState<PublishSheetModel | null>(null)
  useEffect(() => {
    const onMessage = (event: MessageEvent<PublishSheetHostMessage>) => {
      if (event.data?.type === 'publish:sheet') setModel(event.data.model)
    }
    window.addEventListener('message', onMessage)
    send({ type: 'publish:sheetReady' })
    return () => window.removeEventListener('message', onMessage)
  }, [])
  if (!model) return null
  return <PublishSheetView model={model} onAnswer={send} />
}

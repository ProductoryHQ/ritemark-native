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
 *
 * PR 4 adds frame 2 (`SetupSheetView`: Set up, the token path, before the first publish), the workers.dev name row
 * (only while the account has none) and frame 3's address field, whose page part is made web-safe as typed and keeps
 * its random end. Publish waits while either isn't ready, and while the host checks the press; a host refusal
 * ("This name is taken. Try another.") shows under its field until that field is edited.
 *
 * As a dialog (the lead, 5 November): focus moves into the sheet when it opens and the default button is ringed:
 * Publish, or Cancel when something looks like a key. Enter presses it; Esc and Cancel close the sheet. The ring
 * shows while the sheet itself holds the focus, and the focus ring takes over once Tab moves to a button.
 */

import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../ui/dialog'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/input'
import { Tooltip } from '../ui/tooltip'
import { vscode } from '../../lib/vscode'
import type { PublishSetupModel, PublishSheetHostMessage, PublishSheetModel, PublishSheetWebviewMessage, SheetRefusal } from '../../../../src/publish/sheetProtocol'
import { WorkersDevNameRow } from './WorkersDevNameRow'
import { addressHint, nameReady, pagePartReady, randomEndOf, refusalLine, SETUP_COPY, webSafePagePart } from './workersDevName'
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
  leftOutTip,
  limitLine,
  openWords,
  sheetButtons,
  showsFileList,
  whatGoesLine,
} from './publishSheetCopy'

/** The default button's ring while the sheet itself has the focus: the focus ring's look (`rm-focus-ring`). */
const DEFAULT_RING = 'group-focus/sheet:outline group-focus/sheet:outline-2 group-focus/sheet:outline-offset-2 group-focus/sheet:outline-[color:var(--r-focus-ring)]'

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

export function PublishSheetView({
  model,
  onAnswer,
  refusal = null,
  onEdit,
}: {
  model: PublishSheetModel
  onAnswer: (m: PublishSheetWebviewMessage) => void
  /** The host's last refusal of a press of Publish; cleared by `onEdit`. */
  refusal?: { reason: SheetRefusal } | null
  onEdit?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pagePart, setPagePart] = useState(model.address?.page ?? '')
  const [name, setName] = useState(model.nameRow?.suggestion ?? '')
  const [waiting, setWaiting] = useState(false)
  // A refusal or a new model ends the wait for the host's check
  useEffect(() => { setWaiting(false) }, [refusal, model])
  const warning = keyWarning(model.keyHits)
  const limit = limitLine(model.tooBig, model.tooMany)
  const base = sheetButtons(model.keyHits.length > 0, limit !== null)
  const left = leftOutCount(model.leftOut)
  const fold = showsFileList(model.files.length, model.leftOut)
  const randomEnd = randomEndOf(model.address?.page ?? '')
  const editable = model.address?.editable === true
  const addressReady = !editable || pagePartReady(pagePart)
  const nameOk = !model.nameRow || nameReady(name)
  const blocked = !addressReady || !nameOk || waiting || refusal !== null
  const buttons = blocked && !base.publishDisabled
    ? {
        ...base,
        publishDisabled: true,
        publishTip: waiting
          ? 'Ritemark is checking the address with Cloudflare'
          : !nameOk ? "Choose your pages' name first" : !addressReady ? addressHint(randomEnd) : 'Change the name or the address first',
      }
    : base
  const suffix = model.nameRow ? `.${name || 'pages'}.workers.dev` : model.address?.suffix ?? ''
  const confirm = () => {
    if (buttons.publishDisabled) return
    setWaiting(true)
    onAnswer({
      type: 'publish:confirm',
      anyway: model.keyHits.length > 0,
      pagePart: editable ? pagePart : undefined,
      subdomain: model.nameRow ? name : undefined,
    })
  }
  const pressDefault = () => {
    if (buttons.main === 'cancel') onAnswer({ type: 'publish:cancel' })
    else if (!buttons.publishDisabled) confirm()
  }
  const nameRefused = refusal?.reason === 'nameTaken'
  const addressRefused = refusal && refusal.reason !== 'nameTaken' ? refusalLine(refusal.reason, randomEnd) : null

  const cancel = (
    <Tooltip label={buttons.cancelTip}>
      <Button
        variant={buttons.main === 'cancel' ? 'default' : 'ghost'}
        size="sm"
        className={buttons.main === 'cancel' ? DEFAULT_RING : undefined}
        data-default={buttons.main === 'cancel' ? '' : undefined}
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
        className={buttons.main === 'publish' ? DEFAULT_RING : undefined}
        data-default={buttons.main === 'publish' ? '' : undefined}
        disabled={buttons.publishDisabled}
        onClick={confirm}
      >
        <Icon name="globe-simple" size={16} />
        {buttons.publishWords}
      </Button>
    </Tooltip>
  )

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onAnswer({ type: 'publish:cancel' }) }}>
      <DialogContent
        className="group/sheet max-w-[440px]"
        aria-describedby="publish-sheet-subtitle"
        onKeyDown={(event) => {
          // Enter on the sheet itself presses the default button; on a button or link, that control's own press
          if (event.key === 'Enter' && event.target === event.currentTarget && !event.nativeEvent.isComposing) {
            event.preventDefault()
            pressDefault()
          }
        }}
      >
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
          {model.nameRow && (
            // Answer 5: once, in the first sheet, while the account has no workers.dev name
            <WorkersDevNameRow
              value={name}
              onChange={(next) => { setName(next); onEdit?.() }}
              taken={nameRefused}
            />
          )}
          {model.address && (
            <Row label="Address">
              {editable ? (
                // Frame 3's field: the whole page part, made web-safe as typed, the account's end after it
                <>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
                    <Input
                      aria-label="The page's part of the address"
                      aria-invalid={addressRefused !== null || !addressReady || undefined}
                      aria-describedby="publish-address-line"
                      value={pagePart}
                      onChange={(event) => { setPagePart(webSafePagePart(event.target.value)); onEdit?.() }}
                      spellCheck={false}
                      autoComplete="off"
                      // as wide as what it holds, so the random end always shows; the account's end wraps, never clipped
                      style={{ fieldSizing: 'content' } as React.CSSProperties}
                      className="h-7 w-auto min-w-[96px] max-w-full flex-none"
                    />
                    <span className="text-ink-muted">{suffix}</span>
                  </span>
                  {(addressRefused || !addressReady) && (
                    <span id="publish-address-line" role="alert" className="mt-1 block text-[12px] leading-4 text-ink-strong">
                      {addressRefused ?? addressHint(randomEnd)}
                    </span>
                  )}
                </>
              ) : (
                <span className="block truncate">
                  {model.address.page}
                  <span className="text-ink-muted">{suffix}</span>
                </span>
              )}
            </Row>
          )}
          <Row label="What goes">
            <span className="block">{whatGoesLine(model.files)}</span>
            <span className="block text-[12px] leading-4 text-ink-muted">{NOTHING_ELSE}</span>
            {model.scriptBuilt && <span className="mt-1 block text-[12px] leading-4 text-ink-muted">{SCRIPT_BUILT_LINE}</span>}
            {fold && (
              <Tooltip label={open ? 'Hide the list of files' : 'List every file that goes, and what is left out'} className="mt-1 inline-flex">
                <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-[12px] text-ink-body" aria-expanded={open} onClick={() => setOpen(!open)}>
                  <Icon name={open ? 'caret-down' : 'caret-right'} size={12} tone="inherit" />
                  {left > 0 ? `${SEE_THE_FILES} · ${left} left out` : SEE_THE_FILES}
                </Button>
              </Tooltip>
            )}
            {fold && open && (
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
                      {model.leftOut.map((l, i) => {
                        const tip = leftOutTip(l)
                        const row = (
                          <>
                            <span className="max-w-[60%] flex-none truncate text-ink-strong">{leftOutName(l)}</span>
                            <span className="flex-none text-ink-muted">·</span>
                            <span className="min-w-0 text-ink-muted">{leftOutReasonFor(l)}</span>
                          </>
                        )
                        return (
                          <li key={`${l.reason}/${l.display}/${i}`} className="py-0.5 text-[12px] leading-4">
                            {tip ? (
                              // the full path on hover, never as the row's text (the lead's change 2)
                              <Tooltip label={tip} side="top" hoverOnly className="flex min-w-0 max-w-full items-baseline gap-1.5">
                                {row}
                              </Tooltip>
                            ) : (
                              <span className="flex min-w-0 items-baseline gap-1.5">{row}</span>
                            )}
                          </li>
                        )
                      })}
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

/**
 * Frame 2: the first Publish with nothing set up (the lead, 5 November). Set up sends no value; the host opens
 * Cloudflare's token page and its own password box, and the sheet becomes frame 3 once connected.
 */
export function SetupSheetView({ setup, onAnswer }: { setup: PublishSetupModel; onAnswer: (m: PublishSheetWebviewMessage) => void }) {
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onAnswer({ type: 'publish:cancel' }) }}>
      <DialogContent className="group/sheet max-w-[440px]" aria-describedby="publish-setup-lede">
        <div className="px-5 pt-4 pb-1">
          <DialogTitle className="text-[15px] font-semibold leading-5">{SETUP_COPY.title}</DialogTitle>
          <DialogDescription id="publish-setup-lede" className="mt-1 text-[13px] leading-[18px]">{SETUP_COPY.lede}</DialogDescription>
        </div>
        <div className="px-5 pb-1">
          <div className="mt-2 flex items-center gap-3 rounded-md border border-hairline px-3 py-2.5">
            <Icon name="cloud" size={20} tone="inherit" className="flex-none text-ink-body" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-[18px] text-ink-strong">{SETUP_COPY.host}</span>
              <span className="block text-[12px] leading-4 text-ink-muted">{setup.waiting ? SETUP_COPY.waiting : SETUP_COPY.line}</span>
            </span>
            <Tooltip label={setup.waiting ? SETUP_COPY.waitingTip : SETUP_COPY.buttonTip} className="inline-flex flex-none">
              <Button
                variant="default"
                size="sm"
                className={DEFAULT_RING}
                data-default=""
                disabled={setup.waiting}
                onClick={() => onAnswer({ type: 'publish:setUp' })}
              >
                {SETUP_COPY.button}
              </Button>
            </Tooltip>
          </div>
          {setup.line && <p role="alert" className="mt-2 text-[12px] leading-4 text-ink-strong">{setup.line}</p>}
        </div>
        <DialogFooter className="border-t-0 pt-3 pb-4">
          <Tooltip label={SETUP_COPY.cancelTip}>
            <Button variant="ghost" size="sm" onClick={() => onAnswer({ type: 'publish:cancel' })}>Cancel</Button>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The sheet's page: waits for the host's model, then shows frame 2 or the sheet. */
export function PublishSheet() {
  const [model, setModel] = useState<PublishSheetModel | null>(null)
  const [setup, setSetup] = useState<PublishSetupModel | null>(null)
  const [refusal, setRefusal] = useState<{ reason: SheetRefusal } | null>(null)
  useEffect(() => {
    const onMessage = (event: MessageEvent<PublishSheetHostMessage>) => {
      const data = event.data
      if (data?.type === 'publish:sheet') { setModel(data.model); setRefusal(null) }
      else if (data?.type === 'publish:setup') setSetup(data.setup)
      else if (data?.type === 'publish:refused') setRefusal({ reason: data.reason })
    }
    window.addEventListener('message', onMessage)
    send({ type: 'publish:sheetReady' })
    return () => window.removeEventListener('message', onMessage)
  }, [])
  if (model) return <PublishSheetView model={model} onAnswer={send} refusal={refusal} onEdit={() => setRefusal(null)} />
  if (setup) return <SetupSheetView setup={setup} onAnswer={send} />
  return null
}

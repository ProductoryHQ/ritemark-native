/**
 * The welcome's parts (Sprint 133): step 1's cards, the update sheet's rows,
 * step 2's choices, the project rows, the usage-data switch and the small
 * sheets for keys. Built from the UI components (Button, Switch, Tooltip,
 * Dialog); the kit's measures are in welcome.css.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { Tooltip } from '../ui/tooltip'
import { Icon } from '../ui/Icon'
import { Dialog, DialogBody, DialogButton, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import type { ProjectView, ProviderView, WelcomeKeyName, WelcomeProviderId } from '../../../../src/welcome/protocol'
import { COPY, PROVIDER_NAMES, browserOpened } from './welcomeCopy'
import { send } from './welcomeClient'

export function Spinner() {
  return <span className="rw-spin" aria-hidden="true" />
}

/** A small button on the sheet: primary (blue) or quiet, always with a tooltip. */
export function SheetButton({
  label,
  tooltip,
  primary,
  small,
  icon,
  onClick,
  disabled,
  ariaLabel,
  ariaDescribedBy,
}: {
  label: string
  tooltip: string
  primary?: boolean
  small?: boolean
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  /** The name a screen reader reads; it keeps the visible label's words (WCAG 2.5.3). */
  ariaLabel?: string
  ariaDescribedBy?: string
}) {
  return (
    <Tooltip label={tooltip}>
      <Button
        variant={primary ? 'default' : 'ghost'}
        className={`rw-btn${primary ? '' : ' quiet'}${small ? ' small' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      >
        {icon}
        {label}
      </Button>
    </Tooltip>
  )
}

// ── Step 1's cards (R2, R3, R4) ────────────────────────────────────────────

export function ProviderCard({
  view,
  faded,
  onSignIn,
  onSetUp,
  onContinue,
}: {
  view: ProviderView
  faded: boolean
  onSignIn: () => void
  onSetUp: () => void
  onContinue: () => void
}) {
  const name = PROVIDER_NAMES[view.id]
  const isOpenCode = view.id === 'opencode'
  const titleId = `rw-card-${view.id}`
  // A button names its AI and is described by the card's words and state (S2).
  const describedBy = `${titleId}-line ${titleId}-state`
  const line = view.reason ?? (isOpenCode ? COPY.openCodeLine : COPY.accountLine)

  if (view.phase === 'signing-in') {
    return (
      <section className="rw-choice wait" aria-labelledby={titleId} aria-busy="true">
        <span className="name" id={titleId}>{name}</span>
        <span className="line" id={`${titleId}-line`}>{browserOpened(view.id)}</span>
        <span className="w">
          <Spinner />
          <span id={`${titleId}-state`}>{isOpenCode ? COPY.checking : COPY.finishThere}</span>
          {!isOpenCode && (
            <span style={{ marginLeft: 'auto' }}>
              <SheetButton
                label={COPY.cancel}
                tooltip={`Stop waiting for ${name}’s sign-in (Escape)`}
                ariaLabel={`${COPY.cancel} ${name} sign-in`}
                ariaDescribedBy={describedBy}
                small
                onClick={() => send({ type: 'welcome/cancel-sign-in', provider: view.id as 'claude' | 'chatgpt' })}
              />
            </span>
          )}
        </span>
      </section>
    )
  }

  return (
    <section className={`rw-choice${faded ? ' faded' : ''}`} aria-labelledby={titleId}>
      <span className="name" id={titleId}>{name}</span>
      <span className="line" id={`${titleId}-line`}>{line}</span>
      <span className="foot">
        {view.phase === 'ready' ? (
          <>
            <SheetButton
              label={COPY.continue}
              tooltip={`Go on with ${name}`}
              ariaLabel={`${COPY.continue} with ${name}`}
              ariaDescribedBy={describedBy}
              primary
              onClick={onContinue}
            />
            <span className="rw-state" id={`${titleId}-state`}><Icon name="check-circle" size={14} tone="inherit" />{isOpenCode ? COPY.setUpDone : COPY.signedIn}</span>
          </>
        ) : view.phase === 'unavailable' ? (
          <SheetButton
            label={COPY.openSettings}
            tooltip={`Repair ${name} in Ritemark Settings`}
            ariaLabel={`${COPY.openSettings} for ${name}`}
            ariaDescribedBy={`${titleId}-line`}
            onClick={() => send({ type: 'welcome/open-settings' })}
          />
        ) : (
          <>
            <SheetButton
              label={isOpenCode ? COPY.setUp : COPY.signIn}
              tooltip={isOpenCode ? 'Add an API key of your own for OpenCode' : `Sign in to ${name} in your browser`}
              ariaLabel={isOpenCode ? `${COPY.setUp} ${name}` : `${COPY.signIn} to ${name}`}
              ariaDescribedBy={describedBy}
              primary
              onClick={isOpenCode ? onSetUp : onSignIn}
            />
            <ProviderState view={view} id={`${titleId}-state`} />
          </>
        )}
      </span>
    </section>
  )
}

/** Checking…, Not checked yet, or Try again, beside a card's button or on a row. */
export function ProviderState({ view, id }: { view: ProviderView; id?: string }) {
  if (view.phase === 'checking') return <span className="rw-state quiet" id={id}><Spinner />{COPY.checking}</span>
  if (view.phase === 'not-checked') return <span className="rw-state quiet" id={id}><Icon name="clock" size={14} tone="inherit" />{COPY.notChecked}</span>
  if (view.retry) {
    return (
      <SheetButton
        label={COPY.tryAgain}
        tooltip={`Check ${PROVIDER_NAMES[view.id]} again`}
        ariaLabel={`${COPY.tryAgain} for ${PROVIDER_NAMES[view.id]}`}
        small
        onClick={() => send({ type: 'welcome/retry-check', provider: view.id })}
      />
    )
  }
  return null
}

// ── The update sheet's rows (R10, experience 32) ───────────────────────────

export function ProviderRow({ view, onSetUp, onSignIn }: { view: ProviderView; onSetUp: () => void; onSignIn: () => void }) {
  const name = PROVIDER_NAMES[view.id]
  const isOpenCode = view.id === 'opencode'
  const wordsId = `rw-row-${view.id}-words`
  return (
    <div className="rw-airow" role="listitem">
      <span className="t">
        <b>{name}</b>
        {view.phase === 'signing-in' && <span id={wordsId}>{browserOpened(view.id)}</span>}
        {view.reason && view.phase !== 'signing-in' && <span id={wordsId}>{view.reason}</span>}
      </span>
      {view.phase === 'ready' && <span className="rw-state"><Icon name="check-circle" size={14} tone="inherit" />{isOpenCode ? COPY.setUpDone : COPY.signedIn}</span>}
      {view.phase === 'checking' && <span className="rw-state quiet"><Spinner />{COPY.checking}</span>}
      {view.phase === 'not-checked' && <span className="rw-state quiet"><Icon name="clock" size={14} tone="inherit" />{COPY.notChecked}</span>}
      {view.phase === 'signing-in' && !isOpenCode && (
        <span className="rw-state quiet">
          <Spinner />{COPY.finishThere}
          <SheetButton label={COPY.cancel} tooltip={`Stop waiting for ${name}’s sign-in (Escape)`} ariaLabel={`${COPY.cancel} ${name} sign-in`} ariaDescribedBy={wordsId} small onClick={() => send({ type: 'welcome/cancel-sign-in', provider: view.id as 'claude' | 'chatgpt' })} />
        </span>
      )}
      {view.phase === 'unavailable' && (
        <SheetButton label={COPY.openSettings} tooltip={`Repair ${name} in Ritemark Settings`} ariaLabel={`${COPY.openSettings} for ${name}`} onClick={() => send({ type: 'welcome/open-settings' })} />
      )}
      {view.phase === 'sign-in' && (
        <span className="rw-state">
          {view.retry && <ProviderState view={view} />}
          <SheetButton
            label={isOpenCode ? COPY.setUp : COPY.signIn}
            tooltip={isOpenCode ? 'Add an API key of your own for OpenCode' : `Sign in to ${name} in your browser`}
            ariaLabel={isOpenCode ? `${COPY.setUp} ${name}` : `${COPY.signIn} to ${name}`}
            ariaDescribedBy={view.reason ? wordsId : undefined}
            primary
            onClick={isOpenCode ? onSetUp : onSignIn}
          />
        </span>
      )}
    </div>
  )
}

// ── Step 2's choices (R5) ──────────────────────────────────────────────────

export function ChoiceRow({
  icon,
  title,
  line,
  first,
  tooltip,
  onClick,
  disabled,
}: {
  icon: 'folder-open' | 'folder-plus' | 'books'
  title: string
  line: string
  first?: boolean
  tooltip: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip label={tooltip} className="block w-full">
      <button type="button" className={`rw-row${first ? ' first' : ''}`} onClick={onClick} disabled={disabled}>
        <span className="ic"><Icon name={icon} size={16} tone="inherit" /></span>
        <span className="t"><b>{title}</b><span>{line}</span></span>
        <Icon name="caret-right" size={14} tone="inherit" />
      </button>
    </Tooltip>
  )
}

/** Start a new project, opened in place: a name, Create, and where it goes (R5, S18, S19). */
export function NewProjectForm({
  placePrefix,
  error,
  disabled,
  onCancel,
}: {
  placePrefix: string
  error: string | null
  disabled: boolean
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  // The refusal belongs to the name that was refused: it goes as soon as the name changes.
  const [submitted, setSubmitted] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  const create = () => {
    setSubmitted(name)
    send({ type: 'welcome/create-project', name })
  }
  const shownError = error && submitted === name ? error : null
  return (
    <div className="rw-new" role="group" aria-label={COPY.newProject}>
      <div className="head">
        <span className="ic"><Icon name="folder-plus" size={16} tone="inherit" /></span>
        <b>{COPY.newProject}</b>
      </div>
      <div className="field">
        <input
          ref={input}
          value={name}
          placeholder={COPY.projectName}
          aria-label={COPY.projectName}
          aria-invalid={shownError ? true : undefined}
          aria-describedby="rw-new-place rw-new-error"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) create()
            if (event.key === 'Escape') onCancel()
          }}
          disabled={disabled}
        />
        <SheetButton label={COPY.create} tooltip="Make the folder and open it" primary onClick={create} disabled={disabled || !name.trim()} />
      </div>
      <div className="place" id="rw-new-place">
        <span className="path">{placePrefix}{name.trim() || '…'}</span>
        <SheetButton label={COPY.change} tooltip="Choose another place for the project" small onClick={() => send({ type: 'welcome/change-place' })} disabled={disabled} />
      </div>
      {shownError && (
        <div className="error" id="rw-new-error" role="alert">
          <Icon name="warning-circle" size={14} tone="inherit" />
          {shownError}
        </div>
      )}
    </div>
  )
}

// ── Project rows (R1, R10) ─────────────────────────────────────────────────

export function ProjectRow({ project, first, disabled }: { project: ProjectView; first: boolean; disabled: boolean }) {
  return (
    <Tooltip label={project.current ? 'Back to this project, as you left it' : `Open ${project.name}`} className="block w-full">
      <button
        type="button"
        className={`rw-project${first ? ' first' : ''}`}
        onClick={() => send({ type: 'welcome/open-recent', id: project.id })}
        disabled={disabled}
      >
        <span className="mark" aria-hidden="true">{project.mark}</span>
        <span className="t"><b>{project.name}</b><span>{project.place}</span></span>
        {project.when && <span className="when">{project.when}</span>}
        <Icon name="caret-right" size={14} tone="inherit" />
      </button>
    </Tooltip>
  )
}

// ── Usage data (R7) ────────────────────────────────────────────────────────

export function UsageData({ on: hostOn, fromRitemark1, afterLine }: { on: boolean; fromRitemark1: boolean; afterLine?: boolean }) {
  // The switch answers the click at once; the host's state takes over once it says the same. A session's
  // first settings write can take seconds, and the switch must not look dead meanwhile.
  const [asked, setAsked] = useState<boolean | null>(null)
  useEffect(() => { if (asked === hostOn) setAsked(null) }, [asked, hostOn])
  const on = asked ?? hostOn
  const words = on ? (fromRitemark1 && asked === null ? COPY.usageOn : COPY.usageOnHere) : COPY.usageOff
  return (
    <div className={`rw-usage${afterLine ? ' after-line' : ''}`}>
      <span className="t">
        <b id="rw-usage-title">{COPY.usageTitle}</b>
        <span id="rw-usage-words">{words}</span>
        <span className="legal">
          <a role="button" tabIndex={0} onClick={() => send({ type: 'welcome/open-link', link: 'privacy' })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') send({ type: 'welcome/open-link', link: 'privacy' }) }}>{COPY.privacyPolicy}</a>
          {' · '}
          <a role="button" tabIndex={0} onClick={() => send({ type: 'welcome/open-link', link: 'terms' })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') send({ type: 'welcome/open-link', link: 'terms' }) }}>{COPY.termsOfUse}</a>
        </span>
      </span>
      <Tooltip label={on ? 'Stop sharing anonymous usage data' : 'Share anonymous usage data'}>
        <Switch
          className="rw-switch"
          checked={on}
          onCheckedChange={(checked) => { setAsked(checked); send({ type: 'welcome/usage-data', on: checked }) }}
          aria-labelledby="rw-usage-title"
          aria-describedby="rw-usage-words"
        />
      </Tooltip>
    </div>
  )
}

// ── The small sheets: API keys and OpenCode's Set up (R2, R3) ───────────────

const KEY_FIELDS: Record<WelcomeKeyName, { label: string; placeholder: string }> = {
  'google-ai-key': { label: 'Google AI (Gemini)', placeholder: 'AIza…' },
  'openai-api-key': { label: 'OpenAI', placeholder: 'sk-…' },
  'anthropic-api-key': { label: 'Anthropic', placeholder: 'sk-ant-…' },
  'openrouter-api-key': { label: 'OpenRouter', placeholder: 'sk-or-…' },
}

export type KeySheetTarget = 'claude' | 'opencode'

export function KeySheet({
  target,
  keysSet,
  result,
  onClose,
}: {
  target: KeySheetTarget | null
  keysSet: Record<WelcomeKeyName, boolean>
  result: { ok: boolean; message: string | null } | null
  onClose: () => void
}) {
  const [values, setValues] = useState<Partial<Record<WelcomeKeyName, string>>>({})
  const [saving, setSaving] = useState(false)
  // The sheet has no Radix Trigger, so Radix has nowhere to put focus back on close: remember the button
  // that opened it, read while rendering the opening, before the sheet takes focus (S2).
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  if (target !== null && !wasOpen.current) opener.current = document.activeElement as HTMLElement | null
  wasOpen.current = target !== null
  useEffect(() => { setValues({}); setSaving(false) }, [target])
  useEffect(() => {
    if (!result) return
    setSaving(false)
    if (result.ok) onClose()
  }, [result, onClose])
  const fields: WelcomeKeyName[] = target === 'claude'
    ? ['anthropic-api-key']
    : ['google-ai-key', 'openai-api-key', 'anthropic-api-key', 'openrouter-api-key']
  const done = () => {
    setSaving(true)
    const keys: Partial<Record<WelcomeKeyName, string>> = {}
    for (const field of fields) if (values[field]?.trim()) keys[field] = values[field]!.trim()
    send({ type: 'welcome/save-keys', target: target ?? 'claude', keys })
  }
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent aria-describedby="rw-keys-note" onOpenAutoFocus={(event) => {
        event.preventDefault()
        ;(document.querySelector('.rw-keyfield input') as HTMLInputElement | null)?.focus()
      }} onCloseAutoFocus={(event) => {
        event.preventDefault()
        if (opener.current?.isConnected) opener.current.focus()
      }}>
        <DialogHeader icon={<Icon name="key" size={16} />} onClose={onClose}>
          <DialogTitle className="text-[15px] font-semibold">{target === 'claude' ? COPY.apiKeys : 'Set up OpenCode'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="rw-keynote" id="rw-keys-note">
            {target === 'claude'
              ? 'Use Claude with an Anthropic API key of your own. You can change it later in Settings.'
              : 'OpenCode uses your own provider accounts. Add at least one key; you can change them later in Settings.'}
          </p>
          {fields.map((field) => (
            <div className="rw-keyfield" key={field}>
              <label htmlFor={`rw-key-${field}`}>
                {target === 'claude' ? 'Anthropic API key' : KEY_FIELDS[field].label}
                {keysSet[field] && <span className="set"><Icon name="check" size={12} tone="inherit" />Saved</span>}
              </label>
              <input
                id={`rw-key-${field}`}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={keysSet[field] ? 'Saved. Paste a new key to replace it.' : KEY_FIELDS[field].placeholder}
                value={values[field] ?? ''}
                onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                onKeyDown={(event) => { if (event.key === 'Enter') done() }}
              />
            </div>
          ))}
          {result && !result.ok && result.message && <p className="rw-keyerror" role="alert">{result.message}</p>}
        </DialogBody>
        <DialogFooter>
          <Tooltip label="Close without saving"><DialogButton variant="secondary" onClick={onClose}>{COPY.cancel}</DialogButton></Tooltip>
          <Tooltip label="Save the keys and go on"><DialogButton variant="primary" onClick={done} disabled={saving}>Done</DialogButton></Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function isSigningIn(views: readonly ProviderView[]): WelcomeProviderId | null {
  return views.find((view) => view.phase === 'signing-in' && view.id !== 'opencode')?.id ?? null
}

/**
 * The API keys sheet (Sprint 147, R3, W4; experience 15, frame 9; the Experience lead's answers 2 and 6): the five
 * services, each with what its key is for, Saved · it works (after Test) or Not added, and Test and Change, or Get a
 * key and Add. Change opens the field with Save, Cancel and Remove key; Remove key asks once, inside the row.
 *
 * It sends today's messages: Save is `setApiKey` with the value, Remove key is `setApiKey` with an empty value (the
 * host deletes the secret, as Save with an empty field did, I37), Test is `testApiKey`. The saved-key eye stays
 * (Jarmo's decision 2, 2 November): Change opens the field filled with the saved key, hidden until its eye is pressed.
 *
 * `ApiKeysRows` is the sheet's content without its dialog, so render tests can draw it.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/tooltip'
import { ExternalLink, TipButton } from './SettingsRow'
import type { SettingsData, TestResult } from './RitemarkSettings'

type KeyFlag = 'openrouterEnabled' | 'transcriptionEnabled'

export interface ApiKeyRow {
  /** The secret's name, as the host stores it. */
  name: 'openai-api-key' | 'anthropic-api-key' | 'google-ai-key' | 'openrouter-api-key' | 'elevenlabs-api-key'
  /** The test result's key. */
  short: TestResult['key']
  label: string
  usedFor: (settings: SettingsData) => string
  /** What stops when the key is removed: the second half of Remove key's question (answer 2). */
  stops: (settings: SettingsData) => string
  url: string
  placeholder: string
  configured: 'openaiKeyConfigured' | 'anthropicKeyConfigured' | 'googleKeyConfigured' | 'openrouterKeyConfigured' | 'elevenlabsKeyConfigured'
  value: 'openaiKey' | 'anthropicKey' | 'googleKey' | 'openrouterKey' | 'elevenlabsKey'
  /** The flag that shows the row, as before (R1). */
  flag?: KeyFlag
  /** The inventory row (I32–I36). */
  row: string
}

/** The five keys, in the drawing's order (frame 9). */
export const API_KEY_ROWS: readonly ApiKeyRow[] = [
  {
    name: 'openai-api-key', short: 'openai', label: 'OpenAI', row: 'I32',
    // No model's name here: the image steps' default moves with modelConfig
    usedFor: (s) => s.opencodeEnabled ? 'Pictures in flows, and GPT models in OpenCode' : 'Pictures in flows',
    stops: (s) => s.opencodeEnabled ? 'Pictures in flows, and GPT models in OpenCode, stop working' : 'Pictures in flows stop working',
    url: 'https://platform.openai.com/api-keys', placeholder: 'sk-...', configured: 'openaiKeyConfigured', value: 'openaiKey',
  },
  {
    name: 'anthropic-api-key', short: 'anthropic', label: 'Anthropic', row: 'I34',
    usedFor: (s) => s.opencodeEnabled ? 'Claude without signing in, and Claude in OpenCode' : 'Claude without signing in',
    stops: (s) => s.opencodeEnabled ? 'Claude without signing in, and Claude in OpenCode, stop working' : 'Claude without signing in stops working',
    url: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...', configured: 'anthropicKeyConfigured', value: 'anthropicKey',
  },
  {
    name: 'google-ai-key', short: 'google', label: 'Google AI', row: 'I33',
    usedFor: (s) => s.opencodeEnabled ? 'Gemini in flows and OpenCode, and Google pictures' : 'Gemini in flows, and Google pictures',
    stops: () => 'Gemini and Google pictures stop working',
    url: 'https://aistudio.google.com/apikey', placeholder: 'AIza...', configured: 'googleKeyConfigured', value: 'googleKey',
  },
  {
    name: 'openrouter-api-key', short: 'openrouter', label: 'OpenRouter', row: 'I35', flag: 'openrouterEnabled',
    usedFor: () => 'Hundreds of models in OpenCode, with one key',
    stops: () => "OpenCode's OpenRouter models stop working",
    url: 'https://openrouter.ai/keys', placeholder: 'sk-or-...', configured: 'openrouterKeyConfigured', value: 'openrouterKey',
  },
  {
    name: 'elevenlabs-api-key', short: 'elevenlabs', label: 'ElevenLabs', row: 'I36', flag: 'transcriptionEnabled',
    usedFor: () => 'Who said what, in recordings. Transcribing works without it; with it, audio goes to ElevenLabs.',
    stops: () => 'Telling speakers apart in recordings stops working',
    url: 'https://elevenlabs.io/app/settings/api-keys', placeholder: 'sk_...', configured: 'elevenlabsKeyConfigured', value: 'elevenlabsKey',
  },
]

/** The row's state line: Saved · it works after a passing Test, Not added before a key is saved. */
export function keyStateLine(saved: boolean, result: TestResult | undefined): string {
  if (!saved) return 'Not added'
  if (result?.success) return 'Saved · it works'
  if (result && !result.success) return "Saved · it didn't work"
  return 'Saved'
}

export const OPENCODE_INTRO = 'OpenCode works with any one of these keys: OpenRouter, OpenAI, Anthropic or Google AI. OpenRouter gives it the most models with one key.'

export interface ApiKeysProps {
  settings: SettingsData
  testing: Partial<Record<TestResult['key'], boolean>>
  results: Record<string, TestResult>
  onSave: (name: ApiKeyRow['name'], value: string) => void
  onTest: (name: ApiKeyRow['name']) => void
  /** The row to bring into view and focus (a way in, or OpenCode's Set up). */
  focus?: ApiKeyRow['name'] | null
  /** Opened from OpenCode's Set up: the line that says what OpenCode needs (answer 6). */
  forOpenCode?: boolean
}

function KeyRow({ row, settings, testing, result, onSave, onTest, focused }: {
  row: ApiKeyRow
  settings: SettingsData
  testing: boolean
  result: TestResult | undefined
  onSave: ApiKeysProps['onSave']
  onTest: ApiKeysProps['onTest']
  focused: boolean
}) {
  const saved = Boolean(settings[row.configured])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [show, setShow] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const usedFor = row.usedFor(settings)

  useEffect(() => {
    if (!focused) return
    const timer = setTimeout(() => {
      rowRef.current?.scrollIntoView({ block: 'nearest' })
      rowRef.current?.querySelector<HTMLElement>('[data-key-primary]')?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [focused])

  const open = () => {
    // Today's field held the saved key, with its eye (decision 2, Jarmo): Change opens it filled, hidden
    setDraft(saved ? settings[row.value] ?? '' : '')
    setShow(false)
    setConfirming(false)
    setEditing(true)
  }
  const close = () => {
    setEditing(false)
    setConfirming(false)
    setDraft('')
    setShow(false)
  }

  return (
    <div ref={rowRef} id={`settings-section-${row.name}`} data-settings-row={`${row.row} I37 I38`} className="scroll-mt-4 border-t border-hairline py-3 first:border-t-0">
      <div className="flex items-center gap-4">
        <div className="w-[84px] shrink-0 text-[12px] leading-4 text-ink-muted">{row.label}</div>
        <div className="grid min-w-0 flex-1">
          <span className="text-[13px] leading-[18px] text-ink-strong">{keyStateLine(saved, result)}</span>
          <span className="text-[12px] leading-4 text-ink-muted">{usedFor}</span>
          {result && !result.success && result.error ? <span className="text-[12px] leading-4 text-ritemark-error [overflow-wrap:anywhere]">{result.error}</span> : null}
          {result?.success && result.message ? <span className="text-[12px] leading-4 text-ink-muted">{result.message}</span> : null}
        </div>
        {!editing && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {saved ? (
              <>
                <TipButton tip="Asks the service whether the saved key works" variant="ghost" size="sm" disabled={testing} aria-busy={testing || undefined} onClick={() => onTest(row.name)}>
                  {testing ? <><Icon name="circle-notch" size={14} className="animate-spin" />Trying…</> : 'Test'}
                </TipButton>
                <TipButton tip={`Changes or removes the ${row.label} key`} variant="ghost" size="sm" data-key-primary onClick={open}>Change</TipButton>
              </>
            ) : (
              <>
                <ExternalLink url={row.url} tip={`Opens ${row.label}'s page for API keys in your browser`} className="px-2">
                  Get a key <Icon name="arrow-square-out" size={12} />
                </ExternalLink>
                <TipButton tip={`Adds your ${row.label} key; it stays on this computer`} variant="outline" size="sm" data-key-primary onClick={open}>Add</TipButton>
              </>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-2.5 grid gap-2 pl-[100px] max-[640px]:pl-0">
          {confirming ? (
            <div className="grid gap-2" role="group" aria-label={`Remove the ${row.label} key`}>
              <p className="text-[13px] leading-[18px] text-ink-strong">
                Remove the {row.label} key from this computer? {row.stops(settings)} until you add a key again.
              </p>
              <div className="flex items-center justify-end gap-1">
                <TipButton tip="Keeps the key" variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</TipButton>
                <TipButton tip={`Removes the ${row.label} key from this computer`} variant="destructive" size="sm" onClick={() => { onSave(row.name, ''); close() }}>Remove</TipButton>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={draft}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && draft.trim()) { onSave(row.name, draft); close() }
                    if (event.key === 'Escape') { event.stopPropagation(); close() }
                  }}
                  placeholder={row.placeholder}
                  aria-label={`${row.label} API key`}
                  spellCheck={false}
                  autoComplete="off"
                  className="rm-focus-ring w-full rounded-md border border-hairline-strong bg-surface-soft px-3 py-1.5 pr-10 font-mono text-[13px] text-ink-strong"
                />
                <Tooltip label={show ? 'Hide the key' : 'Show the key'} className="absolute right-0.5 top-1/2 -translate-y-1/2">
                  <Button variant="ghost" size="icon-sm" aria-label={show ? 'Hide the key' : 'Show the key'} onClick={() => setShow(!show)}>
                    <Icon name={show ? 'eye-slash' : 'eye'} size={16} />
                  </Button>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                {saved ? (
                  <TipButton tip={`Removes the ${row.label} key from this computer; it asks first`} variant="ghost" size="sm" className="mr-auto" onClick={() => setConfirming(true)}>Remove key</TipButton>
                ) : <span className="mr-auto" />}
                <TipButton tip="Closes the field without saving" variant="ghost" size="sm" onClick={close}>Cancel</TipButton>
                <TipButton tip={draft.trim() ? `Saves the ${row.label} key on this computer` : 'Paste or type a key first'} size="sm" disabled={!draft.trim()} onClick={() => { onSave(row.name, draft); close() }}>Save</TipButton>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function ApiKeysRows({ settings, testing, results, onSave, onTest, focus, forOpenCode }: ApiKeysProps) {
  const rows = API_KEY_ROWS.filter((row) => !row.flag || settings[row.flag])
  return (
    <>
      {forOpenCode && settings.opencodeEnabled ? (
        <p className="mb-2 rounded-md bg-surface-muted px-3 py-2 text-[13px] leading-[18px] text-ink-strong">{OPENCODE_INTRO}</p>
      ) : null}
      {rows.map((row) => (
        <KeyRow
          key={row.name}
          row={row}
          settings={settings}
          testing={Boolean(testing[row.short])}
          result={results[row.short]}
          onSave={onSave}
          onTest={onTest}
          focused={focus === row.name}
        />
      ))}
    </>
  )
}

export function ApiKeysSheet({ open, onDone, ...props }: ApiKeysProps & { open: boolean; onDone: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDone() }}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader onClose={onDone}>
          <div className="grid gap-1">
            <DialogTitle>API keys</DialogTitle>
            <DialogDescription className="text-[13px]">Only if you have them. Claude and ChatGPT work without one. Keys stay on this computer.</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody className="py-2">
          <ApiKeysRows {...props} />
        </DialogBody>
        <DialogFooter>
          <TipButton tip="Closes this sheet" size="sm" onClick={onDone}>Done</TipButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

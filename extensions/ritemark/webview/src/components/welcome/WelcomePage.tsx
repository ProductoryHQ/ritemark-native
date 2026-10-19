/**
 * The welcome (Sprint 133): one raised sheet, 640 wide, on the flat ground.
 * - the fresh welcome: 1 · Your AI, then 2 · Set up project (experience 2);
 * - the update welcome, once, for someone updating from Ritemark 1 (experience 32);
 * - "Where do you want to start?" for a finished profile's window with no folder (R1).
 *
 * The host owns the state (`src/welcome/welcomeHost.ts`); this page draws it
 * and sends what the person does. It draws at once, before any check answers
 * (R15): every provider shows Checking… until its own check does.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountProviderId, WelcomeMessage, WelcomeState } from '../../../../src/welcome/protocol'
import { CHECK_TIMEOUT_MS, projectLine, signInAnswered, startSignIn, updateRows, withStartingSignIn, type StartingSignIn } from '../../../../src/welcome/welcomeState'
import { Icon } from '../ui/Icon'
import { COPY, PROVIDER_NAMES, missingToolLine, readyLine, spokenState } from './welcomeCopy'
import {
  ChoiceRow,
  KeySheet,
  NewProjectForm,
  ProjectRow,
  ProviderCard,
  ProviderRow,
  SheetButton,
  UsageData,
  isSigningIn,
  type KeySheetTarget,
} from './WelcomeParts'
import { send } from './welcomeClient'
import './welcome.css'

const INITIAL: WelcomeState = {
  kind: 'fresh',
  step: 1,
  platform: 'darwin',
  providers: (['chatgpt', 'claude', 'opencode'] as const).map((id) => ({ id, phase: 'checking', reason: null, retry: false, method: null })),
  readyProvider: null,
  offline: false,
  projects: [],
  usageData: { on: false, fromRitemark1: false },
  missingTool: null,
  newProject: { placePrefix: '', error: null },
  keysSet: { 'anthropic-api-key': false, 'openai-api-key': false, 'google-ai-key': false, 'openrouter-api-key': false },
  notice: null,
  opening: false,
}

export function WelcomePage() {
  const root = document.getElementById('root')
  const hero = root?.getAttribute('data-hero') ?? ''
  const logo = root?.getAttribute('data-logo') ?? ''
  const [state, setState] = useState<WelcomeState | null>(null)
  const [keySheet, setKeySheet] = useState<KeySheetTarget | null>(null)
  const [keysResult, setKeysResult] = useState<{ ok: boolean; message: string | null } | null>(null)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [addAnother, setAddAnother] = useState(false)
  const [starting, setStarting] = useState<StartingSignIn | null>(null)

  useEffect(() => {
    const listener = (event: MessageEvent<WelcomeMessage>) => {
      const message = event.data
      if (message?.type === 'welcome/state') {
        setState(message.state)
        // Sprint 134 (S25): opened from the projects list's Start a new project
        if (message.state.newProject.open) setNewProjectOpen(true)
      }
      if (message?.type === 'welcome/keys-saved') setKeysResult({ ok: message.ok, message: message.message })
    }
    window.addEventListener('message', listener)
    send({ type: 'welcome/ready' })
    return () => window.removeEventListener('message', listener)
  }, [])

  const hostView = state ?? INITIAL
  // A Sign in the host has not answered yet shows Checking… on its card (R15, #401).
  const view = useMemo(() => (starting ? { ...hostView, providers: withStartingSignIn(hostView.providers, starting) } : hostView), [hostView, starting])
  const signingIn = isSigningIn(view.providers)

  useEffect(() => {
    if (!starting) return
    if (signInAnswered(hostView.providers, starting)) {
      setStarting(null)
      return
    }
    const timer = setTimeout(() => setStarting(null), CHECK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [hostView.providers, starting])

  const signIn = useCallback((id: AccountProviderId) => {
    setStarting(startSignIn(hostView.providers, id))
    send({ type: 'welcome/sign-in', provider: id })
  }, [hostView.providers])

  // Escape cancels a sign-in in progress (R1).
  useEffect(() => {
    if (!signingIn || keySheet) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') send({ type: 'welcome/cancel-sign-in', provider: signingIn as 'claude' | 'chatgpt' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [signingIn, keySheet])

  const openKeys = useCallback((target: KeySheetTarget) => {
    setKeysResult(null)
    setKeySheet(target)
  }, [])
  const closeKeys = useCallback(() => setKeySheet(null), [])

  const spoken = useMemo(() => view.providers.map(spokenState).join(' '), [view.providers])

  return (
    <div className={`rw-ground${view.kind === 'fresh' ? '' : ' short'}`}>
      <main className="rw-sheet" aria-labelledby="rw-title">
        <SheetHead hero={hero} logo={logo} kind={view.kind} step={view.step} />
        {view.notice && (
          <div className="rw-notice" role="status"><Icon name="warning-circle" size={16} tone="inherit" />{view.notice}</div>
        )}
        {view.kind === 'fresh' && view.step === 1 && (
          <StepOne view={view} signingIn={signingIn} onKeys={openKeys} onSignIn={signIn} />
        )}
        {view.kind === 'fresh' && view.step === 2 && (
          <StepTwo view={view} newProjectOpen={newProjectOpen} setNewProjectOpen={setNewProjectOpen} />
        )}
        {view.kind === 'update' && (
          <UpdateSheet
            view={view}
            addAnother={addAnother}
            setAddAnother={setAddAnother}
            newProjectOpen={newProjectOpen}
            setNewProjectOpen={setNewProjectOpen}
            onKeys={openKeys}
            onSignIn={signIn}
          />
        )}
        {view.kind === 'start' && (
          <StartSheet view={view} newProjectOpen={newProjectOpen} setNewProjectOpen={setNewProjectOpen} />
        )}
        <div className="sr-only" aria-live="polite">{state ? spoken : ''}</div>
      </main>
      <KeySheet target={keySheet} keysSet={view.keysSet} result={keysResult} onClose={closeKeys} />
    </div>
  )
}

function SheetHead({ hero, logo, kind, step }: { hero: string; logo: string; kind: WelcomeState['kind']; step: 1 | 2 }) {
  const short = kind !== 'fresh'
  return (
    <div className={`rw-head${short ? ' short' : ''}`} style={{ backgroundImage: hero ? `url("${hero}")` : undefined }}>
      {logo && <img src={logo} alt="Ritemark" />}
      {!short && (
        <div className="rw-prog" role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step} aria-label={`Step ${step} of 2`}>
          <div><i className={`bar ${step === 1 ? 'on' : 'done'}`} /><span className={`lb${step === 1 ? ' on' : ''}`}>{COPY.stepOne}</span></div>
          <div><i className={`bar${step === 2 ? ' on' : ''}`} /><span className={`lb${step === 2 ? ' on' : ''}`}>{COPY.stepTwo}</span></div>
        </div>
      )}
    </div>
  )
}

// ── Step 1: which AI do you use? ────────────────────────────────────────────

function StepOne({ view, signingIn, onKeys, onSignIn }: { view: WelcomeState; signingIn: string | null; onKeys: (target: KeySheetTarget) => void; onSignIn: (id: AccountProviderId) => void }) {
  return (
    <>
      <h1 id="rw-title">{COPY.freshTitle}</h1>
      <p className="rw-one">{COPY.freshLine}</p>
      <AiChoices view={view} signingIn={signingIn} onKeys={onKeys} onSignIn={onSignIn} />
      <div className="rw-fine"><Icon name="lock-simple" size={14} tone="inherit" />{COPY.privacyLine}</div>
    </>
  )
}

function AiChoices({ view, signingIn, onKeys, onSignIn, skip = true }: { view: WelcomeState; signingIn: string | null; onKeys: (target: KeySheetTarget) => void; onSignIn: (id: AccountProviderId) => void; skip?: boolean }) {
  return (
    <>
      <h2>{COPY.whichAi}</h2>
      {view.offline && (
        <div className="rw-offline alone" role="status"><Icon name="wifi-slash" size={16} tone="inherit" />{COPY.offline}</div>
      )}
      <div className="rw-choices">
        {view.providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            view={provider}
            faded={signingIn !== null && provider.id !== signingIn}
            onSignIn={() => onSignIn(provider.id as AccountProviderId)}
            onSetUp={() => onKeys('opencode')}
            onContinue={() => send({ type: 'welcome/continue', provider: provider.id })}
          />
        ))}
      </div>
      {signingIn ? (
        <div className="rw-links">
          <SheetButton
            label={COPY.reopen}
            tooltip={`Open ${PROVIDER_NAMES[signingIn as 'claude' | 'chatgpt']}’s sign-in page again`}
            onClick={() => send({ type: 'welcome/reopen-sign-in', provider: signingIn as 'claude' | 'chatgpt' })}
          />
        </div>
      ) : (
        <div className="rw-links">
          <span className="note">{COPY.moreThanOne}</span>
          <SheetButton label={COPY.apiKeys} tooltip="Use Claude with an Anthropic API key of your own" onClick={() => onKeys('claude')} />
          <span className="grow" />
          {skip && <SheetButton label={COPY.skip} tooltip="Go on without an AI; you can sign in later from the AI’s sheet" onClick={() => send({ type: 'welcome/skip' })} />}
        </div>
      )}
    </>
  )
}

// ── Step 2: where is your work? ─────────────────────────────────────────────

function StepTwo({ view, newProjectOpen, setNewProjectOpen }: { view: WelcomeState; newProjectOpen: boolean; setNewProjectOpen: (open: boolean) => void }) {
  return (
    <>
      <h1 id="rw-title">{COPY.freshTitle}</h1>
      <p className="rw-one tight">{COPY.freshLine}</p>
      {view.readyProvider && (
        <div className="rw-done"><Icon name="check-circle" size={14} tone="inherit" />{readyLine(view.readyProvider)}</div>
      )}
      <MissingTool view={view} />
      <h2>{COPY.whereIsWork}</h2>
      <ProjectChoices view={view} newProjectOpen={newProjectOpen} setNewProjectOpen={setNewProjectOpen} sample />
      <div className="rw-fine"><span className="grow">{projectLine(view.readyProvider)}</span></div>
      <UsageData on={view.usageData.on} fromRitemark1={view.usageData.fromRitemark1} afterLine />
    </>
  )
}

function MissingTool({ view }: { view: WelcomeState }) {
  if (!view.missingTool) return null
  return (
    <div className="rw-tool" role="status">
      <Icon name="warning-circle" size={14} tone="inherit" />
      <span className="text">{missingToolLine(view.missingTool)}</span>
      {view.missingTool === 'restart' ? (
        <SheetButton label="Restart" tooltip="Restart Ritemark to finish setting up Claude" onClick={() => send({ type: 'welcome/restart' })} />
      ) : (
        <SheetButton label="Use Ritemark’s own Claude" tooltip="Switch to the Claude that comes with Ritemark" onClick={() => send({ type: 'welcome/use-bundled-claude' })} />
      )}
    </div>
  )
}

function ProjectChoices({
  view,
  newProjectOpen,
  setNewProjectOpen,
  sample,
}: {
  view: WelcomeState
  newProjectOpen: boolean
  setNewProjectOpen: (open: boolean) => void
  sample: boolean
}) {
  return (
    <>
      <ChoiceRow
        icon="folder-open"
        title={COPY.openFolder}
        line={COPY.openFolderLine}
        first
        tooltip="Choose a folder on this computer"
        onClick={() => send({ type: 'welcome/open-folder' })}
        disabled={view.opening}
      />
      {newProjectOpen ? (
        <NewProjectForm
          placePrefix={view.newProject.placePrefix}
          error={view.newProject.error}
          disabled={view.opening}
          onCancel={() => setNewProjectOpen(false)}
        />
      ) : (
        <ChoiceRow
          icon="folder-plus"
          title={COPY.newProject}
          line={COPY.newProjectLine}
          tooltip="Name a new, empty folder for your project"
          onClick={() => setNewProjectOpen(true)}
          disabled={view.opening}
        />
      )}
      {sample && (
        <ChoiceRow
          icon="books"
          title={COPY.sample}
          line={COPY.sampleLine}
          tooltip="Copy Ritemark’s sample project into Documents and open it"
          onClick={() => send({ type: 'welcome/try-sample' })}
          disabled={view.opening}
        />
      )}
    </>
  )
}

// ── The update welcome (R10) and the start sheet (R1) ───────────────────────

function UpdateSheet({
  view,
  addAnother,
  setAddAnother,
  newProjectOpen,
  setNewProjectOpen,
  onKeys,
  onSignIn,
}: {
  view: WelcomeState
  addAnother: boolean
  setAddAnother: (open: boolean) => void
  newProjectOpen: boolean
  setNewProjectOpen: (open: boolean) => void
  onKeys: (target: KeySheetTarget) => void
  onSignIn: (id: AccountProviderId) => void
}) {
  const rows = updateRows(view.providers)
  const signingIn = isSigningIn(view.providers)
  return (
    <>
      <h1 id="rw-title">{COPY.updateTitle}</h1>
      <p className="rw-one update">{COPY.updateLine}</p>
      {addAnother ? (
        <div style={{ marginBottom: 24 }}>
          <AiChoices view={view} signingIn={signingIn} onKeys={onKeys} onSignIn={onSignIn} skip={false} />
          <div className="rw-links" style={{ marginTop: 4 }}>
            <SheetButton label="Done" tooltip="Back to your AI and projects" onClick={() => setAddAnother(false)} />
          </div>
        </div>
      ) : (
        <>
          <div className="rw-h2row">
            <h2>{COPY.yourAi}</h2>
            <SheetButton label={COPY.addAnother} tooltip="Sign in to another AI or set up OpenCode" small onClick={() => setAddAnother(true)} />
          </div>
          <div className="rw-airbox" role="list" aria-label={COPY.yourAi}>
            {view.offline && <div className="rw-offline" role="status"><Icon name="wifi-slash" size={16} tone="inherit" />{COPY.offline}</div>}
            {rows.map((provider) => <ProviderRow key={provider.id} view={provider} onSetUp={() => onKeys('opencode')} onSignIn={() => onSignIn(provider.id as AccountProviderId)} />)}
          </div>
        </>
      )}
      <h2>{COPY.whereToStart}</h2>
      <Projects view={view} newProjectOpen={newProjectOpen} setNewProjectOpen={setNewProjectOpen} />
      <UsageData on={view.usageData.on} fromRitemark1={view.usageData.fromRitemark1} />
    </>
  )
}

function StartSheet({ view, newProjectOpen, setNewProjectOpen }: { view: WelcomeState; newProjectOpen: boolean; setNewProjectOpen: (open: boolean) => void }) {
  return (
    <>
      <h1 id="rw-title" className="sr-only">{COPY.startTitle}</h1>
      <h2>{COPY.whereToStart}</h2>
      <Projects view={view} newProjectOpen={newProjectOpen} setNewProjectOpen={setNewProjectOpen} />
    </>
  )
}

function Projects({ view, newProjectOpen, setNewProjectOpen }: { view: WelcomeState; newProjectOpen: boolean; setNewProjectOpen: (open: boolean) => void }) {
  if (view.projects.length === 0) {
    return <ProjectChoices view={view} newProjectOpen={newProjectOpen} setNewProjectOpen={setNewProjectOpen} sample />
  }
  return (
    <>
      {view.projects.map((project, index) => <ProjectRow key={project.id} project={project} first={index === 0} disabled={view.opening} />)}
      {newProjectOpen && (
        <NewProjectForm placePrefix={view.newProject.placePrefix} error={view.newProject.error} disabled={view.opening} onCancel={() => setNewProjectOpen(false)} />
      )}
      <div className="rw-wl2">
        <SheetButton label={COPY.openAnotherFolder} tooltip="Choose a folder on this computer" icon={<Icon name="folder-open" size={14} tone="inherit" />} onClick={() => send({ type: 'welcome/open-folder' })} disabled={view.opening} />
        {!newProjectOpen && (
          <SheetButton label={COPY.newProject} tooltip="Name a new, empty folder for your project" icon={<Icon name="folder-plus" size={14} tone="inherit" />} onClick={() => setNewProjectOpen(true)} disabled={view.opening} />
        )}
      </div>
    </>
  )
}

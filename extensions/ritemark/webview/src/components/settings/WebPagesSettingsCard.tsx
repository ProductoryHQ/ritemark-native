/**
 * Settings ▸ Sharing ▸ Web pages (Sprint 149, PR 4; spec R9; the Experience lead's answer 6): a card like Google
 * Docs', with its two states, the published pages with Open and Unpublish, and Disconnect's and Unpublish's questions.
 *
 * Renders the host's projection and sends intent only. **It never holds a token:** Set up and Use a token send
 * `publish:startTokenEntry`, which carries nothing, and the host opens its own password box (R6). The shape mirrors
 * `WebPagesSettingsProjection` in `src/publish/settingsProtocol.ts`.
 *
 * 2.2 ships the token path only (the plan's cut 1): with no OAuth client, Set up is the token path, and the muted
 * "Have a Cloudflare token? Use it instead" line waits for OAuth's Connect.
 */

import { useState } from 'react'
import { vscode } from '../../lib/vscode'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { TurningMark } from '../ui/turning-mark'
import { SettingsGroup, SettingsRow, TipButton } from './SettingsRow'

export interface WebPageRow {
  id: string
  name: string
  address: string
  status: 'online' | 'unpublishing'
  slow: boolean
  message: string | null
}

export interface WebPagesSettingsProjection {
  enabled: boolean
  state: 'disconnected' | 'connected'
  accountName: string | null
  subdomain: string | null
  enteringToken: boolean
  oauthAvailable: boolean
  pages: WebPageRow[]
  message: string | null
}

type Question = { kind: 'disconnect' } | { kind: 'unpublish'; page: WebPageRow } | null

function send(message: { type: 'publish:connect' | 'publish:startTokenEntry' | 'publish:disconnect' } | { type: 'publish:open' | 'publish:unpublish'; id: string }) {
  vscode.postMessage(message)
}

/** The page's name as the question says it: the file's name without `.html`. */
export function pageTitle(fileName: string): string {
  return fileName.replace(/\.html?$/i, '')
}

/** The connected row's line (answer 6). */
export function connectedLine(projection: Pick<WebPagesSettingsProjection, 'accountName' | 'subdomain'>): string {
  const who = `Connected as ${projection.accountName ?? 'your Cloudflare account'}.`
  return projection.subdomain ? `${who} Your pages end in ${projection.subdomain}.workers.dev.` : who
}

export const NOT_SET_UP_LINE = 'Not set up. The first Publish asks; Cloudflare is free.'
export const DISCONNECT_QUESTION = {
  title: 'Disconnect Cloudflare?',
  body: 'Your published pages stay online. To take one down, unpublish it first.',
} as const
export const UNPUBLISH_BODY = 'The link stops working for everyone who has it. The file stays in this project.'
export const SLOW_LINE = 'Cloudflare is still taking the page down.'

export function WebPagesSettingsCard({ projection }: { projection: WebPagesSettingsProjection | null }) {
  const [question, setQuestion] = useState<Question>(null)
  if (!projection) return null
  const connected = projection.state === 'connected'
  // With the flag off, a person with no connection and no page has nothing here to do (S28b)
  if (!projection.enabled && !connected && projection.pages.length === 0) return null

  const answer = () => {
    if (question?.kind === 'disconnect') send({ type: 'publish:disconnect' })
    if (question?.kind === 'unpublish') send({ type: 'publish:unpublish', id: question.page.id })
    setQuestion(null)
  }

  return (
    <section id="settings-section-web-pages" className="scroll-mt-6">
      <SettingsGroup>Web pages</SettingsGroup>
      {connected ? (
        <SettingsRow row="W1" name="Your Cloudflare" line={connectedLine(projection)}>
          <TipButton tip="Forgets your Cloudflare here. Your published pages stay online." variant="ghost" size="sm" onClick={() => setQuestion({ kind: 'disconnect' })}>
            Disconnect
          </TipButton>
        </SettingsRow>
      ) : (
        <SettingsRow
          row="W1"
          name="Where your web pages go"
          line={projection.enteringToken
            ? 'Paste the token in the box Ritemark opened. Cloudflare’s page opened in your browser.'
            : projection.enabled ? NOT_SET_UP_LINE : 'Not set up.'}
        >
          {projection.enabled && (
            <TipButton
              tip={projection.enteringToken ? 'Ritemark is waiting for the token' : 'Opens Cloudflare’s token page and a box to paste the token in'}
              variant="outline"
              size="sm"
              disabled={projection.enteringToken}
              onClick={() => send({ type: projection.oauthAvailable ? 'publish:connect' : 'publish:startTokenEntry' })}
            >
              Set up
            </TipButton>
          )}
        </SettingsRow>
      )}

      {projection.enabled && !connected && projection.oauthAvailable && (
        <p className="mt-2 text-[13px] leading-[18px] text-ink-muted">
          Have a Cloudflare token?{' '}
          <TipButton tip="Opens Cloudflare's token page and a box to paste the token in" variant="link" size="sm" className="h-auto p-0 text-[13px]" onClick={() => send({ type: 'publish:startTokenEntry' })}>
            Use it instead
          </TipButton>
        </p>
      )}

      {projection.pages.map((page) => {
        const busy = page.status === 'unpublishing'
        return (
          <SettingsRow
            key={page.id}
            row="W2"
            name={page.name}
            line={
              <>
                <span className="block truncate">{page.address}</span>
                {busy && page.slow && <span className="block">{SLOW_LINE}</span>}
                {page.message && <span role="alert" className="block text-ink-strong">{page.message}</span>}
              </>
            }
          >
            {busy ? (
              <span className="inline-flex items-center gap-1.5 px-2 text-[13px] text-ink-muted">
                <TurningMark />
                Unpublishing…
              </span>
            ) : (
              <>
                <TipButton tip="Opens the published page in your browser" variant="ghost" size="sm" onClick={() => send({ type: 'publish:open', id: page.id })}>
                  Open
                </TipButton>
                <TipButton tip="Takes the page off the internet. The file stays in this project." variant="outline" size="sm" onClick={() => setQuestion({ kind: 'unpublish', page })}>
                  {page.message ? 'Try again' : 'Unpublish'}
                </TipButton>
              </>
            )}
          </SettingsRow>
        )
      })}

      {projection.message && (
        <p role="alert" className="mt-2 text-[13px] leading-[18px] text-ritemark-error">{projection.message}</p>
      )}

      <Dialog open={question !== null} onOpenChange={(open) => { if (!open) setQuestion(null) }}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader onClose={() => setQuestion(null)}>
            <DialogTitle>
              {question?.kind === 'unpublish' ? `Unpublish ${pageTitle(question.page.name)}?` : DISCONNECT_QUESTION.title}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription className="text-[13px] leading-[18px]">
              {question?.kind === 'unpublish' ? UNPUBLISH_BODY : DISCONNECT_QUESTION.body}
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <TipButton tip="Changes nothing" variant="ghost" size="sm" onClick={() => setQuestion(null)}>Cancel</TipButton>
            {question?.kind === 'unpublish' ? (
              <TipButton tip="The link stops working for everyone who has it" variant="destructive" size="sm" onClick={answer}>Unpublish</TipButton>
            ) : (
              <TipButton tip="Forgets your Cloudflare here. Your published pages stay online." size="sm" onClick={answer}>Disconnect</TipButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

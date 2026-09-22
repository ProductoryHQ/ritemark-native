// Sprint 119 Phase 0 canary — installed-app OAuth loopback flow.
// Disposable research script. Not product code, never imported by the extension.
//
// Usage:
//   node oauth-canary.mjs start          # start listener, print the auth URL
//   node oauth-canary.mjs exchange       # exchange the captured code (no client secret)
//   node oauth-canary.mjs refresh        # refresh using the stored refresh token
//   node oauth-canary.mjs revoke         # revoke the grant
//
// Secrets: tokens are written to ./state.json with mode 0600 and are never printed.
// Only metadata (expiry, scope, presence) reaches stdout.

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const STATE = path.join(DIR, 'state.json')
const CLIENT_ID = process.env.CANARY_CLIENT_ID
  || '620148959973-fhg4nqnl8ogv942ev8gvvru2j0f0hng1.apps.googleusercontent.com' // canary client, disposable
const SECRET_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.canary-secret')
const clientSecret = () => process.env.CANARY_CLIENT_SECRET
  || (fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8').trim() : '')
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const REVOKE = 'https://oauth2.googleapis.com/revoke'

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')) } catch { return {} }
}
function writeState(patch) {
  const next = { ...readState(), ...patch }
  fs.writeFileSync(STATE, JSON.stringify(next, null, 2), { mode: 0o600 })
  fs.chmodSync(STATE, 0o600)
  return next
}
// Never print a token. Describe it instead.
const describe = (t) => (t ? `present (${t.length} chars, starts "${t.slice(0, 4)}…")` : 'absent')

async function start() {
  const verifier = b64url(crypto.randomBytes(64))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const state = b64url(crypto.randomBytes(24))
  const log = []

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    log.push({ at: new Date().toISOString(), path: url.pathname, query: Object.fromEntries([...url.searchParams].map(([k, v]) => [k, k === 'code' ? `<${v.length} chars>` : v])) })
    const code = url.searchParams.get('code')
    const got = url.searchParams.get('state')
    if (url.pathname !== '/') { res.writeHead(404).end('no'); return }
    if (!code) {
      res.writeHead(400, { 'content-type': 'text/plain' }).end('no code: ' + (url.searchParams.get('error') || 'unknown'))
      writeState({ callbackLog: log, lastError: url.searchParams.get('error') })
      console.log('CALLBACK without code:', url.searchParams.get('error'))
      return
    }
    if (got !== state) {
      res.writeHead(400, { 'content-type': 'text/plain' }).end('state mismatch — rejected')
      console.log('CALLBACK rejected: state mismatch')
      return
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Ritemark Phase 0 canary: code received. You can close this tab.')
    writeState({ code, verifier, callbackLog: log, codeReceivedAt: new Date().toISOString(), pickedFileIds: url.searchParams.get('picked_file_ids') })
    if (url.searchParams.get('picked_file_ids')) console.log('PICKED', url.searchParams.get('picked_file_ids'))
    console.log('CODE captured, length', code.length)
    setTimeout(() => { server.close(); console.log('listener closed') }, 500)
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const redirect = `http://127.0.0.1:${port}`
  const authUrl = `${AUTH}?${new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
    ...(process.env.CANARY_PICKER ? { trigger_onepick: 'true', mimetypes: 'application/vnd.google-apps.document' } : {}),
  })}`
  writeState({ port, redirect, verifier, state, startedAt: new Date().toISOString() })
  console.log('REDIRECT_URI', redirect)
  console.log('AUTH_URL', authUrl)
  setTimeout(() => { try { server.close() } catch {} console.log('listener timed out after 300s') }, 300_000)
}

async function post(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = null }
  return { status: res.status, json, text }
}

async function exchange() {
  const s = readState()
  if (!s.code) throw new Error('no code in state.json — run start first')
  const base = {
    client_id: CLIENT_ID,
    code: s.code,
    code_verifier: s.verifier,
    grant_type: 'authorization_code',
    redirect_uri: s.redirect,
  }
  const secret = process.env.CANARY_NO_SECRET ? '' : clientSecret()
  const attempt = await post(TOKEN, secret ? { ...base, client_secret: secret } : base)
  console.log('EXCHANGE status', attempt.status, secret ? '(with secret)' : '(no secret)')
  if (attempt.status !== 200) {
    console.log('ERROR body', attempt.text.slice(0, 400))
    writeState({ exchange: { status: attempt.status, error: attempt.json?.error, description: attempt.json?.error_description, withSecret: Boolean(secret) } })
    return
  }
  const t = attempt.json
  console.log('access_token', describe(t.access_token))
  console.log('refresh_token', describe(t.refresh_token))
  console.log('expires_in', t.expires_in, 'scope', t.scope, 'token_type', t.token_type)
  writeState({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    exchange: { status: 200, expires_in: t.expires_in, scope: t.scope, withSecret: Boolean(secret), at: new Date().toISOString() },
  })
}

async function refresh() {
  const s = readState()
  if (!s.refresh_token) throw new Error('no refresh token')
  const secret = process.env.CANARY_NO_SECRET ? '' : clientSecret()
  const base = { client_id: CLIENT_ID, refresh_token: s.refresh_token, grant_type: 'refresh_token' }
  const r = await post(TOKEN, secret ? { ...base, client_secret: secret } : base)
  console.log('REFRESH status', r.status, secret ? '(with secret)' : '(no secret)')
  if (r.status !== 200) { console.log('ERROR body', r.text.slice(0, 300)); return }
  console.log('new access_token', describe(r.json.access_token), 'expires_in', r.json.expires_in)
  writeState({ access_token: r.json.access_token, refreshedAt: new Date().toISOString() })
}

async function revoke() {
  const s = readState()
  const token = s.refresh_token || s.access_token
  if (!token) throw new Error('nothing to revoke')
  const r = await post(REVOKE, { token })
  console.log('REVOKE status', r.status, r.text.slice(0, 200))
}

const cmd = process.argv[2]
const fns = { start, exchange, refresh, revoke }
if (!fns[cmd]) { console.error('commands: start | exchange | refresh | revoke'); process.exit(1) }
await fns[cmd]()

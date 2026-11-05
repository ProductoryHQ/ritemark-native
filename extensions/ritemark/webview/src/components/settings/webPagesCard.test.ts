/**
 * Sprint 149, PR 4: Settings ▸ Sharing ▸ Web pages, and the workers.dev name row's rules. The lead's words (answers
 * 5–8), every button the shared Button with a tooltip, and no token in anything the card sends.
 *
 * Run: npx tsx webview/src/components/settings/webPagesCard.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addressHint, addressPreview, nameReady, NAME_ROW, pagePartReady, randomEndOf, refusalLine, SETUP_COPY, webSafeName, webSafePagePart } from '../publish/workersDevName'
import { isValidPagePart } from '../../../../src/publish/sheetProtocol'

const HERE = dirname(fileURLToPath(import.meta.url))
const card = readFileSync(join(HERE, 'WebPagesSettingsCard.tsx'), 'utf8')
const row = readFileSync(join(HERE, '../publish/WorkersDevNameRow.tsx'), 'utf8')
const sheet = readFileSync(join(HERE, '../publish/PublishSheet.tsx'), 'utf8')

// The words, as the lead wrote them
assert.match(card, /'Not set up\. The first Publish asks; Cloudflare is free\.'/)
assert.match(card, /title: 'Disconnect Cloudflare\?'/)
assert.match(card, /body: 'Your published pages stay online\. To take one down, unpublish it first\.'/)
assert.match(card, /'The link stops working for everyone who has it\. The file stays in this project\.'/)
assert.match(card, /`Unpublish \$\{pageTitle\(question\.page\.name\)\}\?`/)
assert.match(card, /'Cloudflare is still taking the page down\.'/)
assert.match(card, /Your pages end in \$\{projection\.subdomain\}\.workers\.dev\./)
assert.match(card, /variant="destructive"[^>]*>Unpublish</, 'Unpublish in the destructive red')
assert.equal(NAME_ROW.taken, 'This name is taken. Try another.')
assert.equal(NAME_ROW.help, 'The same for all your pages. You can change it in Cloudflare later.')

// Every button: the shared Button through TipButton (tooltip), no raw <button>, no DialogButton
assert.doesNotMatch(card, /<button\b|DialogButton/)
const buttons = card.match(/<TipButton\b[^>]*>/g) ?? []
assert.ok(buttons.length >= 7, `${buttons.length} buttons`)
for (const b of buttons) assert.match(b, /\btip=/, `a button with no tooltip: ${b}`)
assert.doesNotMatch(row, /<button\b/)

// What the card sends: the five types, none with a value; the plain words stay off screen
const sent = [...card.matchAll(/send\(\{ type: '([^']+)'([^}]*)\}/g)].map((m) => [m[1], m[2]])
for (const [type, rest] of sent) {
  assert.match(type, /^publish:(connect|startTokenEntry|disconnect|open|unpublish)$/)
  assert.doesNotMatch(rest, /token|value|key|secret/i, `${type} carries more than an id`)
}
assert.ok(sent.some(([t]) => t === 'publish:startTokenEntry'))
const visible = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
assert.doesNotMatch(visible, /['>][^'<]*\b(API|Worker|scope|permission|deploy|HTML)\b[^'<]*['<]/, 'machinery words on screen')

// The name row's rules
assert.equal(webSafeName('Pages 4821'), 'pages-4821')
assert.equal(webSafeName('--Mari_Tamm'), 'mari-tamm')
assert.equal(nameReady('pages-4821'), true)
assert.equal(nameReady('pages-'), false)
assert.equal(nameReady(''), false)
assert.equal(addressPreview('harbour-programme-7f3a2c', 'pages-4821'), 'harbour-programme-7f3a2c.pages-4821.workers.dev')

// Round 2: frame 2 follows the token-only cut (the lead, 5 November)
assert.equal(SETUP_COPY.title, 'Where should your web pages go?')
assert.equal(SETUP_COPY.button, 'Set up', 'Sign in reads Set up')
assert.equal(SETUP_COPY.line, 'Free. No account yet? You can make one on Cloudflare’s page.')
assert.equal(SETUP_COPY.buttonTip, 'Opens Cloudflare’s token page and a box to paste the token in', 'the same as Settings\' Set up')
assert.doesNotMatch(JSON.stringify(SETUP_COPY) + sheet, /Have an API token|Add it in Settings|Sign in|sign in/, 'the API-token line goes; no Sign in')
assert.match(sheet, /type: 'publish:setUp' \}/, 'Set up sends no value')
assert.doesNotMatch(sheet, /<button\b/)
for (const b of sheet.match(/<Button\b/g) ?? []) assert.ok(b)
const sheetButtons = [...sheet.matchAll(/<Tooltip\b[^>]*>\s*<Button\b/g)].length
assert.ok(sheetButtons >= (sheet.match(/<Button\b/g) ?? []).length, 'every sheet button sits in a Tooltip')

// Round 2: the name row and the address field in the sheet
assert.match(sheet, /<WorkersDevNameRow\b/, 'the name row is drawn by the sheet')
assert.match(sheet, /taken=\{nameRefused\}/)
assert.equal(refusalLine('nameTaken', '-7f3a2c'), 'This name is taken. Try another.')
assert.equal(refusalLine('addressTaken', '-7f3a2c'), 'This address is taken. Try another.')
assert.equal(refusalLine('addressInvalid', '-7f3a2c'), addressHint('-7f3a2c'))
assert.equal(webSafePagePart('Harbour Programme-7f3a2c'), 'harbour-programme-7f3a2c')
assert.equal(randomEndOf('harbour-programme-7f3a2c'), '-7f3a2c')
for (const [part, ok] of [['harbour-programme-7f3a2c', true], ['harbour-programme', false], ['harbour-7F3A2C', false], ['-7f3a2c', false], ['a'.repeat(57) + '-7f3a2c', false], ['a'.repeat(56) + '-7f3a2c', true]] as const) {
  assert.equal(pagePartReady(part), ok, part)
  assert.equal(pagePartReady(part), isValidPagePart(part), `the sheet and the host agree on ${part}`)
}

console.log('webPagesCard.test.ts: all assertions passed')

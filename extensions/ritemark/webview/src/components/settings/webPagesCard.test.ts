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
import { addressHint, addressPreview, nameReady, NAME_ROW, pagePartReady, PUT_IT_BACK, randomEndOf, refusalLine, SETUP_COPY, webSafeName, webSafePagePart, withRandomEnd } from '../publish/workersDevName'
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

// Round 3: the lead's hint and Put it back (PR 4, round 2)
assert.equal(addressHint('-7f3a2c'), "Keep the random end, -7f3a2c, so a guessed address doesn't find the page.")
assert.equal(PUT_IT_BACK.label, 'Put it back')
assert.match(sheet, /<Tooltip label=\{PUT_IT_BACK\.tip\}>\s*<Button variant="link"[^>]*onClick=\{putBack\}>\s*\{PUT_IT_BACK\.label\}/, 'Put it back: a text link, with a tooltip')
assert.match(sheet, /!addressReady \? addressHint\(randomEnd\)/, 'the disabled Publish\'s tooltip: the same sentence, without the link')
assert.doesNotMatch(addressHint('-7f3a2c'), /Put it back/)
assert.match(sheet, /const canPutBack = editable && randomEnd !== '' && !pagePartReady\(pagePart\)/, 'Put it back while the random end is missing')
assert.match(sheet, /\{canPutBack && \(\s*<>\s*\{' '\}\s*<Tooltip label=\{PUT_IT_BACK\.tip\}>/, 'the link after the hint, while it can put the end back')
assert.match(sheet, /setPagePart\(withRandomEnd\(pagePart, randomEnd, model\.address\?\.page \?\? ''\)\)/, 'it restores the end the sheet suggested')
const suggested = 'harbour-programme-7f3a2c'
for (const [typed, back] of [
  ['harbour-programme', 'harbour-programme-7f3a2c'],
  ['harbour-programme-', 'harbour-programme-7f3a2c'],
  ['harbour-programme-7f3a', 'harbour-programme-7f3a2c'],
  ['harbour-programme-7f3a2', 'harbour-programme-7f3a2c'],
  ['summer-2026', 'summer-2026-7f3a2c'],
  ['harbour1', 'harbour1-7f3a2c'],
  ['', suggested],
  ['a'.repeat(63), 'a'.repeat(56) + '-7f3a2c'],
  ['harbour-programme-abcdef', 'harbour-programme-abcdef'],
] as const) {
  const result = withRandomEnd(typed, '-7f3a2c', suggested)
  assert.equal(result, back, `Put it back on "${typed}"`)
  assert.ok(pagePartReady(result), `"${result}" lets Publish go`)
}
assert.equal(withRandomEnd('harbour', '', suggested), 'harbour', 'no suggested end: nothing to put back')

// Round 3: Settings offers Set up only once Publish is reachable (the card reads the host's rule)
assert.match(card, /const setUp = offersSetUp\(projection\)/)
assert.match(card, /if \(!showsWebPagesCard\(projection\)\) return null/)
assert.match(card, /\{setUp && \(\s*<TipButton[\s\S]*?Set up\s*<\/TipButton>/, 'Set up only with setUp')
assert.doesNotMatch(card, /projection\.enabled &&/, 'nothing offered on the flag alone')
assert.match(card, /page\.status !== 'unpublished' && \(\s*<TipButton tip="Opens the published page in your browser"[^\n]*\n\s*Open\n/, 'no Open for a page that is down')

console.log('webPagesCard.test.ts: all assertions passed')

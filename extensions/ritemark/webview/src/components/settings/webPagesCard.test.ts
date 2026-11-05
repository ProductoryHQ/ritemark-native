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
import { addressPreview, nameReady, NAME_ROW, webSafeName } from '../publish/workersDevName'

const HERE = dirname(fileURLToPath(import.meta.url))
const card = readFileSync(join(HERE, 'WebPagesSettingsCard.tsx'), 'utf8')
const row = readFileSync(join(HERE, '../publish/WorkersDevNameRow.tsx'), 'utf8')

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

console.log('webPagesCard.test.ts: all assertions passed')

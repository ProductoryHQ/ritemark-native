# Sprint 175 technical plan

Reuses what exists; the new code is small. Follows the measurements' Decision: readers follow by checking (no room), layer 1 behind a switch, one deploy in flight.

## What exists (read 24 November)
- `src/decks/deckPublish.ts` `DeckPublisher`: `publish()` writes the page file and runs 2.2's Publish; one at a time per deck (`running`); `refresh`/`refreshSoon` keep the chip; `deckChanged` compares digests (`pageReadsChanged`).
- `src/publish/PublishController.ts`: `publishPage`, `sheetNeeded` (`publishRecords.ts`), `pageState`; `gather.ts`, `secretScan.ts`, `cloudflare/client.ts` `deploy()` (session, upload, metadata-only PUT, subdomain POST: ~6 s).
- `src/decks/page/publicDeck.ts` (the digest: what the page shows), `pageHtml.ts` (`PAGE_CSP` is `default-src 'none'`; slides carry `data-key="shortHash(key)"`), `pageScript.ts` (`#n` as position; ticks keyed `slide:<data-key>:<step>`).
- `webview/src/components/decks/DeckPublish.tsx`: the chip and its menu on the deck's bar. It is webview code, so **no patch 010 change**: patch 010's chip belongs to a plain page's browser bar and keeps its own Copy link (spec E4).
- Picture metadata: **not stripped today** (nothing in `src/publish/` or `src/decks/page/` reads EXIF or rewrites picture bytes).

## Pieces

**1. Picture cleaner** (`src/publish/pictureClean.ts`, new): byte-level, no dependency. JPEG: drop APPn (EXIF, XMP, IPTC, comments) and keep a minimal EXIF with Orientation only; PNG: drop tEXt/zTXt/iTXt/eXIf/tIME; WebP: drop EXIF/XMP chunks; GIF: drop comment and application extensions except the animation one. Called where `gather.ts` hands bytes to the upload, so the hash in the record is the sent bytes' and `sheetNeeded` stays consistent. Unknown picture types are returned unchanged and flagged `uncleanable` (a live pause; the manual sheet is as 2.3).

**2. Live engine** (`src/decks/deckLive.ts`, new, used by `DeckPublisher`): per page: `{ on, pause?, inFlight, pending }`. Persisted in the publish record (`publishRecords.ts` gains `live?: { on: boolean; pause?: { kind, at, slide, detail } }`; the record's version stays, a missing field means off).
- Trigger: `onDidSaveTextDocument` for the deck plus the file watcher for another program's write (open window only), then the digest compared with the page's. Nothing at activation (R5).
- Latest wins: a save while `inFlight` sets `pending = true`; the end of the deploy builds from the *then-current* saved text and runs once more.
- The build is the same as `publish()` (`pageInput` → `buildDeckPage` → `writeDeckPage`), then a new `PublishController` entry `updateLive(pagePath)` that runs `gather` + key scan + the deck-folder rule and **never opens the sheet**: any condition for which `sheetNeeded` would show the sheet becomes a pause, except new files inside the deck's folder within limits (R18). `consent` is the existing `unchanged-update` path extended with `live-update`, which `publishPage` accepts only for a record whose `live.on` is true (so no caller can use it otherwise).
- The view's `body`/`look`/`steps` are remembered per seat from the view's last message; with no view open the saved text is used with the look from front matter and the same steps fallback `textAndFit` already has. A test compares a live build with a manual Update on the same deck.
- Switch, Go on and switch-off are new `deck/*` messages in `deckProtocol.ts`, handled in the deck view's message handler only. Go on re-runs gather and the scan; a key hit returns `blocked`.

**3. Version file.** `buildDeckPage` also returns `version.json` `{ v, slides: [{ key, title }] }`; `v` is the build time in ms (rises on every deploy; compared as a number). Not in the digest. The upload adds it and a `_headers` rule `/version.json  Cache-Control: no-store`. Slides listed come from the public deck (skipped slides left out), so the list matches the page.

**4. Page script** (`pageScript.ts`, `pageHtml.ts`): a checker: `fetch('version.json', {cache:'no-store'})` about every 10 s while `document.visibilityState === 'visible'`, and on `visibilitychange`/`focus`. Newer only (`v` greater than the page's). A reader-idle gate (about 1 s with no scroll/key/touch/pointer, no selection). It fetches the new `index.html`, compares each slide's block text with the page in front of it (by slide key) to find changed blocks on the reader's slide, stores `{key, changed, at}` in `sessionStorage`, then reloads; the new load restores the slide by key (replacing the `#n` read when the store has one), draws the 2 s glow and "Updated just now". If the compare fails, no glow list is stored. Removed slide: the page stays in front (no reload), dims the slide, shows the note and "Go on to <title>" built from the list; its press reloads at that key. `PAGE_CSP` gains `connect-src 'self'` and the script's own sha256 (computed in `pageHtml`, which already builds the page's strings); a test compares the policy to the old one minus those two additions. Ticks need no change (same keys).

**5. Chip** (`DeckPublish.tsx`, `deckProtocol.ts` `DeckPageState` gains `live: { on, state: 'live'|'updating'|'paused'|'offline', pause?, tooltip }`). Menu per R16, paused menu per R11. Copy link leaves the bar; shadcn Button and tooltip kit, a tooltip on every control, popups close on outside click and Esc. The state comes from `deckLive` through the existing `refresh` queue so an older answer is never posted after a newer one.

**6. The AI's step.** After an agent turn ends, the host asks `deckLive` whether a live deck it saved during the turn sent or paused, and posts the step through the same path other Ritemark steps use (as the chat's other host-written steps). The model's text is never included. `ritemarkTools.ts` unchanged; a test lists each runtime's tools and fails on any name containing publish, switch or go on, and a second test fails if `deckLive` is reachable from a runtime module.

**7. Timetable** (`src/decks/timetable.ts`, new): parses `time:` per slide and the session field, sums sections, reads "25 min" from an exercise label (`label` code already sets the presenter timer; the PR reuses that reader), produces the status-bar text and the list's starts. `publicDeck` drops `time:` and the session from what it reads (digest test). The presenter view's session length and this one are one value: the PR finds the field the presenter view keeps with the deck and reuses it, adding no second. UI: deck bar number, status-bar item (where the word count is, via the existing status path for decks), thumbnail corner, list view in `SlideStrip.tsx`.

## Risks
- **The page script is public and now fetches.** Mitigation: same-origin only, CSP above, forward-only, no content from the response is inserted other than by reload; the removed-slide titles are inserted as text.
- **Cloudflare's step-backs** (measurement 1) — handled by R22; the 200-update runs show 0 failures.
- **Live build differing from a manual Update** (fit steps) — the comparison test.
- **Clock going backwards** makes `v` lower than a page holds: then pages ignore the deploy; the next deploy higher than theirs works. The engine also takes `max(now, last v + 1)` from the record.
- **Windows path identity** for "inside the deck's folder": `samePath`/`normalizeForCompare` and realpath.
- **A shared hot file**: `DeckPublish.tsx`, `SlideStrip.tsx` merge one at a time.

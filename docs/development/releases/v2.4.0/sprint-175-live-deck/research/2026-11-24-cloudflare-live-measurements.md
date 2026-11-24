# Live publishing: five Cloudflare measurements (24 November 2026)

Taken on Ritemark's Cloudflare test account, headless, through `scripts/qa/with-test-keys.sh`; every test Worker and Durable Object namespace was deleted afterwards. The deploy calls follow `src/publish/cloudflare/client.ts` `deploy()` (session, upload, metadata-only PUT, subdomain POST); the pages are real `pageHtml()` deck pages.

## 1. An update at the edge
12 updates of `index.html` + `version.json` on one existing name, polled every 250 ms.

| | min | median | max |
|---|---|---|---|
| Deploy | 5.5 s | 6.1 s | 11.2 s |
| Save until every probe shows the new version | 6.1 s | 6.9 s | 11.8 s |
| Deploy end until seen | 0.37 s | ≈0.5 s | 1.25 s |

In 11 of 12 updates, some later polls stepped back to the old version for up to 2.8 s (edges ARN, RIX, TLL; cause not proven). A brand-new name answered 2.9 s after its deploy (2.2's 121 s did not recur on this account).

## 2. Cache headers
HTML and files: `public, max-age=0, must-revalidate`, `CF-Cache-Status: HIT`; `version.json` has an ETag (304 on If-None-Match). A `_headers` rule `/version.json  Cache-Control: no-store` is honoured in the response header but does not stop the step-backs. Today's `PAGE_CSP` (`default-src 'none'`) blocks any fetch: a checker needs `connect-src 'self'` and its own script hash.

## 3. 200 updates in a row (twice: back to back, and with a 3 s pause)
0 failures, 0 429s, 2,000 API calls all 2xx; median 6.0 s per deploy (p90 6.8–7.2 s). One update per ~6 s is the ceiling (the four API calls, not a rate limit). Out-of-order reads happened (up to 6 versions behind in one run; at most 1 behind in a repeat of 40): real, not reproducible.

## 4. The slide on refresh
`pageScript.ts` reads `#n` as a position. Text-only change: same slide. Two slides added before: `#5` silently shows another slide. The slide removed: the next one shows. Deck shrunk below n: the first slide, hash removed. A checker that fetches `version.json` and reloads kept the reader's `#6` in all six runs; save to reload 5.8–14.7 s (2 s and 10 s checks). **Both designs need the slide kept by key (title + nth, as the ticks already use), not by position.**

## 5. A room that pushes (Worker + SQLite Durable Object, hibernation, 200 ms combining, control key only on POST)
Save to seen 0.26–0.38 s (0.5 s after hibernation); five POSTs at once arrived as one message; a POST without the key: 403. Reconnect: full state in 68–434 ms. Free plan: SQLite DOs only; nothing billed while hibernated; the ping auto-response doesn't wake the object. But Ritemark would deploy its own code (Worker, DO binding, migration, secret) into the person's account, and whether the token Ritemark's link asks for (Workers Scripts Edit) covers DOs and migrations is untested. CSP: `connect-src wss://<room-host>`, or `'self'` when the room serves the page.

## Decision (Development manager, 24 November, after Jarmo's roadmap approval)
- **Readers follow by checking:** a no-store `version.json`, every ~10 s and on focus; reload only to a *newer* version (never older: the step-backs), after the reader stops moving, keeping their slide by key. Save to seen ≈ 8–16 s. Same deploy shape, token and promise as today. The room is a later upgrade, after the token permission is proven.
- **Layer 1:** update on save while the page's switch is on; at most one deploy in flight, the latest save wins (≤ one per ~6 s).
- **Pictures:** a new picture inside the deck's own folder that a slide shows publishes without a pause, its name once in the tooltip, provided it passes the size and file-count limits and carries no metadata (GPS, camera, author): publish strips it, or this sprint adds that. A file outside the deck's folder or a key always pauses.

Raw scripts and logs: the Development manager's scratchpad (`live-measure/`), not kept in the repo.
